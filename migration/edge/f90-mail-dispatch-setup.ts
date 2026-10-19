import { createClient } from "npm:@supabase/supabase-js@2.117.3";
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL')||'';
 if(url!=='https://ogkipkavlywgwhtomoca.supabase.co')return reply({error:'Wrong project'},403);
 const worker=req.headers.get('x-f90-worker')||'';
 if(worker.length<28)return reply({error:'Forbidden'},403);
 const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(worker));
 const hash=Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
 const auth=await db.rpc('f90_worker_authorized',{p_hash:hash});
 if(auth.error||auth.data!==true)return reply({error:'Forbidden'},403);
 const bearer=Deno.env.get('SUPABASE_ANON_KEY')||'',dispatch=Deno.env.get('F90_EMAIL_DISPATCH_SECRET')||'';
 if(!bearer||dispatch.length<28)return reply({error:'Required environment unavailable',bearerConfigured:!!bearer,bearerJwt:bearer.startsWith('eyJ'),dispatchConfigured:!!dispatch,dispatchSufficient:dispatch.length>=28},503);
 const result=await db.rpc('f90_mail_provision_dispatcher',{p_bearer:bearer,p_dispatch:dispatch});
 if(result.error){console.error('mail_provision_failed',result.error.code);return reply({error:'Provisioning rejected'},409);}
 return reply({configured:result.data===true,cutover_enabled:false,mail_sent:false});
});
