const test=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./dom-harness.cjs');
async function setup(archived=false){
 const h=await harness('admin.html',{role:'manager'});
 const base=h.window.F90API.call; const calls=[];
 let rows=[{id:'delete-supplier',name:'مورد الاختبار',adapter:'smm',endpoint:'https://example.invalid',currency:'USD',config:archived?{archived_at:"2026-01-01"}:{}}];
 let resolve, reject;
 h.window.F90API.call=(action,args)=>{
  if(action==='staff.providers')return Promise.resolve(rows);
  if(action==='provider.archive'){calls.push(args);return new Promise((r,j)=>{resolve=()=>{rows=[];r({deleted:true});};reject=j;});}
  return base(action,args);
 };
 h.window.location.hash='#/providers'; await h.settle();
 return Object.assign(h,{deletions:calls,finish:()=>resolve(), fail:()=>reject(new Error("لا يمكن حذف المورد قبل إنهاء طلباته"))});
}
test('confirmation deletes without typing a name and prevents duplicate requests',async()=>{
 const h=await setup();
 try{
  const button=h.document.querySelector('[data-action="provider-archive"]');assert.ok(button);
  assert.equal(h.deletions.length,0,'rendering must never delete');
  button.click();await h.settle();
  assert.equal(h.deletions.length,0,'opening confirmation must not delete');
  const confirm=h.document.querySelector('[data-action="provider-archive-confirm"]');assert.ok(confirm);
  confirm.click();await h.settle();
  assert.equal(h.document.getElementById('providerDeleteName'),null);
  assert.equal(h.deletions.length,1);assert.equal(h.deletions[0].id,'delete-supplier');assert.equal(confirm.disabled,true);
  confirm.click();await h.settle();assert.equal(h.deletions.length,1);
  h.finish();await h.settle();await h.settle();
  assert.equal(h.document.querySelector('[data-action="provider-archive"]'),null);
 }finally{h.cleanup();}
});
test('failed deletion retains supplier and re-enables the button for retry',async()=>{
 const h=await setup();
 try{
  const button=h.document.querySelector('[data-action="provider-archive"]');
  button.click();await h.settle();
  const confirm=h.document.querySelector('[data-action="provider-archive-confirm"]');confirm.click();await h.settle();h.fail();await h.settle();
  assert.equal(confirm.isConnected,true);assert.equal(confirm.disabled,false);
  assert.match(h.document.body.textContent,/لا يمكن حذف المورد قبل إنهاء طلباته/);
  confirm.click();await h.settle();assert.equal(h.deletions.length,2);
  h.finish();await h.settle();
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

test('canceling confirmation does not send a deletion',async()=>{
 const h=await setup();try{
 h.document.querySelector('[data-action="provider-archive"]').click();await h.settle();
 h.document.querySelector('#modalRoot [data-action="close-modal"]').click();await h.settle();
 assert.equal(h.deletions.length,0);assert.equal(h.document.getElementById('modalRoot').innerHTML,'');
 }finally{h.cleanup();}
});
