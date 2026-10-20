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

## Follow-up production CI repair
- Owner confirmed live purchase and deposit, Telegram alerts and product/admin changes working. Updated `migration/release-acceptance.json` (commit `132acb6c48a79e58fc72db108953a69d455fa22e`) to record completed owner acceptance.
- Corrected the 15-minute *pre-launch-only* verification expiry in production builder (commit `23c9930cbf9314de924e3c145fece949d809e764`). After owner-verified purchase/deposit, acceptance persists across subsequent production builds; other required gates remain.
- Cloudflare production Pages deployment `0e129313-90cc-4f88-955d-d7f6f6d93402` **succeeded**, after previous doc-only CI attempt had failed. Official domains remain Cloudflare Pages.
- This repair does NOT create a restorable database backup, turn on deposit emails, or remove existing auth/security warnings. Do not declare unconditional technical closure.

## Follow-up security and backup capability audit
- Checked all 12 authenticated-executable SECURITY DEFINER functions individually by name and inspected representative implementations. Manager-only operations call `f90_private.require_actor(auth.uid(), ...)` or verify `f90_private.my_role()`, while submissions verify the authenticated actor and account conditions. Treat the remaining linter findings as **requires focused review**, not proven exploitable vulnerabilities; no unsafe blanket REVOKE was applied.
- Supabase security advisor continues to report 12 WARN elevated-function items, 1 WARN leaked-password-protection item and 12 informational RLS-no-policy items. Password-leak protection requires an Auth configuration action, not a table GRANT.
- Checked connected tool set: Supabase management tool currently exposes query/migrations/functions/advisors but no full dump, backup export/restore or Auth password-protection settings operation. TinyFish browser profiles have no confirmed Supabase dashboard login. Therefore NO independent database dump, encrypted copy, isolated restore, or recovered integrity proof was produced. An authorized Supabase dashboard login or securely supplied DB backup mechanism is required.
- **Closure remains BLOCKED** until independent backup restore test and Auth setting verification; preserve live new DB and old Supabase/Vercel untouched. Never commit sensitive backups or credentials to GitHub.

## Final owner decision and finance permissions check
- Owner confirmed the production storefront, login, catalog/admin visibility, live purchase, deposit, Yassen synchronization, Google login, password reset and Telegram all work. Owner explicitly **waived the requested independent backup and restore test**; risk accepted, not falsely recorded as a backup. Old Vercel and old Supabase are retained, but have divergent financial data and cannot restore current state.
- Finance permission review: all twelve public authenticated-callable SECURITY DEFINER RPCs are non-executable by the anon database role. Manager salary/transfer reviews and supplier-pricing functions contain internal role checks; partner and trader helpers delegate to private role-protected functions; submissions bind to auth.uid() and validate state. Under an authenticated SQL role without actor identity, a direct attempt to invoke public.f90_review_transfer was rejected with F90_FORBIDDEN and did not modify data. Remaining 12 elevated-RPC lint warnings are structural warnings; this limited test is NOT an exhaustive security penetration test.
- Supabase Auth leaked-password-protection warning remains present. The connected Supabase API does not expose a setter for that Auth setting. User needs to enable it from Dashboard > Authentication > Settings > Security and review plan entitlement. Do not claim protection enabled until advisor confirms warning disappeared.
- Status: **operational migration completed**; security hardening advisory and intentionally waived backup remain open notes. Deposit alert email intentionally disabled by owner; Telegram enabled. No legacy decommission.

## Plan limitation verified for leaked password protection
- As of 2026-10-20 Supabase official pricing and password security docs indicate leaked password protection is **not available on Free**, only Pro and above. This explains the remaining Auth advisor WARN. No paid subscription authorized; setting remains off. See https://supabase.com/docs/guides/auth/password-security and https://supabase.com/pricing.
- Rechecked that all 12 public SECURITY DEFINER RPCs shown by Supabase security advisor have no `anon` execute privilege. A transaction invoking salary list as `authenticated` with a nonmanager actor was rejected `F90_FORBIDDEN`. No finance rows were mutated.
- Remaining linter warnings are intentionally documented and should not be mass-revoked without preserving signed-in customer flows. No claim of full penetration-test clearance. The owner waived backup; no restorable backup created.

## Final four-platform live verification — 2026-10-20 09:15 UTC

- Cloudflare Pages `f90-card-acceptance`: production build mode verified. Latest three deployments were `success` (latest 09:10:26 UTC). Both `www.f90card.online` and apex `f90card.online` are `active` custom domains.
- New Supabase `ogkipkavlywgwhtomoca`: SQL query successful at 09:15:12 UTC; `public.products=601`, `public.profiles=24`. Note: `public.orders=0` is NOT the complete financial order tally: migration records distinguish private order tables. This public-table count must not be used to infer deleted transactions. Review financial orders in their actual schema when necessary.
- New `f90-platform` Edge Function is ACTIVE version 17. `f90-telegram-alerts` active version 7.
- Scheduled jobs: `f90-important-telegram-alerts`, `f90-orders-worker`, `f90-yassen-fetch`, `f90-yassen-import` are active with latest run `succeeded`. `f90-pending-deposit-mail` intentionally inactive on owner request.
- Supabase security advisor still returns WARN `authenticated_security_definer_function_executable` (12) and `auth_leaked_password_protection` (1), INFO `rls_enabled_no_policy` (12). Performance advisor shows `multiple_permissive_policies` WARN (3), `unindexed_foreign_keys` INFO (4), `unused_index` INFO (34). No blind RLS/GRANT/index modification because risk of breaking production checkout/permissions. Basic unauthorized-role denial was demonstrated in prior audit but is not a full penetration test.
- Vercel project `f90-card-storefront` remains available with latest READY legacy deployment and `live=false`; custom domain references still present as owner-requested rollback, do not delete.
- GitHub migration branch carries final report. No verified independent restorable backup; owner has explicitly deferred. Password leak detection is plan-limited or unavailable to the connected management operations; not falsely marked enabled.
- **Outcome: production migration / live operation complete based on direct infra reads and owner's live transactional tests. Not a claim of a zero-warning security audit, disaster-recovery guarantee, or comprehensive penetration test.**
