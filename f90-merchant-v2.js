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
 const info=active?'<div class="f90-y-current"><span>المفتاح الحالي</span><code dir="ltr">'+esc(active.token_prefix)+'</code><span class="f90-y-key-state">نشط</span><button class="f90-y-revoke" data-action="key-revoke" data-id="'+esc(active.id)+'">إلغاء المفتاح</button></div>':'<p class="f90-y-no-key">لا يوجد مفتاح API نشط.</p>';
 const form=verified?'<form id="keyForm" class="f90-y-token-form"><input type="hidden" name="protocol" value="api_token_get"><input type="hidden" name="name" value="مفتاح API"><label class="f90-y-field"><span>الآي بي المسموح لها بالوصول لحسابك</span><textarea name="allowed_ips" rows="5" dir="ltr" placeholder="ضع عنوان IP الخاص بخادمك في كل سطر"></textarea></label><label class="f90-y-check"><input type="checkbox" name="allow_all_ips" checked> السماح لكل عناوين IP</label><p class="f90-y-warning">لأمان حسابك، السماح بكل عناوين IP مناسب للاختبار فقط. حدّد عناوين خادمك عند تشغيل الربط الفعلي.</p><div class="f90-y-form-actions"><button type="submit" class="f90-y-save">'+(active?'إصدار مفتاح جديد بدل الحالي':'إنشاء مفتاح API')+'</button></div></form>':'<p>يجب توثيق حساب التاجر لإصدار مفتاح API.</p>';
 return '<div class="f90-y-token" dir="rtl"><header class="f90-y-token-top"><img src="'+esc(logo)+'" alt="F90 CARD"><h1>API</h1><p>معلومات حسابك</p></header><section class="f90-y-token-panel"><h2>API TOKEN</h2><div class="f90-y-token-display" id="f90MerchantSecret"><span>رمز الربط الخاص بك</span><div class="f90-y-secret-line"><code dir="ltr">'+esc(active?.token_prefix||"لم يتم إنشاء مفتاح بعد")+'</code><button type="button" class="f90-y-copy" data-f90-reveal="'+esc(active?.id||"")+'">نسخ</button></div><small>يمكن عرض ونسخ المفاتيح الجديدة في أي وقت من حساب التاجر. المفاتيح القديمة تتطلب إصدار بديل.</small></div>'+info+form+'</section><section class="f90-y-token-panel f90-y-programmer"><h2>ما يلزمه المبرمج</h2><p>API Documentation</p><div class="f90-y-link"><code dir="ltr">https://www.f90card.online/#/api-guide</code><button type="button" data-f90-copy-guide>نسخ الرابط</button></div><p>أرسل الرابط للمبرمج، وشاركه الرمز السري بشكل خاص. جميع عمليات الشراء تُرسل من خادم المتجر باستخدام POST.</p><a href="#/api-guide" class="f90-y-doc-button">فتح دليل المبرمجين</a></section></div>';
}
function showNewToken(token){
 const box=document.getElementById("f90MerchantSecret");if(!box||!token)return false;
 const line=box.querySelector(".f90-y-secret-line");if(!line)return false;
 line.querySelector("code").textContent=token;
 const button=line.querySelector("button");button.disabled=false;button.dataset.f90Secret=token;button.textContent="نسخ الرمز";
 const note=box.querySelector("small");if(note)note.textContent="يمكنك عرض ونسخ هذا الرمز لاحقًا من حسابك. احتفظ به في خادمك فقط.";
 box.classList.add("f90-y-secret-new");return true;
}
document.addEventListener("click",async event=>{
const button=event.target.closest?.("[data-f90-copy-api], [data-f90-copy-get], [data-f90-copy-guide], [data-f90-copy-secret]");
if(!button)return;
const value=button.hasAttribute("data-f90-copy-secret")?button.dataset.f90Secret:button.hasAttribute("data-f90-copy-guide")?"https://www.f90card.online/#/api-guide":button.hasAttribute("data-f90-copy-get")
  ?"https://www.f90card.online/client/api/products"
  :"https://www.f90card.online/api/v1";
try{await navigator.clipboard.writeText(value);button.textContent=button.hasAttribute("data-f90-copy-secret")?"تم نسخ المفتاح":"تم نسخ الرابط";}
catch{button.textContent="انسخ الرابط الظاهر أعلاه";}
});
window.F90MerchantViews={docs,tokens,showNewToken};
})();