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
    P.normalizeService({ service: 1, name: "خدمة اختبار", rate: -2, min: 1, max: 100 }),
    null,
  );
  assert.equal(
    P.normalizeService({ service: 1, name: "خدمة اختبار", rate: 2, min: 100, max: 1 }),
    null,
  );
  assert.equal(
    P.normalizeService({ service: 1, name: "خدمة اختبار", rate: 2, min: 1, max: 100 }).unit_quantity,
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

test("omega reads products with api-token and never creates paid orders", async () => {
  const calls = [];
  const provider = { endpoint: "https://api.mr-omegastore.shop", adapter: "omega" };
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), method: options.method, token: options.headers["api-token"] });
    return new Response(JSON.stringify([{ id: 7, name: "Test", price: 2 }]));
  };
  const products = await P.callProvider(provider, "test-key", "services", {}, fetcher);
  assert.equal(products[0].id, 7);
  assert.equal(calls[0].url, "https://api.mr-omegastore.shop/client/api/products");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].token, "test-key");
  await assert.rejects(P.callProvider(provider, "test-key", "add", {}, fetcher), /غير متاحة/);
  assert.equal(calls.length, 1);
});

test("Yassen uses the documented api-token endpoints and normalizes real product shapes", async () => {
  const calls = [];
  const provider = { endpoint: "https://api.yassen-card.com", adapter: "yassen" };
  const fetcher = async (url, options) => {
    calls.push([String(url), options.method, options.headers["api-token"], options.redirect]);
    return new Response(JSON.stringify([{ id: 365, name: "UC 60", price: 0.104,
      category_name: "PUBG", available: true, qty_values: { min: 1, max: "15000" },
      product_type: "amount", params: ["playerId"] }]));
  };
  const products = await P.callProvider(provider, "fixture", "services", {}, fetcher);
  assert.equal(calls[0][0], "https://api.yassen-card.com/client/api/products");
  assert.deepEqual(calls[0].slice(1), ["GET", "fixture", "manual"]);
  assert.equal(P.normalizeService(products[0]).unit_quantity, 1);
  assert.equal(P.normalizeService(products[0]).max, 15000);
  const tiny = P.normalizeService({ id: 366, name: "Amount", price: 0.000002,
    product_type: "amount", qty_values: { min: 1000, max: 100000 }, _f90_yassen: true });
  assert.equal(tiny.unit_quantity, 1000000);
  assert.equal(tiny.rate, 2);
  await assert.rejects(P.callProvider({ ...provider, endpoint: "https://example.com" },
    "fixture", "services", {}, fetcher), /عنوان API/);
});

test("provider request timeout follows validated operational settings", async () => {
  const original = AbortSignal.timeout;
  const observed = [];
  AbortSignal.timeout = (ms) => {
    observed.push(ms);
    return new AbortController().signal;
  };
  try {
    const fetcher = async () => new Response("[]", { status: 200 });
    await P.callProvider(
      { endpoint: "https://provider.example/api", adapter: "smm",
        config: { request_timeout_ms: 7000 } },
      "fixture", "services", {}, fetcher,
    );
    await P.callProvider(
      { endpoint: "https://provider.example/api", adapter: "smm",
        config: { request_timeout_ms: 100 } },
      "fixture", "services", {}, fetcher,
    );
    assert.deepEqual(observed, [7000, 20000]);
  } finally {
    AbortSignal.timeout = original;
  }
});

