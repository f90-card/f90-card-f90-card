import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("telegram alert queue recognizes registrations, manual orders and service requests",()=>{
 const sql=read("supabase/migrations/20261016031000_telegram_manual_and_new_users.sql");
 for(const name of ["profiles","f90_orders","f90_special_requests"])
  assert.match(sql,new RegExp("TG_TABLE_NAME='"+name+"'"));
 for(const event of ["user_new","order_manual","manual_request"])
  assert.ok(sql.includes("ev:='"+event+"'"),event);
 assert.match(sql,/NEW\.fulfillment IS DISTINCT FROM 'manual'/);
 assert.match(sql,/ON CONFLICT\(event_key\) DO NOTHING/);
 assert.match(sql,/config->'telegram_alerts'->>opt='false'/);
 assert.match(sql,/AFTER INSERT ON public\.profiles/);
 assert.match(sql,/AFTER INSERT ON public\.f90_orders/);
});
test("Telegram dispatch formats only minimal new-user and manual-order details",()=>{
 const source=read("supabase/functions/f90-telegram-alerts/index.ts");
 for(const event of ["user_new","order_manual","manual_request"])
  assert.ok(source.includes('row.event_type==="'+event+'"'),event);
 assert.match(source,/escapeHTML\(d\.product_name\)/);
 assert.match(source,/escapeHTML\(d\.service\)/);
 assert.doesNotMatch(source,/d\.email|d\.phone|d\.password|d\.identity_document/);
});
test("admin chooses every Telegram event type independently, home popup is optional",()=>{
 const admin=read("admin.js"),app=read("app.js");
 assert.doesNotThrow(()=>new vm.Script(admin));
 assert.doesNotThrow(()=>new vm.Script(app));
 for(const key of ["telegram_new_users","telegram_manual_orders","telegram_manual_requests","popup_home_each_entry"])
  assert.ok(admin.includes(key),key);
 assert.match(admin,/every_home_visit: form\.elements\.popup_home_each_entry\.checked/);
 assert.match(app,/announcement\.every_home_visit/);
 assert.match(app,/S\.homeAnnouncementShown/);
 assert.match(app,/if\(page\) S\.homeAnnouncementShown=false/);
});
