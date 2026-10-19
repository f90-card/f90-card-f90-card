begin;
alter table public.f90_user_roles drop constraint f90_user_roles_role_check;
alter table public.f90_user_roles add constraint f90_user_roles_role_check check(role in ('customer','manager','admin','designer','trader','support','amin_card'));
create table public.f90_partner_spaces (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references auth.users(id),
 name text not null default 'الأمين كارد' check(length(name) between 1 and 100),
 is_active boolean not null default false,
 collaboration_image text, contacts jsonb not null default '[]' check(jsonb_typeof(contacts)='array' and jsonb_array_length(contacts)<=30),
 created_at timestamptz not null default now(),
 check(collaboration_image is null or collaboration_image like id::text||'/%')
);
create table public.f90_partner_categories (
 id uuid primary key default gen_random_uuid(),space_id uuid not null references public.f90_partner_spaces(id),
 name text not null check(length(name) between 1 and 150),image_path text,
 sort_order integer not null default 0,is_active boolean not null default true,
 unique(id,space_id),check(image_path is null or image_path like space_id::text||'/%')
);
create table public.f90_partner_products (
 id uuid primary key default gen_random_uuid(),space_id uuid not null references public.f90_partner_spaces(id),
 category_id uuid not null,name text not null check(length(name) between 1 and 200),
 description text not null default '' check(length(description)<=3000),image_path text,
 currency text not null default 'USD' check(currency in ('USD','ILS','JOD','EGP','EUR')),
 price numeric(18,6) not null check(price>0),
 purchase_url text not null check(purchase_url ~ '^https://(wa[.]me/[1-9][0-9]{6,14}([?]text=[^[:space:]]*)?|api[.]whatsapp[.]com/send[?]phone=[1-9][0-9]{6,14}(&text=[^[:space:]]*)?)$'),
 sort_order integer not null default 0,is_active boolean not null default true,
 foreign key(category_id,space_id) references public.f90_partner_categories(id,space_id),
 check(image_path is null or image_path like space_id::text||'/%')
);
create table public.f90_partner_banners (
 id uuid primary key default gen_random_uuid(),space_id uuid not null references public.f90_partner_spaces(id),
 title text not null default '' check(length(title)<=200),image_path text not null,
 placement text not null default 'main' check(placement in ('main','small')),
 link_url text not null default '' check(link_url='' or link_url ~ '^https://[^[:space:]]{1,1000}$'),
 sort_order integer not null default 0,is_active boolean not null default true,
 check(image_path like space_id::text||'/%')
);
create index on public.f90_partner_categories(space_id,sort_order);
create index on public.f90_partner_products(space_id,category_id,sort_order);
create index on public.f90_partner_banners(space_id,placement,sort_order);
alter table public.f90_partner_spaces enable row level security;
alter table public.f90_partner_categories enable row level security;
alter table public.f90_partner_products enable row level security;
alter table public.f90_partner_banners enable row level security;
create function f90_private.partner_manage(p_space uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select f90_private.my_role()) in ('manager','admin') or
 ((select f90_private.my_role())='amin_card' and exists(select 1 from public.f90_partner_spaces s where s.id=p_space and s.owner_id=(select auth.uid()))),false);
$$;
revoke all on function f90_private.partner_manage(uuid) from public,anon;
grant execute on function f90_private.partner_manage(uuid) to authenticated;
create policy partner_spaces_read on public.f90_partner_spaces for select to anon,authenticated using(is_active or f90_private.partner_manage(id));
-- Anonymous access needs a safe false response from the helper, never data access.
grant execute on function f90_private.partner_manage(uuid) to anon;
create policy partner_spaces_update on public.f90_partner_spaces for update to authenticated using(f90_private.partner_manage(id)) with check(f90_private.partner_manage(id));
create policy partner_spaces_insert on public.f90_partner_spaces for insert to authenticated with check((select f90_private.my_role())='manager');
create policy partner_categories_read on public.f90_partner_categories for select to anon,authenticated using(f90_private.partner_manage(space_id) or (is_active and exists(select 1 from public.f90_partner_spaces s where s.id=space_id and s.is_active)));
create policy partner_products_read on public.f90_partner_products for select to anon,authenticated using(f90_private.partner_manage(space_id) or (is_active and exists(select 1 from public.f90_partner_categories c join public.f90_partner_spaces s on s.id=c.space_id where c.id=category_id and c.space_id=f90_partner_products.space_id and c.is_active and s.is_active)));
create policy partner_banners_read on public.f90_partner_banners for select to anon,authenticated using(f90_private.partner_manage(space_id) or (is_active and exists(select 1 from public.f90_partner_spaces s where s.id=space_id and s.is_active)));
create policy partner_categories_write on public.f90_partner_categories for all to authenticated using(f90_private.partner_manage(space_id)) with check(f90_private.partner_manage(space_id));
create policy partner_products_write on public.f90_partner_products for all to authenticated using(f90_private.partner_manage(space_id)) with check(f90_private.partner_manage(space_id));
create policy partner_banners_write on public.f90_partner_banners for all to authenticated using(f90_private.partner_manage(space_id)) with check(f90_private.partner_manage(space_id));
grant select on public.f90_partner_spaces,public.f90_partner_categories,public.f90_partner_products,public.f90_partner_banners to anon,authenticated;
grant insert on public.f90_partner_spaces to authenticated;
grant update(name,is_active,collaboration_image,contacts) on public.f90_partner_spaces to authenticated;
grant insert,delete on public.f90_partner_categories,public.f90_partner_products,public.f90_partner_banners to authenticated;
grant update(name,image_path,sort_order,is_active) on public.f90_partner_categories to authenticated;
grant update(category_id,name,description,image_path,currency,price,purchase_url,sort_order,is_active) on public.f90_partner_products to authenticated;
grant update(title,image_path,placement,link_url,sort_order,is_active) on public.f90_partner_banners to authenticated;
create function f90_private.create_partner_space() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role='amin_card' then insert into public.f90_partner_spaces(owner_id) values(new.user_id) on conflict(owner_id) do nothing; end if;
 return new;
