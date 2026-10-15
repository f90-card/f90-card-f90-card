import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const site = read("index.html");
const admin = read("admin.html");
const app = read("app.js");
const adminApp = read("admin.js");
const styles = read("styles.css");

test("both live themes exist with a single storefront toggle and CSS variables", () => {
  assert.match(site, /id="themeToggle"/);
  assert.match(site, /data-theme="dark"/);
  assert.match(app, /\["dark", "cream"\]\.includes\(v\)/);
  assert.match(styles, /:root\[data-theme="cream"\]/);
  for (const name of ["--bg", "--surface", "--text", "--accent"]) {
    assert.match(styles.slice(styles.indexOf(':root[data-theme="cream"]')), new RegExp(name + ":"));
  }
});
test("admin has a working cream and dark toggle", () => {
  assert.match(admin, /id="adminThemeToggle"/);
  assert.match(adminApp, /adminThemeToggle"\)\?\.addEventListener\("click"/);
  assert.match(adminApp, /applyAdminTheme\(document\.documentElement\.dataset\.theme/);
  assert.match(adminApp, /localStorage\.setItem\("f90-theme", selected\)/);
});
test("store and admin honor the same two-theme preference", () => {
  assert.match(app, /localStorage\.setItem\("f90-theme", v\)/);
  assert.match(adminApp, /localStorage\.setItem\("f90-theme", selected\)/);
  for (const page of [site, admin]) {
    assert.match(page, /\["dark", "cream"\]\.includes\(localStorage\.getItem\("f90-theme"\)\)/);
  }
});
test("theme switching never sends financial or account requests", () => {
  const block = adminApp.slice(adminApp.indexOf("  function applyAdminTheme(value) {"),
    adminApp.indexOf('  $("adminLogout").addEventListener', adminApp.indexOf("  function applyAdminTheme(value) {")));
  assert.ok(block.length > 0);
  assert.doesNotMatch(block, /A\.call\(|fetch\(|signOut\(|\.update\(/);
});

test("retired third theme cannot interfere with the shared two-theme toggle", () => {
  assert.match(site, /id="themeToggle"/);
  assert.match(admin, /id="adminThemeToggle"/);
  assert.doesNotMatch(site, /<option value="melon"/);
  assert.match(app, /\["dark", "cream"\]\.includes\(v\)/);
  assert.match(adminApp, /\["dark", "cream"\]\.includes\(value\)/);
});
test("retired decorative bot is not injected into checkout or the storefront", () => {
  assert.doesNotMatch(site, /<script[^>]*src="\.\/theme-effects\.js/);
  const bot = read("theme-effects.js");
  assert.doesNotMatch(bot, /\bfetch\(|A\.call\(|checkout|paymentReference/);
  assert.match(site, /id="themeToggle"/);
});

test("pinch zoom remains available and redundant back button is removed", () => {
  assert.doesNotMatch(site, /id="pageBack"/);
  assert.doesNotMatch(site, /user-scalable=no|maximum-scale=1/);
});
test("weather is theme-specific, adjustable and respects reduced motion", () => {
  const bot = read("theme-effects.js");
  assert.match(bot, /root\.dataset\.theme === "melon"/);
  assert.match(bot, /f90-effects-level/);
  assert.match(styles, /f90-weather-particle/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});

test("retired weather chooser does not block the real storefront", () => {
  assert.doesNotMatch(site, /id="f90WeatherMode"/);
  assert.doesNotMatch(site, /<script[^>]*src="\.\/theme-effects\.js/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(site, /f90-startup-rescue\.js/);
});

test("mascot roams without interrupting modal dialogs or invoking purchase", () => {
  const bot = read("theme-effects.js");
  assert.match(bot, /document\.hidden \|\| reduced\.matches \|\| bot\.hidden/);
  assert.match(bot, /\.modal, \.modal-backdrop, #drawer:not\(\[hidden\]\)/);
  assert.match(bot, /f90-bot-peek/);
  assert.match(bot, /routeHint\(\)/);
  assert.doesNotMatch(bot, /\.click\(\)|A\.call\(|fetch\(/);
});
test("full snowfall only frosts decoration and respects reduced motion", () => {
  const bot = read("theme-effects.js");
  assert.match(bot, /root\.classList\.toggle\("f90-frosted"/);
  assert.match(styles, /\.f90-frosted/);
  assert.match(styles, /\.f90-mascot-still/);
});

test("decorative bot recedes during forms and dialogs", () => {
  const bot = read("theme-effects.js");
  assert.match(bot, /function|const syncObstruction/);
  assert.match(bot, /f90-bot-paused/);
  assert.match(bot, /focusedForm/);
  assert.match(styles, /\.f90-mascot\.f90-bot-paused/);
});
test("back navigation removed from markup and route controller", () => {
  assert.doesNotMatch(site, /id="pageBack"/);
  assert.doesNotMatch(app, /\$\("pageBack"\)/);
});

test("category tiles open the existing product form in place without another route", () => {
  assert.match(app, /function productTile\(p, pack = false, inline = false\)/);
  assert.match(app, /data-action="quick-product"/);
  assert.match(app, /id="quickProductPanel"/);
  assert.match(app, /function product\(slug, inline = false\)/);
  assert.match(app, /product\(button\.dataset\.id, true\)/);
  assert.match(app, /quoteProduct\(p\)/);
  assert.match(app, /data-action="close-quick-product"/);
  assert.match(styles, /\.f90-quick-product/);
});

test("wallet checkout rechecks the server quote and pending form before charging", () => {
  assert.match(app, /if \(!confirmed\) \{/);
  assert.match(app, /modal\("مراجعة طلب الشراء"/);
  assert.match(app, /data-action="confirm-wallet-checkout"/);
  assert.match(app, /pending\.quoteSeq !== S\.quoteSeq/);
  assert.match(app, /pending\.key !== S\.checkoutKey/);
  assert.match(app, /JSON\.stringify\(Object\.fromEntries\(new FormData\(pending\.form\)\)\) !== pending\.fingerprint/);
  assert.match(app, /await submit\(pending\.form, true\)/);
});


test("RTL header keeps profile in drawer and the theme toggle in preferences", () => {
  const header = site.slice(site.indexOf('<header class="site-header">'), site.indexOf("</header>"));
  const brand = header.indexOf('id="headerBrand"');
  const wallet = header.indexOf('id="headerWallet"');
  const menu = header.indexOf('id="menuButton"');
  assert.ok(brand >= 0 && wallet > brand && menu > wallet);
  assert.doesNotMatch(header, /id="headerUser"|id="themeButton"/);
  assert.match(site, /id="drawerProfile"/);
  assert.match(site, /id="themeToggle"/);
  assert.doesNotMatch(app, /\$\("headerUser"\)|\$\("themeButton"\)/);
});


test("quick product uses a closable centered dialog with the original purchase form", () => {
  assert.match(app, /id="quickProductBackdrop"/);
  assert.match(app, /id="quickProductPanel"[^>]*role="dialog"/);
  assert.match(app, /function closeQuickProduct\(\)/);
  assert.match(app, /if \(ev\.key === "Escape"\) \{[\s\S]*?closeQuickProduct\(\)/);
  assert.match(styles, /\.f90-quick-product \{\s*position: fixed;/);
  assert.match(styles, /\.f90-quick-product \.product-art \{ display: none; \}/);
});
