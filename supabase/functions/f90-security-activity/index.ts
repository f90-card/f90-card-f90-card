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
    "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods":"OPTIONS,POST",
  };
}
function response(req: Request, status: number, data: unknown) {
  return new Response(JSON.stringify(data),{status,headers:headers(req)});
}
function classify(agent:string) {
  const ua=agent.slice(0,280);
  const device=/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)?"tablet":/Mobile|iPhone|Android|iPod/i.test(ua)?"phone":/Windows|Macintosh|Linux/i.test(ua)?"desktop":"unknown";
  const os=/Android/i.test(ua)?"Android":/iPhone|iPad|iPod/i.test(ua)?"iOS":/Windows/i.test(ua)?"Windows":/Mac OS|Macintosh/i.test(ua)?"macOS":/Linux/i.test(ua)?"Linux":"unknown";
  const browser=/Edg\//i.test(ua)?"Edge":/OPR\//i.test(ua)?"Opera":/Firefox\//i.test(ua)?"Firefox":/Chrome\//i.test(ua)?"Chrome":/Safari\//i.test(ua)?"Safari":"unknown";
  return {device_type:device,os_name:os,browser_name:browser};
}
function gatewayIp(req:Request) {
  const ip=(req.headers.get("cf-connecting-ip")||"").trim();
  if(ip.length>45)return null;
  const ipv4=/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)&&ip.split(".").every(p=>Number(p)<=255);
  const ipv6=ip.includes(":") && /^[a-f0-9:]+$/i.test(ip) && (ip.match(/:/g)||[]).length>=2;
  return ipv4||ipv6?ip:null;
}
Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:headers(req)});
  if(req.method!=="POST")return response(req,405,{error:"METHOD_NOT_ALLOWED"});
  if(Number(req.headers.get("content-length")||0)>2048)return response(req,413,{error:"PAYLOAD_TOO_LARGE"});
  const auth=req.headers.get("authorization")||"";
  const token=auth.match(/^Bearer\s+(.+)$/i)?.[1]||"";
  if(!token)return response(req,401,{error:"AUTH_REQUIRED"});
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
    try{input=await req.json();}catch{return response(req,400,{error:"INVALID_BODY"});}
    const action=String(input.action||"");
    if(action==="record"){
      const rate=await db.rpc("f90_limit",{p_key:"session-audit:"+user.id,p_limit:12});
      if(rate.error||!rate.data)return response(req,429,{error:"RATE_LIMIT"});
      const rawCountry=(req.headers.get("cf-ipcountry")||"").trim().toUpperCase();
      const country=/^[A-Z]{2}$/.test(rawCountry)&&!["XX","T1"].includes(rawCountry)?rawCountry:null;
      const row={
        user_id:user.id,session_id:sessionId,ip_address:gatewayIp(req),country_code:country,
        ...classify(req.headers.get("user-agent")||""),last_seen_at:new Date().toISOString()
      };
      const existing=await db.from("f90_security_sessions")
        .select("id").eq("user_id",user.id).eq("session_id",sessionId).maybeSingle();
      if(existing.error)throw existing.error;
      const wrote=await db.from("f90_security_sessions")
        .upsert(row,{onConflict:"user_id,session_id"}).select("id").single();
      if(wrote.error)throw wrote.error;
      if(!existing.data){
        const audit=await db.from("f90_audit").insert({
          actor_id:user.id,action:"security.new_session",target_id:user.id,
          details:{device_type:row.device_type,os_name:row.os_name,browser_name:row.browser_name,country_code:country}
        });
        if(audit.error)console.error("Session alert audit unavailable",audit.error.code);
      }
      return response(req,200,{saved:true,new_session:!existing.data});
    }
    if(action!=="mine"&&action!=="manager_list")return response(req,400,{error:"UNKNOWN_ACTION"});
    const manager=action==="manager_list";
    if(manager){
      if(roleRes.data?.role!=="manager")return response(req,403,{error:"MANAGER_ONLY"});
      const factors=user.factors||[];
      if(factors.some(f=>f.status==="verified")&&claims.aal!=="aal2")
        return response(req,403,{error:"MFA_REQUIRED"});
    }
    const limit=manager?500:20;
    let q=db.from("f90_security_sessions")
      .select("user_id,ip_address,country_code,device_type,os_name,browser_name,first_seen_at,last_seen_at")
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
      first_seen_at:x.first_seen_at,last_seen_at:x.last_seen_at
    }));
    if(!manager)return response(req,200,{items});
    // Display every existing account, including accounts without a saved login event.
    const profiles=await db.from("profiles")
      .select("id,display_name,customer_id,last_seen_at,created_at,account_status")
      .order("created_at",{ascending:true}).limit(500);
    if(profiles.error)throw profiles.error;
    const latest=new Map<string,typeof items[0]>();
    for(const session of items)if(!latest.has(session.user_id))latest.set(session.user_id,session);
    const rows=(profiles.data||[]).map(p=>{
      const info=latest.get(p.id);
      return {
        user_id:p.id, name:p.display_name||"عميل",
        customer_id:String(p.customer_id||"").replace(/^F90-/i,"").replace(/\D/g,""),
        status:p.account_status||"active",
        last_seen_at:info?.last_seen_at||null,
        country:info?.country||null,ip:info?.ip||null,
        device:info?.device||"unknown",os:info?.os||"unknown",browser:info?.browser||"unknown"
      };
    });
    rows.sort((a,b)=>(a.last_seen_at?Date.parse(a.last_seen_at):0)-(b.last_seen_at?Date.parse(b.last_seen_at):0));
    return response(req,200,{items:rows,total:rows.length,sort:"oldest_to_newest"});
  }catch(error){
    console.error("F90 security activity failure",error instanceof Error?error.message:"unknown");
    return response(req,500,{error:"SECURITY_ACTIVITY_UNAVAILABLE"});
  }
});