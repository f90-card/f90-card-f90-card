// F90 CARD official HTTPS merchant API gateway.
// Keep merchant tokens server-side. No credentials are embedded in this gateway.
const upstream="https://ogkipkavlywgwhtomoca.supabase.co/functions/v1/f90-platform";
const json=(status,code,message)=>new Response(JSON.stringify({error:{code,message}}),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
export async function onRequestPost({request}){
  const token=request.headers.get("x-f90-key")||"";
  if(!/^[\x21-\x7e]{12,512}$/.test(token))return json(401,"F90_AUTH","مفتاح الربط مفقود أو غير صالح");
  if(Number(request.headers.get("content-length")||0)>65536)return json(413,"F90_FIELDS","طلب كبير جدًا");
  let raw;
  try{raw=await request.text();if(raw.length>65536)throw Error("size");const body=JSON.parse(raw);if(!body||typeof body!=="object"||Array.isArray(body)||typeof body.action!=="string")throw Error("fields");}
  catch{return json(400,"F90_FIELDS","صيغة الطلب غير صالحة");}
  try{
    const response=await fetch(upstream,{method:"POST",headers:{"Content-Type":"application/json","x-f90-key":token},body:raw,redirect:"manual",signal:AbortSignal.timeout(50000)});
    return new Response(response.body,{status:response.status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }catch{return json(502,"F90_UPSTREAM","تعذّر الاتصال بالخادم. تحقّق من حالة الطلب قبل تكراره");}
}
export function onRequestGet(){return json(405,"F90_METHOD","استخدم HTTPS POST مع JSON");}
