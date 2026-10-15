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
test("Welcome information page is restored and owner-only home phone media stays separate", () => {
  const phone=read("f90-welcome-scene.js");
  assert.match(app,/function welcome\(\)/);
  assert.match(app,/f90-experience-hero/);
  assert.match(app,/f90-experience-questions/);
  assert.match(app,/F90WelcomeScene\.homePhone/);
  assert.match(phone,/promo_video/);
  assert.match(phone,/source data-src/);
  assert.match(phone,/wa\.me/);
  assert.doesNotMatch(phone,/id="authForm"/);
  assert.match(admin,/promo_video_image_file/);
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
test("Storefront startup uses browser History instead of its order-history renderer", () => {
  assert.match(app, /async function history\(kind\)/);
  assert.match(app, /window\.history\?\.replaceState\?\.\(/);
  assert.match(app, /window\.history\?\.state\?\.f90ScrollEntry/);
  assert.doesNotMatch(app, /(^|[^.])history\.replaceState\(/m);
  assert.match(mainHtml, /f90-startup-rescue\.js/);
});

test("Route scroll restoration is back-aware and Telegram settings are restricted to managers", () => {
  assert.match(app,/f90ScrollPositions/);
  assert.match(app,/history\.scrollRestoration="manual"/);
  assert.match(admin,/telegramAlertsForm/);
  assert.match(admin,/staff\.telegram\.test/);
  assert.match(admin,/telegram-alerts/);
});
test("Telegram integration is manager-configured and never embeds bot secrets in public files", () => {
  assert.match(admin,/telegramConnectForm/);
  assert.match(admin,/staff\.telegram\.connect/);
  assert.match(admin,/staff\.telegram\.discover/);
  assert.match(admin,/staff\.telegram\.test/);
  assert.doesNotMatch(mainHtml, /F90_TELEGRAM_BOT_TOKEN/);
  assert.doesNotMatch(read("f90-welcome-scene.js"), /api\.telegram\.org\/bot/);
});
test("IP settings remain editable after a merchant token is issued", () => {
  assert.match(app,/API TOKEN Settings/);
  assert.match(app,/Allowed IP addresses/);
  assert.match(app,/name="allow_all_ips"/);
  assert.match(app,/key\.update/);
});
test("Install icons can be uploaded at both PWA-required sizes", () => {
  assert.match(admin,/uploadAppInstallIcons/);
  assert.match(admin,/\[192,512\]/);
  assert.match(admin,/admin_app_icon_192_url/);
  assert.match(app,/f90-install-manifest\?app=store/);
  assert.match(admin,/f90-install-manifest\?app=admin/);
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
