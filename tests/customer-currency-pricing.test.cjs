const test=require('node:test'),assert=require('node:assert/strict'),C=require('../store-core.js');
const {fixture,harness}=require('./dom-harness.cjs');
const product={price:114,currency:'USD',commerce:{type:'quantity',prices:{USD:114},unit_quantity:1000000,pack_quantity:500000,currency_pricing:{enabled:true,unit_quantity:1000000,prices:{USD:114,JOD:80,ILS:375}}}};
const rates=[{currency:'USD',per_usd:1,is_enabled:true},{currency:'ILS',per_usd:3.35,is_enabled:true},{currency:'JOD',per_usd:.71,is_enabled:true}];
test('currency-specific product prices scale independently of exchange rates',()=>{
 assert.equal(C.previewPrice(product,1000000,{currency:'USD',rates}),114);
 assert.equal(C.previewPrice(product,1000000,{currency:'JOD',rates})*.71,80);
 assert.equal(C.previewPrice(product,500000,{currency:'ILS',rates})*3.35,187.5);
 const changed=rates.map(r=>({...r,per_usd:r.currency==='JOD'?.8:r.per_usd}));
 assert.equal(C.previewPrice(product,1000000,{currency:'JOD',rates:changed})*.8,80);
});
test('per-user markup and global or product disable switches preserve the default pricing',()=>{
 assert.equal(C.previewPrice(product,1000000,{currency:'USD',rates,markup:10}),125.4);
 assert.equal(C.previewPrice(product,1000000,{currency:'JOD',rates,currencyPricingEnabled:false}),114);
 assert.equal(C.previewPrice({...product,commerce:{...product.commerce,currency_pricing:{...product.commerce.currency_pricing,enabled:false}}},1000000,{currency:'JOD',rates}),114);
 assert.equal(C.previewPrice({...product,commerce:{...product.commerce,type:'fixed'}},1,{currency:'JOD',rates})*.71,40);
});
test('checkout uses the exact server-native total while sending the wallet USD quote to checkout',async()=>{
 const catalog=fixture();catalog.products[0].commerce={...catalog.products[0].commerce,...product.commerce,quantity_min:1000000,quantity_max:3000000};catalog.rates=rates.map(r=>({...r,per_usd:r.currency==='JOD'?.75:r.per_usd}));
 const h=await harness('index.html',{hash:'#/product/coins',currency:'JOD',catalog,balance:1000,quote:{product_id:'coins',quantity:1000000,total_usd:112.676056,total_currency:80,subtotal_usd:112.676056,discount_usd:0,price_currency:'JOD',vip_level:1}});
 try{await h.settle();assert.equal(h.document.getElementById('f90CheckoutTopTotal').textContent,'80');assert.equal(h.calls.find(x=>x.action==='quote').args.currency,'JOD');}finally{h.cleanup();}
});
test('every manager product editor exposes independent quantity/currency pricing and global control',async()=>{
 const catalog=fixture();catalog.rates=rates.map(r=>({...r,name_ar:r.currency}));
 const h=await harness('admin.html',{role:'manager',hash:'#/products',catalog});
 try{assert.ok(h.document.querySelector('[data-action="currency-pricing-global"]'));h.document.querySelector('[data-action="catalog-edit"]').click();await h.settle();
 assert.ok(h.document.querySelector('[name="currency_pricing_enabled"]'));assert.ok(h.document.querySelector('[name="currency_pricing_unit"]'));
 for(const code of ['USD','ILS','JOD'])assert.ok(h.document.querySelector('[name="currency_price_'+code+'"]'),code);
 }finally{h.cleanup();}
});

test('manager customer controls save individual markup and credit in selected native currency with a rate snapshot',async()=>{
 const catalog=fixture();catalog.rates=rates.map(r=>({...r,name_ar:r.currency}));
 const user={id:'fixture-only',display_name:'اختبار معزول',email:'fixture@example.invalid',role:'customer',account_status:'active',is_verified:true,balance_usd:20};
 const h=await harness('admin.html',{role:'manager',hash:'#/users',catalog,users:[user]});
 try{
 h.window.confirm=()=>true;
 h.document.querySelector('[data-action="detail-user"]').click();await h.settle();
 let form=h.document.getElementById('userMarkupForm');assert.ok(form);form.elements.percent.value='10';form.elements.enabled.checked=true;
 form.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));await h.settle();
 const markup=h.calls.find(x=>x.action==='staff.markup');assert.deepEqual(JSON.parse(JSON.stringify(markup.args)),{id:'fixture-only',percent:10,enabled:true});
 form=h.document.getElementById('financeAdjustForm');assert.ok(form);form.elements.currency.value='ILS';form.elements.amount.value='33.5';form.elements.note.value='اختبار إضافة رصيد معزول';
 form.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));await h.settle();
 const credit=h.calls.find(x=>x.action==='staff.adjust');assert.ok(credit);assert.equal(credit.args.currency,'ILS');assert.equal(credit.args.amount,33.5);assert.equal(credit.args.expected_rate,3.35);assert.equal(credit.args.expected_balance,20);assert.ok(credit.args.request_id);assert.equal(credit.args.amount_usd,undefined,'conversion is authoritative on the server');
 }finally{h.cleanup();}
});
