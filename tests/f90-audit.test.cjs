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
test("Gold purchase card is compact and shows only final cost plus small current balance", () => {
  const visa=read("f90-visa-checkout.css");
  const purchase=app.slice(app.indexOf('    const officialLogo = C.safeUrl(S.settings.logo_url) || "./f90-logo.png";'),app.indexOf('    if (inline) {',app.indexOf('    const officialLogo = C.safeUrl(S.settings.logo_url) || "./f90-logo.png";')));
  assert.match(mainHtml,/f90-visa-checkout\.css/);
  assert.match(purchase,/f90-visa-purchase/);
  assert.match(purchase,/f90-visa-watermark/);
  assert.match(purchase,/f90-visa-logo/);
  assert.match(purchase,/f90CheckoutTopTotal/);
  assert.match(purchase,/f90CheckoutTopBalance/);
  assert.doesNotMatch(purchase,/f90CheckoutTopRemaining|الرصيد بعد الشراء|الرصيد المتوقع/);
  for(const id of ["checkoutForm","priceBoard","checkoutTotal","quoteError","buyButton","walletHint"]){
    assert.ok(purchase.includes('id="'+id+'"'),id+" still needed for server-quote checkout");
  }
  assert.match(app,/await A\.call\("quote", \{/);
  assert.match(app,/expected_total_usd: S\.quote\.total_usd/);
  assert.match(app,/idempotency_key: reference/);
  assert.match(app,/data-action="confirm-wallet-checkout"/);
  assert.match(visa,/width:min\(390px,calc\(100vw - 18px\)\)/);
  assert.match(visa,/--f90-visa-gold/);
  assert.match(visa,/#modalRoot \.modal-backdrop\{z-index:1200!important\}/);
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
  assert.match(admin,/background_dark_file/);
  assert.match(admin,/background_cream_file/);
  assert.match(admin,/background_logo_enabled/);
  assert.match(admin,/backgroundLogo/);
  assert.match(admin,/backgroundThemes/);
  assert.match(admin,/music_audio_file/);
  assert.match(api,/f90-audio/);
  assert.match(app,/F90MediaPlayer/);
});
test("The official F90 watermark and theme backgrounds stay independent", () => {
  const scene=read("f90-theme-background.js");
  const style=read("f90-theme-background.css");
  assert.match(mainHtml, /f90-theme-background\.js/);
  assert.match(mainHtml, /f90-theme-background\.css/);
  assert.match(app, /F90ThemeBackground\?\.sync\(c,S\.settings\.logo_url\)/);
  assert.match(app, /F90ThemeBackground\?\.setTheme\(v\)/);
  assert.match(scene, /site\.themes\?\.\[name\]/);
  assert.match(scene, /logoSrc/);
  assert.match(scene, /f90-logo\.png/);
  assert.match(scene, /wm\.enabled!==false/);
  assert.match(style, /f90-watermark-drift/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(admin, /background_dark_enabled/);
  assert.match(admin, /background_cream_enabled/);
  assert.match(admin, /f90PreviewCream/);
  assert.match(admin, /f90PreviewDark/);
});
test("Each theme has independent, readable 50–150% brightness controls", () => {
  const scene=read("f90-theme-background.js");
  const style=read("f90-theme-background.css");
  assert.match(admin, /name="brightness_dark"/);
  assert.match(admin, /name="brightness_cream"/);
  assert.match(admin, /brightness:bound\(d\.brightness_dark,50,150,100\)/);
  assert.match(admin, /brightness:bound\(d\.brightness_cream,50,150,100\)/);
  assert.match(admin, /brightnessDarkValue/);
  assert.match(admin, /brightnessCreamValue/);
  assert.match(scene, /selected\?\.brightness,50,150,100/);
  assert.match(scene, /--f90-base-percent/);
  assert.match(scene, /--f90-tint-percent/);
  assert.match(scene, /photo\.style\.filter="brightness\("/);
  assert.doesNotMatch(scene, /document\.body\.style\.filter/);
  assert.match(style, /--surface:color-mix/);
  assert.match(style, /--bg:color-mix/);
  assert.match(mainHtml, /f90-theme-background\.js\?v=20261015-brightness1/);
  assert.match(mainHtml, /f90-theme-background\.css\?v=20261015-brightness1/);
  assert.match(adminHtml, /admin\.js\?v=20261015-brightness1/);
});

test("Visitors see only edge volume controls; managers own radio sources", () => {
  const radio=read("f90-media-player.js"), css=read("f90-radio.css");
  const live=read("supabase/functions/f90-platform/index.ts");
  assert.match(admin, /A\.upload\(file,"f90-radio","tracks"\)/);
  assert.match(admin, /staff\.radio\.save/);
  assert.match(admin, /staff\.radio\.status/);
  assert.match(admin, /radioYoutubeForm/);
  assert.match(api, /const radio = bucket === "f90-radio"/);
  assert.match(api, /action === "media\.state"/);
  assert.match(live, /action === "media\.ticket"/);
  assert.match(live, /action === "media\.state"/);
  assert.match(live, /createSignedUrl\(path,\s*3600\)/);
  assert.match(live, /f90_radio_sources/);
  assert.match(live, /requireRole\(a,\s*"manager"\)/);
  assert.match(radio, /el\.loop=true/);
  assert.match(radio, /f90-radio-volume/);
  assert.match(radio, /f90-radio-orb/);
  assert.match(radio, /media\.state/);
  assert.doesNotMatch(radio, /youtube-nocookie|<iframe/);
  assert.match(css, /\.f90-radio-hidden-media/);
  assert.match(css, /\.f90-radio-popup/);
  assert.match(mainHtml, /f90-radio\.css/);
  assert.doesNotMatch(app, /\["music","ميوزك أف تسعين","headphones"\]/);
});

test("Radio controls are manager only, with configurable icon and mobile layout", () => {
  const radio=read("f90-media-player.js");
  const css=read("f90-radio.css");
  const edge=read("supabase/functions/f90-platform/index.ts");
  const phone=read("f90-welcome-scene.js");
  assert.match(admin,/bubble_icon_url/);
  assert.match(admin,/bubble_icon_file/);
  assert.match(admin,/bubble_side/);
  assert.match(admin,/bubble_size_mobile/);
  assert.match(admin,/promo_video_link_url/);
  assert.match(admin,/promo_phone_size_mobile/);
  assert.match(admin,/promo_phone_x/);
  assert.match(admin,/promo_phone_y/);
  assert.match(radio,/function applyBubble\(value\)/);
  assert.match(radio,/stallTimer/);
  assert.match(radio,/addEventListener\("waiting"/);
  assert.match(radio,/f90-radio-custom-icon/);
  assert.match(radio,/media\.state/);
  assert.doesNotMatch(radio,/id="f90RadioPause"|id="f90RadioNext"|id="f90RadioStop"/);
  assert.match(css,/f90-radio-mobile-size/);
  assert.match(css,/data-side="left"/);
  assert.match(edge,/currentBubble/);
  assert.match(edge,/bubble:m\.bubble\|\|\{\}/);
  assert.match(edge,/size_mobile/);
  assert.match(phone,/p\.link_url/);
  assert.match(phone,/f90-phone-size/);
  assert.match(api,/radioMimeAliases/);
  assert.match(api,/audio\/x-m4a/);
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
test("Telegram connector safely discovers Chat ID without requiring it upfront", () => {
  assert.match(adminHtml, /admin\.js\?v=20261015-brightness1/);
  assert.match(admin, /if\(!chat\)\{/);
  assert.match(admin, /staff\.telegram\.discover/);
  assert.match(admin, /chats\.length!==1/);
  assert.match(admin, /staff\.telegram\.connect/);
  assert.match(admin, /form\.elements\.bot_token\.value=""/);
  assert.doesNotMatch(admin, /field\("chat_id"[^\n]*"required inputmode=/);
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


test("Telegram connection selects exactly one discovered chat and clears token after secure save", async () => {
  const start = admin.indexOf("  async function saveTelegramConnection(form){");
  const end = admin.indexOf("  async function saveTelegramAlerts(form){", start);
  assert.ok(start >= 0 && end > start);
  const calls = [], form = { elements: {
    bot_token: { value: "1234567890:" + "A".repeat(35) },
    chat_id: { value: "" },
  } };
  const connect = vm.runInNewContext("(" + admin.slice(start,end).trim() + ")", {
    A:{call:async(action,data)=>{
      calls.push({action,data});
      if(action==="staff.telegram.discover")return {chats:[{id:"123456789",type:"private",name:"Owner"}]};
      return {configured:true};
    }},
    document:{querySelector:()=>null},e:String,toast:()=>{},telegramAlerts:async()=>{},
  });
  await connect(form);
  assert.deepEqual(calls.map(x=>x.action),["staff.telegram.discover","staff.telegram.connect"]);
  assert.equal(calls[1].data.chat_id,"123456789");
  assert.equal(form.elements.bot_token.value,"");
  assert.equal(form.elements.chat_id.value,"123456789");
});

test("Telegram connection never selects an arbitrary recipient if multiple chats exist", async () => {
  const start=admin.indexOf("  async function saveTelegramConnection(form){");
  const end=admin.indexOf("  async function saveTelegramAlerts(form){",start);
  const calls=[], target={innerHTML:""};
  const connect=vm.runInNewContext("("+admin.slice(start,end).trim()+")",{
    A:{call:async(action)=>{calls.push(action);return {chats:[
      {id:"123456789",name:"One"},{id:"987654321",name:"Two"}]};}},
    document:{querySelector:()=>target},e:String,toast:()=>{},telegramAlerts:async()=>{},
  });
  await assert.rejects(connect({elements:{bot_token:{value:"1234567890:"+"A".repeat(35)},chat_id:{value:""}}}),/اختر المحادثة/);
  assert.deepEqual(calls,["staff.telegram.discover"]);
  assert.match(target.innerHTML,/telegram-select-chat/);
});
