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

test("cinematic weather can switch modes without network or financial actions", () => {
  const bot = read("theme-effects.js");
  assert.match(site, /id="f90WeatherMode"/);
  for (const mode of ["snow", "rain", "wind", "hearts", "mix"]) {
    assert.match(site, new RegExp('value="' + mode + '"'));
    assert.match(bot, new RegExp('\\b' + mode + ':|\\b' + mode + ' ='));
  }
  assert.match(bot, /lastWeatherKey/);
  assert.match(bot, /f90-weather-mode/);
  assert.match(styles, /data-weather-mode="snow"/);
  assert.match(styles, /data-weather-mode="rain"/);
  assert.match(styles, /data-weather-mode="wind"/);
  assert.match(styles, /data-weather-mode="hearts"/);
  assert.doesNotMatch(bot, /fetch\(|A\.call\(|\.submit\(/);
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
