# F90 CARD: secure email notices for new deposits

**Deployment status, 2026-10-14**
- Pending deposit trigger installed: `f90_new_deposit_email_queue`.
- Private queue: `f90_private.deposit_email_queue` (RLS enabled, not readable from frontend).
- Delivery Edge Function deployed: `f90-deposit-mail`, JWT verification **enabled**.
- Server-only queue claim and result RPCs: `public.f90_mail_claim_batch` and `public.f90_mail_complete`; execute permissions for `service_role` only.
- Each new pending deposit produces one job per configured administrator address, de-duplicated by `(deposit_id,recipient)`.
- Email message is intentionally generic, only mentioning a pending deposit and linking to the protected admin dashboard. It never sends receipt images, customer contact details, passwords or keys.
- Resend acknowledges an API request before the job is marked `sent`; it does not prove inbox delivery.

## NOT ACTIVE YET: required owner/provider configuration
To enable *actual* automatic delivery, first obtain a transactional email service account and sender authorization. In Supabase → Edge Functions → Secrets, set:

- `RESEND_API_KEY`: valid private Resend API key
- `F90_EMAIL_FROM`: verified sender such as `F90 CARD <notice@owned-domain.example>`
- `F90_EMAIL_DISPATCH_SECRET`: random secret (28+ bytes of entropy)

No real value for these secrets has been installed during this build. **Never put them in public GitHub or browser JS.**

Configure a trusted server-side scheduler or trigger to POST to:
```
https://xzqnrpycjxfbyrfaolud.supabase.co/functions/v1/f90-deposit-mail
Authorization: Bearer <SECURE_SUPABASE_SERVER_JWT>
x-f90-dispatch-secret: <PRIVATE_F90_EMAIL_DISPATCH_SECRET>
Content-Type: application/json
```
Store the scheduler's credentials in protected Supabase Vault/secret manager, not publicly accessible database rows. An administrator should test the handler with a valid secret; the function returns 503 if the sender provider isn't configured, and must not be treated as working while 503 is returned.

## How it works
1. New pending deposit is saved in `public.f90_deposits` (normal verified F90 workflow).
2. Trigger creates private queue jobs without generating an outgoing customer-facing message.
3. The authenticated worker claims up to 10 jobs with row locks and retry limits.
4. Worker sends via Resend REST API with a stable idempotency key per recipient/job.
5. Worker records success/error; failed calls retry only after a delay.
6. The owner checks whether messages appear in the two inboxes and records evidence.

## Acceptance criteria
- [ ] Provider key configured and sender verified
- [ ] Scheduler securely invokes Edge Function after deposit with no publicly exposed key
- [ ] Worker shows `accepted > 0` on a controlled test notification
- [ ] Both recipient inboxes receive the mail and correct admin link
- [ ] Repeated trigger or retried job doesn't create duplicate messages
- [ ] Existing deposits and customer balances remain unchanged

Until all acceptance items pass, state the status accurately as **queue + sender deployed; actual email delivery not enabled**.
