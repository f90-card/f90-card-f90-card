import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const load=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const app=load("app.js"),admin=load("admin.js");
const salary=load("f90-special.js"),salaryAdmin=load("f90-special-admin.js");
const server=load("supabase/functions/f90-platform/index.ts");
const sql=load("supabase/migrations/20261016191000_salary_receipt_submission_v3.sql");

test("new deposit and salary modules parse without breaking the existing store",()=>{
 for(const [file,code] of [["app.js",app],["admin.js",admin],
   ["f90-special.js",salary],["f90-special-admin.js",salaryAdmin]])
   assert.doesNotThrow(()=>new vm.Script(code,{filename:file}));
});

test("deposit pages restore existing method pictures and barcode while preserving secure form",()=>{
 const deposit=app.slice(app.indexOf("  function deposit(methodId) {"),app.indexOf("  function orderRecord(o) {"));
 assert.match(deposit,/method-grid f90-deposit-methods-with-images/);
 assert.match(deposit,/method-tile f90-method-active/);
 assert.match(deposit,/image\(x\.image_url,x\.name_ar,"f90-deposit-method-art"\)/);
 assert.match(deposit,/f90-deposit-detail-art/);
 assert.match(deposit,/image\(m\.image_url,m\.name_ar,"f90-deposit-method-art"\)/);
 assert.match(deposit,/C\.safeUrl\(m\.barcode_url\)/);
 assert.match(deposit,/f90-deposit-request-card/);
 assert.match(deposit,/f90-deposit-destination/);
 assert.match(deposit,/f90-deposit-output/);
 assert.match(deposit,/name="receipt" required/);
 assert.match(deposit,/accepted_currencies/);
});

test("manager can independently edit bank deposit destination, min, instructions and reference",()=>{
 for(const field of ["receiver_name","destination","network_ar","minimum_amount",
   "reference_label","receipt_help","accepted_currencies","deposit_fee_percent"])
   assert.ok(admin.includes(field),"Expected manager deposit field "+field);
 assert.match(server,/paymentMethod.minimum_amount/);
 assert.match(server,/if \(!previous\)/);
 assert.match(server,/F90_IDEMPOTENCY_CONFLICT/);
});

test("Xena receipt and optional note are private and payout is authoritative",()=>{
 assert.match(salary,/f90_submit_salary_v3/);
 assert.match(salary,/window.F90API.upload\(proof,"f90-receipts"\)/);
 assert.match(salary,/p_receipt:path/);
 assert.match(salary,/name="note"/);
 assert.match(salary,/data-salary-target/);
 assert.match(salary,/f90-special-banner"><img src=/);
 assert.match(sql,/storage\.objects/);
 assert.match(sql,/receipt_path/);
 assert.match(sql,/client_note/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/revoke all on function public\.f90_submit_salary_v3/);
 assert.match(sql,/grant execute on function public\.f90_submit_salary_v3/);
 assert.match(server,/b\.kind === "salary"/);
 assert.match(salaryAdmin,/data-f90-salary-receipt/);
 assert.match(salaryAdmin,/staff\.file/);
});
