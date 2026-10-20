# F90 CARD — security, backup and migration closure review (2026-10-20)

## Decision
**Migration operational, but formal closure is BLOCKED pending an independently restorable new-database backup and completion of targeted financial security verification.** Do not delete/stop legacy Supabase or Vercel. Owner confirmed functional acceptance of purchase, deposit, product changes, Telegram, authentication and storefront. Deposit email notification intentionally disabled; Telegram is preferred. This document does not replace a tested restore.

## Verified production
- Cloudflare Pages controls f90card.online and www.f90card.online, both TLS active at the last verified DNS readback. New Supabase project: ogkipkavlywgwhtomoca.
- New project reported ACTIVE_HEALTHY by project API.
- New project snapshot counts: 601 products, 24 wallets with aggregate USD balance 46322.955049, 30 orders, 12 deposits, 61 wallet ledger items, 24 profiles. Old project: 601 products, 29 orders, 10 deposits, 58 ledger items, 22 profiles and wallet total 46294.803237. These are expectedly DIFFERENT after production activity: **old database is NOT a current backup**.
- Yassen sync schedule */10 minutes, latest successful sync checked 2026-10-20 08:31 UTC, 768 supplier catalog rows, 582 linked products (11 manual-margin settings) and 2 quarantined prices. Code refreshes prices only when auto_margin is true.
- Telegram confirmed working by owner. Old Telegram queue notices excluded by cutover date. Deposit email cron remains disabled by owner choice; account verification/password recovery email must be retained.

## Security review
- 12 Supabase WARN findings: authenticated-callable SECURITY DEFINER public RPCs; separate 1 WARN: leaked password protection. 12 INFO findings: RLS enabled with no policy, often private administrative tables. Advisory source: Supabase security advisor, checked 2026-10-20.
- Evaluated elevated functions: f90_list_salary, f90_review_salary, f90_review_transfer, f90_manager_supplier_pricing call f90_private.require_actor(auth.uid(), ...); f90_set_trader_referral delegates to private helper checking manager role; f90_partner_usage delegates to permission-checked helper; f90_special_review checks manager; f90_special_submit requires signed-in uid and validates operation. These guards limit exposure but **do not represent full penetration test** of all 12 functions.
- Verified public.f90_checkout and public.f90_quote directly NOT executable by anon or authenticated roles; service backend RPC route holds transaction logic. Test of invoking f90_review_salary under authenticated SQL role without actor JWT returned F90_FORBIDDEN; SQL transaction had no successful mutation. Existing owner-tested checkout/deposit succeeded.
- Do not grant anonymous broad schema access, remove RLS, or revoke public RPCs without testing legitimate flows. Explicitly review leaked-password protection in Supabase Auth settings.

## Backup: NOT COMPLETED
- Connected tools allow Supabase SQL and migrations, but no full PostgreSQL dump/restore or managed backup creation/restore-test operation was available in this session. Thus **no new independent, restore-tested backup exists based on this work**. The old Supabase database is a preserved historical source, NOT a replacement for backup of live financial records.
- Next closure gate: create encrypted consistent dump of new PostgreSQL database including schema, roles/policies/functions, wallet/order/deposit/customer data and storage object inventory, store independently with strict access, restore into disposable isolated database, verify row counts/checksums/ownership/RLS and sample business invariants. Avoid exporting secrets to public GitHub. Do not touch production data during the restore test.

## Outstanding
1. Independent full backup + isolated restore test (blocker).
2. Review remaining SECURITY DEFINER RPCs and leaked-password auth setting; retain financial permissions (security gate).
3. Document successful outcome and backup verification, then publish final unblocked closure note. Keep old infrastructure intact per owner direction.
