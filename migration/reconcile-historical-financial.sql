-- Operator review template. Inject only a fresh verified source/target snapshot
-- through a transaction-local setting. No checkout, supplier call, trigger disable,
-- RLS change or existing financial-record deletion is used.
do $reconcile$
declare p jsonb:=current_setting('f90.reconciliation_payload')::jsonb;s jsonb:=p->'source';t jsonb:=p->'target';
 missing_order_ids uuid[];missing_ledger_ids uuid[];affected uuid;prior numeric;desired numeric;delta numeric;
 alerts_before jsonb;mail_before jsonb;row_count_before integer;curr_seq bigint;seq_name text;
begin
 perform pg_advisory_xact_lock(hashtextextended('f90-historical-reconciliation-20261019',0));
 if (f90_private.cutover_readiness()->>'jobs_enabled')::integer<>0 or (f90_private.cutover_readiness()->>'yassen_enabled')::boolean or (f90_private.cutover_readiness()->>'active_orders')::integer<>0 then raise exception 'F90_TARGET_NOT_ISOLATED';end if;
 lock table public.f90_orders,public.f90_order_events,public.f90_wallet_ledger,public.f90_wallets,public.f90_deposits in share row exclusive mode;
 if (select jsonb_agg(to_jsonb(x) order by id) from public.f90_orders x) is distinct from t->'orders'
 or (select jsonb_agg(to_jsonb(x) order by id) from public.f90_order_events x) is distinct from t->'events'
 or (select jsonb_agg(to_jsonb(x) order by id) from public.f90_wallet_ledger x) is distinct from t->'ledger'
 or (select jsonb_agg(to_jsonb(x) order by user_id) from public.f90_wallets x) is distinct from t->'wallets'
 or (select jsonb_agg(to_jsonb(x) order by id) from public.f90_deposits x) is distinct from t->'deposits' then raise exception 'F90_TARGET_SNAPSHOT_CHANGED';end if;
 if exists(select 1 from jsonb_populate_recordset(null::public.f90_orders,s->'orders') a join public.f90_orders b using(id) where to_jsonb(a)<>to_jsonb(b))
 or exists(select 1 from jsonb_populate_recordset(null::public.f90_order_events,s->'events') a join public.f90_order_events b using(id) where to_jsonb(a)<>to_jsonb(b))
 or exists(select 1 from jsonb_populate_recordset(null::public.f90_wallet_ledger,s->'ledger') a join public.f90_wallet_ledger b using(id) where to_jsonb(a)<>to_jsonb(b))
 or exists(select 1 from jsonb_populate_recordset(null::public.f90_deposits,s->'deposits') a full join public.f90_deposits b using(id) where to_jsonb(a) is distinct from to_jsonb(b)) then raise exception 'F90_EXISTING_RECORD_CONFLICT';end if;
 select array_agg(a.id order by a.order_number) into missing_order_ids from jsonb_populate_recordset(null::public.f90_orders,s->'orders') a where not exists(select 1 from public.f90_orders b where b.id=a.id);
 if cardinality(missing_order_ids)<>2 or not exists(select 1 from jsonb_populate_recordset(null::public.f90_orders,s->'orders') a where a.id=missing_order_ids[1] and a.order_number=32 and a.status='completed' and a.total_usd=440 and a.refunded_usd=0 and a.fulfillment='manual')
 or not exists(select 1 from jsonb_populate_recordset(null::public.f90_orders,s->'orders') a where a.id=missing_order_ids[2] and a.order_number=33 and a.status='failed' and a.total_usd=440 and a.refunded_usd=440 and a.fulfillment='manual') then raise exception 'F90_UNREVIEWED_ORDER_DELTA';end if;
 select array_agg(a.id) into missing_ledger_ids from jsonb_populate_recordset(null::public.f90_wallet_ledger,s->'ledger') a where not exists(select 1 from public.f90_wallet_ledger b where b.id=a.id);
 if cardinality(missing_ledger_ids)<>3 or exists(select 1 from jsonb_populate_recordset(null::public.f90_wallet_ledger,s->'ledger') a where a.id=any(missing_ledger_ids) and not a.reference_id=any(missing_order_ids)) then raise exception 'F90_UNREVIEWED_LEDGER_DELTA';end if;
 select a.user_id into affected from jsonb_populate_recordset(null::public.f90_wallets,s->'wallets') a join public.f90_wallets b using(user_id) where a.balance_usd<>b.balance_usd;
 if (select count(*) from jsonb_populate_recordset(null::public.f90_wallets,s->'wallets') a join public.f90_wallets b using(user_id) where a.balance_usd<>b.balance_usd)<>1 then raise exception 'F90_UNREVIEWED_WALLET_DELTA';end if;
 select balance_usd into prior from public.f90_wallets where user_id=affected for update;
 select a.balance_usd into desired from jsonb_populate_recordset(null::public.f90_wallets,s->'wallets') a where a.user_id=affected;
 select sum(amount_usd) into delta from jsonb_populate_recordset(null::public.f90_wallet_ledger,s->'ledger') a where id=any(missing_ledger_ids) and user_id=affected;
 if delta<>-440 or prior+delta<>desired or desired<>(select sum(amount_usd) from jsonb_populate_recordset(null::public.f90_wallet_ledger,s->'ledger') a where user_id=affected) then raise exception 'F90_LEDGER_BALANCE_PROOF_FAILED';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') into alerts_before from public.f90_telegram_alerts x;
 select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') into mail_before from f90_private.deposit_email_queue x;
 select count(*) into row_count_before from public.f90_trader_commissions;
 insert into public.f90_orders overriding system value select a.* from jsonb_populate_recordset(null::public.f90_orders,s->'orders') a where a.id=any(missing_order_ids);
 insert into public.f90_order_events overriding system value select a.* from jsonb_populate_recordset(null::public.f90_order_events,s->'events') a where not exists(select 1 from public.f90_order_events b where b.id=a.id);
 insert into public.f90_wallet_ledger select a.* from jsonb_populate_recordset(null::public.f90_wallet_ledger,s->'ledger') a where a.id=any(missing_ledger_ids);
 update public.f90_wallets w set balance_usd=w.balance_usd+delta,updated_at=a.updated_at from jsonb_populate_recordset(null::public.f90_wallets,s->'wallets') a where w.user_id=affected and a.user_id=w.user_id and w.balance_usd=prior;
 if not found then raise exception 'F90_WALLET_COMPARE_AND_SWAP_FAILED';end if;
 -- Discard only notifications newly generated inside this uncommitted import.
 -- Existing notification rows remain byte-for-byte unchanged; workers are stopped.
 delete from public.f90_telegram_alerts a where event_key=any(array(select 'manual-order:'||x::text from unnest(missing_order_ids) x)) and not exists(select 1 from jsonb_array_elements(alerts_before) b where b->>'id'=a.id::text);
 if (select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from public.f90_telegram_alerts x)<>alerts_before
 or (select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') from f90_private.deposit_email_queue x)<>mail_before
 or (select count(*) from public.f90_trader_commissions)<>row_count_before then raise exception 'F90_NOTIFICATION_OR_COMMISSION_REPLAY';end if;
 if (select jsonb_agg(to_jsonb(x) order by id) from public.f90_orders x)<>s->'orders'
 or (select jsonb_agg(to_jsonb(x) order by id) from public.f90_order_events x)<>s->'events'
 or (select jsonb_agg(to_jsonb(x) order by id) from public.f90_wallet_ledger x)<>s->'ledger'
 or exists(select 1 from jsonb_populate_recordset(null::public.f90_wallets,s->'wallets') a left join public.f90_wallets b using(user_id) where to_jsonb(a) is distinct from to_jsonb(b))
 or exists(select 1 from jsonb_populate_recordset(null::public.f90_wallets,t->'wallets') a join public.f90_wallets b using(user_id) where a.user_id<>affected and to_jsonb(a)<>to_jsonb(b)) then raise exception 'F90_FINAL_PARITY_FAILED';end if;
 -- Keep identity sequences ahead without lowering an existing sequence.
 seq_name:=pg_get_serial_sequence('public.f90_orders','order_number');execute format('select last_value from %s',seq_name) into curr_seq;
 perform pg_catalog.setval(seq_name::regclass,greatest(curr_seq,(select max(order_number) from public.f90_orders)),true);
 seq_name:=pg_get_serial_sequence('public.f90_order_events','id');execute format('select last_value from %s',seq_name) into curr_seq;
 perform pg_catalog.setval(seq_name::regclass,greatest(curr_seq,(select max(id) from public.f90_order_events)),true);
 insert into public.f90_audit(action,target_id,details) values('migration.historical_reconciliation','cutover-20261019-orders32-33',jsonb_build_object('orders',2,'ledger_rows',3,'wallets_reconciled',1,'net_delta_usd',delta,'source_project','xzqnrpycjxfbyrfaolud','target_project','ogkipkavlywgwhtomoca','no_checkout',true,'no_supplier_dispatch',true,'no_historical_notifications',true));
end;$reconcile$;
