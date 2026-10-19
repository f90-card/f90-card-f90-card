import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261016234000_yassen_resilient_price_sync.sql");
const api=read("supabase/functions/f90-platform/index.ts");

test("fetch Yassen catalog every ten minutes",()=>{
  assert.ok(sql.includes("cron.alter_job(the_job,schedule=>'*/10 * * * *')"));
  assert.ok(sql.includes("f90-yassen-fetch"));
  assert.ok(sql.includes("yassen_import_pending"));
});

test("bad supplier prices quarantine one service without blocking the catalog",()=>{
  for(const x of ["new_price>1000000","skipped:=skipped+1","CONTINUE;",
     "sync_skipped_prices","sync_last_success","sync_last_catalog_count",
     "supplier_refilling"])assert.ok(sql.includes(x),x);
  assert.ok(!sql.includes("RAISE EXCEPTION 'Invalid converted supplier price'"));
});

test("prior and future manager pricing edits remain protected",()=>{
  for(const x of ["SET auto_margin=false","IF link.auto_margin THEN"])
    assert.ok(sql.includes(x),x);
  for(const x of ["let editedYassenPrice = false",
    'selectedProvider.adapter==="yassen"',
    "Math.abs(chosenPrice-previousPrice)>0.0000005",
    "auto_margin: !!i.auto_margin && !editedYassenPrice"])
    assert.ok(api.includes(x),x);
});

test("supplier import does not replace owner-edited product details",()=>{
  for(const x of ["ON CONFLICT(slug) DO NOTHING",
    "price=greatest(0.01,round(new_price,2))",
    "supplier_previous_availability"])
    assert.ok(sql.includes(x),x);
  for(const x of ["SET name=","SET image_url=","SET category_id=",
    "DELETE FROM public.products"])
    assert.ok(!sql.includes(x),x);
});
