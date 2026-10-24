const test=require('node:test');
const assert=require('node:assert/strict');
const {harness,fixture}=require('./dom-harness.cjs');
const C=require('../store-core.js');
const extra={currency:'SAR',name_ar:'ريال سعودي',per_usd:3.77,is_enabled:true};
test('any enabled registry currency is usable and disabled/archived currencies are excluded',()=>{
 const rates=[extra,{currency:'ABC',name_ar:'عملة جديدة',per_usd:7,is_enabled:true},{currency:'OLD',per_usd:1,is_enabled:false},{currency:'DEL',per_usd:1,is_enabled:true,is_archived:true}];
 assert.deepEqual(C.currencyOptions(rates).map(x=>x[0]),['SAR','ABC']);
 assert.equal(C.convert(10,'SAR',rates),37.7);assert.equal(C.convert(10,'DEL',rates),null);assert.equal(C.convert(7.54,'USD',rates),7.54);
 C.setCurrencyRates(rates);assert.match(C.money(37.7,'SAR'),/ريال سعودي/);
});
test('SAR is selectable for a guest account and registration without a fixed whitelist',async()=>{
 const catalog=fixture();catalog.rates.push(extra);
 const h=await harness('index.html',{catalog,guest:true,hash:'#/auth'});
 try{
  const select=h.document.querySelector('[name="account_currency"]');assert.ok(select);
  select.value='SAR';select.dispatchEvent(new h.window.Event('change',{bubbles:true}));await h.settle();
  assert.equal(h.document.getElementById('currencySelect').value,'SAR');
  assert.ok([...select.querySelectorAll('option')].some(x=>x.value==='SAR'));
 }finally{h.cleanup();}
});
test('manager currency screen offers deletion, purge and active new-currency save',async()=>{
 const catalog=fixture();catalog.rates.push(extra);
 const h=await harness('admin.html',{catalog,role:'manager',hash:'#/rates'});
 try{
  assert.ok(h.document.querySelector('[data-action="rate-delete"][data-currency="SAR"]'));
  assert.equal(h.document.querySelector('[data-action="rate-delete"][data-currency="USD"]'),null);
  assert.ok(h.document.querySelector('[data-action="rate-purge"]'));
  const form=h.document.getElementById('newRateForm');
  form.querySelector('[name="currency"]').value='abc';
  form.querySelector('[name="name_ar"]').value='عملة جديدة';
  form.querySelector('[name="per_usd"]').value='7';
  form.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));await h.settle();
  const call=h.calls.find(x=>x.action==='staff.rate');assert.equal(call.args.is_enabled,true);assert.equal(call.args.per_usd,7);
 }finally{h.cleanup();}
});
