CREATE OR REPLACE FUNCTION public.f90_brand_present(p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE provider uuid; cat jsonb; item jsonb; card jsonb; old jsonb; pid uuid; cid uuid; changed integer:=0; categories integer:=0; position integer:=0; image text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('brand-one-import'));
 SELECT id INTO STRICT provider FROM public.f90_providers WHERE adapter='brand_one' AND NOT config ? 'archived_at';
 IF jsonb_typeof(p_payload->'categories')='array' THEN
  FOR cat IN SELECT value FROM jsonb_array_elements(p_payload->'categories') LOOP
   image:=cat->>'image_url';
   IF image IS NULL OR image !~ '^https://api[.]brand-one-card[.]com/uploads/' THEN CONTINUE; END IF;
   card:=jsonb_build_object('image',coalesce(cat->'image','{}'),'display',coalesce(cat->'display','{}'),'source','brand_one','original_url',image,'public_slug',cat->>'public_slug');
   UPDATE f90_private.brand_categories SET source=source||jsonb_build_object('web',cat)||CASE WHEN nullif(cat->>'parent_source_id','') IS NOT NULL AND cat->>'parent_source_id'<>cat->>'source_id' THEN jsonb_build_object('parent_id',cat->>'parent_source_id') ELSE '{}'::jsonb END,image_url=image WHERE source_id=cat->>'source_id';
   UPDATE public.categories SET image_url=CASE WHEN presentation->>'image_policy'='clean_circle' THEN public.categories.image_url ELSE image END,
    parent_id=coalesce((SELECT parent.id FROM public.categories parent WHERE parent.slug='f90-brand-one-cat-'||(cat->>'parent_source_id') AND parent.presentation->>'provider_id'=provider::text AND parent.id<>public.categories.id),parent_id),
    presentation=presentation||jsonb_build_object('supplier_card',CASE WHEN presentation->>'image_policy'='clean_circle' THEN presentation->'supplier_card' ELSE card END),
    sort_order=coalesce((cat->>'sort_order')::integer,sort_order)
    WHERE slug='f90-brand-one-cat-'||(cat->>'source_id') AND presentation->>'provider_id'=provider::text;
   categories:=categories+1;
  END LOOP;
 END IF;
 IF jsonb_typeof(p_payload->'products')='array' THEN
  FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'products') LOOP
   image:=item->>'image_url';
   IF image IS NULL OR image !~ '^https://api[.]brand-one-card[.]com/uploads/' THEN RAISE EXCEPTION 'Invalid supplier product image'; END IF;
   SELECT p.id,p.commerce INTO pid,old FROM public.products p JOIN public.f90_product_internal i ON i.product_id=p.id
    WHERE i.provider_id=provider AND i.provider_service=item->>'source_id';
   IF pid IS NULL THEN RAISE EXCEPTION 'Unmapped supplier service'; END IF;
   card:=jsonb_build_object('image',coalesce(item->'image',old#>'{supplier_card,image}','{}'),'image_tile',coalesce(item->'image_tile','{}'),'source','brand_one','original_url',image,'image_source',item->>'image_source','public_id',item->>'public_id','category_slug',item->>'category_slug');
   UPDATE f90_private.brand_products SET source=source||jsonb_build_object('web',item) WHERE source_id=item->>'source_id';
   UPDATE public.products SET image_url=CASE WHEN old->>'image_policy'='clean_circle' THEN public.products.image_url ELSE image END,name=coalesce(nullif(item->>'title',''),name),
    description=coalesce(nullif(item->>'description',''),description),
    sort_order=1000+coalesce((item->>'sort_order')::integer,position),
    commerce=old||jsonb_build_object('supplier_catalog','brand_one','supplier_card',CASE WHEN old->>'image_policy'='clean_circle' THEN old->'supplier_card' ELSE card END)
    WHERE id=pid;
   position:=position+1;changed:=changed+1;
  END LOOP;
 END IF;
 RETURN jsonb_build_object('products',changed,'categories',categories);
END $$;
REVOKE ALL ON FUNCTION public.f90_brand_present(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_brand_present(jsonb) TO service_role;
