-- Keep historical foreign keys intact while removing connection credentials.
CREATE FUNCTION public.f90_archive_provider(p_actor uuid, p_provider uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE old_secret uuid;
BEGIN
 PERFORM f90_private.require_actor(p_actor, ARRAY['manager']);
 SELECT secret_id INTO old_secret FROM public.f90_providers WHERE id=p_provider FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
 UPDATE public.f90_providers
 SET is_enabled=false, secret_id=NULL,
     config=coalesce(config,'{}'::jsonb)||jsonb_build_object(
       'archived_at',coalesce(config->>'archived_at',now()::text),
       'automatic_orders_enabled',false)
 WHERE id=p_provider;
 IF old_secret IS NOT NULL THEN DELETE FROM vault.secrets WHERE id=old_secret; END IF;
 RETURN true;
END; $function$;
REVOKE ALL ON FUNCTION public.f90_archive_provider(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f90_archive_provider(uuid,uuid) TO service_role;
