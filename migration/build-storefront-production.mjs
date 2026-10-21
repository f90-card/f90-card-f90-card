// Reuse the existing storefront verbatim; never ship the preview shield.
// This builds an artifact only. It does not enable backend workers or alter DNS.
import {readdir,readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
const root=resolve('.'),dest=resolve('dist-f90-storefront-production');
const oldHost='xzqnrpycjxfbyrfaolud.supabase.co';
const newHost='ogkipkavlywgwhtomoca.supabase.co';
const key='sb_publishable_hhEc0Rw4r_V-sLpC82KLdw_mcoWNSec';
const mode=process.env.F90_BUILD_MODE||'acceptance';
if(!['acceptance','production'].includes(mode))throw Error('Invalid build mode');
// Production requires verified release approval. Pre-launch deferred acceptance expires after 15 minutes;
// after the owner confirms real purchase, deposit and Telegram, signed-off acceptance persists across deploys.
if(mode==='production'){
  const report=JSON.parse(await readFile(process.env.F90_RELEASE_REPORT||'migration/release-acceptance.json','utf8'));
  const required=['financialParity','privateStorageAccess','mediaIndependent','checkoutIdempotency','supplierSingleWriter','mailCutoffTest','authAcceptance','ownerCutoverApproved'];
  const age=Date.now()-Date.parse(report.verifiedAt);
  // Owner-deferred browser deposit acceptance is NOT a passing test. It is allowed
  // only while server-side financial writes are independently proven gated.
  const depositAccepted=report.depositAcceptance===true ||
    (report.depositAcceptance===false && report.ownerDeferredDepositTest===true && report.financialWritesGatedUntilTest===true);
  if(report.target!==newHost||!Number.isFinite(age)||age<0||((report.ownerConfirmedPurchaseDepositAndTelegram!==true||report.depositAcceptance!==true)&&age>15*60*1000)||required.some(k=>report[k]!==true)||!depositAccepted)
    throw Error('Production release gates incomplete or stale');
}
const allowedDirs=new Set(['assets','public','discover']);
const extensions=new Set(['.html','.css','.js','.png','.jpeg','.jpg','.gif','.webp','.avif','.svg','.webmanifest','.ico','.xml','.txt','.woff','.woff2','.ttf']);
const forbidden=new Set(['config.js','package.json','package-lock.json','vercel.json']);
await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});
let copied=0;
async function walk(rel=''){
 for(const entry of await readdir(resolve(root,rel),{withFileTypes:true})){
  const name=rel?rel+'/'+entry.name:entry.name;
  if(entry.isSymbolicLink())throw Error('Refusing symlink '+name);
  if(entry.isDirectory()){
   if(!rel&&!allowedDirs.has(entry.name))continue;
   await walk(name);continue;
  }
  if(!entry.isFile()||forbidden.has(name)||name.startsWith('f90-migration-')||!extensions.has(extname(name).toLowerCase()))continue;
  if(/(?:sources|README)/i.test(name))continue;
  const target=resolve(dest,name);if(!target.startsWith(dest+sep))throw Error('Invalid path');
  await mkdir(dirname(target),{recursive:true});
  if(['.js','.html','.css','.webmanifest','.xml','.txt'].includes(extname(name))){
   let body=await readFile(resolve(root,name),'utf8');
   // Storage URLs are not rewritten blindly: private paths retain their identity,
   // and public imagery must be reconciled separately in the target catalog.
   if(body.includes(oldHost+'/storage/'))throw Error('Unmigrated embedded storage URL in '+name);
   body=body.replaceAll(oldHost,newHost);
   if(name==='sw.js')body=body.replace('f90-static-v3-16','f90-static-cloudflare-v1')
    .replace('u.origin === "https://'+newHost+'"','u.origin === "https://f90-card-media.pages.dev"')
    .replace('u.pathname.startsWith("/storage/v1/object/public/f90-images/")','u.pathname.startsWith("/media/")');
   if(mode==='acceptance'){
    if(extname(name)==='.html'){
     body=body.replace(/<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/gi,'');
     body=body.replace('</head>','<meta name="robots" content="noindex,nofollow,noarchive"></head>');
    }
    if(['app.js','admin.js'].includes(name))body=body.replaceAll('"https://www.f90card.online/"','(window.location.origin+"/")');
   }
   await writeFile(target,body);
  }else await copyFile(resolve(root,name),target);
  copied++;
 }
}
await walk();
let config=await readFile('config.js','utf8');
config=config.replaceAll(oldHost,newHost);
config=config.replace(/const SUPABASE_PUBLISHABLE_KEY\s*=\s*"[^"]+";/,'const SUPABASE_PUBLISHABLE_KEY = '+JSON.stringify(key)+';');
if(!config.includes(key)||config.includes(oldHost))throw Error('Backend configuration failed');
await writeFile(resolve(dest,'config.js'),config);
// Public rescue catalog contains display metadata only, never cached prices.
const catalogResponse=await fetch('https://'+newHost+'/functions/v1/f90-platform',{
 method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},
 body:JSON.stringify({action:'catalog'}),signal:AbortSignal.timeout(30000)
});
if(!catalogResponse.ok)throw Error('Cannot obtain target public catalog');
const {data:catalog}=await catalogResponse.json();
if(!Array.isArray(catalog?.products)||catalog.products.length<100)throw Error('Incomplete target catalog');
const displayFields=['id','name','slug','image_url','category_id'];
const categoryFields=['id','name','slug','image_url','parent_id','sort_order'];
const rescue={products:catalog.products.map(p=>Object.fromEntries(displayFields.map(k=>[k,p[k]??null]))),
 categories:(catalog.categories||[]).map(p=>Object.fromEntries(categoryFields.map(k=>[k,p[k]??null]))),created_at:new Date().toISOString()};
const oldImageDependencies=[...rescue.products,...rescue.categories].filter(p=>String(p.image_url).includes(oldHost)).length;
if(mode==='production'&&oldImageDependencies)throw Error('Target rescue catalog still depends on old storage');
await writeFile(resolve(dest,'f90-catalog-rescue.json'),JSON.stringify(rescue));
if(mode==='acceptance'){
  const quality={
    mode:'acceptance',
    target:newHost,
    checkoutTested:false,
    depositTested:false,
    supplierSingleWriter:false,
    financialReconciled:false,
    cutoverAuthorized:false,
    legacyProductOrCategoryImageDependencies:oldImageDependencies,
    productionReady:false
  };
  await writeFile(resolve(dest,'f90-release-gates.json'),JSON.stringify(quality));
}

const headers='/*\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n'+(mode==='acceptance'?'  X-Robots-Tag: noindex, nofollow, noarchive\n':'')+'/config.js\n  Cache-Control: no-store\n/sw.js\n  Cache-Control: no-cache\n/\n  Cache-Control: no-cache, must-revalidate\n/index.html\n  Cache-Control: no-cache, must-revalidate\n/app.js\n  Cache-Control: no-cache, must-revalidate\n/f90-finance-pages-20261021.css\n  Cache-Control: no-cache, must-revalidate\n/*.html\n  Cache-Control: no-cache, must-revalidate\n';
await writeFile(resolve(dest,'_headers'),headers);
await writeFile(resolve(dest,'_redirects'),'/discover/games.html /discover/ 301\n/index.html / 301\n');
// Pages Functions live outside the static output; Cloudflare bundles functions/.
console.log(JSON.stringify({mode,copied,backend:newHost,output:dest,oldImageDependencies,backendActivation:false,dnsChanged:false}));
