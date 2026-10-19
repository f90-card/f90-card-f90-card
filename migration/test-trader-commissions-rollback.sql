-- Dedicated ephemeral identities only. Never commits or consumes order identities.
begin;
do $$
declare trader uuid:=gen_random_uuid();customer uuid:=gen_random_uuid();first_order uuid:=gen_random_uuid();second_order uuid:=gen_random_uuid();base_rate numeric;
begin
 if (f90_private.cutover_readiness()->>'jobs_enabled')::int<>0 then raise exception 'Test requires inactive migration target';end if;
 insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values(trader,'commission-'||trader||'@example.invalid','{"display_name":"Isolated commission test"}','{}'),(customer,'commission-'||customer||'@example.invalid','{"display_name":"Isolated customer test"}','{}');
 update public.f90_user_roles set role='trader' where user_id=trader;
 update public.profiles set account_currency='ILS' where id=trader;
 select per_usd into base_rate from public.f90_rates where currency='ILS' and is_enabled;
 if base_rate is null then raise exception 'ILS rate unavailable for test';end if;
 insert into public.f90_trader_referrals(customer_id,trader_id,percent,updated_by,effective_at) values(customer,trader,10,trader,now()-interval '1 second');
 insert into public.f90_orders(id,order_number,user_id,product_name,quantity,unit_quantity,subtotal_usd,total_usd,fulfillment,status,idempotency_key) overriding system value values(first_order,-9100001,customer,'Isolated commission test',1,1,100,100,'manual','pending','isolated-commission-first');
 if (select balance_usd from public.f90_wallets where user_id=trader)<>0 then raise exception 'Pending order credited commission';end if;
 update public.f90_orders set status='completed' where id=first_order;
 if (select balance_usd from public.f90_wallets where user_id=trader)<>10 then raise exception 'Wrong commission credit';end if;
 if (select amount_currency from public.f90_trader_commissions where order_id=first_order)<>round(10*base_rate,6) then raise exception 'Wrong FX snapshot';end if;
 update public.f90_orders set status='completed' where id=first_order;
 if (select count(*) from public.f90_wallet_ledger where user_id=trader)<>1 then raise exception 'Duplicate commission';end if;
 update public.f90_orders set status='partial',refunded_usd=50 where id=first_order;
 if (select balance_usd from public.f90_wallets where user_id=trader)<>5 then raise exception 'Partial refund not reconciled';end if;
 -- Simulate spending only this ephemeral account's earned commission.
 update public.f90_wallets set balance_usd=0 where user_id=trader;
 insert into public.f90_wallet_ledger(user_id,amount_usd,balance_after,kind,description,unique_key) values(trader,-5,0,'adjustment','Isolated simulated spend','isolated-spend:'||trader);
 update public.f90_orders set status='refunded',refunded_usd=100 where id=first_order;
 if (select amount_usd from public.f90_trader_commission_debts where trader_id=trader)<>5 then raise exception 'Refund debt not preserved';end if;
 insert into public.f90_orders(id,order_number,user_id,product_name,quantity,unit_quantity,subtotal_usd,total_usd,fulfillment,status,idempotency_key) overriding system value values(second_order,-9100002,customer,'Isolated commission second',1,1,200,200,'manual','completed','isolated-commission-second');
 if (select balance_usd from public.f90_wallets where user_id=trader)<>15 or (select amount_usd from public.f90_trader_commission_debts where trader_id=trader)<>0 then raise exception 'Future commission debt offset failed';end if;
 if exists(select 1 from public.f90_wallet_ledger where user_id=trader group by unique_key having count(*)>1) then raise exception 'Duplicate ledger reference';end if;
 if (select sum(amount_usd) from public.f90_wallet_ledger where user_id=trader)<>(select balance_usd from public.f90_wallets where user_id=trader) then raise exception 'Test wallet/ledger mismatch';end if;
end;$$;
select jsonb_build_object('dedicated_ephemeral_accounts',true,'pending_no_credit',true,'completion_credit',true,'duplicate_noop',true,'fx_snapshot',true,'partial_refund',true,'spent_commission_debt',true,'future_debt_offset',true,'ledger_parity',true,'transaction','ROLLBACK ONLY') as tests;
rollback;
