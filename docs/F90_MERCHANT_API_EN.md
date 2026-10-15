# F90 CARD Merchant API Documentation

This reference documents **F90 CARD's real production API**, not the supplier API.

## Endpoint and authentication

**Base endpoint:** `https://xzqnrpycjxfbyrfaolud.supabase.co/functions/v1/f90-platform`

**Method:** HTTP `POST` with `Content-Type: application/json`

**Required API header:** `x-f90-key: YOUR_F90_API_TOKEN`

Responses use `{"data": ...}` on success and `{"error":{"code":"F90_...","message":"..."}}` on failure.

A merchant must have a verified, active trader account. Only **one active token** is permitted per trader. A token rotation invalidates the previous token in the same database transaction. You can select permissions: `catalog`, `balance`, and `orders`; limit requests to 10–120 per minute; and set an expiration date.

**Allow all IP addresses** is intended for testing only. When disabled, the server requires a configured address in the allowlist and a client IP header from its platform gateway. IP restrictions are supplemental and must not replace secret-token authentication. Availability of a trustworthy client IP header must be checked with your deployment before enabling restrictions.

## Categories

Scope: `catalog`.

```http
POST https://xzqnrpycjxfbyrfaolud.supabase.co/functions/v1/f90-platform
Content-Type: application/json
x-f90-key: YOUR_F90_API_TOKEN

{"action":"categories"}
```

Response `data` is a list of objects with `id`, `name`, and `parent_id`.

## Products

Scope: `catalog`.

```json
{"action":"services"}
```

Returns `data` as an array of product objects. Useful fields include `service` (product UUID), `name`, `category`, `rate` (USD), `type`, `unit_quantity`, `min`, `max`, `quantity_step`, `fields`, `fulfillment` and `availability`.

Get one product:

```json
{"action":"service","service":"PRODUCT_UUID"}
```

Review the returned required fields, availability, and quantity settings. An unavailable/refilling product must not be ordered.

## Wallet balance

Scope: `balance`.

```json
{"action":"balance"}
```

Returns `{"data":{"balance":125.5,"currency":"USD"}}` (example). Financial ledger amounts use USD.

## Quote a service

Scope: `orders`. **Read-only**: does not charge a wallet.

```json
{"action":"quote","product_id":"PRODUCT_UUID","quantity":1}
```

Returns `data` with `subtotal_usd`, `discount_usd`, `total_usd`, and `quantity`.

## Create a paid order

Scope: `orders`. Uses your trader's wallet. **This creates a real order and may debit your wallet.** Generate a unique UUID reference for each intended order and reuse the *same reference* when recovering after a timeout.

```json
{
  "action":"checkout",
  "product_id":"PRODUCT_UUID",
  "quantity":1,
  "fields":{"account_id":"PLAYER_ACCOUNT"},
  "idempotency_key":"ecbdd545-e616-4aee-8770-7eefa977bcd0"
}
```

Use the exact `fields` required by the service. A first successful order returns status 201 and `{"data":{...order fields...}}`. Repeating the same reference with the same parameters returns the existing order, rather than creating another charge. Reuse of that reference with different data returns `F90_IDEMPOTENCY_CONFLICT`.

## Order status

Scope: `orders`.

```json
{"action":"status","id":"ORDER_UUID"}
```

Returns `{"data":{"order":{...},"events":[...],"requests":[]}}`. Only your own orders are visible.

## Order history

Scope: `orders`.

```json
{"action":"history","kind":"orders","offset":0}
```

Returns an object with `items` and `count`. Pages contain up to 50 entries.

## Error handling

| HTTP | Code | Meaning |
|---|---|---|
| 401 | F90_AUTH | Missing, revoked, invalid or expired token |
| 403 | F90_FORBIDDEN | Permission, role, status or IP blocked |
| 403 | F90_VERIFICATION_REQUIRED | Account verification required |
| 402 | F90_INSUFFICIENT_BALANCE | Insufficient funds |
| 400 | F90_QUANTITY | Invalid quantity |
| 400 | F90_FIELDS | Invalid or missing fields |
| 409 | F90_REFILLING | Service temporarily unavailable |
| 409 | F90_PRICE_CHANGED | Price changed |
| 409 | F90_IDEMPOTENCY_CONFLICT | Reference already used differently |
| 429 | F90_LIMIT | Too many requests |

The API uses **POST actions**, not the GET routes of Yassen Card. No webhook delivery is currently provided. Merchant tokens belong on the merchant's backend, never in public frontend code or a repository.

**Safety:** Avoid sending any paid order while testing an integration in production. Use the read-only catalog, balance, and quote actions first.
