(function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const code=(text)=>'<pre class="f90-api-code" dir="ltr"><code>'+esc(text)+'</code></pre>';
const section=(id,verb,title,desc,request,response)=>'<section class="f90-api-reference" id="api-'+id+'"><div class="f90-api-method"><span>'+verb+'</span><h3>'+title+'</h3></div><p>'+desc+'</p>'+code(request)+(response?'<h4>Example response</h4>'+code(response):'')+'</section>';
function docs(endpoint,logo){
const base=JSON.stringify({action:"services"},null,2);
const currency='All monetary values in this API use USD. Product IDs are UUID strings. Supply customer fields exactly as returned by the service.';
let intro='<section class="f90-api-doc-head"><img src="'+esc(logo)+'" alt="F90 CARD" loading="lazy"><div><span>F90 CARD · OFFICIAL MERCHANT API</span><h1>API Documentation</h1><p>Connect your server to the F90 CARD wallet, product catalog and order tracking. This guide documents the actual production API, not the Yassen Card supplier API.</p><a href="#/developers" class="button secondary">Manage your API token</a></div></section>';
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
return '<div class="f90-api-docs" dir="ltr">'+intro+nav+'<section id="api-overview" class="f90-api-reference"><h2>Overview</h2><p><b>API endpoint</b></p>'+code(endpoint)+'<p>'+esc(currency)+'</p><p><b>Transport:</b> HTTPS POST with JSON. <b>Envelope:</b> {"data": ...} on success or {"error":{"code":"F90_...","message":"..."}} on failure.</p></section>'+
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
const form=verified?'<form id="keyForm" class="f90-api-token-form">'+
'<label>Token label<input name="name" required maxlength="100" value="F90 merchant integration"></label>'+
'<fieldset><legend>API permissions</legend><label><input name="scope_catalog" type="checkbox" checked>Catalog</label><label><input name="scope_balance" type="checkbox" checked>Balance</label><label><input name="scope_orders" type="checkbox" checked>Create and track orders</label></fieldset>'+
'<label>Requests per minute<input type="number" name="requests_per_minute" min="10" max="120" value="60" required></label>'+
'<label>Expiration date (optional)<input name="expires_at" type="date"></label>'+
'<label class="f90-api-allowall"><input name="allow_all_ips" type="checkbox" checked>Allow all IP addresses (development/testing only)</label>'+
'<p class="f90-api-warning">For better security, disable this setting after development and use your server IP. IP checks supplement a secret API token; they do not replace secure authentication.</p>'+
'<label>Allowed IP addresses, one per line (required when Allow all is off)<textarea name="allowed_ips" rows="3" placeholder="203.0.113.10"></textarea></label>'+
'<button class="button" type="submit">'+(active?"Rotate token and revoke the previous one":"Generate one API token")+'</button>'+
'</form>':'<p>Identity verification is required before creating a token. <a href="#/verification">Verify your account</a>.</p>';
return '<div class="f90-token-page" dir="ltr"><header class="f90-api-doc-head"><img src="'+esc(logo)+'" alt="F90 CARD"><div><span>F90 CARD · SECURE MERCHANT ACCESS</span><h1>API TOKEN</h1><p>One active token per trader. You can rotate it at any time; the previous one becomes invalid immediately. The full secret is only visible once.</p><a class="button secondary" href="#/api-guide">Open API Documentation</a></div></header>'+
'<div class="f90-token-columns"><section class="panel"><h2>'+ (active?"Rotate your token":"Create your first token")+'</h2>'+form+'</section>'+
'<section class="panel"><h2>Current active token</h2>'+(active?'<dl><dt>Label</dt><dd>'+esc(active.name)+'</dd><dt>Token prefix</dt><dd><code>'+esc(active.token_prefix)+'</code></dd><dt>Scopes</dt><dd>'+esc((active.scopes||[]).join(", "))+'</dd><dt>Rate limit</dt><dd>'+esc(active.requests_per_minute)+'/min</dd><dt>IP access</dt><dd>'+ (active.allow_all_ips!==false?"All IPs allowed":"Restricted to saved IPs")+'</dd><dt>Last used</dt><dd>'+esc(active.last_used_at||"Never")+'</dd></dl><div class="actions"><button class="button ghost" data-action="key-revoke" data-id="'+esc(active.id)+'">Revoke token</button><button class="button secondary" data-action="key-logs" data-id="'+esc(active.id)+'">Usage log</button></div>':'<p>No active API token.</p>')+
'<p class="muted small">All old tokens have been revoked. Historical token usage is retained for auditing. Download the API guide or give the endpoint to your developer.</p><code class="f90-token-endpoint">'+esc(endpoint)+'</code></section></div></div>';
}
window.F90MerchantViews={docs,tokens};
})();