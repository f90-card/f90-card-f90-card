-- F90 targeted restoration to pre-2026-10-16 pricing, without rolling back subsequent UI/Telegram edits.
-- Historical basis: pre-change Yassen margin 10%, ILS retailer conversion 3.365 per USD, site USD.
-- Do not edit previous orders, deposits, ledger entries, payment-method fees, images, categories or user preferences.
DO $$
DECLARE v_provider_id uuid; n int; touched int;
BEGIN
 SELECT id INTO v_provider_id FROM public.f90_providers
  WHERE adapter='yassen' AND config->>'archived_at' IS NULL
  AND config->>'pricing_revision'='f90_20261016' FOR UPDATE;
 IF v_provider_id IS NULL THEN RAISE EXCEPTION 'F90_PRICE_RESTORE_PROVIDER_CHANGED'; END IF;
 SELECT count(*) INTO n
 FROM public.f90_product_internal i JOIN public.products p ON p.id=i.product_id
 WHERE i.provider_id=v_provider_id AND i.auto_margin
   AND p.commerce->>'supplier_fx_migrated'='20261016';
 IF n<>574 THEN RAISE EXCEPTION 'F90_PRICE_RESTORE_COUNT_MISMATCH %',n; END IF;
 IF EXISTS(
   SELECT 1 FROM public.f90_product_internal i JOIN public.products p ON p.id=i.product_id
   WHERE i.provider_id=v_provider_id AND i.auto_margin
     AND p.commerce->>'supplier_fx_migrated'='20261016'
     AND (p.updated_at > '2026-10-15 22:31:00+00'::timestamptz OR
       p.price<>round(i.cost_usd*1.13,2))
 ) THEN RAISE EXCEPTION 'F90_PRICE_RESTORE_MANUAL_MODIFICATIONS'; END IF;

 UPDATE public.f90_product_internal i
 SET cost_usd=round(i.cost_usd*3.20/3.365,6)
 FROM public.products p
 WHERE p.id=i.product_id AND i.provider_id=v_provider_id AND i.auto_margin
 AND p.commerce->>'supplier_fx_migrated'='20261016' AND i.cost_usd>0;
 GET DIAGNOSTICS touched=ROW_COUNT;
 IF touched<>n THEN RAISE EXCEPTION 'F90_PRICE_RESTORE_MISSING_COST'; END IF;

 UPDATE public.products p
 SET price=round(i.cost_usd*1.10,2),
 commerce=jsonb_set(coalesce(p.commerce,'{}'::jsonb),'{prices,USD}',
     to_jsonb(round(i.cost_usd*1.10,6)),true)-'supplier_fx_migrated'
 FROM public.f90_product_internal i
 WHERE i.product_id=p.id AND i.provider_id=v_provider_id AND i.auto_margin
   AND p.commerce->>'supplier_fx_migrated'='20261016';

 UPDATE public.f90_providers SET margin_percent=10,
  config=config-'supplier_ils_per_usd'-'supplier_commission_percent'
       -'previous_supplier_ils_per_usd'-'pricing_revision'
 WHERE id=v_provider_id;

 UPDATE public.f90_rates SET per_usd=3.365, is_enabled=true WHERE currency='ILS';
 UPDATE public.site_settings SET currency='USD',
   config=coalesce(config,'{}'::jsonb)-'default_display_currency'-'fx_rates_reference'
 WHERE id=1;
END $$;

CREATE OR REPLACE FUNCTION f90_private.yassen_import_pending()
RETURNS integer LANGUAGE plpgsql SET search_path TO '' AS $function$
DECLARE p record; response record; payload jsonb; created integer:=0;
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
   IF new_cost<=0 OR new_price<=0 OR new_price>1000000 THEN
     RAISE EXCEPTION 'Invalid converted supplier price'; END IF;
   UPDATE public.f90_product_internal SET cost_usd=new_cost WHERE product_id=link.product_id;
   IF link.auto_margin THEN
     UPDATE public.products SET price=round(new_price,2),
       commerce=jsonb_set(commerce,'{prices,USD}',to_jsonb(new_price),true)
       WHERE id=link.product_id;
   END IF;
 END LOOP;

 UPDATE public.f90_providers SET config=(config-'sync_request_id'-'sync_error')||
   jsonb_build_object('sync_state','ok','sync_last_success',now(),
     'sync_created_drafts',created) WHERE id=p.id;
 RETURN created;
EXCEPTION WHEN OTHERS THEN
 IF p.id IS NOT NULL THEN
   UPDATE public.f90_providers SET config=(config-'sync_request_id')||
     jsonb_build_object('sync_state','error','sync_last_error',now(),
       'sync_error',left(SQLERRM,200)) WHERE id=p.id;
 END IF;
 RETURN 0;
END; $function$;


-- Apply a margin to linked products atomically using their last known supplier cost.
create or replace function public.f90_provider_margin(
  p_actor uuid, p_provider uuid, p_margin numeric
) returns integer language plpgsql set search_path = '' as $$
declare affected integer;
begin
  perform f90_private.require_actor(p_actor, array['manager']);
  if p_margin is null or p_margin < 0 or p_margin > 10000
    then raise exception 'F90_FIELDS'; end if;
  perform 1 from public.f90_providers
  where id = p_provider and (config->>'archived_at') is null for update;
  if not found then raise exception 'F90_NOT_FOUND'; end if;
  if exists (
    select 1 from public.f90_product_internal i
    where i.provider_id = p_provider and i.auto_margin and i.cost_usd is not null
      and (i.cost_usd <= 0 or
           round(i.cost_usd * (1 + p_margin / 100), 6) <= 0 or
           round(i.cost_usd * (1 + p_margin / 100), 6) > 1000000)
  ) then raise exception 'F90_FIELDS'; end if;

  update public.products p
  set price = round(i.cost_usd * (1 + p_margin / 100), 6),
      commerce = jsonb_set(coalesce(p.commerce, '{}'::jsonb),
        '{prices,USD}', to_jsonb(round(i.cost_usd * (1 + p_margin / 100), 6)), true)
  from public.f90_product_internal i
  where i.product_id = p.id and i.provider_id = p_provider and i.auto_margin and i.cost_usd is not null;
  get diagnostics affected = row_count;
  update public.f90_providers set margin_percent = p_margin where id = p_provider;
  insert into public.f90_audit(actor_id, action, target_id, details)
    values (p_actor, 'provider.margin', p_provider,
      jsonb_build_object('margin_percent', p_margin, 'updated', affected));
  return affected;
end $$;
revoke all on function public.f90_provider_margin(uuid,uuid,numeric) from public, anon, authenticated;
grant execute on function public.f90_provider_margin(uuid,uuid,numeric) to service_role;

