import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the actual refreshMe function in isolation with fake authentication.
// These tests cannot access customer accounts, balances, or production services.
const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("  let pendingMeRefresh = null;");
const end = source.indexOf("  function promotions() {", start);
assert.ok(start >= 0 && end > start, "refreshMe function not found");

function harness({
  session = "token", result, failure, refreshFailure, lookupError,
  existing = { profile: { display_name: "سابق" }, wallet: { balance_usd: 10 } },
} = {}) {
  const S = { me: existing, walletStale: false, savedRecipients: [] };
  const messages = [];
  let calls = 0;
  let refreshes = 0;
  const A = {
    client: { auth: {
      getSession: async () => ({
        data: { session: session ? { access_token: session } : null },
        error: lookupError || null,
      }),
      refreshSession: async () => {
        refreshes++;
        return {
          data: { session: refreshFailure ? null : { access_token: "refreshed-token" } },
          error: refreshFailure || null,
        };
      },
    } },
    call: async (action) => {
      assert.equal(action, "me");
      calls++;
      if (failure && calls === 1) throw failure;
      return result;
    },
  };
  // Include the single-flight closure that owns the real refreshMe function.
  const fn = vm.runInNewContext("(() => { " + source.slice(start, end) +
    " return refreshMe; })()", {
    A, S, console: { warn: () => {} },
    toast: (value) => messages.push(value), message: (err) => err.message,
  });
  return { S, messages, refreshMe: fn,
    get calls() { return calls; }, get refreshes() { return refreshes; } };
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

test("expired access token retries a safe profile read without signing out", async () => {
  const error = Object.assign(new Error("JWT expired"), { code: "F90_AUTH", status: 401 });
  const updated = { profile: { display_name: "مستعاد" }, wallet: { balance_usd: 9 } };
  const h = harness({ failure: error, result: updated });
  assert.equal(await h.refreshMe(), true);
  assert.equal(h.S.me.profile.display_name, "مستعاد");
  assert.equal(h.S.walletStale, false);
  assert.equal(h.refreshes, 1);
  assert.equal(h.calls, 2);
  assert.equal(h.messages.length, 0);
});

test("failed JWT renewal keeps the existing identity but freezes its balance", async () => {
  const error = Object.assign(new Error("JWT expired"), { code: "F90_AUTH", status: 401 });
  const h = harness({ failure: error, refreshFailure: new Error("offline") });
  assert.equal(await h.refreshMe(), false);
  assert.equal(h.S.me.profile.display_name, "سابق");
  assert.equal(h.S.walletStale, true);
  assert.equal(h.refreshes, 1);
  assert.equal(h.messages.length, 0);
});

test("temporary session lookup errors do not erase the existing account", async () => {
  const h = harness({ lookupError: new Error("network") });
  assert.equal(await h.refreshMe(), false);
  assert.equal(h.S.me.profile.display_name, "سابق");
  assert.equal(h.S.walletStale, true);
  assert.equal(h.calls, 0);
});

test("parallel account refreshes reuse the same session check", async () => {
  const h = harness({ result: { profile: { display_name: "محدث" } } });
  const values = await Promise.all([h.refreshMe(), h.refreshMe(), h.refreshMe()]);
  assert.deepEqual(values, [true, true, true]);
  assert.equal(h.calls, 1);
});

test("forbidden refresh never treats stale wallet as a current verified balance", async () => {
  const error = Object.assign(new Error("الحساب موقوف"), { code: "F90_FORBIDDEN" });
  const h = harness({ failure: error });
  assert.equal(await h.refreshMe(), false);
  assert.equal(h.S.walletStale, true);
  assert.equal(h.messages.length, 1);
});

test("real sign-out clears identity rather than using cached wallet", async () => {
  const h = harness({ session: null });
  assert.equal(await h.refreshMe(), false);
  assert.equal(h.S.me, null);
  assert.equal(h.S.walletStale, false);
});

test("confirmed checkout shows the recorded order without requiring a second purchase", () => {
  const handler = source.indexOf('if (form.id === "checkoutForm")');
  const checkout = source.indexOf('o = await A.call("checkout"', handler);
  const confirmation = source.indexOf('completedForm.innerHTML', checkout);
  const refresh = source.indexOf('refreshed = await refreshMe();', confirmation);
  assert.ok(handler >= 0 && checkout > handler && confirmation > checkout && refresh > confirmation);
  assert.match(source.slice(confirmation, refresh), /عرض تفاصيل الطلب/);
});

test("stale wallet amount is never shown as current balance in header", () => {
  const header = source.slice(source.indexOf("function chrome()"), source.indexOf("  async function refreshMe()"));
  assert.match(header, /S\.walletStale \? "تحديث الرصيد"/);
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
