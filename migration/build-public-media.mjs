// Builds a media-only Cloudflare Pages deployment. No customer data or credentials.
// Source bucket is public already; private buckets are intentionally excluded.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep, join } from 'node:path';

const origin = 'https://xzqnrpycjxfbyrfaolud.supabase.co/storage/v1/object/public/f90-images/';
const entries = JSON.parse(await readFile('migration/public-media-manifest.json', 'utf8'));
if (entries.source_project !== 'xzqnrpycjxfbyrfaolud' ||
    entries.bucket !== 'f90-images' || entries.public_only !== true) {
  throw new Error('Unexpected or private source manifest');
}
const cap = Number(process.env.F90_MEDIA_LIMIT || '200');
if (!Number.isSafeInteger(cap) || cap < 1 || cap > 2000) {
  throw new Error('F90_MEDIA_LIMIT must be an integer between 1 and 2000');
}
const order = (p) => p.startsWith('app-icons/') ? 0 :
  p.startsWith('app-verified/') ? 1 :
  p.startsWith('admin-icons/') ? 2 :
  p.startsWith('notifications/') ? 3 :
  p.startsWith('app-placeholders/') ? 4 :
  p.startsWith('category/') ? 5 :
  p.startsWith('products/') ? 6 : 7;
const selected = [...entries.assets]
  .sort((a,b) => order(a.path)-order(b.path) || a.path.localeCompare(b.path))
  .slice(0,cap);
const root = resolve('dist-f90-media');
await mkdir(root, {recursive:true});
const result = Array(selected.length);
async function copyOne(item, position) {
  if (!item || typeof item.path !== 'string' ||
      item.path.startsWith('/') || item.path.includes('\\') ||
      item.path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Unsafe asset path');
  }
  if (!Number.isSafeInteger(item.bytes) || item.bytes <= 0 || item.bytes > 25 * 1024 * 1024) {
    throw new Error('Asset exceeds Pages limit or has invalid size');
  }
  const subpath = item.path.split('/').map(encodeURIComponent).join('/');
  const url = origin + subpath;
  const dest = resolve(root, 'media', 'f90-images', item.path);
  if (!dest.startsWith(root + sep)) throw new Error('Asset escapes deployment root');
  let error;
  for (let attempt=0;attempt<3;attempt++) {
    try {
      const response = await fetch(url, {signal:AbortSignal.timeout(25_000),headers:{Accept:'image/*'}});
      if (!response.ok) throw new Error('Public image HTTP ' + response.status);
      const type = response.headers.get('content-type')?.split(';')[0]?.trim() || '';
      if (!['image/png','image/jpeg','image/webp','image/gif'].includes(type)) {
        throw new Error('Unexpected image MIME type');
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== item.bytes) throw new Error('Source image length changed; refresh inventory');
      await mkdir(dirname(dest),{recursive:true});
      await writeFile(dest,bytes);
      result[position] = {path:item.path,bytes:bytes.length};
      return;
    } catch (e) {
      error=e;
      if(attempt!==2) await new Promise(r=>setTimeout(r,700*(attempt+1)));
    }
  }
  throw new Error('Failed public asset ' + item.path + ': ' + error?.message);
}
let next=0;
const concurrency=6;
await Promise.all(Array.from({length:Math.min(concurrency,selected.length)},async()=>{
  while(next < selected.length) {
    const i=next++;
    await copyOne(selected[i],i);
  }
}));
const total=result.reduce((n,e)=>n+e.bytes,0);
await writeFile(join(root,'index.html'),
  '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>F90 CARD Media</title><body><h1>F90 CARD</h1><p>مكتبة الصور التجريبية، وليست واجهة للشراء.</p></body></html>');
await writeFile(join(root,'_headers'),'/media/*\n  Cache-Control: public, max-age=31536000, immutable\n  X-Content-Type-Options: nosniff\n');
await writeFile(join(root,'manifest.json'),JSON.stringify({image_count:result.length,total_bytes:total,items:result},null,2));
console.log(JSON.stringify({status:'success',image_count:result.length,total_mib:Math.round(total/1048576*10)/10}));
