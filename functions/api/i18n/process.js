// Internal signed scheduler endpoint. Customer visits never generate translations.
const endpoint='https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-platform';
const encoder=new TextEncoder();
async function readBody(request){const reader=request.body?.getReader();if(!reader)return '';let size=0,text='';const decoder=new TextDecoder();try{while(true){const{value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw Error('BODY_LIMIT');}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}}
async function key(secret){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function sign(secret,message){return [...new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(message)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function valid(secret,message,signature){if(!/^[a-f0-9]{64}$/.test(signature||''))return false;return crypto.subtle.verify('HMAC',await key(secret),Uint8Array.from(signature.match(/../g),x=>parseInt(x,16)),encoder.encode(message));}
export async function onRequest(context){
 const{request,env}=context;if(request.method!=='POST')return new Response(null,{status:405});
 const secret=env.F90_ACTIVITY_GATEWAY_SECRET;if(!secret||!env.F90_I18N_AI)return Response.json({error:'NOT_CONFIGURED'},{status:503});
 if(Number(request.headers.get('content-length')||0)>2048)return new Response(null,{status:413});
 let raw;try{raw=await readBody(request);}catch{return new Response(null,{status:413});}let body;try{body=JSON.parse(raw);}catch{return new Response(null,{status:400});}
 if(!Number.isSafeInteger(body.timestamp)||Math.abs(Date.now()/1000-body.timestamp)>300||!await valid(secret,'f90-i18n-tick:'+body.timestamp,body.signature))return Response.json({error:'UNAUTHORISED'},{status:403});
 async function call(action,payload){const timestamp=Math.floor(Date.now()/1000),signature=await sign(secret,'f90-i18n-worker:'+timestamp+':'+action+':'+JSON.stringify(payload));const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,timestamp,payload,signature}),signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok||data.error)throw Error('UPSTREAM');return data.data;}
 let claimed;try{claimed=await call('i18n.worker.claim',{});if(!claimed.rows?.length)return Response.json({processed:0,quota_exhausted:!!claimed.quota_exhausted,disabled:!!claimed.disabled});
 const ai=await env.F90_I18N_AI.fetch('https://internal/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows:claimed.rows})});const result=await ai.json();const rows=Array.isArray(result.rows)&&result.rows.length?result.rows:claimed.rows.map(x=>({source_text:x.source_text,error:'PROVIDER_UNAVAILABLE'}));const completed=await call('i18n.worker.complete',{lease_id:claimed.lease_id,rows});return Response.json({processed:completed,failed:rows.length-completed});
 }catch{if(claimed?.lease_id)try{await call('i18n.worker.complete',{lease_id:claimed.lease_id,rows:claimed.rows.map(x=>({source_text:x.source_text,error:'PROVIDER_UNAVAILABLE'}))});}catch{}return Response.json({error:'TRANSLATION_RETRY_SCHEDULED'},{status:502});}
}
