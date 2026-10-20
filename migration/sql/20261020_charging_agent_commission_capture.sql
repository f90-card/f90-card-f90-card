-- Already applied on NEW Supabase 2026-10-20. Mirror for deployments.
-- Existing wallet settlement/FX/reversal mechanism is unchanged.
create or replace function f90_private.capture_trader_commission()
returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
 if tg_op='INSERT' then
 insert into public.f90_trader_commissions(order_id,customer_id,trader_id,percent)
 select new.id,new.user_id,r.trader_id,r.percent
 from public.f90_trader_referrals r
 join public.f90_user_roles ur on ur.user_id=r.trader_id
 join public.profiles p on p.id=r.trader_id
 where r.customer_id=new.user_id and r.percent>0 and r.effective_at<=new.created_at
 and ur.role in ('trader','charging_agent') and p.account_status='active'
 and (cardinality(r.product_ids)=0 or new.product_id=any(r.product_ids))
 on conflict(order_id) do nothing;
 end if;
 if new.status in ('completed','partial','failed','refunded') then
 perform f90_private.settle_trader_commission(new.id);
 end if;
 return new;
end;$function$;
