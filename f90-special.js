/* Additional F90 CARD request-based services; funds remain untouched until manual review. */
(function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const defaults={
  salary_usd_per_100k:10,salary_fee_percent:0,transfer_fee_percent:2,
  transfer_eta_min_minutes:5,transfer_eta_max_minutes:2880,website_price_usd:500,account_price_usd:0,
  salary_description:"تحويل رواتب Xena Live إلى رصيد المحفظة بعد مراجعة الإدارة.",
  transfer_description:"أدخل بيانات التحويل بدقة؛ تظهر لك قيمة الصافي قبل الإرسال.",
  account_description:"شراء حساب Xena Live؛ يراجع فريق المتجر التفاصيل ويتواصل معك عبر واتساب.",
  website_description:"خدمة إنشاء موقع كامل باسمك شاملة خدمات الموقع، تبدأ من 500 دولار.",
  transfer_methods:["شام كاش","أورنج موني","كليك","بنك فلسطين","USDT","بنك زراعت تركيا","ويش موني"],
  design_services:["تصميم صور متحركة","تصميم بنرات","تصميم شريط متحرك","تصميم احتفال وكالة","تصميم أعياد ميلاد"]
};
const conf=settings=>({...defaults,...(settings?.config?.special_services||{})});
const fmt=n=>'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const num=(v,fallback=0,lo=0,hi=100000000)=>{const x=Number(v);return Number.isFinite(x)?Math.max(lo,Math.min(hi,x)):fallback};
const images={
 digital:"./assets/f90-new/banner-digital.webp",
 transfer:"./assets/f90-new/banner-transfer.webp",
 account:"./assets/f90-new/banner-accounts.webp",
 design:"./assets/f90-new/banner-design.webp",
 website:"./assets/f90-new/banner-website.webp",
 salary:"./assets/f90-new/banner-salary.webp"
};
const serviceCatalog=settings=>{
 const custom=settings?.config?.special_services?.service_catalog;
 return Array.isArray(custom)?custom:[
 ...defaults.design_services.map((name,i)=>({id:String(i+1),kind:"design",name_ar:name,enabled:true,image_url:"./assets/f90-new/"+["design-animated-v2","design-banners-v2","design-ticker-v2","design-agency-v2","design-birthday-v2"][i]+".webp"})),
 {id:"xena",kind:"account",name_ar:"حسابات Xena Live",enabled:true,image_url:"./assets/f90-new/account-xena-v2.webp"}
 ];
};
const links=[
 ["transfer","تحويل الأموال","التحويل بين المحافظ والحسابات"],
 ["account","بيع الحسابات","حسابات Xena Live"],
 ["design","احصل على تصميم","بنرات وصور متحركة واحتفالات"],
 ["website","موقع كامل ملك لك","موقع شامل الخدمات بسعر واضح"]
];
let visibleConfig=defaults;
let visibleRates=[];
let visibleMethods=[];
let visibleSalaryOptions=[];
let customerSalaryCurrency="USD";
let canSubmitSalary=false;
let canSubmitTransfer=false;
const targetMoney=(amount,code)=>Number(amount||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:3})+' '+code;
const salaryCredit=(usd)=>{
 const rate=visibleRates.find(x=>x.currency===customerSalaryCurrency&&x.is_enabled&&Number(x.per_usd)>0);
 return rate?targetMoney(Number(usd)*Number(rate.per_usd),customerSalaryCurrency):"—";
};
function home(settings){
 const c=conf(settings);
 const ads=[["digital","الخدمات الرقمية"],["transfer","تحويل الأموال"],["design","تصاميم احترافية"],["website","احصل على موقعك"]];
 return '<section class="f90-special-home" aria-label="إعلانات الخدمات">'+
 '<div class="f90-special-ad-strip" aria-label="إعلانات خاصة بالمتجر">'+ads.filter(([id])=>c["show_"+id]!==false).map(([id,title])=>
 '<div class="f90-special-ad"><img src="'+images[id]+'" alt="'+esc(title)+'" loading="lazy"></div>').join("")+
 '</div></section>';
}
function category(slug,settings){
 const root=document.getElementById("mainContent"),c=conf(settings);
 const group={
  "money-transfer":{title:"تحويل الأموال",banner:"transfer",kind:"transfer",items:Array.isArray(settings?.config?.money_transfer?.methods)?settings.config.money_transfer.methods.filter(x=>x.enabled!==false).map(x=>[x.id,x.name_ar]):[]},
  "account-sales":{title:"بيع حسابات Xena Live",banner:"account",kind:"account",items:serviceCatalog(settings).filter(x=>x.kind==="account"&&x.enabled!==false).map(x=>[x.id,x.name_ar,x])},
  "design-services":{title:"احصل على تصميم احترافي",banner:"design",kind:"design",items:serviceCatalog(settings).filter(x=>x.kind==="design"&&x.enabled!==false).map(x=>[x.id,x.name_ar,x])},
  "complete-website":{title:"موقع كامل ملك لك",banner:"website",kind:"website",items:[["","إنشاء موقع شامل الخدمات"]]}
 }[slug];
 if(!group)return false;
 const img=String(c[group.banner+"_banner_url"]||images[group.banner]);
 const links=group.items.map(([id,title,item],i)=>{
  const href=item?.product_slug?"#/product/"+encodeURIComponent(item.product_slug):"#/special/"+group.kind+(id?"/"+encodeURIComponent(id):"");
  return '<a class="f90-special-section-option" href="'+href+'" aria-label="'+esc(title)+'">'+
  (item?.image_url?'<img class="f90-service-thumb" src="'+esc(item.image_url)+'" alt="'+esc(title)+'">':'<span class="f90-special-option-number">'+String(i+1).padStart(2,"0")+'</span>')+'<strong>'+esc(title)+'</strong><span aria-hidden="true">‹</span></a>';
 }).join("");
 root.innerHTML='<section class="f90-special-section"><div class="f90-special-category-tools">'+
 '<button type="button" class="button secondary small" data-action="share" title="نسخ رابط القسم" aria-label="نسخ رابط القسم">⧉</button></div>'+
 '<img class="f90-special-section-banner" src="'+esc(img)+'" alt="'+esc(group.title)+'" loading="eager">'+
 '<div class="f90-special-section-options">'+links+'</div></section>';
 return true;
}
function moneyPanel(gross,fee,net,feePercent,label){
 return '<div class="f90-special-estimate" role="status" aria-live="polite">'+
 '<div><span>'+(label||"المبلغ قبل العمولة")+'</span><strong data-gross>'+fmt(gross)+'</strong></div>'+
 '<div><span>العمولة <span data-fee-rate>'+feePercent+'٪</span></span><strong data-fee>'+fmt(fee)+'</strong></div>'+
 '<div class="f90-special-net"><span>الصافي بعد العمولة</span><strong data-net>'+fmt(net)+'</strong></div></div>';
}
const input=(name,label,type="text",attr="")=>'<label class="field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" '+attr+'></label>';
function render(kind,settings,user,selected="",rates=[]){
 visibleRates=Array.isArray(rates)?rates:[];
 const config=settings?.config||{},sal=config.salary_withdrawal||{},tr=config.money_transfer||{};
 const c=visibleConfig={...conf(settings),
  salary_usd_per_100k:Number(sal.coins_per_usd)>0?100000/Number(sal.coins_per_usd):10,
  salary_minimum_coins:Math.max(100000,Number(sal.minimum_coins)||100000),
  salary_fee_percent:0,transfer_fee_percent:num(tr.fee_percent,2,0,30),
  transfer_eta_min_minutes:num(tr.eta_min_minutes,5,5,2880),
  transfer_eta_max_minutes:num(tr.eta_max_hours,48,1,48)*60
 };
 const d=kind||"transfer";
 if(d==="website"){location.hash="#/product/f90-full-website-500";return;}
 const isVerified=!!user?.profile?.is_verified,isSigned=!!user;
 canSubmitTransfer=isVerified&&isSigned&&tr.enabled===true&&c.show_transfer!==false;
 canSubmitSalary=isVerified&&isSigned&&sal.enabled===true&&c.show_salary!==false;
 customerSalaryCurrency=["USD","ILS","JOD"].includes(user?.profile?.account_currency)
   ? user.profile.account_currency:"USD";
 visibleSalaryOptions=(Array.isArray(sal.payout_options)?sal.payout_options:[]).filter(x=>
   x?.enabled===true && visibleRates.some(r=>r.currency===x.currency&&r.is_enabled&&Number(r.per_usd)>0) &&
   Number(x.per_100k)>0 && Number(x.units_per_usd)>0);
 const salary=d==="salary",transfer=d==="transfer",account=d==="account",design=d==="design",website=d==="website";
 const methods=visibleMethods=Array.isArray(tr.methods)?tr.methods.filter(x=>x?.enabled!==false):[];
 let title=salary?"سحب رواتب Xena Live":transfer?"تحويل الأموال":account?"شراء حسابات Xena Live":design?"احصل على تصميم":"احصل على موقع كامل ملك لك";
 const chosenService=serviceCatalog(settings).find(x=>x.kind===d&&x.id===selected&&x.enabled!==false);
 if(chosenService)title=chosenService.name_ar;
 if(chosenService?.product_slug){location.hash="#/product/"+encodeURIComponent(chosenService.product_slug);return;}
 const banner=String((salary&&sal.image_url)||c[d+"_banner_url"]||images[d]||images.website);
 const desc=chosenService?.details_ar||(salary?sal.details_ar:undefined)||c[d+"_description"]||defaults[d+"_description"]||"";
 let fields="";
 if(salary){
   const min=Math.max(100000,Number(sal.minimum_coins)||100000);
   fields=(desc||sal.processing_notice_ar?'<details class="f90-finance-help"><summary>تعليمات سحب الرواتب</summary>'+
     '<p>'+esc(desc)+'</p>'+
     (sal.processing_notice_ar?'<p>'+esc(sal.processing_notice_ar)+'</p>':'')+
     '</details>':'')+
   input("account",esc(sal.account_label_ar||"ID حساب Xena Live الذي تم السحب منه"),"text",'required minlength="2" maxlength="120" autocomplete="off" placeholder="معرّف حسابك في Xena Live"')+
   input("amount","كمية الكوينز للسحب","number",'required min="'+min+'" step="1" inputmode="numeric" value="'+min+'"')+
   '<small class="f90-finance-hint">الحد الأدنى '+min.toLocaleString('en-US')+' كوينز</small>'+
   '<div class="f90-fixed-account-currency" role="status"><small>عملة حسابك</small>'+
     '<strong>'+esc(visibleSalaryOptions.find(x=>x.currency===customerSalaryCurrency)?.label_ar||customerSalaryCurrency)+' ('+esc(customerSalaryCurrency)+')</strong></div>'+
   '<input name="payout_currency" type="hidden" value="'+esc(customerSalaryCurrency)+'">'+
   (!visibleSalaryOptions.some(x=>x.currency===customerSalaryCurrency)?
     '<p class="f90-special-alert">سحب الرواتب غير متاح حاليًا بعملة حسابك؛ اختر عملة أخرى من الشريط العام.</p>':'')+
   '<div class="f90-salary-quote f90-finance-simple-quote" role="status" aria-live="polite">'+
     '<small>سينضاف لرصيدك بعد الموافقة</small>'+
     '<strong data-salary-target>—</strong>'+
     '<span data-salary-coins hidden></span><span data-salary-usd hidden></span>'+
     '<p data-salary-rate hidden></p></div>'+
   '<details class="f90-finance-help"><summary>إضافة ملاحظة (اختياري)</summary>'+
     '<label class="field"><span>ملاحظة للإدارة</span><textarea name="note" rows="2" maxlength="1200" placeholder="ملاحظة أو رقم تأكيد"></textarea></label></details>'+
   '<label class="field f90-deposit-upload"><span>صورة تأكيد السحب</span><input name="receipt" type="file" required accept="image/jpeg,image/png,image/webp"><small>JPG أو PNG أو WEBP، بحد أقصى 5 ميجابايت</small></label>'+
   '<p class="f90-special-tiny">لا يُضاف الرصيد إلا بعد موافقة الإدارة.</p>';
 }else if(transfer){
   fields='<label class="field"><span>وسيلة التحويل</span><select name="service" required>'+
     methods.map(x=>'<option value="'+esc(x.id)+'" '+(selected===x.id?'selected':'')+'>'+esc(x.name_ar)+' · '+esc(x.currency||"USD")+'</option>').join("")+'</select></label>'+
   '<div class="f90-transfer-methods" role="group" aria-label="خيارات التحويل">'+
     methods.map((x,i)=>'<button type="button" data-f90-transfer-method="'+esc(x.id)+'" aria-pressed="'+(selected?selected===x.id:i===0)+'">'+esc(x.name_ar)+'</button>').join("")+'</div>'+
   input("amount","قيمة السحب بعملة الخدمة المختارة","number",'required min="1" max="100000000" step="0.01" inputmode="decimal" placeholder="0.00"')+
   '<p class="f90-special-tiny" data-target-currency>العملة: '+esc(methods.find(x=>x.id===selected)?.currency||methods[0]?.currency||"USD")+'</p>'+
   '<label class="field"><span>بيانات المستلم والتحويل</span><textarea name="details" required minlength="3" maxlength="2000" rows="4" placeholder="بيانات المستلم والوسيلة ورقم الحساب أو العنوان"></textarea></label>'+
   moneyPanel(0,0,0,num(methods.find(x=>x.id===selected)?.fee_percent??methods[0]?.fee_percent,c.transfer_fee_percent,0,30),"إجمالي الخصم من المحفظة USD")+
   '<p class="f90-special-tiny" data-target-net>المبلغ الذي سيصل للمستفيد: —</p>'+
   '<p class="f90-special-tiny">تضاف عمولة الطريقة المختارة فوق المبلغ الصافي. المدة المتوقعة: من '+c.transfer_eta_min_minutes+' إلى '+c.transfer_eta_max_minutes+' دقيقة بعد المراجعة.</p>'+
   '<p class="f90-special-tiny">رصيد محفظتك الحالي: '+(isSigned?fmt(Number(user?.wallet?.balance_usd)||0):"سجّل الدخول")+'</p>';
 }else{
   fields=(design?'<label class="field"><span>نوع التصميم</span><select name="service">'+serviceCatalog(settings).filter(x=>x.kind==="design"&&x.enabled!==false).map(x=>'<option '+(selected===x.id?'selected':'')+'>'+esc(x.name_ar)+'</option>').join("")+'</select></label>':'')+
     input("contact","رقم واتساب للتواصل","tel",'required minlength="6" maxlength="90" inputmode="tel" dir="ltr" placeholder="+970..."')+
     (design?'<label class="field"><span>تفاصيل التصميم</span><textarea name="details" rows="3" maxlength="3000" placeholder="الفكرة، المناسبة، الألوان والمقاسات المطلوبة"></textarea></label>':"");
   const price=website?num(c.website_price_usd,500,0):account?num(c.account_price_usd,0,0):0;
   fields+='<div class="f90-special-quote"><span>'+(price?"سعر الخدمة المعلن":"السعر بعد مراجعة التفاصيل")+'</span><strong>'+(price?fmt(price):"يُحدد عند التواصل")+'</strong></div>';
 }
 const notice=(!isSigned?'<p class="f90-special-alert">سجّل الدخول قبل إرسال طلبك. <a href="#/auth">تسجيل الدخول</a></p>':
 ((salary||transfer)&&!isVerified?'<p class="f90-special-alert">توثيق الحساب مطلوب قبل العمليات المالية. <a href="#/verification">توثيق الحساب</a></p>':''));
 if(account&&chosenService)fields+='<input type="hidden" name="service" value="'+esc(chosenService.name_ar)+'">';
 const enabled=(!(account||design)||!selected||!!chosenService)&&c["show_"+d]!==false && (!salary||sal.enabled===true&&visibleSalaryOptions.some(x=>x.currency===customerSalaryCurrency)) && (!transfer||tr.enabled===true&&methods.length>0);
 const footnote=transfer?"يُخصم صافي المبلغ والعمولة من المحفظة فور تقديم الطلب، ويُسترد المبلغ عند رفضه بعد مراجعة الإدارة.":
   salary?"لا يُضاف الرصيد إلا بعد مراجعة سحب الراتب واعتماده.":"هذا طلب خدمة وتواصل، وليس خصمًا من محفظتك.";

 document.getElementById("mainContent").innerHTML=
 '<section class="f90-special-page f90-deposit-compact" data-kind="'+esc(d)+'"><a class="f90-special-back" href="#/">‹ العودة إلى الرئيسية</a>'+
 '<div class="f90-special-banner"><img src="'+esc(banner)+'" alt="'+esc(title)+'" loading="lazy" decoding="async"></div>'+
 '<div class="f90-special-panel"><h1>'+title+'</h1>'+(salary?'':'<p>'+esc(desc)+'</p>')+
 (transfer?'<div data-method-info></div>':'')+
 (!salary&&chosenService?.image_url?'<img class="f90-service-art" src="'+esc(chosenService.image_url)+'" alt="'+esc(chosenService.name_ar)+'">':'')+
 notice+'<form id="f90SpecialForm" data-kind="'+esc(d)+'"><input type="hidden" name="kind" value="'+esc(d)+'">'+
 fields+(salary?'':'<p class="f90-special-footnote">'+esc(footnote)+'</p>')+
 '<div class="f90-finance-review" data-review hidden></div><p class="f90-special-alert" data-status hidden></p>'+
 '<button class="button full" type="submit" '+(!enabled||!isSigned||((salary||transfer)&&!isVerified)?"disabled":"")+'>'+
 (transfer?"تأكيد طلب التحويل":"إرسال الطلب للمراجعة")+'</button></form></div></section>';
 updateEstimate(document.getElementById("f90SpecialForm"));
}
function updateEstimate(form){
 if(!form)return;
 const k=form.dataset.kind,c=visibleConfig;
 if(!["salary","transfer"].includes(k))return;
 const v=Math.max(0,Number(form.elements.amount?.value)||0);
 if(k==="salary"){
   const opt=visibleSalaryOptions.find(x=>x.currency===customerSalaryCurrency);
   const min=Math.max(100000,Number(visibleConfig.salary_minimum_coins)||100000);
   const rate=Number(opt?.per_100k),perUsd=Number(opt?.units_per_usd);
   const valid=!!opt && Number.isSafeInteger(v) && v>=min && v<=1000000000000 &&
     Number.isFinite(rate)&&rate>0 && Number.isFinite(perUsd)&&perUsd>0;
   const amount=valid?v/100000*rate:0, usd=valid?amount/perUsd:0;
   form.querySelector("[data-salary-coins]").textContent=v.toLocaleString("en-US")+" كوينز";
   form.querySelector("[data-salary-target]").textContent=valid?salaryCredit(usd):"—";
   form.querySelector("[data-salary-usd]").textContent=valid?fmt(usd):"—";
   form.querySelector("[data-salary-rate]").textContent=opt?"تسعير الرواتب معتمد لدى الإدارة.":"";
   const btn=form.querySelector('button[type="submit"]');
   if(btn)btn.disabled=!canSubmitSalary||!valid||!Number.isFinite(usd)||usd<=0;
   return;
 }
 const selected=visibleMethods.find(x=>x.id===form.elements.service?.value);
 const currency=selected?.currency||"USD";
 const feePercent=num(selected?.fee_percent,c.transfer_fee_percent,0,30);
 const rate=visibleRates.find(x=>x.currency===currency&&x.is_enabled&&Number(x.per_usd)>0);
 const perUsd=selected?.per_usd!=null?Number(selected.per_usd):(currency==="USD"?1:Number(rate?.per_usd)||0);
 const usd=k==="transfer"&&perUsd?v/perUsd:0;
 const fee=k==="salary"?0:usd*feePercent/100;
 const total=k==="salary"?v*num(c.salary_usd_per_100k,10,0)/100000:usd+fee;
 form.querySelector("[data-gross]").textContent=fmt(total);
 form.querySelector("[data-fee]").textContent=fmt(fee);
 if(k==="transfer")form.querySelector("[data-fee-rate]").textContent=feePercent+"٪";
 form.querySelector("[data-net]").textContent=k==="salary"?fmt(total):targetMoney(v,currency);
 if(k==="transfer"){
   const info=document.querySelector('[data-method-info]');
   if(info)info.innerHTML=(selected?.image_url?'<img class="f90-service-art" src="'+esc(selected.image_url)+'" alt="'+esc(selected.name_ar)+'">':'')+'<p>'+esc(selected?.details_ar||'')+'</p>';
   form.querySelector("[data-target-currency]").textContent="عملة الخدمة: "+currency;
   form.querySelector("[data-target-net]").textContent=perUsd?"سيصل للمستفيد: "+targetMoney(v,currency)+" · سعر التحويل: "+perUsd.toLocaleString("en-US")+" "+currency+" لكل دولار":"سعر تحويل العملة غير متاح. اختر عملة مفعّلة من الإدارة.";
   form.querySelector('button[type="submit"]').disabled=!canSubmitTransfer||!Number.isFinite(perUsd)||perUsd<=0||!v;
 }
}
document.addEventListener("click",ev=>{
 const opt=ev.target.closest?.("[data-f90-transfer-method]");
 if(!opt)return;
 const form=opt.closest("form"),selector=form?.elements?.service;
 if(!selector)return;
 selector.value=opt.dataset.f90TransferMethod;
 form.querySelectorAll("[data-f90-transfer-method]").forEach(btn=>
    btn.setAttribute("aria-pressed",String(btn===opt)));
 updateEstimate(form);
});
document.addEventListener("input",ev=>{if(ev.target.closest?.("#f90SpecialForm")){const f=ev.target.form;if(f?.dataset.reviewReady){delete f.dataset.reviewReady;const box=f.querySelector("[data-review]");if(box)box.hidden=true;const btn=f.querySelector('button[type="submit"]');if(btn)btn.textContent="إرسال الطلب للمراجعة";}updateEstimate(f);}});
document.addEventListener("change",ev=>{if(ev.target.closest?.("#f90SpecialForm")){const f=ev.target.form;if(f?.dataset.reviewReady){delete f.dataset.reviewReady;const box=f.querySelector("[data-review]");if(box)box.hidden=true;const btn=f.querySelector('button[type="submit"]');if(btn)btn.textContent="إرسال الطلب للمراجعة";}updateEstimate(f);}});
document.addEventListener("submit",async ev=>{
 if(ev.target?.id!=="f90SpecialForm")return;
 ev.preventDefault();
 const form=ev.target,button=form.querySelector("button[type=submit]"),out=form.querySelector("[data-status]");
 if(button.disabled||form.dataset.busy)return;
 const client=window.F90API?.client;
 if(!client?.rpc){out.hidden=false;out.textContent="الاتصال الآمن غير متاح حاليًا";return;}
 const d=new FormData(form),kind=String(d.get("kind")||"");
 const service=kind==="transfer"||kind==="design"||kind==="account"?String(d.get("service")||"حساب Xena Live"):kind==="salary"?"Xena Live":kind==="website"?"إنشاء موقع كامل":"حساب Xena Live";
 const value=Number(d.get("amount")||0);
 if(!form.dataset.requestKey)form.dataset.requestKey=crypto.randomUUID();
 const key=form.dataset.requestKey;
 if(kind==="transfer"){
   const method=visibleMethods.find(x=>x.id===service),currency=method?.currency||"USD";
   const perUsd=method?.per_usd!=null?Number(method.per_usd):(currency==="USD"?1:Number(visibleRates.find(x=>x.currency===currency&&x.is_enabled)?.per_usd)||0);
   if(!Number.isFinite(perUsd)||perUsd<=0){out.hidden=false;out.textContent="سعر التحويل غير متاح لهذه العملة";return;}
   const total=value/perUsd*(1+num(method?.fee_percent,visibleConfig.transfer_fee_percent,0,30)/100);
   const ok=window.confirm("سيُخصم من محفظتك تقريبًا "+fmt(total)+" مقابل وصول "+targetMoney(value,currency)+". يؤكد الخادم السعر لحظة الإرسال. تأكيد تقديم الطلب؟");
   if(!ok)return;
 }
 if(kind==="salary"&&!form.dataset.reviewReady){
   const option=visibleSalaryOptions.find(x=>x.currency===customerSalaryCurrency);
   if(!option||!Number.isSafeInteger(value)||value<visibleConfig.salary_minimum_coins)return;
   const usd=(value/100000*Number(option.per_100k))/Number(option.units_per_usd);
   const review=form.querySelector("[data-review]");
   if(review){
     review.hidden=false;
     review.innerHTML='<strong>مراجعة طلب السحب</strong><span>'+esc(value.toLocaleString("en-US"))+' كوينز</span>'+
       '<strong>'+esc(salaryCredit(usd))+'</strong><small>يضاف بعد موافقة الإدارة فقط</small>';
   }
   form.dataset.reviewReady="1";
   button.textContent="تأكيد وإرسال الطلب";
   review?.scrollIntoView?.({block:"nearest",behavior:"smooth"});
   return;
 }
 button.disabled=true;form.dataset.busy="1";out.hidden=false;out.textContent="جارٍ تسجيل الطلب…";
 try{
   let result;
   if(kind==="salary"){
     const currency=customerSalaryCurrency;
     const option=visibleSalaryOptions.find(x=>x.currency===currency);
     if(!option || !Number.isSafeInteger(value) || value<visibleConfig.salary_minimum_coins)throw Error("راجع كمية الكوينز وعملة الإيداع.");
     const quote=value/100000*Number(option.per_100k);
     const proof=d.get("receipt");
     if(!proof||!["image/jpeg","image/png","image/webp"].includes(proof.type)||proof.size===0||proof.size>5242880)
       throw Error("ارفع صورة تأكيد سحب الراتب بصيغة مدعومة، بحد أقصى 5 ميجابايت.");
     const signature=[proof.name,proof.size,proof.lastModified].join(":");
     const fieldsKey=JSON.stringify({account:String(d.get("account")||""),coins:value,currency,
       note:String(d.get("note")||"").trim()});
     if(form.dataset.proofKey===key&&(form.dataset.proofSignature!==signature||form.dataset.proofData!==fieldsKey))
       throw Error("تغيّرت تفاصيل السحب بعد رفع الإيصال. أعد فتح النموذج أو تحقق من الطلب السابق لتفادي التكرار.");
     let path=form.dataset.proofKey===key?form.dataset.proofPath:"";
     if(!path){
       out.textContent="جارٍ رفع إيصال سحب الراتب بصورة خاصة…";
       const uploaded=await window.F90API.upload(proof,"f90-receipts");
       path=uploaded.path;
       form.dataset.proofPath=path;form.dataset.proofKey=key;
       form.dataset.proofSignature=signature;form.dataset.proofData=fieldsKey;
     }
     out.textContent="جارٍ إرسال طلب الراتب للمراجعة…";
     result=await client.rpc("f90_submit_salary_v3",{
       p_account:String(d.get("account")||""),p_coins:value,p_currency:currency,p_key:key,
       p_note:String(d.get("note")||"").trim(),p_receipt:path
     });
   }else if(kind==="transfer"){
     result=await client.rpc("f90_submit_transfer",{p_method:service,p_recipient:String(d.get("details")||""),p_net:value,p_key:key});
   }else{
     result=await client.rpc("f90_special_submit",{
       p_kind:kind,p_service:service,p_account:String(d.get("account")||""),
       p_amount:value,p_contact:String(d.get("contact")||""),
       p_details:String(d.get("details")||""),p_key:"F90S"+key.replace(/-/g,"")
     });
   }
   if(result.error)throw result.error;
   const data=result.data||{};
   if(kind==="salary"){
     form.innerHTML='<div class="f90-finance-success" role="status" aria-live="polite">'+
       '<span class="f90-finance-success-icon" aria-hidden="true">✓</span>'+
       '<h2>تم إرسال طلب سحب الراتب</h2><p>الطلب بانتظار مراجعة الإدارة.</p>'+
       '<div class="f90-finance-success-amount"><small>سينضاف لرصيدك عند الموافقة</small>'+
       '<strong>'+esc(salaryCredit(Number(data.usd_amount||0)))+'</strong></div>'+
       '<small>رقم المتابعة: '+esc(String(data.id||"").slice(0,8))+'</small>'+
       '<a class="button full" href="#/deposits">سجل الإيداعات</a>'+
       '<a class="f90-finance-success-back" href="#/deposit">طرق الإيداع</a></div>';
   }else{
     out.textContent=kind==="transfer"?
       "تم تسجيل التحويل، رقم المتابعة "+String(data.id||"").slice(0,8):
       "تم تسجيل الطلب، رقم المتابعة "+String(data.id||"").slice(0,8);
     form.reset();updateEstimate(form);
   }
   form.dataset.submitted="1";delete form.dataset.requestKey;
   delete form.dataset.proofPath;delete form.dataset.proofKey;
   delete form.dataset.proofSignature;delete form.dataset.proofData;
 }catch(err){out.textContent=String(err?.message||"تعذر تسجيل الطلب");button.disabled=false;}
 finally{delete form.dataset.busy;}
});
window.F90Special={home,render,category,defaults,serviceCatalog};
})();
