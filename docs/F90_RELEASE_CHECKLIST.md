# F90 CARD — Release & Acceptance Checklist
**Current revision: October 14, 2026. Status: NOT yet certified for financial production testing.**

This is an operational checklist for the store owner and developer. Passing a JavaScript parser does not replace a real browser or transaction test.

## 1. Public storefront — phone and desktop
- [ ] Test Arabic RTL navigation on a real Android phone, iPhone, tablet and desktop.
- [ ] Open the category menu and theme switch on dark/cream themes. No layout shifts, hidden buttons or mismatched glow.
- [ ] Open `#/welcome`: official configured F90 logo, responsive main heading, no unnecessary product captions, reduced-motion behavior and no missing images.
- [ ] Open `#/quran`: Quran radio only here, source selector, audible play, station offline error, and stop/switch behavior.
- [ ] Disable mobile network and resume: do not let frozen prices be mistaken for authoritative checkout quotes.

## 2. Buying & wallet (only with a dedicated authorised test account)
- [ ] Verified/unverified user gating, MFA where applicable, account/customer fields required by each service.
- [ ] Inspect quote for coin quantities and manual/API products; ensure source ILS-to-USD conversion, margin and VIP discount are correct on the server.
- [ ] Confirm displayed wallet before/after, actual checkout total and updated balance match the backend.
- [ ] Submit one test order, check provider status, idempotency after interruption, and order-history entry.
- [ ] Never retry uncertain provider purchases blindly; test failed/refunded/partial flow with operator oversight.
- [ ] Deposit amount, 2% fee display, admin approval, final wallet balance, refund and immutable ledger.

## 3. Supplier adapters
- [ ] Test Yassen, Omega (read-only), SMM and JSON adapters with safe read-only queries before enabling new suppliers.
- [ ] Confirm stock pauses, owner pauses, category mapping, duplicate-safe imports, image preservation, ILS currency conversion.
- [ ] Unknown protocols require an adapter with documented schema, authorization and tested response mapping. There is no universal automatic protocol recognition.

## 4. Merchants & secrets
- [ ] Verify trader identity/role and create one key; key visible only on creation; rotate and revoke.
- [ ] Enforce scopes, per-minute limits, expiration, token hash, order idempotency, usage logs.
- [ ] Ensure neither provider tokens nor service-role keys are present in browser JS, HTML or public GitHub.
- [ ] **Merchant IP Allowlist: NOT IMPLEMENTED.** Do not rely on it for access protection until a trusted proxy client-IP contract is implemented and tested.
- [ ] **Signed outbound merchant Webhooks: NOT IMPLEMENTED.** Do not advertise status pushes to merchants until delivery, signature and SSRF controls are added.
- [ ] Download and verify `docs/F90_MERCHANT_API_EN.md`, `docs/F90_PROVIDER_PROTOCOL_EN.md`, `docs/openapi.json`, and `docs/postman.json`.

## 5. Administration & performance
- [ ] Test `admin.html#/design-center` copy/hero/image/glow changes on a throwaway configuration and then restore, without altering balances.
- [ ] Test `admin.html#/integration`, `#/infrastructure` and existing trade/provider settings on mobile/desktop.
- [ ] Confirm admin orders/deposits and audit lists are restricted to authorised manager/admin accounts.
- [ ] Run database security and performance advisers; check server response latency and stale provider sync.
- [ ] Supabase Auth warning: **Leaked password protection must be enabled in Auth settings** by an authorised owner; currently warned by the adviser.
- [ ] Review real Edge Function and Postgres errors, run a limited load test without paid orders, check source bundle caching and image payload sizes.

## 6. New-deposit email notices
- [x] Two private recipient-specific notification queue entries are enqueued on each new pending deposit.
- [x] JWT-protected Edge Function `f90-deposit-mail` and service-role-only job locking/completion RPCs deployed.
- [ ] **No delivery yet.** Connect an authorized transactional mail sender (e.g. Resend) with verified sending identity and private credentials.
- [ ] Add `RESEND_API_KEY`, `F90_EMAIL_FROM`, `F90_EMAIL_DISPATCH_SECRET` as function secrets; enable a trusted automated scheduler and verify real sender acknowledgements.
- [ ] Confirm receipt at both destination inboxes from a controlled test deposit, without copying receipts or customer private details into mail.

## 7. Hosting/domain
- [ ] Keep the currently working GitHub Pages URL until any alternate host is publicly reachable and serves the same project revision.
- [ ] Verify a shortened URL and TLS access on a device without an admin login; do not redirect all users to a protected preview.
- [ ] Confirm backups and a rollback path before release.

## Verification performed by assistant
- JS syntax and asset version checks on repository files.
- Private deposit-email queue schema, trigger, and authentication-protected sender worker deployed. No inbox delivery test has passed.
- Supabase relationship indexes created in an earlier batch; no unindexed-FK warning remains.
- Public key and source files scanned for obvious embedded secrets (not a full professional pentest).
- No payment execution / balance mutation performed for automated testing.

**Release status must stay in-progress until all high-impact acceptance checks above have evidence.**
