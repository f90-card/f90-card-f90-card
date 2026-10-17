const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "f90-experience-v3.css"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const welcome = app.split("function welcome() {")[1]?.split("function musicPage()")[0];

test("welcome includes an early skip button linking directly to store", () => {
  assert.ok(welcome, "welcome screen must exist");
  assert.match(welcome, /class="f90-welcome-skip" href="#\/"/);
  assert.match(welcome, /تخطي الترحيب/);
  assert.match(welcome, /class="button f90-welcome-enter" href="#\/"/);
  assert.match(welcome, /الدخول إلى المتجر/);
  assert.ok(welcome.indexOf("f90-welcome-enter") < welcome.indexOf('href="#/deposit"'), "store entry must precede deposit");
});

test("welcome retains original images, checkout entry, and footer", () => {
  assert.match(welcome, /f90-experience-emblem/);
  assert.match(welcome, /f90-experience-products/);
  assert.match(welcome, /f90-experience-legal/);
  assert.match(welcome, /f90-experience-end/);
  assert.match(welcome, /f90InstallShortcuts/);
});

test("mobile skip button styling ships with refreshed styles and script", () => {
  assert.match(css, /\.f90-experience-hero > \.f90-welcome-skip/);
  assert.match(css, /@media \(max-width: 740px\)/);
  assert.match(index, /f90-experience-v3\.css\?v=20261017-welcome-entry1/);
  assert.match(index, /app\.js\?v=20261017-welcome-entry1/);
});
