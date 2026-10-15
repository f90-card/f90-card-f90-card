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
async function renderSettings(main,settings){
 currentSettings=settings;
 const c={...d,...(settings?.config?.special_services||{})};
 main.innerHTML=heading("إدارة الخدمات الإضافية","أسعار ورسوم وتعليمات مستقلة. تعرض الأسعار للعميل ويؤكدها الخادم قبل تسجيل الطلب.")+
 '<form id="f90SpecialAdminForm" class="f90-manager-form">'+
 '<section class="panel"><h2>سحب رواتب Xena Live</h2><div class="field-row">'+
 field("salary_usd_per_100k","الدولار لكل 100,000 كوينز",c.salary_usd_per_100k,"number",'min="0" max="100000" step="0.01" required')+
 field("salary_fee_percent","عمولة سحب الراتب ٪",c.salary_fee_percent,"number",'min="0" max="50" step="0.01" required')+'</div>'+
 textarea("salary_description","تفاصيل الخدمة للعميل",c.salary_description)+
 check("show_salary","إظهار الخدمة في طرق الإيداع",c.show_salary!==false)+'</section>'+
 '<section class="panel"><h2>التحويلات المالية</h2><div class="field-row">'+
 field("transfer_fee_percent","عمولة التحويل ٪",c.transfer_fee_percent,"number",'min="0" max="50" step="0.01" required')+
 field("transfer_eta_min_minutes","أقل مدة بالدقائق",c.transfer_eta_min_minutes,"number",'min="5" max="2880" required')+
 field("transfer_eta_max_minutes","أقصى مدة بالدقائق",c.transfer_eta_max_minutes,"number",'min="5" max="2880" required')+'</div>'+
 textarea("transfer_methods","طرق التحويل (كل طريقة بسطر)",(c.transfer_methods||d.transfer_methods||[]).join("\n"))+
 textarea("transfer_description","تفاصيل تحويل الأموال",c.transfer_description)+check("show_transfer","إظهار قسم التحويلات",c.show_transfer!==false)+'</section>'+
 '<section class="panel"><h2>بيع الحسابات والتصميم والمواقع</h2><div class="field-row">'+
 field("account_price_usd","سعر حساب Xena بالدولار (صفر = يُحدد لاحقًا)",c.account_price_usd||0,"number",'min="0" max="1000000" step="0.01"')+
 field("website_price_usd","سعر إنشاء الموقع بالدولار",c.website_price_usd||500,"number",'min="0" max="1000000" step="0.01"')+'</div>'+
 textarea("account_description","وصف شراء حساب Xena",c.account_description)+
 textarea("website_description","وصف الموقع الكامل",c.website_description)+
 check("show_account","إظهار حسابات Xena",c.show_account!==false)+
 check("show_design","إظهار قسم التصاميم",c.show_design!==false)+
 check("show_website","إظهار قسم المواقع",c.show_website!==false)+'</section>'+
 '<section class="panel"><h2>الصور والبنرات الخاصة بالخدمات</h2><p class="muted">كل صورة مستقلة، وتظهر معاينتها قبل الرفع. يمكنك أيضًا استخدام رابط صورة موجودة.</p>'+
 imageFields.map(([id,title,where])=>{
 const url=c[id+"_banner_url"]||"./assets/f90-new/banner-"+(id==="account"?"digital":id)+".webp";
 return '<div class="f90-special-image-config"><strong>'+title+'</strong><small>مكان العرض: '+where+'</small>'+
 '<img class="f90-special-admin-preview" data-preview="'+id+'" alt="معاينة '+title+'" src="'+esc(url)+'">'+
 field(id+"_banner_url","رابط الصورة",c[id+"_banner_url"]||"","url",'data-image-url="'+id+'" placeholder="https://..."')+
 '<label class="field"><span>رفع صورة أو GIF جديدة</span><input type="file" name="'+id+'_banner_file" data-image-file="'+id+'" accept="image/png,image/jpeg,image/webp,image/gif"></label></div>';
 }).join("")+'</section>'+
 '<div class="f90-manager-save"><p data-f90-admin-status role="status"></p><button type="submit" class="button">حفظ إعدادات الخدمات</button></div></form>';
}
async function renderRequests(main){
 main.innerHTML=heading("طلبات الخدمات الخاصة","جميع عمليات التحويل وسحب الرواتب تبقى للمراجعة اليدوية. هذه الصفحة لا تخصم ولا تضيف رصيدًا.")+'<div id="f90RequestRecords" class="records"><p>جارٍ جلب الطلبات…</p></div>';
 const {data,error}=await window.F90API.client.from("f90_special_requests").select("*").order("created_at",{ascending:false}).limit(150);
 const el=document.getElementById("f90RequestRecords");
 if(!el)return;
 if(error){el.textContent="تعذر تحميل الطلبات: "+error.message;return;}
 const kinds={salary:"سحب راتب",transfer:"تحويل أموال",account:"حساب Xena",design:"تصميم",website:"إنشاء موقع"};
 const states={pending:"بانتظار المراجعة",processing:"قيد المعالجة",completed:"مكتمل",rejected:"مرفوض"};
 el.innerHTML=data?.length?data.map(x=>
 '<article class="record f90-special-request" data-id="'+esc(x.id)+'"><div class="record-main"><h3>'+esc(kinds[x.kind]||x.kind)+' · '+esc(x.service)+'</h3>'+
 '<p>الحساب: '+esc(x.account_id||"—")+' · التواصل: '+esc(x.contact_whatsapp||"—")+'</p>'+
 '<p>معلومات الطلب: '+esc(x.client_details||"—")+'</p>'+
 '<p>الكمية: '+esc(x.amount_units)+' | القيمة: $'+esc(x.gross_usd)+' | العمولة: $'+esc(x.fee_usd)+' | الصافي: $'+esc(x.net_usd)+'</p>'+
 '<small>معرّف العميل: '+esc(x.user_id)+' · '+esc(new Date(x.created_at).toLocaleString("ar"))+'</small>'+
 '<p>الحالة: '+esc(states[x.status]||x.status)+(x.review_note?" · "+esc(x.review_note):"")+'</p></div>'+
 (x.status==="pending"||x.status==="processing"?'<div class="f90-request-actions"><input type="text" placeholder="ملاحظة الإدارة" aria-label="ملاحظة المراجعة" maxlength="1200"><button class="button secondary small" data-f90-review="processing">قيد المعالجة</button><button class="button small" data-f90-review="completed">تم التنفيذ يدويًا</button><button class="button ghost small" data-f90-review="rejected">رفض الطلب</button></div>':'')+
 '</article>').join(""):'<p>لا توجد طلبات خاصة حاليًا.</p>';
}
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
 const form=ev.target,send=form.querySelector('button[type="submit"]'),out=form.querySelector("[data-f90-admin-status]");
 if(send.disabled)return;
 send.disabled=true;out.textContent="جارٍ حفظ الخدمات وصورها…";
 try{
 const d=new FormData(form);
 const old=currentSettings?.config?.special_services||{};
 const c={...old};
 for(const k of ["salary_usd_per_100k","salary_fee_percent","transfer_fee_percent","transfer_eta_min_minutes","transfer_eta_max_minutes","account_price_usd","website_price_usd"]){
  const raw=Number(d.get(k));
  if(!Number.isFinite(raw)||raw<0)throw Error("قيمة غير صحيحة في "+k);
  c[k]=raw;
 }
 if(c.salary_fee_percent>50||c.transfer_fee_percent>50)throw Error("نسبة العمولة يجب ألا تتجاوز 50٪");
 if(c.transfer_eta_min_minutes<5||c.transfer_eta_max_minutes>2880||c.transfer_eta_min_minutes>c.transfer_eta_max_minutes)throw Error("مدة التحويل من 5 دقائق حتى 48 ساعة");
 c.transfer_methods=String(d.get("transfer_methods")||"").split("\n").map(x=>x.trim().slice(0,120)).filter(Boolean).slice(0,50);
 if(!c.transfer_methods.length)throw Error("أدخل طريقة تحويل واحدة على الأقل");
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
  config:{...s.config,special_services:c}}});
 out.textContent="تم حفظ الإعدادات، وستظهر بعد تحديث المتجر.";
 }catch(error){out.textContent="تعذر الحفظ: "+(error?.message||"خطأ غير معروف");}finally{send.disabled=false;}
});
document.addEventListener("click",async ev=>{
 const btn=ev.target.closest?.("[data-f90-review]");if(!btn)return;
 const row=btn.closest("[data-id]"),note=row.querySelector("input")?.value||"";
 if(btn.disabled)return;
 if(!window.confirm("تأكيد تغيير الحالة؟ لا تُنفّذ أي عملية مالية تلقائيًا."))return;
 btn.disabled=true;
 try{
  const {error}=await window.F90API.client.rpc("f90_special_review",{p_id:row.dataset.id,p_status:btn.dataset.f90Review,p_note:note});
  if(error)throw error;
  await renderRequests(document.getElementById("adminMain"));
 }catch(e){window.alert(e.message||"تعذر تحديث الحالة");btn.disabled=false;}
});
window.F90SpecialAdmin={render};
})();