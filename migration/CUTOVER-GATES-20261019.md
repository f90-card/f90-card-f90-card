# F90 CARD — safe production cutover gates

> The *existing* live store is `https://www.f90card.online` (Vercel). Keep it untouched until every mandatory gate has passed. This document does not authorize any production switch, financial mutation or supplier double-processing.

## Passed / verified
- [x] Original customer accounts, identities, 601 products, sale prices/stock, 27 orders, 10 deposits, balances and 35 private customer files migrated in earlier snapshot; reconcile new live changes before release.
- [x] New Supabase Google sign-in, owner/manager role 2/2, profile and wallet read confirmed by operator.
- [x] New Supabase + Resend Auth SMTP: fresh password-reset email delivered from `noreply@f90card.online`; operator opened reset URL, changed password successfully.
- [x] Cloudflare Pages storefront *staging preview* and static media published; staging root remains read-only for financial actions and admin editing.
- [x] All 412 current *Cloudflare-media-backed* product/category/banner URLs correspond to files in the current immutable image index (163 current + 76 preserved historical images). Image rebuild now preserves old immutable paths.
- [x] Only new Supabase mail claim RPC has cutoff filtering: `public.f90_mail_claim_after(p_cutover_at, max_jobs)` requires service-role execution, rejects invalid/old cutoff and selects deposit emails with `created_at >= p_cutover_at`.
- [x] New Supabase `f90-deposit-mail` secret readback reports `providerConfigured=true`, `senderConfigured=true` and `dispatchSecretConfigured=true`. Secret values never shown. The separate authenticated staging email test rejects unauthenticated calls (HTTP 403) and remains single-recipient/idempotent.
- [x] Staging mail Edge Function `f90-deposit-mail` v5 keeps `F90_MAIL_CUTOVER_READY` and `F90_MAIL_CUTOVER_AFTER` guards. Unaided POST returned HTTP 423 `migration_readonly`; no email dispatched. 14 historic queued notifications (seven deposits, two recipients each) remain untouched.
- [x] Yassen Card provider credentials were verified equivalent in source and stage without revealing them; source supplier automations remain live, staging disabled.

