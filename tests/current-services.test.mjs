import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fixture,harness} from './dom-harness.cjs';
const read=x=>fs.readFileSync(new URL('../'+x,import.meta.url),'utf8');
test('request sections remain accessible without ordinary priced inventory',async()=>{
 for(const slug of ['account-sales','design-services','money-transfer']){
  const catalog=fixture();catalog.categories.push({id:slug,slug,name:slug,is_active:true,parent_id:null,presentation:{availability:'available'}});
  const h=await harness('index.html',{catalog});
  try{const link=h.document.querySelector(`a[href="#/category/${slug}"]`);assert.ok(link,slug);assert.notEqual(link.getAttribute('aria-disabled'),'true');}finally{h.cleanup();}
 }
});
test('home advertisements have no destinations and salary stays outside home',()=>{
 const listeners={};const context={window:{},document:{addEventListener:(n,f)=>listeners[n]=f},location:{href:'https://example.invalid/'}};
 vm.runInNewContext(read('f90-special.js'),context);
 const home=context.window.F90Special.home({config:{}});
 assert.doesNotMatch(home,/href=|salary|Xena/);
 assert.equal((home.match(/class="f90-special-ad"/g)||[]).length,4);
});
test('device media ignores saved legacy links and preserves both uploaded images',()=>{
 const context={window:{},URL,location:{href:'https://example.invalid/'}};
 vm.runInNewContext(read('f90-welcome-scene.js'),context);
 const html=context.window.F90WelcomeScene.homePhone({promo_video:{enabled:true,mode:'image',image_url:'https://example.invalid/phone.png',link_url:'https://wa.me/123',laptop:{image_url:'https://example.invalid/laptop.png',link_url:'https://example.invalid/destination'}}},'https://example.invalid/logo.png');
 assert.doesNotMatch(html,/href=|wa.me|destination/);assert.match(html,/phone.png/);assert.match(html,/laptop.png/);
});
test('configured paid services open real product route and unpriced services keep request route',()=>{
 const main={innerHTML:''};const context={window:{},document:{addEventListener(){},getElementById:()=>main}};
 vm.runInNewContext(read('f90-special.js'),context);
 context.window.F90Special.category('design-services',{config:{special_services:{service_catalog:[{id:'paid',kind:'design',name_ar:'مدفوع',product_slug:'actual-product',enabled:true},{id:'quote',kind:'design',name_ar:'طلب تفاصيل',enabled:true}]}}});
 assert.match(main.innerHTML,/#\/product\/actual-product/);assert.match(main.innerHTML,/#\/special\/design\/quote/);
});
