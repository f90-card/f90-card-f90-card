// Staging-only transactional email smoke test.
// Authenticated, approved F90 staff may send one clearly labelled test email
// to the exact email of their verified Supabase Auth account.
// Never reads or changes deposits, balance, customers, the mail queue, or cutover flags.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const STAGING_ORIGIN = "https://f90-card-migration.pages.dev";
const cors = {
  "access-control-allow-origin": STAGING_ORIGIN,
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "vary": "Origin",
  "cache-control": "no-store",
};
function respond(body:Record<string,unknown>,status=200) {
  return new Response(JSON.stringify(body),{
    status,headers:{...cors,"content-type":"application/json; charset=utf-8"},
  });
}
Deno.serve(async (req:Request) => {
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST")return respond({error:"METHOD_NOT_ALLOWED"},405);
  if(req.headers.get("origin")!==STAGING_ORIGIN)
    return respond({error:"STAGING_ORIGIN_REQUIRED"},403);
  const token=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return respond({error:"LOGIN_REQUIRED"},401);
  const url=Deno.env.get("SUPABASE_URL")??"";
  const svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
  if(!url||!svc)return respond({error:"SERVER_NOT_READY"},503);
  const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
  // Verify Supabase Auth JWT server-side; do not trust a browser-supplied email or role.
  const {data:auth,error:authError}=await db.auth.getUser(token);
  const user=auth?.user;
  if(authError||!user||!user.email||!user.email_confirmed_at)
    return respond({error:"VERIFIED_LOGIN_REQUIRED"},401);
  const [frontRole,legacyRole]=await Promise.all([
    db.from("f90_user_roles").select("role").eq("user_id",user.id).in("role",["manager","admin"]).limit(1),
    db.from("user_roles").select("role").eq("user_id",user.id).in("role",["admin","manager"]).limit(1),
  ]);
  if(frontRole.error||legacyRole.error)
    return respond({error:"ROLE_CHECK_UNAVAILABLE"},503);
  if(!frontRole.data?.length&&!legacyRole.data?.length)
    return respond({error:"STAFF_ONLY"},403);
  const provider=Deno.env.get("RESEND_API_KEY")??"";
  const sender=Deno.env.get("F90_EMAIL_FROM")??"";
  if(!provider||!sender||sender.length>200||/[\r\n]/.test(sender))
    return respond({error:"EMAIL_SETTINGS_INCOMPLETE"},503);
  // Provider idempotency: no more than one matching mail accepted per calendar day.
  const day=new Date().toISOString().slice(0,10);
  const key="f90-stage-transactional-test-"+user.id+"-"+day;
  let result:Response;
  try{
    result=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"authorization":"Bearer "+provider,"content-type":"application/json","Idempotency-Key":key},
      body:JSON.stringify({
        from:sender,to:[user.email],
        subject:"F90 CARD | اختبار إشعارات الإيداع - لا يوجد طلب حقيقي",
        text:"هذه رسالة اختبار للإشعارات الإدارية في F90 CARD على خادم النقل. لا يوجد إيداع جديد، ولا توجد عملية شراء أو تغيير رصيد. إذا وصلت هذه الرسالة، فهذا يختبر إعدادات إرسال Resend فقط.",
        html:'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body style="background:#101018;color:#fff;font-family:Arial;padding:24px"><main style="max-width:530px;margin:auto;background:#211823;border:1px solid #e54161;border-radius:16px;padding:24px"><h1 style="color:#ff6480">F90 CARD · رسالة اختبار</h1><p>هذا اختبار لإرسال إشعارات الإيداع من النظام الجديد.</p><p><b>لا يوجد أي إيداع حقيقي أو تعديل لرصيد.</b></p></main></body></html>'
      }),
      signal:AbortSignal.timeout(15000),
    });
  }catch{return respond({error:"EMAIL_PROVIDER_TIMEOUT"},502)}
  const payload=await result.json().catch(()=>({}));
  if(!result.ok||typeof payload?.id!=="string")
    return respond({error:"EMAIL_PROVIDER_REJECTED",provider_status:result.status},502);
  return respond({status:"accepted",message:"Staging email accepted by Resend; check your own inbox.",queue_changed:false,live_store_changed:false});
});