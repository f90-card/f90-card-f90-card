-- Applied to NEW Supabase ogkipkavlywgwhtomoca on 2026-10-20.
-- Keep merchant/trader accounts working while introducing a separate charging-agent role.
alter table public.f90_user_roles drop constraint if exists f90_user_roles_role_check;
alter table public.f90_user_roles add constraint f90_user_roles_role_check
check (role = any(array['customer','manager','admin','designer','trader','support','amin_card','charging_agent']));
create or replace function f90_private.set_trader_referral(p_customer uuid,p_trader uuid,p_percent numeric,p_products uuid[])
returns void language plpgsql security definer set search_path to ''
as $function$
begin
 if (select f90_private.my_role()) is distinct from 'manager' then raise exception 'F90_FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(909008);
 if p_customer=p_trader or p_percent is null or p_percent<0 or p_percent>100 then raise exception 'F90_FIELDS'; end if;
 if not exists(select 1 from public.profiles where id=p_customer and account_status='active')
 or not exists(select 1 from public.profiles p join public.f90_user_roles r on r.user_id=p.id
 where p.id=p_trader and p.account_status='active' and r.role in ('charging_agent','trader'))
 then raise exception 'F90_FORBIDDEN'; end if;
 if cardinality(coalesce(p_products,'{}'))>1000
 or exists(select 1 from unnest(coalesce(p_products,'{}')) i where not exists(select 1 from public.products where id=i))
 then raise exception 'F90_FIELDS'; end if;
 if exists(with recursive chain(id,path) as(select p_trader,array[p_trader] union all
 select r.trader_id,c.path||r.trader_id from chain c join public.f90_trader_referrals r on r.customer_id=c.id
 where r.percent>0 and not r.trader_id=any(c.path)) select 1 from chain where id=p_customer)
 then raise exception 'F90_REFERRAL_CYCLE'; end if;
 insert into public.f90_trader_referrals(customer_id,trader_id,percent,product_ids,updated_by)
 values(p_customer,p_trader,p_percent,coalesce(p_products,'{}'),auth.uid())
 on conflict(customer_id) do update set trader_id=excluded.trader_id,percent=excluded.percent,
 product_ids=excluded.product_ids,effective_at=now(),updated_by=excluded.updated_by;
 insert into public.f90_audit(actor_id,action,target_id,details)
 values(auth.uid(),'trader.referral',p_customer::text,
 jsonb_build_object('agent',p_trader,'percent',p_percent,'products',p_products));
end;$function$;
