-- Execute with BEGIN, pg_temp.f90_candidate_quote and pg_temp.f90_candidate_checkout, then ROLLBACK.
-- Changes are restricted to one metadata-marked fixture and one synthetic product.
DO $test$
DECLARE u uuid:='da1be905-be1e-4af6-9103-db05749294a3';cat uuid:=gen_random_uuid();prod uuid:=gen_random_uuid();q jsonb;a jsonb;b jsonb;k text:='isolated-band-'||gen_random_uuid();failed boolean:=false;bal numeric;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND raw_app_meta_data->>'f90_security_fixture'='true') THEN RAISE EXCEPTION 'Fixture guard';END IF;
 IF EXISTS(SELECT 1 FROM public.f90_wallet_ledger WHERE user_id=u) OR EXISTS(SELECT 1 FROM public.f90_orders WHERE user_id=u) THEN RAISE EXCEPTION 'Fixture is not empty';END IF;
 UPDATE public.profiles SET account_status='active',is_verified=true,vip_override=1,account_currency='JOD' WHERE id=u;
 UPDATE public.f90_user_roles SET role='customer' WHERE user_id=u;
 UPDATE public.f90_user_discounts SET extra_discount_percent=0,purchase_markup_enabled=false WHERE user_id=u;
 UPDATE public.f90_wallets SET balance_usd=1000 WHERE user_id=u;
 INSERT INTO public.categories(id,name,slug) VALUES(cat,'اختبار معزول','isolated-'||cat);
 INSERT INTO public.products(id,name,slug,category_id,price,currency,commerce) VALUES(prod,'اختبار شراء شرائح معزول','isolated-'||prod,cat,114,'USD','{"type":"quantity","prices":{"USD":114},"unit_quantity":1000000,"quantity_min":1,"quantity_max":1000000000,"quantity_step":1,"fulfillment":"manual","fields":[],"currency_pricing":{"enabled":true,"unit_quantity":1000000,"prices":{"JOD":90},"tiers_enabled":true,"tiers":[{"min":1,"prices":{"JOD":85}},{"min":1000000,"prices":{"JOD":80}},{"min":2000000,"prices":{"JOD":95}}]}}');
 q:=pg_temp.f90_candidate_quote(u,prod,2000000,'','USD');
 IF q->>'price_currency'<>'JOD' OR (q->>'subtotal_currency')::numeric<>190 THEN RAISE EXCEPTION 'Account currency/band quote failed';END IF;
 a:=pg_temp.f90_candidate_checkout(u,prod,2000000,'{"account_id":"isolated"}',k,(q->>'total_usd')::numeric,'');
 b:=pg_temp.f90_candidate_checkout(u,prod,2000000,'{"account_id":"isolated"}',k,(q->>'total_usd')::numeric,'');
 IF a->>'id'<>b->>'id' OR (a->>'total_currency')::numeric<>(q->>'total_currency')::numeric OR a->>'price_currency'<>'JOD' THEN RAISE EXCEPTION 'Checkout snapshot/replay failed';END IF;
 IF (SELECT count(*) FROM public.f90_wallet_ledger WHERE user_id=u AND unique_key='purchase:'||(a->>'id'))<>1 THEN RAISE EXCEPTION 'Duplicate charge';END IF;
 SELECT balance_usd INTO bal FROM public.f90_wallets WHERE user_id=u;
 IF bal<>1000-(q->>'total_usd')::numeric THEN RAISE EXCEPTION 'Charged amount differs from quoted band';END IF;
 BEGIN PERFORM pg_temp.f90_candidate_checkout(u,prod,1000000,'{"account_id":"isolated"}',k,1,'');EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='F90_IDEMPOTENCY_CONFLICT';END;
 IF NOT failed THEN RAISE EXCEPTION 'Changed quantity reused key';END IF;
 UPDATE public.f90_wallets SET balance_usd=0 WHERE user_id=u;
 failed:=false;BEGIN PERFORM pg_temp.f90_candidate_checkout(u,prod,2000000,'{"account_id":"isolated"}',k||'-insufficient',(q->>'total_usd')::numeric,'');EXCEPTION WHEN OTHERS THEN failed:=SQLERRM='F90_INSUFFICIENT_BALANCE';END;
 IF NOT failed THEN RAISE EXCEPTION 'Insufficient balance accepted';END IF;
END $test$;
SELECT 'PASS: actual candidate checkout uses account currency/band total, native snapshot, one order/charge on retry, quantity conflict and insufficient balance rejected; ROLLBACK' as result;
