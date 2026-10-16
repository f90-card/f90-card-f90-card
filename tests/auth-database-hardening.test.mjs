import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("app.js");
const config=read("config.js");
const admin=read("admin.js");
const fix=read("supabase/migrations/20261016223500_auth_data_rls_query_and_review_index_fixes.sql");
const combine=read("supabase/migrations/20261016224300_combine_salary_row_policies_to_reduce_query_work.sql");

test("website keeps existing password login, registration and password recovery",()=>{
 assert.match(app,/auth\.signInWithPassword/);
 assert.match(app,/auth\.signUp/);
 assert.match(app,/auth\.resetPasswordForEmail/);
 assert.match(app,/auth\(mode = S\.authMode\)/);
 assert.match(admin,/auth\.signInWithPassword/);
});

test("auth callback confirms absence of session before redirecting to login",()=>{
 const auth=app.slice(app.indexOf("onAuthStateChange"),app.indexOf("  // Restore stale account details"));
 assert.match(auth,/event === "SIGNED_OUT"/);
 assert.match(auth,/setTimeout\(async \(\) =>/);
 assert.match(auth,/result=await A\.client\.auth\.getSession\(\)/);
 assert.match(auth,/if\(result\.error\)/);
 assert.match(auth,/if\(result\.data\?\.session\)/);
 assert.match(auth,/if \(privatePages\.includes\(currentPage\)/);
 assert.ok(auth.indexOf("result=await A.client.auth.getSession()")<auth.indexOf('location.hash = "#/auth"'));
});

test("login survives catalog outage or delayed F90 profile response",()=>{
 assert.match(app,/if\(requestedPage==="auth"\|\|requestedPage==="register"\)/);
 assert.match(app,/auth\(requestedPage==="register"\?"register":"login"\)/);
 assert.match(app,/const restored = await refreshMe\(\)/);
 assert.match(app,/if\(validSession\)/);
 assert.match(app,/S\.walletStale=true/);
 assert.match(config,/persistSession: !!storage/);
 assert.match(config,/autoRefreshToken: true/);
});

test("schema migrations preserve access restriction and speed up review foreign keys",()=>{
 assert.match(fix,/CREATE INDEX IF NOT EXISTS f90_salary_reviewed_by_idx/);
 assert.match(fix,/CREATE INDEX IF NOT EXISTS f90_transfer_reviewed_by_idx/);
 assert.match(fix,/ALTER POLICY f90_salary_self_read/);
 assert.match(fix,/ALTER POLICY f90_transfer_self_read/);
 assert.match(combine,/user_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(combine,/r\.user_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(combine,/r\.role=ANY\(ARRAY\['manager'/);
 assert.doesNotMatch(fix+combine,/DELETE FROM|TRUNCATE|DROP TABLE|UPDATE public\.f90_wallets/);
});

test("all browser JavaScript remains syntactically valid",()=>{
 for(const [name,c] of [["app.js",app],["config.js",config],["admin.js",admin]])
   assert.doesNotThrow(()=>new vm.Script(c,{filename:name}));
});
