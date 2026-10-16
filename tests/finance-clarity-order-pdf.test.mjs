import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const load=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=load("app.js"),salary=load("f90-special.js"),css=load("f90-special.css"),pdf=load("reports.js");
const rateFix=load("supabase/migrations/20261016232000_xena_salary_ils_3250.sql");
test("Correct Xena salary shekel amount is 32.5 per 100000 coins",()=>{
 assert.match(rateFix,/32\.5/);
 assert.match(rateFix,/WHERE x->>'currency'='ILS'/);
 assert.match(salary,/targetMoney\(amount,customerSalaryCurrency\)/);
 assert.match(salary,/f90_submit_salary_v3/);
});
test("Deposit photos remain outside service forms; instructions appear by default",()=>{
 const deposit=app.slice(app.indexOf("  function deposit(methodId) {"),app.indexOf("  function orderRecord(o) {"));
 assert.match(deposit,/method-grid f90-deposit-methods-with-images/);
 assert.match(deposit,/f90-finance-visible-instructions/);
 assert.doesNotMatch(deposit,/f90-deposit-detail-art/);
 assert.match(deposit,/f90-deposit-upload/);
 assert.match(deposit,/f90-salary-optional-note/);
 assert.match(salary,/salary\?'':'<div class="f90-special-banner"/);
 assert.match(salary,/f90-finance-visible-instructions/);
 assert.match(salary,/f90-salary-optional-note/);
 assert.match(salary,/name="receipt" type="file" required/);
 assert.match(css,/f90-order-summary-layout/);
});
test("Wallet header routes directly to deposit methods",()=>{
 assert.match(app,/headerWallet"\)\.setAttribute\("href","#\/deposit"\)/);
});
test("Order detail shows only factual saved recipient details and core financial fields",()=>{
 assert.match(app,/function orderRecipientFields/);
 assert.match(app,/function orderSummaryFields/);
 assert.match(app,/ID الشحن/);
 assert.match(app,/اسم الحساب المسجل/);
 assert.match(app,/customer_fields/);
 assert.match(app,/["']?param_1["']?/);
 assert.match(app,/["']?account_name["']?/);
 assert.match(app,/f90-order-secondary/);
 assert.match(app,/data-action="order-pdf"/);
 assert.match(app,/orderSummaryFields\(S\.currentOrder\)/);
});
test("PDF uses brand mark and Arabic concise order summary",()=>{
 assert.match(pdf,/assets\/icons\/icon-192\.png/);
 assert.match(pdf,/doc\.addImage\(logo,"PNG"/);
 assert.match(pdf,/F90 CARD/);
 assert.match(pdf,/summaryRows\.slice\(0,6\)/);
 assert.match(pdf,/اسم الحساب المسجل/);
 for(const [name,code] of [["app",app],["Xena",salary],["PDF",pdf]]){
   assert.doesNotThrow(()=>new vm.Script(code,{filename:name}));
 }
});
