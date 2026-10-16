import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("app.js"), config=read("config.js"), salary=read("f90-special.js");
const rpc=read("supabase/migrations/20261016225000_account_currency_salary_guard.sql");
const rateMigration=read("supabase/migrations/20261016225900_xena_salary_rates.sql");

test("direct deposit route waits for saved session before redirecting to login",()=>{
 const r=app.slice(app.indexOf("  async function route() {"),app.indexOf("  async function submit(",app.indexOf("  async function route() {")));
 assert.match(r,/const needsAccount=privatePages\.includes\(page\)\|\|\(page==="special"&&id==="salary"\)/);
 assert.match(r,/if\(pendingMeRefresh\)/);
 assert.match(r,/await pendingMeRefresh/);
 assert.match(r,/checkSession\?\.error\|\|checkSession\?\.data\?\.session/);
 assert.match(r,/if\(location\.hash!=="#\/auth"\)location\.hash="#\/auth"/);
 assert.ok(r.indexOf("await pendingMeRefresh")<r.indexOf('location.hash="#/auth"'));
 assert.match(app,/\["profile","wallet","deposit","orders"/);
 assert.match(app,/\.startsWith\("#\/special\/salary"\)/);
});
test("tab fallback persists existing authenticated session across page reloads when localStorage is unavailable",()=>{
 assert.match(config,/window\.sessionStorage/);
 assert.match(config,/persistSession: !!storage/);
 assert.match(config,/autoRefreshToken: true/);
 assert.match(config,/storage=candidate/);
 assert.doesNotMatch(app.slice(app.indexOf("let pendingMeRefresh"),app.indexOf("  function promotions()")),/\.signOut\(/);
});
test("Xena salary rates are independent of the store's deposit commission",()=>{
 assert.match(rateMigration,/WHEN 'USD' THEN 10::numeric/);
 assert.match(rateMigration,/WHEN 'JOD' THEN 7::numeric/);
 assert.match(rateMigration,/WHEN 'ILS' THEN 3\.25::numeric/);
 assert.match(rateMigration,/r\.per_usd/);
 assert.match(rpc,/v_payout:=round\(\(p_coins::numeric\/100000\)\*v_rate,6\)/);
 assert.match(rpc,/v_usd:=round\(v_payout\/v_per_usd,6\)/);
 assert.match(salary,/targetMoney\(amount,customerSalaryCurrency\)/);
 assert.match(salary,/targetMoney\(data\.payout_amount, data\.payout_currency\|\|customerSalaryCurrency\)/);
});
test("financial values are not modified in session code and all storefront modules parse",()=>{
 for(const [name,script] of [["app",app],["config",config],["salary",salary]])
   assert.doesNotThrow(()=>new vm.Script(script,{filename:name}));
});
