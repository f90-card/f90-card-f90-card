-- A draft may only become public after a manager approves the exact catalog
-- content and price currently stored. Existing published items stay published.
create table if not exists f90_private.smm_approvals (
 product_id uuid primary key references public.products(id) on delete cascade,
 approved_by uuid not null,
 fingerprint text not null,
 approved_at timestamptz not null default now()
);
revoke all on f90_private.smm_approvals from public,anon,authenticated;
grant select,insert,update on f90_private.smm_approvals to service_role;

create or replace function f90_private.smm_fingerprint(p public.products)
returns text language sql immutable set search_path='' as $$
 select md5(row(p.name,p.description,p.category_id,p.price,p.commerce,p.image_url)::text) $$;

create or replace function public.f90_smm_approve(p_product uuid,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.products%rowtype;
begin
 select item.* into p from public.products item join public.f90_product_internal i
  on i.product_id=item.id where item.id=p_product and
  i.provider_id='c0e80eb6-7079-4071-8310-4c013614ffd5'::uuid;
 if not found or p.is_active then raise exception 'SMM draft not found'; end if;
 insert into f90_private.smm_approvals(product_id,approved_by,fingerprint,approved_at)
 values(p.id,p_actor,f90_private.smm_fingerprint(p),now())
 on conflict(product_id) do update set approved_by=excluded.approved_by,
  fingerprint=excluded.fingerprint,approved_at=excluded.approved_at;
 return jsonb_build_object('approved',true,'product_id',p.id);
end $$;

create or replace function f90_private.smm_publication_gate()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.is_active and not old.is_active and exists(
    select 1 from public.f90_product_internal i where i.product_id=new.id
      and i.provider_id='c0e80eb6-7079-4071-8310-4c013614ffd5'::uuid)
    and not exists(select 1 from f90_private.smm_approvals a where a.product_id=new.id
      and a.fingerprint=f90_private.smm_fingerprint(new)) then
   raise exception 'SMM draft requires a manager review of the current product and price';
 end if;
 return new;
end $$;
drop trigger if exists f90_smm_publication_gate on public.products;
create trigger f90_smm_publication_gate before update of is_active on public.products
for each row execute function f90_private.smm_publication_gate();
revoke all on function public.f90_smm_approve(uuid,uuid) from public,anon,authenticated;
grant execute on function public.f90_smm_approve(uuid,uuid) to service_role;
