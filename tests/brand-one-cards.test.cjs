const test=require('node:test'),assert=require('node:assert/strict');
const cards=require('../f90-brand-one-cards.js');
test('supplier portrait images retain their actual aspect ratio and have no extra F90 frame',()=>{
 const item={name:'Jawaker',commerce:{supplier_card:{image:{width:588,height:1000}}}};
 const html=cards.render(item,'product',{href:'#/product/7',image:'<img src="original.png">'});
 assert.match(html,/--bc-ratio:0.588/);assert.match(html,/original.png/);
 assert.doesNotMatch(html,/f90-flip|f90-product-tile/);
});
test('supplier circle size, image fit and image percentage are preserved',()=>{
 const item={commerce:{supplier_card:{image_tile:{all:{shape:'circle',widthCm:2.5,heightCm:2.5,imagePct:90,fit:'contain'}}}}};
 assert.match(cards.style(item,'product'),/--bc-radius:50%/);
 assert.match(cards.style(item,'product'),/--bc-width:2.5cm/);
 assert.match(cards.style(item,'product'),/--bc-image-pct:90%/);
});
test('supplier category remains browsable while unavailable products cannot start checkout',()=>{
 const item={name:'قسم',presentation:{},commerce:{}};
 assert.match(cards.render(item,'category',{disabled:true,href:'#/category/games',image:''}),/href=/);
 assert.doesNotMatch(cards.render(item,'product',{disabled:true,href:'#/product/7',image:''}),/href=/);
});
test('supplier grid settings are bounded and unrelated catalog items retain their own layout',()=>{
 assert.equal(cards.isCategory({slug:'games'}),false);assert.equal(cards.isProduct({commerce:{}}),false);
 assert.match(cards.gridStyle({presentation:{supplier_card:{display:{webMobile:{contents:{columns:2}}}}}}),/--bc-phone-cols:2/);
 const html=cards.render({name:'<script>x</script>',commerce:{}},'product',{href:'#/x',image:''});
 assert.doesNotMatch(html,/<script>/);
});

const {fixture,harness}=require('./dom-harness.cjs');
test('application uses supplier grid and does not invent an account field for key delivery',async()=>{
 const catalog=fixture();catalog.categories[1].slug='f90-brand-one-cat-18';catalog.categories[1].presentation={supplier_card:{image:{width:588,height:1000}}};
 Object.assign(catalog.products[0].commerce,{supplier_catalog:'brand_one',supplier_card:{image:{width:588,height:1000}},fields:[]});
 const h=await harness('index.html',{hash:'#/category/f90-brand-one-cat-18',catalog});
 assert.ok(h.document.querySelector('.f90-brand-grid'));assert.ok(h.document.querySelector('.f90-brand-card'));h.cleanup();
 const checkout=await harness('index.html',{hash:'#/product/coins',catalog});
 assert.ok(checkout.document.getElementById('checkoutForm'));
 assert.equal(checkout.document.querySelector('[name="customer_account_id"]'),null);checkout.cleanup();
});
