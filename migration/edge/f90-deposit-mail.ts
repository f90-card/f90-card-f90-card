import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const adminLink="https://www.f90card.online/admin.html#/deposits";
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
function equal(a:string,b:string){const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]||0)^(y[i]||0);return d===0;}
Deno.serve(async(req:Request)=>{
 // F90 migration: read-only diagnostic reports only provider readiness flags.
 // Do not expose addresses, env values, queued jobs or stored credentials.
 if(req.method==="GET")return reply({status:"migration_readonly",dispatch:"disabled",
  providerConfigured:!!Deno.env.get("RESEND_API_KEY"),
  senderConfigured:!!Deno.env.get("F90_EMAIL_FROM"),
  dispatchSecretConfigured:!!Deno.env.get("F90_EMAIL_DISPATCH_SECRET")});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 // Authenticated diagnostics never claim queue records or send emails.
 if(req.headers.get("x-f90-diagnostic")==="yes"){
  const secret=Deno.env.get("F90_EMAIL_DISPATCH_SECRET")??"";
  if(secret.length<28||!equal(req.headers.get("x-f90-dispatch-secret")??"",secret))
   return reply({error:"Forbidden"},403);
  return reply({authenticated:true,cutover_ready:Deno.env.get("F90_MAIL_CUTOVER_READY")==="YES_APPROVED_AFTER_QUEUE_REVIEW",mail_sent:false});
 }
 // Do not drain the inherited 14 pending source queue items from staging.
 // A separate authenticated cutover is required before real notification sends.
 if(Deno.env.get("F90_MAIL_CUTOVER_READY")!=="YES_APPROVED_AFTER_QUEUE_REVIEW")
  return reply({status:"migration_readonly",dispatch:"disabled"},423);
 // Independent cutover timestamp: only notify about deposits created after real go-live.
 // Historical 14 queued notifications remain available for audit but are never replayed.
 const mailCutoverAt=Deno.env.get("F90_MAIL_CUTOVER_AFTER")??"";
 const parsedCutover=Date.parse(mailCutoverAt);
 if(!/^\d{4}-\d{2}-\d{2}T/.test(mailCutoverAt)||
    !Number.isFinite(parsedCutover)||!/[Zz]$/.test(mailCutoverAt)||
    parsedCutover<Date.parse("2026-10-19T00:00:00Z")||
    parsedCutover>Date.now()+60000)
   return reply({status:"migration_readonly",dispatch:"cutover_time_required"},423);
 const secret=Deno.env.get("F90_EMAIL_DISPATCH_SECRET")??"";
 if(!secret||secret.length<28)return reply({error:"Email dispatcher not yet configured"},503);
 if(!equal(req.headers.get("x-f90-dispatch-secret")??"",secret))return reply({error:"Forbidden"},403);
 const providerKey=Deno.env.get("RESEND_API_KEY")??"";
 const sender=Deno.env.get("F90_EMAIL_FROM")??"";
 if(!providerKey||!sender||sender.length>200||/[\r\n]/.test(sender))return reply({error:"Email provider not configured"},503);
 const url=Deno.env.get("SUPABASE_URL")??"",svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 if(!url||!svc)return reply({error:"Backend credentials unavailable"},503);
 const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:jobs,error:claimErr}=await db.rpc("f90_mail_claim_after",{p_cutover_at:mailCutoverAt,max_jobs:10});
 if(claimErr){console.error("email_claim_failed",claimErr.code);return reply({error:"Queue unavailable"},500);}
 let accepted=0,failed=0;
 for(const job of jobs??[]){
  let ok=false,why="";
  try{
   const res=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"authorization":"Bearer "+providerKey,"content-type":"application/json","Idempotency-Key":"f90-deposit-"+job.job_id},
    body:JSON.stringify({
     from:sender,to:[job.recipient],subject:"F90 CARD | طلب إيداع جديد بانتظار المراجعة",
     text:"وصل طلب إيداع جديد إلى متجر أف تسعين كارد.\nافتح لوحة الإدارة لمراجعته:\n"+adminLink+"\n\nإشعار إداري آلي، من دون بيانات العميل أو الإيصال.",
     html:'<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Arial;background:#101018;color:#fff;padding:24px"><main style="max-width:520px;margin:auto;background:#201622;border:1px solid #ce3154;border-radius:15px;padding:26px"><h2 style="color:#ff6587">F90 CARD · أف تسعين كارد</h2><p>وصل طلب إيداع جديد بانتظار المراجعة.</p><p><a href="'+adminLink+'" style="background:#b42149;color:white;padding:11px 18px;border-radius:8px;text-decoration:none">فتح طلبات الإيداع</a></p><small>لا يحتوي الإشعار على معلومات مالية خاصة.</small></main></body></html>'
    }),
    signal:AbortSignal.timeout(15000)
   });
   const body=await res.json().catch(()=>({}));
   ok=res.ok&&!!body?.id;
   if(!ok)why="resend_"+res.status+":"+String(body?.message??"rejected").slice(0,120);
  }catch(err){why=err instanceof Error?err.name:"transport_error";}
  const {error:markErr}=await db.rpc("f90_mail_complete",{p_id:job.job_id,p_token:job.dispatch_token,p_sent:ok,p_error:ok?null:why});
  if(markErr)console.error("email_mark_failed",markErr.code);
  if(ok)accepted++;else failed++;
 }
 return reply({processed:(jobs??[]).length,accepted,failed,inbox_delivery_confirmed:false});
});
