-- Owner-requested manager access with normal login. Other roles keep opted-in MFA.
-- Preserve active-account, current server role and real Auth session validation.
CREATE OR REPLACE FUNCTION f90_private.require_security_manager(p_actor uuid,p_session uuid)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 PERFORM f90_private.require_actor(p_actor,ARRAY['manager']);
 IF NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=p_session AND user_id=p_actor AND (not_after IS NULL OR not_after>now())) THEN RAISE EXCEPTION 'F90_AUTH'; END IF;
END $$;
REVOKE ALL ON FUNCTION f90_private.require_security_manager(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION f90_private.my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.role FROM public.f90_user_roles r JOIN public.profiles p ON p.id=r.user_id
 WHERE r.user_id=(SELECT auth.uid()) AND p.account_status='active'
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=r.user_id AND s.id=((SELECT auth.jwt())->>'session_id')::uuid AND (s.not_after IS NULL OR s.not_after>now()))
 AND (r.role='manager' OR ((SELECT auth.jwt())->>'aal')='aal2' OR NOT EXISTS(SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=r.user_id AND f.status='verified'));
$$;
