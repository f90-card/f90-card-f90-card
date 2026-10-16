-- F90 CARD: idempotent owner-managed manual supplier and service drafts.
-- Never charge transfers through product checkout; real money transfers remain
-- in the existing manually reviewed special transfer workflow.
DO $f90$
DECLARE
  owner_id uuid;
  transfer_cat uuid;
  account_cat uuid;
  design_cat uuid;
  method jsonb;
  item record;
  item_slug text;
  item_name text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('f90-owner-manual-supplier'));
  SELECT id INTO owner_id FROM public.f90_providers
   WHERE name = 'خدمات أف تسعين' AND adapter = 'f90'
   ORDER BY created_at LIMIT 1;
  IF owner_id IS NULL THEN
    INSERT INTO public.f90_providers
      (name, endpoint, adapter, currency, is_enabled, margin_percent, config)
    VALUES ('خدمات أف تسعين', 'https://f90-card.github.io/f90-card-f90-card/', 'f90', 'USD', true, 0,
      '{"manual_supplier":true,"automatic_orders_enabled":false,"description_ar":"خدمات أف تسعين اليدوية؛ لا تحتاج إلى مفتاح API"}'::jsonb)
    RETURNING id INTO owner_id;
  END IF;
  SELECT id INTO transfer_cat FROM public.categories WHERE slug='money-transfer' LIMIT 1;
  SELECT id INTO account_cat FROM public.categories WHERE slug='account-sales' LIMIT 1;
  SELECT id INTO design_cat FROM public.categories WHERE slug='design-services' LIMIT 1;
  IF transfer_cat IS NULL OR account_cat IS NULL OR design_cat IS NULL THEN
    RAISE EXCEPTION 'F90 special categories missing; no products inserted';
  END IF;
  FOR method IN SELECT value FROM jsonb_array_elements(
     coalesce((SELECT config->'money_transfer'->'methods' FROM public.site_settings WHERE id=1),'[]'::jsonb)
  ) LOOP
    IF method->>'id' IS NULL OR method->>'name_ar' IS NULL THEN CONTINUE; END IF;
    item_slug := 'f90-transfer-' || (method->>'id');
    item_name := 'تحويل ' || (method->>'name_ar');
    INSERT INTO public.products
      (category_id,name,slug,description,price,currency,image_url,is_active,is_featured,commerce)
    VALUES (transfer_cat,item_name,item_slug,
      'خدمة تحويل عبر '||(method->>'name_ar')||' بعملة '||coalesce(method->>'currency','USD')||
      '. تطلب من قسم تحويل الأموال المخصص فقط، وتخضع لمراجعة الإدارة والعمولة المحددة لكل وسيلة.',
      0,'USD',coalesce(nullif(method->>'image_url',''),'./assets/f90-new/category-transfer.webp'),
      false,false,jsonb_build_object('type','fixed','fulfillment','manual','availability','available',
        'prices',jsonb_build_object('USD',0),'unit_quantity',1,
        'fields',jsonb_build_array(jsonb_build_object('id','recipient','label_ar','بيانات المستلم',
          'type','textarea','required',true)),
        'special_route','transfer','transfer_method_id',method->>'id',
        'admin_draft',true,'no_checkout',true))
    ON CONFLICT (slug) DO NOTHING;
    INSERT INTO public.f90_product_internal(product_id,provider_id,provider_service,auto_margin)
      SELECT p.id,owner_id,'manual:'||item_slug,false FROM public.products p
       WHERE p.slug=item_slug
       AND NOT EXISTS (SELECT 1 FROM public.f90_product_internal i WHERE i.product_id=p.id)
      ON CONFLICT (product_id) DO NOTHING;
  END LOOP;
  FOR item IN SELECT * FROM (VALUES
      ('animated','تصميم صور متحركة','./assets/f90-new/design-animated-v2.webp'),
      ('banners','تصميم بنرات إعلانية','./assets/f90-new/design-banners-v2.webp'),
      ('ticker','تصميم شريط متحرك','./assets/f90-new/design-ticker-v2.webp'),
      ('agency','تصميم احتفال وكالة','./assets/f90-new/design-agency-v2.webp'),
      ('birthday','تصميم أعياد ميلاد','./assets/f90-new/design-birthday-v2.webp')
    ) AS v(service_key,service_name,service_image) LOOP
    item_slug := 'f90-design-' || item.service_key;
    INSERT INTO public.products
      (category_id,name,slug,description,price,currency,image_url,is_active,is_featured,commerce)
    VALUES (design_cat,item.service_name,item_slug,
      'خدمة تصميم حسب الطلب؛ السعر النهائي يحدده صاحب المتجر بعد مراجعة التفاصيل.',
      0,'USD',item.service_image,false,false,
      jsonb_build_object('type','fixed','fulfillment','manual','availability','available',
        'prices',jsonb_build_object('USD',0),'admin_draft',true,'no_checkout',true,
        'fields',jsonb_build_array(
          jsonb_build_object('id','whatsapp','label_ar','رقم واتساب للتواصل','type','text','required',true),
          jsonb_build_object('id','brief','label_ar','تفاصيل التصميم','type','textarea','required',true))))
    ON CONFLICT (slug) DO NOTHING;
    INSERT INTO public.f90_product_internal(product_id,provider_id,provider_service,auto_margin)
      SELECT p.id,owner_id,'manual:'||item_slug,false FROM public.products p
       WHERE p.slug=item_slug
       AND NOT EXISTS (SELECT 1 FROM public.f90_product_internal i WHERE i.product_id=p.id)
      ON CONFLICT (product_id) DO NOTHING;
  END LOOP;
  item_slug := 'f90-account-xena';
  INSERT INTO public.products
    (category_id,name,slug,description,price,currency,image_url,is_active,is_featured,commerce)
  VALUES (account_cat,'شراء حساب Xena Live',item_slug,
    'عرض حسابات Xena Live المتوفرة. السعر والتسليم يخضعان لمراجعة الإدارة.',
    0,'USD','./assets/f90-new/account-xena-v2.webp',false,false,
    jsonb_build_object('type','fixed','fulfillment','manual','availability','available',
      'prices',jsonb_build_object('USD',0),'admin_draft',true,'no_checkout',true,
      'fields',jsonb_build_array(
        jsonb_build_object('id','whatsapp','label_ar','رقم واتساب للتواصل','type','text','required',true))))
  ON CONFLICT (slug) DO NOTHING;
  INSERT INTO public.f90_product_internal(product_id,provider_id,provider_service,auto_margin)
    SELECT p.id,owner_id,'manual:'||item_slug,false FROM public.products p
     WHERE p.slug=item_slug
     AND NOT EXISTS (SELECT 1 FROM public.f90_product_internal i WHERE i.product_id=p.id)
    ON CONFLICT (product_id) DO NOTHING;
  -- Preserve the existing real $500 website product and its published state.
  INSERT INTO public.f90_product_internal(product_id,provider_id,provider_service,auto_margin)
    SELECT p.id,owner_id,'manual:f90-full-website-500',false FROM public.products p
     WHERE p.slug='f90-full-website-500'
     AND NOT EXISTS (SELECT 1 FROM public.f90_product_internal i WHERE i.product_id=p.id)
    ON CONFLICT (product_id) DO NOTHING;
END
$f90$;
