# F90 CARD — Deposit Email Notifications (integration handoff)

**Current state: prepared, not delivering.** The database stores one private delivery job for each approved recipient on each **new pending deposit**. No emails are sent until a transactional email provider is connected and an authenticated worker is deployed.

## Security architecture
- Trigger: `f90_new_deposit_email_queue` on `public.f90_deposits`, only for `NEW.status = 'pending'`.
- Delivery queue: `f90_private.deposit_email_queue`, private schema, RLS enabled, no direct access for anonymous or authenticated browser clients.
- Two destination addresses have been stored in the private SQL trigger; they are **not** published in the frontend or this repository.
- Uniqueness: `(deposit_id, recipient)` prevents duplicate notifications for the same event.
- Queue statuses: pending / sending / sent / failed / disabled.
- There are **no SMTP credentials, Resend API keys or sender-domain credentials** in GitHub.

## To activate instant email delivery
1. Connect a transactional mail provider such as **Resend** to F90 administration.
2. Verify a sender domain you control. Set the sender and the mail provider API key in **Supabase Edge Function secrets only**.
3. Create a worker with service-level authentication; do not expose a public unauthenticated endpoint. Read a batch of pending queue rows, mark each as sending with atomic claim, send to the designated recipient, and mark as sent or failed.
4. Dispatch the worker through a trusted database webhook or `pg_net` with a stored secret, not by passing the provider API key in browser code.
5. Send **only minimal details:** “إيداع جديد في F90 CARD. ادخل لوحة الإدارة لمراجعته” with a link to the admin. Never attach receipts, passwords, customer identity documents, full payment details or keys.
6. Rate-limit, bound retries, record failure reasons, and monitor provider delivery receipts. Mark success **only after** provider API acknowledges acceptance; an API acknowledgment still does not prove inbox arrival.
7. Test once with a controlled pending deposit in a staging or dedicated test account. Do not use a real customer balance as a test.

## Required secrets
- `RESEND_API_KEY`: configured privately through Supabase.
- `RESEND_FROM`: verified sender, e.g. `F90 CARD <notify@verified-domain.example>`.
- Dedicated worker authentication secret.

**Do not enable this feature or tell customers email is active until a live delivery test passes.**

Reference: https://supabase.com/docs/guides/functions/examples/send-emails
