-- Staging-only source-authoritative pricing sync. Payload stays outside GitHub.
-- Caller sets transaction-local f90.catalog_payload to reviewed source/target rows.
begin;
lock table public.products,public.f90_product_internal,public.f90_rates,public.f90_store_news,public.f90_notification_outbox in share row exclusive mode;
create temporary table f90_catalog_old_news on commit drop as select * from public.f90_store_news;
create temporary table f90_catalog_old_outbox on commit drop as select * from public.f90_notification_outbox;
do $f90$
declare payload jsonb:=current_setting('f90.catalog_payload')::jsonb;r jsonb;n int;images_before jsonb;finance_before text;
begin
 if (f90_private.cutover_readiness()->>'jobs_enabled')::int<>0 or (f90_private.cutover_readiness()->>'yassen_enabled')::boolean then raise exception 'F90_TARGET_NOT_ISOLATED';end if;
 if exists(select 1 from public.f90_orders where status in('queued','submitting','processing','review')) then raise exception 'F90_TARGET_ACTIVE_ORDERS';end if;
 if (select jsonb_agg(to_jsonb(x) order by currency) from public.f90_rates x) is distinct from payload->'rates' then raise exception 'F90_RATE_CHANGED';end if;
 select jsonb_agg(jsonb_build_object('id',id,'image',image_url,'gallery',gallery) order by id) into images_before from public.products;
 select md5(jsonb_build_object('wallets',(select jsonb_agg(to_jsonb(x) order by user_id) from public.f90_wallets x),'ledger',(select jsonb_agg(to_jsonb(x) order by id) from public.f90_wallet_ledger x),'orders',(select jsonb_agg(to_jsonb(x) order by id) from public.f90_orders x),'deposits',(select jsonb_agg(to_jsonb(x) order by id) from public.f90_deposits x))::text) into finance_before;
 for r in select value from jsonb_array_elements(payload->'products') loop
  if not exists(select 1 from public.products x where id=(r->>'id')::uuid and price is not distinct from (r#>>'{target,price}')::numeric and commerce is not distinct from r#>'{target,commerce}') then raise exception 'F90_TARGET_CATALOG_CHANGED';end if;
  update public.products set price=(r#>>'{source,price}')::numeric,commerce=r#>'{source,commerce}' where id=(r->>'id')::uuid;
  get diagnostics n=row_count;if n<>1 then raise exception 'F90_PRODUCT_NOT_FOUND';end if;
 end loop;
 for r in select value from jsonb_array_elements(payload->'internal') loop
  if not exists(select 1 from public.f90_product_internal x where product_id=(r->>'product_id')::uuid and to_jsonb(x)=r->'target') then raise exception 'F90_TARGET_INTERNAL_CHANGED';end if;
  update public.f90_product_internal set cost_usd=(r#>>'{source,cost_usd}')::numeric where product_id=(r->>'product_id')::uuid;
 end loop;
 -- Migration imports must not publish price announcements already made by source.
 -- Delete only rows produced inside this uncommitted transaction; old queues unchanged.
 delete from public.f90_notification_outbox x where not exists(select 1 from f90_catalog_old_outbox y where y.id=x.id);
 delete from public.f90_store_news x where not exists(select 1 from f90_catalog_old_news y where y.id=x.id);
 if exists((select * from public.f90_notification_outbox except select * from f90_catalog_old_outbox) union all (select * from f90_catalog_old_outbox except select * from public.f90_notification_outbox)) then raise exception 'F90_OUTBOX_CHANGED';end if;
 if exists((select * from public.f90_store_news except select * from f90_catalog_old_news) union all (select * from f90_catalog_old_news except select * from public.f90_store_news)) then raise exception 'F90_NEWS_CHANGED';end if;
 if images_before is distinct from (select jsonb_agg(jsonb_build_object('id',id,'image',image_url,'gallery',gallery) order by id) from public.products) then raise exception 'F90_MEDIA_CHANGED';end if;
 if finance_before is distinct from (select md5(jsonb_build_object('wallets',(select jsonb_agg(to_jsonb(x) order by user_id) from public.f90_wallets x),'ledger',(select jsonb_agg(to_jsonb(x) order by id) from public.f90_wallet_ledger x),'orders',(select jsonb_agg(to_jsonb(x) order by id) from public.f90_orders x),'deposits',(select jsonb_agg(to_jsonb(x) order by id) from public.f90_deposits x))::text)) then raise exception 'F90_FINANCE_CHANGED';end if;
 insert into public.f90_audit(actor_id,action,details) values(null,'migration.current_catalog_sync',jsonb_build_object('products',jsonb_array_length(payload->'products'),'costs',jsonb_array_length(payload->'internal'),'rates_changed',false,'media_changed',false,'notifications_replayed',false));
end $f90$;
commit;
