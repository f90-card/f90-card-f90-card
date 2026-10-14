create or replace function f90_private.smm_process_batch(p_limit integer default 50)
returns jsonb language plpgsql set search_path='' as $$
declare s record; q record; c record; source_name text; source_description text;
  target_slug text; title text; details text; image text; rate numeric; minq integer; maxq integer;
  exchange numeric; margin numeric; product_uuid uuid; imported integer:=0;
  organized integer:=0; reviewed integer:=0; errors integer:=0;
begin
 if not pg_try_advisory_xact_lock(hashtext('f90-smmcpan-catalog')) then
   return jsonb_build_object('busy',true); end if;
 select per_usd into exchange from public.f90_rates where currency='USD' and is_enabled;
 select margin_percent into margin from public.f90_providers
   where id='c0e80eb6-7079-4071-8310-4c013614ffd5'::uuid;
 for s in select * from f90_private.smm_source
   where state in ('pending','error') and next_attempt_at<=now()
   order by created_at,service_id limit least(greatest(p_limit,1),100)
   for update skip locked loop
   begin
    if exists(select 1 from public.f90_product_internal i where i.provider_id=s.provider_id
      and i.provider_service=s.service_id) then
      update f90_private.smm_source set state='imported',processed_at=now(),error=null
      where provider_id=s.provider_id and service_id=s.service_id;
      continue;
    end if;
    source_name:=trim(s.payload->>'name');
    target_slug:=f90_private.smm_classify(source_name,coalesce(s.payload->>'category',''));
    rate:=case when s.payload->>'rate' ~ '^[0-9]+(\.[0-9]+)?$'
      then (s.payload->>'rate')::numeric else null end;
    minq:=case when s.payload->>'min' ~ '^[0-9]+$' and length(s.payload->>'min')<=10 and (s.payload->>'min')::numeric<=1000000000
      then (s.payload->>'min')::integer else null end;
    maxq:=case when s.payload->>'max' ~ '^[0-9]+$' and length(s.payload->>'max')<=10 and (s.payload->>'max')::numeric<=1000000000
      then (s.payload->>'max')::integer else null end;
    if target_slug is null or rate is null or rate<=0 or minq is null or maxq is null
      or minq<1 or maxq<minq or maxq>1000000000 or exchange is null or exchange<=0 or margin is null
      or length(source_name)>50000 then
      update f90_private.smm_source set state='review',processed_at=now(),
        error='تصنيف أو سعر أو حدود كمية أو طول النص يحتاج مراجعة'
      where provider_id=s.provider_id and service_id=s.service_id;
      reviewed:=reviewed+1; continue;
    end if;
    select id into c from public.categories where categories.slug=target_slug;
    if c.id is null then raise exception 'Missing category %',target_slug; end if;
    title:=trim(regexp_replace(split_part(source_name,'[',1),'^[^[:alnum:]ء-ي]+','','g'));
    title:=left(coalesce(nullif(title,''),'خدمة رقمية'),155)||' · #'||s.service_id;
    source_description:=coalesce(s.payload->>'description','');
    -- Preserve every supplier detail privately, and all non-advertising service
    -- conditions visibly. Drafts require staff approval before publication.
    details:='التفاصيل الأصلية للخدمة: '||source_name;
    if source_description<>'' then details:=details||E'\n\nوصف الخدمة: '||
      regexp_replace(source_description,'https?://[^[:space:]<>]+','','gi'); end if;
    image:=f90_private.smm_image(target_slug);
    insert into public.products(name,slug,description,price,currency,category_id,
      image_url,is_active,commerce,sort_order)
    values(title,'smmcpan-'||s.service_id,details,
      round(rate/exchange*(1+margin/100),6),'USD',c.id,image,false,
      jsonb_build_object('type','quantity','fulfillment','manual','unit_quantity',1000,
        'quantity_min',minq,'quantity_max',maxq,'quantity_step',1,
        'prices',jsonb_build_object('USD',round(rate/exchange*(1+margin/100),6)),
        'fields',jsonb_build_array(jsonb_build_object('id','account_id',
          'label_ar','رابط أو معرّف الحساب','type','text','required',true))),
      0)
    on conflict(slug) do nothing returning id into product_uuid;
    if product_uuid is null then
      update f90_private.smm_source set state='review',processed_at=now(),
        error='تعارض مع منتج موجود؛ لم يتم تغيير المنتج'
      where provider_id=s.provider_id and service_id=s.service_id;
      reviewed:=reviewed+1; continue;
    end if;
    insert into public.f90_product_internal(product_id,provider_id,provider_service,cost_usd,auto_margin)
      values(product_uuid,s.provider_id,s.service_id,round(rate/exchange,6),true);
    update f90_private.smm_source set state='imported',product_id=product_uuid,
      processed_at=now(),error=null where provider_id=s.provider_id and service_id=s.service_id;
    imported:=imported+1;
   exception when others then
    update f90_private.smm_source set attempts=attempts+1,state='error',
      next_attempt_at=now()+interval '5 minutes',
      error=left(sqlerrm,300) where provider_id=s.provider_id and service_id=s.service_id;
    errors:=errors+1;
   end;
 end loop;
 for q in select x.*,p.name,p.description,p.image_url,p.is_active,p.category_id,
     i.provider_service,src.payload
   from f90_private.smm_queue x
   join public.f90_product_internal i on i.product_id=x.product_id
   join public.products p on p.id=x.product_id
   left join f90_private.smm_source src on src.provider_id=i.provider_id and src.service_id=i.provider_service
   where i.provider_id='c0e80eb6-7079-4071-8310-4c013614ffd5'::uuid
     and x.state in ('pending','error') and x.next_attempt_at<=now()
   order by p.created_at,p.id limit least(greatest(p_limit,1),100)
   for update of x skip locked loop
   begin
    source_name:=coalesce(nullif(q.payload->>'name',''),q.name);
    source_description:=coalesce(q.payload->>'description','');
    target_slug:=f90_private.smm_classify(source_name,coalesce(q.payload->>'category',''));
    if target_slug is null or source_name ~ '^\.+$' then
      update f90_private.smm_queue set state='review',processed_at=now(),
        error='المنصة غير واضحة؛ يلزم تصنيف يدوي'
      where product_id=q.product_id;
      reviewed:=reviewed+1; continue;
    end if;
    select id into c from public.categories where categories.slug=target_slug;
    title:=trim(regexp_replace(split_part(source_name,'[',1),'^[^[:alnum:]ء-ي]+','','g'));
    title:=left(coalesce(nullif(title,''),'خدمة رقمية'),155)||' · #'||q.provider_service;
    details:='التفاصيل الأصلية للخدمة: '||source_name;
    if source_description<>'' then details:=details||E'\n\nوصف الخدمة: '||
      regexp_replace(source_description,'https?://[^[:space:]<>]+','','gi'); end if;
    if q.payload is null and length(q.name)>=200 then
      details:=details||E'\n\nتنبيه: الاسم المستورد سابقًا مقصوص؛ راجع تفاصيل المورّد قبل النشر.';
    end if;
    image:=f90_private.smm_image(target_slug);
    update public.products set category_id=c.id,name=title,
      description=details,image_url=coalesce(image,q.image_url),updated_at=now()
    where id=q.product_id and exists(select 1 from public.f90_product_internal i
      where i.product_id=q.product_id and i.provider_id='c0e80eb6-7079-4071-8310-4c013614ffd5'::uuid);
    update f90_private.smm_queue set state=case when q.payload is null and length(q.name)>=200
      then 'review' else 'done' end,processed_at=now(),error=case when q.payload is null and length(q.name)>=200
      then 'الاسم القديم مقصوص؛ تحقق من المصدر' else null end where product_id=q.product_id;
    organized:=organized+1;
   exception when others then
    update f90_private.smm_queue set attempts=attempts+1,state='error',
      next_attempt_at=now()+interval '5 minutes',error=left(sqlerrm,300) where product_id=q.product_id;
    errors:=errors+1;
   end;
 end loop;
 return jsonb_build_object('imported',imported,'organized',organized,
   'review',reviewed,'errors',errors);
end $$;


update f90_private.smm_source set state='pending',next_attempt_at=now(),error=null where state='review' and payload->>'max'='1000000000' and f90_private.smm_classify(payload->>'name',payload->>'category') is not null;
