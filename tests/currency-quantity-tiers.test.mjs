import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanCurrencyPricing,nativePrice} from '../supabase/functions/f90-platform/currency-pricing.mjs';
import C from '../store-core.js';
import harnessModule from './dom-harness.cjs';
const {fixture,harness}=harnessModule;
const pricing={enabled:true,unit_quantity:1000000,prices:{USD:114,JOD:90,ILS:400},tiers_enabled:true,tiers:[{min:1,prices:{JOD:85,ILS:390}},{min:1000000,prices:{JOD:80,ILS:375}},{min:2000000,prices:{JOD:95}}]};
const rates=[{currency:'USD',name_ar:'دولار',is_enabled:true,per_usd:1},{currency:'JOD',name_ar:'دينار',is_enabled:true,per_usd:.71},{currency:'ILS',name_ar:'شيقل',is_enabled:true,per_usd:3.35}];
const product={commerce:{type:'quantity',unit_quantity:1000000,prices:{USD:114},currency_pricing:pricing}};
test('inclusive quantity bands can reduce then increase the whole-order native price',()=>{
  for(const [qty,unit] of [[1,85],[500000,85],[999999,85],[1000000,80],[1000001,80],[1999999,80],[2000000,95],[3000000,95]]){
    assert.equal(nativePrice(pricing,'JOD',qty),unit);
    const actual=C.previewPrice(product,qty,{currency:'JOD',rates})*.71;
    assert.ok(Math.abs(actual-qty/1000000*unit)<1e-9,`${qty}: ${actual}`);
  }
});
test('blank currency inherits its earlier native band, then base, then legacy pricing',()=>{
  assert.equal(nativePrice(pricing,'ILS',2000000),375);
  assert.equal(nativePrice(pricing,'USD',2000000),114);
  assert.equal(nativePrice(pricing,'EUR',2000000),null);
  const withoutBase={...pricing,prices:{}};
  assert.equal(nativePrice(withoutBase,'JOD',1),85);
  assert.equal(C.previewPrice({...product,commerce:{...product.commerce,currency_pricing:withoutBase}},1000000,{currency:'USD',rates}),114);
});
test('band pricing is independent of FX, applies user markup and uses fixed pack quantity',()=>{
  assert.ok(Math.abs(C.previewPrice(product,1000000,{currency:'JOD',rates,markup:10})*.71-88)<1e-9);
  const changed=rates.map(r=>({...r,per_usd:r.currency==='JOD'?.8:r.per_usd}));
  assert.equal(C.previewPrice(product,1000000,{currency:'JOD',rates:changed})*.8,80);
  const fixed={commerce:{...product.commerce,type:'fixed',pack_quantity:2000000}};
  assert.equal(C.previewPrice(fixed,1,{currency:'JOD',rates})*.71,190);
});
test('band, product and global disable restore prior pricing and retain all band values',()=>{
  const snapshot=JSON.stringify(pricing);
  assert.equal(C.previewPrice({...product,commerce:{...product.commerce,currency_pricing:{...pricing,tiers_enabled:false}}},1000000,{currency:'JOD',rates})*.71,90);
  assert.equal(C.previewPrice({...product,commerce:{...product.commerce,currency_pricing:{...pricing,enabled:false}}},1000000,{currency:'JOD',rates}),114);
  assert.equal(C.previewPrice(product,1000000,{currency:'JOD',rates,currencyPricingEnabled:false}),114);
  assert.equal(JSON.stringify(pricing),snapshot);
});
test('API normalization sorts, preserves disabled bands and rejects ambiguous or invalid prices/thresholds',()=>{
  assert.deepEqual(cleanCurrencyPricing({...pricing,tiers:[...pricing.tiers].reverse()}),pricing);
  assert.equal(cleanCurrencyPricing({...pricing,tiers_enabled:false}).tiers.length,3);
  assert.equal(cleanCurrencyPricing({enabled:true,unit_quantity:1000000,tiers_enabled:true,tiers:[{min:1,prices:{JOD:80}}]}).prices.JOD,undefined);
  for(const bad of [
    {...pricing,tiers:[pricing.tiers[0],pricing.tiers[0]]},
    {...pricing,tiers:[{min:0,prices:{JOD:80}}]},
    {...pricing,tiers:[{min:1.1,prices:{JOD:80}}]},
    {...pricing,tiers:[{min:1,prices:{JOD:-80}}]},
    {...pricing,tiers:[{min:1,prices:{JOD:0}}]},
    {...pricing,tiers:[{min:1,prices:{JOD:.1234567}}]},
    {...pricing,tiers:[{min:1,prices:{JOD:true}}]},
    {...pricing,tiers:[{min:1,prices:{}}]},
    {...pricing,tiers:[]},
    {...pricing,tiers_enabled:'true'},
    {...pricing,tiers:Array.from({length:41},(_,i)=>({min:i+1,prices:{JOD:1}}))},
  ]) assert.throws(()=>cleanCurrencyPricing(bad));
});
test('manager saves native currency bands using real editor, removes rows and preserves disabled values',async()=>{
  const catalog=fixture();catalog.rates=rates;catalog.products[0].commerce.currency_pricing=pricing;
  const h=await harness('admin.html',{role:'manager',hash:'#/products',catalog});
  try{
    h.document.querySelector('[data-action="catalog-edit"]').click();await h.settle();
    const form=h.document.getElementById('catalogForm');
    assert.equal(form.querySelectorAll('[data-currency-tier-row]').length,3);
    form.querySelector('[data-currency-tier-code="JOD"]').value='87';
    form.elements.currency_tiers_enabled.checked=false;
    h.document.querySelector('[data-action="add-currency-tier"]').click();await h.settle();
    let rows=form.querySelectorAll('[data-currency-tier-row]');assert.equal(rows.length,4);
    rows[3].querySelector('[data-action="remove-row"]').click();await h.settle();
    assert.equal(form.querySelectorAll('[data-currency-tier-row]').length,3);
    form.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));await h.settle();
    const save=h.calls.find(c=>c.action==='catalog.save');
    assert.ok(save,JSON.stringify(h.calls.map(c=>c.action)));
    const serialized=JSON.stringify(save.args);
    assert.match(serialized,/"tiers_enabled":false/);assert.match(serialized,/"JOD":87/);assert.match(serialized,/"min":2000000/);
  }finally{h.cleanup();}
});
