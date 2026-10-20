import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const merchantSource = await readFile(new URL("functions/api/merchant.js", root), "utf8");
const merchantURL = "data:text/javascript;base64," + Buffer.from(merchantSource).toString("base64");
const versionedSource = (await readFile(new URL("functions/api/v1.js", root), "utf8"))
  .replace('"./merchant.js"', JSON.stringify(merchantURL));
const { onRequest } = await import("data:text/javascript;base64," + Buffer.from(versionedSource).toString("base64"));
const invoke = (method, headers = {}, body, query = "") => onRequest({
  request: new Request("https://www.f90card.online/api/v1" + query, {method, headers, ...(body === undefined ? {} : {body})})
});
test("versioned health advertises the actual route and legacy compatibility", async () => {
  const r = await invoke("GET");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /application\/json/);
  assert.equal((await r.json()).endpoint, "https://www.f90card.online/api/v1");
  assert.equal(r.headers.get("cache-control"), "no-store");
});
test("OPTIONS allows merchant header and POST", async () => {
  const r = await invoke("OPTIONS");
  assert.equal(r.status, 204);
  assert.match(r.headers.get("access-control-allow-headers"), /X-F90-Key/i);
  assert.match(r.headers.get("access-control-allow-methods"), /POST/);
});
test("unsupported method fails explicitly", async () => {
  assert.equal((await invoke("DELETE")).status, 405);
});
test("URL credentials are rejected even on health requests", async () => {
  assert.equal((await invoke("GET", {}, undefined, "?key=never-log-secrets")).status, 400);
});
test("missing key and Supabase keys cannot pass gateway validation", async () => {
  for (const token of ["", "sb_secret_example", "eyJhbGciOiJIUzI1NiJ9.fake.jwt"]) {
    const r = await invoke("POST", {"x-f90-key":token}, '{"action":"balance"}');
    assert.equal(r.status, 401);
  }
});
const fakeKey = "f90_live_" + "a".repeat(64);
test("conflicting header credentials fail", async () => {
  const r = await invoke("POST", {"x-f90-key":fakeKey, Authorization:"Bearer f90_live_"+"b".repeat(64)}, '{"action":"services"}');
  assert.equal(r.status, 400);
});
test("malformed JSON fails before contacting production", async () => {
  const r = await invoke("POST", {"x-f90-key":fakeKey}, "{bad");
  assert.equal(r.status, 400);
});
test("oversized payload is rejected", async () => {
  const r = await invoke("POST", {"x-f90-key":fakeKey,"content-length":"65537"}, "{}");
  assert.equal(r.status, 413);
});
test("POST targets only new Supabase, preserves request idempotency and strips unsafe headers", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({url, options});
    return Response.json({data:{id:"test-order"}}, {status:201});
  };
  try {
    const body = JSON.stringify({action:"add",service:"test-service",idempotency_key:"stable-reference-123"});
    const r = await invoke("POST", {"x-f90-key":fakeKey,"x-f90-worker":"must-not-forward","apikey":"must-not-forward"}, body);
    assert.equal(r.status, 201);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-platform");
    assert.equal(calls[0].options.body, body);
    assert.equal(calls[0].options.headers["x-f90-key"], fakeKey);
    assert.equal(calls[0].options.headers["x-f90-worker"], undefined);
    assert.equal(calls[0].options.headers.apikey, undefined);
  } finally { globalThis.fetch = original; }
});
test("ambiguous upstream failure returns an error without an automatic retry", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("network"); };
  try {
    const r = await invoke("POST", {"x-f90-key":fakeKey}, '{"action":"checkout","idempotency_key":"stable-reference-123"}');
    assert.equal(r.status, 502);
    assert.equal(calls, 1);
    assert.equal((await r.json()).error.code, "F90_UPSTREAM");
  } finally { globalThis.fetch = original; }
});

test("Arabic merchant guide and token view render safely with one canonical endpoint", async () => {
  const source = await readFile(new URL("f90-merchant-v2.js", root), "utf8");
  const window = {};
  new Function("window", "document", source)(window, {addEventListener(){}});
  const guide = window.F90MerchantViews.docs("https://wrong.example", '/logo.png');
  assert.match(guide, /دليل التاجر وربط المتاجر/);
  assert.ok(guide.includes("https://www.f90card.online/api/v1"));
  assert.ok(!guide.includes("wrong.example"));
  const tokenView = window.F90MerchantViews.tokens([], true, "/logo.png", "https://wrong.example");
  assert.ok(tokenView.includes('id="keyForm"'));
  assert.ok(tokenView.includes("https://www.f90card.online/api/v1"));
  assert.ok(!tokenView.includes("wrong.example"));
  assert.ok(!window.F90MerchantViews.docs("", '"><script>injected</script>').includes('"><script>injected</script>'));
});
