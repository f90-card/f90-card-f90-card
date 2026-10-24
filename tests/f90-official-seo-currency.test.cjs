const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("Official domain is canonical in store and sitemap", () => {
  const home = read("index.html");
  assert.match(home, /rel="canonical" href="https:\/\/www\.f90card\.online\/"/);
  assert.match(home, /"alternateName":\["F90 CARD"/);
  assert.match(home, /rel="icon"[^>]+href="\/favicon\.png"/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'favicon.png')));
  const map = read("sitemap.xml");
  assert.match(map, /https:\/\/www\.f90card\.online\/discover\//);
  assert.doesNotMatch(map, /https:\/\/f90-card\.github\.io/);
});
test("Legacy index.html resolves to root and PWA opens canonical home", () => {
  const conf = JSON.parse(read("vercel.json"));
  assert.ok(conf.redirects.some(r => r.source === "/index.html" && r.destination === "/" && r.permanent));
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.start_url, "./#/welcome");
  for (const item of manifest.shortcuts) assert.doesNotMatch(item.url, /index\.html/);
});
test("Registration passes account currency as validated auth metadata", () => {
  const app = read("app.js");
  assert.match(app, /name="account_currency"|select\("account_currency"/);
  assert.match(app, /account_currency: C\.enabledCurrency/);
  assert.match(app, /profile\.currency/);
  assert.match(app, /f90-google-currency-pending/);
  assert.doesNotThrow(() => new Function(app));
});
test("Static discover sections link to canonical homepage paths", () => {
  for (const file of fs.readdirSync(path.join(__dirname, "..", "discover")).filter(f=>f.endsWith(".html"))) {
    assert.doesNotMatch(read("discover/" + file), /\.\.\/index\.html/, file);
  }
});
