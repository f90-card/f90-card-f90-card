# F90 CARD — Merchant API implementation checkpoint, 2026-10-20

Status: **INCOMPLETE — draft changes tested in isolation, NOT deployed**.

## Verified production baseline

Cloudflare Pages f90-card-acceptance production uses migration/cloudflare-supabase-20261018 at cc86c9cf64724bf6ed946233d493fe54edcda5b0, deployment 34e59aa9-975b-4f4d-9b30-eaa13eea8438 succeeded. main is older and was not used.
New Supabase ogkipkavlywgwhtomoca is ACTIVE_HEALTHY; deployed f90-platform version 22 was read directly.
No agency project touched.

Read-only external fetch:
- https://www.f90card.online/api/v1 returned storefront HTML, not API JSON.
- https://www.f90card.online/api/merchant returned JSON API metadata. This proves GET metadata only, NOT authenticated purchase readiness.
- Source gateway points to new Supabase. No service-role secret used for merchant integrations.

Key audit: 14 keys, 1 active, 13 inactive, zero expired. Active key owner is an active verified trader. Recent audit includes explicit key.revoke and key.rotate with replaced_existing=true. Not all historical inactive keys have been individually attributed. No keys reactivated, rotated, disclosed or read in plaintext.

Catalog: 590 products, 572 active, 87 used categories, 18 missing image URLs. Some missing-image names are ambiguous (WWWW, zzzz, Kkkkk, Ggggg), so authentic images cannot be assigned by guessing.
One duplicated supplier mapping links active اكزينا لايف and inactive SHIPMENT XENA LIVE. Not deleted or merged.

Product price/currency checksum before and after:
8fc8ef269d16a2b79439022638418b0c
This covers products.price and products.currency only, not every pricing/margin configuration. This session made no database mutations or financial tests.

## Changes prepared

Code baseline preserved as backup/merchant-api-baseline-20261020-1644. This is a CODE snapshot, NOT a database backup.
Work branch: fix/merchant-api-v1-20261020.

- functions/api/v1.js: real Pages Function alias to existing merchant gateway, canonical JSON health metadata, OPTIONS, POST, explicit 405, reject URL credentials. Legacy /api/merchant retained.
- docs/reseller-example.mjs: replace old Supabase URL with intended /api/v1.
- f90-merchant-v2.js: Arabic guide titled دليل التاجر وربط المتاجر, canonical link and copy button, scopes, fields, limits, pricing, synchronization, idempotency and order-status instructions.
- tests/merchant-gateway-v1.test.mjs: isolated transport/guide tests with mocked upstream.
- .github/workflows/merchant-gateway-isolation.yml: Node 22 tests without secrets or real purchase requests.

Prepared documentation describes source-reviewed categories/services/service/balance/quote/checkout/add/status/history. It does not claim profile/check compatibility or webhooks. No generic third-party reseller protocol adapter implemented yet.

## Actual validation

11 isolated tests passed in GitHub Actions:
https://github.com/f90-card/f90-card-f90-card/actions/runs/39460736812
These cover JSON health, CORS preflight, method rejection, URL-secret rejection, key-format validation, conflicting credentials, malformed/oversized payloads, mocked POST destination and idempotency preservation, no automatic retry after ambiguous failure, Arabic guide/token view escaping and canonical endpoint.

Mock credentials are NOT valid trader credentials. These tests do not prove database authorization, financial atomicity, supplier execution or production /api/v1 availability.

Broader Payment safety checks failed before gateway tests at the core/UI regression step. Observed failing assertion: “Price UI shows only server quotes, one-digit cost, no decimal wallet, and compact limits”. app.js was not modified by this branch. Baseline execution was not performed, so this is not formally attributed as pre-existing.
https://github.com/f90-card/f90-card-f90-card/actions/runs/39460458290

## Requested delivery table

