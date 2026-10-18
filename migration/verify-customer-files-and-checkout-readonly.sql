-- F90 CARD: read-only commercial cutover gate.
-- Execute separately against old and new Supabase. Outputs aggregates and SHA-like
-- non-reversible fingerprints only. Never output customer rows or private file names.
-- A match is a snapshot, NOT a guarantee of continuous replication.
WITH referenced_files AS (
  SELECT 'f90-receipts'::text AS bucket, receipt_path AS path FROM public.f90_deposits WHERE receipt_path IS NOT NULL AND trim(receipt_path) <> ''
  UNION ALL SELECT 'f90-receipts',receipt_path FROM public.f90_salary_requests WHERE receipt_path IS NOT NULL AND trim(receipt_path) <> ''
  UNION ALL SELECT 'f90-identity',front_path FROM public.f90_verifications WHERE front_path IS NOT NULL AND trim(front_path) <> ''
  UNION ALL SELECT 'f90-identity',back_path FROM public.f90_verifications WHERE back_path IS NOT NULL AND trim(back_path) <> ''
  UNION ALL SELECT 'f90-identity',selfie_path FROM public.f90_verifications WHERE selfie_path IS NOT NULL AND trim(selfie_path) <> ''
), data AS (
 SELECT
  (SELECT count(*) FROM auth.users) AS users,
  (SELECT count(*) FROM auth.identities) AS identities,
  (SELECT count(*) FROM public.profiles) AS profiles,
  (SELECT count(*) FROM public.f90_user_roles) AS roles,
  (SELECT count(*) FROM public.f90_wallets) AS wallets,
  (SELECT count(*) FROM public.f90_wallet_ledger) AS ledger,
  (SELECT count(*) FROM public.f90_orders) AS orders,
  (SELECT count(*) FROM public.f90_order_events) AS order_events,
  (SELECT count(*) FROM public.f90_deposits) AS deposits,
  (SELECT count(*) FROM public.products) AS products,
  (SELECT count(*) FROM public.f90_product_internal) AS internal_products,
  (SELECT count(*) FROM storage.objects WHERE bucket_id IN ('f90-identity','f90-receipts','f90-avatars')) AS original_customer_objects,
  (SELECT count(*) FROM referenced_files) AS original_file_references,
  (SELECT count(*) FROM referenced_files r JOIN storage.objects o ON o.bucket_id=r.bucket AND o.name=r.path) AS working_file_references,
  (SELECT md5(coalesce(string_agg(id::text||':'||coalesce(encrypted_password,''),'|' ORDER BY id::text),''))
      FROM auth.users) AS credentials_fingerprint,
  (SELECT md5(coalesce(string_agg(id::text||':'||user_id::text||':'||provider||':'||provider_id,'|' ORDER BY id::text),''))
      FROM auth.identities) AS identities_fingerprint,
  (SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),''))
      FROM public.f90_wallets t) AS wallets_fingerprint,
  (SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),''))
      FROM public.f90_wallet_ledger t) AS ledger_fingerprint,
  (SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),''))
      FROM public.f90_orders t) AS orders_fingerprint,
  (SELECT md5(coalesce(string_agg(id::text||':'||coalesce(price::text,'')||':'||
    coalesce(currency,'')||':'||coalesce(stock::text,''),'|' ORDER BY id::text),''))
      FROM public.products) AS commercial_price_fingerprint
)
SELECT * FROM data;
