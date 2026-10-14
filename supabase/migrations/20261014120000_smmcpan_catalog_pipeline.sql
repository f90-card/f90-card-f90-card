-- SMMCPAN only. The existing catalog and supplier linkage were snapshotted in
-- f90_maintenance.smm_backup_20261014 before this migration.
create table if not exists f90_private.smm_source (
  provider_id uuid not null references public.f90_providers(id),
  service_id text not null,
  payload jsonb not null,
  state text not null default 'pending' check (state in ('pending','imported','review','error')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  error text,
  product_id uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (provider_id,service_id)
);
create index if not exists smm_source_pending_idx on f90_private.smm_source(state,next_attempt_at);

create table if not exists f90_private.smm_queue (
  product_id uuid primary key references public.products(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','done','review','error')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  error text,
  processed_at timestamptz
);
create index if not exists smm_queue_pending_idx on f90_private.smm_queue(state,next_attempt_at);
create table if not exists f90_private.smm_control (
  id boolean primary key default true check(id),
  fetching_until timestamptz,
  last_fetch_at timestamptz,
  last_fetch_count integer not null default 0,
  last_error text
);
insert into f90_private.smm_control(id) values(true) on conflict do nothing;

-- A supplier service ID, never a name, is the identity. Scope uniqueness to
-- this supplier so the existing Yassen catalog and constraints are untouched.
create unique index if not exists smmcpan_service_unique
  on public.f90_product_internal(provider_id,provider_service)
  where provider_id='c0e80eb6-7079-4071-8310-4c013614ffd5'::uuid
    and provider_service is not null;

-- Reuse a slug if staff already created it. No pre-existing category is edited.
insert into public.categories(name,slug,parent_id,sort_order,is_active)
select v.name,v.slug,parent.id,v.sort_order,true from (values
 ('إنستغرام','f90-smm-instagram','social-media',10),
 ('فيسبوك','f90-smm-facebook','social-media',20),
 ('تيك توك','f90-smm-tiktok','social-media',30),
 ('يوتيوب','f90-smm-youtube','social-media',40),
 ('تيليجرام','f90-smm-telegram','social-media',50),
 ('سناب شات','f90-smm-snapchat','social-media',60),
 ('كيك للبث المباشر','f90-smm-kick','social-media',70),
 ('إكس (تويتر)','f90-smm-x','social-media',80),
 ('جاكو','f90-smm-jaco','social-media',90),
 ('مشاهدات وبث مباشر','f90-smm-live','social-media',100),
 ('اشتراكات IPTV','f90-smm-iptv','streaming',110)
) v(name,slug,parent_slug,sort_order)
join public.categories parent on parent.slug=v.parent_slug
on conflict(slug) do nothing;

create or replace function f90_private.smm_classify(p_name text,p_category text default '')
returns text language plpgsql immutable set search_path='' as $$
declare t text:=lower(coalesce(p_name,'')||' '||coalesce(p_category,''));
begin
  if lower(coalesce(p_name,'')) ~ '(iptv|آي[ -]?بي[ -]?تي[ -]?في)' then return 'f90-smm-iptv'; end if;
  if t ~ '(instagram|انست[اغقر])' then return 'f90-smm-instagram'; end if;
  if t ~ '(facebook|فيس[ -]?بوك)' then return 'f90-smm-facebook'; end if;
  if t ~ '(tiktok|tik[ -]?tok|تيك[ -]?توك)' then return 'f90-smm-tiktok'; end if;
  if t ~ '(youtube|يوتيوب)' then return 'f90-smm-youtube'; end if;
  if t ~ '(telegram|تيل?ي?جرام)' then return 'f90-smm-telegram'; end if;
  if t ~ '(snapchat|سناب|منصة الاضواء)' then return 'f90-smm-snapchat'; end if;
  if t ~ '(kick|كيك)' then return 'f90-smm-kick'; end if;
  if t ~ '(jaco|جاكو)' then return 'f90-smm-jaco'; end if;
  if t ~ '(twitter|تويتر|إكس \(|اكس \()' then return 'f90-smm-x'; end if;
  if t ~ '(مشاهدات.*بث|بث مباشر|live stream)' then return 'f90-smm-live'; end if;
  return null;
end $$;

-- Use source-supported brand marks only; no fabricated app or F90 logo.
create or replace function f90_private.smm_image(p_slug text)
returns text language sql immutable set search_path='' as $$
 select case p_slug
 when 'f90-smm-instagram' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/instagram.svg'
 when 'f90-smm-facebook' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/facebook.svg'
 when 'f90-smm-tiktok' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/tiktok.svg'
 when 'f90-smm-youtube' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/youtube.svg'
 when 'f90-smm-telegram' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/telegram.svg'
 when 'f90-smm-snapchat' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/snapchat.svg'
 when 'f90-smm-kick' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/kick.svg'
 when 'f90-smm-x' then 'https://cdn.jsdelivr.net/npm/simple-icons@16/icons/x.svg'
 when 'f90-smm-iptv' then 'https://f90-card.github.io/f90-card-f90-card/assets/sections/streaming.png'
 else 'https://f90-card.github.io/f90-card-f90-card/assets/sections/social.png' end $$;

create or replace function f90_private.smm_on_link()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.provider_id='c0e80eb6-7079-4071-8310-4c013614ffd5'::uuid then
  insert into f90_private.smm_queue(product_id) values(new.product_id)
    on conflict(product_id) do nothing;
 end if;
 return new;
end $$;
drop trigger if exists f90_smm_link_queue on public.f90_product_internal;
create trigger f90_smm_link_queue after insert or update of provider_id,provider_service
on public.f90_product_internal for each row execute function f90_private.smm_on_link();

insert into f90_private.smm_queue(product_id)
select product_id from public.f90_product_internal
where provider_id='c0e80eb6-7079-4071-8310-4c013614ffd5'::uuid
on conflict(product_id) do nothing;

create or replace function public.f90_smm_claim_fetch()
returns boolean language plpgsql security invoker set search_path='' as $$
declare claimed boolean;
begin
 update f90_private.smm_control set fetching_until=now()+interval '5 minutes',last_error=null
 where id=true and (fetching_until is null or fetching_until<now())
 returning true into claimed;
 return coalesce(claimed,false);
end $$;
create or replace function public.f90_smm_finish_fetch(p_count integer,p_error text default null)
returns void language sql security invoker set search_path='' as $$
 update f90_private.smm_control set fetching_until=null,last_fetch_at=now(),
 last_fetch_count=greatest(0,coalesce(p_count,0)),last_error=left(p_error,300) where id=true $$;

create or replace function public.f90_smm_stage(p_items jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare inserted_count integer;
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100 then
  raise exception 'Invalid SMM batch'; end if;
 with valid as (
  select item,trim(coalesce(item->>'service',item->>'id','')) sid
  from jsonb_array_elements(p_items) item
  where jsonb_typeof(item)='object'
 ), staged as (
  insert into f90_private.smm_source(provider_id,service_id,payload)
  select 'c0e80eb6-7079-4071-8310-4c013614ffd5'::uuid,sid,item
  from valid where sid<>'' and length(sid)<=160 and
    nullif(trim(coalesce(item->>'name','')),'') is not null
  on conflict(provider_id,service_id) do nothing returning service_id
 ), requeue as (
   update f90_private.smm_queue q set state='pending',next_attempt_at=now(),error=null
   from public.f90_product_internal i join staged x on x.service_id=i.provider_service
   where q.product_id=i.product_id and
     i.provider_id='c0e80eb6-7079-4071-8310-4c013614ffd5'::uuid
   returning q.product_id
 ) select count(*) into inserted_count from staged;
 return jsonb_build_object('new',inserted_count,'seen',jsonb_array_length(p_items));
end $$;

-- Processes a bounded number of linked products and new supplier records.
-- Row locks and a transaction advisory lock keep overlapping cron runs safe.
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

create or replace function public.f90_smm_status()
returns jsonb language sql security invoker set search_path='' as $$
select jsonb_build_object('source',coalesce((select jsonb_object_agg(state,total) from
  (select state,count(*) total from f90_private.smm_source group by state) a),'{}'::jsonb),
 'queue',coalesce((select jsonb_object_agg(state,total) from
  (select state,count(*) total from f90_private.smm_queue group by state) b),'{}'::jsonb),
 'last_fetch_at',last_fetch_at,'last_fetch_count',last_fetch_count,'last_error',last_error)
from f90_private.smm_control where id=true $$;

create or replace function f90_private.smm_tick()
returns void language plpgsql set search_path='' as $$
declare secret text;
begin
 select decrypted_secret into secret from vault.decrypted_secrets where name='f90-worker';
 if secret is null then return; end if;
 perform net.http_post(url:='https://xzqnrpycjxfbyrfaolud.supabase.co/functions/v1/f90-platform',
  headers:=jsonb_build_object('Content-Type','application/json','x-f90-worker',secret),
  body:='{"action":"smm.catalog"}'::jsonb,timeout_milliseconds:=60000);
end $$;

revoke all on f90_private.smm_source,f90_private.smm_queue,f90_private.smm_control from public,anon,authenticated;
grant usage on schema f90_private to service_role;
grant select,insert,update on f90_private.smm_source,f90_private.smm_queue,f90_private.smm_control to service_role;
revoke all on function public.f90_smm_claim_fetch(),public.f90_smm_finish_fetch(integer,text),
 public.f90_smm_stage(jsonb),public.f90_smm_status() from public,anon,authenticated;
grant execute on function public.f90_smm_claim_fetch(),public.f90_smm_finish_fetch(integer,text),
 public.f90_smm_stage(jsonb),public.f90_smm_status() to service_role;
revoke all on function f90_private.smm_tick(),f90_private.smm_process_batch(integer)
 from public,anon,authenticated;

select cron.schedule('f90-smm-organize','* * * * *',
 'select f90_private.smm_process_batch(50)');
select cron.schedule('f90-smm-catalog','*/10 * * * *',
 'select f90_private.smm_tick()');
