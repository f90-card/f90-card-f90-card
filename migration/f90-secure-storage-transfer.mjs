/**
 * F90 CARD: transfer only irreplaceable customer Storage files.
 * Run on a trusted machine/CI runner with both project secrets injected privately.
 * Source project is READ-ONLY. No public media, radio, videos or archived audio.
 * Default is dry-run; writing requires F90_TRANSFER_WRITE=YES.
 * File contents, filenames, passwords and keys are never logged.
 */
import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const SOURCE = 'https://xzqnrpycjxfbyrfaolud.supabase.co';
const TARGET = 'https://ogkipkavlywgwhtomoca.supabase.co';
const SOURCE_KEY = process.env.F90_SOURCE_SERVICE_ROLE_KEY;
const TARGET_KEY = process.env.F90_TARGET_SERVICE_ROLE_KEY;
const WRITE = process.env.F90_TRANSFER_WRITE === 'YES';
const BUCKETS = ['f90-identity', 'f90-receipts', 'f90-avatars'];
const MAX_FILE = 5 * 1024 * 1024;
const MAX_TOTAL = 64 * 1024 * 1024;
const PAGE_SIZE = 100;
const HEADERS = (key) => ({ apikey: key, authorization: 'Bearer ' + key });

if (!SOURCE_KEY || !TARGET_KEY || SOURCE_KEY === TARGET_KEY ||
    [SOURCE_KEY, TARGET_KEY].some(key => key.startsWith('sb_publishable_'))) {
  throw Error('Two distinct project secret/service-role keys must be injected securely.');
}
function safePath(value) {
  if (!value || value.startsWith('/') || value.includes('\\') ||
      value.split('/').some(part => !part || part === '.' || part === '..')) {
    throw Error('Unsafe Storage path. Migration stopped.');
  }
  return value.split('/').map(encodeURIComponent).join('/');
}
async function json(root, key, path, payload) {
  const response = await fetch(root + path, {
    method: 'POST',
    headers: { ...HEADERS(key), 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error('Storage listing failed: HTTP ' + response.status);
  return response.json();
}
async function list(bucket, prefix = '', depth = 0) {
  if (depth > 15) throw Error('Storage nesting depth exceeded.');
  const all = [];
  let offset = 0;
  while (true) {
    const entries = await json(SOURCE, SOURCE_KEY,
      '/storage/v1/object/list/' + encodeURIComponent(bucket),
      { prefix, limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (!Array.isArray(entries)) throw Error('Invalid Storage listing.');
    for (const entry of entries) {
      if (typeof entry.name !== 'string') throw Error('Invalid Storage entry.');
      const name = prefix ? prefix + '/' + entry.name : entry.name;
      safePath(name);
      if (entry.id == null) {
        all.push(...await list(bucket, name, depth + 1));
        continue;
      }
      const size = Number(entry.metadata?.size);
      const mime = String(entry.metadata?.mimetype || '').toLowerCase();
      if (!Number.isSafeInteger(size) || size < 0 || size > MAX_FILE ||
          !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
        throw Error('An essential customer object has invalid type or size in ' + bucket);
      }
      if (bucket !== 'f90-avatars' && mime === 'image/gif') {
        throw Error('Unexpected private customer file type in ' + bucket);
      }
      all.push({ bucket, name, size, mime });
    }
    if (entries.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset > 20000) throw Error('Storage listing exceeded safety limit.');
  }
  return all;
}
async function read(root, key, item) {
  const url = root + '/storage/v1/object/authenticated/' +
    encodeURIComponent(item.bucket) + '/' + safePath(item.name);
  const response = await fetch(url, {
    headers: HEADERS(key),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw Error('Private Storage download failed: HTTP ' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== item.size) throw Error('Private Storage object size mismatch.');
  return bytes;
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function verifyExisting(item, expected) {
  const actual = await read(TARGET, TARGET_KEY, item);
  if (digest(actual) !== digest(expected)) {
    throw Error('Destination file already exists with different bytes. No overwrite performed.');
  }
}
async function copy(item) {
  const original = await read(SOURCE, SOURCE_KEY, item);
  const path = '/storage/v1/object/' + encodeURIComponent(item.bucket) + '/' + safePath(item.name);
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(TARGET + path, {
        method: 'POST',
        headers: {
          ...HEADERS(TARGET_KEY),
          'content-type': item.mime,
          'cache-control': '3600',
          'x-upsert': 'false',
        },
        body: original,
        signal: AbortSignal.timeout(60000),
      });
      if (response.ok || response.status === 409) break;
      throw Error('Private Storage upload failed: HTTP ' + response.status);
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep((attempt + 1) * 1000);
    }
  }
  // A 409 is successful only if the destination bytes match.
  // Verify every newly copied object by downloading it again.
  await verifyExisting(item, original);
  return response.status === 409 ? 'already_verified' : 'copied_verified';
}
const plan = [];
for (const bucket of BUCKETS) {
  const files = await list(bucket);
  const bytes = files.reduce((sum, f) => sum + f.size, 0);
  plan.push(...files);
  console.log(JSON.stringify({ bucket, files: files.length, mib: +(bytes / 1048576).toFixed(2) }));
}
const total = plan.reduce((sum, f) => sum + f.size, 0);
if (!plan.length || total > MAX_TOTAL) {
  throw Error('No source customer files, or the 64 MiB private transfer safety limit was exceeded.');
}
console.log(JSON.stringify({
  phase: 'preflight', count: plan.length,
  mib: +(total / 1048576).toFixed(2), write_enabled: WRITE,
}));
if (!WRITE) {
  console.log('DRY RUN: no upload performed. Set F90_TRANSFER_WRITE=YES for an authorized copy.');
  process.exit(0);
}
const results = { copied_verified: 0, already_verified: 0 };
for (const item of plan) {
  const result = await copy(item);
  results[result]++;
}
console.log(JSON.stringify({ phase: 'complete', source_retained: true, ...results,
  note: 'Confirm folder access as individual customer and admin before cutover.' }));
