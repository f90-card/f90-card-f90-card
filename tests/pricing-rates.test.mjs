import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("restores historical supplier and store conversion without editing newer user settings",()=>{
 const rollback=read("supabase/migrations/20261016024500_restore_previous_store_pricing.sql");
 assert.match(rollback,/margin_percent=10/);
 assert.match(rollback,/cost_usd=round\(i\.cost_usd\*3\.20\/3\.365,6\)/);
 assert.match(rollback,/per_usd=3\.365/);
 assert.match(rollback,/currency='USD'/);
 assert.match(rollback,/supplier_fx_migrated/);
 assert.match(rollback,/p\.updated_at > '2026-10-15 22:31:00/);
 assert.doesNotMatch(rollback,/UPDATE public\.f90_wallets|UPDATE public\.f90_deposits|UPDATE public\.f90_wallet_ledger/i);
});
test("supplier importer again uses the original 3.365 rate table instead of private FX",()=>{
 const source=read("supabase/functions/f90-platform/index.ts");
 const updated=read("admin.js"),sql=read("supabase/migrations/20261016024500_restore_previous_store_pricing.sql");
 assert.match(source,/const exchange = Number\(rate\.per_usd\)/);
 assert.match(source,/const cost = supplierPrice \/ exchange;/);
 assert.doesNotMatch(source,/extraFor\(chosenCategoryId\)/);
 assert.doesNotMatch(source,/supplier_ils_per_usd/);
 assert.doesNotMatch(updated,/pricing-center/);
 assert.match(sql,/SELECT per_usd INTO fx FROM public\.f90_rates/);
});
test("USD is default on new visits but old personal currency preferences remain",()=>{
 const source=read("app.js");
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.match(source,/S\.currency = localStorage\.getItem\("f90-currency"\) \|\| "USD"/);
 assert.match(source,/if \(!S\.currencyPreference\) S\.currency = S\.settings\.currency \|\| "USD"/);
 assert.doesNotMatch(source,/data-action="currency-welcome"/);
 assert.match(source,/S\.currencyPreference = true/);
});
test("radio, device improvements and maintenance controls were preserved",()=>{
 const scene=read("f90-welcome-scene.js"),radio=read("f90-media-player.js"),css=read("f90-special.css"),app=read("app.js");
 assert.doesNotThrow(()=>new vm.Script(scene));
 assert.doesNotThrow(()=>new vm.Script(radio));
 assert.doesNotMatch(scene,/p\.link_url|laptop\.link_url/);
 assert.match(radio,/value===null \? \.02/);
 assert.match(css,/f90-maintenance-content/);
 assert.match(css,/f90RadioNeonWaves/);
 assert.ok(app.includes('!["manager", "admin"].includes(S.me?.role)'));
 assert.match(app,/href="#\/profile"/);
});
