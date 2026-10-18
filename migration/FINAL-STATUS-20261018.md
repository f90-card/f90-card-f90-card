# F90 CARD — final media correction + production-readiness gate (2026-10-18)

## Owner's explicit correction
**Do not copy old category / product / deposit images.**
Copy only F90 official brand essentials and required site banners; source original app icon imagery from verified internet providers once, keep future changes manual. Keep existing design, product IDs, price overrides, category ordering, user data and supplier state intact.

## Work actually completed
1. Existing F90 logo `f90-logo.png`, favicon `favicon.png`, and the three static page banners in `assets/f90-new/` verified present on GitHub `main`. No need to duplicate them in Supabase.
2. Four other site banners copied from existing **public banner paths only** into Cloudflare Pages.
3. Built `f90-card-media` from `migration/build-official-assets.mjs`, `official-assets-manifest.json`, and `verified-app-searches.json`, official Google Play / Apple App Store CDN URLs; ambiguities skipped.
4. Cloudflare Pages confirmed production build success, `91` image files published, ~`15.64 MiB` total, 4 banners, 37 category icons, 50 specific product icons. Thirty lookups unavailable or ambiguous and deliberately skipped.
5. In **new** Supabase staging DB `ogkipkavlywgwhtomoca` only, updated image_url for 37 categories, 190 product rows (category/app icon reused for services) and 4 banners. No price, availability, sorting, supplier or order mutation. Original price-column sum across 600 products still equals source at checkpoint.
6. In **old** Supabase production DB `xzqnrpycjxfbyrfaolud`, paused only two repeating icon-library cron jobs:
   - `f90-icon-library-backfill` job 6, previously every 5 minutes
   - `f90-icon-library-refresh` job 4, previously every 15 minutes
   All Yassen synchronization, order processing, Telegram and mail jobs remain active.
7. Cloudflare `f90-card-media` automatic build and preview triggers disabled after official-image deployment success; no background snapshots of old image library.

## What was NOT done / do not claim
- 410 product images and 45 category image rows still not confirmed as newly sourced originals; 12 general page category graphics remain from GitHub source assets. Some apps have no unambiguous current store listing.
- Original 702 Supabase Storage objects remain untouched; **storage quota has not yet been freed**. The old 444MiB radio archive has not been deleted, because there is no verified backup/recovery plan.
- Staging Auth has just 3 partial users / 0 identities / 0 wallets versus 19 users, 20 identities, 19 wallets in production. **DO NOT CUT OVER**.
- Private receipts, personal documents, order / ledger data, SQL functions, authorization policies and supplier functions are not migrated to working staging.
- R2 is not enabled. Current static Pages image publishing requires a code/deploy update; **manual image upload from the admin dashboard is not yet implemented**.
- Cloudflare storefront `f90-card-migration` is not the public site; Vercel's latest production deployment reports READY and remains linked to `www.f90card.online`. READY does not by itself prove checkout flows.
- Supabase new project `f90-card-new` is healthy but cannot yet safely replace the old one.
- No domain, login/redirect, financial ledger, site design or price changes on the live store in this stage.

## Critical path to completion
1. Secure backup/restore path via official Supabase tooling for existing Auth accounts and hashed passwords + all financial records (must preserve IDs); cannot expose credentials/hashes in public GitHub, chat, or logs. GitHub connector cannot set Actions Secrets or create private repo.
2. Compare data integrity snapshots and restore all SQL functions, triggers, RLS, cron and Edge functions, ensuring supplier and financial calls only execute from one active backend.
3. Secure private Storage backup, review what historical radio content can be deleted, move necessary original F90-brand assets and sources of future admin uploads.
4. Curate remaining non-gambling app icons with correct official identity; do not assume a logo search result is correct if app identity is ambiguous. Retain an existing image until a verified replacement exists.
5. Build and verify Cloudflare storefront on separate staging domain, with checkout disabled until auth migration complete. Validate full functionality and only then switch DNS.
6. After explicit owner approval and all checks, stop writes briefly, sync deltas, cutover and keep old Vercel + Supabase rollback until stable.

Reference docs: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore ; https://developers.cloudflare.com/pages/platform/limits/
