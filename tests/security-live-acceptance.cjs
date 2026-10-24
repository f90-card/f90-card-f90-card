// Explicit operator-run acceptance only. Credentials live outside the repository.
// Creates no orders, deposits, supplier requests or financial adjustments.
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{createClient}=require('@supabase/supabase-js');
const path=process.env.F90_SECURITY_FIXTURES;if(!path)throw Error('F90_SECURITY_FIXTURES is required');
const state=JSON.parse(fs.readFileSync(path));const results=[];
function totp(secret){let bits='';for(const c of secret.toUpperCase().replace(/=+$/,''))bits+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5,'0');const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=crypto.createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),o=h[19]&15;return String((h.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,'0');}
const save=()=>fs.writeFileSync(path,JSON.stringify(state),{mode:0o600});
async function call(role,action,args={},token){const r=await fetch(state.url+'/functions/v1/f90-platform',{method:'POST',headers:{'Content-Type':'application/json',apikey:state.publicKey,...(role?{Authorization:'Bearer '+(token||state.users[role].session.access_token)}:{})},body:JSON.stringify({action,...args}),signal:AbortSignal.timeout(25000)});return {status:r.status,body:await r.json()};}
async function keyCall(action,args={}){const r=await fetch(state.url+'/functions/v1/f90-platform',{method:'POST',headers:{'Content-Type':'application/json','x-f90-key':state.key},body:JSON.stringify({action,...args}),signal:AbortSignal.timeout(25000)});return {status:r.status,body:await r.json()};}
async function check(name,fn){await fn();results.push({name,passed:true});console.log('PASS '+name);}
(async()=>{
 const phase=process.env.F90_SECURITY_PHASE||'backend';
 if(phase==='backend'){
  for(const role of ['customer','trader','admin'])await check(role+' cannot read sessions',async()=>assert.equal((await call(role,'staff.security.sessions')).status,403));
  await check('unauthenticated cannot read sessions',async()=>assert.equal((await call(null,'staff.security.sessions')).status,401));
  await check('merchant API key cannot read security records',async()=>assert.equal((await keyCall('staff.security.sessions')).status,403));
  await check('manager AAL1 requires MFA',async()=>assert.equal((await call('manager','staff.security.sessions')).body.error.code,'F90_MFA'));
  const u=state.users.manager,c=createClient(state.url,state.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  await c.auth.setSession({access_token:u.session.access_token,refresh_token:u.session.refresh_token});
  let factor=u.factor;
  if(!factor){const r=await c.auth.mfa.enroll({factorType:'totp',friendlyName:'Isolated acceptance'});assert.ifError(r.error);factor=r.data;u.factor=factor;save();}
  const verified=await c.auth.mfa.challengeAndVerify({factorId:factor.id,code:totp(factor.totp.secret)});assert.ifError(verified.error);u.session=verified.data;save();
  await check('manager MFA reads sessions',async()=>{const r=await call('manager','staff.security.sessions',{user_id:state.users.customer.id});assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(r.body.data.items.length>=1);});
  await check('customer cannot cancel another session',async()=>assert.equal((await call('customer','staff.security.revoke',{user_id:u.id,confirm_user_id:u.id,all:true,reason:'isolated test request'})).status,403));
  const sid=JSON.parse(Buffer.from(u.session.access_token.split('.')[1],'base64url')).session_id;
  await check('current manager session is protected',async()=>{const r=await call('manager','staff.security.revoke',{user_id:u.id,confirm_user_id:u.id,session_id:sid,reason:'isolated test current session'});assert.equal(r.status,409);assert.equal(r.body.error.code,'F90_CURRENT_SESSION');});
  const other=createClient(state.url,state.publicKey,{auth:{persistSession:false,autoRefreshToken:false}}),customer=state.users.customer;
  const login=await other.auth.signInWithPassword({email:customer.email,password:customer.password});assert.ifError(login.error);customer.sessions.push(login.data.session);save();
  const old=customer.session,csid=JSON.parse(Buffer.from(old.access_token.split('.')[1],'base64url')).session_id;
  await check('one auth session is actually revoked',async()=>{const r=await call('manager','staff.security.revoke',{user_id:customer.id,confirm_user_id:customer.id,session_id:csid,reason:'isolated test revoke one session'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.data.revoked,1);});
  await check('unexpired revoked JWT cannot read account',async()=>assert.equal((await call('customer','me',{},old.access_token)).status,401));
  await check('revoked refresh token is unusable',async()=>{const r=await other.auth.refreshSession({refresh_token:old.refresh_token});assert.ok(r.error);});
  customer.session=login.data.session;save();
  await check('other customer session remains valid',async()=>assert.equal((await call('customer','me')).status,200));
  await check('mandatory verification reason enforced',async()=>assert.equal((await call('manager','staff.revoke_verification',{id:state.users.trader.id,reason:''})).status,400));
  await check('verification revoked with audit',async()=>{const r=await call('manager','staff.revoke_verification',{id:state.users.trader.id,reason:'isolated acceptance verification review'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.data.is_verified,false);});
  await check('unverified trader key immediately loses access',async()=>assert.equal((await keyCall('balance')).status,403));
  await check('verification can be reapproved after review',async()=>{const r=await call('manager','staff.manual_verify',{id:state.users.trader.id,reason:'isolated acceptance renewed review'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.data.is_verified,true);});
  await check('reapproved merchant key can read balance',async()=>{const r=await keyCall('balance');assert.equal(r.status,200,JSON.stringify(r.body));});
  await check('manager reads security alerts',async()=>assert.equal((await call('manager','staff.security.alerts')).status,200));
 } else if(phase==='logout-all'){
  const customer=state.users.customer,old=customer.session;
  await check('all account sessions revoked',async()=>{const r=await call('manager','staff.security.revoke',{user_id:customer.id,confirm_user_id:customer.id,all:true,reason:'isolated acceptance logout all devices'});assert.equal(r.status,200);assert.ok(r.body.data.revoked>=1);});
  await check('logout all rejects remaining access JWT',async()=>assert.equal((await call('customer','me',{},old.access_token)).status,401));
  await check('manager still authenticated after target logout',async()=>assert.equal((await call('manager','staff.security.sessions',{user_id:customer.id})).status,200));
 }
 save();fs.writeFileSync('/tmp/f90-security-'+phase+'-results.json',JSON.stringify({results},null,2));console.log(JSON.stringify({phase,passed:results.length}));process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1)});
