-- Run in a transaction, after applying the candidate migration; always roll back.
DO $test$
DECLARE m uuid:='6bf48c58-83b6-467c-b530-12c129a9771c'; c uuid:='da1be905-be1e-4af6-9103-db05749294a3'; ms uuid:=gen_random_uuid(); cs uuid:=gen_random_uuid(); denied boolean; result jsonb;
BEGIN
 IF (SELECT count(*) FROM auth.users WHERE id IN(m,c) AND raw_app_meta_data->>'f90_security_fixture'='true')<>2 THEN RAISE EXCEPTION 'Fixture guard failed'; END IF;
 UPDATE public.profiles SET account_status='active' WHERE id IN(m,c);
 UPDATE public.f90_user_roles SET role=CASE WHEN user_id=m THEN 'manager' ELSE 'customer' END WHERE user_id IN(m,c);
 INSERT INTO auth.sessions(id,user_id,created_at,updated_at,aal,not_after) VALUES(ms,m,now(),now(),'aal1',now()+interval '10 minutes'),(cs,c,now(),now(),'aal1',now()+interval '10 minutes');
 PERFORM f90_private.require_security_manager(m,ms);
 result:=public.f90_security_sessions_list(m,ms,c);
 IF result IS NULL THEN RAISE EXCEPTION 'AAL1 manager list failed'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',m,'session_id',ms,'aal','aal1')::text,true);
 IF f90_private.my_role() IS DISTINCT FROM 'manager' THEN RAISE EXCEPTION 'Manager database role missing'; END IF;
 PERFORM set_config('request.jwt.claims','{}',true);
 denied:=false;
 BEGIN PERFORM f90_private.require_security_manager(c,cs); EXCEPTION WHEN OTHERS THEN denied:=SQLERRM='F90_FORBIDDEN'; END;
 IF NOT denied THEN RAISE EXCEPTION 'Customer guard failed'; END IF;
 denied:=false;
 BEGIN PERFORM f90_private.require_security_manager(m,cs); EXCEPTION WHEN OTHERS THEN denied:=SQLERRM='F90_AUTH'; END;
 IF NOT denied THEN RAISE EXCEPTION 'Session ownership guard failed'; END IF;
 DELETE FROM auth.sessions WHERE id=ms;
 denied:=false;
 BEGIN PERFORM f90_private.require_security_manager(m,ms); EXCEPTION WHEN OTHERS THEN denied:=SQLERRM='F90_AUTH'; END;
 IF NOT denied THEN RAISE EXCEPTION 'Revoked session accepted'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',m,'session_id',ms,'aal','aal1')::text,true);
 IF f90_private.my_role() IS NOT NULL THEN RAISE EXCEPTION 'Revoked manager database role accepted'; END IF;
END $test$;
SELECT 'PASS: manager AAL1 list and database role; customer denial; session ownership; revoked session denial; all changes rolled back' AS result;
