import test from 'node:test';
import assert from 'node:assert/strict';
import {callProvider, normalizeService, f90SelfEndpoint} from '../supabase/functions/f90-platform/provider.mjs';
const provider = {endpoint:'https://merchant.example.invalid/api/v1', adapter:'f90_merchant'};
const product = {service:'8acd6eb1-a453-4dbd-8a73-acf9b190fa2a',name:'خدمة أصلية',category:'cat',rate:2,
  unit_quantity:1000,min:100,max:50000,type:'quantity',quantity_step:100,availability:'available',
  image_url:'https://media.example.invalid/original.png',fields:[{id:'player',label_ar:'معرف اللاعب',type:'text',required:true}]};
const ok = data => new Response(JSON.stringify({data}));
test('F90 catalog uses x-f90-key JSON and preserves original fields, category, image and unit',async()=>{
  const calls=[];
  const rows=await callProvider(provider,'fixture-key','services',{},async(url,init)=>{
    calls.push(JSON.parse(init.body));
    assert.equal(init.headers['x-f90-key'],'fixture-key');
    assert.equal(init.headers.Authorization,undefined);
    assert.equal(init.redirect,'manual');
    assert.ok(!url.href.includes('fixture-key'));
    return ok(calls.at(-1).action==='categories'?[{id:'cat',name:'شحن التطبيقات'}]:[product]);
  });
  assert.deepEqual(calls.map(x=>x.action).sort(),['categories','services']);
  const service=normalizeService(rows[0]);
  assert.equal(service.id,product.service);assert.equal(service.category,'شحن التطبيقات');
  assert.equal(service.unit_quantity,1000);assert.equal(service.quantity_step,100);
  assert.equal(service.image_url,product.image_url);assert.deepEqual(service.fields,product.fields);
});
test('F90 balance and status unwrap the documented data envelope',async()=>{
  assert.deepEqual(await callProvider(provider,'fixture','balance',{},async()=>ok({balance:0,currency:'USD'})),{balance:0,currency:'USD'});
  const status=await callProvider(provider,'fixture','status',{order:'order-id'},async(u,i)=>{
    assert.deepEqual(JSON.parse(i.body),{action:'status',order:'order-id'});return ok({order:{id:'order-id',status:'completed'},events:[],requests:[]});
  });assert.equal(status.status,'completed');
});
test('F90 GET uses api-token header and original products/profile/check paths',async()=>{
  const p={...provider,config:{f90_transport:'get'}};
  const mock=async(url,init)=>{
    assert.equal(init.method,'GET');assert.equal(init.headers['api-token'],'fixture');
    assert.equal(init.body,undefined);assert.equal(init.redirect,'manual');
    assert.ok(!url.href.includes('fixture'));
    if(url.pathname==='/client/api/products')return ok({products:[product]});
    if(url.pathname==='/client/api/profile')return ok({balance:0,currency:'USD'});
    assert.equal(url.pathname,'/client/api/check');
    assert.deepEqual(JSON.parse(url.searchParams.get('orders')),['order-id']);
    return ok([{order_id:'order-id',status:'completed'}]);
  };
  assert.equal((await callProvider(p,'fixture','services',{},mock))[0].service,product.service);
  assert.equal((await callProvider(p,'fixture','balance',{},mock)).currency,'USD');
  assert.equal((await callProvider(p,'fixture','status',{order:'order-id'},mock)).status,'completed');
});
const args={service:product.service,quantity:1000,fields:{player:'42'},client_reference:'2ed480dc-198d-4ac1-8d8a-fa81f4df2179',expected_total_usd:2};
test('F90 checkout preserves stable reference, exact fields and expected supplier cost on retry',async()=>{
  const requests=[];
  const fetcher=async(u,i)=>{requests.push(JSON.parse(i.body));return ok({id:'upstream-order',status:'pending'});};
  for(let n=0;n<2;n++)assert.equal((await callProvider(provider,'fixture','add',args,fetcher)).order_id,'upstream-order');
  assert.deepEqual(requests[0],requests[1]);
  assert.deepEqual(requests[0],{action:'checkout',product_id:product.service,quantity:1000,fields:{player:'42'},
    idempotency_key:args.client_reference,expected_total_usd:2});
});
test('F90 self connection permits reads and blocks purchases before any HTTP call',async()=>{
  for(const endpoint of ['https://www.f90card.online/api/v1','https://f90card.online/api/merchant',
    'https://preview.f90-card-acceptance.pages.dev/api/v1','https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-platform']){
    assert.equal(f90SelfEndpoint(endpoint),true);
    await assert.rejects(callProvider({...provider,endpoint},'fixture','add',args,async()=>{assert.fail('must not send');}),/بنفسه/);
  }
  assert.deepEqual(await callProvider({...provider,endpoint:'https://www.f90card.online/api/v1'},'fixture','balance',{},async()=>ok({balance:0})),{balance:0});
});
test('F90 checkout transport, redirects and malformed responses stay uncertain',async()=>{
  for(const fetcher of [async()=>{throw Error('network')},async()=>new Response('moved',{status:302}),async()=>new Response('bad'),async()=>ok({})]){
    await assert.rejects(callProvider(provider,'fixture','add',args,fetcher),e=>e.uncertain===true);
  }
});
test('F90 explicit errors are Arabic, do not echo upstream secrets and preserve rejection certainty',async()=>{
  for(const [status,code] of [[401,'F90_AUTH'],[403,'F90_FORBIDDEN'],[402,'F90_INSUFFICIENT_BALANCE'],[409,'F90_PRICE_CHANGED']]){
    await assert.rejects(callProvider(provider,'fixture','add',args,async()=>new Response(JSON.stringify({error:{code,message:'fixture-secret'}}),{status})),e=>!e.uncertain&&!e.message.includes('fixture-secret')&&/[\u0600-\u06ff]/.test(e.message));
  }
});
test('F90 denies invalid checkout cost, missing reference, query credentials, private DNS and unsupported operations',async()=>{
  const never=async()=>assert.fail('must not fetch');
  for(const bad of [{...args,expected_total_usd:0},{...args,client_reference:''},{...args,fields:null}])
    await assert.rejects(callProvider(provider,'fixture','add',bad,never));
  await assert.rejects(callProvider({...provider,endpoint:provider.endpoint+'?key=secret'},'fixture','balance',{},never));
  await assert.rejects(callProvider(provider,'fixture','services',{},never,async()=>['127.0.0.1']));
  await assert.rejects(callProvider(provider,'fixture','delete',{},never));
});
