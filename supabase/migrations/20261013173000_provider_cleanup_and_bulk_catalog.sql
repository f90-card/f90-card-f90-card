-- Keep historical order snapshots while removing a supplier and its catalog.
create or replace function public.f90_archive_provider(p_actor uuid, p_provider uuid)
returns boolean language plpgsql set search_path = '' as $$
declare old_secret uuid;
begin
  perform f90_private.require_actor(p_actor, array['manager']);
  select secret_id into old_secret from public.f90_providers
  where id = p_provider for update;
  if not found then raise exception 'F90_NOT_FOUND'; end if;

  delete from public.products
  where id in (select product_id from public.f90_product_internal
               where provider_id = p_provider);

  if exists (select 1 from public.f90_orders where provider_id = p_provider) then
    update public.f90_providers
    set is_enabled = false, secret_id = null,
        config = coalesce(config, '{}'::jsonb) ||
          jsonb_build_object('archived_at', now()::text,
                             'automatic_orders_enabled', false)
    where id = p_provider;
  else
    delete from public.f90_providers where id = p_provider;
  end if;
  if old_secret is not null then delete from vault.secrets where id = old_secret; end if;
  return true;
end $$;

create or replace function public.f90_bulk_products(
  p_actor uuid, p_ids uuid[], p_mode text, p_value text default null
) returns integer language plpgsql set search_path = '' as $$
declare matched integer; changed integer;
begin
  perform f90_private.require_actor(p_actor, array['manager','designer']);
  if coalesce(array_length(p_ids, 1), 0) not between 1 and 1000
     or p_mode not in ('show', 'hide', 'move', 'image', 'delete')
     or exists (select 1 from unnest(p_ids) x where x is null)
     or (select count(distinct x) from unnest(p_ids) x) <> array_length(p_ids, 1)
    then raise exception 'F90_FIELDS'; end if;
  select count(*) into matched from public.products where id = any(p_ids);
  if matched <> array_length(p_ids, 1) then raise exception 'F90_NOT_FOUND'; end if;

  if p_mode = 'move' then
    if not exists (select 1 from public.categories where id = p_value::uuid)
      then raise exception 'F90_FIELDS'; end if;
    update public.products set category_id = p_value::uuid where id = any(p_ids);
  elsif p_mode = 'image' then
    if length(coalesce(p_value, '')) > 2000 or
       (coalesce(p_value, '') <> '' and p_value !~ '^(https://|\./assets/)')
      then raise exception 'F90_FIELDS'; end if;
    update public.products set image_url = coalesce(p_value, '') where id = any(p_ids);
  elsif p_mode = 'show' then
    update public.products set is_active = true where id = any(p_ids);
  elsif p_mode = 'hide' then
    update public.products set is_active = false where id = any(p_ids);
  elsif p_mode = 'delete' then
    delete from public.products where id = any(p_ids);
  end if;
  get diagnostics changed = row_count;
  insert into public.f90_audit(actor_id,action,details)
    values (p_actor, 'catalog.bulk_' || p_mode,
            jsonb_build_object('count', changed, 'ids', to_jsonb(p_ids)));
  return changed;
end $$;
revoke all on function public.f90_bulk_products(uuid,uuid[],text,text) from public, anon, authenticated;
grant execute on function public.f90_bulk_products(uuid,uuid[],text,text) to service_role;
