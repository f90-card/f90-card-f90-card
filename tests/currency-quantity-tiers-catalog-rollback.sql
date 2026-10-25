-- Run inside BEGIN/ROLLBACK with a pg_temp.f90_candidate_quote copy of the candidate function.
-- Only a synthetic category/product is inserted; no account, wallet, rate or order is modified.
DO $test$
DECLARE cat uuid:=gen_random_uuid();prod uuid:=gen_random_uuid();q jsonb;old_hash text;
BEGIN
 SELECT md5(string_agg(id::text||price::text||commerce::text,',' ORDER BY id)) INTO old_hash FROM public.products;
 INSERT INTO public.categories(id,name,slug) VALUES(cat,'فحص شرائح معزول','isolated-'||cat);
 INSERT INTO public.products(id,name,slug,category_id,price,currency,commerce) VALUES(prod,'اختبار شرائح معزول','isolated-'||prod,cat,114,'USD','{"type":"quantity","prices":{"USD":114},"unit_quantity":1000000,"quantity_min":1,"quantity_max":1000000000,"quantity_step":1,"fulfillment":"manual","fields":[],"currency_pricing":{"enabled":true,"unit_quantity":1000000,"prices":{"USD":114,"ILS":400,"JOD":90},"tiers_enabled":true,"tiers":[{"min":1,"prices":{"JOD":85,"ILS":390}},{"min":1000000,"prices":{"JOD":80,"ILS":375}},{"min":2000000,"prices":{"JOD":95}}]}}');
 q:=pg_temp.f90_candidate_quote(NULL,prod,500000,'','JOD');IF (q->>'total_currency')::numeric<>42.5 THEN RAISE EXCEPTION 'Below million band failed';END IF;
 q:=pg_temp.f90_candidate_quote(NULL,prod,999999,'','JOD');IF (q->>'total_currency')::numeric<>84.999915 THEN RAISE EXCEPTION 'Just below million failed';END IF;
 q:=pg_temp.f90_candidate_quote(NULL,prod,1000000,'','JOD');IF (q->>'total_currency')::numeric<>80 OR (q->>'currency_tier_min')::bigint<>1000000 THEN RAISE EXCEPTION 'Inclusive million band failed';END IF;
 q:=pg_temp.f90_candidate_quote(NULL,prod,1000001,'','JOD');IF (q->>'total_currency')::numeric<>80.000080 THEN RAISE EXCEPTION 'Just above million band failed';END IF;
 q:=pg_temp.f90_candidate_quote(NULL,prod,2000000,'','JOD');IF (q->>'total_currency')::numeric<>190 THEN RAISE EXCEPTION 'Higher quantity price increase failed';END IF;
 q:=pg_temp.f90_candidate_quote(NULL,prod,2000000,'','ILS');IF (q->>'total_currency')::numeric<>750 THEN RAISE EXCEPTION 'Blank currency band inheritance failed';END IF;
 q:=pg_temp.f90_candidate_quote(NULL,prod,2000000,'','USD');IF (q->>'total_usd')::numeric<>228 THEN RAISE EXCEPTION 'Native base fallback failed';END IF;
 UPDATE public.products SET commerce=commerce||'{"type":"fixed","pack_quantity":2000000}'::jsonb WHERE id=prod;
 q:=pg_temp.f90_candidate_quote(NULL,prod,1,'','JOD');IF (q->>'total_currency')::numeric<>190 THEN RAISE EXCEPTION 'Fixed pack quantity band failed';END IF;
 UPDATE public.products SET commerce=commerce||'{"type":"quantity"}'::jsonb WHERE id=prod;
 UPDATE public.products SET commerce=jsonb_set(commerce,'{currency_pricing,tiers_enabled}','false') WHERE id=prod;
 q:=pg_temp.f90_candidate_quote(NULL,prod,500000,'','JOD');IF (q->>'total_currency')::numeric<>45 OR jsonb_array_length((SELECT commerce#>'{currency_pricing,tiers}' FROM public.products WHERE id=prod))<>3 THEN RAISE EXCEPTION 'Band disable lost base or stored tiers';END IF;
 UPDATE public.products SET commerce=jsonb_set(jsonb_set(commerce,'{currency_pricing,tiers_enabled}','true'),'{currency_pricing,enabled}','false') WHERE id=prod;
 q:=pg_temp.f90_candidate_quote(NULL,prod,2000000,'','JOD');IF (q->>'total_usd')::numeric<>228 THEN RAISE EXCEPTION 'Product disable failed';END IF;
 IF (SELECT md5(string_agg(id::text||price::text||commerce::text,',' ORDER BY id)) FROM public.products WHERE id<>prod)<>old_hash THEN RAISE EXCEPTION 'Existing prices changed';END IF;
END $test$;
SELECT 'PASS: actual PostgreSQL below/at/above million, raise/reduce, currency fallback, fixed pack, disable/preservation, existing product prices unchanged; ROLLBACK' AS result;
