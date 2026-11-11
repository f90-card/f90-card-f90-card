CREATE OR REPLACE FUNCTION public.f90_brand_apply() RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE provider public.f90_providers%rowtype; root uuid; cat record; item record; cid uuid; pid uuid; src jsonb; c jsonb; fields jsonb; unit numeric; cost numeric; sale_price numeric; minq bigint; maxq bigint; imported integer:=0; updated integer:=0; invalid integer:=0; started timestamptz:=clock_timestamp(); existing record;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtext('brand-one-import')) THEN RETURN '{"busy":true}'; END IF;
 SELECT * INTO STRICT provider FROM public.f90_providers WHERE adapter='brand_one' AND NOT config ? 'archived_at';
 IF provider.currency<>'USD' THEN RAISE EXCEPTION 'Brand One currency must match verified USD account'; END IF;
 INSERT INTO public.categories(name,slug,is_active,sort_order,image_url,presentation)
 VALUES ('خدمات F90 الإضافية','f90-brand-one-root',true,80,'https://www.f90card.online/f90-logo.png',jsonb_build_object('provider_id',provider.id,'layout','images','availability','available'))
 ON CONFLICT(slug) DO UPDATE SET presentation=public.categories.presentation||excluded.presentation
 RETURNING id INTO root;
 FOR cat IN WITH RECURSIVE tree AS (
  SELECT source_id,source,image_url,1 depth FROM f90_private.brand_categories WHERE coalesce(source->>'parent_id','0')='0'
  UNION ALL SELECT c.source_id,c.source,c.image_url,t.depth+1 FROM f90_private.brand_categories c JOIN tree t ON c.source->>'parent_id'=t.source_id WHERE t.depth<12
 ) SELECT * FROM tree ORDER BY depth,(source->>'name') LOOP
  IF coalesce(cat.source->>'parent_id','0')='0' THEN cid:=root;
  ELSE SELECT id INTO cid FROM public.categories WHERE slug='f90-brand-one-cat-'||(cat.source->>'parent_id'); END IF;
  IF cid IS NULL THEN RAISE EXCEPTION 'Missing supplier category parent'; END IF;
  INSERT INTO public.categories(name,slug,parent_id,is_active,image_url,sort_order,presentation)
  VALUES (CASE cat.source->>'name' WHEN 'Software Services Department' THEN 'خدمات البرامج والصيانة' WHEN 'Social Media Services Department' THEN 'خدمات التواصل الاجتماعي' WHEN 'Subscription VPN' THEN 'اشتراكات VPN' WHEN 'بطاقت الدفع' THEN 'البطاقات الرقمية' ELSE left(cat.source->>'name',200) END,'f90-brand-one-cat-'||cat.source_id,cid,true,coalesce(cat.image_url,nullif(cat.source->>'img',''), 'https://www.f90card.online/f90-logo.png'),0,jsonb_build_object('provider_id',provider.id,'supplier_category',cat.source_id,'layout','images','availability','available'))
  ON CONFLICT(slug) DO UPDATE SET parent_id=excluded.parent_id;
 END LOOP;
 FOR item IN SELECT * FROM f90_private.brand_products ORDER BY source_id::bigint LOOP
  src:=item.source;
  SELECT id INTO cid FROM public.categories WHERE slug='f90-brand-one-cat-'||(src->>'parent_id');
  IF cid IS NULL THEN invalid:=invalid+1; CONTINUE; END IF;
  IF nullif(src->>'price','') IS NULL OR (src->>'price')::numeric<=0 OR coalesce(src->>'currency','USD')<>'USD' THEN invalid:=invalid+1; CONTINUE; END IF;
  minq:=CASE WHEN src->>'product_type'='amount' THEN coalesce((src#>>'{qty_values,min}')::bigint,1) ELSE 1 END;
  maxq:=CASE WHEN src->>'product_type'='amount' THEN least(coalesce((src#>>'{qty_values,max}')::bigint,1),1000000000) ELSE 1 END;
  IF minq<1 OR maxq<minq THEN invalid:=invalid+1; CONTINUE; END IF;
  unit:=CASE WHEN src->>'product_type'<>'amount' THEN 1 WHEN (src->>'price')::numeric<0.00001 THEN 1000000 WHEN (src->>'price')::numeric<0.01 THEN 1000 ELSE 1 END;
  cost:=round((src->>'price')::numeric*unit,6); sale_price:=round(cost*(1+provider.margin_percent/100),6);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id','param_'||n,'label_ar',coalesce((SELECT z->>'label' FROM jsonb_array_elements(coalesce(src->'params_info','[]')) z WHERE z->>'key'=v LIMIT 1),v),'type','text','required',true) ORDER BY n),'[]') INTO fields FROM jsonb_array_elements_text(coalesce(src->'params','[]')) WITH ORDINALITY x(v,n);
  SELECT p.id,p.commerce,i.auto_margin INTO existing FROM public.f90_product_internal i JOIN public.products p ON p.id=i.product_id WHERE i.provider_id=provider.id AND i.provider_service=item.source_id;
  IF FOUND THEN
   UPDATE public.f90_product_internal SET cost_usd=cost WHERE product_id=existing.id;
   c:=jsonb_set(existing.commerce,'{supplier_available}',coalesce(src->'available','false'));
   c:=jsonb_set(c,'{availability}',to_jsonb(CASE WHEN src->>'available'='true' THEN coalesce(c->>'manual_availability_override','available') ELSE 'refilling' END));
   IF existing.auto_margin THEN c:=jsonb_set(c,'{prices,USD}',to_jsonb(sale_price)); END IF;
   UPDATE public.products SET commerce=c,price=CASE WHEN existing.auto_margin THEN sale_price ELSE public.products.price END WHERE id=existing.id;
   updated:=updated+1;
  ELSE
   c:=jsonb_build_object('type',CASE WHEN src->>'product_type'='amount' THEN 'quantity' ELSE 'fixed' END,'fulfillment','automatic','supplier_catalog','brand_one','supplier_available',coalesce(src->'available','false'),'availability',CASE WHEN src->>'available'='true' THEN 'available' ELSE 'refilling' END,'unit_quantity',unit,'pack_quantity',1,'quantity_min',minq,'quantity_max',maxq,'quantity_step',1,'prices',jsonb_build_object('USD',sale_price),'fields',fields,'delivery_time','تُرسل الطلبات تلقائيًا، ومدة التنفيذ حسب الخدمة لدى المورد','expected_minutes',0,'pricing_tiers','[]'::jsonb);
   IF provider.config->>'media_policy'='clean_circle' THEN c:=c||jsonb_build_object('image_policy','clean_circle','supplier_card',jsonb_build_object('image',jsonb_build_object('width',512,'height',512),'image_tile',jsonb_build_object('all',jsonb_build_object('shape','circle','fit','contain','imagePct',100)))); END IF;
   INSERT INTO public.products(category_id,name,slug,description,price,currency,image_url,commerce,is_active,sort_order)
   VALUES(cid,left(regexp_replace(src->>'name','(?i)(brand[- ]?one[- ]?card|براند ون كارد)','','g'),200),'f90-brand-one-service-'||item.source_id,coalesce(src->>'description',''),sale_price,'USD',(SELECT image_url FROM public.categories WHERE id=cid),c,true,0) RETURNING id INTO pid;
   INSERT INTO public.f90_product_internal(product_id,provider_id,provider_service,cost_usd,auto_margin) VALUES(pid,provider.id,item.source_id,cost,true);
   imported:=imported+1;
  END IF;
 END LOOP;
 UPDATE public.products SET commerce=jsonb_set(commerce,'{availability}','"refilling"') WHERE id IN (SELECT product_id FROM public.f90_product_internal i WHERE i.provider_id=provider.id AND NOT EXISTS(SELECT 1 FROM f90_private.brand_products s WHERE s.source_id=i.provider_service));
 UPDATE public.f90_providers SET config=config||jsonb_build_object('sync_state','ok','sync_last_success',now(),'sync_last_catalog_count',(SELECT count(*) FROM f90_private.brand_products),'sync_skipped_prices',invalid,'root_category_id',root) WHERE id=provider.id;
 RETURN jsonb_build_object('imported',imported,'updated',updated,'invalid',invalid,'categories',(SELECT count(*) FROM public.categories WHERE presentation->>'provider_id'=provider.id::text));
END $$;
REVOKE ALL ON FUNCTION public.f90_brand_apply() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f90_brand_apply() TO service_role;
