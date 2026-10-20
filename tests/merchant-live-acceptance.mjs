import assert from "node:assert/strict";
import {createHash} from "node:crypto";
const endpoint="https://www.f90card.online/api/v1";
const get=async(url,options={})=>fetch(url,{...options,redirect:"error",signal:AbortSignal.timeout(20000)});
const health=await get(endpoint);
assert.equal(health.status,200);
assert.match(health.headers.get("content-type"),/application\/json/);
assert.equal((await health.json()).endpoint,endpoint);
const preflight=await get(endpoint,{method:"OPTIONS",headers:{Origin:"https://merchant.example.invalid","Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"content-type,x-f90-key"}});
assert.equal(preflight.status,204);
assert.match(preflight.headers.get("access-control-allow-methods"),/POST/);
assert.match(preflight.headers.get("access-control-allow-headers"),/x-f90-key/i);
const invalid=await get(endpoint,{method:"POST",headers:{"Content-Type":"application/json","x-f90-key":"f90_live_"+"0".repeat(64)},body:'{"action":"balance"}'});
assert.equal(invalid.status,401);
assert.equal((await invalid.json()).error.code,"F90_AUTH");
assert.equal((await get(endpoint,{method:"DELETE"})).status,405);
const legacy=await get("https://www.f90card.online/api/merchant");
assert.equal(legacy.status,200);
assert.equal((await legacy.json()).name,"F90 CARD Merchant API");
const page=await get("https://www.f90card.online/");
const html=await page.text();
assert.equal(page.status,200);
assert.ok(html.includes("f90-compact-purchase-20261020.css?v=4"),"preserve concurrent checkout v4");
const docs=await get("https://www.f90card.online/f90-merchant-v2.js?v=20261020-api-v1-verified");
const js=await docs.text();
assert.ok(js.includes("دليل التاجر وربط المتاجر"));
assert.ok(js.includes(endpoint));
const admin=await get("https://www.f90card.online/admin.html");
assert.equal(admin.status,200);
for(const [path,hash] of [
["345c2e5c-f40c-5b8c-8e30-91384b21b68e-1271d1f6c5f9557a.png","1271d1f6c5f9557a"],
["7fb29690-5c9f-5345-bd7e-81008f046ef1-6652553289319300.png","6652553289319300"],
["37134ef8-9e1b-5aea-94c2-1b882c05f6cf-55da3e5af61df029.png","55da3e5af61df029"]]){
 const image=await get("https://f90-card-media.pages.dev/media/official/product/"+path);
 assert.equal(image.status,200);
 assert.match(image.headers.get("content-type"),/image\/png/);
 const bytes=Buffer.from(await image.arrayBuffer());
 assert.equal(createHash("sha256").update(bytes).digest("hex").slice(0,16),hash);
 assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.ok(bytes.readUInt32BE(16)>=64&&bytes.readUInt32BE(20)>=64);
}
console.log(JSON.stringify({https:true,json_endpoint:true,cors_preflight:true,invalid_key_rejected:true,method_rejected:true,legacy_route:true,arabic_guide:true,storefront:true,admin_html:true,checkout_v4_preserved:true,verified_original_images:3,real_orders_created:0}));
