-- Credentials remain server-only; managers can diagnose a disabled supplier.
-- The function is executable exclusively by the service role.
CREATE OR REPLACE FUNCTION public.f90_provider_secret(
  p_actor uuid, p_provider uuid, p_secret text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE s uuid; value text;
BEGIN
 IF p_secret IS NOT NULL THEN
  PERFORM f90_private.require_actor(p_actor, ARRAY['manager']);
  SELECT secret_id INTO s FROM public.f90_providers WHERE id=p_provider FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'F90_NOT_FOUND'; END IF;
  IF s IS NULL THEN
   SELECT vault.create_secret(p_secret,'f90-provider-'||p_provider,'F90 provider credential') INTO s;
  ELSE
   PERFORM vault.update_secret(s,p_secret);
  END IF;
  UPDATE public.f90_providers SET secret_id=s WHERE id=p_provider;
  RETURN 'saved';
 END IF;
 SELECT v.decrypted_secret INTO value
 FROM public.f90_providers p JOIN vault.decrypted_secrets v ON v.id=p.secret_id
 WHERE p.id=p_provider;
 RETURN value;
END; $function$;
REVOKE ALL ON FUNCTION public.f90_provider_secret(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f90_provider_secret(uuid,uuid,text) TO service_role;
