-- Metadata remains service-only; the authenticated handler enforces session ownership and manager access.
ALTER TABLE public.f90_security_sessions
 ADD COLUMN IF NOT EXISTS network_source text,
 ADD COLUMN IF NOT EXISTS city text,
 ADD COLUMN IF NOT EXISTS region text,
 ADD COLUMN IF NOT EXISTS network_org text,
 ADD COLUMN IF NOT EXISTS network_asn bigint,
 ADD COLUMN IF NOT EXISTS ip_latitude numeric(4,1),
 ADD COLUMN IF NOT EXISTS ip_longitude numeric(5,1),
 ADD COLUMN IF NOT EXISTS device_model text,
 ADD COLUMN IF NOT EXISTS device_label text,
 ADD COLUMN IF NOT EXISTS precise_latitude double precision,
 ADD COLUMN IF NOT EXISTS precise_longitude double precision,
 ADD COLUMN IF NOT EXISTS precise_accuracy_m double precision,
 ADD COLUMN IF NOT EXISTS precise_recorded_at timestamptz,
 ADD COLUMN IF NOT EXISTS location_consent boolean NOT NULL DEFAULT false;
ALTER TABLE public.f90_security_sessions ADD CONSTRAINT f90_security_precise_location_check CHECK (
 (precise_latitude IS NULL AND precise_longitude IS NULL AND precise_accuracy_m IS NULL AND precise_recorded_at IS NULL)
 OR (location_consent AND precise_latitude IS NOT NULL AND precise_longitude IS NOT NULL AND precise_accuracy_m IS NOT NULL AND precise_latitude BETWEEN -90 AND 90 AND precise_longitude BETWEEN -180 AND 180
   AND precise_accuracy_m>=0 AND precise_accuracy_m<=1000000 AND precise_recorded_at IS NOT NULL));
CREATE OR REPLACE FUNCTION public.f90_security_gateway_secret() RETURNS text
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='f90-security-gateway-v1' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.f90_security_gateway_secret() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_security_gateway_secret() TO service_role;
CREATE OR REPLACE VIEW public.f90_security_latest WITH(security_invoker=true) AS
 SELECT DISTINCT ON (user_id) * FROM public.f90_security_sessions
 WHERE last_seen_at>=now()-interval '30 days'
 ORDER BY user_id,last_seen_at DESC,id DESC;
REVOKE ALL ON public.f90_security_latest FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.f90_security_latest TO service_role;
