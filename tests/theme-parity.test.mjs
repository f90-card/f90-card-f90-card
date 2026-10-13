import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const site = read("index.html");
const admin = read("admin.html");
const app = read("app.js");
const adminApp = read("admin.js");
const styles = read("styles.css");

test("both themes exist with shared page features and CSS variables", () => {
  assert.match(site, /value="dark"/);
  assert.match(site, /value="cream"/);
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
test("store and admin honor the same theme preference", () => {
  assert.match(app, /localStorage\.setItem\("f90-theme", v\)/);
  for (const page of [site, admin])
    assert.match(page, /\["dark", "cream", "melon"\]\.includes\(localStorage\.getItem\("f90-theme"\)\)/);
});
test("theme switching never sends financial or account requests", () => {
  const block = adminApp.slice(adminApp.indexOf("  function applyAdminTheme(value) {"),
    adminApp.indexOf('  $("adminLogout").addEventListener', adminApp.indexOf("  function applyAdminTheme(value) {")));
  assert.ok(block.length > 0);
  assert.doesNotMatch(block, /A\.call\(|fetch\(|signOut\(|\.update\(/);
});

test("third melon skin is selectable on storefront and in admin default settings", () => {
  assert.match(site, /option value="melon"/);
  assert.match(adminApp, /\["melon", "بطيخي سماوي متحرك"\]/);
  assert.match(styles, /:root\[data-theme="melon"\]/);
  assert.match(app, /\["dark", "cream", "melon"\]\.includes\(v\)/);
});
test("F90 bot cannot send purchases and supports user dismissal", () => {
  assert.match(site, /theme-effects\.js/);
  const bot = read("theme-effects.js");
  assert.match(bot, /store\("f90-bot-hidden"/);
  assert.match(site, /id="f90BotToggle"/);
  assert.match(site, /id="f90EffectsLevel"/);
  assert.match(bot, /prefers-reduced-motion/);
  assert.doesNotMatch(bot, /\bfetch\(|A\.call\(|checkout|paymentReference/);
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
