# F90 CARD — verified staging checkpoint (2026-10-18)

**Do not merge this branch to main or change DNS yet. Stage is read-only, not production ready.**

## Staging deployed
- Cloudflare Pages project `f90-card-migration`, deployment ID `75f205ef-8b08-4411-847d-2a71eeee227e`.
- Cloudflare API reported **SUCCESS**, 190 files deployed, 24.37 MiB copied. Verified presence of `/index.html`, `/admin.html`, `/config.js`, `/f90-logo.png`, `/favicon.png` and static banner assets.
- Public preview URL: `https://f90-card-migration.pages.dev`. This is a **noninteractive read-only preview**, which cannot accept purchases or sign-in. Not yet a live site. Verified deployment through Cloudflare management API; no full browser end-to-end test was completed.
- Source branch `migration/cloudflare-supabase-20261018` and build script `migration/build-storefront-preview.mjs`. Build excludes 51 MiB marketing archive, Supabase edge function files, Vercel API endpoints, tests and migration documents.
- Public publishable key points to new Supabase `ogkipkavlywgwhtomoca`, without exporting service-role or password secrets. Identity session persistence and auto-refresh disabled in preview.
- **Automatic GitHub Pages builds disabled** again after successful Cloudflare deploy. No domain cutover.

## Data prepared
- 39 staged application tables (34 public + 5 private) with indexes, constraints and foreign keys.
- Matched live inventory at checkpoint: 600 products; 600 price/cost internal rows; 82 categories; 7 banners; 29 currency rows; 15 VIP levels.
- 1 safe brand settings row, 34 display/theme keys excluding credentials, merchant hooks, payment methods, coupon details and Telegram secrets. Public SELECT policy verified.
- Public media: official snapshot (4 required banners, 37 categories, 50 individual product icons, 190 product rows using verified category icons), built at `f90-card-media.pages.dev`; automatic rebuild disabled.
- Source image refresh/backfill cron jobs (5/15 minutes) disabled. Orders/supplier/payments notification cron unchanged.

## Reconciliation results (last read)
| metric | production old | staging new |
| --- | ---: | ---: |
| auth.users | 19 | 3 **partial only** |
| auth.identities | 20 | 0 |
| profiles | 19 | 0 |
| f90_user_roles | 19 | 0 |
| f90_wallets | 19 | 0 |
| f90_wallet_ledger | 55 | 0 |
| f90_orders | 27 | 0 |
| f90_order_events | 69 | 0 |
| f90_deposits | 10 | 0 |
| f90_salary_requests | 8 | 0 |
| products | 600 | 600 |
| f90_product_internal | 600 | 600 |
| categories | 82 | 82 |
| banners | 7 | 7 |
| storage.objects | 702 | 0 |

- Product price fingerprint **matched** between source and target; wallet, auth and orders fingerprints did **not** match (expected).
- Source old Postgres database = 74 MB; source Storage approximately 1132 MiB spread over 702 files including ~626 MiB images and ~444 MiB old radio. Data remains intact.
- Source currently has 2 active provider entries: Yassen Card (external) and F90 internal services (internal); Omega disabled. Preserve internal service logic.

## Mandatory blockers before ANY commercial cutover
1. Safe, verified complete database backup/restore of Auth **password hashes + provider identities**, user profiles, balances, full ledger/order/deposit history. Never export hashes/passwords as plaintext through chat or public GitHub. Project-to-project restore is not available as a free one-click feature, per Supabase docs; CLI is the official Free plan route.
2. Current connected GitHub tool cannot create a private repository or write Actions Secrets. Current connected Supabase tool cannot transfer projects across organizations, expose database passwords or execute a native backup/restore operation. The old and target Supabase OAuth connections belong to distinct organizations. Owner must set credentials through a secure authenticated interface (not the chat) before server-to-server export.
3. Complete the backend functions/trigger/RLS/API deployment and private Storage transfer; configure Google OAuth, email and supplier secrets separately.
4. Preserve all current custom/manual prices; sync changes that occur after catalog snapshot. Freeze financial writes before exact ledger reconciliation. Do not process orders from both backends simultaneously.
5. Move/delete old public and radio media **only after** replacement links and actual backup/irrelevance verification. Do not delete private proofs or identity documents.
6. Test signup/signin via Google/email, checkout, balances, deposits, supplier status and refunds under controlled test accounts, before switching DNS.

**Existing production** `www.f90card.online` remains on Vercel, connected to old Supabase. No main branch or DNS changes applied during this migration.

Official references:
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/platform/project-transfer
- https://supabase.com/docs/guides/platform/clone-project
