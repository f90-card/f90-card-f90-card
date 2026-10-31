import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stripTypeScriptTypes} from "node:module";
import vm from "node:vm";
import {executionEvidence,shihabSnapshot,shihabStatus,shihabPublicProduct} from "../supabase/functions/f90-platform/shihab.mjs";
import {callProvider,normalizeStatus} from "../supabase/functions/f90-platform/provider.mjs";
const provider={adapter:"shihab",endpoint:"https://api.shihabcard.com",config:{}};
const ref="12345678-1234-4234-8234-123456789012";
const product={id:24793,name:"test",available:true,price:1,product_type:"amount",qty_values:{min:1,max:10}};
test("quantity, packaging, price and service name never imply an execution method",()=>{
  for(const product_type of ["quantity","amount","package","specificPackage","automatic"])
    assert.equal(executionEvidence({...product,product_type,name:"Automatic"}),null);
  assert.equal(executionEvidence({...product,execution_type:"manual"}).mode,"manual");
  assert.equal(executionEvidence({...product,execution_type:"auto"}).mode,"automatic");
  assert.equal(executionEvidence({...product,execution_type:"auto",fulfillment:"manual"}),null);
});
test("catalog rejects partial/malformed or duplicate responses before modifying anything",()=>{
  const items=Array.from({length:210},(_,id)=>({...product,id}));
  const snapshot=shihabSnapshot(items);
  assert.equal(snapshot.length,210);
  assert.ok(snapshot.every(s=>s.evidence===null));
  assert.throws(()=>shihabSnapshot(items.slice(0,5)));
  assert.throws(()=>shihabSnapshot([...items,items[0]]));
  assert.throws(()=>shihabSnapshot(items.map(p=>({...p,available:"true"}))));
  const clean=shihabSnapshot(items.map(p=>({...p,token:"must-not-be-retained"})));
  assert.ok(clean.every(p=>!JSON.stringify(p).includes("must-not-be-retained")));
});
test("both execution labels use the same API submission with stable order_uuid",async()=>{
  for(const fulfillment of ["manual","automatic"]){
    let calls=0;
    const result=await callProvider({...provider,fulfillment},"test-secret","add",{
      service:"24793",quantity:1,client_reference:ref,params:{"Player ID":"safe-test"}},async(url,options)=>{
      calls++;
      assert.equal(url.pathname,"/client/api/newOrder/24793/params");
      assert.equal(url.searchParams.get("order_uuid"),ref);
      assert.equal(url.searchParams.get("Player ID"),"safe-test");
      assert.equal(options.headers["api-token"],"test-secret");
      return new Response(JSON.stringify({status:"OK",data:{order_id:321}}));
    });
    assert.equal(calls,1);assert.equal(result.order_id,321);
  }
});
test("ambiguous paid response is never treated as a definite rejection",async()=>{
  await assert.rejects(callProvider(provider,"test","add",{service:"24793",quantity:1,client_reference:ref},async()=>{
    throw new Error("timeout after supplier accepted");
  }),e=>e.uncertain===true);
});
test("supplier states preserve pending, completion, rejection and cancellation",async()=>{
  for(const [raw,expected] of [["wait","pending"],["pending","pending"],["processing","processing"],["accept","completed"],["reject","rejected"],["cancelled","cancelled"]]){
    assert.equal(shihabStatus(raw),expected);
    const r=await callProvider(provider,"test","status",{order:"321"},async()=>
      new Response(JSON.stringify({status:"OK",data:[{order_id:321,status:raw}]})));
    assert.equal(r.status,expected);assert.equal(r.supplier_status,raw);
    assert.equal(normalizeStatus(r,10,1).status,["rejected","cancelled"].includes(expected)?"failed":expected==="completed"?"completed":"processing");
  }
  await assert.rejects(callProvider(provider,"test","status",{order:"321"},async()=>
    new Response(JSON.stringify({status:"OK",data:[{order_id:999,status:"accept"}]}))));
});
test("publication preserves explicit hidden, admin-only and inactive products",()=>{
  const pr={config:{catalog_visibility:"public"}};
  assert.equal(shihabPublicProduct({is_active:true},pr),true);
  for(const catalog_visibility of ["hidden","admin","private"])
    assert.equal(shihabPublicProduct({is_active:true,commerce:{catalog_visibility}},pr),false);
  assert.equal(shihabPublicProduct({is_active:true,commerce:{admin_only:true}},pr),false);
  assert.equal(shihabPublicProduct({is_active:false},pr),false);
  assert.equal(shihabPublicProduct({is_active:true},{config:{catalog_visibility:"hidden"}}),false);
});
test("manager edits cannot erase confirmed supplier evidence, stock or hidden guards",()=>{
  const src=readFileSync(new URL("../supabase/functions/f90-platform/index.ts",import.meta.url),"utf8");
  const chunk=src.slice(src.indexOf("function cleanCommerce("),src.indexOf("async function catalogSave("));
  const clean=vm.runInNewContext(stripTypeScriptTypes(chunk)+";cleanCommerce",{
    cleanCurrencyPricing:()=>({}),integer:v=>Number(v),num:v=>Number(v),text:v=>String(v??""),AppError:Error});
  const existing={fulfillment:"automatic",fulfillment_status:"confirmed",fulfillment_evidence:{source:"supplier"},
    supplier_available:false,catalog_visibility:"hidden",admin_only:true};
  const updated=clean({fulfillment:"manual",prices:{USD:10},fields:[]},existing);
  for(const key of Object.keys(existing))assert.equal(JSON.stringify(updated[key]),JSON.stringify(existing[key]));
  assert.equal(clean({prices:{USD:10},fulfillment_status:"unconfirmed"}).fulfillment_status,"unconfirmed");
});
