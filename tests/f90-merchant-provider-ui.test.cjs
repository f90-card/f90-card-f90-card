const test=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./dom-harness.cjs');
test('provider creation offers F90 protocol and recognizes own endpoint with USD and purchases disabled',async()=>{
  const h=await harness('admin.html',{role:'manager'});
  try{
    const call=h.window.F90API.call;
    h.window.F90API.call=(action,...args)=>action==='staff.providers'?Promise.resolve([]):call(action,...args);
    h.window.location.hash='#/providers';await h.settle();
    h.document.querySelector('[data-action="provider-new"]').click();await h.settle();
    const form=h.document.getElementById('providerForm');
    const adapter=form.querySelector('[name="adapter"]');
    assert.ok([...adapter.querySelectorAll('option')].some(x=>x.value==='f90_merchant'&&x.textContent.includes('x-f90-key')));
    const endpoint=form.querySelector('[name="endpoint"]');endpoint.value='https://www.f90card.online/api/v1';
    endpoint.dispatchEvent(new h.window.Event('change'));await h.settle();
    assert.equal(adapter.value,'f90_merchant');
    assert.equal(form.querySelector('[name="currency"]').value,'USD');
    const automatic=form.querySelector('[name="automatic_orders_enabled"]');
    assert.equal(automatic.disabled,true);assert.equal(automatic.checked,false);
    adapter.dispatchEvent(new h.window.Event('change',{bubbles:true}));
    assert.equal(automatic.disabled,true,'document change handler must preserve the self-test guard');
    assert.equal(form.querySelector('[name="token"]').type,'password');
    adapter.value='f90_merchant_get';
    adapter.dispatchEvent(new h.window.Event('change',{bubbles:true}));
    assert.equal(automatic.disabled,true,'GET mode cannot enable self purchases');
    assert.equal(form.querySelector('#f90GetProtocolGuide').hidden,false);
  }finally{h.cleanup();}
});
