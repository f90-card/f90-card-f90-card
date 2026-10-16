/* F90 CARD: separate manager pages for service pricing, requests and image placement previews. */
(function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const d={salary_usd_per_100k:10,salary_fee_percent:0,transfer_fee_percent:2,transfer_eta_min_minutes:5,transfer_eta_max_minutes:2880,website_price_usd:500,account_price_usd:0,transfer_methods:["شام كاش","أورنج موني","كليك","بنك فلسطين","USDT","بنك زراعت تركيا","ويش موني"]};
const imageFields=[
 ["transfer","تحويل الأموال","قسم تحويل الأموال"],
 ["salary","سحب رواتب Xena","داخل صفحة طرق الإيداع"],
 ["account","بيع حسابات Xena","القسم الرئيسي لشراء الحسابات"],
 ["design","خدمات التصميم","قسم احصل على تصميم"],
 ["website","احصل على موقع","خدمة إنشاء موقع كامل"]
];
let currentSettings=null;
const field=(name,label,value,type="text",attrs="")=>'<label class="field"><span>'+label+'</span><input type="'+type+'" name="'+name+'" value="'+esc(value??"")+'" '+attrs+'></label>';
const textarea=(name,label,value)=>'<label class="field"><span>'+label+'</span><textarea name="'+name+'" maxlength="2500" rows="3">'+esc(value??"")+'</textarea></label>';
const check=(name,label,yes)=>'<label class="f90-manage-switch"><input type="checkbox" name="'+name+'" '+(yes?"checked":"")+'> '+label+'</label>';
const heading=(title,desc)=>'<div class="page-head"><div><div class="eyebrow">F90 CARD · الإدارة</div><h1>'+title+'</h1><p>'+desc+'</p></div></div>';
const currencies=["USD","ILS","JOD","SYP","TRY","AED","EUR","EGP","SAR","QAR"];
const methodRow=(x={})=>'<div class="f90-transfer-method-row" data-method-row>'+field("method_id","معرّف الطريقة",x.id||"","text",'required pattern="[a-z0-9-]{2,60}"')+field("method_name","اسم الخدمة",x.name_ar||"","text",'required maxlength="120"')+
 '<label class="field"><span>عملة المستفيد</span><select name="method_currency">'+currencies.map(c=>'<option value="'+c+'" '+((x.currency||"USD")===c?'selected':'')+'>'+c+'</option>').join("")+'</select></label>'+
 field("method_fee","عمولة هذه الخدمة ٪",x.fee_percent??2,"number",'min="0" max="30" step="0.01" required')+
 field("method_rate","سعر مستقل: وحدات العملة لكل دولار (فارغ = سعر العملات المعتمد)",x.per_usd??"","number",'min="0.00000001" step="any"')+
 field("method_image","رابط صورة هذه الخدمة",x.image_url||"","url")+
 textarea("method_details","تعليمات هذه الخدمة",x.details_ar||"")+
 check("method_enabled","إظهار الخدمة",x.enabled!==false)+'<button class="button secondary small" type="button" data-remove-method>حذف الطريقة</button></div>';
const catalogRow=x=>'<div data-service-row class="panel">'+
 '<label class="field"><span>نوع الخدمة</span><select name="service_kind"><option value="design" '+(x.kind==="design"?'selected':'')+'>تصميم</option><option value="account" '+(x.kind==="account"?'selected':'')+'>حساب</option></select></label>'+
 field("service_id","معرّف الخدمة",x.id,"text",'required')+field("service_name","اسم الخدمة",x.name_ar,"text",'required')+
 textarea("service_details","تفاصيل الخدمة",x.details_ar||"")+field("service_image","رابط الصورة",x.image_url||"","text")+
 field("service_product","رابط المنتج المسعّر أو معرّفه (اختياري)",x.product_slug||"")+check("service_enabled","تفعيل الخدمة",x.enabled!==false)+
 '<button type="button" class="button secondary small" data-remove-service>حذف الخدمة من القائمة</button></div>';
async function renderSettings(main,settings){
 currentSettings=settings;
 const sal=settings?.config?.salary_withdrawal||{},tr=settings?.config?.money_transfer||{};
 const c={...d,...(settings?.config?.special_services||{}),
    salary_usd_per_100k:(()=>{const opt=(sal.payout_options||[]).find(x=>x.currency==="USD");return Number(opt?.per_100k)>0&&Number(opt?.units_per_usd)>0?Number(opt.per_100k)/Number(opt.units_per_usd):Number(sal.coins_per_usd)>0?100000/Number(sal.coins_per_usd):10;})(),
    salary_description:sal.details_ar||settings?.config?.special_services?.salary_description||"",
    transfer_fee_percent:Number(tr.fee_percent??2),
    transfer_eta_min_minutes:Number(tr.eta_min_minutes??5),
    transfer_eta_max_minutes:Number(tr.eta_max_hours??48)*60,
    transfer_methods:Array.isArray(tr.methods)?tr.methods.filter(x=>x.enabled!==false).map(x=>x.name_ar):d.transfer_methods,
    show_salary:sal.enabled===true,show_transfer:tr.enabled===true
 };
 main.innerHTML=heading("إدارة الخدمات الإضافية","أسعار ورسوم وتعليمات مستقلة. تعرض الأسعار للعميل ويؤكدها الخادم قبل تسجيل الطلب.")+
 '<form id="f90SpecialAdminForm" class="f90-manager-form">'+
 '<section class="panel"><h2>سحب رواتب Xena Live</h2><div class="field-row">'+
 field("salary_usd_per_100k","قيمة الدولار لكل 100,000 كوينز (يمكن تعديل بقية العملات من طرق الإيداع)",c.salary_usd_per_100k,"number",'min="0.01" max="100000" step="0.01" required')+
 '<p class="muted small">سحب الرواتب يخضع للاعتماد اليدوي وتُضاف قيمته بعد الموافقة. سعر الشحن يؤخذ من هذه النسبة المعتمدة.</p></div>'+
 textarea("salary_description","تفاصيل الخدمة للعميل",c.salary_description)+
 check("show_salary","إظهار الخدمة في طرق الإيداع",c.show_salary!==false)+'</section>'+
 '<section class="panel"><h2>التحويلات المالية</h2><div class="field-row">'+
 field("transfer_fee_percent","عمولة التحويل ٪",c.transfer_fee_percent,"number",'min="0" max="30" step="0.01" required')+
 field("transfer_eta_min_minutes","أقل مدة بالدقائق",c.transfer_eta_min_minutes,"number",'min="5" max="2880" required')+
 field("transfer_eta_max_minutes","أقصى مدة بالدقائق",c.transfer_eta_max_minutes,"number",'min="5" max="2880" required')+'</div>'+
 '<h3>كل طريقة مستقلة بعملتها وعمولتها</h3><div id="f90TransferRows">'+
 (Array.isArray(tr.methods)?tr.methods:[]).map(methodRow).join("")+'</div><button class="button secondary small" type="button" data-add-method>إضافة طريقة تحويل</button>'+
 textarea("transfer_description","تفاصيل تحويل الأموال",c.transfer_description)+check("show_transfer","إظهار قسم التحويلات",c.show_transfer!==false)+'</section>'+
 '<section class="panel"><h2>بيع الحسابات والتصميم والمواقع</h2><div class="field-row">'+
 field("account_price_usd","سعر حساب Xena بالدولار (صفر = يُحدد لاحقًا)",c.account_price_usd||0,"number",'min="0" max="1000000" step="0.01"')+
 '<div class="notice"><strong>سعر الموقع: 500$</strong><p>يُعدّل سعر خدمة «إنشاء موقع كامل ملك لك» من صفحة <a href="#/products">المنتجات</a> لأنها تستخدم الدفع الحقيقي من المحفظة.</p></div>'+'</div>'+
 textarea("account_description","وصف شراء حساب Xena",c.account_description)+
 textarea("website_description","وصف الموقع الكامل",c.website_description)+
 check("show_account","إظهار حسابات Xena",c.show_account!==false)+
 check("show_design","إظهار قسم التصاميم",c.show_design!==false)+
 check("show_website","إظهار قسم المواقع",c.show_website!==false)+'</section>'+
 '<section class="panel"><h2>خدمات التصميم والحسابات</h2><p>أضف خدمة بصورة ووصف مستقلين. لتحديد سعر ودفع حقيقي، أنشئ المنتج من إدارة المنتجات وحدد القسم وحقل واتساب ثم ألصق رابطه هنا. اترك الرابط فارغًا لطلب التفاصيل دون خصم.</p><div id="f90ServiceRows">'+(window.F90Special?.serviceCatalog(settings)||c.service_catalog||[]).map(catalogRow).join('')+'</div><button type="button" class="button secondary" data-add-service>إضافة خدمة</button></section>'+
 '<section class="panel"><h2>الصور والبنرات الخاصة بالخدمات</h2><p class="muted">كل صورة مستقلة، وتظهر معاينتها قبل الرفع. يمكنك أيضًا استخدام رابط صورة موجودة.</p>'+
 imageFields.map(([id,title,where])=>{
 const url=c[id+"_banner_url"]||"./assets/f90-new/banner-"+(id==="account"?"accounts":id)+".webp";
 return '<div class="f90-special-image-config"><strong>'+title+'</strong><small>مكان العرض: '+where+'</small>'+
 '<img class="f90-special-admin-preview" data-preview="'+id+'" alt="معاينة '+title+'" src="'+esc(url)+'">'+
 field(id+"_banner_url","رابط الصورة",c[id+"_banner_url"]||"","url",'data-image-url="'+id+'" placeholder="https://..."')+
 '<label class="field"><span>رفع صورة أو GIF جديدة</span><input type="file" name="'+id+'_banner_file" data-image-file="'+id+'" accept="image/png,image/jpeg,image/webp,image/gif"></label></div>';
 }).join("")+'</section>'+
 '<div class="f90-manager-save"><p data-f90-admin-status role="status"></p><button type="submit" class="button">حفظ إعدادات الخدمات</button></div></form>';
}

let salaryAdminSettings=null;
function salaryEditor(settings,rates=[]){
 salaryAdminSettings=settings;
 const sal=settings?.config?.salary_withdrawal||{};
 const rows=Array.isArray(sal.payout_options)?sal.payout_options:[];
 const pay=(settings?.config?.payment_methods||[]).find(x=>x.is_salary_withdrawal===true ||
   x.id==="27c8ecef-f69d-4b36-bb88-70bba88c4062");
 const activeRates=(rates||[]).filter(x=>x.is_enabled && Number(x.per_usd)>0 &&
   /^[A-Z]{3,8}$/.test(String(x.currency||"")));
 const image=String(sal.image_url||pay?.image_url||"");
 const options=activeRates.map(rate=>{
   const old=rows.find(x=>x.currency===rate.currency)||{};
   const base=Number(sal.coins_per_usd)>0 ? 100000/Number(sal.coins_per_usd) : 10;
   const units=rate.currency==="USD"?1:(Number(old.units_per_usd)>0?Number(old.units_per_usd):Number(rate.per_usd));
   const payout=Number(old.per_100k)>0?Number(old.per_100k):(rate.currency==="XCN"?100000:base*units);
   const isEnabled=old.enabled===true || (!rows.length && ["USD","ILS","JOD","XCN"].includes(rate.currency));
   return '<div class="f90-salary-currency-row" data-salary-currency="'+esc(rate.currency)+'"><strong>'+
     esc(rate.name_ar||rate.currency)+' · '+esc(rate.currency)+'</strong>'+
     check("salary_option_enabled","إتاحة الاختيار للعميل",isEnabled)+
     '<div class="field-row">'+
     field("salary_rate_100k","المبلغ المقابل لسحب كل 100,000 كوينز",payout,"number",'required min="0.00000001" max="1000000000000" step="any"')+
     field("salary_units_per_usd","كم وحدة من هذه العملة تعادل دولارًا واحدًا من محفظة F90",units,"number",'required min="0.00000001" max="1000000000000" step="any"'+(rate.currency==="USD"?' readonly':''))+
     '</div></div>';
 }).join("");
 return '<section class="panel f90-salary-admin" id="f90SalaryDepositControls">'+
   '<h2>إعداد سحب رواتب Xena Live داخل الإيداع</h2>'+
   '<p class="muted">هذه الأسعار خاصة بسحب الرواتب، مستقلة عن أسعار شراء الخدمات وصرف الإيداعات العادية. يمكنك ضبط سعر الكوينز لكل عملة بشكل منفصل. المحفظة الأساسية تُقيّد الرصيد بالدولار بعد موافقة الإدارة.</p>'+
   '<form id="f90SalaryDepositAdminForm" class="f90-manager-form">'+
   check("salary_active","تفعيل خدمة سحب الرواتب في طرق الإيداع",sal.enabled===true)+
   field("salary_minimum","أقل كمية كوينز للسحب",Math.max(100000,Number(sal.minimum_coins)||100000),"number",'required min="100000" max="1000000000000" step="1"')+
   textarea("salary_details","الوصف والتعليمات المعروضة للعميل",sal.details_ar||"")+
   field("salary_account_label","عنوان حقل حساب Xena Live",sal.account_label_ar||"ID حساب Xena Live الذي تم السحب منه","text",'maxlength="120"')+
   textarea("salary_processing_notice","معلومات الإيداع ومدة التأكيد الظاهرة للعميل",sal.processing_notice_ar||"")+
   '<div class="f90-salary-admin-photo"><img id="f90SalaryImagePreview" src="'+esc(image||"./assets/f90-new/banner-salary.webp")+'" alt="معاينة صورة سحب الرواتب">'+
   field("salary_image_url","رابط صورة الخدمة",image,"url",'placeholder="https://..."')+
   '<label class="field"><span>رفع صورة جديدة من جهازك</span><input name="salary_image_file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label></div>'+
   '<h3>سعر الكوينز وعملة الإيداع لكل اختيار</h3>'+
   '<p class="muted small">يمكنك إضافة عملة أخرى من قسم «العملات والصرف» ثم تفعيلها هنا. مثال: لو كل 100,000 كوينز = 32 شيقل، وكل دولار داخل المحفظة = 3.20 شيقل، سيظهر للعميل 32 شيقل ويُعتمد 10 دولارات في المحفظة.</p>'+
   '<div id="f90SalaryCurrencyRows">'+options+'</div>'+
   '<div class="f90-manager-save"><p id="f90SalaryAdminStatus" role="status"></p>'+
   '<button class="button" type="submit">حفظ إعدادات سحب الرواتب</button></div></form></section>';
}
document.addEventListener("change",ev=>{
 if(ev.target?.name!=="salary_image_file")return;
 const preview=document.getElementById("f90SalaryImagePreview"),file=ev.target.files?.[0];
 if(!preview||!file)return;
 if(preview.dataset.blob)URL.revokeObjectURL(preview.dataset.blob);
 const url=URL.createObjectURL(file);preview.dataset.blob=url;preview.src=url;
});
document.addEventListener("input",ev=>{
 if(ev.target?.name!=="salary_image_url")return;
 const preview=document.getElementById("f90SalaryImagePreview");
 if(preview&&/^https:\/\//i.test(ev.target.value))preview.src=ev.target.value;
});
document.addEventListener("submit",async ev=>{
 if(ev.target?.id!=="f90SalaryDepositAdminForm")return;
 ev.preventDefault();
 ev.stopImmediatePropagation();
 const form=ev.target,button=form.querySelector('button[type="submit"]');
 const status=form.querySelector("#f90SalaryAdminStatus");
 if(button.disabled)return;
 button.disabled=true;status.textContent="جارٍ حفظ صورة الخدمة وأسعار السحب…";
 try{
   if(!salaryAdminSettings?.config)throw Error("بيانات الإدارة غير متاحة؛ أعد فتح صفحة الإيداع");
   const min=Number(form.elements.salary_minimum.value);
   if(!Number.isSafeInteger(min)||min<100000||min>1000000000000)throw Error("راجع الحد الأدنى للكوينز");
   const options=[...form.querySelectorAll("[data-salary-currency]")].map(row=>{
     const currency=row.dataset.salaryCurrency;
     const per100k=Number(row.querySelector('[name="salary_rate_100k"]').value);
     const perUsd=Number(row.querySelector('[name="salary_units_per_usd"]').value);
     const enabled=row.querySelector('[name="salary_option_enabled"]').checked;
     if(!Number.isFinite(per100k)||per100k<=0||per100k>1000000000000||
        !Number.isFinite(perUsd)||perUsd<=0||perUsd>1000000000000)throw Error("سعر غير صالح للعملة "+currency);
     return {currency,label_ar:row.querySelector("strong").textContent.split(" · ")[0],
       per_100k:per100k,units_per_usd:perUsd,enabled};
   });
   if(!options.some(x=>x.enabled)||!options.some(x=>x.currency==="USD"))
      throw Error("يجب أن تتوفر عملة واحدة على الأقل، مع تعريف سعر الدولار المرجعي");
   const file=form.elements.salary_image_file.files?.[0];
   if(file&&(!["image/png","image/jpeg","image/webp","image/gif"].includes(file.type)||file.size>5242880))
     throw Error("الصورة يجب أن تكون PNG أو JPG أو WEBP أو GIF وأقل من 5 ميجابايت");
   const imageUrl=file?(await window.F90API.upload(file,"f90-images","payment-methods")).url:
     String(form.elements.salary_image_url.value||"").trim().slice(0,2000);
   if(imageUrl&&!/^https:\/\//i.test(imageUrl)&&!imageUrl.startsWith("./"))throw Error("رابط الصورة يجب أن يكون آمنًا");
   const old=salaryAdminSettings,config=old.config;
   const current=config.salary_withdrawal||{};
   const desc=String(form.elements.salary_details.value||"").trim().slice(0,4000);
   const accountLabel=String(form.elements.salary_account_label.value||"").trim().slice(0,120);
   const processingNotice=String(form.elements.salary_processing_notice.value||"").trim().slice(0,2500);
   const enabled=!!form.elements.salary_active.checked;
   const usd=options.find(x=>x.currency==="USD");
   const salary={...current,enabled,minimum_coins:min,details_ar:desc,
     account_label_ar:accountLabel,processing_notice_ar:processingNotice,image_url:imageUrl,
     payout_options:options,coins_per_usd:usd?.per_100k>0?100000/(usd.per_100k/usd.units_per_usd):current.coins_per_usd};
   const methods=(config.payment_methods||[]).map(method=>
     method.is_salary_withdrawal===true||method.id==="27c8ecef-f69d-4b36-bb88-70bba88c4062"?
       {...method,is_salary_withdrawal:true,enabled,image_url:imageUrl,details_ar:desc,
         accepted_currencies:options.filter(x=>x.enabled).map(x=>x.currency)}:method);
   const specials={...(config.special_services||{}),show_salary:enabled,
     salary_description:desc,salary_usd_per_100k:usd.per_100k/usd.units_per_usd};
   const saved=await window.F90API.call("settings.save",{data:{
     store_name:old.store_name,logo_url:old.logo_url,primary_color:old.primary_color,
     currency:old.currency,contact_email:old.contact_email,announcement:old.announcement,
     config:{...config,salary_withdrawal:salary,special_services:specials,payment_methods:methods}
   }});
   if(saved?.config)salaryAdminSettings=saved;
   status.textContent="حُفظت إعدادات سحب الرواتب والعملات وصورة الخدمة بنجاح.";
 }catch(err){status.textContent="تعذر الحفظ: "+(err?.message||"خطأ غير معروف");}
 finally{button.disabled=false;}
});

async function renderRequests(main){
 main.innerHTML=heading("طلبات سحب الرواتب والتحويلات والخدمات","سحب الرواتب يُعتمد لإضافة رصيد؛ التحويل يُخصم عند تقديمه ويُسترد عند رفضه. باقي الخدمات طلبات تواصل.")+
 '<div id="f90RequestRecords" class="records"><p>جارٍ جلب الطلبات…</p></div>';
 const client=window.F90API.client;
 const results=await Promise.allSettled([
   client.from("f90_special_requests").select("*").order("created_at",{ascending:false}).limit(150),
   client.rpc("f90_list_salary"),
   client.rpc("f90_list_transfers")
 ]);
 const [sp,sal,tr]=results.map(x=>x.status==="fulfilled"?x.value:
    {data:[],error:x.reason||new Error("تعذّر جلب السجلات")});
 const el=document.getElementById("f90RequestRecords");if(!el)return;
 const errors=[sp.error,sal.error,tr.error].filter(Boolean);
 const warnings=errors.length?'<div class="notice warning">بعض قوائم الطلبات غير متاحة مؤقتًا، لكن الطلبات الأخرى تظهر: '+
   errors.map(x=>esc(x.message||"تعذر الاتصال")).join(" · ")+'</div>':"";
 const records=[
  ...(sp.data||[]).map(x=>({...x,source:"special",subtitle:x.service,contact:x.contact_whatsapp,
    qty:x.amount_units,total:x.gross_usd,net:x.net_usd,note:x.client_details})),
  ...(sal.data||[]).map(x=>({...x,source:"salary",kind:"salary",subtitle:"رواتب Xena Live",
    contact:x.account_id,qty:x.coins,total:x.usd_amount,net:x.usd_amount,
    note:[x.client_note,x.details_snapshot].filter(Boolean).join(" · ")})),
  ...(tr.data||[]).map(x=>({...x,source:"transfer",kind:"transfer",subtitle:x.method_name,
    contact:x.recipient_details,qty:x.net_usd,total:x.total_usd,net:x.net_usd,note:x.recipient_details}))
 ].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 const kinds={salary:"سحب راتب",transfer:"تحويل أموال",account:"حساب Xena",design:"تصميم",website:"إنشاء موقع"};
 const states={pending:"بانتظار المراجعة",processing:"قيد المعالجة",completed:"مكتمل",rejected:"مرفوض",approved:"معتمد"};
 el.innerHTML=warnings+(records.length?records.map(x=>
 '<article class="record f90-special-request" data-id="'+esc(x.id)+'" data-source="'+esc(x.source)+'"><div class="record-main">'+
 '<h3>'+esc(kinds[x.kind]||x.kind)+' · '+esc(x.subtitle)+'</h3>'+
 '<p>الحساب/التواصل: '+esc(x.contact||x.account_id||"—")+'</p>'+
 '<p>التفاصيل: '+esc(x.note||"—")+'</p>'+
 '<p>الكمية: '+esc(x.qty||0)+' | القيمة: $'+esc(x.total)+' | الصافي: $'+esc(x.net)+'</p>'+
 (x.source==="salary"?'<p>المقابل بعملة الإيداع: '+esc(x.payout_amount||0)+' '+esc(x.payout_currency||"USD")+'</p>'+
 (x.receipt_path?'<div class="f90-salary-receipt-action"><button class="button secondary small" type="button" data-f90-salary-receipt="'+esc(x.id)+'">عرض إيصال سحب الراتب</button><span data-f90-receipt-status></span></div>':''):'')+
 '<small>معرّف العميل: '+esc(x.user_id)+' · '+esc(new Date(x.created_at).toLocaleString("ar"))+'</small>'+
 '<p>الحالة: '+esc(states[x.status]||x.status)+(x.review_note?" · "+esc(x.review_note):"")+'</p></div>'+
 (x.status==="pending"||(x.status==="processing"&&x.source==="special")?
 '<div class="f90-request-actions"><input type="text" placeholder="ملاحظة الإدارة" maxlength="1200" aria-label="ملاحظة المراجعة">'+
 (x.source==="special"?'<button class="button secondary small" data-f90-review="processing">قيد المعالجة</button>':'')+
 '<button class="button small" data-f90-review="completed">'+(x.source==="salary"?"اعتماد وإضافة الرصيد":x.source==="transfer"?"اعتماد التحويل":"تم التنفيذ")+'</button>'+
 '<button class="button ghost small" data-f90-review="rejected">'+(x.source==="transfer"?"رفض واسترداد كامل المبلغ":"رفض الطلب")+'</button></div>':'')+
 '</article>').join(""):'<p>لا توجد طلبات حاليًا.</p>');
}

async function renderSalaryInbox(main){
 // Salary deposits are a separate financial table. Never hide these requests
 // when ordinary deposits or unrelated transfer requests fail to load.
 let host=document.getElementById("f90SalaryInbox");
 if(!host){
   main.insertAdjacentHTML("beforeend",
     '<section class="panel" id="f90SalaryInbox"><h2>طلبات إيداع رواتب Xena Live</h2><div data-salary-content role="status">جارٍ جلب الطلبات…</div></section>');
   host=document.getElementById("f90SalaryInbox");
 }
 const content=host?.querySelector("[data-salary-content]");
 if(!content)return;
 const result=await window.F90API.client.rpc("f90_list_salary").catch(error=>({error,data:[]}));
 if(!document.contains(host))return;
 if(result.error){
   content.innerHTML='<div class="notice warning">تعذر جلب طلبات رواتب Xena: '+
     esc(result.error.message||"خطأ اتصال")+
     ' <button class="button secondary small" type="button" data-f90-reload-salary>إعادة المحاولة</button></div>';
   return;
 }
 const records=(result.data||[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 const pending=records.filter(x=>x.status==="pending").length;
 content.innerHTML='<p class="muted small">'+esc(pending)+' بانتظار الاعتماد · '+esc(records.length)+' طلب سحب راتب. اعتماد الطلب يضيف المقابل الدولاري مرة واحدة فقط.</p>'+
 (records.length?records.map(x=>
   '<article class="record f90-special-request" data-id="'+esc(x.id)+'" data-source="salary">'+
   '<div class="record-main"><h3>سحب رواتب Xena Live · '+esc(x.status==="pending"?"بانتظار المراجعة":x.status==="approved"?"معتمد":"مرفوض")+'</h3>'+
   '<p>ID حساب Xena: '+esc(x.account_id)+'</p>'+
   '<p>الكوينز المسحوبة: '+esc(x.coins)+'</p>'+
   '<p>المقابل: '+esc(x.payout_amount)+' '+esc(x.payout_currency)+' · رصيد المحفظة: '+esc(x.usd_amount)+' USD</p>'+
   (x.client_note?'<p>إشعار العميل: '+esc(x.client_note)+'</p>':'')+
   (x.receipt_path?'<button type="button" class="button secondary small" data-f90-salary-receipt="'+esc(x.id)+'">فتح الإيصال</button><span data-f90-receipt-status></span>':'')+
   '<small>التاريخ: '+esc(new Date(x.created_at).toLocaleString("ar"))+'</small></div>'+
   (x.status==="pending"?'<div class="f90-request-actions"><input type="text" maxlength="1200" aria-label="ملاحظة المراجعة" placeholder="ملاحظة الإدارة">'+
   '<button class="button small" type="button" data-f90-review="completed">اعتماد وإضافة الرصيد</button>'+
   '<button class="button ghost small" type="button" data-f90-review="rejected">رفض الطلب</button></div>':'')+
   '</article>').join(""):'<p>لا توجد طلبات سحب رواتب.</p>');
}
document.addEventListener("click",ev=>{
 if(!ev.target.closest?.("[data-f90-reload-salary]"))return;
 ev.preventDefault();
 void renderSalaryInbox(document.getElementById("adminMain"));
});
async function render(kind,main,settings){
 if(kind==="special-requests")return renderRequests(main);
 return renderSettings(main,settings);
}
document.addEventListener("change",ev=>{
 const file=ev.target.closest?.("[data-image-file]");
 if(!file?.files?.[0])return;
 const preview=document.querySelector('[data-preview="'+file.dataset.imageFile+'"]');
 if(preview){const url=URL.createObjectURL(file.files[0]);if(preview.dataset.blob)URL.revokeObjectURL(preview.dataset.blob);preview.dataset.blob=url;preview.src=url;}
});
document.addEventListener("input",ev=>{
 const link=ev.target.closest?.("[data-image-url]");
 if(link){const preview=document.querySelector('[data-preview="'+link.dataset.imageUrl+'"]');if(preview&&/^https:\/\//i.test(link.value))preview.src=link.value;}
});
document.addEventListener("submit",async ev=>{
 if(ev.target?.id!=="f90SpecialAdminForm")return;
 ev.preventDefault();
 ev.stopImmediatePropagation();
 const form=ev.target,send=form.querySelector('button[type="submit"]'),out=form.querySelector("[data-f90-admin-status]");
 if(send.disabled)return;
 send.disabled=true;out.textContent="جارٍ حفظ الخدمات وصورها…";
 try{
 const d=new FormData(form);
 const old=currentSettings?.config?.special_services||{};
 const c={...old};
 for(const k of ["salary_usd_per_100k","transfer_fee_percent","transfer_eta_min_minutes","transfer_eta_max_minutes","account_price_usd"]){
  const raw=Number(d.get(k));
  if(!Number.isFinite(raw)||raw<0)throw Error("قيمة غير صحيحة في "+k);
  c[k]=raw;
 }
 if(c.salary_usd_per_100k<=0||c.transfer_fee_percent>30)throw Error("نسبة الخدمة غير صحيحة");
 if(c.transfer_eta_min_minutes<5||c.transfer_eta_max_minutes>2880||c.transfer_eta_min_minutes>c.transfer_eta_max_minutes)throw Error("مدة التحويل من 5 دقائق حتى 48 ساعة");
 const methods=[...form.querySelectorAll('[data-method-row]')].map(row=>{
   const id=String(row.querySelector('[name="method_id"]').value||"").trim();
   const name_ar=String(row.querySelector('[name="method_name"]').value||"").trim();
   const currency=row.querySelector('[name="method_currency"]').value;
   const fee_percent=Number(row.querySelector('[name="method_fee"]').value);
   const rawRate=row.querySelector('[name="method_rate"]').value.trim();
   const per_usd=rawRate?Number(rawRate):null;
   if(per_usd!==null&&(!Number.isFinite(per_usd)||per_usd<=0))throw Error("سعر تحويل الخدمة غير صحيح");
   const enabled=row.querySelector('[name="method_enabled"]').checked;
   if(!/^[a-z0-9-]{2,60}$/.test(id)||!name_ar||name_ar.length>120||!currencies.includes(currency)||!Number.isFinite(fee_percent)||fee_percent<0||fee_percent>30)throw Error("راجع بيانات كل طريقة تحويل");
   return {...(currentSettings?.config?.money_transfer?.methods||[]).find(x=>x.id===id),id,name_ar,currency,fee_percent,enabled,per_usd,
     image_url:String(row.querySelector('[name="method_image"]').value||""),
     details_ar:String(row.querySelector('[name="method_details"]').value||"").slice(0,2500)};
 });
 if(!methods.length||methods.length>50||new Set(methods.map(x=>x.id)).size!==methods.length)throw Error("أدخل طرق تحويل مستقلة وغير مكررة");
 c.service_catalog=[...form.querySelectorAll('[data-service-row]')].map(row=>{
  const get=name=>String(row.querySelector('[name="service_'+name+'"]').value||'').trim();
  const slug=get('product').split('#/product/').pop();
  return {id:get('id'),kind:get('kind'),name_ar:get('name'),details_ar:get('details').slice(0,2500),image_url:get('image'),product_slug:slug,enabled:row.querySelector('[name="service_enabled"]').checked};
 });
 if(c.service_catalog.some(x=>!x.id||!x.name_ar)||new Set(c.service_catalog.map(x=>x.kind+':'+x.id)).size!==c.service_catalog.length)throw Error('راجع أسماء ومعرّفات الخدمات');
 c.transfer_methods=methods.map(x=>x.name_ar);
 for(const k of ["salary","transfer","account","website"])c[k+"_description"]=String(d.get(k+"_description")||"").slice(0,2500);
 for(const k of ["salary","transfer","account","website","design"])c["show_"+k]=d.get("show_"+k)==="on";
 for(const [id] of imageFields){
   const file=form.elements[id+"_banner_file"].files?.[0];
   if(file){if(!file.type.startsWith("image/")||file.size>5242880)throw Error("صورة غير مدعومة أو أكبر من 5 ميجابايت");
     c[id+"_banner_url"]=(await window.F90API.upload(file,"f90-images","banners")).url;
   }else c[id+"_banner_url"]=String(d.get(id+"_banner_url")||"").slice(0,2000);
 }
 const s=currentSettings;
 await window.F90API.call("settings.save",{data:{store_name:s.store_name,logo_url:s.logo_url,primary_color:s.primary_color,
  currency:s.currency,contact_email:s.contact_email,announcement:s.announcement,
  config:{...s.config,special_services:c,
    salary_withdrawal:{...s.config.salary_withdrawal,enabled:c.show_salary,
      coins_per_usd:100000/c.salary_usd_per_100k,
      minimum_coins:s.config.salary_withdrawal?.minimum_coins||100000,
      payout_options:(s.config.salary_withdrawal?.payout_options||[]).map(opt=>
        opt.currency==="USD"?{...opt,per_100k:c.salary_usd_per_100k,units_per_usd:1}:opt),
      details_ar:c.salary_description},
    money_transfer:{...s.config.money_transfer,enabled:c.show_transfer,
      fee_percent:c.transfer_fee_percent,eta_min_minutes:c.transfer_eta_min_minutes,
      eta_max_hours:Math.ceil(c.transfer_eta_max_minutes/60),
      methods}
   }}});
 out.textContent="تم حفظ الإعدادات، وستظهر بعد تحديث المتجر.";
 }catch(error){out.textContent="تعذر الحفظ: "+(error?.message||"خطأ غير معروف");}finally{send.disabled=false;}
});
document.addEventListener("click",async ev=>{
 const proofButton=ev.target.closest?.("[data-f90-salary-receipt]");
 if(!proofButton)return;
 ev.preventDefault();
 if(proofButton.disabled)return;
 proofButton.disabled=true;
 const status=proofButton.parentElement?.querySelector("[data-f90-receipt-status]");
 if(status)status.textContent="جارٍ تجهيز رابط الإيصال الخاص…";
 try{
   const ticket=await window.F90API.call("staff.file",{kind:"salary",id:proofButton.dataset.f90SalaryReceipt});
   const url=String(ticket?.signedUrl||"");
   if(!/^https:\/\//i.test(url))throw Error("رابط الإيصال غير متاح");
   if(status)status.innerHTML='<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">فتح الإيصال الخاص</a> <small>صلاحية الرابط 5 دقائق</small>';
 }catch(err){if(status)status.textContent=String(err?.message||"تعذّر تحميل الإيصال");}
 finally{proofButton.disabled=false;}
});
document.addEventListener("click",async ev=>{
 if(ev.target.closest?.('[data-add-method]')){document.getElementById('f90TransferRows')?.insertAdjacentHTML('beforeend',methodRow({id:'method-'+crypto.randomUUID().slice(0,8)}));return;}
 if(ev.target.closest?.('[data-remove-method]')){ev.target.closest('[data-method-row]')?.remove();return;}
 const btn=ev.target.closest?.("[data-f90-review]");if(!btn)return;
 const row=btn.closest("[data-id]"),note=row.querySelector("input")?.value||"",source=row.dataset.source;
 if(btn.disabled)return;
 const approved=btn.dataset.f90Review==="completed";
 const explanation=source==="salary"?(approved?"سيُضاف رصيد العميل بعد الاعتماد.":"سيُرفض السحب دون إضافة رصيد."):
   source==="transfer"?(approved?"سوف تعتمد الطلب المخصوم سابقًا.":"سيرد المبلغ والعمولة إلى المحفظة."):"هذا التغيير إداري فقط ولا ينفّذ معاملة مالية.";
 if(!window.confirm("تأكيد القرار؟ "+explanation))return;
 btn.disabled=true;
 try{
  const fn=source==="salary"?"f90_review_salary":source==="transfer"?"f90_review_transfer":"f90_special_review";
  const args=source==="special"?{p_id:row.dataset.id,p_status:btn.dataset.f90Review,p_note:note}:
    {p_id:row.dataset.id,p_approve:approved,p_note:note};
  const {error}=await window.F90API.client.rpc(fn,args);
  if(error)throw error;
  const adminMain=document.getElementById("adminMain");
  if(document.getElementById("f90SalaryInbox"))await renderSalaryInbox(adminMain);
  else await renderRequests(adminMain);
 }catch(e){window.alert(e.message||"تعذر تحديث الحالة");btn.disabled=false;}
});
window.F90SpecialAdmin={render,salaryEditor,renderSalaryInbox};

document.addEventListener('click',ev=>{
 if(ev.target.closest?.('[data-add-service]'))document.getElementById('f90ServiceRows')?.insertAdjacentHTML('beforeend',catalogRow({id:crypto.randomUUID(),kind:'design',name_ar:'',enabled:true}));
 ev.target.closest?.('[data-remove-service]')?.closest('[data-service-row]')?.remove();
});

})();
