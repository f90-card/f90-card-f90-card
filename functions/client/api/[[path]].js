import {onRequestGetCompat,onRequestOptionsCompat} from "../../api/compat.js";
export async function onRequest(context){
  const method=context.request.method;
  if(method==="OPTIONS")return onRequestOptionsCompat();
  if(method!=="GET")return new Response(JSON.stringify({error:{code:"F90_METHOD",message:"الشراء عبر POST /api/v1 فقط"}}),{status:405,headers:{"Content-Type":"application/json","Allow":"GET, OPTIONS","Cache-Control":"no-store"}});
  const pathname=new URL(context.request.url).pathname;
  const action=pathname.startsWith("/client/api/")?pathname.slice("/client/api/".length).split("/")[0]:"";
  return onRequestGetCompat(context,action);
}
