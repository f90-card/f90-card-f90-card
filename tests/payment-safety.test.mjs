import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../api.js", import.meta.url), "utf8");

function mockClient(fetchImpl) {
  const window = {
    F90_CONFIG: { SUPABASE_URL: "https://example.test", SUPABASE_KEY: "public-test-key" },
    f90Supabase: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: "test-session" } } }),
      },
    },
  };
  vm.runInNewContext(source, { window, fetch: fetchImpl, crypto: {}, console, AbortController, setTimeout, clearTimeout });
  return window.F90API;
}

test("successful API response returns its data and forwards action", async () => {
  let request;
  const api = mockClient(async (url, opts) => {
    request = { url, opts };
    return { ok: true, status: 200, json: async () => ({ data: { ok: true } }) };
  });
  const result = await api.call("transaction.lookup", { idempotency_key: "test-ref-001" });
  assert.equal(result.ok, true);
  assert.equal(JSON.parse(request.opts.body).action, "transaction.lookup");
  assert.equal(request.opts.cache, "no-store");
});

test("explicit 409 rejection keeps error code and is not uncertain", async () => {
  const api = mockClient(async () => ({
    ok: false, status: 409,
    json: async () => ({ error: { code: "F90_PRICE_CHANGED", message: "تغيّر السعر" } }),
  }));
  await assert.rejects(api.call("checkout"), (error) => {
    assert.equal(error.code, "F90_PRICE_CHANGED");
    assert.equal(error.status, 409);
    assert.equal(error.uncertain, false);
    return true;
  });
});

test("network failure is an uncertain outcome", async () => {
  const api = mockClient(async () => { throw new TypeError("connection lost"); });
  await assert.rejects(api.call("deposit.submit"), (error) => {
    assert.equal(error.uncertain, true);
    return true;
  });
});

test("unparseable 502 response is uncertain", async () => {
  const api = mockClient(async () => ({
    ok: false, status: 502, json: async () => { throw new SyntaxError("bad gateway"); },
  }));
  await assert.rejects(api.call("checkout"), (error) => {
    assert.equal(error.uncertain, true);
    return true;
  });
});

test("unparseable 400 response is a definite rejection", async () => {
  const api = mockClient(async () => ({
    ok: false, status: 400, json: async () => { throw new SyntaxError("bad request"); },
  }));
  await assert.rejects(api.call("checkout"), (error) => {
    assert.equal(error.uncertain, false);
    return true;
  });
});

test("checkout and deposit recover only from uncertain failures", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const checks = app.match(/if \(!error\.uncertain\) throw error;/g) || [];
  assert.equal(checks.length, 2);
  assert.match(app, /A\.call\("transaction\.lookup", \{ kind: "order"/);
  assert.match(app, /A\.call\("transaction\.lookup", \{ kind: "deposit"/);
  assert.match(app, /S\.pendingDepositReceipt\.details !== depositDetails/);
});
