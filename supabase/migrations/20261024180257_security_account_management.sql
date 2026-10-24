-- Service-only security control; no financial tables, customer roles or balances are modified.
ALTER TABLE public.f90_security_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
 ADD COLUMN IF NOT EXISTS revoked_by uuid, ADD COLUMN IF NOT EXISTS revoke_reason text;
CREATE TABLE public.f90_security_alerts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 kind text NOT NULL, subject_key text NOT NULL, user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 bucket timestamptz NOT NULL, occurrences integer NOT NULL DEFAULT 1,
 details jsonb NOT NULL DEFAULT '{}', first_seen_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(), alerted_at timestamptz,
 acknowledged_at timestamptz, acknowledged_by uuid, acknowledgement_reason text,
 UNIQUE(kind,subject_key,bucket));
ALTER TABLE public.f90_security_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.f90_security_alerts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.f90_security_alerts TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.f90_security_alerts_id_seq TO service_role;
CREATE INDEX f90_security_alerts_recent ON public.f90_security_alerts(last_seen_at DESC);

CREATE FUNCTION public.f90_security_signal(p_kind text,p_key text,p_user uuid DEFAULT NULL,p_details jsonb DEFAULT '{}',p_threshold integer DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.f90_security_alerts%ROWTYPE; threshold integer:=greatest(1,least(20,p_threshold));
BEGIN
 IF p_kind NOT IN ('login_failed','new_session','connection_change','admin_denied','api_key_invalid','verification_changed','permissions_changed','sessions_revoked') THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 INSERT INTO public.f90_security_alerts(kind,subject_key,user_id,bucket,details)
 VALUES(p_kind,left(p_key,160),p_user,date_bin(interval '15 minutes',now(),'2020-01-01'::timestamptz),p_details)
 ON CONFLICT(kind,subject_key,bucket) DO UPDATE SET occurrences=f90_security_alerts.occurrences+1,last_seen_at=now()
 RETURNING * INTO a;
 IF a.occurrences>=threshold AND a.alerted_at IS NULL THEN
  UPDATE public.f90_security_alerts SET alerted_at=now() WHERE id=a.id AND alerted_at IS NULL;
  -- Reuse the configured operational Telegram channel; never send IP, credentials, location or documents.
  IF EXISTS(SELECT 1 FROM public.site_settings WHERE id=1 AND config#>>'{telegram_alerts,security_enabled}' IS DISTINCT FROM 'false') AND EXISTS(SELECT 1 FROM public.f90_telegram_alerts WHERE status='sent') THEN
   INSERT INTO public.f90_telegram_alerts(event_key,event_type,payload)
   VALUES('security:'||a.id,'ops_issue',jsonb_build_object('code','security.'||p_kind,'level','warning','message','تنبيه أمني جديد في مركز أمان الحسابات. راجع لوحة الإدارة.','created_at',now())) ON CONFLICT(event_key) DO NOTHING;
  END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.f90_security_signal(text,text,uuid,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_security_signal(text,text,uuid,jsonb,integer) TO service_role;

CREATE FUNCTION f90_private.require_security_manager(p_actor uuid,p_session uuid)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager']);
 IF NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=p_session AND user_id=p_actor AND (not_after IS NULL OR not_after>now()) AND aal='aal2') THEN RAISE EXCEPTION 'F90_MFA'; END IF;
END $$;
REVOKE ALL ON FUNCTION f90_private.require_security_manager(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.f90_security_sessions_list(p_actor uuid,p_actor_session uuid,p_user uuid DEFAULT NULL,p_from timestamptz DEFAULT NULL,p_to timestamptz DEFAULT NULL,p_status text DEFAULT 'all',p_search text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM f90_private.require_security_manager(p_actor,p_actor_session);
 IF p_status NOT IN ('all','active','ended','revoked') THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 WITH combined AS (
  SELECT s.session_id,s.user_id,s.ip_address,s.country_code,s.city,s.region,s.network_source,
   s.device_type,s.os_name,s.browser_name,s.device_model,s.device_label,s.first_seen_at,s.last_seen_at,
   s.revoked_at,s.revoke_reason,s.revoked_by,
   CASE WHEN s.revoked_at IS NOT NULL THEN 'revoked' WHEN a.id IS NOT NULL AND (a.not_after IS NULL OR a.not_after>now()) THEN 'active' ELSE 'ended' END AS status
  FROM public.f90_security_sessions s LEFT JOIN auth.sessions a ON a.id=s.session_id AND a.user_id=s.user_id
  WHERE s.last_seen_at>=now()-interval '30 days'
  UNION ALL
  SELECT a.id,a.user_id,a.ip,NULL,NULL,NULL,'supabase_auth',NULL,NULL,NULL,NULL,NULL,a.created_at,
   greatest(a.created_at,a.updated_at,a.refreshed_at AT TIME ZONE 'UTC'),NULL,NULL,NULL,
   CASE WHEN a.not_after IS NULL OR a.not_after>now() THEN 'active' ELSE 'ended' END
  FROM auth.sessions a WHERE NOT EXISTS(SELECT 1 FROM public.f90_security_sessions s WHERE s.session_id=a.id AND s.user_id=a.user_id)
 ), filtered AS (
  SELECT c.*,p.display_name,p.customer_id,(c.session_id=p_actor_session) AS protected_current
  FROM combined c JOIN public.profiles p ON p.id=c.user_id
  WHERE (p_user IS NULL OR c.user_id=p_user) AND (p_from IS NULL OR c.last_seen_at>=p_from) AND (p_to IS NULL OR c.last_seen_at<=p_to)
  AND (p_status='all' OR c.status=p_status)
  AND (p_search='' OR concat_ws(' ',p.display_name,p.customer_id,c.user_id::text,c.ip_address::text,c.city,c.country_code,c.device_model) ILIKE '%'||left(p_search,120)||'%')
 ), paged AS (SELECT * FROM filtered ORDER BY last_seen_at DESC,session_id LIMIT 50 OFFSET greatest(0,least(100000,p_offset)))
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(paged)) FROM paged),'[]'::jsonb),'total',(SELECT count(*) FROM filtered),'limit',50) INTO result;
 INSERT INTO public.f90_audit(actor_id,action,details) VALUES(p_actor,'security.sessions.read',jsonb_build_object('user_id',p_user,'offset',p_offset));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.f90_security_sessions_list(uuid,uuid,uuid,timestamptz,timestamptz,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_security_sessions_list(uuid,uuid,uuid,timestamptz,timestamptz,text,text,integer) TO service_role;

-- This is the Supabase Auth LogoutSession/Logout operation, not deletion of the observation log.
-- auth.refresh_tokens.session_id has ON DELETE CASCADE: renewal is invalidated atomically.
-- Sensitive APIs independently check f90_session_valid, so an unexpired JWT cannot bypass revocation.
CREATE FUNCTION public.f90_security_sessions_revoke(p_actor uuid,p_actor_session uuid,p_user uuid,p_session uuid,p_all boolean,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ids uuid[]; reason text:=btrim(coalesce(p_reason,'')); n integer;
BEGIN
 PERFORM f90_private.require_security_manager(p_actor,p_actor_session);
 IF length(reason)<8 OR length(reason)>500 OR (NOT p_all AND p_session IS NULL) THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 IF p_session=p_actor_session AND NOT p_all THEN RAISE EXCEPTION 'F90_CURRENT_SESSION'; END IF;
 SELECT array_agg(id) INTO ids FROM auth.sessions WHERE user_id=p_user AND id<>p_actor_session AND (p_all OR id=p_session);
 n:=coalesce(cardinality(ids),0);
 IF n>0 THEN
  INSERT INTO public.f90_security_sessions(user_id,session_id,ip_address,first_seen_at,last_seen_at,network_source,revoked_at,revoked_by,revoke_reason)
  SELECT user_id,id,ip,created_at,greatest(created_at,updated_at,refreshed_at AT TIME ZONE 'UTC'),'supabase_auth',now(),p_actor,reason FROM auth.sessions WHERE user_id=p_user AND id=ANY(ids)
  ON CONFLICT(user_id,session_id) DO NOTHING;
  DELETE FROM auth.sessions WHERE user_id=p_user AND id=ANY(ids) AND id<>p_actor_session;
  UPDATE public.f90_security_sessions SET revoked_at=now(),revoked_by=p_actor,revoke_reason=reason WHERE user_id=p_user AND session_id=ANY(ids);
 END IF;
 INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'security.sessions.revoked',p_user::text,jsonb_build_object('reason',reason,'all',p_all,'count',n,'session_ids',to_jsonb(ids),'current_session_preserved',true));
 RETURN jsonb_build_object('revoked',n,'current_session_preserved',true);
END $$;
REVOKE ALL ON FUNCTION public.f90_security_sessions_revoke(uuid,uuid,uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_security_sessions_revoke(uuid,uuid,uuid,uuid,boolean,text) TO service_role;

CREATE FUNCTION public.f90_security_verification(p_actor uuid,p_actor_session uuid,p_user uuid,p_verified boolean,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old boolean; reason text:=btrim(coalesce(p_reason,''));
BEGIN
 PERFORM f90_private.require_security_manager(p_actor,p_actor_session);
 IF p_actor=p_user THEN RAISE EXCEPTION 'F90_SELF_VERIFICATION'; END IF;
 IF length(reason)<8 OR length(reason)>500 THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 SELECT is_verified INTO old FROM public.profiles WHERE id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
 IF p_verified AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user AND account_status='active') THEN RAISE EXCEPTION 'F90_FORBIDDEN'; END IF;
 IF old IS DISTINCT FROM p_verified THEN
  UPDATE public.profiles SET is_verified=p_verified WHERE id=p_user;
  INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,CASE WHEN p_verified THEN 'account.manual_verification' ELSE 'verification.revoked' END,p_user::text,jsonb_build_object('reason',reason,'previous_verified',old,'verified',p_verified,'actor_name',(SELECT display_name FROM public.profiles WHERE id=p_actor)));
 END IF;
 RETURN jsonb_build_object('id',p_user,'is_verified',p_verified,'changed',old IS DISTINCT FROM p_verified);
END $$;
REVOKE ALL ON FUNCTION public.f90_security_verification(uuid,uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_security_verification(uuid,uuid,uuid,boolean,text) TO service_role;

CREATE FUNCTION f90_private.security_session_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.revoked_at IS NULL THEN
  INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(NEW.user_id,'security.new_session',NEW.user_id::text,jsonb_build_object('session_id',NEW.session_id,'source',NEW.network_source));
  PERFORM public.f90_security_signal('new_session',NEW.user_id::text,NEW.user_id,jsonb_build_object('message','رُصدت جلسة جديدة؛ هذا ليس دليل اختراق'),1);
 ELSIF OLD.country_code IS NOT NULL AND NEW.country_code IS NOT NULL AND OLD.country_code<>NEW.country_code AND ((OLD.os_name IS DISTINCT FROM NEW.os_name) OR (OLD.browser_name IS DISTINCT FROM NEW.browser_name)) THEN
  PERFORM public.f90_security_signal('connection_change',NEW.user_id::text,NEW.user_id,jsonb_build_object('message','تغيّر البلد مع النظام أو المتصفح؛ يلزم التحقق ولا يعد دليل اختراق'),1);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER f90_security_session_events AFTER INSERT OR UPDATE ON public.f90_security_sessions FOR EACH ROW EXECUTE FUNCTION f90_private.security_session_event();

CREATE FUNCTION f90_private.security_audit_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind text;
BEGIN
 kind:=CASE WHEN NEW.action IN ('verification.revoked','account.manual_verification','identity.review') THEN 'verification_changed' WHEN NEW.action IN ('user.permissions','user.changed','role.changed') THEN 'permissions_changed' WHEN NEW.action='security.sessions.revoked' THEN 'sessions_revoked' END;
 IF kind IS NOT NULL THEN PERFORM public.f90_security_signal(kind,coalesce(NEW.target_id,NEW.actor_id::text),NEW.actor_id,jsonb_build_object('audit_id',NEW.id,'action',NEW.action,'target_id',NEW.target_id),1); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER f90_security_audit_events AFTER INSERT ON public.f90_audit FOR EACH ROW EXECUTE FUNCTION f90_private.security_audit_event();
REVOKE ALL ON FUNCTION f90_private.security_session_event(),f90_private.security_audit_event() FROM PUBLIC,anon,authenticated;

-- Keep the original scheduled job and its id; extend its bounded retention without creating another schedule.
DO $$ DECLARE j bigint; BEGIN
 SELECT jobid INTO j FROM cron.job WHERE jobname='f90_security_sessions_expire_30d';
 IF j IS NOT NULL THEN PERFORM cron.alter_job(j,command:='delete from public.f90_security_sessions where last_seen_at < now() - interval ''30 days''; delete from public.f90_security_alerts where last_seen_at < now() - interval ''30 days'';');
 ELSE PERFORM cron.schedule('f90_security_sessions_expire_30d','0 3 * * *','delete from public.f90_security_sessions where last_seen_at < now() - interval ''30 days''; delete from public.f90_security_alerts where last_seen_at < now() - interval ''30 days'';'); END IF;
END $$;
