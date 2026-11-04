-- Permanent catalog removal; retain financial records and supplier references.
alter table public.f90_orders add column if not exists deleted_provider_snapshot jsonb;

create or replace function public.f90_archive_provider(p_actor uuid, p_provider uuid)
returns boolean language plpgsql set search_path='' as $$
declare supplier public.f90_providers%rowtype; removed integer; history integer;
begin
  perform f90_private.require_actor(p_actor, array['manager']);
  select * into supplier from public.f90_providers where id=p_provider for update;
  -- A repeated confirmed request is safe and never affects another provider.
  if not found then return true; end if;

  perform id from public.products where id in
    (select product_id from public.f90_product_internal where provider_id=p_provider)
    order by id for update;
  perform id from public.f90_orders where provider_id=p_provider or product_id in
    (select product_id from public.f90_product_internal where provider_id=p_provider)
    order by id for update;
  if exists(select 1 from public.f90_orders where
    (provider_id=p_provider or product_id in
      (select product_id from public.f90_product_internal where provider_id=p_provider))
    and status not in ('completed','partial','failed','refunded')) then
    raise exception 'F90_PROVIDER_ACTIVE_ORDERS';
  end if;

  update public.f90_orders set
    deleted_provider_snapshot=jsonb_build_object('id',supplier.id,'name',supplier.name,
      'adapter',supplier.adapter,'currency',supplier.currency,'deleted_at',now()),
    provider_id=null
    where provider_id=p_provider;
  get diagnostics history=row_count;
  delete from public.products where id in
    (select product_id from public.f90_product_internal where provider_id=p_provider);
  get diagnostics removed=row_count;
  -- Remove staged imports too, so background import cannot recreate the catalog.
  delete from f90_private.smm_source where provider_id=p_provider;
  delete from public.f90_providers where id=p_provider;
  if supplier.adapter='shihab' and not exists
    (select 1 from public.f90_providers where adapter='shihab') then
    delete from f90_private.shihab_catalog_source;
  end if;
  if supplier.secret_id is not null and not exists
    (select 1 from public.f90_providers where secret_id=supplier.secret_id) then
    delete from vault.secrets where id=supplier.secret_id;
  end if;
  insert into public.f90_audit(actor_id,action,target_id,details)
  values(p_actor,'provider.delete',p_provider::text,jsonb_build_object(
    'name',supplier.name,'products_deleted',removed,'orders_preserved',history));
  return true;
end $$;
revoke all on function public.f90_archive_provider(uuid,uuid) from public,anon,authenticated;
grant execute on function public.f90_archive_provider(uuid,uuid) to service_role;
