-- Localisation metadata only. Product originals and all financial tables remain unchanged.
CREATE TABLE public.f90_i18n_backup_20261025 AS TABLE public.f90_i18n_text;
ALTER TABLE public.f90_i18n_backup_20261025 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.f90_i18n_backup_20261025 FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.f90_i18n_backup_20261025 TO service_role;
ALTER TABLE public.f90_i18n_text ADD COLUMN is_public boolean NOT NULL DEFAULT true,
 ADD COLUMN manual_locales text[] NOT NULL DEFAULT '{}',ADD COLUMN provider text NOT NULL DEFAULT 'legacy',
 ADD COLUMN reviewed_by uuid REFERENCES auth.users(id),ADD COLUMN reviewed_at timestamptz;
ALTER TABLE public.f90_i18n_text ALTER COLUMN en SET DEFAULT '',ALTER COLUMN fr SET DEFAULT '',ALTER COLUMN pt SET DEFAULT '';
REVOKE ALL ON public.f90_i18n_text FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.f90_i18n_text TO anon,authenticated;
GRANT ALL ON public.f90_i18n_text TO service_role;
DROP POLICY IF EXISTS public_read_translations ON public.f90_i18n_text;
CREATE POLICY public_read_translations ON public.f90_i18n_text FOR SELECT TO anon,authenticated USING(is_public);
CREATE TABLE public.f90_i18n_jobs(source_text text PRIMARY KEY REFERENCES public.f90_i18n_text(source_text) ON DELETE CASCADE,
 source_hash text NOT NULL,contexts jsonb NOT NULL DEFAULT '{}',status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','complete','failed','needs_review')),
 attempts integer NOT NULL DEFAULT 0,last_error text,lease_id uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX f90_i18n_jobs_pending ON public.f90_i18n_jobs(status,next_attempt_at) WHERE status<>'complete';
CREATE TABLE public.f90_i18n_control(id integer PRIMARY KEY CHECK(id=1),enabled boolean NOT NULL DEFAULT false,daily_neuron_cap integer NOT NULL DEFAULT 4000 CHECK(daily_neuron_cap BETWEEN 350 AND 8000));
INSERT INTO public.f90_i18n_control(id) VALUES(1);
CREATE TABLE public.f90_i18n_daily(day date PRIMARY KEY,reserved_neurons numeric NOT NULL DEFAULT 0,requests integer NOT NULL DEFAULT 0);
ALTER TABLE public.f90_i18n_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f90_i18n_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f90_i18n_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.f90_i18n_jobs,public.f90_i18n_control,public.f90_i18n_daily FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.f90_i18n_jobs,public.f90_i18n_control,public.f90_i18n_daily TO service_role;
CREATE FUNCTION public.f90_i18n_enqueue(p_source text,p_context text,p_public boolean) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s text:=trim(regexp_replace(coalesce(p_source,''),'\s+',' ','g'));
BEGIN
 IF s='' OR length(s)>12000 OR s!~'[ء-ي]' THEN RETURN;END IF;
 INSERT INTO public.f90_i18n_text(source_text,is_public) VALUES(s,p_public) ON CONFLICT(source_text) DO UPDATE SET is_public=f90_i18n_text.is_public OR EXCLUDED.is_public;
 IF EXISTS(SELECT 1 FROM public.f90_i18n_text WHERE source_text=s AND (en='' OR fr='' OR pt='')) THEN
  INSERT INTO public.f90_i18n_jobs(source_text,source_hash,contexts) VALUES(s,md5(s),jsonb_build_object(p_context,true))
  ON CONFLICT(source_text) DO UPDATE SET contexts=f90_i18n_jobs.contexts||EXCLUDED.contexts,status=CASE WHEN f90_i18n_jobs.status='complete' THEN 'pending' ELSE f90_i18n_jobs.status END,updated_at=now();
 END IF;
END $$;
CREATE FUNCTION public.f90_i18n_collect(p_value jsonb,p_context text,p_public boolean) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE k text;v jsonb;part text;
BEGIN
 IF jsonb_typeof(p_value)='array' THEN FOR v IN SELECT value FROM jsonb_array_elements(p_value) LOOP PERFORM public.f90_i18n_collect(v,p_context,p_public);END LOOP;
 ELSIF jsonb_typeof(p_value)='object' THEN
  FOR k,v IN SELECT key,value FROM jsonb_each(p_value) LOOP
   IF jsonb_typeof(v)='string' AND k=ANY(ARRAY['name','description','store_name','name_ar','title','title_ar','subtitle','body_ar','text_ar','label_ar','placeholder_ar','details_ar','help_ar','ar','instructions_ar','terms_ar','delivery_time','quantity_label_ar']) THEN
    PERFORM public.f90_i18n_enqueue(v#>>'{}',p_context||':'||k,p_public);
    FOR part IN SELECT regexp_split_to_table(v#>>'{}',E'\n[[:space:]]*\n') LOOP PERFORM public.f90_i18n_enqueue(part,p_context||':'||k||':paragraph',p_public);END LOOP;
   ELSIF jsonb_typeof(v) IN('object','array') THEN PERFORM public.f90_i18n_collect(v,p_context||':'||k,p_public);END IF;
  END LOOP;
 END IF;
END $$;
CREATE FUNCTION public.f90_i18n_catalog_trigger() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE value jsonb;prior jsonb;visible boolean:=true;
BEGIN
 IF TG_TABLE_NAME='products' THEN
  value:=jsonb_build_object('name',NEW.name,'description',NEW.description,'fields',NEW.commerce->'fields','delivery_time',NEW.commerce->'delivery_time','quantity_label_ar',NEW.commerce->'quantity_label_ar');visible:=NEW.is_active;
  IF TG_OP='UPDATE' THEN prior:=jsonb_build_object('name',OLD.name,'description',OLD.description,'fields',OLD.commerce->'fields','delivery_time',OLD.commerce->'delivery_time','quantity_label_ar',OLD.commerce->'quantity_label_ar');IF value=prior AND NEW.is_active=OLD.is_active THEN RETURN NEW;END IF;END IF;
 ELSIF TG_TABLE_NAME='categories' THEN
  value:=jsonb_build_object('name',NEW.name,'description',NEW.description);visible:=NEW.is_active;
  IF TG_OP='UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name AND NEW.description IS NOT DISTINCT FROM OLD.description AND NEW.is_active=OLD.is_active THEN RETURN NEW;END IF;
 ELSE value:=to_jsonb(NEW);END IF;
 PERFORM public.f90_i18n_collect(value,TG_TABLE_NAME||':'||NEW.id,visible);RETURN NEW;
END $$;
CREATE TRIGGER f90_i18n_product_changed AFTER INSERT OR UPDATE OF name,description,commerce,is_active ON public.products FOR EACH ROW EXECUTE FUNCTION public.f90_i18n_catalog_trigger();
CREATE TRIGGER f90_i18n_category_changed AFTER INSERT OR UPDATE OF name,description,is_active ON public.categories FOR EACH ROW EXECUTE FUNCTION public.f90_i18n_catalog_trigger();
CREATE TRIGGER f90_i18n_settings_changed AFTER INSERT OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.f90_i18n_catalog_trigger();
CREATE TRIGGER f90_i18n_banner_changed AFTER INSERT OR UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.f90_i18n_catalog_trigger();
CREATE TRIGGER f90_i18n_news_changed AFTER INSERT OR UPDATE ON public.f90_store_news FOR EACH ROW EXECUTE FUNCTION public.f90_i18n_catalog_trigger();
CREATE FUNCTION public.f90_i18n_worker_verify(p_timestamp bigint,p_message text,p_signature text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE secret text;expected text;
BEGIN
 IF abs(extract(epoch from now())-p_timestamp)>300 OR length(p_signature)<>64 OR p_message NOT LIKE 'f90-i18n-worker:'||p_timestamp||':%' THEN RETURN false;END IF;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='f90-security-gateway-v1';IF secret IS NULL THEN RETURN false;END IF;
 expected:=encode(extensions.hmac(convert_to(p_message,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex');
 RETURN extensions.digest(p_signature,'sha256')=extensions.digest(expected,'sha256');
END $$;
CREATE FUNCTION public.f90_i18n_claim() RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE day_utc date:=(now() AT TIME ZONE 'UTC')::date;limit_neurons integer;used numeric;lease uuid:=gen_random_uuid();rows jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.f90_i18n_control WHERE id=1 AND enabled) THEN RETURN jsonb_build_object('rows','[]'::jsonb,'disabled',true);END IF;
 PERFORM pg_advisory_xact_lock(hashtext('f90_i18n_budget'));
 SELECT daily_neuron_cap INTO limit_neurons FROM public.f90_i18n_control WHERE id=1;
 INSERT INTO public.f90_i18n_daily(day) VALUES(day_utc) ON CONFLICT DO NOTHING;
 SELECT reserved_neurons INTO used FROM public.f90_i18n_daily WHERE day=day_utc FOR UPDATE;
 IF used+350>limit_neurons THEN RETURN jsonb_build_object('rows','[]'::jsonb,'quota_exhausted',true);END IF;
 WITH selected AS(SELECT source_text FROM public.f90_i18n_jobs WHERE attempts<4 AND next_attempt_at<=now() AND (status IN('pending','failed') OR status='processing' AND lease_until<now()) ORDER BY updated_at LIMIT 8 FOR UPDATE SKIP LOCKED),
 changed AS(UPDATE public.f90_i18n_jobs j SET status='processing',lease_id=lease,lease_until=now()+interval '5 minutes',attempts=attempts+1,updated_at=now() FROM selected s WHERE j.source_text=s.source_text RETURNING j.source_text,j.source_hash)
 SELECT jsonb_agg(to_jsonb(changed)) INTO rows FROM changed;
 IF rows IS NULL THEN RETURN jsonb_build_object('rows','[]'::jsonb);END IF;
 UPDATE public.f90_i18n_daily SET reserved_neurons=reserved_neurons+350,requests=requests+1 WHERE day=day_utc;
 RETURN jsonb_build_object('lease_id',lease,'rows',rows,'reserved_neurons',used+350,'daily_cap',limit_neurons);
END $$;
CREATE FUNCTION public.f90_i18n_complete(p_lease uuid,p_rows jsonb) RETURNS integer LANGUAGE plpgsql SET search_path='' AS $$
DECLARE item jsonb;job public.f90_i18n_jobs%ROWTYPE;completed integer:=0;
BEGIN
 IF jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>8 THEN RAISE EXCEPTION 'F90_FIELDS';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  SELECT * INTO job FROM public.f90_i18n_jobs WHERE source_text=item->>'source_text' AND lease_id=p_lease AND status='processing' FOR UPDATE;
  IF NOT FOUND THEN CONTINUE;END IF;
  IF coalesce(item->>'error','')<>'' OR EXISTS(SELECT 1 FROM unnest(ARRAY['en','fr','pt']) l WHERE coalesce(item->>l,'')='' OR length(item->>l)>16000) THEN
   UPDATE public.f90_i18n_jobs SET status=CASE WHEN attempts>=4 THEN 'needs_review' ELSE 'failed' END,last_error=left(coalesce(item->>'error','INVALID_TRANSLATION'),100),next_attempt_at=now()+interval '15 minutes'*attempts,lease_until=NULL,updated_at=now() WHERE source_text=job.source_text;CONTINUE;
  END IF;
  UPDATE public.f90_i18n_text SET en=CASE WHEN 'en'=ANY(manual_locales) THEN en ELSE item->>'en' END,fr=CASE WHEN 'fr'=ANY(manual_locales) THEN fr ELSE item->>'fr' END,pt=CASE WHEN 'pt'=ANY(manual_locales) THEN pt ELSE item->>'pt' END,provider='cloudflare-qwen3',updated_at=now() WHERE source_text=job.source_text;
  UPDATE public.f90_i18n_jobs SET status='complete',last_error=NULL,lease_until=NULL,updated_at=now() WHERE source_text=job.source_text;completed:=completed+1;
 END LOOP;RETURN completed;
END $$;
CREATE FUNCTION public.f90_i18n_save(p_actor uuid,p_source text,p_en text,p_fr text,p_pt text,p_reason text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager']);
 IF length(trim(p_reason))<5 OR EXISTS(SELECT 1 FROM unnest(ARRAY[p_source,p_en,p_fr,p_pt]) t WHERE coalesce(trim(t),'')='' OR length(t)>16000) THEN RAISE EXCEPTION 'F90_FIELDS';END IF;
 UPDATE public.f90_i18n_text SET en=p_en,fr=p_fr,pt=p_pt,manual_locales=ARRAY['en','fr','pt'],reviewed_by=p_actor,reviewed_at=now(),updated_at=now() WHERE source_text=p_source;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND';END IF;
 UPDATE public.f90_i18n_jobs SET status='complete',last_error=NULL,updated_at=now() WHERE source_text=p_source;
 INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'i18n.translation_update',md5(p_source),jsonb_build_object('reason',p_reason,'locales',ARRAY['en','fr','pt']));
 RETURN jsonb_build_object('saved',true);
END $$;
CREATE FUNCTION public.f90_i18n_tick() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE secret text;ts bigint:=floor(extract(epoch from now()));signature text;request_id bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.f90_i18n_control WHERE id=1 AND enabled) THEN RETURN NULL;END IF;
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='f90-security-gateway-v1';IF secret IS NULL THEN RETURN NULL;END IF;
 signature:=encode(extensions.hmac(convert_to('f90-i18n-tick:'||ts,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex');
 SELECT net.http_post(url:='https://www.f90card.online/api/i18n/process',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('timestamp',ts,'signature',signature),timeout_milliseconds:=55000) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION public.f90_i18n_enqueue(text,text,boolean),public.f90_i18n_collect(jsonb,text,boolean),public.f90_i18n_catalog_trigger(),public.f90_i18n_worker_verify(bigint,text,text),public.f90_i18n_claim(),public.f90_i18n_complete(uuid,jsonb),public.f90_i18n_save(uuid,text,text,text,text,text),public.f90_i18n_tick() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_i18n_enqueue(text,text,boolean),public.f90_i18n_collect(jsonb,text,boolean),public.f90_i18n_catalog_trigger(),public.f90_i18n_worker_verify(bigint,text,text),public.f90_i18n_claim(),public.f90_i18n_complete(uuid,jsonb),public.f90_i18n_save(uuid,text,text,text,text,text),public.f90_i18n_tick() TO service_role;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='f90_i18n_translate_5m') THEN PERFORM cron.schedule('f90_i18n_translate_5m','*/5 * * * *','SELECT public.f90_i18n_tick();');END IF;END $$;
