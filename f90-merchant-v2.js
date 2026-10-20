(function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const code=(text)=>'<pre class="f90-api-code" dir="ltr"><code>'+esc(text)+'</code></pre>';
const section=(id,verb,title,desc,request,response)=>'<section class="f90-api-reference" id="api-'+id+'"><div class="f90-api-method"><span>'+verb+'</span><h3>'+title+'</h3></div><p>'+desc+'</p>'+code(request)+(response?'<h4>مثال الاستجابة</h4>'+code(response):'')+'</section>';
function docs(endpoint,logo){
endpoint="https://www.f90card.online/api/v1";
const request=data=>'POST '+endpoint+'\nContent-Type: application/json\nx-f90-key: YOUR_F90_API_TOKEN\n\n'+JSON.stringify(data,null,2);
const operations=[
["categories","الأقسام","صلاحية catalog. يعيد الأقسام ومعرّف القسم الأب والصورة.",{action:"categories"},{data:[{id:"category-uuid",name:"شحن التطبيقات",parent_id:null,image_url:"https://.../category.jpg"}]}],
["services","جميع الخدمات","صلاحية catalog. احفظ معرّف service الثابت، وحدّث المنتج نفسه عند المزامنة بدل إنشاء نسخة جديدة.",{action:"services"},{data:[{service:"product-uuid",name:"شحن التطبيق",category:"category-uuid",image_url:"https://.../product.jpg",currency:"USD",rate:1.25,unit_quantity:1000,min:1000,max:1000000,quantity_step:1000,fulfillment:"automatic",availability:"available",fields:[{id:"account_id",required:true}]}]}],
["service","تفاصيل خدمة","صلاحية catalog. اقرأ fields وحدود الكمية وخطوتها ووحدة التسعير قبل عرض نموذج الشحن.",{action:"service",service:"product-uuid"},{data:{service:"product-uuid",name:"شحن التطبيق",fields:[{id:"account_id",required:true}]}}],
["balance","رصيد التاجر","صلاحية balance. الرصيد الذي تعيده الواجهة بالدولار الأمريكي.",{action:"balance"},{data:{balance:125.5,currency:"USD"}}],
["quote","حساب الإجمالي","صلاحية orders. عملية قراءة تحسب السعر على الخادم. لا تخصم رصيدًا. اعتمد total_usd قبل الشراء، خصوصًا عند وجود شرائح كمية.",{action:"quote",product_id:"product-uuid",quantity:1000},{data:{product_id:"product-uuid",quantity:1000,total_usd:1.25}}],
["checkout","إرسال طلب الشحن","صلاحية orders. يلزم حساب تاجر نشط وموثّق ورصيد كافٍ. احفظ مرجعًا ثابتًا قبل أول إرسال؛ استخدمه مع البيانات نفسها عند إعادة المحاولة. add اسم بديل للعملية نفسها.",{action:"checkout",product_id:"product-uuid",quantity:1000,fields:{account_id:"123456"},idempotency_key:"ecbdd545-e616-4aee-8770-7eefa977bcd0",expected_total_usd:1.25},{data:{id:"order-uuid",status:"queued",total_usd:1.25}}],
["status","متابعة الطلب","صلاحية orders. يُسمح بقراءة طلبات صاحب المفتاح فقط. احفظ رقم الطلب المعاد من الشراء.",{action:"status",order:"order-uuid"},{data:{order:{id:"order-uuid",status:"processing"},events:[],requests:[]}}],
["history","سجل الطلبات","صلاحية orders. استخدم offset للصفحات المتتابعة؛ الصفحة حتى 50 سجلًا.",{action:"history",kind:"orders",offset:0},{data:{items:[],count:0}}]
];
const errors=[
["401","F90_AUTH","المفتاح مفقود أو غير صحيح أو ملغى أو منتهي."],
["403","F90_FORBIDDEN","صلاحية العملية غير ممنوحة أو الحساب غير متاح أو عنوان الخادم غير مسموح."],
["403","F90_VERIFICATION_REQUIRED","يلزم توثيق الحساب."],
["402","F90_INSUFFICIENT_BALANCE","رصيد التاجر لا يكفي."],
["400","F90_QUANTITY","الكمية لا تطابق الحدود أو الخطوة."],
["400","F90_FIELDS","حقل مطلوب مفقود أو غير صحيح."],
["409","F90_REFILLING","الخدمة قيد التعبئة."],
["409","F90_PRICE_CHANGED","تغيّر السعر؛ أعد حساب الإجمالي واعرضه للعميل."],
["409","F90_IDEMPOTENCY_CONFLICT","استُخدم مرجع الطلب مع بيانات مختلفة."],
["429","F90_LIMIT","تم تجاوز عدد الطلبات المسموح."]
];
return '<div class="f90-api-docs" dir="rtl"><section class="f90-api-doc-head"><img src="'+esc(logo)+'" alt="F90 CARD"><div><span>F90 CARD</span><h1>دليل التاجر وربط المتاجر</h1><p>اربط خادم متجرك بحسابك في F90 CARD لاستيراد الخدمات وإرسال الطلبات ومتابعتها.</p><a class="button secondary" href="#/developers">إدارة مفتاح التاجر</a></div></section>'+
'<section class="f90-api-reference"><h2>عنوان الاتصال الرسمي</h2>'+code(endpoint)+'<button class="button secondary" type="button" data-f90-copy-api>نسخ الرابط</button><p>البروتوكول الأصلي POST وJSON بالمفتاح x-f90-key. بروتوكول F90 Card API (api-token / GET) يدعم جلب المنتجات والرصيد والحالة دون شراء. نفس مفتاح f90_live_ يعمل مع الاثنين. لا تضع المفتاح في الرابط أو المتصفح، ولا تستخدم GET للشراء.</p></section>'+
'<section class="f90-api-reference"><h2>F90 Card API (api-token / GET)</h2><p>بروتوكول اختياري متوافق مع نمط طلبات القراءة لدى ياسين كارد. مفتاح F90 نفسه يبدأ بـ f90_live_ ويرسل داخل الترويسة api-token؛ اسم البروتوكول في لوحة الموردين F90 Card API (api-token / GET). الخدمة تستخدم HTTPS وJSON والعملة USD.</p>'+
code('GET https://www.f90card.online/client/api/products\\napi-token: YOUR_F90_API_TOKEN\\n\\nGET https://www.f90card.online/client/api/profile\\napi-token: YOUR_F90_API_TOKEN\\n\\nGET https://www.f90card.online/client/api/check?orders=%5B%22ORDER_UUID%22%5D\\napi-token: YOUR_F90_API_TOKEN')+
'<p>جميع عمليات GET للقراءة فقط. رابط /api/v1?action=services يدعم GET كذلك بالمفتاح في الترويسة. إرسال طلب شراء يتطلب POST إلى /api/v1 ببيانات JSON وidempotency_key ويمكن استخدام api-token أو x-f90-key في الترويسة. طلب GET لمسار newOrder غير مدعوم لحماية الطلبات. لا تربط متجر F90 بنفسه للشراء التلقائي.</p></section>'+
'<section class="f90-api-reference"><h2>إصدار المفتاح وتفعيله</h2><p>تفعّل الإدارة حسابك بدور تاجر وتوثّقه. افتح إدارة مفتاح التاجر، أنشئ المفتاح وانسخه عند ظهوره أول مرة. لا يمكن استرجاع سره بعد مغادرة الشاشة. إصدار بديل يلغي المفتاح السابق؛ حدّث خادم متجرك فورًا. يستطيع صاحب الحساب أو المدير إلغاء المفتاح.</p><p>الصلاحيات المتاحة هي catalog للكتالوج وbalance للرصيد وorders للطلبات. احفظ المفتاح في متغير بيئة على خادم متجرك. لا تضعه في الرابط أو ملفات المتصفح أو السجلات. لا تحتاج عمليات الخادم إلى تسجيل دخول تفاعلي بعد إصدار المفتاح.</p>'+code('Content-Type: application/json\nx-f90-key: YOUR_F90_API_TOKEN')+'</section>'+
'<section class="f90-api-reference"><h2>اختبار اتصال آمن</h2><p>من خادمك نفّذ طلب services أولًا، ثم balance. هذان الطلبان لا ينشئان عملية شحن ولا يخصمان الرصيد. يجب أن تكون الاستجابة JSON وبداخلها data؛ ظهور صفحة HTML يعني أن المسار أو التوجيه غير صحيح. لا تختبر checkout على حساب عميل.</p>'+code('curl -X POST "'+endpoint+'" -H "Content-Type: application/json" -H "x-f90-key: $F90_API_KEY" -d \'{"action":"services"}\'')+'</section>'+
operations.map(([id,title,desc,payload,response])=>section(id,"POST",title,desc,request(payload),JSON.stringify(response,null,2))).join('')+
'<section class="f90-api-reference"><h2>الكمية وحقول الشحن</h2><p>service هو معرّف F90 الثابت للخدمة، وليس معرّف المورد. fields يحدد أسماء الحقول المطلوبة مثل account_id؛ أرسلها كما وردت دون تخمين. min وmax حدود الكمية، وquantity_step خطوة زيادتها، وunit_quantity عدد الوحدات الذي يمثله rate. اعتمد quote للإجمالي النهائي ولا تستنتج السعر بضرب غير صحيح.</p><p>ترسل الطلبات الآلية إلى مسار التنفيذ المرتبط بالخدمة، واليدوية إلى متابعة الإدارة وفق إعدادات الخدمة. بيانات المورد ومفاتيحه تبقى لدى F90 CARD.</p></section>'+
'<section class="f90-api-reference"><h2>مزامنة المنتجات والأسعار</h2><p>اجلب categories ثم services دوريًا من خادمك، واستخدم service مفتاحًا فريدًا للتحديث. حدّث الاسم والصورة والقسم والسعر وحدود الكمية وحقول الشحن والتوفر. إذا اختفت خدمة من نتيجة كاملة، أوقف بيعها محليًا مع حفظ تاريخ طلباتها. عند فشل المزامنة احتفظ بآخر نتيجة ناجحة؛ لا تعتبر الخطأ قائمة فارغة.</p><p>سعر الكتالوج يراعي سعر التاجر المسجل. أعد quote قبل تأكيد كل شراء. الصور والأوصاف والحقول المرسلة هي بيانات الكتالوج الحالي وقد تتطلب تحديثًا.</p></section>'+
'<section class="f90-api-reference"><h2>حالات الطلب وإعادة المحاولة</h2><p>queued: في الانتظار؛ processing: قيد التنفيذ؛ review: يحتاج مراجعة؛ completed: مكتمل؛ partial: مكتمل جزئيًا؛ failed: لم يكتمل؛ refunded: مسترد، عندما تعيد الواجهة هذه الحالة.</p><p>عند انقطاع الاتصال احتفظ بـ idempotency_key نفسه والبيانات نفسها، وتابع status إذا حفظت رقم الطلب. لا تنشئ مرجعًا جديدًا تلقائيًا. إذا تعذّر استرجاع النتيجة، اطلب مراجعة المرجع من الدعم. يتولى F90 تسوية الاسترداد وفق حالة التنفيذ والسياسة الحالية.</p></section>'+
'<section class="f90-api-reference"><h2>الأخطاء</h2><p>نجاح الطلب: كائن data. فشله: كائن error يحتوي على code ثابت وmessage توضيحية.</p><table><thead><tr><th>HTTP</th><th>الكود</th><th>المعنى</th></tr></thead><tbody>'+errors.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></section>'+
'<section class="f90-api-reference"><h2>حدود التوافق الحالية</h2><p>العمليات الموضحة أعلاه هي عقد الربط المراجع في الكود الحالي. profile وcheck ليسا عمليتين موثقتين في هذا العقد. استخدم balance وstatus بحسب الحاجة، وcheckout أو add للشراء. لا تدعم هذه الصفحة إشعارات webhook؛ تابع الحالة بطلب status دوريًا مع احترام حدود الاتصال.</p></section></div>';
}
function tokens(keys,verified,logo,endpoint){
endpoint="https://www.f90card.online/api/v1";
const active=keys.find(k=>k.is_active);
const form=verified?'<form id="keyForm" class="f90-api-token-form" dir="rtl"><h2>إنشاء مفتاح التوكن</h2><p>رابط الاتصال الآمن الرسمي لمتجرك:</p><code class="f90-token-endpoint" dir="ltr">'+esc(endpoint)+'</code><label class="field"><span>اسم المفتاح</span><input name="name" required maxlength="100" value="متجري"></label><label class="field"><input name="allow_all_ips" type="checkbox" checked> السماح بالاختبار من خوادم مختلفة (أوقفه عند تشغيل المتجر رسميًا)</label><button class="button" type="submit">'+(active?'إنشاء مفتاح جديد وإلغاء القديم':'إنشاء مفتاح التوكن')+'</button></form>':'<p>يلزم توثيق حساب التاجر لإنشاء مفتاح API.</p>';
return '<div class="f90-token-page" dir="rtl"><header class="f90-api-doc-head"><img src="'+esc(logo)+'" alt="F90 CARD"><div><h1>مفتاح ربط المتاجر</h1><p>عنوان الربط الرسمي لخدمات F90 CARD. استخدم المفتاح في خادم متجرك فقط، ولا تضعه في المتصفح.</p><a class="button secondary" href="#/api-guide">دليل التاجر وربط المتاجر</a></div></header><div class="f90-token-columns"><section class="panel">'+form+'</section><section class="panel"><h2>حالة المفتاح</h2>'+(active?'<p>هناك مفتاح نشط: <code>'+esc(active.token_prefix)+'</code></p><p>إنشاء مفتاح جديد يلغي السابق فورًا.</p><button class="button secondary" data-action="key-revoke" data-id="'+esc(active.id)+'">إلغاء المفتاح</button>':'<p>لا يوجد مفتاح نشط.</p>')+'<h3>ماذا يمكن لمتجرك فعله؟</h3><p>جلب الخدمات وأسمائها وأوصافها وصورها وأسعارها، قراءة رصيد التاجر، إنشاء طلب شحن، ومتابعة حالة الطلب.</p></section></div></div>';
}
document.addEventListener("click",async event=>{
const button=event.target.closest?.("[data-f90-copy-api]");
if(!button)return;
try{await navigator.clipboard.writeText("https://www.f90card.online/api/v1");button.textContent="تم نسخ الرابط";}
catch{button.textContent="انسخ الرابط الظاهر أعلاه";}
});
window.F90MerchantViews={docs,tokens};
})();