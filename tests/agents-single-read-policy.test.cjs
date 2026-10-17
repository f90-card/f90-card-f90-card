const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("deduplicated agent policies retain identical public and staff visibility",()=>{
 const sql=fs.readFileSync("supabase/migrations/20261017184000_f90_agents_read_policy_single_per_role.sql","utf8");
 assert.match(sql,/f90_agents_public_read on public\.f90_store_agents\s+for select to anon using \(is_active\)/i);
 assert.match(sql,/f90_agents_authenticated_read on public\.f90_store_agents\s+for select to authenticated\s+using \(is_active or .*f90_private\.my_role\(\)/is);
 assert.match(sql,/drop policy if exists f90_agents_staff_read/i);
 assert.doesNotMatch(sql,/update public\.|delete from public\.|truncate/i);
});
