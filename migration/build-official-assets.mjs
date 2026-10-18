/**
 * F90 official media build. Copies ONLY site banners and store-approved official
 * Google Play / Apple App Store artwork, never private documents or user media.
 * Does not need tokens, secret keys or local downloads.
 * Changes to image sources remain a manual Git commit plus deployment.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';

const direct = JSON.parse(await readFile('migration/official-assets-manifest.json','utf8'));
const looked = JSON.parse(await readFile('migration/verified-app-searches.json','utf8'));
if (direct.version!==1 || looked.version!==1 || direct.assets.length>300 || looked.lookups.length>300) {
  throw Error('Unexpected media manifest');
}
const root = resolve('dist-f90-media');
await mkdir(root,{recursive:true});
const seen = new Set();
const successes=[];
const skipped=[];
const officialHost=/^(?:play-lh\.googleusercontent\.com|lh3\.googleusercontent\.com|is\d+-ssl\.mzstatic\.com)$/;
const bannerPrefix='https://xzqnrpycjxfbyrfaolud.supabase.co/storage/v1/object/public/f90-images/banner/';
const hostAllowed=(entry,url)=>{
  try {
    const u=new URL(url);
    if(u.protocol!=='https:') return false;
    if(entry.kind==='banner') return u.href.startsWith(bannerPrefix);
    return officialHost.test(u.hostname);
  } catch {return false;}
};
const norm=(s)=>String(s||'').toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const validTitle=(got,accepted)=>{
  const g=norm(got);
  return accepted.some(t=>{
    const v=norm(t);
    return v.length>=3 && (g===v || g.startsWith(v+' ') && g.length-v.length<=35);
  });
};
function sanitize(e) {
  if(!['product','category','banner'].includes(e.kind) ||
     !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(e.id)) throw Error('Invalid asset metadata');
  return e;
}
for(const e of direct.assets) {
  sanitize(e);
  if(!hostAllowed(e,e.url)) throw Error('Unapproved direct image source');
}
const queue=direct.assets.map(e=>({...e,source:'approved-catalog',url:e.url}));
const itunesCache=new Map();
const searches=[...new Map(looked.lookups
  .filter(e=>!direct.assets.some(d=>d.kind===e.kind && d.id===e.id))
  .map(e=>[e.kind+':'+e.id,e])).values()];
async function discoverApple(e) {
  sanitize(e);
  if(!['product','category'].includes(e.kind)||
     !Array.isArray(e.acceptedNames)||!e.acceptedNames.length ||
     !/^[a-z0-9 :_.-]{2,80}$/i.test(e.searchTerm)) return null;
  const key=e.searchTerm;
  if(!itunesCache.has(key)){
    itunesCache.set(key,(async()=>{
      for(const country of ['us','sa']) {
        try {
          const search='https://itunes.apple.com/search?'+new URLSearchParams({
            term:key,country,entity:'software',limit:'30'
          });
          const res=await fetch(search,{signal:AbortSignal.timeout(18000)});
          if(!res.ok) continue;
          const data=await res.json();
          const entries=Array.isArray(data.results)?data.results:[];
          const good=entries.filter(x=>typeof x.trackName==='string' && typeof x.artworkUrl512==='string');
          if(good.length) return good;
        } catch {}
      }
      return [];
    })());
  }
  const results=await itunesCache.get(key);
  const matching=results.filter(x=>validTitle(x.trackName,e.acceptedNames) &&
     hostAllowed(e,x.artworkUrl512));
  if(matching.length!==1) return null;
  return { ...e,source:'apple-app-store',source_title:matching[0].trackName,
    url:matching[0].artworkUrl512 };
}
let cursor=0;
await Promise.all(Array.from({length:3},async()=>{
  while(cursor<searches.length){
    const e=searches[cursor++];
    const found=await discoverApple(e);
    if(found)queue.push(found);
    else skipped.push({kind:e.kind,id:e.id,name:e.name,reason:'No unique verified App Store match'});
  }
}));
const byId = new Set();
const unique=queue.filter(e=>{
  const key=e.kind+':'+e.id;
  if(byId.has(key))return false;
  byId.add(key);
  return true;
});
let next=0;
async function processImage(e) {
  let lastErr;
  for(let retry=0;retry<2;retry++){
    try {
      if(!hostAllowed(e,e.url))throw Error('Host not approved');
      const res=await fetch(e.url,{signal:AbortSignal.timeout(26000),
        headers:{Accept:'image/png,image/webp,image/jpeg,image/avif,image/gif'}});
      if(!res.ok)throw Error('source status '+res.status);
      const mime=(res.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      const ext=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp',
        'image/avif':'avif','image/gif':'gif'})[mime];
      if(!ext)throw Error('not a supported image');
      const blob=Buffer.from(await res.arrayBuffer());
      if(blob.length<200||blob.length>5*1024*1024) throw Error('unexpected image length');
      const digest=createHash('sha256').update(blob).digest('hex').slice(0,16);
      const relative='media/official/'+e.kind+'/'+e.id+'-'+digest+'.'+ext;
      const target=resolve(root,relative);
      if(!target.startsWith(root+sep))throw Error('unsafe target file');
      await mkdir(dirname(target),{recursive:true});
      await writeFile(target,blob);
      successes.push({kind:e.kind,id:e.id,name:e.name,
        path:'/'+relative,bytes:blob.length,source:e.source,source_title:e.source_title||null});
      return;
    }catch(err){lastErr=err;}
  }
  skipped.push({kind:e.kind,id:e.id,name:e.name,reason:String(lastErr?.message||'Image unavailable')});
}
await Promise.all(Array.from({length:6},async()=>{
  while(next<unique.length){const e=unique[next++];await processImage(e);}
}));
if(successes.length<30)throw Error('Refusing to deploy incomplete official media ('+successes.length+')');
successes.sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
const summary={verified:successes.length,unresolved:skipped.length,
  by_kind:Object.fromEntries(['banner','category','product'].map(k=>[k,successes.filter(x=>x.kind===k).length])),
  total_mib:+(successes.reduce((s,x)=>s+x.bytes,0)/1048576).toFixed(2)};
const payload={schema:1,...summary,assets:successes,skipped};
await writeFile(resolve(root,'official-index.json'),JSON.stringify(payload,null,2));
await writeFile(resolve(root,'index.html'),
  '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>F90 CARD media</title><body><h1>F90 CARD</h1><p>أصول الصور العامة فقط</p></body></html>');
await writeFile(resolve(root,'_headers'),'/media/*\n  Cache-Control: public, max-age=31536000, immutable\n  X-Content-Type-Options: nosniff\n/official-index.json\n  Cache-Control: public, max-age=300\n');
console.log('F90_OFFICIAL_MEDIA_RESULT '+JSON.stringify(summary));
