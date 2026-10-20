-- Deployed to new Supabase project ogkipkavlywgwhtomoca on 2026-10-20.
-- Safe staged foundation only. Tiers default disabled; production quote/checkout
-- MUST consult the same tier calculator before the feature may be enabled.
create table if not exists public.f90_quantity_price_tiers (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 min_quantity bigint not null check(min_quantity>=1),
 max_quantity bigint not null check(max_quantity>=min_quantity),
 unit_price numeric(20,8) not null check(unit_price>=0),
 currency text not null check(currency in ('USD','ILS','JOD','EGP','EUR')),
 is_active boolean not null default false,
 created_at timestamptz not null default now(),
 unique(product_id,min_quantity,max_quantity)
);
create index if not exists f90_quantity_price_tiers_product_idx on public.f90_quantity_price_tiers(product_id);
alter table public.f90_quantity_price_tiers enable row level security;
revoke all on public.f90_quantity_price_tiers from anon,authenticated;
grant select,insert,update,delete on public.f90_quantity_price_tiers to service_role;
create or replace function public.f90_quantity_tier_price(p_product uuid,p_quantity bigint)
returns table(unit_price numeric,currency text,matched boolean)
language sql stable security invoker set search_path=public
as $$
 select t.unit_price,t.currency,true from public.f90_quantity_price_tiers t
 where t.product_id=p_product and t.is_active and p_quantity between t.min_quantity and t.max_quantity
 order by t.min_quantity desc limit 1
$$;
revoke all on function public.f90_quantity_tier_price(uuid,bigint) from public,anon,authenticated;
grant execute on function public.f90_quantity_tier_price(uuid,bigint) to service_role;
create or replace function f90_private.f90_tier_guard()
returns trigger language plpgsql security invoker set search_path=public
as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.product_id::text,0));
 if exists(
 select 1 from public.f90_quantity_price_tiers t
 where t.product_id=new.product_id and t.id<>new.id and t.is_active and new.is_active
 and t.min_quantity<=new.max_quantity and t.max_quantity>=new.min_quantity
 ) then raise exception 'F90_TIER_OVERLAP'; end if;
 return new;
end
$$;
drop trigger if exists f90_tier_guard on public.f90_quantity_price_tiers;
create trigger f90_tier_guard before insert or update on public.f90_quantity_price_tiers
for each row execute function f90_private.f90_tier_guard();
