-- F90 Card: read-only, production-safe integrity diagnostics.
-- Never modifies wallets, orders, deposits or provider records.
-- A zero count means no CURRENT rows violate the particular predicate;
-- it is NOT proof of correct concurrency behaviour or business logic.
select 'negative_wallets' as check_name, count(*)::integer as findings
from public.f90_wallets where balance_usd < 0
union all
select 'duplicate_order_references', count(*)::integer
from (select user_id,idempotency_key from public.f90_orders
      group by user_id,idempotency_key having count(*) > 1) x
union all
select 'duplicate_deposit_references', count(*)::integer
from (select user_id,idempotency_key from public.f90_deposits
      group by user_id,idempotency_key having count(*) > 1) x
union all
select 'invalid_deposit_amounts', count(*)::integer
from public.f90_deposits where amount <= 0 or usd_amount <= 0
union all
select 'negative_order_totals', count(*)::integer
from public.f90_orders where total_usd < 0
union all
select 'orphan_provider_links', count(*)::integer
from public.f90_product_internal i where provider_id is not null
and not exists(select 1 from public.f90_providers p where p.id=i.provider_id);
