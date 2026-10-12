import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Static regression guards only. They are NOT a substitute for Supabase
// integration tests or transaction-concurrency tests.
const source = readFileSync(new URL("../supabase/functions/f90-platform/index.ts", import.meta.url), "utf8");
const slice = (start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "Missing API action block: " + start);
  return source.slice(a, b);
};

test("account verification is enforced for checkout and deposits", () => {
  const checkout = slice('if (action === "checkout" || action === "add")', 'if (action === "status" || action === "order")');
  const deposit = slice('if (action === "deposit.submit")', 'if (action === "profile.save")');
  assert.match(checkout, /select\("is_verified"\)/);
  assert.match(checkout, /if \(!verification\.is_verified\) throw new AppError\("F90_VERIFICATION_REQUIRED"/);
  assert.match(deposit, /select\("is_verified"\)/);
  assert.match(deposit, /if \(!verification\.is_verified\) throw new AppError\("F90_VERIFICATION_REQUIRED"/);
});

test("reference-based recovery is read-only and scoped to the account", () => {
  const action = slice('if (action === "transaction.lookup")', 'if (action === "status" || action === "order")');
  assert.match(action, /if \(a\.keyId\) throw new AppError\("F90_FORBIDDEN"\)/);
  assert.equal((action.match(/\.eq\("user_id", a\.id\)/g) || []).length, 2);
  assert.equal((action.match(/\.eq\("idempotency_key", reference\)/g) || []).length, 2);
  assert.doesNotMatch(action, /\.insert\(|\.update\(|\.delete\(|rpc\("f90_checkout"|rpc\("f90_submit_deposit"/);
});

test("checkout and deposit use idempotency keys and reject conflicting payloads", () => {
  const checkout = slice('if (action === "checkout" || action === "add")', 'if (action === "status" || action === "order")');
  const deposit = slice('if (action === "deposit.submit")', 'if (action === "profile.save")');
  assert.match(checkout, /paymentReference\(b\.idempotency_key\)/);
  assert.match(checkout, /F90_IDEMPOTENCY_CONFLICT/);
  assert.match(checkout, /p_key: reference/);
  assert.match(deposit, /paymentReference\(b\.idempotency_key\)/);
  assert.match(deposit, /F90_IDEMPOTENCY_CONFLICT/);
  assert.match(deposit, /p_key: reference/);
});

test("supplier imports are drafts and Omega imports stay blocked", () => {
  const imports = slice('if (action === "provider.import")', 'if (action === "provider.sync_prices")');
  assert.match(imports, /importAdapter\.adapter === "omega"/);
  assert.match(imports, /is_active: false/);
  assert.match(imports, /b\.service_ids\.length > 100/);
});

test("supplier price updates require preview fingerprint confirmation", () => {
  const sync = slice('if (action === "provider.sync_prices")', 'if (action === "staff.worker")');
  assert.match(sync, /if \(b\.dry_run === true\) return preview/);
  assert.match(sync, /confirm_fingerprint/);
  assert.match(sync, /if \(text\(b\.confirm_fingerprint/);
});

test("public quote and checkout cannot apply legacy coupons", () => {
  assert.equal((source.match(/p_coupon: ""/g) || []).length >= 3, true);
  assert.doesNotMatch(source, /p_coupon: text\(b\.coupon/);
});
