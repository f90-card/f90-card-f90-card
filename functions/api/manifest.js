// Cloudflare Pages Functions replacement for Vercel api/manifest.js.
// Uses only the public Supabase key; no service role access and no financial endpoints.
const API_URL = "https://ogkipkavlywgwhtomoca.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_hhEc0Rw4r_V-sLpC82KLdw_mcoWNSec";
const headers = {
  "content-type": "application/manifest+json; charset=utf-8",
  "cache-control": "public, max-age=60",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
};
export async function onRequestGet() {
  const fallback={
    id:"/",name:"F90 CARD",short_name:"F90 CARD",lang:"ar",dir:"rtl",
    start_url:"/index.html#/",scope:"/",display:"standalone",
    background_color:"#090b10",theme_color:"#fa2444",
    icons:[{src:"/assets/icons/icon-192.png",sizes:"192x192",type:"image/png"},
           {src:"/assets/icons/icon-512.png",sizes:"512x512",type:"image/png"}]
  };
  try {
    const response=await fetch(API_URL+"/rest/v1/site_settings?id=eq.1&select=store_name,logo_url,primary_color,config",{
      headers:{apikey:PUBLISHABLE_KEY,authorization:"Bearer "+PUBLISHABLE_KEY},
      signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)throw Error("Settings unavailable");
    const [settings]=await response.json();
    if(!settings)throw Error("Missing settings");
    const candidate=settings.config?.app_icon_url||settings.logo_url||"/f90-logo.png";
    const icon=typeof candidate==="string" && (/^\/(?!\/)/.test(candidate)||/^https:\/\//.test(candidate)) ? candidate:"/f90-logo.png";
    const cleanIcon=/\.(png|jpg|jpeg|webp)(\?|$)/i.test(icon) ? icon:"/f90-logo.png";
    const manifest={...fallback,name:settings.store_name||fallback.name,short_name:settings.store_name||fallback.short_name,
      theme_color:settings.primary_color||fallback.theme_color,
      icons:[{src:cleanIcon,sizes:"any",purpose:"any"}]};
    return new Response(JSON.stringify(manifest),{status:200,headers});
  } catch {
    return new Response(JSON.stringify(fallback),{status:200,headers});
  }
}
