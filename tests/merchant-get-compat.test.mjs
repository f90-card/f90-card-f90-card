import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../functions/api/compat.js',import.meta.url),'utf8');
const {onRequestGetCompat:compat}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const token='f90_live_'+'a'.repeat(64);
const invoke=(path,query='',headers={'api-token':token})=>compat({request:new Request('https://www.f90card.online/client/api/'+path+query,{headers})},path);
test('GET compatibility blocks purchases, URL secrets and missing or conflicting keys without forwarding',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>assert.fail('must not forward');
  try{
    assert.equal((await invoke('newOrder')).status,405);
    assert.equal((await invoke('profile','?api-token=fixture')).status,400);
    assert.equal((await invoke('profile','',{})).status,401);
    assert.equal((await invoke('profile','',{'api-token':token,'x-f90-key':'f90_live_'+'b'.repeat(64)})).status,400);
  }finally{globalThis.fetch=original;}
});
test('GET products translates to authenticated read-only upstream POST and preserves category names',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-platform');
    assert.equal(options.headers['x-f90-key'],token);assert.equal(options.redirect,'manual');
    const body=JSON.parse(options.body);calls.push(body.action);
    return new Response(JSON.stringify({data:body.action==='services'?[{service:'stable',category:'cat',image_url:'https://example.invalid/original.png'}]:[{id:'cat',name:'قسم أصلي'}]}));
  };
  try{
    const response=await invoke('products');assert.equal(response.status,200);
    assert.deepEqual(calls.sort(),['categories','services']);
    assert.equal((await response.json()).data.products[0].category_name,'قسم أصلي');
    assert.match(response.headers.get('cache-control'),/no-store/);
  }finally{globalThis.fetch=original;}
});
test('GET profile and check preserve documented envelopes and status ownership errors',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);
    if(body.action==='balance')return new Response(JSON.stringify({data:{balance:0,currency:'USD'}}));
    assert.equal(body.action,'status');return new Response(JSON.stringify({error:{code:'F90_NOT_FOUND'}}),{status:404});
  };
  try{
    assert.deepEqual((await (await invoke('profile')).json()).data,{balance:0,currency:'USD'});
    const r=await invoke('check','?orders='+encodeURIComponent(JSON.stringify(['8acd6eb1-a453-4dbd-8a73-acf9b190fa2a'])));
    assert.equal(r.status,404);assert.equal((await r.json()).error.code,'F90_NOT_FOUND');
  }finally{globalThis.fetch=original;}
});