end;$$;
revoke all on function f90_private.create_partner_space() from public,anon,authenticated;
create trigger f90_partner_role after insert or update of role on public.f90_user_roles for each row execute function f90_private.create_partner_space();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('f90-partner-images','f90-partner-images',true,5242880,array['image/png','image/jpeg','image/webp','image/gif']) on conflict(id) do nothing;
create function f90_private.partner_path_manage(p_name text) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp|gif)$' then return false; end if;
 return f90_private.partner_manage(split_part(p_name,'/',1)::uuid);
exception when invalid_text_representation then return false;
end;$$;
revoke all on function f90_private.partner_path_manage(text) from public,anon;
grant execute on function f90_private.partner_path_manage(text) to authenticated;
create policy partner_media_read on storage.objects for select to authenticated using(bucket_id='f90-partner-images' and f90_private.partner_path_manage(name));
create policy partner_media_delete on storage.objects for delete to authenticated using(bucket_id='f90-partner-images' and f90_private.partner_path_manage(name));
-- Serialize all uploads to each space, including simultaneous uploads on two devices.
create function f90_private.partner_quota(p_name text,p_metadata jsonb) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare used_bytes bigint; incoming_bytes bigint; namespace text;
begin
 if not f90_private.partner_path_manage(p_name) then return false; end if;
 namespace:=split_part(p_name,'/',1);
 perform pg_advisory_xact_lock(hashtextextended('f90-partner-media:'||namespace,0));
 -- Reserve the full per-file limit until Storage supplies authoritative metadata.
 incoming_bytes:=coalesce((p_metadata->>'size')::bigint,5242880);
 if incoming_bytes<0 or incoming_bytes>5242880 then return false; end if;
 select coalesce(sum(coalesce((metadata->>'size')::bigint,5242880)),0) into used_bytes from storage.objects where bucket_id='f90-partner-images' and name like namespace||'/%';
 return used_bytes+incoming_bytes<=209715200;
end;$$;
revoke all on function f90_private.partner_quota(text,jsonb) from public,anon;
grant execute on function f90_private.partner_quota(text,jsonb) to authenticated;
create policy partner_media_insert on storage.objects for insert to authenticated with check(bucket_id='f90-partner-images' and f90_private.partner_quota(name,metadata));
create function f90_private.partner_usage(p_space uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not f90_private.partner_manage(p_space) then raise exception 'F90_FORBIDDEN'; end if;
 return jsonb_build_object('used_bytes',(select coalesce(sum(coalesce((metadata->>'size')::bigint,5242880)),0) from storage.objects where bucket_id='f90-partner-images' and name like p_space::text||'/%'),'limit_bytes',209715200,'image_limit_bytes',5242880,'active_products',(select count(*) from public.f90_partner_products where space_id=p_space and is_active),'inactive_products',(select count(*) from public.f90_partner_products where space_id=p_space and not is_active));
end;$$;
revoke all on function f90_private.partner_usage(uuid) from public,anon;
grant execute on function f90_private.partner_usage(uuid) to authenticated;
create function public.f90_partner_usage(p_space uuid) returns jsonb language sql stable security invoker set search_path='' as $$select f90_private.partner_usage(p_space);$$;
revoke all on function public.f90_partner_usage(uuid) from public,anon;
grant execute on function public.f90_partner_usage(uuid) to authenticated;
grant all on public.f90_partner_spaces,public.f90_partner_categories,public.f90_partner_products,public.f90_partner_banners to service_role;
commit;
