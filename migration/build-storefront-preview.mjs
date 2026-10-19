// Build a READ-ONLY storefront preview for Cloudflare Pages.
// Never deploy this preview directory on www.f90card.online.
// Remove development files, financial API functions and unnecessary marketing images.
import { readdir, readFile, stat, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve,relative,dirname,extname,sep } from 'node:path';

const root=resolve('.');
const dest=resolve('dist-f90-storefront-preview');
const denyDirs=new Set(['.git','.github','node_modules','migration','marketing','supabase','tests','scripts','docs','api','dist-f90-media','dist-f90-storefront-preview']);
const allowDirs=new Set(['assets','public','discover']);
const extAllow=new Set(['.html','.css','.js','.png','.jpeg','.jpg','.gif','.webp','.avif','.svg','.webmanifest','.json','.ico','.xml','.txt','.woff','.woff2']);
const oldUrl='https://xzqnrpycjxfbyrfaolud.supabase.co';
const newUrl='https://ogkipkavlywgwhtomoca.supabase.co';
const publicKey="sb_publishable_hhEc0Rw4r_V-sLpC82KLdw_mcoWNSec";
if(!publicKey.startsWith('sb_publishable_'))throw Error('Staging key missing');

// Stage-only runtime guard: abort the build if public settings are accidentally
// pointed to the real payment backend. Never let test pages become a writable shop.
if(oldUrl===newUrl || !newUrl.includes('ogkipkavlywgwhtomoca.supabase.co')) {
  throw Error('Refusing unsafe preview target');
}

const protectiveMarkup = "<meta name=\"robots\" content=\"noindex,nofollow,noarchive\">\n<style id=\"f90-staging-shield\">\nbody{scroll-behavior:smooth}\nhtml::after{content:\"معاينة F90 CARD | تصفح الأقسام متاح، الشراء وتسجيل الدخول والإيداع معطّلان\";position:fixed;z-index:2147483647;top:0;left:0;right:0;padding:13px 12px;background:#991b1b;color:white;text-align:center;direction:rtl;font:700 13px system-ui,Arial,sans-serif;box-shadow:0 6px 24px #0008;pointer-events:none}\n</style>";
let copied=0,byteCount=0;
async function copyTree(src, relativePath='') {
  const entries=await readdir(src,{withFileTypes:true});
  for (const entry of entries) {
    if(entry.isSymbolicLink())throw Error('Refusing symbolic link in staged build');
    const rel=relativePath?relativePath+'/'+entry.name:entry.name;
    const origin=resolve(root,rel);
    if(!origin.startsWith(root+sep))throw Error('Unsafe path');
    if(entry.isDirectory()){
      if(!relativePath&&!allowDirs.has(entry.name))continue;
      if(denyDirs.has(entry.name))continue;
      await copyTree(origin,rel);
      continue;
    }
    if(!entry.isFile())continue;
    if(!extAllow.has(extname(entry.name).toLowerCase()))continue;
    if(rel==='config.js'||rel==='sw.js'||rel.endsWith('.map'))continue;
    const info=await stat(origin);
    if(info.size>25*1024*1024)throw Error('Oversized asset: '+rel);
    const target=resolve(dest,rel);
    if(!target.startsWith(dest+sep))throw Error('Unexpected output path');
    await mkdir(dirname(target),{recursive:true});
    const ext=extname(entry.name).toLowerCase();
    if(['.html','.css','.js','.json','.webmanifest','.xml','.txt'].includes(ext)){
      let content=await readFile(origin,'utf8');
      content=content.split(oldUrl).join(newUrl);
      if(ext==='.html'){
        // The live index advertises index,follow. Strip it so the staging
        // domain never inherits production SEO directives.
        content=content.replace(/<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/gi,'');
        content=content.replace(/<head>/i,'<head>\n<meta name="robots" content="noindex,nofollow,noarchive"/>');
        if(['index.html','admin.html'].includes(rel)){
          content=content.replace('</head>',protectiveMarkup+(rel==='admin.html'?'\n<style id="f90-admin-preview-lock">body{pointer-events:none!important;user-select:none!important}</style>':'')+'\n</head>');
        }
      }
      if(ext==='.js'&&rel==='api.js'){
        const callMarker='async function call(action, data = {}) {';
        const uploadMarker='async function upload(file, bucket, folder, onProgress) {';
        if(!content.includes(callMarker)||!content.includes(uploadMarker))throw Error('F90 stage API safety anchor missing');
        content=content.replace(callMarker,callMarker+'\n    if(!new Set(["health","catalog","quote","media.state","me","balance","categories","services","service","recipients.list"]).has(String(action))) {const error=new Error("هذه النسخة للعرض فقط. الشراء والإيداع والتعديل معطّلون.");error.code="F90_MIGRATION_READONLY";throw error;}');
        content=content.replace(uploadMarker,uploadMarker+'\n    throw new Error("رفع الصور والملفات غير متاح في معاينة النقل.");');
      }
      await writeFile(target,content);
    }else await copyFile(origin,target);
    copied++;byteCount+=info.size;
  }
}
await mkdir(dest,{recursive:true});
await copyTree(root);
const cfg='(function(){ "use strict";const u='+JSON.stringify('https://ogkipkavlywgwhtomoca.supabase.co')+';const k='+JSON.stringify(publicKey)+';window.F90_CONFIG={SUPABASE_URL:u,SUPABASE_KEY:k};window.F90_READ_ONLY_PREVIEW=true;try{window.f90Supabase=window.supabase?.createClient?.(u,k,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})||null}catch{window.f90Supabase=null}try{const auth=window.f90Supabase?.auth;if(auth){const blocked=async()=>({data:null,error:new Error("الرجاء استخدام صفحة Google التجريبية المنفصلة. لا يُسمح بتسجيل الدخول من معاينة المتجر.")});for(const method of ["signInWithOAuth","signInWithPassword","signUp","resetPasswordForEmail","verifyOtp","updateUser"])auth[method]=blocked;}}catch{}})();';
await writeFile(resolve(dest,'config.js'),cfg);
await writeFile(resolve(dest,'manifest.webmanifest'),JSON.stringify({name:'F90 CARD Read Only Preview',short_name:'F90 preview',start_url:'/',display:'browser',icons:[]}));
await writeFile(resolve(dest,'_headers'),"/*\n  X-Robots-Tag: noindex, nofollow\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/config.js\n  Cache-Control: no-store\n/*.html\n  Cache-Control: no-store\n");
await writeFile(resolve(dest,'_redirects'),'/discover/games.html /discover/ 301\n');
console.log('F90_STAGING_READ_ONLY '+JSON.stringify({copied,megabytes:+(byteCount/1048576).toFixed(2),target:'new-supabase',actions:'disabled'}));
