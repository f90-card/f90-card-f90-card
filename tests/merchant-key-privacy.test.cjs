const test = require("node:test");
const assert = require("node:assert/strict");
const { harness } = require("./dom-harness.cjs");

test("leaving the creation route removes the visible API secret", async () => {
  const h = await harness("index.html", { hash: "#/product/coins" });
  try {
    h.document.getElementById("modalRoot").innerHTML = '<div data-f90-api-secret>fixture-secret</div>';
    h.window.location.hash = "#/orders";
    await h.settle();
    assert.equal(h.document.querySelector("[data-f90-api-secret]"), null);
    assert.ok(!h.document.body.textContent.includes("fixture-secret"));
  } finally { h.cleanup(); }
});

test("pagehide scrubs the API secret before browser history can restore it", async () => {
  const h = await harness();
  try {
    h.document.getElementById("modalRoot").innerHTML = '<div data-f90-api-secret>fixture-secret</div>';
    h.window.dispatchEvent(new h.window.Event("pagehide"));
    assert.equal(h.document.getElementById("modalRoot").textContent, "");
  } finally { h.cleanup(); }
});

test("a delayed key creation response cannot reveal its secret after navigation", async () => {
  const h = await harness("index.html", { role: "trader" });
  try {
    const call = h.window.F90API.call;
    let finish;
    h.window.F90API.call = (action, ...args) => action === "key.create"
      ? new Promise(resolve => { finish = resolve; }) : call(action, ...args);
    h.window.fetch = async () => ({ ok: true, json: async () => ({ data: [] }) });
    const form = h.document.createElement("form");
    form.id = "keyForm";
    form.innerHTML = '<input name="name" value="Isolated fixture"><input type="checkbox" name="allow_all_ips" checked><button type="submit">Create</button>';
    h.document.getElementById("mainContent").appendChild(form);
    form.dispatchEvent(new h.window.Event("submit", { bubbles: true, cancelable: true }));
    await h.settle();
    assert.equal(typeof finish, "function", "creation request is pending");
    h.window.location.hash = "#/orders";
    await h.settle();
    finish({ token: "fixture-secret-never-real" });
    await h.settle();
    assert.equal(h.document.querySelector("[data-f90-api-secret]"), null);
    assert.ok(!h.document.body.textContent.includes("fixture-secret-never-real"));
    assert.match(h.document.getElementById("toast").textContent, /بعد مغادرة الصفحة/);
  } finally { h.cleanup(); }
});
