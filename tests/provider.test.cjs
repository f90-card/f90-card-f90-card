const test = require("node:test"),
  assert = require("node:assert/strict");
let P;
test.before(async () => {
  P = await import("../supabase/functions/f90-platform/provider.mjs");
});
test("provider endpoints reject private networks, credentials and non-HTTPS", () => {
  for (const u of [
    "http://example.com",
    "https://localhost/api",
    "https://127.0.0.1/api",
    "https://192.168.1.1/",
    "https://10.0.0.1/",
    "https://user:pass@example.com/",
    "https://[::1]/",
  ])
    assert.throws(() => P.endpointURL(u));
  assert.equal(
    P.endpointURL("https://provider.example/api/v2").protocol,
    "https:",
  );
});
test("DNS checks reject a public hostname resolving to an internal address", async () => {
  await assert.rejects(
    P.callProvider(
      { endpoint: "https://provider.example/api", adapter: "smm" },
      "fixture",
      "services",
      {},
      async () => {
        throw Error("must not fetch");
      },
      async () => ["10.0.0.7"],
    ),
    /غير مسموح/,
  );
});
test("network ambiguity after an add request does not become an automatic retry", async () => {
  const error = await P.callProvider(
    { endpoint: "https://provider.example/api", adapter: "smm" },
    "fixture",
    "add",
    { service: 1 },
    async () => {
      throw Error("timeout");
    },
  ).catch((x) => x);
  assert.ok(error instanceof P.ProviderError);
  assert.equal(error.uncertain, true);
});
test("explicit rejection is distinguishable from transport ambiguity", async () => {
  const error = await P.callProvider(
    { endpoint: "https://provider.example/api", adapter: "smm" },
    "fixture",
    "add",
    {},
    async () => new Response('{"error":"insufficient"}'),
  ).catch((x) => x);
  assert.equal(error.uncertain, false);
});
test("partial upstream result refunds proportional unfulfilled units", () => {
  assert.deepEqual(
    P.normalizeStatus({ status: "Partial", remains: 250 }, 10, 1000),
    { status: "partial", refund: 2.5 },
  );
  assert.equal(
    P.normalizeStatus({ status: "Partial", remains: 2000 }, 10, 1000).status,
    "review",
  );
  assert.equal(
    P.normalizeStatus({ status: "Completed" }, 10, 1000).status,
    "completed",
  );
});
test("upstream service import rejects malformed prices and invalid bounds", () => {
  assert.equal(
    P.normalizeService({ service: 1, rate: -2, min: 1, max: 100 }),
    null,
  );
  assert.equal(
    P.normalizeService({ service: 1, rate: 2, min: 100, max: 1 }),
    null,
  );
  assert.equal(
    P.normalizeService({ service: 1, rate: 2, min: 1, max: 100 }).unit_quantity,
    1000,
  );
  for (const unit_quantity of [0, -1, 0.5, 1000000001, "invalid"])
    assert.equal(
      P.normalizeService({
        service: 1,
        rate: 2,
        min: 1,
        max: 100,
        unit_quantity,
      }),
      null,
    );
});
test("recovery keeps the password route and only accepts an approved HTTPS origin", () => {
  const origins = ["https://store.example"];
  assert.equal(
    P.recoveryRedirect("https://store.example/index.html#/reset", origins).href,
    "https://store.example/index.html#/reset",
  );
  for (const url of [
    "https://other.example/index.html#/reset",
    "https://user:pass@store.example/",
    "http://store.example/",
    "javascript:alert(1)",
  ])
    assert.throws(() => P.recoveryRedirect(url, origins));
});
