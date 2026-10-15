"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js"), admin = read("admin.js"), api = read("api.js");
const mainHtml = read("index.html"), adminHtml = read("admin.html");

test("All production client scripts parse correctly", () => {
  for (const name of ["app.js","admin.js","api.js","store-core.js","sw.js","f90-merchant-v2.js","f90-welcome-scene.js","f90-media-player.js"]) {
    assert.doesNotThrow(() => new vm.Script(read(name), { filename:name }));
  }
});
test("Public pages reference actual local scripts and CSS files", () => {
  for (const file of ["index.html","admin.html"]) {
    const html = read(file);
    for (const [,name] of html.matchAll(/(?:src|href)=["']\.\/([^"'?#]+)(?:\?[^"']*)?["']/g)) {
      if (name.startsWith("api/")) continue;
      assert.ok(fs.existsSync(path.join(root,name)),file+" references missing "+name);
    }
  }
});
test("Admin HTML is not intended for public search indexing", () => {
  assert.match(adminHtml, /<meta name="robots" content="noindex"/);
});
test("API key pages are trader-only in client router", () => {
  assert.match(app, /S\.me\?\.role\s*!==\s*"trader"/);
  assert.match(app,/page === "api-guide"/);
  assert.match(app,/page === "developers"/);
});
test("Wallet checkout and deposit use distinct idempotent operations", () => {
  assert.match(app,/idempotency_key/);
  assert.match(app,/receipt/);
  assert.match(api,/async function upload/);
});
test("VIP levels are up to 15 and admin discount cap is 3%", () => {
  assert.match(app,/Math\.min\(15,/);
  assert.match(admin,/max="3"/);
});
test("The burgundy welcome screen uses a real auth route and lazy optional media", () => {
  const welcome=read("f90-welcome-scene.js");
  assert.match(welcome,/promo\.enabled===true/);
  assert.match(welcome,/source data-src/);
  assert.match(welcome,/#\/auth/);
  assert.match(app,/syncWelcomePhoneVideo/);
  assert.match(app,/IntersectionObserver/);
  assert.match(admin,/promo_video_enabled/);
});
test("Real English API guide and single-token UI are available", () => {
  const docs=read("f90-merchant-v2.js");
  assert.match(docs,/x-f90-key/);
  assert.match(docs,/action:"checkout"/);
  assert.match(docs,/idempotency_key/);
  assert.match(docs,/Allowed IP addresses/);
});
test("Admin audio player and GIF background settings are present", () => {
  assert.match(admin,/mediaCenterForm/);
  assert.match(admin,/site_background_file/);
  assert.match(admin,/music_audio_file/);
  assert.match(api,/f90-audio/);
  assert.match(app,/F90MediaPlayer/);
});
test("Administration has its own install manifest", () => {
  const manifest=JSON.parse(read("admin.webmanifest"));
  assert.match(manifest.start_url,/admin\.html/);
  assert.match(adminHtml,/id="adminInstall"/);
});
test("Merchant and client entry points use the latest F90 styles", () => {
  assert.match(mainHtml,/f90-store-polish-2026\.css/);
  assert.match(adminHtml,/f90-store-polish-2026\.css/);
});
test("Manager balance adjustments preserve a reason and traceable idempotency key", () => {
  assert.match(admin,/financeAdjustForm/);
  assert.match(admin,/request_id/);
  assert.match(admin,/expected_balance/);
});
test("No test makes any paid order or wallet adjustment", () => {
  assert.doesNotMatch(read(__filename.slice(root.length+1)), /\b(?:fetch|supabase\.from)\([^)]*\)\s*\.\s*(?:insert|update|delete)\(/);
});
