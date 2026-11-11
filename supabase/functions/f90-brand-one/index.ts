import { createClient } from "npm:@supabase/supabase-js@2.117.3";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{persistSession:false}});
const headers = {"Content-Type":"application/json","Cache-Control":"no-store"};
Deno.serve(async req => {
 try {
  const token=req.headers.get("x-f90-worker")||"";
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,"0")).join("");
  const auth=await db.rpc("f90_worker_authorized",{p_hash:hash});
  if(!token||auth.error||!auth.data)return new Response('{}',{status:403,headers});
  const b=await req.json();
  const p=await db.from("f90_providers").select("*").eq("endpoint","https://api.brand-one-card.com").single();
  if(p.error)throw Error(p.error.message);
  const secret=await db.rpc("f90_provider_secret",{p_actor:null,p_provider:p.data.id});
  if(secret.error||!secret.data)throw Error("Missing supplier credential");
  async function read(path:string){
   const response=await fetch("https://api.brand-one-card.com/client/api/"+path,{headers:{"api-token":secret.data,"Accept":"application/json"},redirect:"error",signal:AbortSignal.timeout(30000)});
   const data=await response.json();
   if(!response.ok||String(data?.status||"").toUpperCase()==="ERROR")throw Error("Supplier refused: "+JSON.stringify({status:response.status,code:data.code,msg:data.msg}));
   return data;
  }
  if(b.action==="tree") {
   let state=(await db.rpc("f90_brand_stage",{})).data;
   const ids=state.pending.slice(0,35);
   for(let n=0;n<ids.length;n+=10){
    const rows=await Promise.all(ids.slice(n,n+10).map(async (id:string)=>({id,data:await read("content/"+id)})));
    const saved=await db.rpc("f90_brand_stage",{p_categories:rows.flatMap(r=>r.data.categories||[]),p_fetched:rows.map(r=>r.id)});
    if(saved.error)throw Error(saved.error.message);
    state=saved.data;
   }
   return new Response(JSON.stringify(state),{headers});
  }
  const profile=await read("profile");
  if(b.action==="sync") {
   if(profile.currency!=="USD")throw Error("Supplier account currency changed; sync stopped");
   const products=await read("products");
   if(!Array.isArray(products)||!products.length||new Set(products.map(x=>String(x.id))).size!==products.length)throw Error("Invalid supplier catalog");
   const staged=await db.rpc("f90_brand_stage",{p_products:products});
   if(staged.error)throw Error(staged.error.message);
   const applied=await db.rpc("f90_brand_apply",{});
   if(applied.error)throw Error(applied.error.message);
   return new Response(JSON.stringify(applied.data),{headers});
  }
  if(b.action==="audit") {
   const products=await read("products");
   const content=await read("content/0");
   return new Response(JSON.stringify({currency:profile.currency,products,content}),{headers});
  }
  return new Response('{}',{status:400,headers});
 } catch(e) {
  await db.from("f90_providers").update({config: await (async()=>{const r=await db.from("f90_providers").select("config").eq("adapter","brand_one").single();return {...r.data?.config,sync_state:"error",sync_error:String(e.message||e).slice(0,240)};})()}).eq("adapter","brand_one");
  return new Response(JSON.stringify({error:String(e.message||e)}),{status:502,headers}); }
});
