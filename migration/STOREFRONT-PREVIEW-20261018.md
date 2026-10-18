# F90 CARD — Cloudflare storefront staging readiness

This project is an **isolated, read-only storefront preview**, not a live payment store.

- GitHub: `f90-card/f90-card-f90-card`, branch `migration/cloudflare-supabase-20261018`.
- Cloudflare Pages: `f90-card-migration`, build command `node migration/build-storefront-preview.mjs`, output `dist-f90-storefront-preview`.
- Reads public catalog from new Supabase `ogkipkavlywgwhtomoca`. The publishable key is **public**, but no service-role or DB passwords appear in source or output.
- Build removes server-side APIs, migration materials, SQL, tests, marketing, social scheduling archives and raw repo documentation.
- `index.html` and `admin.html` include a read-only CSS shield disabling pointer clicks and a visible red "preview only" indicator. Authentication session persistence and token refresh are disabled; checkout must not be tested in this preview.
- No domain mapping to `www.f90card.online`. Existing Vercel and old Supabase production are untouched.
- The current preview **does not reproduce Vercel serverless API routes**, and is not a functional Cloudflare production release. Such routes must be adapted to Workers/Pages Functions with secure bindings before cutover.
- A final launch additionally requires restoring all 19 customers, 20 Auth identities, wallet balances and ledgers, orders, RLS, original SQL functions and safe provider secrets. New staging contains 3 partial Auth users and 0 wallets.
- All icons remain a one-time curated snapshot; future replacements are manual.

Checks before considering preview complete:
1. Cloudflare build reaches success, with `F90_STAGING_READ_ONLY` logged.
2. Deployment file list contains `index.html`, `admin.html`, `f90-logo.png`, `config.js`.
3. The root URL displays read-only warning. No checkout or authentication test until original users are restored and authorization is audited.
4. Disable automatic GitHub builds again to avoid repeat load.
