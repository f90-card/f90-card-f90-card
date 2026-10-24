import test from 'node:test';import assert from 'node:assert/strict';
import {onRequest as activity} from '../functions/api/security-activity.js';
import {onRequest as login} from '../functions/api/auth-login.js';
import {verifyContext,readBoundedBody} from '../supabase/functions/f90-security-activity/network-context.mjs';
const secret='fixture-gateway-context-secret-32-bytes',authorization='Bearer fixture-authentication-token';
function request(path,body,headers={}){const r=new Request('https://www.f90card.online/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','cf-connecting-ip':'8.8.8.8',...headers},body:JSON.stringify(body)});Object.defineProperty(r,'cf',{value:{country:'PS',city:'Ramallah',asn:123,asOrganization:'fixture'}});return r;}
test('gateway enforces method, authorization, origin, bounded streaming body and ready secret',async()=>{
 assert.equal((await activity({request:new Request('https://www.f90card.online/api/security-activity'),env:{}})).status,405);
 assert.equal((await activity({request:request('security-activity',{action:'mine'}),env:{}})).status,401);
 assert.equal((await activity({request:request('security-activity',{action:'mine'},{authorization,origin:'https://evil.invalid'}),env:{}})).status,403);
 assert.equal((await activity({request:request('security-activity',{action:'record'},{authorization}),env:{}})).status,503);
 assert.equal((await activity({request:request('security-activity',{action:'record',junk:'x'.repeat(9000)},{authorization}),env:{}})).status,413);
 await assert.rejects(readBoundedBody(new Request('https://example.invalid',{method:'POST',body:'x'.repeat(30)}),10),/PAYLOAD_TOO_LARGE/);
});
test('first-party gateway signs actual Cloudflare context and strips forged context headers',async()=>{
 const old=globalThis.fetch;let upstream;
 try{globalThis.fetch=async(url,opts)=>{upstream={url,opts};return new Response('{"saved":true}',{status:200});};
 const r=await activity({request:request('security-activity',{action:'record',ip:'1.1.1.1'},{authorization,'x-f90-activity-context':'forged','cf-ipcountry':'ZZ'}),env:{F90_ACTIVITY_GATEWAY_SECRET:secret}});
 assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.match(upstream.url,/ogkipkavlywgwhtomoca/);
 const c=await verifyContext(upstream.opts.headers['x-f90-activity-context'],upstream.opts.headers['x-f90-activity-signature'],authorization,upstream.opts.body,secret);assert.equal(c.ip,'8.8.8.8');assert.equal(c.country,'PS');assert.equal(c.city,'Ramallah');
 }finally{globalThis.fetch=old;}
});
test('gateway never follows redirects or forwards arbitrary upstream headers',async()=>{const old=globalThis.fetch;try{globalThis.fetch=async()=>new Response(null,{status:302,headers:{location:'https://evil.invalid'}});assert.equal((await activity({request:request('security-activity',{action:'mine'},{authorization}),env:{}})).status,502);}finally{globalThis.fetch=old;}});
test('login gateway validates payload and rejects cross-origin or privileged keys',async()=>{
 assert.equal((await login({request:request('auth-login',null,{apikey:'sb_publishable_fixture12345'}),env:{}})).status,400);
 assert.equal((await login({request:request('auth-login',{email:'x',password:'x'},{apikey:'service_role'}),env:{}})).status,400);
 assert.equal((await login({request:request('auth-login',{email:'x',password:'x'},{origin:'https://evil.invalid'}),env:{}})).status,403);
});
test('failed login evidence is signed, contains no raw email/password and no response credentials are cached',async()=>{const old=globalThis.fetch;const sent=[],pending=[];try{globalThis.fetch=async(url,opts)=>{sent.push({url,opts});return new Response('{}',{status:sent.length===1?400:200});};const r=await login({request:request('auth-login',{email:'fixture@example.invalid',password:'fixture-secret'},{apikey:'sb_publishable_fixture12345'}),env:{F90_ACTIVITY_GATEWAY_SECRET:secret},waitUntil:p=>pending.push(p)});await Promise.all(pending);assert.equal(r.status,400);assert.equal(sent.length,2);const evidence=sent[1];assert.ok(!evidence.opts.body.includes('fixture@example.invalid'));assert.ok(!evidence.opts.body.includes('fixture-secret'));assert.equal(JSON.parse(evidence.opts.body).action,'login_failure');await verifyContext(evidence.opts.headers['x-f90-activity-context'],evidence.opts.headers['x-f90-activity-signature'],'',evidence.opts.body,secret);assert.match(r.headers.get('cache-control'),/no-store/);}finally{globalThis.fetch=old;}});
test('successful login preserves auth response without emitting failed-login evidence',async()=>{const old=globalThis.fetch;let n=0;try{globalThis.fetch=async()=>{n++;return new Response('{"access_token":"fixture-token"}',{status:200});};const r=await login({request:request('auth-login',{email:'fixture@example.invalid',password:'fixture-secret'},{apikey:'sb_publishable_fixture12345'}),env:{},waitUntil:()=>assert.fail('unexpected failure event')});assert.equal(n,1);assert.equal((await r.json()).access_token,'fixture-token');}finally{globalThis.fetch=old;}});
