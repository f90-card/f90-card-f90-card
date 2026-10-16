import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("app.js"),salary=read("f90-special.js"),
  css=read("f90-special.css"),historyCss=read("f90-history.css"),
  api=read("supabase/functions/f90-platform/index.ts"),index=read("index.html");

test("customer sees credited amount in the account currency, not a USD-only figure",()=>{
 assert.match(app,/function accountMoney\(usd,code=S\.me\?\.profile\?\.account_currency\|\|"USD"/);
 assert.match(app,/accountMoney\(net,currency\)/);
 assert.match(app,/method_snapshot\?\.deposit_fee_percent/);
 assert.match(app,/savedRate>0/);
 assert.match(salary,/targetMoney\(amount,customerSalaryCurrency\)/);
 assert.match(salary,/targetMoney\(value\/100000\*Number\(option\.per_100k\),customerSalaryCurrency\)/);
 assert.match(salary,/targetMoney\(data\.payout_amount, data\.payout_currency\|\|customerSalaryCurrency\)/);
 assert.match(api,/const currency=previous\?\.currency\|\|accountCurrency/);
 assert.match(salary,/f90_submit_salary_v3/);
});

test("compact deposit and salary forms keep mandatory proof and quotes",()=>{
 assert.match(app,/f90-finance-help/);
 assert.match(app,/f90-finance-success/);
 assert.match(app,/name="receipt" required/);
 assert.match(app,/f90-deposit-net-amount/);
 assert.match(salary,/data-review hidden/);
 assert.match(salary,/reviewReady/);
 assert.match(salary,/f90-finance-success/);
 assert.doesNotMatch(salary,/window\.confirm\("سحب "/);
 assert.match(salary,/p_receipt:path/);
 assert.match(salary,/input name="receipt" type="file" required/);
 assert.match(css,/@media\(max-width:480px\)/);
});

test("three separate customer history routes and personal salary records are preserved",()=>{
 assert.match(app,/\[\['orders','الطلبات'\],\['deposits','الإيداعات'\],\['history','العمليات'\]\]/);
 assert.match(app,/orders\?"orders":deposits\?"deposits":"ledger"/);
 assert.match(app,/A\.call\("history\.salary"/);
 assert.match(app,/salaryHistoryRecord/);
 assert.match(app,/data-f90-history-filter/);
 assert.match(app,/applyHistoryFilter\(\)/);
 assert.match(api,/action === "history.salary"/);
 assert.match(api,/\.eq\("user_id",a\.id\)/);
 assert.match(historyCss,/f90-history-nav/);
 assert.match(historyCss,/@media\(max-width:560px\)/);
});

test("valid scripts and versioned styles are included in the storefront",()=>{
 for(const [p,c] of [["app.js",app],["f90-special.js",salary]])
  assert.doesNotThrow(()=>new vm.Script(c,{filename:p}));
 assert.match(index,/f90-history\.css\?v=20261016-compactlogs1/);
 assert.match(index,/f90-special\.css\?v=20261016-financeclean1/);
});
