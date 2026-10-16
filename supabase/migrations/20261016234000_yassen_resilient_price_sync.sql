-- Preserve manager-adjusted Yassen service pricing, skip anomalous provider prices
-- without interrupting availability updates for other services.
-- Newly imported products remain draft until review. Existing visible products
-- keep their names, images, category, metadata and manually set visibility.
UPDATE public.f90_product_internal i SET auto_margin=false
FROM public.products p, public.f90_providers v
WHERE i.product_id=p.id AND i.provider_id=v.id AND v.adapter='yassen'
  AND i.auto_margin=true
  AND p.commerce->'prices'->>'USD' IS NOT NULL
  AND abs((p.commerce->'prices'->>'USD')::numeric
    - round(i.cost_usd*(1+v.margin_percent/100),6))>0.03;
CREATE OR REPLACE FUNCTION f90_private.yassen_import_pending()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE p record; response record; payload jsonb; created integer:=0;
  skipped integer:=0; skipped_ids jsonb:='[]'::jsonb;
  fx numeric; link record; supplier_item jsonb; source_price numeric; new_cost numeric; new_price numeric;
  previous_availability text;
BEGIN
 SELECT id,config,margin_percent,currency INTO p FROM public.f90_providers
 WHERE adapter='yassen' AND is_enabled AND config->>'archived_at' IS NULL
   AND config->>'sync_state'='pending'
   AND coalesce((config->>'disconnected')::boolean,false)=false LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN 0; END IF;
 SELECT per_usd INTO fx FROM public.f90_rates WHERE currency=p.currency AND is_enabled;
 IF fx IS NULL OR fx<=0 THEN RAISE EXCEPTION 'Supplier exchange rate unavailable'; END IF;
 SELECT status_code,content,error_msg,timed_out INTO response FROM net._http_response
 WHERE id=(p.config->>'sync_request_id')::bigint;
 IF NOT FOUND THEN RETURN 0; END IF;
 IF response.status_code<>200 OR response.error_msg IS NOT NULL OR
    response.timed_out OR length(response.content)>2000000 THEN
   RAISE EXCEPTION 'Supplier response unavailable';
 END IF;
 payload:=response.content::jsonb;
 IF jsonb_typeof(payload)<>'array' OR jsonb_array_length(payload)<100 OR
    jsonb_array_length(payload)>5000 THEN
   RAISE EXCEPTION 'Supplier product list invalid';
 END IF;
 IF (SELECT count(*)<>count(DISTINCT item->>'id') FROM jsonb_array_elements(payload) item) THEN
   RAISE EXCEPTION 'Supplier product IDs are not unique';
 END IF;

 WITH source AS (
   SELECT item AS e FROM jsonb_array_elements(payload) item
   WHERE item->>'available'='true'
     AND jsonb_typeof(item->'price')='number'
     AND (item->>'price')::numeric>0
     AND item->>'id' ~ '^[0-9]+$'
 ), limits AS (
   SELECT e,(e->>'price')::numeric unit_cost,
     CASE WHEN jsonb_typeof(e->'qty_values')='object' THEN
       CASE WHEN e->'qty_values'->>'min' ~ '^[0-9]+$' THEN (e->'qty_values'->>'min')::numeric END
       WHEN jsonb_typeof(e->'qty_values')='array' THEN
         (SELECT min(v::numeric) FROM jsonb_array_elements_text(e->'qty_values') v
          WHERE v ~ '^[0-9]+$') ELSE 1 END mn,
     CASE WHEN jsonb_typeof(e->'qty_values')='object' THEN
       CASE WHEN e->'qty_values'->>'max' ~ '^[0-9]+$' THEN (e->'qty_values'->>'max')::numeric END
       WHEN jsonb_typeof(e->'qty_values')='array' THEN
         (SELECT max(v::numeric) FROM jsonb_array_elements_text(e->'qty_values') v
          WHERE v ~ '^[0-9]+$') ELSE 1 END mx
   FROM source
 ), prepared AS (
   SELECT e,unit_cost,mn::integer mn,mx::integer mx,
     CASE WHEN unit_cost<0.00001 THEN 1000000
          WHEN unit_cost<0.01 THEN 1000 ELSE 1 END scale,
     f90_private.yassen_category_id(e->>'category_name',e->>'name') category_id,
     CASE WHEN jsonb_typeof(e->'params')='array' AND jsonb_array_length(e->'params')>0 THEN
       (SELECT jsonb_agg(jsonb_build_object('id','param_'||ord,'label_ar',left(label,150),
         'type','text','required',true) ORDER BY ord)
        FROM jsonb_array_elements_text(e->'params') WITH ORDINALITY t(label,ord))
       ELSE '[{"id":"account_id","label_ar":"رابط أو معرّف الحساب","type":"text","required":true}]'::jsonb
     END fields
   FROM limits WHERE mn BETWEEN 1 AND 1000000000 AND mx BETWEEN mn AND 1000000000
     AND length(e->>'id')<=100 AND nullif(trim(e->>'name'),'') IS NOT NULL
 ), inserted AS (
   INSERT INTO public.products(name,slug,description,price,currency,category_id,is_active,commerce)
   SELECT left(q.e->>'name',200),'yassen-'||(q.e->>'id'),
      'أف تسعين كارد · '||left(coalesce(q.e->>'category_name',''),180),
      round(q.unit_cost*q.scale/fx*(1+p.margin_percent/100),6),'USD',c.id,false,
      jsonb_build_object('type','quantity','fulfillment','manual','unit_quantity',q.scale,
        'quantity_min',q.mn,'quantity_max',q.mx,'quantity_step',1,
        'prices',jsonb_build_object('USD',round(q.unit_cost*q.scale/fx*(1+p.margin_percent/100),6)),
        'fields',q.fields,
        'supplier_quantity_values',CASE WHEN jsonb_typeof(q.e->'qty_values')='array'
          THEN q.e->'qty_values' ELSE NULL END)
   FROM prepared q JOIN public.categories c ON c.id=q.category_id
   WHERE q.unit_cost*q.scale/fx*(1+p.margin_percent/100)>=0.01
     AND NOT EXISTS (SELECT 1 FROM public.products old WHERE old.slug='yassen-'||(q.e->>'id'))
   ON CONFLICT(slug) DO NOTHING RETURNING id,slug
 ), mapped AS (
   INSERT INTO public.f90_product_internal(product_id,provider_id,provider_service,cost_usd,auto_margin)
   SELECT i.id,p.id,substring(i.slug from 8),round(q.unit_cost*q.scale/fx,6),true
   FROM inserted i JOIN prepared q ON i.slug='yassen-'||(q.e->>'id')
   RETURNING product_id
 ) SELECT count(*) INTO created FROM mapped;

 -- Refresh linked products without touching merchant edits to names, images,
 -- categories, visibility, descriptions or customer input fields.
 FOR link IN SELECT i.product_id,i.provider_service,i.auto_margin,
                    pr.commerce,pr.price
   FROM public.f90_product_internal i JOIN public.products pr ON pr.id=i.product_id
   WHERE i.provider_id=p.id LOOP
   SELECT e INTO supplier_item FROM jsonb_array_elements(payload) e
     WHERE e->>'id'=link.provider_service LIMIT 1;
   IF supplier_item IS NULL OR supplier_item->>'available' IS DISTINCT FROM 'true'
      OR supplier_item->>'price' !~ '^[0-9]+(\.[0-9]+)?$'
      OR (supplier_item->>'price')::numeric<=0 THEN
     IF coalesce((link.commerce->>'supplier_refilling')::boolean,false)=false THEN
       UPDATE public.products SET commerce=jsonb_set(
         jsonb_set(coalesce(commerce,'{}'::jsonb),'{supplier_previous_availability}',
           to_jsonb(coalesce(commerce->>'availability','available')),true),
         '{supplier_refilling}','true'::jsonb,true) ||
         '{"availability":"refilling"}'::jsonb
       WHERE id=link.product_id;
     END IF;
     CONTINUE;
   END IF;
   IF coalesce((link.commerce->>'supplier_refilling')::boolean,false) THEN
     UPDATE public.products SET commerce=(commerce-'supplier_refilling'-'supplier_previous_availability') ||
       jsonb_build_object('availability',coalesce(commerce->>'supplier_previous_availability','available'))
       WHERE id=link.product_id;
   END IF;
   source_price := (supplier_item->>'price')::numeric;
   new_cost := round(source_price * coalesce((link.commerce->>'unit_quantity')::numeric,1)/fx,6);
   new_price := round(new_cost * (1+p.margin_percent/100),6);
   -- Supplier sometimes quotes implausibly high values for a bulk package.
   -- Quarantine only that mapped service. Never abort the whole catalog.
   IF new_cost IS NULL OR new_price IS NULL OR new_cost<=0
      OR new_price<=0 OR new_price>1000000 OR new_cost>1000000 THEN
     skipped:=skipped+1;
     IF jsonb_array_length(skipped_ids)<10 THEN
       skipped_ids:=skipped_ids||to_jsonb(link.provider_service);
     END IF;
     UPDATE public.products
       SET commerce=(coalesce(commerce,'{}'::jsonb)
         ||jsonb_build_object(
           'supplier_previous_availability',
           CASE WHEN coalesce((commerce->>'supplier_refilling')::boolean,false)
             THEN coalesce(commerce->>'supplier_previous_availability','available')
             ELSE coalesce(commerce->>'availability','available') END,
           'supplier_refilling',true,'availability','refilling'))
       WHERE id=link.product_id
         AND coalesce((commerce->>'supplier_refilling')::boolean,false)=false;
     CONTINUE;
   END IF;
   UPDATE public.f90_product_internal SET cost_usd=new_cost
     WHERE product_id=link.product_id AND cost_usd IS DISTINCT FROM new_cost;
   IF link.auto_margin THEN
     UPDATE public.products SET price=greatest(0.01,round(new_price,2)),
       commerce=jsonb_set(coalesce(commerce,'{}'::jsonb),'{prices,USD}',to_jsonb(new_price),true)
       WHERE id=link.product_id AND
        (price IS DISTINCT FROM greatest(0.01,round(new_price,2))
          OR (commerce->'prices'->>'USD')::numeric IS DISTINCT FROM new_price);
   END IF;
 END LOOP;

 UPDATE public.f90_providers SET config=(config-'sync_request_id'-'sync_error')||
   jsonb_build_object('sync_state','ok','sync_last_success',now(),
     'sync_created_drafts',created,'sync_skipped_prices',skipped,
     'sync_skipped_service_ids',skipped_ids,
     'sync_last_catalog_count',jsonb_array_length(payload)) WHERE id=p.id;
 RETURN created;
EXCEPTION WHEN OTHERS THEN
 IF p.id IS NOT NULL THEN
   UPDATE public.f90_providers SET config=(config-'sync_request_id')||
     jsonb_build_object('sync_state','error','sync_last_error',now(),
       'sync_error',left(SQLERRM,200)) WHERE id=p.id;
 END IF;
 RETURN 0;
END; $function$
;
DO $$
DECLARE the_job bigint;
BEGIN
 SELECT jobid INTO the_job FROM cron.job WHERE jobname='f90-yassen-fetch';
 IF the_job IS NULL THEN RAISE EXCEPTION 'Yassen fetch scheduler missing'; END IF;
 PERFORM cron.alter_job(the_job,schedule=>'*/10 * * * *');
END $$;