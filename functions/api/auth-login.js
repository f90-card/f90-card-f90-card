import {signContext,readBoundedBody} from '../../supabase/functions/f90-security-activity/network-context.mjs';
const upstream='https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-security-activity';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
export async function onRequest({request,env}){
 if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
 const origin=request.headers.get('origin');
 if(origin&&!['https://www.f90card.online','https://f90card.online',new URL(request.url).origin].includes(origin))return json(403,{error:'ORIGIN_DENIED'});
 let input;try{input=JSON.parse(await readBoundedBody(request,4096));}catch{return json(400,{error:'INVALID_BODY'})}
 if(!input||typeof input!=='object'||Array.isArray(input)||typeof input.email!=='string'||typeof input.password!=='string'||input.email.length>320||input.password.length>1024)return json(400,{error:'INVALID_BODY'});
 const secret=env.F90_ACTIVITY_GATEWAY_SECRET;
 if(typeof secret!=='string'||secret.length<32)return json(503,{error:'GATEWAY_NOT_READY'});
 try{
  const body=JSON.stringify({action:'login',email:input.email,password:input.password,...(input.gotrue_meta_security?{gotrue_meta_security:input.gotrue_meta_security}:{})});
  // Credentials go only to the same production Supabase project. They are never logged or stored in telemetry.
  const clean=new Request(request.url,{headers:{'cf-connecting-ip':request.headers.get('cf-connecting-ip')||'','user-agent':request.headers.get('user-agent')||''}});
  Object.defineProperty(clean,'cf',{value:request.cf});
  const signed=await signContext(clean,body,secret);
  const r=await fetch(upstream,{method:'POST',headers:{'Content-Type':'application/json','x-f90-activity-context':signed.payload,'x-f90-activity-signature':signed.signature},body,signal:AbortSignal.timeout(12000),redirect:'error'});
  let result;try{result=JSON.parse(await readBoundedBody(r,65536));}catch{return json(502,{error:'AUTH_UNAVAILABLE'})}
  return json(r.status,result);
 }catch{return json(502,{error:'AUTH_UNAVAILABLE'})}
}
