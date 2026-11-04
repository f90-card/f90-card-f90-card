const test=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./dom-harness.cjs');
async function setup(archived=false){
 const h=await harness('admin.html',{role:'manager'});
 const base=h.window.F90API.call; const calls=[];
 let rows=[{id:'delete-supplier',name:'مورد الاختبار',adapter:'smm',endpoint:'https://example.invalid',currency:'USD',config:archived?{archived_at:"2026-01-01"}:{}}];
 let resolve;
 h.window.F90API.call=(action,args)=>{
  if(action==='staff.providers')return Promise.resolve(rows);
  if(action==='provider.archive'){calls.push(args);return new Promise(r=>{resolve=()=>{rows=[];r({deleted:true});};});}
  return base(action,args);
 };
 h.window.location.hash='#/providers'; await h.settle();
 return Object.assign(h,{deletions:calls,finish:()=>resolve()});
}
test('supplier delete requires matching name, prevents duplicate requests and refreshes supplier list',async()=>{
 const h=await setup();
 try{
  const button=h.document.querySelector('[data-action="provider-archive"]');assert.ok(button);
  button.click();await h.settle();assert.equal(h.deletions.length,0);
  const confirm=h.document.querySelector('[data-action="provider-archive-confirm"]');
  h.document.getElementById('providerDeleteName').value='اسم آخر';confirm.click();await h.settle();
  assert.equal(h.deletions.length,0,'wrong name must not send deletion');
  h.document.getElementById('providerDeleteName').value='مورد الاختبار';confirm.click();await h.settle();
  assert.equal(h.deletions.length,1);assert.equal(h.deletions[0].id,'delete-supplier');assert.equal(confirm.disabled,true);
  confirm.click();await h.settle();assert.equal(h.deletions.length,1);
  h.finish();await h.settle();await h.settle();
  assert.equal(h.document.querySelector('[data-action="provider-archive"]'),null);
 }finally{h.cleanup();}
});
test('canceling supplier delete sends no mutation',async()=>{
 const h=await setup();
 try{
  h.document.querySelector('[data-action="provider-archive"]').click();await h.settle();
  const cancel=h.document.querySelector('#modalRoot [data-action="close-modal"]');assert.ok(cancel);cancel.click();await h.settle();
  assert.equal(h.document.getElementById('modalRoot').innerHTML,'');
  assert.equal(h.deletions.length,0);
 }finally{h.cleanup();}
});

test('archived suppliers expose deletion without operational controls',async()=>{
 const h=await setup(true);
 try{
  const row=h.document.querySelector('.catalog-row');
  assert.equal(row.querySelectorAll('.row-actions button').length,1);
  assert.ok(row.querySelector('[data-action="provider-archive"]'));
  assert.equal(h.deletions.length,0);
 }finally{h.cleanup();}
});
