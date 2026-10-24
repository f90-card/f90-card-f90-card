# F90 CARD account security release — 2026-10-24

Production base: Cloudflare Pages `f90-card-acceptance`, branch `migration/cloudflare-supabase-20261018`, commit `bef7a31afe5615f86dc8e7d3a15356ad8ca37152`. Production backend: `ogkipkavlywgwhtomoca`. No changes to the old project, suppliers, currencies, pricing, orders or balances.

Live Supabase source was retrieved before editing: f90-platform 30; f90-security-activity 4. The source and original retention command were preserved before changes. Source rollback copies are retained locally and production's prior deployment remains available. Schema changes are additive, except extension of the existing retention command; no customer history was deleted during development.

## Implemented

- First-party `/api/security-activity` signs Cloudflare IP/coarse country/city/ASN metadata using a server secret in Cloudflare and Supabase Vault. The signature binds body, Authorization hash and a 90-second time window. Forged client IP fields are ignored; direct unsigned record requests are denied. No signing key or Supabase service key is shipped to the browser.
- Visible-session heartbeat every 60 seconds, customer-security dashboard refresh every 15 seconds. Recent activity is distinguished from an authenticated session; it is not an assertion of continuous presence.
- Optional precise location requires a separate affirmative UI action plus browser permission. Declining does not prevent shopping. Stopping sharing clears saved precise locations across the user's observed sessions; failed clears are retried. Pending geolocation results cannot override revoked consent. Device model is reported only when browser hints provide it; user label is voluntary. No claim to detect owner name, internal IP, MAC or IMEI.
- Manager session UI lists both observed sessions and Auth sessions lacking a browser observation, with names, account IDs, first/last times, status and source. Search, date/status filters, 50-row pagination, individual revocation and per-account logout-all are supported. Current manager session is protected server-side.
- Revocation performs the Supabase Auth `LogoutSession`/`Logout` database operation (`auth.sessions` deletion with refresh-token FK cascade), preserving the security observation log. This matches Supabase Auth's implementation, not merely deletion of a telemetry record. Existing sensitive APIs and database role checks validate live `session_id`, rejecting unexpired JWTs after revocation.
- Security controls, verification approval/revocation, permission changes and security audit reads require a validated manager session with AAL2. The UI offers TOTP enrollment/challenge.
- Verification change and reason/audit are atomic. No document erasure, account role or wallet update is performed.
- Security alerts aggregate repeated failed official-site logins and invalid merchant keys; new sessions, combined country+OS/browser change, administrative denials, verification/permission changes and revocations are included. IP change alone never creates a suspicion alert. Similar events aggregate in 15-minute buckets. Review acknowledgement and its reason are atomic with audit.
- Existing configured Telegram delivery is reused for generic security notices when enabled, without credentials, IP, precise location or documents. No new external messaging destination is configured.
- Existing cron id 6 / `f90_security_sessions_expire_30d` remains a single job, also clearing old alert counters. Security data tables/views/control RPCs remain service-only; browser access passes through authenticated role/session checks.

## Validation already completed before frontend deployment

- 19 live backend assertions with four disposable zero-balance accounts (manager, limited admin, trader, customer), actual Auth-issued JWTs, actual TOTP challenge and a scoped fixture merchant key.
- Denial without authentication, customer/trader/admin denial, key denial, manager AAL1 denial, manager AAL2 listing.
- Actual single-session revocation, old unexpired access JWT rejection, refresh-token rejection, other-session preservation, current-manager protection.
- Required verification reason; revoke/reapprove; immediate loss and restoration of fixture merchant access.
- Transactional rollback test: verification preserves wallet, role and document; new-session audit unique; IP-only change creates no suspicion; combined change creates alert; failure threshold/deduplication; exact 30-day deletion statements remove an old fixture. All mutations in this SQL test rolled back.
- RLS and no customer/anonymous SELECT or control/secret RPC grants verified after migrations. One active retention job verified.
- 118 CJS + 167 MJS automated tests passed before frontend deployment, including gateway signing, consent race, XSS escaping, cancellation without mutation and existing financial/provider/auth regressions.
- Production artifact build succeeded using the new backend; no old image-storage dependencies.

## Limits and rollback

Coarse IP geolocation is an approximation and can reflect VPN/proxy networks. Existing old records are not relabelled as trustworthy geolocation. Supabase Auth fallback IP can reflect an intermediary and is explicitly labelled. Browser-reported model/name cannot establish physical ownership. Optional coordinates include accuracy and measured time, not a claim of certainty.

The official login gateway observes password failures through that gateway. Direct calls to Supabase Auth remain governed by Supabase's own protections and logs; this dashboard does not pretend to have a complete stream of those failures. Old data cannot be reconstructed retroactively.

Rollback: restore the prior Pages deployment and pre-change live Edge sources together; leave additive schema in place. Restore cron's original command if rolling back alert retention: `delete from public.f90_security_sessions where last_seen_at < now() - interval '30 days'`. Do not delete Vault's signing secret until all deployed producers/consumers using it have been retired. Never restore financial data from a security release.

Final deployed-domain acceptance and browser verification are recorded separately after deployment; they are not implied by the pre-deployment checks above.
