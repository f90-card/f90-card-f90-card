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
test('login gateway validates payload, origin and server secret',async()=>{
 assert.equal((await login({request:request('auth-login',null),env:{}})).status,400);
 assert.equal((await login({request:request('auth-login',{email:'x',password:'x'},{origin:'https://evil.invalid'}),env:{}})).status,403);
 assert.equal((await login({request:request('auth-login',{email:'x',password:'x'}),env:{}})).status,503);
});
test('login gateway uses signed same-project backend and strips caller authorization',async()=>{const old=globalThis.fetch;let sent;try{globalThis.fetch=async(url,opts)=>{sent={url,opts};return new Response('{"access_token":"fixture-token"}',{status:200});};const r=await login({request:request('auth-login',{email:'fixture@example.invalid',password:'fixture-secret'},{authorization:'Bearer malicious-caller'}),env:{F90_ACTIVITY_GATEWAY_SECRET:secret}});assert.equal(r.status,200);assert.match(sent.url,/ogkipkavlywgwhtomoca.*f90-security-activity/);assert.equal(sent.opts.headers.Authorization,undefined);await verifyContext(sent.opts.headers['x-f90-activity-context'],sent.opts.headers['x-f90-activity-signature'],'',sent.opts.body,secret);assert.equal(JSON.parse(sent.opts.body).action,'login');assert.match(r.headers.get('cache-control'),/no-store/);}finally{globalThis.fetch=old;}});
test('malformed upstream auth response becomes a sanitized server error',async()=>{const old=globalThis.fetch;try{globalThis.fetch=async()=>new Response('<html>gateway failure</html>',{status:502});const r=await login({request:request('auth-login',{email:'fixture@example.invalid',password:'fixture-secret'}),env:{F90_ACTIVITY_GATEWAY_SECRET:secret}});assert.equal(r.status,503);assert.equal((await r.json()).error,'AUTH_GATEWAY_RESPONSE');}finally{globalThis.fetch=old;}});

test('login signing works with immutable runtime Request cf metadata',async()=>{const OriginalRequest=globalThis.Request,oldFetch=globalThis.fetch;try{globalThis.Request=class extends OriginalRequest {constructor(...args){super(...args);Object.defineProperty(this,'cf',{value:{country:'PS'},configurable:false});}};const incoming=new OriginalRequest('https://www.f90card.online/api/auth-login',{method:'POST',headers:{'Content-Type':'application/json','cf-connecting-ip':'8.8.8.8'},body:JSON.stringify({email:'fixture@example.invalid',password:'fixture'})});Object.defineProperty(incoming,'cf',{value:{country:'PS'},configurable:false});globalThis.fetch=async()=>new Response('{"access_token":"fixture"}',{status:200});assert.equal((await login({request:incoming,env:{F90_ACTIVITY_GATEWAY_SECRET:secret}})).status,200);}finally{globalThis.Request=OriginalRequest;globalThis.fetch=oldFetch;}});

test('login uses Workers-supported manual redirect mode and refuses redirect destinations',async()=>{const old=globalThis.fetch;let calls=0;try{globalThis.fetch=async(url,opts)=>{calls++;if(opts.redirect!=='manual')throw new TypeError('Unsupported redirect mode');return new Response(null,{status:302,headers:{Location:'https://evil.invalid/'}});};const r=await login({request:request('auth-login',{email:'fixture@example.invalid',password:'fixture'}),env:{F90_ACTIVITY_GATEWAY_SECRET:secret}});assert.equal(r.status,503);assert.equal((await r.json()).error,'AUTH_GATEWAY_REDIRECT');assert.equal(calls,1);}finally{globalThis.fetch=old;}});
