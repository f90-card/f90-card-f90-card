-- Ephemeral identities only; nothing is committed and no supplier HTTP is invoked.
BEGIN;
DO $$
DECLARE u uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); pr uuid; q jsonb; a jsonb; b jsonb; total numeric;
BEGIN
 SELECT id INTO STRICT pr FROM public.f90_providers WHERE adapter='shihab' AND endpoint='https://api.shihabcard.com';
 INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
 VALUES(u,'shihab-safe-'||u||'@example.invalid','{"display_name":"Isolated rollback test"}','{}');
 UPDATE public.profiles SET is_verified=true WHERE id=u;
 UPDATE public.f90_wallets SET balance_usd=100 WHERE user_id=u;
 INSERT INTO public.products(id,slug,name,price,currency,is_active,commerce)
 VALUES(p,'shihab-rollback-'||p,'Isolated rollback test',10,'USD',true,
   '{"type":"quantity","fulfillment":"manual","fulfillment_status":"unconfirmed","supplier_available":true,"prices":{"USD":10},"quantity_min":1,"quantity_max":10,"unit_quantity":1,"fields":[{"id":"account_id","type":"text","required":true}]}');
 INSERT INTO public.f90_product_internal(product_id,provider_id,provider_service,cost_usd,auto_margin)
 VALUES(p,pr,'99999999999999999',1,false);
 q:=public.f90_quote(u,p,1,''); total:=(q->>'total_usd')::numeric;
 a:=public.f90_checkout(u,p,1,'{"account_id":"not-a-real-recipient"}','shihab-rollback-reference',total,'');
 b:=public.f90_checkout(u,p,1,'{"account_id":"not-a-real-recipient"}','shihab-rollback-reference',total,'');
 IF a->>'status'<>'queued' OR a->>'fulfillment'<>'manual' THEN RAISE EXCEPTION 'Manual supplier order not queued'; END IF;
 IF a->>'id'<>b->>'id' OR (SELECT count(*) FROM public.f90_orders WHERE user_id=u)<>1
    OR (SELECT count(*) FROM public.f90_wallet_ledger WHERE user_id=u)<>1 THEN RAISE EXCEPTION 'Duplicate checkout'; END IF;
 IF (SELECT balance_usd FROM public.f90_wallets WHERE user_id=u)<>100-total THEN RAISE EXCEPTION 'Duplicate debit'; END IF;
 BEGIN
  PERFORM public.f90_checkout(u,p,2,'{"account_id":"not-a-real-recipient"}','shihab-rollback-reference',total,'');
  RAISE EXCEPTION 'Conflicting retry accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'F90_IDEMPOTENCY_CONFLICT' THEN RAISE; END IF; END;
 UPDATE public.products SET commerce=jsonb_set(commerce,'{fulfillment}','"automatic"') WHERE id=p;
 a:=public.f90_checkout(u,p,1,'{"account_id":"not-a-real-recipient"}','shihab-rollback-automatic',total,'');
 IF a->>'status'<>'queued' OR a->>'fulfillment'<>'automatic' THEN RAISE EXCEPTION 'Automatic supplier order not queued'; END IF;
 UPDATE public.products SET commerce=jsonb_set(commerce,'{supplier_available}','false') WHERE id=p;
 BEGIN
  PERFORM public.f90_checkout(u,p,1,'{"account_id":"not-a-real-recipient"}','shihab-rollback-unavailable',total,'');
  RAISE EXCEPTION 'Unavailable supplier order accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'F90_PROVIDER_NOT_READY' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM public.f90_orders WHERE user_id=u)<>2 THEN RAISE EXCEPTION 'Unavailable order inserted'; END IF;
END $$;
SELECT 'PASS: manual+automatic queued, identical retry gives one order/debit, changed quantity rejected, unavailable blocked; no HTTP; ROLLBACK' result;
ROLLBACK;
