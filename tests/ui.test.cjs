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
  assert.equal(h.document.querySelector('[data-action="confirm-wallet-checkout"]'), null,
    "direct purchase does not open a second confirmation");
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


test("compact card shows the authoritative total without wallet snapshots", async () => {
  const h = await harness("index.html", { hash: "#/product/coins", balance: 20 });
  try {
    const card = h.document.querySelector(".f90-premium-checkout");
    assert.ok(card, "premium checkout card is present");
    assert.ok(card.querySelector('[name="customer_account_id"]'));
    assert.ok(card.querySelector('[name="quantity"]'));
    const summary = card.querySelector(".f90-premium-summary");
    assert.ok(summary);
    assert.match(summary.textContent, /السعر النهائي/);
    assert.doesNotMatch(summary.textContent, /رصيدك الحالي|رصيدك بعد الشراء/);
    assert.equal(h.document.getElementById("f90CheckoutTopRemaining"), null);
    assert.match(h.document.getElementById("f90CheckoutTopTotal").textContent, /5/);
    assert.ok(h.calls.some((call) => call.action === "quote"));
    const form = h.document.getElementById("checkoutForm");
    const buy = h.document.getElementById("buyButton");
    assert.equal(form.lastElementChild.contains(buy), true, "confirm button ends the purchase card");
    assert.equal(h.calls.some((call) => call.action === "checkout"), false, "viewing must never buy");
  } finally {
    h.cleanup();
  }
});

test("install card has selectable native platform icons and device-specific instructions", async () => {
  const h = await harness("index.html", { hash: "#/install", guest: true });
  try {
    const panel = h.document.querySelector(".f90-install-premium");
    assert.ok(panel, "install card is rendered for guests");
    const systems = [...panel.querySelectorAll(".f90-install-platform")];
    assert.deepEqual(systems.map((x) => x.dataset.platform), ["ios", "android", "windows"]);
    for (const option of systems) assert.ok(option.querySelector("svg"), "real platform icon is shown");
    const android = panel.querySelector('[data-platform="android"]');
    android.dispatchEvent(new h.window.Event("click", { bubbles: true }));
    assert.equal(android.getAttribute("aria-pressed"), "true");
    assert.match(panel.querySelector("#f90InstallGuide").textContent, /Chrome|Android/);
    assert.ok(panel.lastElementChild.matches(".f90-install-page-icons"), "platform icon shortcuts end the installation card");
    assert.equal(panel.querySelectorAll(".f90-install-page-icons .f90-install-icon-btn").length,3,
      "iPhone, Android and Windows show icon-only install buttons");
    assert.equal(panel.querySelectorAll(".f90-install-platform span").length,0,
      "platform buttons do not repeat visible install text");
  } finally {
    h.cleanup();
  }
});


test("home deposit CTA and install shortcuts use device logos instead of text buttons", async () => {
  const h = await harness();
  try {
    const intro = h.document.querySelector(".f90-home-intro");
    assert.ok(intro?.querySelector('a[href="#/deposit"]'), "home discovery button goes straight to deposits");
    assert.match(intro.textContent, /إيداع نقود الآن/);
    const footer = [...h.document.querySelectorAll(".f90-install-footer .f90-install-icon-btn")];
    assert.deepEqual(footer.map(x=>x.dataset.platform), ["ios","android","windows"]);
    for(const button of footer){
      assert.ok(button.querySelector("svg"), "platform logo rendered");
      assert.ok(button.getAttribute("aria-label"), "logo-only buttons remain accessible");
      assert.equal(button.textContent.trim(), "", "no redundant install-now text");
    }
  } finally { h.cleanup(); }
});

test("about page installs with icon-only iPhone and Android actions", async () => {
  const h = await harness("index.html", {hash:"#/policy/about",guest:true});
  try {
    const group = h.document.querySelector(".f90-about-cta .f90-install-about");
    assert.ok(group, "install shortcuts appear inside about card");
    assert.deepEqual([...group.querySelectorAll("[data-action='install-platform']")].map(x=>x.dataset.platform),
      ["ios","android"]);
    for(const el of group.querySelectorAll("button")){
      assert.ok(el.querySelector("svg"));
      assert.equal(el.textContent.trim(),"");
    }
  } finally {h.cleanup();}
});

test("welcome action launches deposit screen and shows platform icon shortcuts", async () => {
  const h=await harness("index.html",{hash:"#/welcome",guest:true});
  try {
    assert.ok(h.document.querySelector('.f90-experience-actions a[href="#/deposit"]'));
    assert.equal(h.document.querySelectorAll(".f90-install-hero .f90-install-icon-btn").length,3);
  } finally {h.cleanup();}
});

test("expired maintenance returns to the store without a page refresh",async()=>{
 const catalog=fixture();catalog.settings.config.maintenance={enabled:true,until:"2020-01-01T00:00:00Z"};
 const h=await harness("index.html",{catalog,guest:true});
 assert.equal(h.document.querySelector(".f90-maintenance-screen"),null);
 assert.ok(h.document.querySelector(".image-grid"));h.cleanup();
});
test("category banners stay absent even when a saved banner is configured",async()=>{
 const catalog=fixture();catalog.categories[1].presentation.banner_url="https://example.invalid/banner.png";
 const h=await harness("index.html",{catalog,hash:"#/category/pubg"});
 assert.equal(h.document.querySelector(".category-art"),null);h.cleanup();
});
