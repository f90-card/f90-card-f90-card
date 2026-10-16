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
 check("method_enabled","إظهار الخدمة",x.enabled!==false)+'<button class="button secondary small" type="button" data-remove-method>حذف الطريقة</button></div>';
async function renderSettings(main,settings){
 currentSettings=settings;
 const sal=settings?.config?.salary_withdrawal||{},tr=settings?.config?.money_transfer||{};
 const c={...d,...(settings?.config?.special_services||{}),
    salary_usd_per_100k:Number(sal.coins_per_usd)>0?100000/Number(sal.coins_per_usd):10,
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
 field("salary_usd_per_100k","الدولار لكل 100,000 كوينز",c.salary_usd_per_100k,"number",'min="0.01" max="100000" step="0.01" required')+
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
async function renderRequests(main){
 main.innerHTML=heading("طلبات سحب الرواتب والتحويلات والخدمات","سحب الرواتب يُعتمد لإضافة رصيد؛ التحويل يُخصم عند تقديمه ويُسترد عند رفضه. باقي الخدمات طلبات تواصل.")+
 '<div id="f90RequestRecords" class="records"><p>جارٍ جلب الطلبات…</p></div>';
 const client=window.F90API.client;
 const [sp,sal,tr]=await Promise.all([
   client.from("f90_special_requests").select("*").order("created_at",{ascending:false}).limit(150),
   client.rpc("f90_list_salary"),
   client.rpc("f90_list_transfers")
 ]);
 const el=document.getElementById("f90RequestRecords");if(!el)return;
 const errors=[sp.error,sal.error,tr.error].filter(Boolean);
 if(errors.length){el.textContent="تعذّر تحميل بعض القوائم: "+errors.map(x=>x.message).join(" · ");return;}
 const records=[
  ...(sp.data||[]).map(x=>({...x,source:"special",subtitle:x.service,contact:x.contact_whatsapp,
    qty:x.amount_units,total:x.gross_usd,net:x.net_usd,note:x.client_details})),
  ...(sal.data||[]).map(x=>({...x,source:"salary",kind:"salary",subtitle:"رواتب Xena Live",
    contact:x.account_id,qty:x.coins,total:x.usd_amount,net:x.usd_amount,note:x.details_snapshot})),
  ...(tr.data||[]).map(x=>({...x,source:"transfer",kind:"transfer",subtitle:x.method_name,
    contact:x.recipient_details,qty:x.net_usd,total:x.total_usd,net:x.net_usd,note:x.recipient_details}))
 ].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 const kinds={salary:"سحب راتب",transfer:"تحويل أموال",account:"حساب Xena",design:"تصميم",website:"إنشاء موقع"};
 const states={pending:"بانتظار المراجعة",processing:"قيد المعالجة",completed:"مكتمل",rejected:"مرفوض",approved:"معتمد"};
 el.innerHTML=records.length?records.map(x=>
 '<article class="record f90-special-request" data-id="'+esc(x.id)+'" data-source="'+esc(x.source)+'"><div class="record-main">'+
 '<h3>'+esc(kinds[x.kind]||x.kind)+' · '+esc(x.subtitle)+'</h3>'+
 '<p>الحساب/التواصل: '+esc(x.contact||x.account_id||"—")+'</p>'+
 '<p>التفاصيل: '+esc(x.note||"—")+'</p>'+
 '<p>الكمية: '+esc(x.qty||0)+' | القيمة: $'+esc(x.total)+' | الصافي: $'+esc(x.net)+'</p>'+
 '<small>معرّف العميل: '+esc(x.user_id)+' · '+esc(new Date(x.created_at).toLocaleString("ar"))+'</small>'+
 '<p>الحالة: '+esc(states[x.status]||x.status)+(x.review_note?" · "+esc(x.review_note):"")+'</p></div>'+
 (x.status==="pending"||(x.status==="processing"&&x.source==="special")?
 '<div class="f90-request-actions"><input type="text" placeholder="ملاحظة الإدارة" maxlength="1200" aria-label="ملاحظة المراجعة">'+
 (x.source==="special"?'<button class="button secondary small" data-f90-review="processing">قيد المعالجة</button>':'')+
 '<button class="button small" data-f90-review="completed">'+(x.source==="salary"?"اعتماد وإضافة الرصيد":x.source==="transfer"?"اعتماد التحويل":"تم التنفيذ")+'</button>'+
 '<button class="button ghost small" data-f90-review="rejected">'+(x.source==="transfer"?"رفض واسترداد كامل المبلغ":"رفض الطلب")+'</button></div>':'')+
 '</article>').join(""):'<p>لا توجد طلبات حاليًا.</p>';
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
   const enabled=row.querySelector('[name="method_enabled"]').checked;
   if(!/^[a-z0-9-]{2,60}$/.test(id)||!name_ar||name_ar.length>120||!currencies.includes(currency)||!Number.isFinite(fee_percent)||fee_percent<0||fee_percent>30)throw Error("راجع بيانات كل طريقة تحويل");
   return {id,name_ar,currency,fee_percent,enabled};
 });
 if(!methods.length||methods.length>50||new Set(methods.map(x=>x.id)).size!==methods.length)throw Error("أدخل طرق تحويل مستقلة وغير مكررة");
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
      coins_per_usd:100000/c.salary_usd_per_100k,minimum_coins:100000,details_ar:c.salary_description},
    money_transfer:{...s.config.money_transfer,enabled:c.show_transfer,
      fee_percent:c.transfer_fee_percent,eta_min_minutes:c.transfer_eta_min_minutes,
      eta_max_hours:Math.ceil(c.transfer_eta_max_minutes/60),
      methods}
   }}});
 out.textContent="تم حفظ الإعدادات، وستظهر بعد تحديث المتجر.";
 }catch(error){out.textContent="تعذر الحفظ: "+(error?.message||"خطأ غير معروف");}finally{send.disabled=false;}
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
  await renderRequests(document.getElementById("adminMain"));
 }catch(e){window.alert(e.message||"تعذر تحديث الحالة");btn.disabled=false;}
});
window.F90SpecialAdmin={render};
})();
