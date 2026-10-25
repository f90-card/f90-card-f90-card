const test=require('node:test'),assert=require('node:assert/strict');
const {harness,fixture}=require('./dom-harness.cjs');
test('store search updates results while typing Arabic, English and empty queries',async()=>{
 const catalog=fixture();catalog.products[0].name='شحن ببجي';
 const h=await harness('index.html',{hash:'#/search/',catalog});
 try{
 const input=h.document.getElementById('f90SearchPageInput');assert.ok(input);
 for(const [q,count] of [['pubg',1],['بُبْجِي',1],['غير موجود',0],['',0]]){
 input.value=q;input.dispatchEvent(new h.window.Event('input',{bubbles:true}));await h.settle();
 assert.equal(h.document.querySelectorAll('#f90SearchResults .f90-product-tile').length,count,q);
 assert.equal(h.document.getElementById('f90SearchPageInput'),input,'typing does not replace focused input');
 }
 }finally{h.cleanup();}
});
test('admin product search normalizes Arabic/English aliases and clearing restores rows',async()=>{
 const catalog=fixture();catalog.products[0].name='شحن ببجي';catalog.products.push({...catalog.products[0],id:'other',slug:'other',name:'تيك توك'});
 const h=await harness('admin.html',{hash:'#/products',catalog,role:'manager'});
 try{
 const input=h.document.getElementById('productNameSearch');assert.ok(input);
 for(const [q,visible] of [['pubg',1],['بُبْجِي',1],['مفقود',0],['',2]]){
 input.value=q;input.dispatchEvent(new h.window.Event('input',{bubbles:true}));await h.settle();
 assert.equal([...h.document.querySelectorAll('.catalog-row')].filter(x=>!x.hidden).length,visible,q);
 assert.ok(h.document.getElementById('productSearchStatus').textContent);
 }
 }finally{h.cleanup();}
});
