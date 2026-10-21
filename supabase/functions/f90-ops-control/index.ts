import { createClient } from "npm:@supabase/supabase-js@2.117.3";
const url=Deno.env.get("SUPABASE_URL")||"";
const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const origins=new Set(["https://www.f90card.online","https://f90card.online"]);
const uidRe=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const json=(req:Request,status:number,body:unknown)=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
 "Access-Control-Allow-Origin":origins.has(req.headers.get("origin")||"")?req.headers.get("origin")!:"https://www.f90card.online",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"}
});
const value=<T>(r:{data:T,error:any},msg:string):T=>{if(r.error)throw Error(msg+":"+r.error.code);return r.data};
async function loggedIn(req:Request){
 const token=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)throw Error("AUTH_REQUIRED");
 const response=await db.auth.getUser(token),u=response.data?.user;
 if(response.error||!u)throw Error("AUTH_REQUIRED");
 let claims:any={};try{claims=JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")))}catch{throw Error("AUTH_REQUIRED")}
 const session=String(claims.session_id||"");
 if(!uidRe.test(session))throw Error("AUTH_REQUIRED");
 const valid=await db.rpc("f90_session_valid",{p_user:u.id,p_session:session});
 if(valid.error||valid.data!==true)throw Error("AUTH_REQUIRED");
 const [profile,role]=await Promise.all([
 db.from("profiles").select("account_status").eq("id",u.id).single(),
 db.from("f90_user_roles").select("role").eq("user_id",u.id).single()
 ]);
 if(profile.error||profile.data?.account_status!=="active"||role.error||role.data?.role!=="manager")throw Error("MANAGER_ONLY");
 return {id:u.id,claims,mfa:claims.aal==="aal2",verified:(u.factors||[]).some((x:any)=>x.status==="verified")};
}
async function snapshot(table:string,columns="*",limit=2000){
 const r=await db.from(table).select(columns,{count:"exact"}).limit(limit);
 if(r.error)throw Error("DATA_UNAVAILABLE:"+table);
 if((r.count||0)>limit)throw Error("SNAPSHOT_TOO_LARGE:"+table);
 return r.data||[];
}
async function health(){
 const [flags,providers,orders,deposits,notifications,keys,sessions]=await Promise.all([
 db.from("f90_ops_flags").select("*").eq("id",1).single(),
 db.from("f90_providers").select("name,adapter,is_enabled,margin_percent"),
 db.from("f90_orders").select("status,created_at").order("created_at",{ascending:false}).limit(300),
 db.from("f90_deposits").select("status,created_at").order("created_at",{ascending:false}).limit(300),
 db.from("f90_notification_outbox").select("destination,status,created_at").eq("status","pending").order("created_at",{ascending:false}).limit(200),
 db.from("f90_api_keys").select("is_active,last_used_at,created_at").limit(100),
 db.from("f90_security_sessions").select("last_seen_at").order("last_seen_at",{ascending:false}).limit(1)
 ]);
 for(const r of [flags,providers,orders,deposits,notifications,keys,sessions])if(r.error)throw Error("MONITOR_UNAVAILABLE");
 const pending=(notifications.data||[]).filter(x=>x.destination!=="channel_draft");
 const cronResult=await db.rpc("f90_ops_cron_health");
 return {
 as_of:new Date().toISOString(),
 flags:flags.data,
 providers:providers.data,
 orders:{count_sampled:orders.data?.length||0,pending:(orders.data||[]).filter(x=>["pending","processing","refilling","in_progress"].includes(x.status)).length,last:orders.data?.[0]?.created_at||null},
 deposits:{count_sampled:deposits.data?.length||0,pending:(deposits.data||[]).filter(x=>x.status==="pending").length,last:deposits.data?.[0]?.created_at||null},
 notification_backlog:{sampled:notifications.data?.length||0,non_draft_in_sample:pending.length,last:notifications.data?.[0]?.created_at||null},
 api:{keys_sampled:keys.data?.length||0,active:(keys.data||[]).filter(x=>x.is_active).length,ever_used:(keys.data||[]).filter(x=>x.last_used_at).length},
 cron_jobs:cronResult.error?[]:cronResult.data,
 session_latest:sessions.data?.[0]?.last_seen_at||null,
 note:"تُعرض مؤشرات قاعدة البيانات فقط. نجاح مهام المجدول والتسليم الفعلي يحتاجان فحصًا منفصلًا."
 };
}
async function merchantLab(){
 const start=Date.now();
 let catalog:{ok:boolean,code:number|null,products:number|null,error?:string}={ok:false,code:null,products:null};
 try{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6500);
  try{
   const r=await fetch(url+"/functions/v1/f90-platform",{
    method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify({action:"catalog"}),signal:controller.signal
   });
   let body:any=null;try{body=await r.json()}catch{}
   const count=body?.data?.products?.length??body?.products?.length;
   catalog={ok:r.ok&&Array.isArray(body?.data?.products||body?.products),code:r.status,products:Number.isFinite(count)?count:null};
  }finally{clearTimeout(timeout)}
 }catch{catalog={ok:false,code:null,products:null,error:"تعذّر فحص القراءة العامة"}}
 const [keys,providers,products,usage]=await Promise.all([
 db.from("f90_api_keys").select("id,is_active,expires_at,last_used_at,scopes").limit(200),
 db.from("f90_providers").select("name,adapter,is_enabled"),
 db.from("products").select("id,name,price,is_active").eq("is_active",true).limit(3),
 db.from("f90_api_usage").select("action,http_status,created_at").order("created_at",{ascending:false}).limit(20)
 ]);
 for(const r of [keys,providers,products,usage])if(r.error)throw Error("LAB_UNAVAILABLE");
 return {catalog,latency_ms:Date.now()-start,active_keys:(keys.data||[]).filter(k=>k.is_active).length,
 expired_keys:(keys.data||[]).filter(k=>k.is_active&&k.expires_at&&Date.parse(k.expires_at)<=Date.now()).length,
 example_products:products.data||[],providers:providers.data||[],recent_usage:usage.data||[],
 note:"اختبار قراءة فقط، لا ينشئ طلبًا ولا يخصم رصيدًا ولا يكشف مفاتيح API."};
}
async function profit(days:number){
 const since=new Date(Date.now()-days*86400000).toISOString();
 const [orders,refunds]=await Promise.all([
 db.from("f90_orders").select("id,product_name,status,total_usd,cost_usd,refunded_usd,created_at").gte("created_at",since).order("created_at",{ascending:false}).limit(1500),
 db.from("f90_deposits").select("usd_amount,status,created_at").gte("created_at",since).limit(1500)
 ]);
 if(orders.error||refunds.error)throw Error("ANALYTICS_UNAVAILABLE");
 let gross=0,cost=0,refunded=0,missingCost=0,fulfilled=0;
 const byProduct=new Map<string,{name:string,orders:number,revenue:number,cost:number}>();
 for(const x of orders.data||[]){
  if(!["completed","partial"].includes(x.status))continue;
  fulfilled++;
  const revenue=Number(x.total_usd)||0,back=Number(x.refunded_usd)||0,expense=Number(x.cost_usd)||0;
  gross+=revenue;refunded+=back;cost+=expense;
  if(x.cost_usd==null)missingCost++;
  const name=String(x.product_name||"خدمة");
  const item=byProduct.get(name)||{name,orders:0,revenue:0,cost:0};
  item.orders++;item.revenue+=revenue-back;item.cost+=expense;byProduct.set(name,item);
 }
 return {days,as_of:new Date().toISOString(),orders_in_period:orders.data?.length||0,
 completed:fulfilled,gross_usd:gross,refunds_usd:refunded,supplier_cost_usd:cost,
 estimated_profit_usd:gross-refunded-cost,missing_cost_orders:missingCost,
 approved_deposits_usd:(refunds.data||[]).filter(x=>x.status==="approved").reduce((n,x)=>n+(Number(x.usd_amount)||0),0),
 top_services:[...byProduct.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,12),
 note:"الربح تقديري من تكلفة الطلب المسجّلة ولا يشمل رسوم بوابات الدفع أو المصاريف الخارجية. الإيداعات ليست أرباحًا."};
}
const bucket="f90-ops-private-backups";
const plan=[
 ["profiles","id,display_name,customer_id,account_status,is_verified,account_currency,created_at"],
 ["f90_user_roles","user_id,role"],["f90_wallets","*"],["f90_wallet_ledger","*"],
 ["f90_orders","*"],["f90_deposits","*"],["products","*"],["categories","*"],["f90_rates","*"]
] as const;
async function listBackups(){
 const r=await db.from("f90_ops_snapshots").select("id,created_at,size_bytes,sha256,manifest").order("created_at",{ascending:false}).limit(20);
 return {items:value(r,"BACKUP_LIST_UNAVAILABLE"),type:"نسخة تشغيلية انتقائية خاصة؛ ليست نسخة PostgreSQL كاملة ولا استعادة فورية."};
}
async function createBackup(actorId:string){
 const records:Record<string,unknown[]>={},counts:Record<string,number>={};
 for(const [table,columns] of plan){const data=await snapshot(table,columns);records[table]=data;counts[table]=data.length;}
 const now=new Date().toISOString(),content=JSON.stringify({schema:1,created_at:now,counts,records});
 const buffer=new TextEncoder().encode(content);
 if(buffer.byteLength>10*1024*1024)throw Error("BACKUP_TOO_LARGE");
 const digest=await crypto.subtle.digest("SHA-256",buffer),sha=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
 const b=await db.storage.getBucket(bucket);
 if(b.error){const made=await db.storage.createBucket(bucket,{public:false});if(made.error)throw Error("PRIVATE_BUCKET_UNAVAILABLE");}
 const id=crypto.randomUUID(),path=new Date().toISOString().slice(0,10)+"/"+id+".json";
 const upload=await db.storage.from(bucket).upload(path,buffer,{contentType:"application/json",upsert:false});
 if(upload.error)throw Error("BACKUP_UPLOAD_FAILED");
 const rec=await db.from("f90_ops_snapshots").insert({id,created_by:actorId,object_path:path,sha256:sha,size_bytes:buffer.byteLength,manifest:{counts,type:"operational-selective"}}).select("id").single();
 if(rec.error){await db.storage.from(bucket).remove([path]);throw Error("BACKUP_INDEX_FAILED");}
 return {saved:true,id,size_bytes:buffer.byteLength,sha256:sha,counts,
 note:"تم حفظ نسخة تشغيلية خاصة. لا تنفّذ استعادة آلية، ولا تشمل أسرار الإعدادات أو ملفات الإيصالات."};
}
async function verifyBackup(id:string){
 if(!uidRe.test(id))throw Error("INVALID_BACKUP_ID");
 const ref=value(await db.from("f90_ops_snapshots").select("object_path,sha256").eq("id",id).single(),"BACKUP_NOT_FOUND");
 const fetched=await db.storage.from(bucket).download(ref.object_path);
 if(fetched.error||!fetched.data)throw Error("BACKUP_FILE_UNAVAILABLE");
 const binary=await fetched.data.arrayBuffer(),sha=[...new Uint8Array(await crypto.subtle.digest("SHA-256",binary))].map(x=>x.toString(16).padStart(2,"0")).join("");
 return {matches:sha===ref.sha256,size_bytes:binary.byteLength,checked_at:new Date().toISOString(),
 note:"فحص البصمة لا يضمن إمكانية استعادة قاعدة البيانات كاملة."};
}
async function backupLink(id:string){
 if(!uidRe.test(id))throw Error("INVALID_BACKUP_ID");
 const ref=value(await db.from("f90_ops_snapshots").select("object_path").eq("id",id).single(),"BACKUP_NOT_FOUND");
 const signed=await db.storage.from(bucket).createSignedUrl(ref.object_path,90);
 if(signed.error||!signed.data?.signedUrl)throw Error("BACKUP_LINK_UNAVAILABLE");
 return {url:signed.data.signedUrl,expires_in_seconds:90};
}
async function changeFlag(userId:string,key:string,enabled:boolean,reason:string){
 if(!["checkout_enabled","deposits_enabled","merchant_enabled"].includes(key))throw Error("INVALID_FLAG");
 if(typeof enabled!=="boolean"||reason.length<8||reason.length>240)throw Error("REASON_REQUIRED");
 const payload:any={[key]:enabled,updated_at:new Date().toISOString(),updated_by:userId};
 const result=await db.from("f90_ops_flags").update(payload).eq("id",1).select("*").single();
 if(result.error)throw Error("CONTROL_CHANGE_FAILED");
 await db.from("f90_audit").insert({actor_id:userId,action:"ops.toggle",target_id:userId,details:{key,enabled,reason}});
 return {updated:true,flags:result.data};
}
async function suspend(userId:string,targetId:string,mode:string,reason:string){
 if(!uidRe.test(targetId)||targetId===userId)throw Error("INVALID_TARGET");
 const target=await db.from("f90_user_roles").select("role").eq("user_id",targetId).single();
 if(target.error||!["customer","trader"].includes(target.data.role))throw Error("PROTECTED_ACCOUNT");
 if(!["hour","day","week","month","permanent","restore"].includes(mode))throw Error("INVALID_DURATION");
 if(mode!=="restore"&&(reason.length<8||reason.length>240))throw Error("REASON_REQUIRED");
 const hrs:{[k:string]:number}={hour:1,day:24,week:168,month:720};
 const status=mode==="restore"?"active":mode==="permanent"?"banned":"suspended";
 const expires=hrs[mode]?new Date(Date.now()+hrs[mode]*3600000).toISOString():null;
 const ch=await db.rpc("f90_change_user",{p_actor:userId,p_user:targetId,p_role:null,p_status:status,p_vip:null,p_clear_vip:false});
 if(ch.error)throw Error("ACCOUNT_STATUS_FAILED");
 const upd=await db.from("profiles").update({suspended_until:expires}).eq("id",targetId);
 if(upd.error)throw Error("SUSPENSION_EXPIRY_FAILED");
 await db.from("f90_audit").insert({actor_id:userId,action:"ops.moderate",target_id:targetId,details:{mode,expires,reason}});
 return {ok:true,status,until:expires};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return json(req,200,{ok:true});
 if(req.method!=="POST")return json(req,405,{error:"METHOD_NOT_ALLOWED"});
 if(Number(req.headers.get("content-length")||"0")>8192)return json(req,413,{error:"PAYLOAD_TOO_LARGE"});
 try{
  const actor=await loggedIn(req);
  let b:any;try{b=await req.json()}catch{throw Error("INVALID_BODY")}
  const action=String(b?.action||"");
  const read=["overview","api_lab","profits","backup.list","backup.verify"].includes(action);
  if(!read&&(!actor.mfa||!actor.verified))throw Error("MFA_REQUIRED");
  let out:any;
  if(action==="overview")out=await health();
  else if(action==="api_lab")out=await merchantLab();
  else if(action==="profits")out=await profit([7,30,90,365].includes(Number(b.days))?Number(b.days):30);
  else if(action==="backup.list")out=await listBackups();
  else if(action==="backup.create")out=await createBackup(actor.id);
  else if(action==="backup.verify")out=await verifyBackup(String(b.id||""));
  else if(action==="backup.link")out=await backupLink(String(b.id||""));
  else if(action==="toggle")out=await changeFlag(actor.id,String(b.key||""),b.enabled,String(b.reason||"").trim());
  else if(action==="suspend")out=await suspend(actor.id,String(b.user_id||""),String(b.mode||""),String(b.reason||"").trim());
  else throw Error("UNKNOWN_ACTION");
  return json(req,200,{data:out});
 }catch(err){
  const message=err instanceof Error?err.message:"FAILED";
  console.error("F90 operations center",message.slice(0,150));
  const code=message.split(":")[0];
  return json(req,["AUTH_REQUIRED","MANAGER_ONLY","MFA_REQUIRED","PROTECTED_ACCOUNT"].includes(code)?403:400,
   {error:{code,message:({"AUTH_REQUIRED":"جلسة دخول غير صالحة","MANAGER_ONLY":"هذه الصفحة للمدير فقط","MFA_REQUIRED":"فعّل المصادقة الثنائية وتحقق منها أولًا","REASON_REQUIRED":"اذكر سببًا واضحًا من 8 أحرف على الأقل"} as Record<string,string>)[code]||"تعذّر تنفيذ الطلب بأمان"}});
 }
});