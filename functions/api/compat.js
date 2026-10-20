// F90 API Token GET compatibility. Read-only endpoints never execute purchases.
const upstream="https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-platform";
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"api-token,x-f90-key,content-type","Access-Control-Allow-Methods":"GET,OPTIONS"};
const respond=(status,value)=>new Response(JSON.stringify(value),{status,headers});
const fail=(status,code,message)=>respond(status,{status:"error",error:{code,message}});
const actions=new Set(["products","profile","check","categories","services","balance","service","status","quote"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeUrl(url){
  return !["key","token","api_key","apikey","x-f90-key","api-token","authorization","secret"].some(k=>url.searchParams.has(k));
}
async function readUpstream(token,payload){
  const r=await fetch(upstream,{method:"POST",headers:{"Content-Type":"application/json","x-f90-key":token},
    body:JSON.stringify(payload),redirect:"manual",signal:AbortSignal.timeout(30000)});
  if(r.status>=300&&r.status<400)throw Error("redirect");
  const raw=await r.text();
  if(raw.length>15000000)throw Error("large");
  let value;
  try{value=JSON.parse(raw);}catch{throw Error("json");}
  return {status:r.status,value};
}
async function single(token,payload){
  const r=await readUpstream(token,payload);
  if(!r.value||typeof r.value!=="object")throw Error("response");
  if(!r.status||r.status<200||r.status>=300||r.value.error)return r;
  if(!Object.prototype.hasOwnProperty.call(r.value,"data"))throw Error("contract");
  return r;
}
export async function onRequestGetCompat({request},subpath=""){
  const url=new URL(request.url);
  if(!safeUrl(url))return fail(400,"F90_AUTH","المفاتيح يجب أن تُرسل في ترويسة api-token فقط، وليس داخل الرابط");
  const qaction=String(url.searchParams.get("action")||"").trim().toLowerCase();
  const path=String(subpath||"").replace(/^\/+|\/+$/g,"").toLowerCase();
  const selected=path||qaction;
  if(!actions.has(selected))return fail(405,"F90_METHOD","استخدم GET للمنتجات والرصيد وحالة الطلب فقط. الشراء يتطلب POST.");
  const apiToken=(request.headers.get("api-token")||"").trim();
  const xKey=(request.headers.get("x-f90-key")||"").trim();
  if(apiToken&&xKey&&apiToken!==xKey)return fail(400,"F90_AUTH","أرسل مفتاحًا واحدًا فقط");
  const token=apiToken||xKey;
  if(!/^f90_live_[a-f0-9]{64}$/i.test(token))return fail(401,"F90_AUTH","مفتاح F90 غير صالح أو مفقود");
  try{
    if(selected==="products"||selected==="services"){
      const [services,categories]=await Promise.all([
        single(token,{action:"services"}),single(token,{action:"categories"})]);
      for(const r of [services,categories])if(r.status!==200)return respond(r.status,r.value);
      if(!Array.isArray(services.value.data)||!Array.isArray(categories.value.data))throw Error("catalog");
      const names=new Map(categories.value.data.map(c=>[c.id,c.name]));
      const items=services.value.data.map(p=>({...p,category_name:names.get(p.category)||p.category}));
      return selected==="products"?respond(200,{status:"OK",data:{products:items}}):respond(200,{data:items});
    }
    if(selected==="profile"||selected==="balance"){
      const r=await single(token,{action:"balance"});
      return selected==="profile"&&r.status===200
        ?respond(200,{status:"OK",data:r.value.data}):respond(r.status,r.value);
    }
    if(selected==="categories"){
      const r=await single(token,{action:"categories"});
      return respond(r.status,r.value);
    }
    if(selected==="service"){
      const id=url.searchParams.get("service")||url.searchParams.get("id")||"";
      if(!uuid.test(id))return fail(400,"F90_FIELDS","معرّف الخدمة غير صالح");
      const r=await single(token,{action:"service",service:id});
      return respond(r.status,r.value);
    }
    if(selected==="quote"){
      const id=url.searchParams.get("product_id")||"";
      const qty=Number(url.searchParams.get("quantity"));
      if(!uuid.test(id)||!Number.isSafeInteger(qty)||qty<1)return fail(400,"F90_FIELDS","معرّف الخدمة أو الكمية غير صالح");
      const r=await single(token,{action:"quote",product_id:id,quantity:qty});
      return respond(r.status,r.value);
    }
    let order="";
    if(selected==="check"){
      const raw=url.searchParams.get("orders")||"";
      let ids;
      try{ids=JSON.parse(raw)}catch{return fail(400,"F90_FIELDS","استخدم orders كمصفوفة JSON تحتوي رقم طلب واحد");}
      if(!Array.isArray(ids)||ids.length!==1||!uuid.test(ids[0]))return fail(400,"F90_FIELDS","رقم طلب واحد صالح مطلوب");
      order=ids[0];
    }else{
      order=url.searchParams.get("order")||"";
      if(!uuid.test(order))return fail(400,"F90_FIELDS","معرّف الطلب غير صالح");
    }
    const r=await single(token,{action:"status",order});
    if(selected==="check"&&r.status===200){
      const obj=r.value.data?.order;
      return obj?.id
        ?respond(200,{status:"OK",data:[{order_id:obj.id,status:obj.status,order:obj.id}]})
        :fail(502,"F90_UPSTREAM","حالة الطلب غير واضحة");
    }
    return respond(r.status,r.value);
  }catch{
    return fail(502,"F90_UPSTREAM","تعذّر إكمال فحص API؛ لم يتم تنفيذ أي عملية شراء");
  }
}
export const onRequestOptionsCompat=()=>new Response(null,{status:204,headers});
