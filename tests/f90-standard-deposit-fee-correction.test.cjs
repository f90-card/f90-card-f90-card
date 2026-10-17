const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const sql=fs.readFileSync("supabase/migrations/20261017195000_standard_deposits_two_percent.sql","utf8");
test("standard deposits fee adjustment is tightly scoped and backwards safe",()=>{
  assert.match(sql,/bank-palestine/);
  assert.match(sql,/reflect/);
  assert.match(sql,/deposit_fee_percent/);
  assert.match(sql,/is_salary_withdrawal/);
  assert.match(sql,/F90_DEPOSIT_FEE_STATE_CHANGED/);
  assert.match(sql,/FOR UPDATE/);
  assert.doesNotMatch(sql,/UPDATE public\.f90_(deposits|wallets|orders)/i);
  assert.doesNotMatch(sql,/UPDATE public\.f90_rates/i);
  assert.doesNotMatch(sql,/f90_providers/i);
});
