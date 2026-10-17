-- Additive manual in-store verification and trusted supplier recipient label.
-- Does not change checkout pricing, wallet ledger, or supplier sync.

create or replace function public.f90_manual_verify_account(
  p_actor uuid,
  p_user uuid,
  p_reason text
) returns jsonb
language plpgsql
set search_path to ''
as $f90$
declare
  previous_status boolean;
  current_state text;
  reason text := btrim(coalesce(p_reason,''));
  saved jsonb;
begin
  perform f90_private.require_actor(p_actor, array['manager']);
  if p_actor = p_user then
    raise exception 'F90_SELF_VERIFICATION';
  end if;
  if length(reason) < 8 or length(reason) > 500 then
    raise exception 'F90_REASON_REQUIRED';
  end if;
  select p.is_verified,p.account_status
    into previous_status,current_state
    from public.profiles p
    where p.id=p_user for update;
  if not found then raise exception 'F90_NOT_FOUND'; end if;
  if current_state <> 'active' then raise exception 'F90_ACCOUNT_INACTIVE'; end if;
  if previous_status then raise exception 'F90_ALREADY_VERIFIED'; end if;

  update public.profiles set is_verified=true
  where id=p_user
  returning to_jsonb(profiles) into saved;

  insert into public.f90_audit(actor_id,action,target_id,details)
  values(p_actor,'account.manual_verification',p_user::text,
    jsonb_build_object('previous_verified',previous_status,
                       'verified',true,'reason',reason,
                       'method','manager_in_store_review'));
  return jsonb_build_object('id',p_user,'is_verified',true);
end;
$f90$;

revoke all on function public.f90_manual_verify_account(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.f90_manual_verify_account(uuid,uuid,text) to service_role;

alter table public.f90_orders
  add column if not exists supplier_account_name text
  check (supplier_account_name is null or char_length(supplier_account_name) between 2 and 120);
comment on column public.f90_orders.supplier_account_name is
  'Account nickname returned explicitly by the supplier order API; never inferred from ID.';
