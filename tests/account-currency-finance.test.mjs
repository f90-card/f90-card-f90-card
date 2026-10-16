import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const load=(n)=>readFileSync(new URL("../"+n,import.meta.url),"utf8");
const app=load("app.js");
const salary=load("f90-special.js");
const admin=load("admin.js");
const salaryAdmin=load("f90-special-admin.js");
const edge=load("supabase/functions/f90-platform/index.ts");
const migration=load("supabase/migrations/20261016225000_account_currency_salary_guard.sql");

test("Currency belongs to account profile, not local browser choice",()=>{
 assert.match(migration,/add column if not exists account_currency text not null default 'USD'/);
 assert.match(migration,/check \(account_currency in \('USD','ILS','JOD'\)\)/);
 assert.match(app,/A.call\("profile.currency",\{currency:chosen\}\)/);
 assert.match(edge,/action === "profile.currency"/);
 assert.match(edge, /\.eq\("id",a\.id\)/);
 assert.match(app,/me\?\.profile\?\.account_currency/);
});

test("deposit is submitted only in account currency regardless of form edits",()=>{
 const form=app.slice(app.indexOf("  function deposit(methodId) {"),app.indexOf("  function orderRecord(o) {"));
 assert.match(form,/f90-fixed-account-currency/);
 assert.match(form,/input type="hidden" name="currency"/);
 assert.doesNotMatch(form,/<select name="currency"/);
 assert.match(form,/accountCurrency=S\.me\?\.profile\?\.account_currency\|\|"USD"/);
 assert.match(edge,/const accountCurrency=String\(verification\.account_currency\|\|"USD"\)/);
 assert.match(edge,/const currency=previous\?\.currency\|\|accountCurrency/);
 assert.match(edge,/referenceCurrency !== accountCurrency/);
 assert.match(edge,/paymentMethod\.accepted_currencies\.includes\(currency\)/);
});

test("Xena salary currency is fixed on account and verified again in RPC",()=>{
 assert.match(salary,/customerSalaryCurrency/);
 assert.match(salary,/input name="payout_currency" type="hidden"/);
 assert.doesNotMatch(salary,/<select name="payout_currency"/);
 assert.match(salary,/const currency=customerSalaryCurrency/);
 assert.match(migration,/F90_ACCOUNT_CURRENCY_MISMATCH/);
 assert.match(migration,/p\.account_currency=v_currency/);
 assert.match(migration,/revoke all on function public\.f90_submit_salary_v2/);
});

test("administrators see current account currency and request's original currency",()=>{
 assert.match(edge,/id,display_name,customer_id,email,account_currency/);
 assert.match(edge,/id,display_name,customer_id,account_currency/);
 assert.match(admin,/عملة حساب العميل الحالية/);
 assert.match(admin,/عملة الإيداع عند تقديم الطلب/);
 assert.match(salaryAdmin,/عملة حساب العميل الحالية/);
 assert.match(salaryAdmin,/عملة العميل وقت طلب الراتب/);
});

test("frontends remain valid Javascript",()=>{
 for(const [name,code] of [["app",app],["salary",salary],["admin",admin],["salaryAdmin",salaryAdmin]])
  assert.doesNotThrow(()=>new vm.Script(code,{filename:name}));
});
