begin;
create table public.f90_trader_referrals (
 customer_id uuid primary key references public.profiles(id),trader_id uuid not null references public.profiles(id),
 percent numeric(7,4) not null check(percent between 0 and 100),product_ids uuid[] not null default '{}',
 effective_at timestamptz not null default now(),updated_by uuid not null references public.profiles(id),
 check(customer_id<>trader_id)
);
create index on public.f90_trader_referrals(trader_id);
create table public.f90_trader_commissions (
 order_id uuid primary key references public.f90_orders(id),customer_id uuid not null references public.profiles(id),
 trader_id uuid not null references public.profiles(id),percent numeric(7,4) not null check(percent between 0 and 100),
 earned_usd numeric(20,6) not null default 0 check(earned_usd>=0),revision integer not null default 0,
 account_currency text,rate_snapshot numeric(20,8),amount_currency numeric(20,6),
 last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index on public.f90_trader_commissions(trader_id,created_at);
create table public.f90_trader_commission_debts (
 trader_id uuid primary key references public.profiles(id),amount_usd numeric(20,6) not null default 0 check(amount_usd>=0)
);
create table public.f90_trader_commission_events (
 order_id uuid not null references public.f90_trader_commissions(order_id),revision integer not null,
 trader_id uuid not null references public.profiles(id),earned_delta_usd numeric(20,6) not null,
 wallet_delta_usd numeric(20,6) not null,debt_delta_usd numeric(20,6) not null,
 created_at timestamptz not null default now(),primary key(order_id,revision)
);
alter table public.f90_trader_referrals enable row level security;
alter table public.f90_trader_commissions enable row level security;
alter table public.f90_trader_commission_debts enable row level security;
alter table public.f90_trader_commission_events enable row level security;
create policy trader_referrals_read on public.f90_trader_referrals for select to authenticated using((select f90_private.my_role())='manager' or trader_id=(select auth.uid()));
create policy trader_commissions_read on public.f90_trader_commissions for select to authenticated using((select f90_private.my_role())='manager' or trader_id=(select auth.uid()));
create policy trader_commission_debts_read on public.f90_trader_commission_debts for select to authenticated using((select f90_private.my_role())='manager' or trader_id=(select auth.uid()));
create policy trader_commission_events_read on public.f90_trader_commission_events for select to authenticated using((select f90_private.my_role())='manager' or trader_id=(select auth.uid()));
grant select on public.f90_trader_referrals,public.f90_trader_commissions,public.f90_trader_commission_debts,public.f90_trader_commission_events to authenticated;
grant all on public.f90_trader_referrals,public.f90_trader_commissions,public.f90_trader_commission_debts,public.f90_trader_commission_events to service_role;
create function f90_private.set_trader_referral(p_customer uuid,p_trader uuid,p_percent numeric,p_products uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select f90_private.my_role()) is distinct from 'manager' then raise exception 'F90_FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(909008);
 if p_customer=p_trader or p_percent is null or p_percent<0 or p_percent>100 then raise exception 'F90_FIELDS'; end if;
 if not exists(select 1 from public.profiles where id=p_customer and account_status='active') or not exists(select 1 from public.profiles p join public.f90_user_roles r on r.user_id=p.id where p.id=p_trader and p.account_status='active' and r.role='trader') then raise exception 'F90_FORBIDDEN'; end if;
 if cardinality(coalesce(p_products,'{}'))>1000 or exists(select 1 from unnest(coalesce(p_products,'{}')) i where not exists(select 1 from public.products where id=i)) then raise exception 'F90_FIELDS'; end if;
 if exists(with recursive chain(id,path) as(select p_trader,array[p_trader] union all select r.trader_id,c.path||r.trader_id from chain c join public.f90_trader_referrals r on r.customer_id=c.id where r.percent>0 and not r.trader_id=any(c.path)) select 1 from chain where id=p_customer) then raise exception 'F90_REFERRAL_CYCLE'; end if;
 insert into public.f90_trader_referrals(customer_id,trader_id,percent,product_ids,updated_by) values(p_customer,p_trader,p_percent,coalesce(p_products,'{}'),auth.uid()) on conflict(customer_id) do update set trader_id=excluded.trader_id,percent=excluded.percent,product_ids=excluded.product_ids,effective_at=now(),updated_by=excluded.updated_by;
 insert into public.f90_audit(actor_id,action,target_id,details) values(auth.uid(),'trader.referral',p_customer::text,jsonb_build_object('trader',p_trader,'percent',p_percent,'products',p_products));
end;$$;
revoke all on function f90_private.set_trader_referral(uuid,uuid,numeric,uuid[]) from public,anon;
grant execute on function f90_private.set_trader_referral(uuid,uuid,numeric,uuid[]) to authenticated;
create function public.f90_set_trader_referral(p_customer uuid,p_trader uuid,p_percent numeric,p_products uuid[] default '{}') returns void language sql security invoker set search_path='' as $$select f90_private.set_trader_referral(p_customer,p_trader,p_percent,p_products);$$;
revoke all on function public.f90_set_trader_referral(uuid,uuid,numeric,uuid[]) from public,anon;
grant execute on function public.f90_set_trader_referral(uuid,uuid,numeric,uuid[]) to authenticated;
create function f90_private.settle_trader_commission(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.f90_orders%rowtype;c public.f90_trader_commissions%rowtype; target_amount numeric;delta numeric;bal numeric;debt numeric;wallet_delta numeric;debt_delta numeric;currency_code text;rate numeric;new_revision integer;
begin
 select * into o from public.f90_orders where id=p_order;
 select * into c from public.f90_trader_commissions where order_id=p_order for update;
 if not found then return; end if;
 target_amount:=case when o.status in ('completed','partial') then round(greatest(o.total_usd-o.refunded_usd,0)*c.percent/100,6) else 0 end;
 delta:=target_amount-c.earned_usd;
 if delta=0 then return; end if;
 select account_currency into currency_code from public.profiles where id=c.trader_id;
 if currency_code='USD' then rate:=1;else select per_usd into rate from public.f90_rates where currency=currency_code and is_enabled;end if;
 if rate is null or rate<=0 then update public.f90_trader_commissions set last_error='F90_RATE_MISSING' where order_id=p_order;return;end if;
 select balance_usd into bal from public.f90_wallets where user_id=c.trader_id for update;
 if not found then raise exception 'F90_WALLET_MISSING'; end if;
 insert into public.f90_trader_commission_debts(trader_id) values(c.trader_id) on conflict do nothing;
 select amount_usd into debt from public.f90_trader_commission_debts where trader_id=c.trader_id for update;
 if delta>0 then debt_delta:=-least(debt,delta);wallet_delta:=delta+debt_delta;
 else wallet_delta:=-least(bal,-delta);debt_delta:=-delta+wallet_delta;end if;
 new_revision:=c.revision+1;
 if wallet_delta<>0 then
 update public.f90_wallets set balance_usd=balance_usd+wallet_delta,updated_at=now() where user_id=c.trader_id returning balance_usd into bal;
 insert into public.f90_wallet_ledger(user_id,amount_usd,balance_after,kind,reference_id,description,unique_key) values(c.trader_id,wallet_delta,bal,'adjustment',p_order,case when wallet_delta>0 then 'عمولة شراء عميل تابع لك' else 'عكس عمولة طلب مسترد' end,'trader_commission:'||p_order::text||':'||new_revision);
 end if;
 update public.f90_trader_commission_debts set amount_usd=amount_usd+debt_delta where trader_id=c.trader_id;
 insert into public.f90_trader_commission_events(order_id,revision,trader_id,earned_delta_usd,wallet_delta_usd,debt_delta_usd) values(p_order,new_revision,c.trader_id,delta,wallet_delta,debt_delta);
 update public.f90_trader_commissions set earned_usd=target_amount,revision=new_revision,account_currency=currency_code,rate_snapshot=rate,amount_currency=round(target_amount*rate,6),last_error=null,updated_at=now() where order_id=p_order;
end;$$;
revoke all on function f90_private.settle_trader_commission(uuid) from public,anon,authenticated;
create function f90_private.capture_trader_commission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
 insert into public.f90_trader_commissions(order_id,customer_id,trader_id,percent)
 select new.id,new.user_id,r.trader_id,r.percent from public.f90_trader_referrals r join public.f90_user_roles ur on ur.user_id=r.trader_id join public.profiles p on p.id=r.trader_id
 where r.customer_id=new.user_id and r.percent>0 and r.effective_at<=new.created_at and ur.role='trader' and p.account_status='active' and (cardinality(r.product_ids)=0 or new.product_id=any(r.product_ids))
 on conflict(order_id) do nothing;
 end if;
 if new.status in ('completed','partial','failed','refunded') then perform f90_private.settle_trader_commission(new.id);end if;
 return new;
end;$$;
revoke all on function f90_private.capture_trader_commission() from public,anon,authenticated;
create trigger f90_trader_commission_insert after insert on public.f90_orders for each row execute function f90_private.capture_trader_commission();
create trigger f90_trader_commission_update after update of status,refunded_usd,total_usd on public.f90_orders for each row execute function f90_private.capture_trader_commission();
commit;
