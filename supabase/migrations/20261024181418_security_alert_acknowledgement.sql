CREATE FUNCTION public.f90_security_acknowledge(p_actor uuid,p_actor_session uuid,p_alert bigint,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer; reason text:=btrim(coalesce(p_reason,''));
BEGIN
 PERFORM f90_private.require_security_manager(p_actor,p_actor_session);
 IF length(reason)<8 OR length(reason)>500 THEN RAISE EXCEPTION 'F90_FIELDS'; END IF;
 UPDATE public.f90_security_alerts SET acknowledged_at=now(),acknowledged_by=p_actor,acknowledgement_reason=reason WHERE id=p_alert AND alerted_at IS NOT NULL AND acknowledged_at IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n>0 THEN INSERT INTO public.f90_audit(actor_id,action,target_id,details) VALUES(p_actor,'security.alert.acknowledged',p_alert::text,jsonb_build_object('reason',reason)); END IF;
 RETURN jsonb_build_object('saved',true,'changed',n>0);
END $$;
REVOKE ALL ON FUNCTION public.f90_security_acknowledge(uuid,uuid,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_security_acknowledge(uuid,uuid,bigint,text) TO service_role;
