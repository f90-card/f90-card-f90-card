# Historical reconciliation requiring an approved operator path

Status: NOT EXECUTED. This document is a review specification, not permission to bypass the connector's previously rejected financial write.

## Verified scope
- Source: `xzqnrpycjxfbyrfaolud`, read-only throughout this continuation.
- Destination: `ogkipkavlywgwhtomoca` only.
- Source completed manual order number 32 still exists: total USD 440; created 2026-10-19 02:52:41.906749 UTC; updated 02:59:36.778622 UTC.
- Source counts: 28 orders / 71 order events / 56 ledger rows. Destination: 27 / 69 / 55.
- Prior checkpoint identifies events 78 and 79 and the original debit belonging to the same order. The corresponding destination wallet must be reconciled to the source snapshot, not charged through checkout.

## Required reviewed transaction
1. Obtain a fresh consistent source snapshot; compare all current IDs, historical row fingerprints, balances, new deposits/withdrawals and in-flight orders. A maintenance barrier is required for the final cutover snapshot.
2. Lock only affected destination rows in one transaction. Abort if source order status/amount/IDs, destination expected prior wallet or any related row has changed. Verify original user/product/provider foreign keys.
3. Import exact original completed order, events and ledger row, retaining primary keys, identity values, timestamps, idempotency key and original balance-after. No checkout RPC, wallet credit/debit RPC, provider API, webhook or new-order notification is permitted.
4. Review named notification triggers with the database operator. Do not disable all triggers, foreign keys, RLS or global session replication protections. No replay of original notifications or supplier dispatch.
5. Reconcile the destination wallet to its verified source snapshot once, atomically with the historical rows. Existing matching rows make the operation a verified no-op; conflicting rows cause rollback.
6. Before commit assert exact source/destination affected-row fingerprints, ledger sum and wallet parity, expected event/ledger/order counts, unchanged financial data for other customers, no new notification queue entries and zero target cron jobs.
7. Verify identity sequences remain ahead of actual imported maxima. Keep an audit entry and before/after non-sensitive fingerprints. Never publish customer fields or password data in GitHub.

## Required access
The existing connector rejected the financial DML in an earlier session. It exposes no documented approval control or historical-import operation that clears that rejection. An authorized database operator must supply a sanctioned, reviewed execution path. Do not retry the blocked write through Edge Functions, alternate SQL tools, credentials, or trigger suppression.

Do not switch DNS, enable target checkout or start target supplier jobs while this gate is open. User authorization for the overall migration does not remove a technical tool restriction.
