import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("special service modules compile and both entry points load in correct order",()=>{
 const storefront=read("index.html"),admin=read("admin.html");
 for(const file of ["f90-special.js","f90-special-admin.js","f90-content-admin.js","app.js","admin.js","f90-welcome-scene.js"]){
  assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}));
 }
 assert.ok(storefront.indexOf("./f90-special.js")<storefront.indexOf("./app.js?v="));
 assert.ok(admin.indexOf("./f90-special-admin.js")<admin.indexOf("./admin.js?v="));
 assert.ok(admin.indexOf("./f90-content-admin.js")<admin.indexOf("./admin.js?v="));
 assert.match(storefront,/f90-special\.css/);
 assert.match(admin,/f90-special\.css/);
});
test("dedicated wallet transfers and salary approval remain server-authoritative",()=>{
 const ui=read("f90-special.js"),sql=read("supabase/migrations/20261015210000_f90_special_requests.sql");
 assert.match(ui,/client\.rpc\("f90_special_submit"/);
 assert.match(ui,/p_amount:value/);
 assert.match(ui,/client\.rpc\("f90_submit_salary(?:_v2)?"/);
 assert.match(ui,/client\.rpc\("f90_submit_transfer"/);
 assert.match(ui,/p_net:value/);
 assert.match(ui,/salary_usd_per_100k:10/);
 assert.match(ui,/transfer_fee_percent:2/);
 assert.match(ui,/100000/);
 assert.match(sql,/amount<100000/);
 assert.match(sql,/amount \* rate \/ 100000/);
 assert.match(sql,/fee_rate/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/is_verified=true/);
 assert.match(sql,/unique\(user_id,idempotency_key\)/);
 assert.match(sql,/wallet_changed',false/);
 assert.doesNotMatch(ui,/f90_wallets|f90_wallet_ledger|staff\.adjust/);
});
test("manual finance approvals require manager authority, and user data remains private",()=>{
 const sql=read("supabase/migrations/20261015210000_f90_special_requests.sql");
 assert.match(sql,/alter table public\.f90_special_requests enable row level security/);
 assert.match(sql,/grant select on public\.f90_special_requests to authenticated/);
 assert.match(sql,/user_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/f90_private\.my_role\(\) <> 'manager'/);
 assert.match(sql,/revoke all on function public\.f90_special_submit/);
 assert.match(sql,/grant execute on function public\.f90_special_submit/);
});
test("services work on mobile with five unique banner visuals",()=>{
 const ui=read("f90-special.js"),css=read("f90-special.css"),app=read("app.js");
 assert.match(ui,/banner-transfer\.webp/);
 for(const item of ["banner-design.webp","banner-digital.webp","banner-website.webp","banner-salary.webp"])
  assert.ok(ui.includes(item),item);
 assert.match(css,/@media\(max-width:740px\)/);
 assert.match(css,/scroll-snap-type:x mandatory/);
 assert.match(app,/f90-category-top/);
 assert.match(app,/categoryBanner/);
 assert.match(app,/page === "special"/);
});
test("paired laptop and phone preserve user-controlled display sizing",()=>{
 const scene=read("f90-welcome-scene.js");
 assert.match(scene,/phone_size_mobile/);
 assert.match(scene,/laptop_size_mobile/);
 assert.match(scene,/Math\.min\(max,Math\.max\(min,n\)\)/);
 assert.match(scene,/f90-home-laptop-video/);
 assert.match(read("f90-experience-upgrade.css"),/f90-home-phone-island\{display:none!important\}/);
});

// Separate DOM tests ensure the new route actually renders rather than leaving a spinner.
test("salary and transfer pages render on the existing storefront router",async()=>{
 const { harness }=await import("./dom-harness.cjs");
 const salary=await harness("index.html",{hash:"#/special/salary",verified:true});
 try{
  const content=salary.document.getElementById("mainContent").textContent;
  assert.match(content,/Xena Live/);
  assert.match(content,/100,000/);
  assert.ok(salary.document.getElementById("f90SpecialForm"));
 }finally{salary.cleanup();}
 const transfer=await harness("index.html",{hash:"#/special/transfer",verified:true});
 try{
  assert.ok(transfer.document.getElementById("f90SpecialForm"));
  assert.match(transfer.document.getElementById("mainContent").textContent,/تحويل الأموال/);
 }finally{transfer.cleanup();}
});

test("full website order is linked to the real USD 500 checkout with WhatsApp field",()=>{
 const app=read("app.js"),ui=read("f90-special.js");
 const sql=read("supabase/migrations/20261015220000_f90_website_checkout.sql");
 assert.match(app,/specialRoute==="website" \? href\("product","f90-full-website-500"\)/);
 assert.match(ui,/#\/product\/f90-full-website-500/);
 assert.match(sql,/'f90-full-website-500'/);
 assert.match(sql,/'USD'/);
 assert.match(sql,/500/);
 assert.match(sql,/'fulfillment','manual'/);
 assert.match(sql,/'label_ar','رقم واتساب للتواصل'/);
});
test("financial operations reuse atomic existing salary and wallet debit RPCs",()=>{
 const ui=read("f90-special.js"),admin=read("f90-special-admin.js"),guard=read("supabase/migrations/20261015213000_secure_finance_rpcs.sql");
 for(const name of ["f90_submit_salary","f90_submit_transfer"])assert.ok(ui.includes(name),name);
 for(const name of ["f90_review_salary","f90_review_transfer"])assert.ok(admin.includes(name),name);
 assert.match(guard,/revoke execute on function public\.f90_submit_transfer/);
 assert.match(guard,/grant execute on function public\.f90_submit_transfer.*to authenticated/);
 assert.match(guard,/f90_special_nonfinancial_only/);
});

test("existing transfer subcategories open their exact payment form, and website uses wallet checkout",()=>{
 const app=read("app.js"),special=read("f90-special.js");
 assert.match(app,/c\.slug\?\.startsWith\("transfer-"\)/);
 assert.match(app,/encodeURIComponent\(c\.slug\.slice\("transfer-"\.length\)\)/);
 assert.match(app,/window\.F90Special\?\.render\(id,S\.settings,S\.me,serviceChoice/);
 assert.match(special,/selected===x\.id/);
 assert.match(special,/#\/product\/f90-full-website-500/);
 assert.match(special,/f90_submit_transfer/);
 assert.match(special,/f90_submit_salary/);
 assert.doesNotMatch(special,/<\/button><\/form>\+'\s*'<p class="f90-special-footnote"/);
});
test("special home keeps five independent ads instead of duplicate category tiles",()=>{
 const ui=read("f90-special.js");
 const home=ui.slice(ui.indexOf("function home(settings){"),ui.indexOf("function category(slug,settings){"));
 assert.match(home,/f90-special-ad-strip/);
 assert.doesNotMatch(home,/f90-special-tiles/);
 assert.match(home,/images\[id\]/);
 assert.match(read("f90-special.css"),/f90-home-devices/);
});
