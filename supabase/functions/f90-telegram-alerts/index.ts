import {createClient} from "npm:@supabase/supabase-js@2";
const jsonHeaders={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:jsonHeaders});
const env=(name:string)=>Deno.env.get(name)?.trim()||"";
const escapeHTML=(x:unknown)=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const stamp=(value:unknown)=>{
 const d=new Date(String(value||""));
 return Number.isFinite(d.getTime())?d.toISOString().replace("T"," ").slice(0,16)+" UTC":"";
};
function message(row:any):string{
 const d=row.payload||{},id=String(d.id||"").slice(0,36),date=stamp(d.created_at);
 if(row.event_type==="test")return "✅ <b>F90 CARD | Telegram connected</b>\nThis is a test alert from the administration panel.\n"+escapeHTML(stamp(d.created_at));
 if(row.event_type==="deposit_new"){
  return "💰 <b>F90 CARD | طلب إيداع جديد</b>\n"+
   "<b>المبلغ:</b> "+escapeHTML(d.amount)+" "+escapeHTML(d.currency)+"\n"+
   "<b>الطريقة:</b> "+escapeHTML(d.method)+"\n"+
   "<b>وقت الطلب:</b> "+escapeHTML(date)+"\n"+
   "<b>رقم الطلب:</b> <code>"+escapeHTML(id)+"</code>\n"+
   "راجع الطلب من لوحة الإدارة.";
 }
 if(row.event_type==="salary_new")
   return "💰 <b>F90 CARD | طلب سحب رواتب Xena Live</b>\n"+
     "<b>الكوينز المسحوبة:</b> "+escapeHTML(d.coins)+"\n"+
     "<b>قيمة الإيداع:</b> "+escapeHTML(d.payout_amount)+" "+escapeHTML(d.currency)+"\n"+
     "<b>المقابل في محفظة F90:</b> "+escapeHTML(d.usd_amount)+" USD\n"+
     "<b>وقت الطلب:</b> "+escapeHTML(date)+"\n"+
     "<b>رقم طلب Xena:</b> <code>"+escapeHTML(id)+"</code>\n"+
     "الطلب بانتظار المراجعة في لوحة الإدارة. لا يحتوي التنبيه على صورة الإيصال أو بيانات الحساب.";
 if(row.event_type==="verification_new")
   return "🪪 <b>F90 CARD | طلب توثيق جديد</b>\n"+
   "<b>وقت الطلب:</b> "+escapeHTML(date)+"\n"+
   "<b>المرجع:</b> <code>"+escapeHTML(id)+"</code>\n"+
   "لا تُرسل صور الهوية أو المستندات إلى تلجرام.";
 if(row.event_type==="order_review")
   return "⚠️ <b>F90 CARD | مراجعة طلب</b>\n"+
   "<b>النوع:</b> "+escapeHTML(d.kind==="dispute"?"اعتراض":d.kind==="cancel"?"طلب إلغاء":"مراجعة")+"\n"+
   "<b>رقم الطلب:</b> <code>"+escapeHTML(d.order_id)+"</code>\n"+
   "<b>وقت الطلب:</b> "+escapeHTML(date);
 if(row.event_type==="user_new")
   return "👤 <b>F90 CARD | حساب عميل جديد</b>\n"+
     "<b>الوقت:</b> "+escapeHTML(date)+"\n"+
     "<b>مرجع الحساب:</b> <code>"+escapeHTML(id)+"</code>\n"+
     "لا تتضمن الرسالة بريد العميل أو رقم هاتفه أو بيانات خاصة.";
 if(row.event_type==="order_manual")
   return "📦 <b>F90 CARD | طلب يدوي جديد</b>\n"+
     "<b>الخدمة:</b> "+escapeHTML(d.product_name)+"\n"+
     "<b>قيمة الطلب:</b> "+escapeHTML(d.total_usd)+" USD\n"+
     "<b>رقم الطلب:</b> <code>"+escapeHTML(d.order_number)+"</code>\n"+
     "<b>الوقت:</b> "+escapeHTML(date);
 if(row.event_type==="manual_request")
   return "📝 <b>F90 CARD | طلب خدمة جديدة</b>\n"+
     "<b>الخدمة:</b> "+escapeHTML(d.service)+"\n"+
     "<b>النوع:</b> "+escapeHTML(d.kind)+"\n"+
     "<b>المرجع:</b> <code>"+escapeHTML(id)+"</code>\n"+
     "<b>الوقت:</b> "+escapeHTML(date);
 if(row.event_type==="ops_issue"){
   return "🚨 <b>F90 CARD | تنبيه تشغيلي</b>\n"+
     "<b>السبب:</b> "+escapeHTML(String(d.message||"")).slice(0,370)+"\n"+
     "<b>درجة التنبيه:</b> "+escapeHTML(d.level==="critical"?"حرج":"تحذير")+"\n"+
     "<b>الرمز:</b> <code>"+escapeHTML(String(d.code||"")).slice(0,80)+"</code>\n"+
     "<b>وقت الرصد:</b> "+escapeHTML(stamp(d.created_at))+"\n"+
     "راجع مركز تحكم F90 من لوحة الإدارة.";
 }
 if(row.event_type==="ops_resolved"){
   return "✅ <b>F90 CARD | تعافي الخدمة</b>\n"+
     "<b>المشكلة السابقة:</b> "+escapeHTML(String(d.message||"")).slice(0,370)+"\n"+
     "<b>الرمز:</b> <code>"+escapeHTML(String(d.code||"")).slice(0,80)+"</code>\n"+
     "<b>وقت التعافي:</b> "+escapeHTML(stamp(d.created_at));
 }
 throw new Error("Unsupported event");
}
Deno.serve(async req=>{
 if(req.method!=="POST")return respond(405,{error:"Only POST requests accepted"});
 const provided=req.headers.get("x-f90-telegram-dispatch")||"";
 if(provided.length<30)return respond(403,{error:"Dispatch authorization required"});
 const db=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),
   {auth:{persistSession:false,autoRefreshToken:false}});
 const {data:credentials,error:credentialError}=await db.rpc("f90_telegram_credentials");
 if(credentialError)return respond(503,{error:"Secure Telegram configuration unavailable"});
 const secret=String(credentials?.dispatch||"");
 if(secret.length<30 || provided.length!==secret.length || provided!==secret)
   return respond(403,{error:"Dispatch authorization required"});
 const bot=String(credentials?.token||""),chat=String(credentials?.chat||"");
 if(!/^[0-9]{6,}:[A-Za-z0-9_-]{20,}$/.test(bot) || !/^-?[0-9]{4,}$/.test(chat))
   return respond(503,{error:"Telegram bot token or chat ID has not been configured"});
 const {data:rows,error}=await db.rpc("f90_telegram_claim",{p_limit:8});
 if(error)return respond(500,{error:"Queue temporarily unavailable"});
 let sent=0,failed=0;
 for(const row of rows||[]){
  let ok=false,errorMessage="";
  try{
    const text=message(row);
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    let response:Response;
    try{
      response=await fetch("https://api.telegram.org/bot"+bot+"/sendMessage",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({chat_id:chat,text,parse_mode:"HTML",
          disable_web_page_preview:true}),
        signal:controller.signal
      });
    }finally{clearTimeout(timeout);}
    const outcome=await response.json().catch(()=>null);
    ok=response.ok && outcome?.ok===true;
    if(!ok)errorMessage="Telegram HTTP "+response.status+" / "+String(outcome?.description||"Delivery rejected").slice(0,150);
  }catch(e){errorMessage=e instanceof Error?e.message.slice(0,180):"Delivery failed";}
  const done=await db.rpc("f90_telegram_finish",{p_id:row.id,p_claim:row.claim_id,p_ok:ok,p_error:ok?null:errorMessage});
  if(done.error)console.error("F90 telegram status update failed",row.id);
  if(ok)sent++;else failed++;
 }
 return respond(200,{processed:(rows||[]).length,sent,failed});
});
