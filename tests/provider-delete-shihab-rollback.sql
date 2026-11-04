-- Production-shaped dry run: all catalog/order changes rolled back; no HTTP.
-- Test the server role and real FK shape; PostgREST keeps its safeupdate guard.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
do $$
declare supplier uuid; actor uuid; before_products integer; before_orders text;
 before_wallets text; before_others text; before_cache integer;
begin
 select id into supplier from public.f90_providers where adapter='shihab' and endpoint='https://api.shihabcard.com';
 if supplier is null then raise exception 'Shihab fixture unavailable'; end if;
 select ur.user_id into strict actor from public.f90_user_roles ur join public.profiles p on p.id=ur.user_id
 where ur.role='manager' and p.account_status='active' order by ur.user_id limit 1;
 select count(*) into before_products from public.f90_product_internal where provider_id=supplier;
 select count(*) into before_cache from f90_private.shihab_catalog_source;
 select md5(coalesce(string_agg(to_jsonb(w)::text,'' order by user_id),'')) into before_wallets from public.f90_wallets w;
 select md5(coalesce(string_agg((to_jsonb(o)-'provider_id'-'product_id'-'deleted_provider_snapshot')::text,'' order by id),'')) into before_orders from public.f90_orders o;
 select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by id),'')) into before_others from public.products p
 where not exists(select 1 from public.f90_product_internal i where i.product_id=p.id and i.provider_id=supplier);
 execute 'set local role service_role';
 perform public.f90_archive_provider(actor,supplier);
 if exists(select 1 from public.f90_providers where id=supplier)
 or exists(select 1 from public.f90_product_internal where provider_id=supplier)
 or exists(select 1 from f90_private.shihab_catalog_source) then raise exception 'Incomplete supplier/catalog/cache removal'; end if;
 if (select md5(coalesce(string_agg(to_jsonb(w)::text,'' order by user_id),'')) from public.f90_wallets w)<>before_wallets
 or (select md5(coalesce(string_agg((to_jsonb(o)-'provider_id'-'product_id'-'deleted_provider_snapshot')::text,'' order by id),'')) from public.f90_orders o)<>before_orders
 or (select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by id),'')) from public.products p)<>before_others
 then raise exception 'Financial/history/other catalog changed'; end if;
 raise notice 'PASS: % linked products, % cached services; service_role + scoped cleanup; history/wallet/other products intact; rolling back',before_products,before_cache;
end $$;
rollback;
select jsonb_build_object('provider_restored',exists(select 1 from public.f90_providers where adapter='shihab'),
 'services_restored',(select count(*) from public.f90_product_internal i join public.f90_providers p on p.id=i.provider_id where p.adapter='shihab'),
 'cache_restored',(select count(*) from f90_private.shihab_catalog_source)) rollback_verification;
