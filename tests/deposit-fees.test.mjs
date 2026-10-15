import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("manager editing payment method saves a bounded deposit fee rate",()=>{
 const admin=read("admin.js");
 assert.doesNotThrow(()=>new vm.Script(admin));
 assert.match(admin,/field\("deposit_fee_percent"/);
 assert.match(admin,/d\.deposit_fee_percent \?\? 2/);
 assert.match(admin,/value<0\|\|value>50/);
 assert.match(admin,/deposit_fee_percent:\s*\(\(\)=>/);
});
test("deposit preview uses the selected method fee instead of a hardcoded two percent",()=>{
 const frontend=read("app.js");
 assert.doesNotThrow(()=>new vm.Script(frontend));
 assert.match(frontend,/S\.selectedMethod\?\.deposit_fee_percent \?\? 2/);
 assert.match(frontend,/gross \* pct \/ 100/);
 assert.match(frontend,/عمولة الإيداع.*e\(pct\)/);
});
test("server safeguards freeze fee snapshot for future deposits without changing old ledger",()=>{
 const sql=read("supabase/migrations/20261015225000_configurable_deposit_fees.sql");
 assert.match(sql,/jsonb_build_object\(/);
 assert.match(sql,/deposit_fee_percent/);
 assert.match(sql,/pct<0 OR pct>50/);
 assert.match(sql,/IF FOUND THEN RETURN to_jsonb\(d\); END IF/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.f90_review_deposit/);
 assert.doesNotMatch(sql,/UPDATE public\.f90_deposits/);
});