| المهمة | النتيجة | طريقة التحقق |
|---|---|---|
| إصلاح رابط API | جاهز على فرع مستقل؛ لم ينشر | اختبار alias معزول؛ الرابط الحي v1 ما زال HTML |
| مفاتيح التجار | فحص فقط؛ لم يعاد تفعيل أي مفتاح | SQL عددي وسجلات إلغاء/تدوير ومراجعة المصدر |
| دليل التاجر | نسخة عربية جاهزة غير منشورة | اختبار توليد HTML والهروب والرابط |
| استيراد الخدمات | مراجعة المصدر فقط؛ لم يختبر بمفتاح صحيح | لا ادعاء اختبار كتالوج تاجر حي |
| تنفيذ الطلبات | غير مختبر ماليًا | لم ينشأ أي طلب حقيقي |
| متابعة الطلبات | مسار المصدر مراجع، دون اختبار تاجر حي | لا ادعاء تحقق end-to-end |
| صور المنتجات | فحص 18 نقصًا؛ لم تعدل | SQL مباشر |
| ترتيب الأقسام | لم يعدل؛ 87 قسمًا مستخدمًا | SQL مباشر |
| سلامة الأسعار | البصمة متطابقة قبل/بعد، ولا كتابة للقاعدة | checksum لprice/currency فقط |
| اختبارات الأمان | نجاح اختبارات بوابة معزولة؛ ليست مراجعة أمان كاملة | GitHub Actions |
| نشر Cloudflare | لم ينفذ | فرع الإنتاج لم يغير |

## Fifteen mandatory acceptance tests

1. Valid merchant key: NOT RUN.
2. Invalid/revoked real key: NOT RUN; malformed credential formats rejected in unit tests only.
3. All eligible merchant services: NOT RUN.
4. Merchant categories/prices/images: NOT RUN end-to-end.
5. Real merchant balance: NOT RUN.
6. Safe isolated billable order: NOT RUN.
7. Real order status: NOT RUN.
8. Database idempotency/no double debit: NOT RUN; payload preservation/no gateway retry tested only.
9. Insufficient real test balance: NOT RUN.
10. Supplier secret non-disclosure: source reviewed; exhaustive API response audit NOT RUN.
11. Product base prices/currencies unchanged: checksum equal, no mutations.
12. Published official v1 endpoint: FAILED baseline (HTML), draft fix un-deployed.
13. Customer/admin purchase and deposit regression: NOT RUN live; broader UI CI failed.
14. Current logs/responses: key audit and GET metadata examined; full runtime error-log analysis NOT RUN.
15. External demo merchant: NOT RUN.

## Blockers and required next environment

The latest user instruction explicitly requires a restorable backup BEFORE production modifications. Previous historical backup waiver does not satisfy this renewed requirement. Existing closure report explicitly says no independent restore-tested database backup exists.
Connected management tools provide SQL/migrations/functions, not full PostgreSQL dump/restore. No confirmed authenticated Supabase dashboard browser profile is available. Local execution repeatedly returned “No usable execution environment is available”. No backup, restore, isolated database or paid branch was created, and no confidential data exported to GitHub.

Need a working secure backup/export-and-restore mechanism and isolated database/runtime before financial/backend changes and live merchant acceptance. Do not merge/deploy this draft as completed work or call the code snapshot a database backup.

## Merchant handoff — not yet production approved

Current GET metadata endpoint: https://www.f90card.online/api/merchant.
Intended versioned endpoint: https://www.f90card.online/api/v1 — DO NOT SEND AS WORKING until deployment and external tests pass.

Existing source flow: manager activates and verifies a trader account; trader opens #/developers, creates a token, copies it once, stores it on their server in F90_API_KEY, sends JSON POST with x-f90-key. Rotation replaces the previous active token. Server-side services/balance read tests must pass before checkout.
No active customer key was requested, recovered or disclosed. Full final merchant instructions remain gated on actual production acceptance.
