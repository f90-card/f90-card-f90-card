# F90 CARD — migration continuation and DNS checkpoint — 2026-10-18

## Newly verified in the connected accounts
- Cloudflare zone `f90card.online` created under account `e626c05d52050bd4eac1ef18c72a8790`, zone ID `96f45eeeabea976ea62efa993fc9f9eb`. Plan: Free. **Status: PENDING** because original authoritative nameservers still belong to domain registrar **Spaceship**.
- Nameservers Cloudflare assigned: `danica.ns.cloudflare.com`, `troy.ns.cloudflare.com`.
- Old authoritative NS from Cloudflare scan: `launch1.spaceship.net`, `launch2.spaceship.net`.
- Cloudflare imported five DNS records: apex A `76.76.21.21` (Vercel), `www` CNAME `cname.vercel-dns.com`, one MX and two TXT (one mail DKIM). **Existing web remains on Vercel; no DNS cutover was made.** Any nameserver change must preserve mail and all records; Cloudflare cannot update Spaceship registrar via this connected account.
- Cloudflare Pages media `f90-card-media` and storefront `f90-card-migration` show successful deployments. Storefront latest deployment added a Cloudflare Pages Function `functions/api/manifest.js` (safe dynamic PWA manifest using public data). Both Pages projects have automatic GitHub deployments disabled again to prevent surprise changes.
- Storefront Pages build is an isolated **noninteractive preview**; the public `www.f90card.online` domain has not been attached.

## New Supabase `ogkipkavlywgwhtomoca`
- Prior snapshot includes 19 Auth users, 20 Auth identities with original password hashes/IDs, 19 wallets, 55 wallet ledger records, 27 orders, 10 deposits, historical events, public catalog and brand data. Full official login test **NOT** completed.
- Current count reconciliation: 35 out of 39 public/private application tables have equal counts between source and target. Four differences:
  1. `public.f90_notification_outbox`: source 8323, target 8321 (new source events after snapshot)
  2. `public.f90_store_news`: source 6897, target 6895 (new source events after snapshot)
  3. `public.f90_rate_limits`: source 7, target 0 (ephemeral counters; intentionally not migrated)
  4. `public.f90_radio_sources`: source 1, target 0 (obsolete media; intentionally not migrated)
- Two new database sequences were realigned to the current source values to prevent identity collision.
- Additional safe public site configuration (payment methods, salary requests, special services, money transfers, promotions) copied to target without exposing hidden Telegram/provider settings.
- The five needed Yassen/worker/Telegram secret entries are present in the **new Supabase encrypted Vault** and the provider is linked to the new Yassen secret identifier. **The target supplier remains DISABLED**, no double dispatch.
- Cloudflare `functions/api/manifest.js` created and deployed successfully to staging; Cloudflare build logs confirmed `Found Functions directory at /functions. Uploading.` and `Success: Your site was deployed!`.
- SQL security verification: anon can SELECT public products/categories/site settings, anon CANNOT SELECT wallets, customer can SELECT own wallet subject to RLS, **checkout RPC EXECUTE remains disabled** in staging. Do not open checkout until original financial records and storage are final-synced, mail/OAuth/backends tested.
- Supabase security advisor still reports 10 authenticated SECURITY DEFINER function warnings (also present in original platform baseline) and leaked-password protection warning. Must audit before launch.

## UNSOLVED mandatory tasks
1. **Private storage**: original `f90-identity` (15 items ~15.4 MiB), `f90-receipts` (17 ~7.25 MiB), `f90-avatars` (3 ~1.12 MiB) not yet physically copied. Original 702 objects still retained. Do not create fake storage.objects records or make documents public.
2. Final database delta synchronization MUST occur during controlled write freeze, before switching frontend API to new project, because original production remains live.
3. Supabase Auth provider/SMTP config (Google OAuth, password reset and registration mail) has not been cloned; secrets from dashboard/server environment cannot be inferred.
4. Supabase Edge platform functions must be end-to-end tested (the staging `f90-platform`, mail and Telegram functions are currently deployed with JWT verification; provider and customer flows must be proven before opening).
5. No Cloudflare Page deploy of an interactive, verified financial storefront. The Pages static preview intentionally disables interaction. No merchant-facing domain cutover.
6. SpaceShip nameserver change requires action in the domain registrar account or a connected registrar app. Current Cloudflare integration can manage its zone only; cannot change registrar-level NS. Domain zone is pending.
7. Some old radio/media storage is intentionally not deleted without confirmed retention requirements and backup.

## Preserve and protect
- Do not edit GitHub `main` or alter original Vercel site before stage review.
- Do not alter manual pricing or supplier overrides.
- Do not trigger supplier fulfillment, financial writes, or duplicate notifications on the target.
- **Do not claim full migration/production readiness yet.**
