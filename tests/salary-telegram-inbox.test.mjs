import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const admin=source("admin.js");
const salaryAdmin=source("f90-special-admin.js");
const telegram=source("supabase/functions/f90-telegram-alerts/index.ts");
const migration=source("supabase/migrations/20261016211000_salary_telegram_three_currencies.sql");

test("Xena salary notifications are enqueued uniquely without private receipt data",()=>{
 assert.match(migration,/TG_TABLE_NAME='f90_salary_requests'/);
 assert.match(migration,/CREATE TRIGGER f90_telegram_on_salary AFTER INSERT/);
 assert.match(migration,/on conflict\(event_key\) do nothing/i);
 assert.match(migration,/salary_new/);
 assert.match(migration,/salary_enabled/);
 assert.match(migration,/FROM public\.f90_salary_requests s WHERE s\.status='pending'/);
 assert.match(telegram,/row\.event_type==="salary_new"/);
 assert.match(telegram,/escapeHTML\(d\.coins\)/);
 assert.match(telegram,/escapeHTML\(d\.payout_amount\)/);
 assert.doesNotMatch(telegram,/escapeHTML\(d\.receipt_path\)|escapeHTML\(d\.account_id\)/);
});

test("salary requests appear on admin deposit page even without normal deposits",()=>{
 assert.match(admin,/if \(kind === "deposits"\)/);
 assert.match(admin,/id="f90SalaryInbox"/);
 assert.ok(admin.indexOf('id="f90SalaryInbox"')<admin.indexOf('if (!r.items.length)'));
 assert.match(salaryAdmin,/async function renderSalaryInbox/);
 assert.match(salaryAdmin,/client\.rpc\("f90_list_salary"\)/);
 assert.match(salaryAdmin,/data-f90-review="completed"/);
 assert.match(salaryAdmin,/data-f90-review="rejected"/);
 assert.match(salaryAdmin,/data-f90-salary-receipt/);
 assert.match(salaryAdmin,/Promise\.allSettled/);
 assert.match(salaryAdmin,/if\(document\.getElementById\("f90SalaryInbox"\)\)await renderSalaryInbox/);
});

test("only USD, JOD and ILS currencies are selectable in salary and deposit editors",()=>{
 assert.match(migration,/UPDATE public\.f90_rates SET is_enabled=false WHERE currency='XCN'/);
 assert.match(migration,/item->>'currency' IN \('USD','ILS','JOD'\)/);
 assert.match(admin,/\["USD","ILS","JOD"\]\.includes\(code\)/);
 assert.match(salaryAdmin,/\["USD","ILS","JOD"\]\.includes\(String\(x\.currency\|\|""\)\)/);
 assert.doesNotMatch(admin,/placeholder="USD,ILS,JOD,XCN"/);
 for(const [name,c] of [["admin",admin],["salary editor",salaryAdmin]])
   assert.doesNotThrow(()=>new vm.Script(c,{filename:name}));
});

test("Telegram settings let manager opt in and out of Xena salary alerts",()=>{
 assert.match(admin,/check\("telegram_salary"/);
 assert.match(admin,/salary_enabled:form\.elements\.telegram_salary\.checked/);
 assert.match(admin,/salary_new:"سحب رواتب Xena Live"/);
});
