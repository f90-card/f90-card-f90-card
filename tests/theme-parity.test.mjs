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
    assert.match(page, /localStorage\.getItem\("f90-theme"\) === "cream"/);
});
test("theme switching never sends financial or account requests", () => {
  const block = adminApp.slice(adminApp.indexOf("  function applyAdminTheme(value) {"),
    adminApp.indexOf('  $("adminLogout").addEventListener', adminApp.indexOf("  function applyAdminTheme(value) {")));
  assert.ok(block.length > 0);
  assert.doesNotMatch(block, /A\.call\(|fetch\(|signOut\(|\.update\(/);
});
