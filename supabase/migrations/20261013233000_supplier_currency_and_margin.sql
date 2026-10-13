-- Apply a margin to linked products atomically using their last known supplier cost.
create or replace function public.f90_provider_margin(
  p_actor uuid, p_provider uuid, p_margin numeric
) returns integer language plpgsql set search_path = '' as $$
declare affected integer;
begin
  perform f90_private.require_actor(p_actor, array['manager']);
  if p_margin is null or p_margin < 0 or p_margin > 10000
    then raise exception 'F90_FIELDS'; end if;
  perform 1 from public.f90_providers
  where id = p_provider and (config->>'archived_at') is null for update;
  if not found then raise exception 'F90_NOT_FOUND'; end if;
  if exists (
    select 1 from public.f90_product_internal i
    where i.provider_id = p_provider and i.auto_margin and i.cost_usd is not null
      and (i.cost_usd <= 0 or
           round(i.cost_usd * (1 + p_margin / 100), 6) <= 0 or
           round(i.cost_usd * (1 + p_margin / 100), 6) > 1000000)
  ) then raise exception 'F90_FIELDS'; end if;

  update public.products p
  set price = round(i.cost_usd * (1 + p_margin / 100), 6),
      commerce = jsonb_set(coalesce(p.commerce, '{}'::jsonb),
        '{prices,USD}', to_jsonb(round(i.cost_usd * (1 + p_margin / 100), 6)), true)
  from public.f90_product_internal i
  where i.product_id = p.id and i.provider_id = p_provider and i.auto_margin and i.cost_usd is not null;
  get diagnostics affected = row_count;
  update public.f90_providers set margin_percent = p_margin where id = p_provider;
  insert into public.f90_audit(actor_id, action, target_id, details)
    values (p_actor, 'provider.margin', p_provider,
      jsonb_build_object('margin_percent', p_margin, 'updated', affected));
  return affected;
end $$;
revoke all on function public.f90_provider_margin(uuid,uuid,numeric) from public, anon, authenticated;
grant execute on function public.f90_provider_margin(uuid,uuid,numeric) to service_role;
