/**
 * F90 CARD one-way storage migration. Source is strictly read-only.
 * Run from a trusted environment only. Do not commit any credentials.
 * Requires Node >= 20 with global fetch.
 * Excludes retired radio/audio. Does not upload to GitHub or log filenames.
 */
import { setTimeout as sleep } from 'node:timers/promises';

const SOURCE = 'https://xzqnrpycjxfbyrfaolud.supabase.co';
const TARGET = 'https://ogkipkavlywgwhtomoca.supabase.co';
const BUCKETS = ['f90-images', 'f90-store-images', 'f90-videos', 'f90-avatars', 'f90-identity', 'f90-receipts'];
const SOURCE_KEY = process.env.F90_SOURCE_SERVICE_ROLE_KEY;
const TARGET_KEY = process.env.F90_TARGET_SERVICE_ROLE_KEY;
const WRITE_ENABLED = process.env.F90_TRANSFER_WRITE === 'YES';
const MAX_TOTAL_BYTES = 850 * 1024 * 1024;
const MAX_OBJECT_BYTES = 21 * 1024 * 1024;
const PAGE_SIZE = 100;

if (!SOURCE_KEY || !TARGET_KEY || SOURCE_KEY === TARGET_KEY ||
    SOURCE_KEY.startsWith('sb_publishable_') || TARGET_KEY.startsWith('sb_publishable_')) {
  throw new Error('Provide two distinct project-level service-role/secret keys through environment variables.');
}
function headers(key) {return { apikey: key, Authorization: 'Bearer ' + key };}
function safePath(path) {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some(s => s === '.' || s === '..' || !s)) {
    throw new Error('Unsupported object path, stopped without further copying.');
  }
  return path.split('/').map(encodeURIComponent).join('/');
}
async function apiJson(root, key, method, path, payload) {
  const res = await fetch(root + path, {
    method,
    headers: { ...headers(key), 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error('Storage metadata operation failed with HTTP ' + res.status);
  return res.json();
}
async function enumerate(bucket, prefix = '', depth = 0) {
  if (depth > 15) throw new Error('Storage directory nesting exceeds safety limit.');
  const objects = [];
  let offset = 0;
  while (true) {
    const entries = await apiJson(SOURCE, SOURCE_KEY, 'POST',
      '/storage/v1/object/list/' + encodeURIComponent(bucket),
      { prefix, limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (!Array.isArray(entries)) throw new Error('Unexpected storage directory listing.');
    for (const entry of entries) {
      if (typeof entry.name !== 'string') throw new Error('Invalid object metadata.');
      const path = prefix ? prefix + '/' + entry.name : entry.name;
      safePath(path);
      if (entry.id == null) objects.push(...await enumerate(bucket, path, depth + 1));
      else {
        const size = Number(entry.metadata?.size);
        if (!Number.isSafeInteger(size) || size < 0 || size > MAX_OBJECT_BYTES) {
          throw new Error('An object is missing its size or exceeds the safety limit in bucket ' + bucket);
        }
        objects.push({ bucket, path, size, contentType: entry.metadata?.mimetype || 'application/octet-stream' });
      }
    }
    if (entries.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset > 20000) throw new Error('Directory listing exceeded safety limit.');
  }
  return objects;
}
async function copyOne(item) {
  const suffix = encodeURIComponent(item.bucket) + '/' + safePath(item.path);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const source = await fetch(SOURCE + '/storage/v1/object/authenticated/' + suffix, {
        headers: headers(SOURCE_KEY), signal: AbortSignal.timeout(45000),
      });
      if (!source.ok) throw new Error('Source read HTTP ' + source.status);
      const bytes = Buffer.from(await source.arrayBuffer());
      if (bytes.length !== item.size) throw new Error('Source object size changed during copy');
      const destination = await fetch(TARGET + '/storage/v1/object/' + suffix, {
        method: 'POST',
        headers: {
          ...headers(TARGET_KEY),
          'content-type': item.contentType,
          'cache-control': '3600',
          'x-upsert': 'false',
        },
        body: bytes,
        signal: AbortSignal.timeout(45000),
      });
      if (destination.status === 409) return 'exists';
      if (!destination.ok) throw new Error('Target write HTTP ' + destination.status);
      return 'copied';
    } catch (error) {
      if (attempt === 2) return 'failed';
      await sleep(750 * (attempt + 1));
    }
  }
  return 'failed';
}

const plan = [];
for (const bucket of BUCKETS) {
  const items = await enumerate(bucket);
  plan.push(...items);
  console.log(JSON.stringify({ bucket, source_objects: items.length,
    source_mib: +(items.reduce((sum, x) => sum + x.size, 0) / 1048576).toFixed(2) }));
}
const totalBytes = plan.reduce((sum, x) => sum + x.size, 0);
if (totalBytes > MAX_TOTAL_BYTES) throw new Error('Exceeds 850 MiB target free-tier preflight cap. No uploads started.');
console.log(JSON.stringify({ phase: 'preflight', source_objects: plan.length,
  source_mib: +(totalBytes / 1048576).toFixed(2), mode: WRITE_ENABLED ? 'copy-to-target' : 'dry-run' }));
if (!WRITE_ENABLED) {
  console.log('DRY RUN. Set F90_TRANSFER_WRITE=YES in a trusted environment to copy.');
  process.exit(0);
}
let copied = 0, exists = 0, failed = 0;
for (const bucket of BUCKETS) {
  const rows = plan.filter(x => x.bucket === bucket);
  const status = { copied: 0, exists: 0, failed: 0 };
  for (const item of rows) {
    const result = await copyOne(item);
    status[result]++;
    if (result === 'failed') { failed++; break; }
  }
  copied += status.copied;
  exists += status.exists;
  console.log(JSON.stringify({ phase: 'bucket-complete', bucket, ...status }));
  if (failed) break;
}
console.log(JSON.stringify({ phase: 'finished', copied, already_present: exists, failed,
  note: 'Compare storage.objects paths and sizes in both databases; retained files are not an independent backup.' }));
if (failed) process.exitCode = 1;
