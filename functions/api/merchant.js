// F90 CARD merchant API gateway. The merchant's secret stays in their trusted backend.
const upstream="https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-platform";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, X-F90-Key, api-token, Authorization","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Max-Age":"86400","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const respond=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
const error=(status,code,message)=>respond(status,{error:{code,message}});
export const onRequestOptions=()=>new Response(null,{status:204,headers:cors});
export const onRequestGet=()=>respond(200,{name:"F90 CARD Merchant API",status:"ready",method:"POST",endpoint:"https://www.f90card.online/api/merchant",authentication:"x-f90-key: YOUR_TOKEN",actions:["categories","services","service","balance","quote","checkout","status","history"],security:"Keep the API token on your store backend. GET never processes orders."});
export async function onRequestPost({request}){
  const supplied=request.headers.get("x-f90-key")?.trim()||"";
  const compat=request.headers.get("api-token")?.trim()||"";
  const bearer=(request.headers.get("Authorization")||"").match(/^Bearer\s+(f90_live_[a-f0-9]+)$/i)?.[1]||"";
  const values=[supplied,compat,bearer].filter(Boolean);
  if(new Set(values).size>1)return error(400,"F90_AUTH","أرسل مفتاحًا واحدًا فقط");
  const token=values[0]||"";
  if(!/^f90_live_[a-f0-9]{64}$/i.test(token))return error(401,"F90_AUTH","أرسل مفتاح F90 الحقيقي في api-token أو x-f90-key أو Authorization: Bearer");
  if(Number(request.headers.get("content-length")||0)>65536)return error(413,"F90_FIELDS","حجم الطلب كبير جدًا");
  let raw;
  try{
    raw=await request.text();
    if(raw.length>65536)throw new Error("too large");
    const body=JSON.parse(raw);
    if(!body||typeof body!=="object"||Array.isArray(body)||typeof body.action!=="string"||body.action.length>40)throw new Error("invalid");
  }catch{return error(400,"F90_FIELDS","أرسل JSON يحتوي على action");}
  try{
    const response=await fetch(upstream,{method:"POST",headers:{"Content-Type":"application/json","x-f90-key":token},body:raw,redirect:"manual",signal:AbortSignal.timeout(50000)});
    if(response.status>=300&&response.status<400)return error(502,"F90_UPSTREAM","الخادم أعاد تحويلًا غير متوقع");
    return new Response(response.body,{status:response.status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
  }catch{return error(502,"F90_UPSTREAM","تعذّر الحصول على رد من الخادم. تحقق من حالة الطلب قبل إعادة الدفع.");}
}
