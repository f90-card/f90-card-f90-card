import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the actual refreshMe function in isolation with fake authentication.
// These tests cannot access customer accounts, balances, or production services.
const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("  async function refreshMe() {");
const end = source.indexOf("  function promotions() {", start);
assert.ok(start >= 0 && end > start, "refreshMe function not found");

function harness({ session = "token", result, failure, existing = { profile: { display_name: "سابق" }, wallet: { balance_usd: 10 } } } = {}) {
  const S = { me: existing, walletStale: false };
  const messages = [];
  const A = {
    client: { auth: { getSession: async () => ({ data: { session: session ? { access_token: session } : null } }) } },
    call: async (action) => {
      assert.equal(action, "me");
      if (failure) throw failure;
      return result;
    },
  };
  const fn = vm.runInNewContext("(" + source.slice(start, end).trim() + ")", {
    A, S, toast: (value) => messages.push(value), message: (err) => err.message,
  });
  return { S, messages, refreshMe: fn };
}

test("successful session refresh replaces stale user and reports success", async () => {
  const user = { profile: { display_name: "محدّث" }, wallet: { balance_usd: 4 } };
  const h = harness({ result: user });
  assert.equal(await h.refreshMe(), true);
  assert.equal(h.S.me.profile.display_name, "محدّث");
  assert.equal(h.S.me.wallet.balance_usd, 4);
  assert.equal(h.S.walletStale, false);
});

test("network failure keeps last known user but reports a stale refresh", async () => {
  const h = harness({ failure: new Error("network unreachable") });
  assert.equal(await h.refreshMe(), false);
  assert.equal(h.S.me.profile.display_name, "سابق");
  assert.equal(h.S.me.wallet.balance_usd, 10);
  assert.equal(h.S.walletStale, true);
  assert.equal(h.messages.length, 0);
});

test("expired account credentials clear the cached user", async () => {
  const error = Object.assign(new Error("جلسة غير صالحة"), { code: "F90_AUTH" });
  const h = harness({ failure: error });
  assert.equal(await h.refreshMe(), false);
  assert.equal(h.S.me, null);
  assert.equal(h.messages.length, 1);
  assert.equal(h.S.walletStale, false);
});

test("forbidden account clears cached identity", async () => {
  const error = Object.assign(new Error("الحساب موقوف"), { code: "F90_FORBIDDEN" });
  const h = harness({ failure: error });
  assert.equal(await h.refreshMe(), false);
  assert.equal(h.S.me, null);
});

test("real sign-out clears identity rather than using cached wallet", async () => {
  const h = harness({ session: null });
  assert.equal(await h.refreshMe(), false);
  assert.equal(h.S.me, null);
  assert.equal(h.S.walletStale, false);
});

test("confirmed checkout navigates before optional account refresh", () => {
  const checkout = source.indexOf('if (form.id === "checkoutForm")');
  const navigation = source.indexOf('location.hash = href("order", o.id);', checkout);
  const refresh = source.indexOf('refreshed = await refreshMe();', checkout);
  assert.ok(checkout >= 0 && navigation > checkout && refresh > navigation);
});

test("stale wallet amount is never shown as current balance in header", () => {
  const header = source.slice(source.indexOf("function chrome()"), source.indexOf("  async function refreshMe()"));
  assert.match(header, /S\.walletStale \? "الرصيد يحتاج تحديث"/);
});

test("checkout refuses stale wallet balance unless refresh succeeds", () => {
  const checkout = source.slice(source.indexOf('if (form.id === "checkoutForm")'), source.indexOf('if (form.id === "profileForm")'));
  const freshness = checkout.indexOf("if (S.walletStale)");
  const balanceCheck = checkout.indexOf("Number(S.me.wallet.balance_usd)");
  const checkoutCall = checkout.indexOf('A.call("checkout"');
  assert.ok(freshness >= 0 && freshness < balanceCheck && balanceCheck < checkoutCall);
  assert.match(checkout, /const refreshed = await refreshMe\(\);/);
  assert.match(checkout, /if \(!refreshed\)/);
  assert.match(checkout, /if \(!S\.me\?\.profile\?\.is_verified\)/);
});
