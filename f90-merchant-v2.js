(function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const code=(text)=>'<pre class="f90-api-code" dir="ltr"><code>'+esc(text)+'</code></pre>';
const section=(id,verb,title,desc,request,response)=>'<section class="f90-api-reference" id="api-'+id+'"><div class="f90-api-method"><span>'+verb+'</span><h3>'+title+'</h3></div><p>'+desc+'</p>'+code(request)+(response?'<h4>مثال الاستجابة</h4>'+code(response):'')+'</section>';
function docs(endpoint,logo){
 const base="https://www.f90card.online";
 const api=base+"/api/v1";
 const get=base+"/client/api";
 const block=(title,inner)=>'<section class="f90-y-doc-section"><h2>'+title+'</h2><div class="f90-y-doc-card">'+inner+'</div></section>';
 const route=(method,path,description,extra="")=>'<div class="f90-y-route"><div class="f90-y-route-head"><span class="f90-y-verb">'+method+'</span><code dir="ltr">'+esc(path)+'</code></div><p>'+description+'</p>'+extra+'</div>';
 const getCode=(path)=>code('GET '+base+path+'\napi-token: YOUR_F90_API_TOKEN');
 const postCode=(obj)=>code('POST '+api+'\nContent-Type: application/json\nx-f90-key: YOUR_F90_API_TOKEN\n\n'+JSON.stringify(obj,null,2));
 const example=(obj)=>'<h4>Response Example</h4>'+code(JSON.stringify(obj,null,2));
 return '<div class="f90-y-docs" dir="ltr"><header class="f90-y-doc-title"><strong>◉ API Documentation</strong><a href="#/developers">API TOKEN</a></header><main class="f90-y-doc-content">'+
 '<p class="f90-y-base">Base URL: '+base+'/</p>'+
 '<div class="f90-y-auth"><strong>Authentication Required</strong><p>Include this header in API requests:</p>'+code('api-token: YOUR_F90_API_TOKEN')+'<p>Requests that create orders use POST /api/v1 with x-f90-key and JSON. Never put your token in a URL.</p></div>'+
 block('Profile',route('GET','/client/api/profile','Retrieves your merchant balance and profile.',getCode('/client/api/profile')))+
 block('Products',route('GET','/client/api/products','Retrieves available services, prices, quantity rules and required fields.',getCode('/client/api/products')+example({data:{products:[{service:"product-uuid",name:"Example service",rate:1.25,currency:"USD",min:1000,max:1000000,fields:[{id:"account_id",required:true}]}]}}))+
 route('GET','/client/api/products?products_id=id1,id2','Filter by product IDs only if supported by the endpoint; for guaranteed filtering use POST services and filter by service UUID locally.')+
 route('POST','/api/v1','Retrieve all service categories.',postCode({action:"categories"})))+
 block('Content',route('POST','/api/v1','Read categories and service details using the official JSON API.',postCode({action:"services"})+postCode({action:"service",service:"product-uuid"})))+
 block('Order', '<div class="f90-y-alert"><strong>Important: Idempotent orders</strong><p>Generate one unique idempotency_key for each order and reuse the same key with the same payload when retrying. Never send an order through GET.</p></div>'+
 route('POST','/api/v1','Get the final price before submitting an order.',postCode({action:"quote",product_id:"product-uuid",quantity:1000}))+
 route('POST','/api/v1','Creates an order and returns its F90 order ID. The fields must match the selected service.',postCode({action:"checkout",product_id:"product-uuid",quantity:1000,fields:{account_id:"123456"},idempotency_key:"ecbdd545-e616-4aee-8770-7eefa977bcd0",expected_total_usd:1.25})+example({data:{id:"order-uuid",status:"queued",total_usd:1.25}})))+
 block('Check Orders',route('GET','/client/api/check?orders=%5B%22ORDER_UUID%22%5D','Checks existing orders by their returned IDs.',getCode('/client/api/check?orders=%5B%22ORDER_UUID%22%5D'))+
 route('POST','/api/v1','Read order status and events.',postCode({action:"status",order:"order-uuid"}))+
 route('POST','/api/v1','List order history.',postCode({action:"history",kind:"orders",offset:0})))+
 block('Error Codes','<table class="f90-y-errors"><thead><tr><th>Code</th><th>Description</th></tr></thead><tbody>'+
 [['F90_AUTH','Invalid or missing token'],['F90_FORBIDDEN','Insufficient permission or IP not allowed'],['F90_INSUFFICIENT_BALANCE','Insufficient balance'],['F90_QUANTITY','Invalid quantity'],['F90_FIELDS','Invalid or missing fields'],['F90_REFILLING','Service temporarily unavailable'],['F90_PRICE_CHANGED','Price changed: request a new quote'],['F90_IDEMPOTENCY_CONFLICT','Order key reused with different details']].map(x=>'<tr><td>'+esc(x[0])+'</td><td>'+esc(x[1])+'</td></tr>').join('')+'</tbody></table>')+
 '<footer class="f90-y-footer">F90 CARD API Documentation · All rights reserved.</footer></main></div>';
}
function tokens(keys,verified,logo,endpoint){
 const active=keys.find(k=>k.is_active);
 const form=verified?'<form id="keyForm" class="f90-y-token-form"><label><span>اسم المفتاح</span><input name="name" required maxlength="100" value="متجري"></label><label><span>بروتوكول الربط</span><input readonly value="F90 CARD API" dir="ltr"></label><label><span>IP المسموح لها بالوصول لحسابك (اختياري)</span><textarea name="allowed_ips" rows="4" dir="ltr" placeholder="عنوان IP واحد في كل سطر"></textarea></label><label class="f90-y-check"><input type="checkbox" name="allow_all_ips" checked> السماح بكل عناوين IP</label><p class="f90-y-warning">السماح بكل عناوين IP مناسب للاختبار فقط. عند تشغيل المتجر يُفضّل تحديد عنوان خادمك.</p><button type="submit" class="f90-y-save">'+(active?'إصدار مفتاح بديل':'إنشاء مفتاح API')+'</button></form>':'<p>يلزم توثيق حساب التاجر لإنشاء مفتاح API.</p>';
 return '<div class="f90-y-token" dir="rtl"><div class="f90-y-token-top"><img src="'+esc(logo)+'" alt="F90 CARD"><h1>API</h1><p>معلومات حسابك</p></div><section class="f90-y-token-panel"><h2>API TOKEN</h2><p>مفتاح التاجر خاص بحسابك ويظهر كاملًا عند إصداره فقط.</p>'+(active?'<div class="f90-y-existing"><span>المفتاح النشط</span><code dir="ltr">'+esc(active.token_prefix)+'</code><button class="button secondary small" data-action="key-revoke" data-id="'+esc(active.id)+'">إلغاء المفتاح</button></div>':'<p>لم تُصدر مفتاحًا بعد.</p>')+form+'</section><section class="f90-y-token-panel"><h2>ما يلزمه المبرمج</h2><p>انسخ الرابط التالي للمبرمج:</p><div class="f90-y-link"><code dir="ltr">https://www.f90card.online/#/api-guide</code><button type="button" data-f90-copy-guide>نسخ</button></div><p>أرسل مفتاح API للمبرمج عبر قناة خاصة وآمنة. لا تضعه في عنوان الرابط أو واجهة موقعك.</p><a href="#/api-guide" class="button secondary">API Documentation</a></section></div>';
}
document.addEventListener("click",async event=>{
const button=event.target.closest?.("[data-f90-copy-api], [data-f90-copy-get], [data-f90-copy-guide]");
if(!button)return;
const value=button.hasAttribute("data-f90-copy-guide")?"https://www.f90card.online/#/api-guide":button.hasAttribute("data-f90-copy-get")
  ?"https://www.f90card.online/client/api/products"
  :"https://www.f90card.online/api/v1";
try{await navigator.clipboard.writeText(value);button.textContent="تم نسخ الرابط";}
catch{button.textContent="انسخ الرابط الظاهر أعلاه";}
});
window.F90MerchantViews={docs,tokens};
})();