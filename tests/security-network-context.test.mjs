import test from 'node:test';import assert from 'node:assert/strict';
import {signContext,verifyContext,publicIP,classify} from '../supabase/functions/f90-security-activity/network-context.mjs';
const secret='fixture-context-signing-key-never-production';const auth='Bearer fixture-valid-session';const body='{"action":"record"}';
const req=()=>{const r=new Request('https://www.f90card.online/api/security-activity',{headers:{authorization:auth,'cf-connecting-ip':'8.8.8.8','cf-ipcountry':'ZZ','user-agent':'Mozilla Android 13 Chrome/120','sec-ch-ua-mobile':'?1'}});Object.defineProperty(r,'cf',{value:{country:'PS',city:'Ramallah',region:'West Bank',asn:1234,asOrganization:'Fixture network',latitude:'31.899',longitude:'35.203'}});return r;};
test('signed context uses Cloudflare metadata, bounds coarse coordinates and binds token/body/time',async()=>{
 const signed=await signContext(req(),body,secret,100000);
 const c=await verifyContext(signed.payload,signed.signature,auth,body,secret,100001);
 assert.equal(c.country,'PS');assert.equal(c.city,'Ramallah');assert.equal(c.ip,'8.8.8.8');assert.equal(c.latitude,31.9);assert.equal(c.longitude,35.2);
 for(const [a,b,k,now] of [[auth+'x',body,secret,100001],[auth,body+' ',secret,100001],[auth,body,secret+'x',100001],[auth,body,secret,200001]])
  await assert.rejects(verifyContext(signed.payload,signed.signature,a,b,k,now));
 await assert.rejects(verifyContext(signed.payload,signed.signature.replace(/^./,signed.signature[0]==='0'?'1':'0'),auth,body,secret,100001));
});
test('missing/untrusted network signature is never accepted',async()=>{
 await assert.rejects(verifyContext('','',auth,body,secret));
 for(const value of ['127.0.0.1','10.0.0.1','192.168.1.1','::1','fc00::1','bad','999.1.1.1'])assert.equal(publicIP(value),null);
 assert.equal(publicIP('2001:4860:4860::8888'),'2001:4860:4860::8888');
});
test('Android without mobile evidence is not falsely identified as a tablet',()=>{
 assert.equal(classify('Android Chrome/120').device_type,'unknown');
 assert.equal(classify('Android Chrome/120','?1').device_type,'phone');
 assert.equal(classify('Android SM-T500 Chrome/120').device_type,'tablet');
 assert.equal(classify('iPhone Mobile Safari/17').os_name,'iOS');
});
