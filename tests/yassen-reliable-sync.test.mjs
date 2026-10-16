import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const m=read("supabase/migrations/20261016234000_yassen_resilient_price_sync.sql");
const api=read("supabase/functions/f90-platform/index.ts");

test("Yassen polls every ten minutes while the import worker checks each minute",()=>{
 assert.match(m,/cron\.alter_job\(the_job,schedule=>'\\*\\/10 \\* \\* \\* \\*'\)/);
 assert.match(m,/f90-yassen-fetch/);
 assert.match(m,/yassen_import_pending/);
});

test("invalid provider pricing quarantines only the affected service and keeps sync alive",()=>{
 assert.match(m,/new_price>1000000/);
 assert.match(m,/skipped:=skipped\\+1/);
 assert.match(m,/CONTINUE;/);
 assert.doesNotMatch(m,/RAISE EXCEPTION 'Invalid converted supplier price'/);
 assert.match(m,/sync_skipped_prices/);
 assert.match(m,/sync_last_catalog_count/);
 assert.match(m,/sync_last_success/);
 assert.match(m,/supplier_refilling/);
});

test("previously customized prices and subsequent manager price changes are protected",()=>{
 assert.match(m,/SET auto_margin=false/);
 assert.match(m,/abs\\(\\(p\\.commerce->'prices'->>'USD'\\)::numeric/);
 assert.match(m,/IF link\\.auto_margin THEN/);
 assert.match(api,/let editedYassenPrice = false/);
 assert.match(api,/selectedProvider\\.adapter==="yassen"/);
 assert.match(api,/Math\\.abs\\(chosenPrice-previousPrice\\)>0\\.005/);
 assert.match(api,/auto_margin: !!i\\.auto_margin && !editedYassenPrice/);
});

test("only new supplier IDs can be imported without replacing owner product designs",()=>{
 assert.match(m,/NOT EXISTS \\(SELECT 1 FROM public\\.products old WHERE old\\.slug=/);
 assert.match(m,/ON CONFLICT\\(slug\\) DO NOTHING/);
 assert.match(m,/price=greatest\\(0\\.01,round\\(new_price,2\\)\\)/);
 assert.doesNotMatch(m,/SET name=|SET image_url=|SET category_id=|DELETE FROM public\\.products/);
 assert.match(m,/supplier_previous_availability/);
});
