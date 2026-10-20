(function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const code=(text)=>'<pre class="f90-api-code" dir="ltr"><code>'+esc(text)+'</code></pre>';
const section=(id,verb,title,desc,request,response)=>'<section class="f90-api-reference" id="api-'+id+'"><div class="f90-api-method"><span>'+verb+'</span><h3>'+title+'</h3></div><p>'+desc+'</p>'+code(request)+(response?'<h4>Example response</h4>'+code(response):'')+'</section>';
function docs(endpoint,logo){
const base=JSON.stringify({action:"services"},null,2);
const currency='All monetary values in this API use USD. Product IDs are UUID strings. Supply customer fields exactly as returned by the service.';
let intro='<section class="f90-api-doc-head"><img src="'+esc(logo)+'" alt="F90 CARD" loading="lazy"><div><span>F90 CARD · OFFICIAL MERCHANT API</span><h1>API Documentation</h1><p>بوابة ربط المتاجر: استخدم مفتاح API من خادم متجرك لجلب الخدمات والأسعار وإنشاء الطلبات وتتبعها. رتبة «وكيل شحن» مخصصة لعمولات إحالة العملاء داخل F90، وليست مفتاح API. This guide documents the F90 production API, not the supplier API.</p><a href="#/developers" class="button secondary">Manage your API token</a></div></section>';
let nav='<nav class="f90-api-doc-nav" aria-label="API sections">'+["Overview","Authentication","Categories","Products","Product details","Balance","Quote","Create order","Order status","History","Errors","Security"].map(x=>'<a href="#api-'+x.toLowerCase().replace(/ /g,"-")+'">'+x+'</a>').join("")+'</nav>';
const request=(data)=>'POST '+endpoint+'\nContent-Type: application/json\nx-f90-key: YOUR_F90_API_TOKEN\n\n'+JSON.stringify(data,null,2);
const dataSections=[
 section("categories","POST","Categories","Requires scope: catalog. Lists public categories and their parent IDs.",request({action:"categories"}),'{"data":[{"id":"category-uuid","name":"Category name","parent_id":null}]}'),
 section("products","POST","Products","Requires scope: catalog. Lists currently visible services with quantity limits, fields, availability and merchant-specific pricing.",request({action:"services"}),'{"data":[{"service":"product-uuid","name":"Game package","category":"category-uuid","rate":1.25,"type":"fixed","min":1,"max":1,"availability":"available","fields":[{"id":"account_id","required":true}]}]}'),
 section("product-details","POST","Product details","Requires scope: catalog. Fetches one service by UUID. Use returned fields and quantity settings.",request({action:"service",service:"product-uuid"}),'{"data":{"service":"product-uuid","name":"Game package","rate":1.25,"fields":[],"availability":"available"}}'),
 section("balance","POST","Account balance","Requires scope: balance. Returns the currently authenticated trader wallet balance.",request({action:"balance"}),'{"data":{"balance":125.50,"currency":"USD"}}'),
 section("quote","POST","Price quotation","Requires scope: orders. This is read-only and validates product availability and quantity. Actual totals can change; quote again before submitting.",request({action:"quote",product_id:"product-uuid",quantity:1}),'{"data":{"product_id":"product-uuid","subtotal_usd":1.25,"discount_usd":0,"total_usd":1.25,"quantity":1}}'),
 section("create-order","POST","Create order","Requires scope: orders and a verified active trader. Generates one billable order. Use a unique idempotency_key (UUID recommended) and the product-specific fields. Retrying the SAME reference returns the prior order rather than charging again.",request({action:"checkout",product_id:"product-uuid",quantity:1,fields:{account_id:"PLAYER-ID"},idempotency_key:"ecbdd545-e616-4aee-8770-7eefa977bcd0"}),'{"data":{"id":"order-uuid","status":"queued","total_usd":1.25,"product_name":"Game package"}}'),
 section("order-status","POST","Check order status","Requires scope: orders. Only orders owned by the token owner are visible. The status response includes the order object and its events.",request({action:"status",id:"order-uuid"}),'{"data":{"order":{"id":"order-uuid","status":"processing"},"events":[],"requests":[]}}'),
 section("history","POST","Order history","Requires scope: orders for order history. Use offset for pagination (50 records per page).",request({action:"history",kind:"orders",offset:0}),'{"data":{"items":[],"count":0}}')
];
return '<div class="f90-api-docs" dir="ltr">'+intro+nav+'<section id="api-overview" class="f90-api-reference"><h2>Merchant API · واجهة ربط المتاجر</h2><p>تخصّ هذه الواجهة أصحاب المتاجر المرتبطة بموقع F90 CARD. نسبة وكيل الشحن وإسناد العملاء تُدار من لوحة إدارة F90، وليست من API المتجر.</p><p><b>API endpoint</b></p>'+code(endpoint)+'<p>'+esc(currency)+'</p><p><b>Transport:</b> HTTPS POST with JSON. <b>Envelope:</b> {"data": ...} on success or {"error":{"code":"F90_...","message":"..."}} on failure.</p></section>'+
'<section id="api-authentication" class="f90-api-reference"><h2>Authentication</h2><p>Send your API token from your backend only. Never publish it in browser JavaScript, mobile apps, a public repository or logs.</p>'+code('Content-Type: application/json\nx-f90-key: YOUR_F90_API_TOKEN')+'<p>Use separate permissions for catalog, balance and orders. Tokens can be disabled or replaced. Keep Allow all IP addresses off in production when a trusted server IP is available.</p></section>'+
dataSections.join('')+
'<section id="api-errors" class="f90-api-reference"><h2>Error handling</h2><table><thead><tr><th>HTTP</th><th>Code</th><th>Meaning</th></tr></thead><tbody>'+[
["401","F90_AUTH","Missing, invalid, revoked or expired token"],
["403","F90_FORBIDDEN","Access denied, unverified trader or disallowed IP"],
["403","F90_VERIFICATION_REQUIRED","Account verification required"],
["402","F90_INSUFFICIENT_BALANCE","Insufficient wallet funds"],
["400","F90_QUANTITY","Invalid quantity or step"],
["400","F90_FIELDS","Missing/invalid order fields"],
["409","F90_REFILLING","Service temporarily unavailable"],
["409","F90_PRICE_CHANGED","Price changed; re-quote"],
["409","F90_IDEMPOTENCY_CONFLICT","Reference already used for a different order"],
["429","F90_LIMIT","Request rate limit exceeded"]
].map(a=>'<tr>'+a.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table><p>For a network timeout, do not immediately retry with a new key. Check the original order reference or ask support to investigate.</p></section>'+
'<section id="api-security" class="f90-api-reference"><h2>Implementation checklist</h2><p>Use HTTPS; store tokens in backend environment variables; rotate compromised keys; do not retry payments with new idempotency keys; verify field requirements; reconcile pending orders and wallet balance.</p><p>The API uses HTTP POST actions, not Yassen Card GET routes. IP allowlisting is supplemental protection and depends on trusted gateway IP headers. Webhooks are not currently supported.</p></section></div>';
}
function tokens(keys,verified,logo,endpoint){
const active=keys.find(k=>k.is_active);
const form=verified?'<form id="keyForm" class="f90-api-token-form" dir="rtl"><h2>إنشاء مفتاح التوكن</h2><p>رابط الاتصال الآمن الرسمي لمتجرك:</p><code class="f90-token-endpoint" dir="ltr">'+esc(endpoint)+'</code><label class="field"><span>اسم المفتاح</span><input name="name" required maxlength="100" value="متجري"></label><label class="field"><input name="allow_all_ips" type="checkbox" checked> السماح بالاختبار من خوادم مختلفة (أوقفه عند تشغيل المتجر رسميًا)</label><button class="button" type="submit">'+(active?'إنشاء مفتاح جديد وإلغاء القديم':'إنشاء مفتاح التوكن')+'</button></form>':'<p>يلزم توثيق حساب التاجر لإنشاء مفتاح API.</p>';
return '<div class="f90-token-page" dir="rtl"><header class="f90-api-doc-head"><img src="'+esc(logo)+'" alt="F90 CARD"><div><h1>مفتاح ربط المتاجر</h1><p>عنوان الربط الرسمي لخدمات F90 CARD. استخدم المفتاح في خادم متجرك فقط، ولا تضعه في المتصفح.</p><a class="button secondary" href="#/api-guide">دليل المطور</a></div></header><div class="f90-token-columns"><section class="panel">'+form+'</section><section class="panel"><h2>حالة المفتاح</h2>'+(active?'<p>هناك مفتاح نشط: <code>'+esc(active.token_prefix)+'</code></p><p>إنشاء مفتاح جديد يلغي السابق فورًا.</p><button class="button secondary" data-action="key-revoke" data-id="'+esc(active.id)+'">إلغاء المفتاح</button>':'<p>لا يوجد مفتاح نشط.</p>')+'<h3>ماذا يمكن لمتجرك فعله؟</h3><p>جلب الخدمات وأسمائها وأوصافها وصورها وأسعارها، قراءة رصيد التاجر، إنشاء طلب شحن، ومتابعة حالة الطلب.</p></section></div></div>';
}
window.F90MerchantViews={docs,tokens};
})();