#!/usr/bin/env node
'use strict';

// F90 CARD pre-deployment safeguard. Scans tracked source only; never prints secrets.
const fs = require('node:fs');
const cp = require('node:child_process');

const files = cp.execFileSync('git', ['ls-files', '-z'], { maxBuffer: 32 * 1024 * 1024 })
  .toString('utf8').split('\0').filter(Boolean);

const secretFile = /(?:^|\/)(?:\.env(?:\.[^/]+)?|[^/]+\.(?:pem|p12|pfx|key|dump|sqlite3?|db|backup))$/i;
const permittedEnvTemplates = /(?:^|\/)\.env\.(?:example|sample|template)$/i;
const sourceFile = /\.(?:js|cjs|mjs|ts|tsx|jsx|json|ya?ml|html?|md|sql|toml|sh|txt|properties|ini)$/i;

const signatures = [
  ['private-key-material', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ['github-access-token', /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['stripe-live-secret', /\b(?:sk_live_|rk_live_)[A-Za-z0-9]{20,}\b/],
  ['hardcoded-service-or-supplier-secret',
    /\b(?:SUPABASE_SERVICE_ROLE_KEY|YASSEN_(?:API_)?(?:KEY|TOKEN|SECRET)|F90_WORKER_SECRET)\s*[:=]\s*['"][A-Za-z0-9_-]{16,}['"]/i],
];

const issues = [];
for (const file of files) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  if (secretFile.test(file) && !permittedEnvTemplates.test(file)) {
    issues.push(file + ': tracked private file');
    continue;
  }
  if (!sourceFile.test(file)) continue;
  const stat = fs.statSync(file);
  if (stat.size > 5 * 1024 * 1024) {
    issues.push(file + ': source file too large for security scan; review manually');
    continue;
  }
  const contents = fs.readFileSync(file, 'utf8');
  if (contents.includes('\0')) continue;
  for (const [index, line] of contents.split(/\r?\n/).entries()) {
    for (const [id, signature] of signatures) {
      if (signature.test(line)) issues.push(file + ':' + (index + 1) + ': ' + id);
    }
    const jwt = /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\b/g;
    for (const match of line.matchAll(jwt)) {
      try {
        const claims = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8'));
        if (claims.role === 'service_role') {
          issues.push(file + ':' + (index + 1) + ': supabase-service-role-jwt');
        }
      } catch {
        // Other opaque tokens are not proof of leaked service credentials.
      }
    }
  }
}
if (issues.length) {
  console.error('Security scan failed. Review these locations without copying secret values:');
  for (const issue of issues) console.error(' - ' + issue);
  process.exit(1);
}
console.log('F90 CARD source security scan passed (' + files.length + ' tracked entries).');
