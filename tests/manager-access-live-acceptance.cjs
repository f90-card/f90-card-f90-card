// Explicit operator-run only, using disposable marked fixtures; never customer funds.
const fs=require('node:fs'),assert=require('node:assert/strict');
const path=process.env.F90_SECURITY_FIXTURES;if(!path)throw Error('F90_SECURITY_FIXTURES is required');
const fixtures=JSON.parse(fs.readFileSync(path));
const base='https://ogkipkavlywgwhtomoca.supabase.co',key='sb_publishable_hhEc0Rw4r_V-sLpC82KLdw_mcoWNSec';
const results=[];const sessions={};
async function request(path,body,token){const r=await fetch(base+path,{method:'POST',signal:AbortSignal.timeout(15000),headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
async function check(name,fn){await fn();results.push(name);console.log("PASS "+name);}
(async()=>{try{
for(const f of fixtures){const r=await request('/auth/v1/token?grant_type=password',{email:f.email,password:f.password});assert.equal(r.status,200,'fixture login');sessions[f.role]=r.body;}
const mgr=sessions.manager.access_token,claims=JSON.parse(Buffer.from(mgr.split('.')[1],'base64url'));assert.equal(claims.aal,'aal1');
await check('manager AAL1 summary is complete without MFA requirement',async()=>{const r=await request('/functions/v1/f90-platform',{action:'me'},mgr);assert.equal(r.status,200);assert.equal(r.body.data.role,'manager');assert.notEqual(r.body.data.needs_mfa,true);assert.ok(r.body.data.wallet);});
await check('manager AAL1 lists sessions',async()=>assert.equal((await request('/functions/v1/f90-platform',{action:'staff.security.sessions',user_id:fixtures.find(x=>x.role==='customer').id},mgr)).status,200));
await check('manager AAL1 lists customer security',async()=>assert.equal((await request('/functions/v1/f90-security-activity',{action:'manager_list'},mgr)).status,200));
await check('manager AAL1 lists alerts',async()=>assert.equal((await request('/functions/v1/f90-platform',{action:'staff.security.alerts'},mgr)).status,200));
for(const role of ['customer','trader','admin']){await check(role+' denied session administration',async()=>assert.equal((await request('/functions/v1/f90-platform',{action:'staff.security.sessions'},sessions[role].access_token)).status,403));await check(role+' denied customer security',async()=>assert.equal((await request('/functions/v1/f90-security-activity',{action:'manager_list'},sessions[role].access_token)).status,403));}
await check('anonymous session administration denied',async()=>assert.equal((await request('/functions/v1/f90-platform',{action:'staff.security.sessions'})).status,401));
await check('anonymous customer security denied',async()=>assert.equal((await request('/functions/v1/f90-security-activity',{action:'manager_list'})).status,401));
await check('manager current session stays protected',async()=>{const f=fixtures.find(x=>x.role==='manager');const r=await request('/functions/v1/f90-platform',{action:'staff.security.revoke',user_id:f.id,confirm_user_id:f.id,session_id:claims.session_id,reason:'isolated AAL1 current-session protection'},mgr);assert.equal(r.status,409);assert.equal(r.body.error.code,'F90_CURRENT_SESSION');});
const customer=fixtures.find(x=>x.role==='customer'),ct=sessions.customer.access_token;
await check('AAL1 manager revokes disposable customer session',async()=>{const r=await request('/functions/v1/f90-platform',{action:'staff.security.revoke',user_id:customer.id,confirm_user_id:customer.id,all:true,reason:'isolated AAL1 live session revocation'},mgr);assert.equal(r.status,200);assert.ok(r.body.data.revoked>=1);});
await check('revoked customer access token rejected',async()=>assert.equal((await request('/functions/v1/f90-platform',{action:'me'},ct)).status,401));
await check('revoked customer refresh token rejected',async()=>assert.notEqual((await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:sessions.customer.refresh_token})).status,200));
await check('revoked customer checkout rejected',async()=>assert.equal((await request('/functions/v1/f90-platform',{action:'checkout'},ct)).status,401));
await check('revoked customer deposit rejected',async()=>assert.equal((await request('/functions/v1/f90-platform',{action:'deposit.submit'},ct)).status,401));
fs.writeFileSync('/tmp/f90-manager-access-results.json',JSON.stringify({passed:results.length,results},null,2));console.log(JSON.stringify({passed:results.length,results}));
}catch(e){console.error(e.message);process.exitCode=1;}})();
