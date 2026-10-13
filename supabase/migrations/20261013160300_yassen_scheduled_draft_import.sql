-- Queue a read-only request using the credential stored in Vault.
CREATE OR REPLACE FUNCTION f90_private.yassen_enqueue()
RETURNS bigint LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE p record; request_id bigint;
BEGIN
 SELECT v.id,v.config,s.decrypted_secret AS token INTO p
 FROM public.f90_providers v JOIN vault.decrypted_secrets s ON s.id=v.secret_id
 WHERE v.adapter='yassen' AND v.is_enabled AND v.config->>'archived_at' IS NULL
 LIMIT 1 FOR UPDATE OF v;
 IF NOT FOUND THEN RETURN NULL; END IF;
 -- Do not overwrite an in-flight request before its response is consumed.
 IF p.config->>'sync_state'='pending' AND
    (p.config->>'sync_started_at')::timestamptz > now()-interval '10 minutes'
 THEN RETURN NULL; END IF;
 SELECT net.http_get('https://api.yassen-card.com/client/api/products',
   '{}'::jsonb,jsonb_build_object('api-token',p.token),30000) INTO request_id;
 UPDATE public.f90_providers SET config=coalesce(config,'{}'::jsonb)||
   jsonb_build_object('sync_request_id',request_id,'sync_started_at',now(),
                      'sync_state','pending') WHERE id=p.id;
 RETURN request_id;
END; $function$;

CREATE OR REPLACE FUNCTION f90_private.yassen_import_pending()
RETURNS integer LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE p record; response record; payload jsonb; created integer:=0;
BEGIN
 SELECT id,config,margin_percent INTO p FROM public.f90_providers
 WHERE adapter='yassen' AND is_enabled AND config->>'archived_at' IS NULL
   AND config->>'sync_state'='pending' LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN 0; END IF;
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
     AND item->>'price' ~ '^[0-9]+(\\.[0-9]+)?$'
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
     CASE WHEN (e->>'category_name') ~* '(pubg|ببجي)' THEN 'category-4cad4b4c-a1f6-43a6-8218-2c58056af3a9'
          WHEN (e->>'category_name') ~* '(بطاق|itunes|gift|voucher|كود|code|steam)' THEN 'digital-cards'
          WHEN (e->>'category_name') ~* '(شحن التطبيقات|app|تطبيق|live|لايف)' THEN 'applications'
          WHEN (e->>'category_name') ~* '(نتفلكس|netflix|stream|مشاهدة)' THEN 'streaming'
          WHEN (e->>'category_name') ~* '(instagram|tiktok|تيك|انست|youtube|يوتيوب)' THEN 'social-media'
          ELSE 'قسم-ألالعاب' END category_slug,
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
      'ياسين كارد · '||left(coalesce(q.e->>'category_name',''),180),
      round(q.unit_cost*q.scale*(1+p.margin_percent/100),6),'USD',c.id,false,
      jsonb_build_object('type','quantity','fulfillment','manual','unit_quantity',q.scale,
        'quantity_min',q.mn,'quantity_max',q.mx,'quantity_step',1,
        'prices',jsonb_build_object('USD',round(q.unit_cost*q.scale*(1+p.margin_percent/100),6)),
        'fields',q.fields,
        'supplier_quantity_values',CASE WHEN jsonb_typeof(q.e->'qty_values')='array'
          THEN q.e->'qty_values' ELSE NULL END)
   FROM prepared q JOIN public.categories c ON c.slug=q.category_slug
   WHERE q.unit_cost*q.scale*(1+p.margin_percent/100)>=0.01
     AND NOT EXISTS (SELECT 1 FROM public.products old WHERE old.slug='yassen-'||(q.e->>'id'))
   ON CONFLICT(slug) DO NOTHING RETURNING id,slug
 ), mapped AS (
   INSERT INTO public.f90_product_internal(product_id,provider_id,provider_service,cost_usd,auto_margin)
   SELECT i.id,p.id,substring(i.slug from 8),round(q.unit_cost*q.scale,6),true
   FROM inserted i JOIN prepared q ON i.slug='yassen-'||(q.e->>'id')
   RETURNING product_id
 ) SELECT count(*) INTO created FROM mapped;

 UPDATE public.f90_providers SET config=(config-'sync_request_id')||
   jsonb_build_object('sync_state','ok','sync_last_success',now(),
     'sync_created_drafts',created) WHERE id=p.id;
 RETURN created;
EXCEPTION WHEN OTHERS THEN
 IF p.id IS NOT NULL THEN
   UPDATE public.f90_providers SET config=(config-'sync_request_id')||
     jsonb_build_object('sync_state','error','sync_last_error',now(),
       'sync_error','تعذّرت مزامنة قائمة المورّد') WHERE id=p.id;
 END IF;
 RETURN 0;
END; $function$;

REVOKE ALL ON FUNCTION f90_private.yassen_enqueue() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION f90_private.yassen_import_pending() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('f90-yassen-fetch','0 */6 * * *',
  'select f90_private.yassen_enqueue()');
SELECT cron.schedule('f90-yassen-import','*/5 * * * *',
  'select f90_private.yassen_import_pending()');
