CREATE OR REPLACE FUNCTION public.f90_apply_clean_catalog(p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE row jsonb; provider uuid; changed integer:=0; cats integer:=0; icon jsonb;
BEGIN
 SELECT id INTO STRICT provider FROM public.f90_providers WHERE adapter='brand_one' AND NOT config ? 'archived_at';
 icon:='{"image":{"width":512,"height":512},"image_tile":{"all":{"shape":"circle","fit":"contain","imagePct":100}},"source":"clean_service_icon"}'::jsonb;
 IF jsonb_array_length(coalesce(p_payload->'categories','[]'))>0 OR jsonb_array_length(coalesce(p_payload->'other_categories','[]'))>0 OR jsonb_array_length(coalesce(p_payload->'other_products','[]'))>0 THEN RAISE EXCEPTION 'Only new supplier service images can be updated'; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'products','[]')) LOOP
  IF row->>'image_url' NOT LIKE 'https://%' THEN RAISE EXCEPTION 'Invalid icon URL'; END IF;
  UPDATE public.products p SET image_url=row->>'image_url',commerce=commerce||jsonb_build_object('image_policy','clean_circle','supplier_card',icon)
   FROM public.f90_product_internal i WHERE i.product_id=p.id AND i.provider_id=provider AND i.provider_service=row->>'source_id';
  changed:=changed+1;
 END LOOP;
 UPDATE public.f90_providers SET config=config||'{"media_policy":"clean_circle"}'::jsonb WHERE id=provider;
 RETURN jsonb_build_object('products',changed,'categories',cats);
END $$;
REVOKE ALL ON FUNCTION public.f90_apply_clean_catalog(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_apply_clean_catalog(jsonb) TO service_role;
