"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root=path.resolve(__dirname,"..");
const read = f=>fs.readFileSync(path.join(root,f),"utf8");
async function extract(input){
  const {recipientNameFromSupplier}=await import("../supabase/functions/f90-platform/recipient-name.mjs");
  return recipientNameFromSupplier(input);
}
test("direct supplier account fields win when they are supplied",async()=>{
  assert.equal(await extract({status:"completed",player_name:"Xena Player"}),"Xena Player");
  assert.equal(await extract({account:{nickname:"فارس القمة"}}),"فارس القمة");
});
test("Yassen replay_api array format extracts only the account before successful-transfer text",async()=>{
  assert.equal(await extract({status:"completed",replay_api:[{replay:["F90 ♛ghls / عملية التحويل تمت بنجاح"]}]}),"F90 ♛ghls");
  assert.equal(await extract({replay_api:[{replay:["الغالي 123 / تم الشحن بنجاح"]}]}),"الغالي 123");
  assert.equal(await extract({replay_api:["اسم المستخدم: ghls_Player"]}),"ghls_Player");
});
test("never infer a name from generic acknowledgements, numerical IDs or gift codes",async()=>{
  for(const value of ["عملية التحويل تمت بنجاح","تم الشحن بنجاح","تم تحويل المبلغ بنجاح",
    "123456789","XCVBN12345678901234567890","https://store.example/path","مكتمل"]){
    assert.equal(await extract({replay_api:[value]}),null,value);
  }
  assert.equal(await extract({status:"completed",data:{playerId:"31991930"},replay_api:null}),null);
  assert.equal(await extract({reply:"شكرًا لك على الشراء"}),null);
  assert.equal(await extract({replay_api:[{replay:["ABC-123-CODE"]}]}),null);
});
test("replay messages do not automatically turn into verified usernames",async()=>{
  assert.equal(await extract({message:"شحن الخدمة اكتمل"}),null);
  assert.equal(await extract({replay_api:["تم الشحن بنجاح / F90 CARD"]}),null);
  assert.equal(await extract({replay_api: ["اسم اللاعب: ف90 القمة"]}),"ف90 القمة");
});
test("metadata sync is read-only and background retries are bounded",()=>{
  const server=read("supabase/functions/f90-platform/index.ts");
  const sql=read("supabase/migrations/20261017153000_yassen_recipient_reply_metadata_sync.sql");
  const admin=read("admin.js");
  assert.match(server,/recipientNameFromSupplier/);
  assert.match(server,/if \(action === "staff\.sync_recipient_name"\)/);
  assert.match(server,/requireRole\(a, "manager", "admin"\)/);
  assert.match(server,/providerAction\(order\.provider_id,"status",\{order:order\.provider_order_id\}\)/);
  assert.match(server,/async function backfillCompletedSupplierNames/);
  assert.match(server,/\.lt\("supplier_name_check_attempts",3\)/);
  assert.match(server,/\.limit\(2\)/);
  assert.match(server,/names_synced:namesSynced/);
  assert.match(sql,/supplier_name_check_attempts integer not null default 0/);
  assert.match(admin,/data-action="sync-recipient-name"/);
  assert.match(admin,/A\.call\("staff\.sync_recipient_name"/);
  assert.match(read("admin.html"),/admin\.js\?v=[a-zA-Z0-9_-]+/);
});
