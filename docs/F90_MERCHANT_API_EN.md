# F90 CARD Merchant API — Integration Guide
**English technical reference | الشرح العربي أسفل الأقسام**

> **Status:** The API routes, trader key creation, scopes, rate limiting, and usage logs below exist in F90 CARD. IP allowlists and Webhook delivery are **not yet implemented** and must not be assumed secure or active.

## 1. Getting access | تفعيل التاجر
1. Register an account in F90 CARD, complete identity verification, and request **Trader** role from the store administrator.
2. Log in and open `#/developers` in the store.
3. Create an API token for your **server**, selecting scopes `catalog`, `balance`, and/or `orders`, a rate limit (10–120 requests per minute), and an optional expiration.
4. **Copy the token when it is first shown**. F90 stores only its secure hash and a display prefix; later pages show the prefix, not the secret.
5. The owner can review traders, revoke and manage keys, and view usage in the administrative console.

**بالعربي:** الإدارة توافق على التاجر أولاً. ينشئ التاجر توكناً من حسابه، ويحفظه في خادم موقعه فقط، وليس في الواجهة العامة.

## 2. Endpoint | عنوان الاتصال
```text
POST https://xzqnrpycjxfbyrfaolud.supabase.co/functions/v1/f90-platform
Content-Type: application/json
x-f90-key: YOUR_SERVER_SIDE_TOKEN
```
All requests are JSON over HTTPS. A successful response contains `data`; failures return `error` and an appropriate HTTP status.

**بالعربي:** يُرسل الطلب من خادم التاجر. لا تُنسخ مفاتيح التاجر داخل HTML أو تطبيق الهاتف أو GitHub.

## 3. Read products and wallet | المنتجات والرصيد
```json
{"action":"categories"}
```
```json
{"action":"services"}
```
```json
{"action":"service","service":"PRODUCT_UUID"}
```
```json
{"action":"balance"}
```
Display only the items returned as orderable and honour the service's unit quantity, allowed quantity step, customer fields, fulfillment mode, availability and price. Prices are in USD unless the response explicitly specifies another currency.

**بالعربي:** يعرض `services` المنتجات والكمية وطريقة التنفيذ. راجع توافر المنتج والسعر قبل إنشاء الطلب.

## 4. Create an order | إنشاء طلب
The seller API exposes `add`; consult the live OpenAPI document and the API response for the precise service-specific customer fields. The standard shape is:
```json
{
  "action":"add",
  "service":"PRODUCT_UUID",
  "quantity":1000,
  "link":"CUSTOMER_ACCOUNT_IDENTIFIER",
  "idempotency_key":"merchant-order-000001"
}
```
Check the returned status and order identifier. **Never blindly retry an order after an ambiguous network failure.** Reuse the same idempotency key, inspect the order status, and request support when outcome is uncertain.

**بالعربي:** الطلب يخصم من المحفظة حسب صلاحيات التاجر. `idempotency_key` يحمي من تكرار نفس الطلب عند انقطاع الاتصال.

## 5. Order status | متابعة الطلب
```json
{"action":"status","order":"ORDER_UUID"}
```
Query periodically with sensible backoff. Some orders require manual review or supplier confirmation. A delayed answer is not a reason to create another order.

**بالعربي:** راقب الطلب باستخدام معرفه؛ لا تعِد إرساله لمجرد تأخر التنفيذ.

## 6. Example server-side call | مثال برمجي
```js
// Node.js 20+, executed on the merchant SERVER only.
const endpoint = "https://xzqnrpycjxfbyrfaolud.supabase.co/functions/v1/f90-platform";
const token = process.env.F90_API_KEY;
if (!token) throw new Error("F90_API_KEY missing");

async function f90(action, payload = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-f90-key": token
    },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(20000)
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error?.message || String(response.status));
  return body.data;
}
console.log(await f90("services"));
```

## 7. API token and monitoring | حماية المفتاح
- An approved verified trader can create, rotate by revoking and creating a new key, update granted scopes, and review server-recorded usage.
- Keep the token secret in a server environment variable. Do not log or paste it into client-side code.
- **Allowed source IP list:** NOT ACTIVE. No IP enforcement is applied by F90 to trader keys at this time. Do not show a list as though access is IP restricted.
- **Webhook URL:** NOT ACTIVE. F90 does not deliver signed status callbacks at this time. Use `status` polling.
- The owner can use **Admin → Traders & API** to review trader accounts, permissions, balances and keys.

**بالعربي:** حقول IP وWebhook مخطط لها وليست مفعّلة، لذلك لا تعتمد عليها لحماية المفتاح. الأساس الآن هو الصلاحيات والتوكن وتاريخ الانتهاء والحدود.

## 8. Standard integration documents | ملفات المبرمج
- `docs/openapi.json` — OpenAPI description supplied with F90
- `docs/postman.json` — Postman collection
- `docs/reseller-example.mjs` — server-side example
- `docs/F90_PROVIDER_PROTOCOL_EN.md` — incoming supplier protocol/adapter guidelines
- `docs/api-ar.md` — existing Arabic reference

## 9. Errors and operations | الأخطاء
Handle unauthorized, forbidden, insufficient balance, price changed and rate limited responses without retry storms. Distinguish a confirmed error from an uncertain network failure. In case of doubt, query order status and consult admin.

**بالعربي:** إذا انقطع الاتصال بعد عملية شراء فلا تعيد الطلب تلقائياً. راجع الحالة أولاً.

© F90 CARD — Technical merchant integration reference. This document contains no API secrets.