## Open mandatory gates
- [ ] **Historic completed order #32 still missing** in target, along with two history events, one ledger debit and the corresponding target wallet update. Snapshot is **not current**. Connector rejected protected financial write. Target identity sequence restart is staged but the missing order/data remain outstanding; do not activate checkout or cut over until a sanctioned transactional reconciliation passes.
1. [x] Configure **new-project transactional deposit notification** environment secrets privately: `RESEND_API_KEY` (separate send-only key, not the SMTP password), `F90_EMAIL_FROM` (e.g. `F90 CARD <noreply@f90card.online>`), `F90_EMAIL_DISPATCH_SECRET` (independently generated random 32+ characters). Resend Auth SMTP wizard does **not** set these Edge Function secrets.
2. [x] Open [staging authenticated mail test](https://f90-card-migration.pages.dev/f90-migration-mail-test) and press the single test-email button as the operator. The dedicated `f90-mail-smoke-test` function (v1, JWT required) only emails the **verified authenticated manager/admin's own address**, with one idempotent test/day, and has no deposit/mail-queue access. The stage page was independently confirmed deployed. After it returns `accepted`, independently verify Gmail + Resend `Delivered`. Then perform one approved new **test deposit-notification** with an actual delivery receipt to an authorized owner inbox. Do **not** release the 14 old notifications by accident. Keep `F90_MAIL_CUTOVER_READY` disabled and unset `F90_MAIL_CUTOVER_AFTER` until final cutover and owner signoff.
- [ ] **Mail test follow-up:** user confirmed the isolated transaction-mail test succeeded after the API key fix; **actual live deposit events are still blocked** until approved cutover and queue review. Do not re-run test needlessly.
- [x] Add fail-closed backend validation to the read-only staging build; preview refuses to build against the original production Supabase project.
3. [ ] Replace the remaining **ONE active product image (TokTok)** after exact app identification. This continuation migrated 52 product and four category URLs; zero categories still use old storage. All 56 replacement files were downloaded and verified by content hash. The 35 image-less inactive products remain inactive.
4. [ ] Produce and acceptance-test *production-equivalent interactive* storefront and admin on Cloudflare with Google and password login, checkout, deposit, customer upload, owner review, order-state and transaction idempotency. Do not test real financial mutations against a customer's balance in live production.
5. [ ] Prove order flow and Yassen Card fulfillment with controlled dedicated test accounts/items; confirm exact exchange rates, retail pricing, retry safety, no duplicate orders, and webhook/cron paths.
6. [ ] Verify original and new accounts/orders/credits/file deltas **immediately before cutover** and reconcile; exclude sole stage-only test identity from merge. Freeze/checkpoint old source writes only in a coordinated maintenance window after owner approval.
7. [ ] Disable old supplier/financial/notifications cron exactly once before enabling target cron, check that no order is processed twice. Reenable old workers on rollback.
8. [ ] Deploy production-ready Cloudflare Pages build distinct from the intentionally read-only stage preview. Check all assets, SEO/indexing, public URLs, domain callback paths, SMTP recovery, admin and mobile PWA.
9. [ ] Only after all gates pass and user approves: change Cloudflare DNS for apex and www from Vercel to production Pages, verify TLS and live logs, test order and mail, monitor and preserve rollback option.

## Non-negotiable
- Never copy an old private receipt/identity photo into public Cloudflare images.
- Never put API tokens or passwords in GitHub, chat messages, or a screenshot.
- Do not alter the separate `وكالة مجلس القمة` project.
- Preserve manual retail overrides, customer balances and records, and allow manual future official image updates.
- Current live site remains on Vercel and old Supabase; a successful read-only test or SMTP test alone is **not** go-live approval.

_Validated in the October 19, 2026 migration continuation._

## Broader gate discovered in latest 39-table reconciliation
- Review nested old-host URLs in promo_video/payment_methods/salary_withdrawal and historical order/deposit/notification snapshots; product primary-image count alone is not proof of media independence.
- Six site/PWA/admin assets and nine section/welcome assets were published and verified (15/15 hashes); associated exact target config/banner paths updated, without activation changes.
- Compare audit/news/outbox deltas and discounts/settings. Do not replay notifications or restore removed radio entries. One missing public agent was safely copied; target now has two.
- Keep the financial review specification mandatory; target still has 27 orders / 69 events / 55 ledger rows, not source parity.

## Cloudflare full-store acceptance build created
- Created separate Cloudflare Pages project `f90-card-acceptance` under the **new Cloudflare account** and connected existing migration GitHub branch. Automatic production deployments disabled; no custom domain.
- Builder: `node migration/build-storefront-production.mjs`, default mode **acceptance** (not `production`), output `dist-f90-storefront-production`. It references **new Supabase**, strips production robots indexing, and does NOT authorize cutover. This project is isolated from the intentionally read-only preview and the live Vercel store.
- First deployment `6f5c5b9f-b351-4d14-b545-290e83cfc469` reached Cloudflare stage `deploy:success`; URL `https://f90-card-acceptance.pages.dev`. **Build success is not checkout/admin acceptance.** Do not invite customers to use this test project: it may expose real stage checkout interfaces.
- Mandatory next gate: verify original UI/auth/owner admin and nonfinancial requests, then controlled testing of checkout/deposit with dedicated isolated test account and idempotency checks; never run supplier production processing on stage. The new stage still has an unreconciled completed order #32, so absolutely no DNS cutover.

## Latest wallet parity audit before supplier cutover
- Read-only wallet comparison performed on 2026-10-19: **21/22 source customer wallets exactly match** target by opaque hashed user identifier and balance. Only **one** source wallet differs, as already identified in the historical order/debit case; target additionally has **one stage-only test wallet**. No wallet value or identifying information recorded here.
- New target had **zero cron jobs**, Yassen provider `is_enabled=false`, and **zero active orders**. Existing source-only workers should not be flipped until an approved single-writer handover.
- User explicitly deprioritized old personal order history. That decision does not establish source/target wallet parity or authorize an unverified wallet balance to be used for production.

## Supplier handover operational checklist
- The operator accepts short planned downtime and defers comprehensive testing until after setup. This does not authorize activation with mismatched wallet balances or duplicate supplier workers.
- Original source currently handles Yassen order fetch/import and order worker. Target has zero active cron jobs and zero in-flight orders at the latest successful readback.
- A safe switch requires: maintenance mode for **new orders**, a fresh source snapshot and wallet reconciliation, stop original cron, confirm zero in-flight jobs, activate target cron and Yassen only once, validate callbacks and frontend, then domain cutover. Do not replay old deposit notifications.
- Preserve all manual retail price overrides and supplier Vault credentials. Rollback must stop target jobs before starting old jobs.
- At latest check, old-project combined cron read was rejected by a connector safety check, so source shutdown has NOT been executed or verified.

## Notification cron pre-activation audit
- Target Supabase has **all five expected cron entries staged and inactive**: orders worker, Yassen fetch/import, Telegram and deposit mail. Target deposit notification queue still holds **14 pending historical entries**; no release/replay performed.
- The target Vault has `f90-worker` but **lacks** `f90_mail_bearer_jwt` and `f90_mail_dispatch_secret`. The email job is therefore **not ready to send**, even if cron is enabled; do not mark it operational. Edge function `f90-deposit-mail` v9 has a named mail cutover guard and `f90_mail_claim_after` logic; keep them intact.
- Separate staging Resend send-only test was operator-confirmed, but automatic deposit delivery is an independent pending gate. Approved secure dispatcher credential provisioning plus post-cutover-only message test are still required.

## Verified private cutover readiness diagnostic
- Executed `select f90_private.cutover_readiness()` successfully against the **new Supabase**: `jobs_total=5`, `jobs_enabled=0`, `active_orders=0`, `yassen_enabled=false`, `legacy_active_images=1`, `pending_historical_mail=14`, `mail_dispatch_vault_ready=false`.
- The diagnostic returns only aggregate readiness data; it is restricted from public/anon/authenticated invocation. No workers were activated, no mail was sent, and neither source nor target wallets were changed.
- Continue work on remaining official TokTok image and approved dispatcher provisioning; a valid readiness diagnostic is **not** production go-live approval.
