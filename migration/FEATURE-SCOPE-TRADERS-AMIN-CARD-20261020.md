# F90 CARD — trader, partner, pricing and UX implementation scope (2026-10-20)

## Baseline verified directly against new production Supabase
- Existing tables: f90_trader_referrals (customer_id,trader_id,percent,product_ids,effective_at), f90_trader_commissions (order_id,customer_id,trader_id,percent,earned_usd,revision,account_currency,rate_snapshot,amount_currency,last_error), f90_trader_commission_events.
- Existing isolated partner models: f90_partner_spaces (owner_id,contacts,collaboration_image), categories, products (currency,price,purchase_url), banners (placement,link_url).
- Current counts of trader referrals, trader commissions, partner spaces, partner products, partner banners: all zero. No production end-to-end partner payout or page acceptance was proven.
- New prod Supabase project ogkipkavlywgwhtomoca, new production site https://www.f90card.online, deploy branch migration/cloudflare-supabase-20261018. Preserve manual service price overrides and prior migration work. Do not touch unrelated agency project.

## Required implementation / acceptance gates
1. Trader referral program: admin assigns existing customer to trader, set configurable percentage and permitted products, forbid self-referral and duplicate or overlapping attribution, ensure idempotent commission on successful eligible purchase, reversals/refunds and retry-safe ledger. Payout should use trader account currency and FX rate snapshot sourced from current site configuration. Verify with controlled test transactions and no double credit. Provide merchant-API token issuance, scoped permissions, docs on new canonical domain, signed webhook and isolated rate limits.
2. Partner role named **الأمين كارد**: role restricted to one assigned partner space. Only manage owned categories/products/banner assets/contact/social links/collaboration image and observe per-partner active/inactive service counts and image quota. Allowed currencies USD, ILS, JOD, EGP, EUR with partner-defined pricing; partner purchases redirect to controlled WhatsApp URL, never charge F90 wallet. No access to F90 admin global pages, settings, prices, customers, wallets or orders. Enforce RLS and privileged RPC ownership checks server-side. Allow admin override. Do not grant role/ownership to an unspecified account.
3. Image budget: maximum 200 partner images total, each <=5 MiB; server-side storage policies and atomic per-owner quota, safe type/path checks, count and remaining-budget UI. Ensure no accidental access to other suppliers' images.
4. Partner placement: owned sections on homepage, partner image banners in main carousel and smaller lower banner, link URLs only for owned adverts, owner/admin-controlled co-branded logo only between homepage banners and F90 introduction with no link/text, dedicated **تواصل مع الأمين كارد** social/email/phone links.
5. Volume-based prices: per-product configurable nonoverlapping integer quantity bands, explicit inclusive min/max and unit price semantics; 1–999999 tier vs 1000000–50000000 tier sample; preserve fixed-price and manual overrides and supplier conversions; validate quotes on server to prevent manipulation or tier-boundary gaps, rates and rounding tested.
6. Purchase UI: single compact responsive modal with service, min/max, amount, required account ID/email field based on product, real-time displayed price and currency, direct purchase action; no duplicate confirmation page or wallet before/after display. Require secure server-side quote and purchase confirmation behind single click. Preserve accessibility/errors.
7. Maintenance: countdown completion triggers automatic retry/revalidation of live site status with safe polling/backoff; no stuck maintenance page.
8. Order history: map internal supplier statuses to user-friendly pending/completed/failed; hide provider names/IDs/supplier submission and other internals, keep appropriate receipt data accessible if needed.
9. Remove banners embedded within category pages. Simplify admin and user views carefully with inventory of current routes and permission checks; no destructive bulk cleanup without route dependency tests.
10. Domain consistency: www.f90card.online canonical links, API/redirect/webhook docs, Google Auth callback and merchant endpoint examples. Do not leak old endpoint project IDs in shipped assets. Test on Cloudflare Pages live deployment and confirm partner and merchant flows in browser.
11. Deliver per-feature GitHub commits and automated/owner acceptance with mobile desktop screenshots; update final closure only after functional testing.

## Explicit non-goals and protection
- Don't rewrite project from scratch, delete existing customers/orders, alter manual price overrides or user balances during exploratory work.
- Don't decommission old Supabase/Vercel yet, and don't touch separate agency project.
- Do not claim features shipped solely because corresponding database tables exist.
- Current report is an implementation audit and requirement specification, not a completed feature release.
