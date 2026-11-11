const test=require('node:test'),assert=require('node:assert/strict');
const provider={adapter:'brand_one',endpoint:'https://api.brand-one-card.com'};
test('Brand One sends exact supplier fields by POST with a stable UUID and no order data in URL',async()=>{
 const {callProvider}=await import('../supabase/functions/f90-platform/provider.mjs');
 let calls=0;
 const result=await callProvider(provider,'fixture','add',{service:'7',quantity:10000,client_reference:'11111111-1111-4111-8111-111111111111',params:{playerId:'123'}},async(url,opt)=>{
  calls++;assert.equal(url.search,'');assert.equal(opt.method,'POST');assert.equal(opt.headers['api-token'],'fixture');assert.deepEqual(JSON.parse(opt.body),{qty:'10000',order_uuid:'11111111-1111-4111-8111-111111111111',playerId:'123'});
  return new Response(JSON.stringify({status:'OK',data:{order_id:'99',status:'wait'}}));
 });assert.equal(calls,1);assert.equal(result.order_id,'99');
});
test('Brand One IP refusal is an explicit rejection and never a successful service list',async()=>{
 const {callProvider}=await import('../supabase/functions/f90-platform/provider.mjs');
 await assert.rejects(callProvider(provider,'fixture','services',{},async()=>new Response(JSON.stringify({status:'ERROR',code:123,msg:'IP not allowed'}))));
});
test('Brand One scales unit prices and keeps package prices fixed',async()=>{
 const {callProvider,normalizeService}=await import('../supabase/functions/f90-platform/provider.mjs');
 const items=[{id:7,name:'Coins',price:.0001,product_type:'amount',qty_values:{min:10000,max:5000000},available:true},{id:8,name:'Pack',price:1.61,product_type:'package',qty_values:null,available:true}];
 const rows=await callProvider(provider,'fixture','services',{},async()=>new Response(JSON.stringify(items)));
 const a=normalizeService(rows[0]),b=normalizeService(rows[1]);assert.equal(a.unit_quantity,1000);assert.equal(a.rate,.1);assert.equal(a.min,10000);assert.equal(b.unit_quantity,1);assert.equal(b.max,1);assert.equal(b.rate,1.61);
});
