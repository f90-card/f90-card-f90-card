BEGIN;
DO $$
DECLARE items jsonb; result jsonb; before_details text; after_details text; service text; pid uuid; mode text;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('id',provider_service,'available',(source->>'available')::boolean,
   'source',source,'evidence',null)) INTO items FROM f90_private.shihab_catalog_source;
 SELECT i.product_id,i.provider_service INTO pid,service FROM public.f90_product_internal i
 JOIN public.products p ON p.id=i.product_id JOIN public.f90_providers pr ON pr.id=i.provider_id
 WHERE pr.adapter='shihab' AND p.commerce->>'supplier_available'='true' LIMIT 1;
 SELECT md5(string_agg(jsonb_build_array(id,name,image_url,category_id,price,commerce->'prices',is_active)::text,',' ORDER BY id))
 INTO before_details FROM public.products;
 -- Supplier disappearance blocks purchase without changing the merchant's publication switch.
 SELECT jsonb_agg(CASE WHEN e->>'id'=service THEN e||'{"available":false}'::jsonb ELSE e END) INTO items FROM jsonb_array_elements(items)e;
 result:=public.f90_shihab_apply_snapshot(items);
 IF (SELECT commerce->>'supplier_available' FROM public.products WHERE id=pid)<>'false' THEN RAISE EXCEPTION 'Availability not disabled'; END IF;
 SELECT jsonb_agg(CASE WHEN e->>'id'=service THEN e||'{"available":true,"evidence":{"mode":"automatic","fields":[{"field":"execution_type","value":"automatic","mode":"automatic"}]}}'::jsonb ELSE e END)
 INTO items FROM jsonb_array_elements(items)e;
 result:=public.f90_shihab_apply_snapshot(items);
 IF (SELECT commerce->>'supplier_available' FROM public.products WHERE id=pid)<>'true' THEN RAISE EXCEPTION 'Availability not restored'; END IF;
 IF (SELECT commerce->>'fulfillment' FROM public.products WHERE id=pid)<>'automatic' THEN RAISE EXCEPTION 'Explicit execution mode not applied'; END IF;
 SELECT jsonb_agg(e||'{"evidence":null}'::jsonb) INTO items FROM jsonb_array_elements(items)e;
 result:=public.f90_shihab_apply_snapshot(items);
 IF (SELECT commerce->>'fulfillment' FROM public.products WHERE id=pid)<>'automatic' THEN RAISE EXCEPTION 'Confirmed execution mode overwritten'; END IF;
 SELECT md5(string_agg(jsonb_build_array(id,name,image_url,category_id,price,commerce->'prices',is_active)::text,',' ORDER BY id))
 INTO after_details FROM public.products;
 IF before_details<>after_details THEN RAISE EXCEPTION 'Merchant product details changed'; END IF;
 BEGIN
   PERFORM public.f90_shihab_apply_snapshot(items||jsonb_build_array(items->0));
   RAISE EXCEPTION 'Duplicate supplier IDs accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'F90_CATALOG_INVALID' THEN RAISE; END IF; END;
 IF has_function_privilege('anon','public.f90_shihab_apply_snapshot(jsonb)','execute') OR
    has_function_privilege('authenticated','public.f90_shihab_apply_snapshot(jsonb)','execute')
    THEN RAISE EXCEPTION 'Public snapshot mutation exposed'; END IF;
END $$;
SELECT 'PASS: supplier stock disappears/returns, confirmed classification survives missing metadata, all retail prices/images/names/categories/publication preserved, duplicate IDs rejected, RPC restricted; ROLLBACK' result;
ROLLBACK;
