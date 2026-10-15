-- F90 special requests: never move funds merely because a request was submitted.
create table if not exists public.f90_special_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('salary','transfer','account','design','website')),
 service text not null check (char_length(service) between 2 and 140),
 account_id text not null default '',
 contact_whatsapp text not null default '',
 amount_units numeric(30,2) not null default 0 check(amount_units >= 0),
 gross_usd numeric(24,2) not null default 0 check(gross_usd>=0),
 fee_usd numeric(24,2) not null default 0 check(fee_usd>=0),
 net_usd numeric(24,2) not null default 0 check(net_usd>=0),
 fee_percent numeric(8,3) not null default 0 check(fee_percent between 0 and 50),
 client_details text not null default '',
 quote_details jsonb not null default '{}'::jsonb,
 status text not null default 'pending' check(status in ('pending','processing','completed','rejected')),
 review_note text not null default '',
 idempotency_key text not null check(char_length(idempotency_key) between 8 and 120),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 unique(user_id,idempotency_key)
);
create index if not exists f90_special_requests_user_time on public.f90_special_requests(user_id,created_at desc);
create index if not exists f90_special_requests_status_time on public.f90_special_requests(status,created_at desc);
alter table public.f90_special_requests enable row level security;
revoke all on public.f90_special_requests from public,anon,authenticated;
grant select on public.f90_special_requests to authenticated;
create policy f90_special_read_own_manager on public.f90_special_requests for select to authenticated
 using(user_id=(select auth.uid()) or (select f90_private.my_role())='manager');

-- Manager-only review changes request status, never changes wallet or ledger.
create or replace function public.f90_special_review(p_id uuid,p_status text,p_note text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare rec public.f90_special_requests%rowtype;
begin
 if auth.uid() is null or f90_private.my_role() <> 'manager' then
   raise exception 'غير مصرح'; end if;
 if p_status not in ('processing','completed','rejected') then raise exception 'حالة غير صحيحة';end if;
 update public.f90_special_requests
 set status=p_status,review_note=left(coalesce(p_note,''),1200),reviewed_at=now()
 where id=p_id and status in ('pending','processing') returning * into rec;
 if not found then raise exception 'الطلب غير موجود أو تمت معالجته';end if;
 return jsonb_build_object('id',rec.id,'status',rec.status);
end $$;
revoke all on function public.f90_special_review(uuid,text,text) from public,anon;
grant execute on function public.f90_special_review(uuid,text,text) to authenticated;

-- Server authoritative pricing; browser-supplied prices are deliberately ignored.
create or replace function public.f90_special_submit(
 p_kind text,p_service text,p_account text,p_amount numeric,p_contact text,p_details text,p_key text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 uid uuid:=auth.uid();
 cfg jsonb;
 rate numeric;
 fee_rate numeric;
 amount numeric:=coalesce(p_amount,0);
 gross numeric:=0;
 charge numeric:=0;
 net numeric:=0;
 rec public.f90_special_requests%rowtype;
begin
 if uid is null then raise exception 'سجّل الدخول أولاً';end if;
 if p_key is null or p_key !~ '^[A-Za-z0-9_-]{8,120}$' then raise exception 'رقم طلب غير صالح';end if;
 select * into rec from public.f90_special_requests where user_id=uid and idempotency_key=p_key;
 if found then return jsonb_build_object('id',rec.id,'net_usd',rec.net_usd,'status',rec.status,'existing',true);end if;
 if p_kind not in ('salary','transfer','account','design','website') then raise exception 'نوع خدمة غير صالح';end if;
 if char_length(trim(coalesce(p_service,''))) not between 2 and 140 then raise exception 'الخدمة غير صحيحة';end if;
 if length(coalesce(p_account,''))>200 or length(coalesce(p_contact,''))>90 or length(coalesce(p_details,''))>3000 then raise exception 'البيانات طويلة جدًا';end if;
 if p_kind in ('salary','transfer') then
   if not exists(select 1 from public.profiles where id=uid and is_verified=true and account_status='active')
     then raise exception 'يجب توثيق الحساب قبل العملية';end if;
 end if;
 select coalesce(config->'special_services','{}'::jsonb) into cfg from public.site_settings where id=1;
 cfg:=coalesce(cfg,'{}'::jsonb);
 if p_kind='salary' then
   if length(trim(coalesce(p_account,'')))<2 then raise exception 'أدخل معرّف حسابك';end if;
   if amount<100000 then raise exception 'الحد الأدنى 100 ألف كوينز';end if;
   rate:=case when coalesce(cfg->>'salary_usd_per_100k','') ~ '^[0-9]{1,6}(\.[0-9]{1,3})?$' then (cfg->>'salary_usd_per_100k')::numeric else 10 end;
   fee_rate:=case when coalesce(cfg->>'salary_fee_percent','') ~ '^[0-9]{1,2}(\.[0-9]{1,3})?$' then least(50,(cfg->>'salary_fee_percent')::numeric) else 0 end;
   gross:=round(amount * rate / 100000,2);
 elsif p_kind='transfer' then
   if amount<=0 or length(trim(coalesce(p_details,'')))<8 then raise exception 'أدخل مبلغًا ومعلومات التحويل';end if;
   fee_rate:=case when coalesce(cfg->>'transfer_fee_percent','') ~ '^[0-9]{1,2}(\.[0-9]{1,3})?$' then least(50,(cfg->>'transfer_fee_percent')::numeric) else 2 end;
   gross:=round(amount,2);
 else
   if length(trim(coalesce(p_contact,'')))<6 then raise exception 'أدخل رقم واتساب للتواصل';end if;
   if p_kind='website' then
     gross:=case when coalesce(cfg->>'website_price_usd','') ~ '^[0-9]{1,7}(\.[0-9]{1,2})?$' then (cfg->>'website_price_usd')::numeric else 500 end;
   elsif p_kind='account' then
     gross:=case when coalesce(cfg->>'account_price_usd','') ~ '^[0-9]{1,7}(\.[0-9]{1,2})?$' then (cfg->>'account_price_usd')::numeric else 0 end;
   else gross:=0;
   end if;
   fee_rate:=0;
 end if;
 charge:=round(gross*fee_rate/100,2);
 net:=greatest(0,gross-charge);
 insert into public.f90_special_requests(user_id,kind,service,account_id,contact_whatsapp,
  amount_units,gross_usd,fee_usd,net_usd,fee_percent,client_details,quote_details,idempotency_key)
 values(uid,p_kind,trim(p_service),trim(coalesce(p_account,'')),trim(coalesce(p_contact,'')),
  amount,gross,charge,net,fee_rate,trim(coalesce(p_details,'')),
  jsonb_build_object('rate_usd_per_100k',case when p_kind='salary' then rate else null end,'currency','USD'),
  p_key) returning * into rec;
 return jsonb_build_object('id',rec.id,'gross_usd',rec.gross_usd,'fee_usd',rec.fee_usd,'net_usd',rec.net_usd,
   'status',rec.status,'wallet_changed',false);
exception when unique_violation then
  select * into rec from public.f90_special_requests where user_id=uid and idempotency_key=p_key;
  if not found then raise;end if;
  return jsonb_build_object('id',rec.id,'net_usd',rec.net_usd,'status',rec.status,'existing',true);
end $$;
revoke all on function public.f90_special_submit(text,text,text,numeric,text,text,text) from public,anon;
grant execute on function public.f90_special_submit(text,text,text,numeric,text,text,text) to authenticated;
