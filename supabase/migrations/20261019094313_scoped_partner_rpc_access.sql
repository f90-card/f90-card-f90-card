-- Wrappers are executable only by authenticated callers; private helpers verify
-- the live session/role and ownership before returning data or changing a referral.
-- Do not grant schema-wide access to f90_private.
alter function public.f90_partner_usage(uuid) security definer;
alter function public.f90_set_trader_referral(uuid,uuid,numeric,uuid[]) security definer;
revoke all on function public.f90_partner_usage(uuid),public.f90_set_trader_referral(uuid,uuid,numeric,uuid[]) from public,anon;
grant execute on function public.f90_partner_usage(uuid),public.f90_set_trader_referral(uuid,uuid,numeric,uuid[]) to authenticated;
