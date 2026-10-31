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
test("UUID status recovery is read-only, accepts an external ID and rejects a mismatched reference",async()=>{
  const result=await callProvider(provider,"test","status",{order:ref,by_uuid:true},async(url,options)=>{
    assert.equal(options.method,"GET");assert.equal(url.pathname,"/client/api/check");
    assert.equal(url.searchParams.get("orders"),`[${ref}]`);assert.equal(url.searchParams.get("uuid"),"1");
    return new Response(JSON.stringify({status:"OK",data:[{order_id:"ID_original",order_uuid:ref,status:"wait"}]}));
  });
  assert.equal(result.order_id,"ID_original");assert.equal(result.status,"pending");
  assert.equal(await callProvider(provider,"test","status",{order:ref,by_uuid:true},async()=>
    new Response(JSON.stringify({status:"OK",data:[]}))),null);
  await assert.rejects(callProvider(provider,"test","status",{order:ref,by_uuid:true},async()=>
    new Response(JSON.stringify({status:"OK",data:[{order_id:"ID_other",order_uuid:"other",status:"accept"}]}))));
});
test("uncertain-order worker recovers by UUID without add, debit or refund; empty lookup stays safe",async()=>{
  const src=readFileSync(new URL("../supabase/functions/f90-platform/index.ts",import.meta.url),"utf8");
  const chunk=src.slice(src.indexOf("async function work()"),src.indexOf("function cleanCommerce("));
  for(const found of [true,false]){
    const calls=[],transitions=[],updates=[];
    const db={from:table=>({update:patch=>({eq:async()=>{updates.push({table,patch});return {data:null}}}),
      delete:()=>({lt:async()=>({data:null})})})};
    const work=vm.runInNewContext(stripTypeScriptTypes(chunk)+";work",{
      db,SHIHAB_ID:"shihab",ProviderError:class extends Error{},check:r=>r.data,text:v=>String(v),
      backfillCompletedSupplierNames:async()=>0,
      rpc:async(name,args)=>{
        if(name==="f90_claim_work")return [{id:ref,provider_id:"shihab",status:"review",provider_status:"submission_uncertain"}];
        transitions.push({name,args});return {};
      },providerAction:async(id,action,args)=>{calls.push({id,action,args});
        return found?{order_id:"ID_original",supplier_status:"wait",status:"pending"}:null;}});
    await work();
    assert.equal(calls.length,1);assert.equal(calls[0].action,"status");assert.equal(calls[0].args.by_uuid,true);
    assert.equal(transitions.length,found?1:0);
    if(found){assert.equal(transitions[0].args.p_status,"processing");assert.equal(transitions[0].args.p_external,"ID_original");}
    assert.ok(updates.every(u=>u.table==="f90_orders"));
  }
});
