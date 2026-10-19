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
test("Price UI shows only server quotes, one-digit cost, no decimal wallet, and compact limits",()=>{
  const skin=read("f90-checkout-redesign.css");
  assert.match(app,/function f90CheckoutMoney\(usd, balance = false\)/);
  assert.match(app,/maximumFractionDigits:balance\?0:\(Math\.abs\(value\)<1\?6:2\)/);
  assert.match(app,/Math\.trunc\(value\)/);
  assert.match(app,/function f90ShortLimit\(value\)/);
  assert.match(app,/\+"M"/);
  assert.match(app,/f90-quantity-limits/);
  assert.match(app,/price\.textContent=f90CheckoutMoney\(quote\.total_usd\)/);
  assert.doesNotMatch(app.slice(app.indexOf('if (ev.target.closest("#checkoutForm") && ev.target.name === "quantity")'),app.indexOf('if (ev.target.closest("#depositForm"))')),/≈|تقديري/);
  assert.match(app,/await A\.call\("quote"/);
  assert.match(skin,/:root\[data-theme="cream"\]/);
  assert.match(skin,/:root\[data-theme="dark"\]/);
  assert.match(skin,/animation:none!important/);
});
test("Images are not duplicated and navigation always resets page scroll",()=>{
  const image=app.slice(app.indexOf('const image = (src, alt'),app.indexOf('const field ='));
  const tile=app.slice(app.indexOf('function f90TileArt('),app.indexOf('const f90SeenTiles'));
  assert.match(image,/width="256" height="256"/);
  assert.match(image,/decoding="async"/);
  assert.doesNotMatch(tile,/f90-flip-back/);
  assert.match(app,/f90ScrollTopNow\(\);\s*S\.offset=0/);
  assert.match(app,/window\.addEventListener\("hashchange"/);
  assert.match(mainHtml,/rel="preconnect"/);
  assert.match(mainHtml,/f90-checkout-redesign\.css/);
});
test("Checkout price sync ignores account typing and blocks until latest server quote", () => {
  const inputStart=app.indexOf('if (ev.target.closest("#checkoutForm") && ev.target.name === "quantity")');
  assert.ok(inputStart>=0, "quantity-only event handler");
  const inputEnd=app.indexOf('if (ev.target.closest("#depositForm"))',inputStart);
  const handler=app.slice(inputStart,inputEnd);
  assert.match(handler,/S\.quote=null/);
  assert.match(handler,/\+\+S\.quoteSeq/);
  assert.match(handler,/setTimeout\(\(\)=>quoteProduct\(p\),85\)/);
  assert.doesNotMatch(handler,/تقديري|estimated|≈/);
  assert.match(handler,/qty<Number\(p\.commerce\?\.quantity_min/);
  assert.doesNotMatch(handler,/350\)/);
  assert.match(app,/form\.dataset\.pricePending === "1"/);
  assert.match(app,/form\.dataset\.quotedQuantity !== String\(Number\(/);
  const quote=app.slice(app.indexOf('async function quoteProduct(p)'),app.indexOf('function recipientFieldKind(field)'));
  assert.match(quote,/await A\.call\("quote"/);
  assert.match(quote,/seq !== S\.quoteSeq/);
  assert.match(quote,/f !== \$\("checkoutForm"\)/);
  assert.match(quote,/f\.dataset\.quotedQuantity = String\(qty\)/);
  assert.match(quote,/button\.disabled = C\.unavailable\(p\)/);
});
test("Gold checkout matches approved icon fields, badges and price-only layout", () => {
  const css=read("f90-visa-checkout.css");
  const start=app.indexOf('const productHtml = `<div class="product-page f90-visa-purchase f90-premium-checkout"');
  const end=app.indexOf('    if (inline) {',start);
  assert.ok(start>=0 && end>start);
  const product=app.slice(start,end);
  for(const token of ["f90-visa-inputicon","f90-premium-chip","f90-visa-available",
    "f90-visa-buy-arrow","f90-visa-watermark","f90-visa-logo","S.settings.logo_url"]){
    assert.ok(product.includes(token)|| (token==="S.settings.logo_url"&&app.includes(token)),token);
  }
  assert.doesNotMatch(product,/f90CheckoutTopRemaining|رصيدك بعد الشراء/);
  assert.match(app,/expected_total_usd: S\.quote\.total_usd/);
  assert.match(css,/\.f90-visa-inputrow\{direction:ltr;order:1\}/);
  assert.match(css,/\.f90-visa-buy-arrow\{right:10px;left:auto\}/);
  assert.match(css,/flex-direction:row-reverse!important/);
  assert.match(mainHtml,/app\.js\?v=[^"]+/);
  assert.match(mainHtml,/f90-visa-checkout\.css\?v=20261015-keyboard-checkout3/);
});
test("Catalog and supplier availability speedups preserve safe server quote checks",()=>{
  const edge=read("supabase/functions/f90-platform/index.ts");
  assert.match(app,/function categoryIsUnavailable\(cat\)/);
  assert.match(app,/f90CategoryAvailability\.clear\(\)/);
  assert.match(edge,/quoteProductId \? assertProviderAvailable\(quoteProductId\)/);
  assert.match(edge,/const \[productResult, providerResult\] = await Promise\.all/);
  assert.match(edge,/categoriesById\.get\(categoryId\)/);
  assert.match(edge,/await rpc\("f90_quote"/);
  assert.match(app,/idempotency_key: reference/);
});
test("Public catalog edge caching cannot cache a checkout quote",()=>{
  const edge=read("supabase/functions/f90-platform/index.ts");
  assert.match(edge,/cachedPublicCatalogUntil = Date\.now\(\) \+ 12000/);
  assert.match(edge,/if \(pendingPublicCatalog\) return pendingPublicCatalog/);
  assert.match(edge,/async function buildPublicCatalog\(\)/);
  const quoteBlock=edge.slice(edge.indexOf('if (action === "quote") {'),edge.indexOf('if (action === "quote") {')+1250);
  assert.match(quoteBlock,/await rpc\("f90_quote"/);
  assert.doesNotMatch(quoteBlock,/cachedPublicCatalog/);
});
test("Mobile performance optimizations never bypass financial validation", () => {
  const atmosphere=read("f90-atmosphere-v2.css");
  const ambient=read("f90-ambient.css");
  assert.match(app,/function f90ObserveTiles\(root\)/);
  assert.match(app,/const f90PendingTiles = new Set\(\)/);
  assert.match(app,/requestAnimationFrame\(\(\) => \{/);
  assert.doesNotMatch(app,/document\.querySelectorAll\("\.f90-flip-tile:not\(\[data-f90-observed\]\)"\)/);
  assert.match(app,/catalogRefreshBusy = true/);
  assert.match(app,/catalogRefreshBusy = false/);
  assert.match(app,/\}, 360000\)/);
  assert.match(app,/\? 3500 : 400/);
   assert.match(app,/\["profile","wallet","deposit","orders"/);
   assert.match(app,/await pendingMeRefresh/);
  assert.match(atmosphere,/@media\(max-width:760px\)\{\s*body::before,body::after\{/);
  assert.match(ambient,/\.main-content::before\{filter:none!important;opacity:\.12!important\}/);
  assert.match(mainHtml,/app\.js\?v=[^"]+/);
  assert.match(mainHtml,/f90-ambient\.css\?v=20261015-faststore1/);
  assert.match(mainHtml,/f90-atmosphere-v2\.css\?v=20261015-faststore1/);
  assert.match(app,/await A\.call\("quote", \{/);
  assert.match(app,/idempotency_key: reference/);
});

test("Mobile keyboard checkout occupies visual viewport and hides footer without touching payments",()=>{
  const css=read("f90-visa-checkout.css");
  assert.match(app,/document\.body\.append\(backdrop,panel\)/);
  assert.match(app,/checkoutPortalHome = panel\.parentElement/);
  assert.match(app,/checkoutPortalHome\.appendChild\(panel\)/);
  assert.match(app,/visualViewport\?\.addEventListener\("resize"/);
  assert.match(app,/--f90-checkout-height/);
  assert.match(app,/--f90-checkout-center/);
  assert.match(app,/document\.body\.classList\.add\("f90-checkout-open"\)/);
  assert.match(app,/document\.body\.classList\.remove\("f90-checkout-open"\)/);
  assert.match(css,/body\.f90-checkout-open #footer/);
  assert.match(css,/body\.f90-checkout-open #mobileDock/);
  assert.match(css,/body\.f90-checkout-open #quickProductPanel:not\(\[hidden\]\)/);
  assert.match(css,/max-height:calc\(var\(--f90-checkout-height,100dvh\) - 16px\)!important/);
  assert.match(css,/font-size:16px!important/);
  assert.match(app,/idempotency_key: reference/);
});
test("Safe 45s warm catalog only caches public data and revalidates before another checkout",()=>{
  assert.match(app,/publicCatalogCacheKey="f90-public-catalog-fast-v1"/);
  assert.match(app,/Date\.now\(\)-record\.saved>45000/);
  assert.match(app,/const networkCatalog=A\.call\("catalog"\)/);
  assert.match(app,/networkCatalog\.then\(fresh=>/);
  assert.match(app,/document\.getElementById\("checkoutForm"\)/);
  assert.doesNotMatch(app.slice(app.indexOf('function saveWarmCatalog('),app.indexOf('async function boot()')),/S\.me|wallet_balance|access_token/);
  assert.match(app,/await A\.call\("quote"/);
});
test("Gold purchase card shows the final cost without wallet snapshots", () => {
  const visa=read("f90-visa-checkout.css");
  const purchase=app.slice(app.indexOf('    const officialLogo = C.safeUrl(S.settings.logo_url) || "./f90-logo.png";'),app.indexOf('    if (inline) {',app.indexOf('    const officialLogo = C.safeUrl(S.settings.logo_url) || "./f90-logo.png";')));
  assert.match(mainHtml,/f90-visa-checkout\.css/);
  assert.match(purchase,/f90-visa-purchase/);
  assert.match(purchase,/f90-visa-watermark/);
  assert.match(purchase,/f90-visa-logo/);
  assert.match(purchase,/f90CheckoutTopTotal/);
  assert.doesNotMatch(purchase,/f90CheckoutTopBalance/);
  assert.doesNotMatch(purchase,/f90CheckoutTopRemaining/);
  assert.doesNotMatch(purchase,/رصيدك بعد الشراء/);
  assert.match(mainHtml,/f90-premium-checkout-install\.css/);
  for(const id of ["checkoutForm","priceBoard","checkoutTotal","quoteError","buyButton","walletHint"]){
    assert.ok(purchase.includes('id="'+id+'"'),id+" still needed for server-quote checkout");
  }
  assert.match(app,/await A\.call\("quote", \{/);
  assert.match(app,/expected_total_usd: S\.quote\.total_usd/);
  assert.match(app,/idempotency_key: reference/);
  assert.doesNotMatch(app,/data-action="confirm-wallet-checkout"/);
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
  assert.doesNotMatch(phone,/p\.link_url|laptop\.link_url/);
  assert.doesNotMatch(phone,/safe\(laptop\.link_url\)/);
  assert.doesNotMatch(phone,/\|\|contact/);
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
  assert.match(adminHtml, /admin\.js\?v=[^"]+/);
});

test("Visitors see only edge volume controls; managers own radio sources", () => {
  const radio=read("f90-media-player.js"), css=read("f90-radio.css");
  const live=read("supabase/functions/f90-platform/index.ts");
  assert.match(admin, /A\.upload\(file,"f90-radio","tracks",/);
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
  assert.match(radio, /el\.loop=false/);
  assert.match(radio, /el\.addEventListener\("ended",async\(\)=>/);
  assert.match(radio, /\(trackIndex\+1\)%state\.tracks\.length/);
  assert.match(radio, /f90-radio-volume/);
  assert.match(radio, /f90-radio-orb/);
  assert.match(radio, /media\.state/);
  assert.doesNotMatch(radio, /youtube-nocookie|<iframe/);
  assert.match(css, /\.f90-radio-hidden-media/);
  assert.match(css, /\.f90-radio-popup/);
  assert.match(mainHtml, /f90-radio\.css/);
  assert.doesNotMatch(app, /\["music","ميوزك أف تسعين","headphones"\]/);
});

test("Radio sources remain manager-only; listeners can seek and change tracks with mobile controls", () => {
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
  assert.match(radio,/function appearance\(input\)/);
  assert.match(radio,/bubble\.dataset\.side=o\.side/);
  assert.match(radio,/stallTimer/);
  assert.match(radio,/addEventListener\("waiting"/);
  assert.match(radio,/f90-radio-custom-icon/);
  assert.match(radio,/media\.state/);
  assert.match(radio,/id="f90RadioPrev"/);
  assert.match(radio,/id="f90RadioNext"/);
  assert.match(radio,/id="f90RadioSeek"/);
  assert.match(radio,/id="f90RadioPlayPause"/);
  assert.doesNotMatch(radio,/staff\.radio\.save/);
  assert.match(css,/f90-radio-mobile-size/);
  assert.match(css,/data-side="left"/);
  assert.match(edge,/currentBubble/);
  assert.match(edge,/bubble:m\.bubble\|\|\{\}/);
  assert.match(edge,/size_mobile/);
  assert.doesNotMatch(phone,/p\.link_url|laptop\.link_url/);
  assert.match(phone,/f90-phone-size/);
  assert.match(api,/radioMimeAliases/);
  assert.match(api,/audio\/x-m4a/);
});

test("Administration has its own install manifest", () => {
  const manifest=JSON.parse(read("admin.webmanifest"));
  assert.match(manifest.start_url,/admin\.html/);
  assert.match(adminHtml,/id="adminInstall"/);
});
test("Storefront navigation resets to top without interfering with order history", () => {
  assert.match(app, /async function history\(kind\)/);
  assert.match(app, /function f90ScrollTopNow\(\)/);
  assert.match(app, /window\.history\.scrollRestoration="manual"/);
  assert.match(app, /window\.addEventListener\("hashchange"/);
  assert.doesNotMatch(app, /(^|[^.])history\.replaceState\(/m);
  assert.match(mainHtml, /f90-startup-rescue\.js/);
});

test("Route scroll restoration is back-aware and Telegram settings are restricted to managers", () => {
  assert.match(app,/function f90ScrollTopNow\(\)/);
  assert.match(app,/history\.scrollRestoration="manual"/);
  assert.match(admin,/telegramAlertsForm/);
  assert.match(admin,/staff\.telegram\.test/);
  assert.match(admin,/telegram-alerts/);
});
test("Telegram connector safely discovers Chat ID without requiring it upfront", () => {
  assert.match(adminHtml, /admin\.js\?v=[^"]+/);
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
