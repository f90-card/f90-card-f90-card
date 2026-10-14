# F90 CARD: Supplier Adapter Protocol
English technical specification | إرشادات عربية لإدارة الموردين

**Scope:** Import supplier products into F90; export F90 products through the merchant API. These are different directions and separate credentials. F90 does **not** automatically support every conceivable provider protocol.

## A. Supplier import / استيراد من المورد
- Admin → Providers is the supported control panel for adding/removing suppliers, entering endpoint, adapter, currency and margin, testing availability, mapping services, and importing selectively.
- Known adapter families in this codebase: **Yassen**, **Omega**, and conventional **SMM panel** style. Adapters are not interchangeable. A supplier with undocumented request/response shapes requires an additional tested adapter.
- Add source credentials only through the secured management workflow. Never commit tokens into GitHub, public scripts or service documentation.
- Require an explicit HTTPS endpoint; server-side validation must reject private/loopback hosts and prevent credential leakage on redirects.
- For unknown suppliers, run a **read-only** discovery/preview first and require an administrator to confirm matching IDs, prices and fulfillment mode before enabling paid orders.
- Import needs stable `provider_service_id`, source currency, decimal rates, minimum/maximum/step, product fields, supplier stock and availability. Normalize into F90's catalog schema.
- Convert source prices (e.g. ILS → USD) using the configured conversion rate and apply the provider margin, while preserving owner edits to existing catalog images/names/categories.
- Never automatically reactivate an owner-paused service because a supplier marked it available. Supplier-paused products should recover only when the supplier returns to stock.
- Use idempotency keys and reconcile unknown-status orders instead of duplicate fulfillment.
- Observe real API rate limits, timeouts, allowed network hosts, and replay-safe callbacks if a supported adapter accepts them.

**العربي:** لا تفتح منتجاً متوقفاً يدوياً عند تحديث المورد. افحص سعر المصدر وعملته والربح أولاً.

## B. Selling F90 inventory / تصدير خدمات الموقع لتاجر
The F90 merchant API is already available to approved `trader` accounts:
`POST https://xzqnrpycjxfbyrfaolud.supabase.co/functions/v1/f90-platform`.
Authenticate with `x-f90-key`, use `categories`, `services`, `service`, `balance`, `add` and `status` actions, and protect transactions with idempotency keys.

See `F90_MERCHANT_API_EN.md` for the integration examples and constraints.

**العربي:** تفعيل التاجر، إصدار توكن خاص به، مراجعة الاستخدام، وإلغاء التوكن يتم عبر لوحة الحساب والإدارة؛ ولا نعطي مفاتيح الموردين الأصلية للتجار.

## C. Credentials, IP restrictions and callbacks / التوكن، IP، Webhook
- **Token creation / إنشاء التوكن:** supported and restricted to authorised trader accounts after verification.
- **Token scopes, limits, expiry and revocation / صلاحيات وتاريخ انتهاء وإلغاء:** supported.
- **Merchant IP allowlist / السماح لعناوين IP محددة:** NOT implemented or enforced. A safe implementation must handle reverse-proxy trusted IP identity, IPv4/IPv6 CIDR validation, independent admin recovery and testing before restrictive rollout.
- **Outbound merchant webhook URL / إرسال أحداث الطلبات:** NOT implemented. A secure version must validate HTTPS destinations against SSRF, protect against DNS rebinding and redirects, sign each event, retry with bounded backoff, and track acknowledgements without duplicating actions.
- **Universal automatic protocol recognition / تعرف تلقائي على كل بروتوكول:** NOT possible to guarantee. Implement adapters per documented formats; never brute-force supplier credentials or issue paid test orders.

## D. Admin operational checklist / فحص المسؤول
1. Confirm HTTPS endpoint and known adapter before enabling.
2. Run read-only service list and currency/price mapping preview.
3. Review availability, quantity units, mandatory customer fields and merchant margins.
4. Import only selected services into desired F90 sections, without deleting existing catalog.
5. Monitor last successful sync and provider errors from the admin console.
6. Validate quote and paid checkout with an explicitly authorised test account before production rollout.
7. Preserve wallet state and audit trails; never put provider keys on the client.

Version: F90 CARD, 2026-10-14. This document describes implemented components and planned safeguards separately.
