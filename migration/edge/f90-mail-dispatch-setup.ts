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
 const body=await req.json().catch(()=>({}));
 if(body.action==='testEmail'){
  // Exactly one verified, connected administrative recipient; never a caller-provided address.
  const recipientId='684f921d-2ccc-4be5-9a09-2e5fc5377946';
  const [identity,role,profile]=await Promise.all([db.auth.admin.getUserById(recipientId),db.from('f90_user_roles').select('role').eq('user_id',recipientId).single(),db.from('profiles').select('account_status').eq('id',recipientId).single()]);
  if(identity.error||role.error||profile.error||!identity.data.user.email||!identity.data.user.email_confirmed_at||role.data.role!=='manager'||profile.data.account_status!=='active')return reply({error:'Administrative recipient verification failed'},403);
  const key=Deno.env.get('RESEND_API_KEY')||'',sender=Deno.env.get('F90_EMAIL_FROM')||'';
  if(!key||!sender||/[\r\n]/.test(sender))return reply({error:'Email provider unavailable'},503);
  const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json','Idempotency-Key':'f90-dispatch-acceptance-20261019'},body:JSON.stringify({from:sender,to:[identity.data.user.email],subject:'F90 CARD | اختبار موزع البريد 20261019',text:'هذه رسالة اختبار واحدة للتحقق من وصول البريد من مشروع F90 CARD الجديد. لا تمثل إيداعًا أو عملية مالية. لم تُرسل الإشعارات التاريخية. لوحة الإدارة: https://www.f90card.online/admin.html'}),signal:AbortSignal.timeout(15000)});
  const sent=await res.json().catch(()=>({}));
  return reply({accepted:res.ok&&!!sent.id,provider_status:res.status,message_id:sent.id||null,queue_claimed:false},res.ok?200:502);
 }
 const bearer=Deno.env.get('SUPABASE_ANON_KEY')||'',dispatch=Deno.env.get('F90_EMAIL_DISPATCH_SECRET')||'';
 if(!bearer||dispatch.length<28)return reply({error:'Required environment unavailable',bearerConfigured:!!bearer,bearerJwt:bearer.startsWith('eyJ'),dispatchConfigured:!!dispatch,dispatchSufficient:dispatch.length>=28},503);
 const result=await db.rpc('f90_mail_provision_dispatcher',{p_bearer:bearer,p_dispatch:dispatch});
 if(result.error){console.error('mail_provision_failed',result.error.code);return reply({error:'Provisioning rejected'},409);}
 return reply({configured:result.data===true,cutover_enabled:false,mail_sent:false});
});
