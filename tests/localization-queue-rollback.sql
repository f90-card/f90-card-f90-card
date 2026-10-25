-- Run after candidate migration, inside BEGIN/ROLLBACK. No financial table writes.
DO $test$
DECLARE cat uuid:=gen_random_uuid();prod uuid:=gen_random_uuid();src text:='فحص خدمة معزولة '||gen_random_uuid();before_price numeric;claim jsonb;total integer;old_source text;value text;
BEGIN
 INSERT INTO public.categories(id,name,slug,is_active) VALUES(cat,'قسم اختبار ترجمة','isolated-'||cat,false);
 INSERT INTO public.products(id,name,slug,category_id,price,currency,is_active,commerce) VALUES(prod,src,'isolated-'||prod,cat,123,'USD',false,'{"type":"fixed","prices":{"USD":123},"fields":[{"id":"account_id","label_ar":"معرف فحص معزول","required":true}]}');
 IF NOT EXISTS(SELECT 1 FROM public.f90_i18n_jobs WHERE source_text=src AND status='pending') THEN RAISE EXCEPTION 'New service was not queued';END IF;
 IF (SELECT is_public FROM public.f90_i18n_text WHERE source_text=src) THEN RAISE EXCEPTION 'Inactive source exposed';END IF;
 SELECT count(*) INTO total FROM public.f90_i18n_jobs;
 UPDATE public.products SET commerce=jsonb_set(commerce,'{prices,USD}','124') WHERE id=prod;
 IF (SELECT count(*) FROM public.f90_i18n_jobs)<>total THEN RAISE EXCEPTION 'Price-only change retriggered translation';END IF;
 old_source:=src;src:=src||' محدثة';UPDATE public.products SET name=src WHERE id=prod;
 IF NOT EXISTS(SELECT 1 FROM public.f90_i18n_jobs WHERE source_text=src) OR NOT EXISTS(SELECT 1 FROM public.f90_i18n_jobs WHERE source_text=old_source) THEN RAISE EXCEPTION 'Source update/history failed';END IF;
 UPDATE public.products SET is_active=true WHERE id=prod;
 IF NOT (SELECT is_public FROM public.f90_i18n_text WHERE source_text=src) THEN RAISE EXCEPTION 'Published translation remains private';END IF;
 UPDATE public.f90_i18n_control SET enabled=true,daily_neuron_cap=350 WHERE id=1;
 UPDATE public.f90_i18n_daily SET reserved_neurons=0 WHERE day=(now() AT TIME ZONE 'UTC')::date;
 claim:=public.f90_i18n_claim();IF jsonb_array_length(claim->'rows')<1 THEN RAISE EXCEPTION 'Queue claim failed';END IF;
 IF NOT coalesce((public.f90_i18n_claim()->>'quota_exhausted')::boolean,false) THEN RAISE EXCEPTION 'Daily bound failed';END IF;
 IF (SELECT price FROM public.products WHERE id=prod)<>123 THEN RAISE EXCEPTION 'Original price changed by translation';END IF;
 IF has_table_privilege('anon','public.f90_i18n_text','TRUNCATE') OR has_table_privilege('authenticated','public.f90_i18n_jobs','SELECT') OR has_function_privilege('authenticated','public.f90_i18n_save(uuid,text,text,text,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Translation management exposed';END IF;
 IF public.f90_i18n_worker_verify(floor(extract(epoch from now()))::bigint,'invalid',repeat('0',64)) THEN RAISE EXCEPTION 'Invalid worker signature accepted';END IF;
 IF public.f90_i18n_worker_verify(0,'f90-i18n-worker:0:claim',repeat('0',64)) THEN RAISE EXCEPTION 'Old worker signature accepted';END IF;
END $test$;
SELECT 'PASS: new/updated services queued, price-only updates ignored, private/public catalogue, daily cap, invalid signatures, metadata grants; ROLLBACK' AS result;
