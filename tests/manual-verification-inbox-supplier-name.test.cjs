"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const file=(name)=>fs.readFileSync(path.join(root,name),"utf8");

test("manager can approve a user in the admin profile with a reason",()=>{
 const admin=file("admin.js");
 const edge=file("supabase/functions/f90-platform/index.ts");
 const migration=file("supabase/migrations/20261017143500_manual_account_verification_and_supplier_name.sql");
 assert.match(admin,/id="f90ManualVerificationForm"/);
 assert.match(admin,/staff\.manual_verify/);
 assert.match(admin,/reason\.length<8/);
 assert.match(edge,/if \(action === "staff\.manual_verify"\)/);
 assert.match(edge,/requireRole\(a, "manager"\)/);
 assert.match(edge,/p_user:uuid\(b\.id\)/);
 assert.match(migration,/f90_private\.require_actor\(p_actor, array\['manager'\]\)/);
 assert.match(migration,/insert into public\.f90_audit/);
 assert.match(migration,/account\.manual_verification/);
 assert.match(migration,/revoke all on function public\.f90_manual_verify_account\(uuid,uuid,text\) from public, anon, authenticated/);
 assert.match(migration,/grant execute on function public\.f90_manual_verify_account\(uuid,uuid,text\) to service_role/);
});

test("admin bell opens a real private notification inbox and plays new-event audio",()=>{
 const edge=file("supabase/functions/f90-platform/index.ts");
 const ui=file("f90-admin-inbox.js");
 const html=file("admin.html");
 const admin=file("admin.js");
 assert.match(edge,/if \(action === "staff\.inbox"\)/);
 assert.match(edge,/requireRole\(a, "manager", "admin", "support"\)/);
 assert.match(edge,/const canReviewIdentity = a\.role !== "support"/);
 assert.match(edge,/const canViewUsers = a\.role === "manager"/);
 assert.match(edge,/\.eq\("status","pending"\)/);
 assert.match(ui,/A\.call\("staff\.inbox"\)/);
 assert.match(ui,/ctx\.createOscillator/);
 assert.match(ui,/sessionStorage\.setItem/);
 assert.match(ui,/state\.known===null|known === null/);
 assert.match(ui,/f90AdminSoundToggle/);
 assert.match(ui,/f90AdminInboxList/);
 assert.match(admin,/F90AdminInbox\?\.refresh\(\)/);
 assert.match(html,/f90-admin-inbox\.js\?v=20261017-inbox1/);
 assert.match(html,/f90-admin-inbox\.css\?v=20261017-inbox1/);
});

test("nickname is never guessed from ID and only shown when supplied",()=>{
 const edge=file("supabase/functions/f90-platform/index.ts");
 const supplier=file("supabase/functions/f90-platform/provider.mjs");
 const app=file("app.js");
 const migration=file("supabase/migrations/20261017143500_manual_account_verification_and_supplier_name.sql");
 assert.match(edge,/function supplierRecipientNickname/);
 assert.match(edge,/return null;/);
 assert.match(edge,/await rememberSupplierNickname\(o\.id,response\)/);
 assert.match(edge,/await rememberSupplierNickname\(o\.id,data\)/);
 assert.match(supplier,/if \(yassen && action === "add"\)/);
 assert.match(supplier,/account_name: nickname\.trim\(\)/);
 assert.match(app,/const supplierName=typeof o\.supplier_account_name/);
 assert.match(app,/اسم الحساب من المورّد/);
 assert.match(app,/orderRecipientFields\(o\)\.accountId/);
 assert.match(migration,/add column if not exists supplier_account_name text/);
});

test("frontend shell loads all necessary files",()=>{
 assert.match(file("index.html"),/app\.js\?v=[\w-]+/);
 assert.match(file("admin.html"),/admin\.js\?v=[\w-]+/);
});
