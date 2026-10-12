BEGIN;
DO $$
DECLARE u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(u,'rls-'||u||'@example.invalid','{}'),(v,'rls-'||v||'@example.invalid','{}');
 INSERT INTO auth.sessions(id,user_id,aal) VALUES(sid,u,'aal1');
 UPDATE public.f90_wallets SET balance_usd=10 WHERE user_id=u;
 UPDATE public.f90_wallets SET balance_usd=20 WHERE user_id=v;
 PERFORM set_config('f90.fixture_user',u::text,true);PERFORM set_config('f90.fixture_session',sid::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',sid,'aal','aal1')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM public.f90_wallets)=1,'wallet ownership isolation failed';
 ASSERT (SELECT balance_usd FROM public.f90_wallets)=10,'wrong user wallet visible';
 ASSERT NOT has_column_privilege('authenticated','public.f90_orders','cost_usd','select'),'private upstream cost visible';
 ASSERT NOT has_table_privilege('authenticated','public.f90_api_keys','select'),'key hashes visible';
END $$;
RESET ROLE;
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) VALUES(gen_random_uuid(),current_setting('f90.fixture_user')::uuid,'totp','verified','fixture-only',now(),now());
SET LOCAL ROLE authenticated;
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.f90_wallets)=0,'aal1 bypassed enabled MFA'; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('f90.fixture_user'),'role','authenticated','session_id',current_setting('f90.fixture_session'),'aal','aal2')::text,true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.f90_wallets)=1,'aal2 session blocked'; END $$;
RESET ROLE;
DELETE FROM auth.sessions WHERE id=current_setting('f90.fixture_session')::uuid;
SET LOCAL ROLE authenticated;
DO $$ BEGIN ASSERT (SELECT count(*) FROM public.f90_wallets)=0,'revoked session bypassed RLS'; END $$;
RESET ROLE;
SELECT jsonb_build_object('passed',7,'checks',jsonb_build_array('wallet owner isolation','other wallet hidden','upstream costs hidden','API key hashes hidden','aal1 MFA enforcement','aal2 allowed','revoked session blocked')) AS result;
ROLLBACK;
