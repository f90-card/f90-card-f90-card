'use strict';
// Run explicitly with disposable fixtures only; never place credentials in this file.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const path=process.env.F90_SECURITY_FIXTURES;if(!path)throw Error('F90_SECURITY_FIXTURES required');const x=JSON.parse(fs.readFileSync(path)),results=[];
const save=()=>fs.writeFileSync(path,JSON.stringify(x),{mode:0o600});
async function post(url,body,headers={}){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={error:'NON_JSON_RESPONSE'}}return {status:r.status,headers:r.headers,body:data};}
const auth=role=>({Authorization:'Bearer '+x.users[role].session.access_token,apikey:x.publicKey});
const activity=(role,body,headers={})=>post('https://www.f90card.online/api/security-activity',body,{...(role?auth(role):{}),...headers});
const api=(role,action,args={},headers={})=>post(x.url+'/functions/v1/f90-platform',{action,...args},{...(role?auth(role):{}),...headers});
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(e){results.push({name,passed:false,error:e.message.slice(0,200)});console.log('FAIL '+name+': '+e.message.slice(0,200));}}
(async()=>{
 const customer=x.users.customer;
 await check('official unauthenticated security request rejected',async()=>assert.equal((await activity(null,{action:'mine'})).status,401));
 await check('merchant key cannot access security function',async()=>assert.equal((await activity(null,{action:'manager_list'},{'x-f90-key':x.key})).status,401));
 await check('official login issues a valid session',async()=>{const r=await post('https://www.f90card.online/api/auth-login',{email:customer.email,password:customer.password});assert.equal(r.status,200,JSON.stringify({status:r.status,error:r.body.error}));assert.ok(r.body.access_token);customer.session=r.body;customer.sessions.push(r.body);save();assert.match(r.headers.get('cache-control'),/no-store/);});
 await check('gateway rejects IP and country spoofing',async()=>{const r=await activity('customer',{action:'record',ip:'8.8.8.8',country:'ZZ',device_label:'isolated acceptance device'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.source,'cloudflare_signed_v1');});
 await check('own records isolated with trusted metadata',async()=>{const r=await activity('customer',{action:'mine',user_id:x.users.manager.id});assert.equal(r.status,200);assert.ok(r.body.items.length);assert.ok(r.body.items.every(s=>s.user_id===customer.id));const s=r.body.items.find(s=>s.source==='cloudflare_signed_v1');assert.ok(s&&s.ip&&s.ip!=='8.8.8.8'&&s.ip!=='1.1.1.1');assert.notEqual(s.country,'ZZ');x.observation={trusted_source:s.source,country_available:!!s.country,city_available:!!s.city,network_available:!!s.network};save();});
 await check('unsigned direct record rejected',async()=>assert.equal((await post(x.url+'/functions/v1/f90-security-activity',{action:'record'},auth('customer'))).status,403));
 for(const role of ['customer','trader','admin'])await check(role+' denied official manager listing',async()=>assert.equal((await activity(role,{action:'manager_list'})).status,403));
 await check('MFA manager reads official customer-security data',async()=>assert.equal((await activity('manager',{action:'manager_list'})).status,200));
 await check('explicit synthetic location keeps accuracy and timestamp',async()=>{const loc={latitude:31.9,longitude:35.2,accuracy:20,timestamp:Date.now()};assert.equal((await activity('customer',{action:'record',location_consent:true,location:loc})).status,200);const r=await activity('customer',{action:'mine'}),s=r.body.items.find(s=>s.location);assert.ok(s);assert.equal(s.location.latitude,loc.latitude);assert.equal(s.location.accuracy,20);});
 await check('clear consent erases all own precise locations',async()=>{assert.equal((await activity('customer',{action:'record',clear_location:true})).status,200);const r=await activity('customer',{action:'mine'});assert.ok(r.body.items.every(s=>s.location===null));});
 await check('customer cannot directly query security table',async()=>{const r=await fetch(x.url+'/rest/v1/f90_security_sessions?select=user_id',{headers:auth('customer')});assert.equal(r.status,403);});
 await check('repeated failed official logins rejected',async()=>{for(let i=0;i<5;i++){const r=await post('https://www.f90card.online/api/auth-login',{email:customer.email,password:'invalid-fixture-password'});assert.ok([400,401,422].includes(r.status),JSON.stringify({status:r.status,error:r.body.error}));}});
 x.invalidKey='f90_live_'+crypto.randomBytes(32).toString('hex');save();
 await check('repeated invalid merchant keys rejected',async()=>{for(let i=0;i<5;i++)assert.equal((await api(null,'balance',{}, {'x-f90-key':x.invalidKey})).status,401);});
 await check('repeated unauthorized administrative access rejected',async()=>{for(let i=0;i<3;i++)assert.equal((await api('customer','staff.security.alerts')).status,403);});
 await check('alerts record auth failures, invalid keys and admin denials',async()=>{const r=await api('manager','staff.security.alerts');assert.equal(r.status,200);for(const kind of ['login_failed','api_key_invalid','admin_denied'])assert.ok(r.body.data.items.some(s=>s.kind===kind&&s.occurrences>=(kind==='admin_denied'?3:5)),kind);});
 await check('alert review reason is saved',async()=>{const r=await api('manager','staff.security.alerts'),s=r.body.data.items.find(s=>s.user_id===customer.id&&!s.acknowledged_at);assert.ok(s);const a=await api('manager','staff.security.acknowledge',{id:s.id,reason:'isolated acceptance alert review'});assert.equal(a.status,200);assert.equal(a.body.data.saved,true);});
 await check('MFA manager reads audit including review',async()=>{const r=await api('manager','staff.list',{kind:'audit',offset:0});assert.equal(r.status,200);assert.ok(r.body.data.items.some(s=>s.action==='security.alert.acknowledged'));});
 await check('public catalog still available',async()=>assert.equal((await api(null,'catalog')).status,200));
 await check('official merchant balance still available',async()=>assert.equal((await post('https://www.f90card.online/api/v1',{action:'balance'},{'x-f90-key':x.key})).status,200));
 const report={results,observation:x.observation};save();fs.writeFileSync('/tmp/f90-security-official-results.json',JSON.stringify(report,null,2));const failed=results.filter(x=>!x.passed).length;console.log(JSON.stringify({passed:results.length-failed,failed,observation:x.observation}));process.exit(failed?1:0);
})().catch(e=>{console.error(e.message);process.exit(1)});
