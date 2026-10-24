import {signContext,readBoundedBody} from '../../supabase/functions/f90-security-activity/network-context.mjs';
const base='https://ogkipkavlywgwhtomoca.supabase.co';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
export async function onRequest({request,env,waitUntil}){
 if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
 const origin=request.headers.get('origin');
 if(origin&&!['https://www.f90card.online','https://f90card.online',new URL(request.url).origin].includes(origin))return json(403,{error:'ORIGIN_DENIED'});
 const key=request.headers.get('apikey')||'';
 if(!/^sb_publishable_[A-Za-z0-9_-]{10,200}$/.test(key))return json(400,{error:'PUBLIC_KEY_REQUIRED'});
 let input;try{input=JSON.parse(await readBoundedBody(request,4096));}catch{return json(400,{error:'INVALID_BODY'})}
 if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.email!=='string'||typeof input.password!=='string'||input.email.length>320||input.password.length>1024)return json(400,{error:'INVALID_BODY'});
 try{
  const r=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:input.email,password:input.password,...(input.gotrue_meta_security?{gotrue_meta_security:input.gotrue_meta_security}:{})}),signal:AbortSignal.timeout(20000),redirect:'error'});
  if(r.status===400||r.status===401||r.status===422){
   const secret=env.F90_ACTIVITY_GATEWAY_SECRET;
   if(typeof secret==='string'&&secret.length>=32){
    // Only a salted digest leaves this gateway. Passwords and raw emails never enter telemetry.
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret+input.email.trim().toLowerCase()))),x=>x.toString(16).padStart(2,'0')).join('');
    const body=JSON.stringify({action:'login_failure',identity:digest});
    const clean=new Request(request.url,{headers:{'cf-connecting-ip':request.headers.get('cf-connecting-ip')||'','user-agent':request.headers.get('user-agent')||''}});
    Object.defineProperty(clean,'cf',{value:request.cf});
    const signed=await signContext(clean,body,secret);
    waitUntil(fetch(base+'/functions/v1/f90-security-activity',{method:'POST',headers:{'Content-Type':'application/json','x-f90-activity-context':signed.payload,'x-f90-activity-signature':signed.signature},body,signal:AbortSignal.timeout(10000)}).then(x=>x.body?.cancel()).catch(()=>{}));
   }
  }
  return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
 }catch{return json(502,{error:'AUTH_UNAVAILABLE'})}
}
