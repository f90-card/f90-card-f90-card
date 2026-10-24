BEGIN;
DO $$
DECLARE actor uuid; customer uuid:=gen_random_uuid(); product uuid:=gen_random_uuid(); r jsonb;
BEGIN
 SELECT ur.user_id INTO actor FROM public.f90_user_roles ur JOIN public.profiles p ON p.id=ur.user_id WHERE ur.role='manager' AND p.account_status='active' ORDER BY ur.user_id LIMIT 1;
 IF EXISTS(SELECT 1 FROM public.f90_rates WHERE currency='TSTCUR') THEN RAISE EXCEPTION 'Fixture currency already exists'; END IF;
 r:=public.f90_manage_currency(actor,'save','tstcur','عملة اختبار',7,true);
 IF r->>'currency'<>'TSTCUR' OR NOT (r->>'is_enabled')::boolean THEN RAISE EXCEPTION 'New currency not usable'; END IF;
 INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES(customer,'currency-'||customer||'@example.invalid','{"account_currency":"TSTCUR"}','{}');
 IF (SELECT account_currency FROM public.profiles WHERE id=customer)<>'TSTCUR' THEN RAISE EXCEPTION 'Registration currency not preserved'; END IF;
 BEGIN
  PERFORM public.f90_manage_currency(actor,'delete','TSTCUR');RAISE EXCEPTION 'In-use currency deleted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'F90_RATE_IN_USE' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.f90_manage_currency(actor,'save','TSTCUR','عملة اختبار',7,false);RAISE EXCEPTION 'In-use currency disabled';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'F90_RATE_IN_USE' THEN RAISE; END IF; END;
 UPDATE public.profiles SET account_currency='SAR' WHERE id=customer;
 IF (SELECT per_usd FROM public.f90_rates WHERE currency='SAR')<>3.77 THEN RAISE EXCEPTION 'Wrong SAR rate'; END IF;
 IF (SELECT balance_usd FROM public.f90_wallets WHERE user_id=customer)<>0 THEN RAISE EXCEPTION 'Currency change altered money'; END IF;
 BEGIN
  UPDATE public.profiles SET account_currency='INVALID' WHERE id=customer;RAISE EXCEPTION 'Unknown currency accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'F90_RATE_MISSING' THEN RAISE; END IF; END;
 r:=public.f90_manage_currency(actor,'delete','TSTCUR');
 IF NOT (r->>'deleted')::boolean OR EXISTS(SELECT 1 FROM public.f90_rates WHERE currency='TSTCUR') THEN RAISE EXCEPTION 'Unused currency not deleted'; END IF;
 r:=public.f90_manage_currency(actor,'save','TSTCUR','عملة اختبار',7,true);
 INSERT INTO public.products(id,slug,name,price,currency,is_active,commerce) VALUES(product,'currency-test-'||product,'Isolated historical currency fixture',2,'TSTCUR',false,'{"type":"fixed","prices":{"USD":2}}');
 r:=public.f90_manage_currency(actor,'delete','TSTCUR');
 IF NOT (r->>'archived')::boolean OR NOT EXISTS(SELECT 1 FROM public.products WHERE id=product AND price=2) THEN RAISE EXCEPTION 'Historical reference not preserved'; END IF;
 r:=public.f90_manage_currency(actor,'save','TSTCUR','عملة اختبار',8,true);
 IF (r->>'is_archived')::boolean OR (r->>'per_usd')::numeric<>8 THEN RAISE EXCEPTION 'Archived currency cannot be restored'; END IF;
 BEGIN
  PERFORM public.f90_manage_currency(actor,'delete','USD');RAISE EXCEPTION 'Base deleted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'F90_RATE_BASE' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.f90_manage_currency(customer,'save','TSTCUR','رفض صلاحية',9,true);RAISE EXCEPTION 'Customer changed rates';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'F90_FORBIDDEN' THEN RAISE; END IF; END;
 IF has_function_privilege('anon','public.f90_manage_currency(uuid,text,text,text,numeric,boolean)','EXECUTE') OR has_function_privilege('authenticated','public.f90_manage_currency(uuid,text,text,text,numeric,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Client has privileged currency access'; END IF;
END; $$;
SELECT jsonb_build_object('new_currency_enabled',true,'registration_dynamic',true,'SAR_3_77',true,'account_currency_change',true,'wallet_unchanged',true,'unknown_currency_rejected',true,'unused_deleted',true,'historical_currency_archived',true,'restore_archived',true,'USD_protected',true,'in_use_currency_protected',true,'customer_denied',true,'client_RPC_denied',true,'rollback_only',true) AS tests;
ROLLBACK;
