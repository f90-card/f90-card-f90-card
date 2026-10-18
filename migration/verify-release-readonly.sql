-- F90 CARD: READ-ONLY release check.
-- Run separately on source & target. Compare results; never print customer names, emails, hashes or passwords.
-- Source remains authoritative until writes are safely frozen before cutover.
select
 (select count(*) from auth.users) auth_users,
 (select count(*) from auth.identities) auth_identities,
 (select count(*) from public.profiles) profiles,
 (select count(*) from public.f90_user_roles) roles,
 (select count(*) from public.f90_wallets) wallets,
 (select count(*) from public.f90_wallet_ledger) wallet_ledger,
 (select count(*) from public.f90_orders) orders,
 (select count(*) from public.f90_order_events) order_events,
 (select count(*) from public.f90_deposits) deposits,
 (select count(*) from public.f90_salary_requests) salary_requests,
 (select count(*) from public.products) products,
 (select count(*) from public.f90_product_internal) product_internal,
 (select count(*) from public.categories) categories,
 (select count(*) from public.banners) banners,
 (select count(*) from public.f90_providers where is_enabled) suppliers_active,
 (select count(*) from storage.objects) files_stored,
 (select md5(coalesce(string_agg(id::text,',' order by id),''))
   from auth.users) auth_id_fingerprint,
 (select md5(coalesce(string_agg(user_id::text||':'||balance_usd::text,',' order by user_id),''))
   from public.f90_wallets) wallets_fingerprint,
 (select md5(coalesce(string_agg(id::text||':'||user_id::text||':'||amount_usd::text||':'||balance_after::text,',' order by id),''))
   from public.f90_wallet_ledger) wallet_ledger_fingerprint,
 (select md5(coalesce(string_agg(id::text||':'||coalesce(status,'')||':'||total_usd::text,',' order by id),''))
   from public.f90_orders) order_fingerprint,
 (select md5(coalesce(string_agg(id::text||':'||price::text||':'||currency||':'||stock::text,',' order by id),''))
   from public.products) product_price_fingerprint;
