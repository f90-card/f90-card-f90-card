import {signContext,readBoundedBody} from '../../supabase/functions/f90-security-activity/network-context.mjs';
const upstream='https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-security-activity';
const response=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
export async function onRequest(context){
 const request=context.request;
 if(request.method!=='POST')return response(405,{error:'METHOD_NOT_ALLOWED'});
 const origin=request.headers.get('origin');
 if(origin&&!['https://www.f90card.online','https://f90card.online',new URL(request.url).origin].includes(origin))return response(403,{error:'ORIGIN_DENIED'});
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer [^\s]{20,6000}$/.test(authorization))return response(401,{error:'AUTH_REQUIRED'});
 if(Number(request.headers.get('content-length')||0)>8192)return response(413,{error:'PAYLOAD_TOO_LARGE'});
 let body,input;
 try{body=await readBoundedBody(request);if(body.length>8192)return response(413,{error:'PAYLOAD_TOO_LARGE'});input=JSON.parse(body);}catch(error){return response(error.message==='PAYLOAD_TOO_LARGE'?413:400,{error:error.message==='PAYLOAD_TOO_LARGE'?'PAYLOAD_TOO_LARGE':'INVALID_BODY'})}
 if(!input||!['record','mine','manager_list','admin_denied'].includes(input.action))return response(400,{error:'UNKNOWN_ACTION'});
 const headers={'Authorization':authorization,'Content-Type':'application/json'};
 if(input.action==='record'){
  const secret=context.env.F90_ACTIVITY_GATEWAY_SECRET;
  if(typeof secret!=='string'||secret.length<32)return response(503,{error:'GATEWAY_NOT_READY'});
  const signed=await signContext(request,body,secret);
  headers['x-f90-activity-context']=signed.payload;headers['x-f90-activity-signature']=signed.signature;
 }
 try{
  const r=await fetch(upstream,{method:'POST',headers,body,redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(r.status>=300&&r.status<400)return response(502,{error:'UPSTREAM_REDIRECT'});
  return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
 }catch{return response(502,{error:'SECURITY_ACTIVITY_UNAVAILABLE'})}
}
