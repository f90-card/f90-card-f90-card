import {classify,verifyContext,readBoundedBody} from "./network-context.mjs";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(projectUrl, secret, {auth:{autoRefreshToken:false,persistSession:false}});
const allowedOrigins = new Set(["https://www.f90card.online","https://f90card.online"]);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "Access-Control-Allow-Origin":allowedOrigins.has(origin)?origin:"https://www.f90card.online",
    "Vary":"Origin",
    "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info,x-f90-activity-context,x-f90-activity-signature",
    "Access-Control-Allow-Methods":"OPTIONS,POST",
  };
}
function response(req: Request, status: number, data: unknown) {
  return new Response(JSON.stringify(data),{status,headers:headers(req)});
}
Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:headers(req)});
  if(req.method!=="POST")return response(req,405,{error:"METHOD_NOT_ALLOWED"});
  if(Number(req.headers.get("content-length")||0)>8192)return response(req,413,{error:"PAYLOAD_TOO_LARGE"});
  const auth=req.headers.get("authorization")||"";
  const token=auth.match(/^Bearer\s+(.+)$/i)?.[1]||"";
  if(!token){
    try{
      const body=await readBoundedBody(req),input=JSON.parse(body);
      if(input.action!=="login_failure"&&input.action!=="login")return response(req,401,{error:"AUTH_REQUIRED"});
      if(input.action==="login_failure"&&!/^[a-f0-9]{64}$/.test(input.identity||""))return response(req,401,{error:"AUTH_REQUIRED"});
      const key=await db.rpc("f90_security_gateway_secret");
      if(key.error||typeof key.data!=="string")return response(req,503,{error:"GATEWAY_NOT_READY"});
      const context=await verifyContext(req.headers.get("x-f90-activity-context")||"",req.headers.get("x-f90-activity-signature")||"","",body,key.data||"");
      const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(key.data+context.ip))),x=>x.toString(16).padStart(2,"0")).join("");
      const limited=await db.rpc("f90_limit",{p_key:"security-login:"+fingerprint,p_limit:40});
      if(limited.error||!limited.data)return response(req,429,{error:"RATE_LIMIT"});
      if(input.action==="login"){
        if(typeof input.email!=="string"||typeof input.password!=="string"||input.email.length>320||input.password.length>1024)return response(req,400,{error:"INVALID_BODY"});
        const authClient=createClient(projectUrl,Deno.env.get("SUPABASE_ANON_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
        const result=await authClient.auth.signInWithPassword({email:input.email,password:input.password,...(input.gotrue_meta_security?{options:{captchaToken:input.gotrue_meta_security.captcha_token}}:{})});
        if(!result.error&&result.data.session)return response(req,200,result.data.session);
        if(result.error&&[400,401,422].includes(result.error.status||0)){
          const identity=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(key.data+input.email.trim().toLowerCase()))),x=>x.toString(16).padStart(2,"0")).join("");
          const saved=await db.rpc("f90_security_signal",{p_kind:"login_failed",p_key:identity,p_user:null,p_details:{message:"محاولات دخول فاشلة متكررة عبر بوابة الموقع"},p_threshold:5});
          if(saved.error)console.error("Failed-login alert unavailable",saved.error.code);
        }
        return response(req,result.error?.status===429?429:[400,401,422].includes(result.error?.status||0)?401:503,{error:"LOGIN_FAILED"});
      }
      const saved=await db.rpc("f90_security_signal",{p_kind:"login_failed",p_key:input.identity,p_user:null,p_details:{message:"محاولات دخول فاشلة متكررة عبر بوابة الموقع"},p_threshold:5});
      if(saved.error)throw saved.error;return response(req,200,{saved:true});
    }catch{return response(req,401,{error:"AUTH_REQUIRED"});}
  }

  try {
    const found=await db.auth.getUser(token);
    const user=found.data?.user;
    if(found.error||!user)return response(req,401,{error:"INVALID_SESSION"});
    let claims:Record<string,unknown>={};
    try{claims=JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));}catch{return response(req,401,{error:"INVALID_SESSION"});}
    const sessionId=String(claims.session_id||"");
    if(!uuid.test(sessionId))return response(req,401,{error:"INVALID_SESSION"});
    const valid=await db.rpc("f90_session_valid",{p_user:user.id,p_session:sessionId});
    if(valid.error||valid.data!==true)return response(req,401,{error:"SESSION_REVOKED"});
    const [profileRes,roleRes]=await Promise.all([
      db.from("profiles").select("account_status").eq("id",user.id).single(),
      db.from("f90_user_roles").select("role").eq("user_id",user.id).single()
    ]);
    if(profileRes.error||roleRes.error||profileRes.data?.account_status!=="active")
      return response(req,403,{error:"FORBIDDEN"});
    let input:Record<string,unknown>;
    let rawBody="";
    try{rawBody=await readBoundedBody(req);if(rawBody.length>8192)return response(req,413,{error:"PAYLOAD_TOO_LARGE"});input=JSON.parse(rawBody);}catch(error){return response(req,error.message==="PAYLOAD_TOO_LARGE"?413:400,{error:error.message==="PAYLOAD_TOO_LARGE"?"PAYLOAD_TOO_LARGE":"INVALID_BODY"});}
    if(!input||typeof input!=="object"||Array.isArray(input))return response(req,400,{error:"INVALID_BODY"});
    const action=String(input.action||"");
    if(action==="admin_denied"){
      const r=await db.rpc("f90_security_signal",{p_kind:"admin_denied",p_key:user.id,p_user:user.id,p_details:{message:"محاولة فتح قسم إداري غير متاح للحساب"},p_threshold:3});
      if(r.error)throw r.error;return response(req,200,{saved:true});
    }
    if(action==="record"){
      const rate=await db.rpc("f90_limit",{p_key:"session-audit:"+user.id,p_limit:12});
      if(rate.error||!rate.data)return response(req,429,{error:"RATE_LIMIT"});
      const keyResult=await db.rpc("f90_security_gateway_secret");
      if(keyResult.error||typeof keyResult.data!=="string")return response(req,503,{error:"GATEWAY_NOT_READY"});
      let context;
      try{context=await verifyContext(req.headers.get("x-f90-activity-context")||"",req.headers.get("x-f90-activity-signature")||"",auth,rawBody,keyResult.data);}
      catch{return response(req,403,{error:"TRUSTED_GATEWAY_REQUIRED"});}
      const clean=(value:unknown,n:number)=>typeof value==="string"?value.replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,n):null;
      const row:Record<string,unknown>={
        user_id:user.id,session_id:sessionId,ip_address:context.ip,country_code:context.country,
        city:context.city,region:context.region,network_org:context.network,network_asn:context.asn,
        ip_latitude:context.latitude,ip_longitude:context.longitude,network_source:"cloudflare_signed_v1",
        ...classify(context.agent,context.mobile,context.platform),
        device_model:clean(input.device_model,80),device_label:clean(input.device_label,80),last_seen_at:new Date().toISOString()
      };
      if(input.clear_location===true){
        const cleared=await db.from("f90_security_sessions").update({location_consent:false,precise_latitude:null,precise_longitude:null,precise_accuracy_m:null,precise_recorded_at:null}).eq("user_id",user.id);
        if(cleared.error)throw cleared.error;
      }else if(input.location_consent===true){
        const loc=input.location as Record<string,unknown>;
        if(!loc||![loc.latitude,loc.longitude,loc.accuracy,loc.timestamp].every(x=>typeof x==="number"&&Number.isFinite(x))||
          Math.abs(Number(loc.latitude))>90||Math.abs(Number(loc.longitude))>180||Number(loc.accuracy)<0||Number(loc.accuracy)>1000000||
          Date.now()-Number(loc.timestamp)>120000||Number(loc.timestamp)-Date.now()>30000)return response(req,400,{error:"INVALID_LOCATION"});
        Object.assign(row,{location_consent:true,precise_latitude:loc.latitude,precise_longitude:loc.longitude,
          precise_accuracy_m:loc.accuracy,precise_recorded_at:new Date(Number(loc.timestamp)).toISOString()});
      }
      const wrote=await db.from("f90_security_sessions")
        .upsert(row,{onConflict:"user_id,session_id"}).select("id").single();
      if(wrote.error)throw wrote.error;
      return response(req,200,{saved:true,source:"cloudflare_signed_v1",recorded_at:row.last_seen_at});
    }
    if(action!=="mine"&&action!=="manager_list")return response(req,400,{error:"UNKNOWN_ACTION"});
    const manager=action==="manager_list";
    if(manager){
      if(roleRes.data?.role!=="manager")return response(req,403,{error:"MANAGER_ONLY"});
      if(claims.aal!=="aal2")
        return response(req,403,{error:"MFA_REQUIRED"});
    }
    if(manager){const audit=await db.from("f90_audit").insert({actor_id:user.id,action:"security.customers.read",details:{}});if(audit.error)throw audit.error;}
    const limit=manager?2000:100;
    let q=db.from(manager?"f90_security_latest":"f90_security_sessions")
      .select("user_id,ip_address,country_code,device_type,os_name,browser_name,first_seen_at,last_seen_at,network_source,city,region,network_org,network_asn,ip_latitude,ip_longitude,device_model,device_label,location_consent,precise_latitude,precise_longitude,precise_accuracy_m,precise_recorded_at")
      .gte("last_seen_at",new Date(Date.now()-30*86400000).toISOString())
      .order("last_seen_at",{ascending:false}).limit(limit);
    if(!manager)q=q.eq("user_id",user.id);
    if(manager&&input.user_id){
      const id=String(input.user_id);if(!uuid.test(id))return response(req,400,{error:"INVALID_USER"});
      q=q.eq("user_id",id);
    }
    const sessions=await q;
    if(sessions.error)throw sessions.error;
    const items=(sessions.data||[]).map(x=>({
      user_id:x.user_id,ip:x.ip_address,country:x.country_code,
      device:x.device_type,os:x.os_name,browser:x.browser_name,
      first_seen_at:x.first_seen_at,last_seen_at:x.last_seen_at,
      source:x.network_source,city:x.city,region:x.region,network:x.network_org,asn:x.network_asn,
      ip_latitude:x.ip_latitude,ip_longitude:x.ip_longitude,device_model:x.device_model,device_label:x.device_label,
      location:x.location_consent&&x.precise_recorded_at?{latitude:x.precise_latitude,longitude:x.precise_longitude,accuracy:x.precise_accuracy_m,recorded_at:x.precise_recorded_at}:null
    }));
    if(!manager)return response(req,200,{items});
    // Display every existing account, including accounts without a saved login event.
    const profiles=await db.from("profiles")
      .select("id,display_name,customer_id,last_seen_at,created_at,account_status")
      .order("created_at",{ascending:false}).limit(2000);
    if(profiles.error)throw profiles.error;
    const latest=new Map<string,typeof items[0]>();
    for(const session of items)if(!latest.has(session.user_id))latest.set(session.user_id,session);
    const rows=(profiles.data||[]).map(p=>{
      const info=latest.get(p.id);
      return {
        ...(info||{}),user_id:p.id, name:p.display_name||"عميل",
        customer_id:String(p.customer_id||"").replace(/^F90-/i,"").replace(/\D/g,""),
        status:p.account_status||"active",
        last_seen_at:info?.last_seen_at||null,
        country:info?.country||null,ip:info?.ip||null,
        device:info?.device||"unknown",os:info?.os||"unknown",browser:info?.browser||"unknown"
      };
    });
    rows.sort((a,b)=>(b.last_seen_at?Date.parse(b.last_seen_at):0)-(a.last_seen_at?Date.parse(a.last_seen_at):0));
    return response(req,200,{items:rows,total:rows.length,sort:"newest_to_oldest",server_time:new Date().toISOString()});
  }catch(error){
    console.error("F90 security activity failure",{code: typeof error?.code==="string"?error.code:"unavailable"});
    return response(req,500,{error:"SECURITY_ACTIVITY_UNAVAILABLE"});
  }
});
