// Versioned alias; the existing merchant gateway remains backward compatible.
import { onRequestGet, onRequestPost, onRequestOptions } from "./merchant.js";
import { onRequestGetCompat } from "./compat.js";

const canonical = "https://www.f90card.online/api/v1";
export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  // Credentials belong in headers, never in URLs (including health requests).
  if (["key", "token", "api_key", "x-f90-key", "api-token"].some(name => url.searchParams.has(name))) {
    return new Response(JSON.stringify({error:{code:"F90_AUTH",message:"أرسل المفتاح في ترويسة x-f90-key فقط، ولا تضعه في الرابط"}}), {
      status:400, headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
    });
  }
  if (request.method === "OPTIONS") return onRequestOptions(context);
  if (request.method === "POST") return onRequestPost(context);
  if (request.method === "GET" && url.searchParams.has("action")) return onRequestGetCompat(context);
  const health = onRequestGet(context);
  if (request.method === "GET") {
    const data = await health.json();
    return new Response(JSON.stringify({...data,endpoint:canonical,legacy_endpoint:"https://www.f90card.online/api/merchant"}), {
      status:health.status,headers:health.headers
    });
  }
  return new Response(JSON.stringify({error:{code:"F90_METHOD",message:"الطرق المدعومة هي GET وPOST وOPTIONS"}}), {
    status:405,headers:{...Object.fromEntries(health.headers),"Allow":"GET, POST, OPTIONS"}
  });
}
