BEGIN;
DO $$
DECLARE payload jsonb; before_details text; after_details text; result jsonb;
BEGIN
 SELECT details INTO STRICT payload FROM f90_private.shihab_catalog_source WHERE provider_service='24793';
 IF payload->>'mode'<>'manual' THEN RAISE EXCEPTION 'Expected source-confirmed manual fixture'; END IF;
 SELECT md5(string_agg(jsonb_build_array(id,name,image_url,category_id,price,commerce->'prices',is_active)::text,',' ORDER BY id))
 INTO before_details FROM public.products;
 result:=public.f90_shihab_apply_details(jsonb_build_array(payload));
 IF result->>'processed'<>'1' THEN RAISE EXCEPTION 'Details not applied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.products p JOIN public.f90_product_internal i ON i.product_id=p.id
   JOIN public.f90_providers pr ON pr.id=i.provider_id WHERE pr.adapter='shihab' AND i.provider_service='24793'
   AND p.commerce->>'fulfillment'='manual' AND p.commerce->>'fulfillment_status'='confirmed'
   AND p.commerce->'supplier_delivery_time'='null'::jsonb) THEN RAISE EXCEPTION 'Verified type or missing ETA not preserved'; END IF;
 BEGIN
  PERFORM public.f90_shihab_apply_details(jsonb_build_array(jsonb_set(payload,'{source,id}','99999999')));
  RAISE EXCEPTION 'Mismatched supplier ID accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'F90_DETAILS_ID' THEN RAISE; END IF; END;
 SELECT md5(string_agg(jsonb_build_array(id,name,image_url,category_id,price,commerce->'prices',is_active)::text,',' ORDER BY id))
 INTO after_details FROM public.products;
 IF before_details<>after_details THEN RAISE EXCEPTION 'Merchant catalog details changed'; END IF;
 IF has_function_privilege('anon','public.f90_shihab_apply_details(jsonb)','execute') OR
    has_function_privilege('authenticated','public.f90_shihab_apply_details(jsonb)','execute') OR
    has_function_privilege('authenticated','public.f90_shihab_claim_details()','execute')
 THEN RAISE EXCEPTION 'Public detail mutation exposed'; END IF;
END $$;
SELECT 'PASS: source-confirmed manual mode preserved, missing ETA stays null, ID mismatch rejected, prices/images/names/categories/publication preserved, mutation RPCs restricted; ROLLBACK' result;
ROLLBACK;
