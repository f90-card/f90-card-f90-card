import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const root=resolve('dist-f90-media');
const manifest=JSON.parse(await readFile('migration/authentic-originals-20261020.json','utf8'));
if(manifest.version!==1||manifest.assets.length>150)throw Error('Invalid authentic image manifest');
const approved=/^(?:play-lh\.googleusercontent\.com|lh3\.googleusercontent\.com|is\d+-ssl\.mzstatic\.com|store\.storeimages\.cdn-apple\.com|tether\.to|www\.jopacc\.com|www\.mastercard\.com|upload\.wikimedia\.org|flagcdn\.com|www\.f90card\.online)$/;
const assets=[],skipped=[];
let cursor=0;
await Promise.all(Array.from({length:6},async()=>{
 while(cursor<manifest.assets.length){
  const e=manifest.assets[cursor++];
  try{
   if(e.local_file && e.local_file!=='assets/originals/vodafone-official.svg')throw Error('Unapproved local image');
   const u=e.local_file?null:new URL(e.url);
   if((u&&(u.protocol!=='https:'||!approved.test(u.hostname)))||! /^[a-f0-9-]{36}$/.test(e.id))throw Error('Unapproved image source');
   const local=e.local_file?await readFile(e.local_file):null;
   const r=local?new Response(local,{headers:{'content-type':'image/svg+xml'}}):await fetch(u,{signal:AbortSignal.timeout(25000)});
   if(!r.ok)throw Error('Source returned '+r.status);
   const mime=(r.headers.get('content-type')||'').split(';')[0];
   const ext=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/avif':'avif','image/gif':'gif','image/svg+xml':'svg'})[mime];
   if(!ext)throw Error('Unexpected MIME '+mime);
   const b=Buffer.from(await r.arrayBuffer());
   if(b.length<200||b.length>5*1024*1024)throw Error('Unexpected size');
   const digest=createHash('sha256').update(b).digest('hex').slice(0,16);
   const path='/media/official/product/'+e.id+'-'+digest+'.'+ext;
   await mkdir(dirname(resolve(root,path.slice(1))),{recursive:true});
   await writeFile(resolve(root,path.slice(1)),b);
   assets.push({...e,path,bytes:b.length,kind:'product',name:e.key,source:'verified-original-20261020'});
  }catch(err){skipped.push({key:e.key,reason:String(err.message)});}
 }
}));
const index=JSON.parse(await readFile(resolve(root,'official-index.json'),'utf8'));
const paths=new Set([...index.assets,...(index.legacy_assets||[])].map(x=>x.path));
index.legacy_assets||=[];
for(const a of assets)if(!paths.has(a.path)){index.legacy_assets.push({kind:'product',id:a.id,name:a.key,path:a.path,bytes:a.bytes,source:a.source});paths.add(a.path);}
index.retained=index.legacy_assets.length;
await writeFile(resolve(root,'official-index.json'),JSON.stringify(index,null,2));
await writeFile(resolve(root,'authentic-index-20261020.json'),JSON.stringify({version:1,assets,skipped},null,2));
console.log('F90_AUTHENTIC_IMAGES '+JSON.stringify({verified:assets.length,skipped}));
