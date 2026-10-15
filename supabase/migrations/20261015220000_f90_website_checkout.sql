-- Dedicated manual full-website order. Existing verified wallet checkout protects the charge.
insert into public.products (category_id,name,slug,description,price,currency,image_url,
  is_active,is_featured,stock,sort_order,commerce)
select c.id,'إنشاء موقع كامل ملك لك','f90-full-website-500',
  'تصميم وإنشاء موقع كامل باسمك بسعر 500 دولار شامل الخدمات الموضحة. أدخل واتساب للتواصل بخصوص المتطلبات والتنفيذ.',
  500,'USD','https://f90-card.github.io/f90-card-f90-card/assets/f90-new/category-website.webp',
  true,false,null,0,
  jsonb_build_object(
    'type','fixed','prices',jsonb_build_object('USD',500),
    'unit_quantity',1,'quantity_min',1,'quantity_max',1,'quantity_step',1,
    'fulfillment','manual','availability','available',
    'fields',jsonb_build_array(jsonb_build_object('id','whatsapp','type','text',
      'label_ar','رقم واتساب للتواصل','required',true,'placeholder_ar','+970...'))
  )
from public.categories c
where c.slug='complete-website'
and not exists(select 1 from public.products where slug='f90-full-website-500');
