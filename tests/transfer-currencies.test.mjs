import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('money transfer snapshots method currency, server rate and wallet USD charge',()=>{
 const sql=read('supabase/migrations/20261016041000_transfer_method_fees.sql');
 for(const value of ['v_method->>\'currency\'','public.f90_rates','target_currency,target_amount,target_per_usd','v_net_usd:=round(p_net/v_rate,6)','v_method->>\'fee_percent\'','for update','v_balance-v_total'])
   assert.ok(sql.includes(value),value);
});
test('customer and manager forms use each transfer method currency and fee',()=>{
 const ui=read('f90-special.js'),admin=read('f90-special-admin.js');
 assert.match(ui,/visibleRates\.find\(x=>x\.currency===currency/);
 assert.match(ui,/targetMoney\(v,currency\)/);
 assert.match(ui,/p_net:value/);
 assert.match(admin,/name="method_currency"/);
 assert.match(admin,/name="method_fee"/);
 assert.match(admin,/methods}\s*}/);
});
