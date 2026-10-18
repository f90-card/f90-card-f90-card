# F90 CARD migration — activation and customer delta checkpoint (2026-10-18)

## Domain activated
- Cloudflare zone `f90card.online`: **ACTIVE** as confirmed by Cloudflare zone API.
- Registrar is Spaceship; authoritative nameservers were updated by the owner to:
  `danica.ns.cloudflare.com` and `troy.ns.cloudflare.com`.
- Seven DNS records confirmed on Cloudflare: apex A `76.76.21.21`, WWW CNAME `cname.vercel-dns.com`, 2 Resend CNAMEs, MX, TXT Google verification and Resend DKIM.
- **Public website remains on Vercel**. NO domain routing to Cloudflare Pages staging site, NO changes to live checkout.

## Continued live-data synchronization
- A new production Auth user appeared since previous snapshot. Transferred **one newly added user** and corresponding identity, profile, role, wallet and user discounts to new Supabase `ogkipkavlywgwhtomoca`.
- Compared all credential hash fingerprints, identities, wallets, roles, and orders between source `xzqnrpycjxfbyrfaolud` and target after the delta: all matched.
- Refreshed 3 out-of-sync profiles in the **new database only**. Verified all 20 profile row fingerprints match source at check.
- Source and target now both have **20 users**, **21 identities**, **20 wallets**, with identical relevant fingerprints at check.
- Target `cron.job`: **0 active jobs**, so target is not auto-fulfilling supplier orders or sending background jobs.
- Source remains authoritative while it accepts live writes. Later data changes must be synced again at final cutover.

## Critical issues still preventing safe production cutover
- Source Storage has 702 objects, target Storage 0. Protected receipt/identity attachments **not physically copied**. Do not make private buckets public.
- New Supabase Auth Google OAuth/SMTP/redirect settings and real sign-in end-to-end tests not yet verified.
- Static Cloudflare Pages storefront is intentionally noninteractive. Financial checkout RPC execution is still restricted until the full production flow is validated.
- Final ordering/financial source write freeze, final delta, rollback and complete functional regression test are mandatory. Old storefront should remain available until success.
- Supabase free Storage/egress use must be kept within quota; original photo/radio archive must not be blindly copied.

**Do not claim migration is finished or change www records to Cloudflare Pages yet.**
