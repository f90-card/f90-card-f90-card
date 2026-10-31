import test from "node:test";
import assert from "node:assert/strict";
import {supplierDetailEvidence,fetchSupplierDetail} from "../supabase/functions/f90-platform/shihab-details.mjs";
import "../f90-checkout-service-presentation.js";
test("official manual description confirms execution but supplies no invented ETA",()=>{
 const p=supplierDetailEvidence({id:24793,description:'<p>هذا المنتج يعمل بشكل يدوي يرجي التحلي بصبر لحين تنفيذ الطلب</p>',time_from:"08:00",time_to:"22:00"});
 assert.equal(p.mode,"manual");assert.equal(p.delivery,null);
 const ui=globalThis.F90CheckoutPresentation.instructions({name:"test"},{fulfillment:"manual",fulfillment_status:"confirmed",supplier_details_checked_at:"now",supplier_delivery_time:p.delivery},[],false);
 assert.match(ui.header,/يدوي/);assert.match(ui.timingLabel,/لم يحدد/);assert.ok(!ui.timingLabel.includes("120"));
});
test("supplier's explicit 5–20 second estimate is retained without inferring automation",()=>{
 const p=supplierDetailEvidence({id:1,description:"تجربة شحن سريعة بلا انتظار يصل طلبك خلال 5 إلى 20 ثانية فقط من 5 الي 20 ثانية مدة التنفيذ"});
 assert.equal(p.mode,null);assert.equal(p.delivery.min_minutes,5/60);assert.equal(p.delivery.max_minutes,20/60);
 const ui=globalThis.F90CheckoutPresentation.instructions({},{fulfillment:"manual",fulfillment_status:"unconfirmed",supplier_details_checked_at:"now",supplier_delivery_time:p.delivery},[],false);
 assert.match(ui.header,/لم يحدده/);assert.match(ui.timingLabel,/حسب المورّد/);assert.match(ui.timingLabel,/20/);
});
test("bundle validity, included phone minutes, schedules, null and conflicting claims remain unclassified",()=>{
 for(const description of ["الباقة 1500 دقيقة صلاحية 30 يوم","ادخل رقم اللاعب يدويا","", "تنفيذ غير تلقائي", "المنتج يعمل بشكل يدوي. الشحن تلقائي"]){
  const p=supplierDetailEvidence({id:2,description,time_from:5,time_to:20,product_type:"amount"});
  assert.equal(p.mode,null);assert.equal(p.delivery,null);
 }
 assert.equal(supplierDetailEvidence({id:3,description:"الشحن تلقائي"}).mode,"automatic");
});
test("detail fetch validates ID before trusting the supplier response and never sends a credential",async()=>{
 const p=await fetchSupplierDetail("7",async(url,options)=>{
  assert.equal(url,"https://api.shihabcard.com/api/client/product/get/7?lang=ar");
  assert.equal(options.method,"GET");assert.equal(options.headers["api-token"],undefined);
  return new Response(JSON.stringify({status:"OK",data:{id:7,description:"تنفيذ يدوي"}}));
 });assert.equal(p.mode,"manual");
 await assert.rejects(fetchSupplierDetail("7",async()=>new Response(JSON.stringify({status:"OK",data:{id:8}}))));
});
test("mixed units and explicit upper-bound execution durations exclude operating hours",()=>{
 const design=supplierDetailEvidence({id:1,description:"الوقت المقدر لتنفيذ الطلب: من 1 ساعة إلى 24 ساعة فقط"});
 assert.equal(design.delivery.min_minutes,60);assert.equal(design.delivery.max_minutes,1440);
 const manual=supplierDetailEvidence({id:2,description:"هذا المنتج يعمل بشكل يدوي من الساعة 10 صباحاً حتى 12 مساءً يتم تنفيذ الطلب خلال 45 دقيقة"});
 assert.equal(manual.mode,"manual");assert.equal(manual.delivery.min_minutes,null);assert.equal(manual.delivery.max_minutes,45);
 const verbal=supplierDetailEvidence({id:3,description:"معالجة الطلب من دقيقة حتى 45 دقيقة ساعات العمل من 10 صباحا حتى 1 منتصف الليل"});
 assert.equal(verbal.delivery.min_minutes,1);assert.equal(verbal.delivery.max_minutes,45);
});
