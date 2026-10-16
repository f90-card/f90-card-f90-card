import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL("../"+file,import.meta.url),"utf8");
const client=read("f90-special.js");
const admin=read("f90-special-admin.js");
const app=read("app.js");
const adminShell=read("admin.js");

test("Xena salary uses a server-signed currency-specific payout rather than normal deposit pricing",()=>{
 assert.match(app,/is_salary_withdrawal===true/);
 assert.match(app,/#\/special\/salary/);
 assert.match(client,/visibleSalaryOptions/);
 assert.match(client,/data-salary-target/);
 assert.match(client,/data-salary-usd/);
 assert.match(client,/f90_submit_salary_v2/);
 assert.match(client,/p_currency:currency/);
 assert.doesNotMatch(client,/client\.rpc\("f90_submit_salary",/);
});

test("Salary manager controls have separate live image, description and per-currency rates",()=>{
 assert.match(adminShell,/salaryEditor\(S\.settings,S\.rates\)/);
 for(const name of ["salary_minimum","salary_details","salary_image_file","salary_rate_100k","salary_units_per_usd","salary_option_enabled"]){
   assert.ok(admin.includes(name),name);
 }
 assert.match(admin,/salary_withdrawal:salary/);
 assert.match(admin,/payout_options:options/);
 assert.match(admin,/accepted_currencies:options\.filter/);
});

test("Wallet USD credit remains server authoritative and coin quote survives rate changes",()=>{
 assert.match(client,/quote=value\/100000\*Number\(option\.per_100k\)/);
 assert.match(client,/data\.payout_amount/);
 assert.match(client,/data\.usd_amount/);
 assert.match(client,/بعد موافقة الإدارة/);
});
