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

test('search within a category hides products and clears the empty state',async()=>{
 const catalog=fixture();catalog.products.push({...catalog.products[0],id:'second',slug:'second',name:'منتج مختلف'});
 const h=await harness('index.html',{hash:'#/category/pubg',catalog});
 try{const input=h.document.getElementById('categoryFilter');assert.ok(input);assert.equal(h.document.querySelectorAll('.image-grid .f90-product-tile').length,2);
 for(const [q,count] of [['كوينز',1],['منتج',1],['لايوجد',0],['',2]]){input.value=q;input.dispatchEvent(new h.window.Event('input',{bubbles:true}));await h.settle();assert.equal([...h.document.querySelectorAll('.image-grid .f90-product-tile')].filter(x=>!x.hidden).length,count);assert.equal(h.document.getElementById('categoryNoResults').hidden,count>0||!q);}
 }finally{h.cleanup();}
});

test('decorative frame styles preserve the hidden state of filtered product and category cards',()=>{const css=require('node:fs').readFileSync('f90-global-frame.css','utf8');assert.match(css,/:root\.f90-global-frame-on #mainContent \.image-grid :is\(\.image-tile\.f90-category-tile,\.image-tile\.f90-product-tile\)\[hidden\]\{display:none!important\}/);});

test('category search discovers matching products inside its own subcategories without searching other sections',async()=>{
 const catalog=fixture();catalog.categories.push({id:'other',name:'آخر',slug:'other',is_active:true,parent_id:null,presentation:{}});catalog.products.push({...catalog.products[0],id:'outside',slug:'outside',category_id:'other'});
 const h=await harness('index.html',{hash:'#/category/games',catalog});
 try{const input=h.document.getElementById('categoryFilter');input.value='كوينز';input.dispatchEvent(new h.window.Event('input',{bubbles:true}));await h.settle();
 const host=h.document.getElementById('categorySearchResults');assert.equal(host.hidden,false);assert.equal(host.querySelectorAll('.f90-product-tile').length,1);assert.ok(host.querySelector('[href="#/product/coins"]'));assert.equal(host.querySelector('[href="#/product/outside"]'),null);
 input.value='';input.dispatchEvent(new h.window.Event('input',{bubbles:true}));await h.settle();assert.equal(host.hidden,true);assert.equal(host.querySelectorAll('.f90-product-tile').length,0);
 }finally{h.cleanup();}
});
