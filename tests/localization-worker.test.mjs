import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {onRequest} from '../functions/api/i18n/process.js';
import worker,{prepare,validate} from '../cloudflare/i18n/worker.mjs';
globalThis.crypto??=webcrypto;
test('private translation worker validates numeric placeholders, uniqueness and provider output',()=>{
 const p=prepare([{source_text:'شحن ببجي 1000 عبر API {{v0}}'}]);
 const text=p[0].keep.map((_,i)=>'__KEEP_'+i+'__').join(' '),r={id:0,en:text,fr:text,pt:text};
 assert.ok(validate(p,{rows:[r]})[0].fr.includes('1000'));
 assert.equal(validate(p,{rows:[r,r]})[0].error,'INVALID_TRANSLATION');
 assert.equal(validate(p,{rows:[{...r,pt:'omitted'}]})[0].error,'INVALID_TRANSLATION');
});
test('scheduler endpoint rejects anonymous, expired, oversized requests without inference',async()=>{
 const env={F90_ACTIVITY_GATEWAY_SECRET:'isolated-test-key',F90_I18N_AI:{fetch:()=>{throw Error('Inference forbidden');}}};
 assert.equal((await onRequest({env,request:new Request('https://example.invalid/api/i18n/process')})).status,405);
 assert.equal((await onRequest({env,request:new Request('https://example.invalid/api/i18n/process',{method:'POST',body:JSON.stringify({timestamp:1,signature:'0'.repeat(64)})})})).status,403);
 assert.equal((await onRequest({env,request:new Request('https://example.invalid/api/i18n/process',{method:'POST',body:'x'.repeat(3000)})})).status,413);
});
test('valid signed scheduler checks the bounded queue; an empty queue performs no inference',async()=>{
 const secret='isolated-test-key',timestamp=Math.floor(Date.now()/1000),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('f90-i18n-tick:'+timestamp)))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;const payload=JSON.parse(options.body);assert.equal(payload.action,'i18n.worker.claim');assert.match(payload.signature,/^[a-f0-9]{64}$/);assert.equal(payload.secret,undefined);return Response.json({data:{rows:[],quota_exhausted:true}});};
 try{const response=await onRequest({env:{F90_ACTIVITY_GATEWAY_SECRET:secret,F90_I18N_AI:{fetch:()=>{throw Error('No inference for empty queue');}}},request:new Request('https://example.invalid/api/i18n/process',{method:'POST',body:JSON.stringify({timestamp,signature})})});assert.equal(response.status,200);assert.deepEqual(await response.json(),{processed:0,quota_exhausted:true,disabled:false});assert.equal(calls,1);}finally{globalThis.fetch=originalFetch;}
});
test('private AI service rejects unsupported methods before reading source data',async()=>{
 const r=await worker.fetch(new Request('https://internal/translate'),{});assert.equal(r.status,405);
});
