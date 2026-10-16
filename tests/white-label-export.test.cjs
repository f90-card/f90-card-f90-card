const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const child=require("node:child_process");
const path=require("node:path");
const root=path.join(__dirname,"..");
const script=path.join(root,"scripts","create-client-store.mjs");

test("white-label exporter parses on Node 22 and refuses missing customer details",()=>{
 assert.doesNotThrow(()=>child.execFileSync(process.execPath,["--check",script],{cwd:root,timeout:10000}));
 const result=child.spawnSync(process.execPath,[script],{cwd:root,encoding:"utf8",timeout:10000});
 assert.notEqual(result.status,0,"No customer file must never create a client copy");
});
test("white-label exporter separates each tenant and omits original migrations and secrets",()=>{
 const code=fs.readFileSync(script,"utf8");
 assert.match(code,/new URL\(data\.supabaseUrl\)/);
 assert.match(code,/xzqnrpycjxfbyrfaolud/);
 assert.match(code,/supabase\/migrations/);
 assert.match(code,/supabase\/seeds/);
 assert.match(code,/service\[_-\]\?role/);
 assert.match(code,/supabasePublishableKey/);
 assert.match(code,/REMAINING_OLD_BRANDING\.txt/);
 assert.match(code,/CLIENT_REBRAND_CHECKLIST\.md/);
});
test("the starter documentation warns against copying customer data and publishing early",()=>{
 const doc=fs.readFileSync(path.join(root,"white-label","README_AR.md"),"utf8");
 assert.match(doc,/Supabase جديدًا/);
 assert.match(doc,/لا تنسخ قاعدة العملاء/);
 assert.match(doc,/ليست نسخة معتمدة للبيع فورًا/);
});

test("starter frontend is disconnected from production Supabase until a customer config is provided",()=>{
 const code=fs.readFileSync(path.join(root,"config.js"),"utf8");
 assert.match(code,/https:\/\/NEW_PROJECT_REF\.supabase\.co/);
 assert.match(code,/YOUR_NEW_SUPABASE_PUBLISHABLE_KEY/);
 assert.doesNotMatch(code,/xzqnrpycjxfbyrfaolud/);
});
