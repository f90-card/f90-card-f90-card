const test = require("node:test"),
  assert = require("node:assert/strict");
const { harness, fixture } = require("./dom-harness.cjs");
test("home consists of image tiles without repeated category captions", async () => {
  const h = await harness();
  const tile = h.document.querySelector('.image-tile[aria-label="الألعاب"]');
  assert.ok(tile);
  assert.equal(tile.getAttribute("aria-label"), "الألعاب");
  assert.equal(tile.querySelector("h3"), null);
  assert.match(h.document.getElementById("mainContent").textContent, /تعرّف على أف تسعين كارد/);
  assert.equal(h.document.getElementById("languageSelect"), null);
  assert.equal(h.document.getElementById("languageButton"), null);
  h.cleanup();
});
test("nested category opens minimal pack options", async () => {
  const h = await harness("index.html", { hash: "#/category/pubg" });
  assert.ok(h.document.querySelector(".image-grid"));
  assert.ok(h.document.querySelector('[data-action="quick-product"][data-id="coins"]'));
  assert.ok(h.document.getElementById("categoryFilter"));
  h.cleanup();
});
test("a funded manual service buys from wallet, without WhatsApp checkout", async () => {
  const h = await harness("index.html", { hash: "#/product/coins" });
  const f = h.document.getElementById("checkoutForm");
  assert.ok(f);
  f.elements.customer_account_id.value = "42";
  f.dispatchEvent(
    new h.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await h.settle();
  assert.equal(h.calls.filter((c) => c.action === "checkout").length, 0);
  const confirm = h.document.querySelector('[data-action="confirm-wallet-checkout"]');
  assert.ok(confirm, "a separate review must precede the wallet charge");
  confirm.dispatchEvent(new h.window.Event("click", { bubbles: true }));
  await h.settle();
  const call = h.calls.find((c) => c.action === "checkout");
  assert.ok(call);
  assert.equal(call.args.fields.account_id, "42");
  assert.equal(call.args.expected_total_usd, 5);
  assert.ok(call.args.idempotency_key.length >= 8);
  assert.equal(h.calls.filter((c) => c.action === "checkout").length, 1);
  assert.equal(h.opened.length, 0);
  h.cleanup();
});
test("an unfunded account cannot send a purchase to the server", async () => {
  const h = await harness("index.html", {
    hash: "#/product/coins",
    balance: 0,
  });
  const f = h.document.getElementById("checkoutForm");
  f.elements.customer_account_id.value = "42";
  f.dispatchEvent(
    new h.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await h.settle();
  assert.equal(h.calls.filter((c) => c.action === "checkout").length, 0);
  assert.match(h.document.getElementById("toast").textContent, /غير كافٍ/);
  h.cleanup();
});
test("unverified account cannot reach checkout", async () => {
  const h = await harness("index.html", { hash: "#/product/coins", verified: false });
  h.document.getElementById("checkoutForm").dispatchEvent(
    new h.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await h.settle();
  assert.equal(h.calls.filter((c) => c.action === "checkout").length, 0);
  assert.match(h.document.getElementById("modalRoot").textContent, /توثيق الحساب/);
  h.cleanup();
});
test("guest purchase requests sign in and never starts a WhatsApp order", async () => {
  const h = await harness("index.html", {
    hash: "#/product/coins",
    guest: true,
  });
  h.document
    .getElementById("checkoutForm")
    .dispatchEvent(
      new h.window.Event("submit", { bubbles: true, cancelable: true }),
    );
  await h.settle();
  assert.equal(h.calls.filter((c) => c.action === "checkout").length, 0);
  assert.ok(h.document.getElementById("authForm"));
  h.cleanup();
});
test("designer navigation excludes deposits, providers and user permissions", async () => {
  const h = await harness("admin.html", {
    hash: "#/categories",
    role: "designer",
  });
  const nav = h.document.getElementById("adminNav").textContent;
  assert.match(nav, /الأقسام/);
  assert.match(nav, /المنتجات/);
  assert.doesNotMatch(nav, /المستخدمين|المورّدون|طلبات الإيداع/);
  h.cleanup();
});
test("untrusted catalog text is displayed without executable markup", async () => {
  const catalog = fixture();
  catalog.products[0].name = '<img src=x onerror="evil()">';
  const h = await harness("index.html", { hash: "#/product/coins", catalog });
  assert.equal(h.document.querySelector(".product-info [onerror]"), null);
  assert.match(
    h.document.querySelector(".product-info h1").textContent,
    /<img/,
  );
  h.cleanup();
});
