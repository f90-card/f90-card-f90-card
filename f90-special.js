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
const links=[
 ["transfer","تحويل الأموال","التحويل بين المحافظ والحسابات"],
 ["account","بيع الحسابات","حسابات Xena Live"],
 ["design","احصل على تصميم","بنرات وصور متحركة واحتفالات"],
 ["website","موقع كامل ملك لك","موقع شامل الخدمات بسعر واضح"]
];
let visibleConfig=defaults;
let visibleRates=[];
let visibleMethods=[];
let canSubmitTransfer=false;
const targetMoney=(amount,code)=>Number(amount||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+code;
function home(settings){
 const c=conf(settings);
 const ads=[["digital","الخدمات الرقمية"],["transfer","تحويل الأموال"],["design","تصاميم احترافية"],["website","احصل على موقعك"],["salary","سحب رواتب Xena"]];
 return '<section class="f90-special-home" aria-label="إعلانات الخدمات">'+
 '<div class="f90-special-ad-strip" aria-label="إعلانات خاصة بالمتجر">'+ads.filter(([id])=>c["show_"+id]!==false).map(([id,title])=>
 '<a href="'+(id==="digital"?"#/category/applications":id==="website"?"#/product/f90-full-website-500":"#/special/"+id)+'" class="f90-special-ad"><img src="'+images[id]+'" alt="'+esc(title)+'" loading="lazy"></a>').join("")+
 '</div></section>';
}
function category(slug,settings){
 const root=document.getElementById("mainContent"),c=conf(settings);
 const group={
  "money-transfer":{title:"تحويل الأموال",banner:"transfer",kind:"transfer",items:Array.isArray(settings?.config?.money_transfer?.methods)?settings.config.money_transfer.methods.filter(x=>x.enabled!==false).map(x=>[x.id,x.name_ar]):[]},
  "account-sales":{title:"بيع حسابات Xena Live",banner:"account",kind:"account",items:[["","شراء حساب Xena Live"]]},
  "design-services":{title:"احصل على تصميم احترافي",banner:"design",kind:"design",items:defaults.design_services.map((x,i)=>[String(i+1),x])},
  "complete-website":{title:"موقع كامل ملك لك",banner:"website",kind:"website",items:[["","إنشاء موقع شامل الخدمات"]]}
 }[slug];
 if(!group)return false;
 const img=String(c[group.banner+"_banner_url"]||images[group.banner]);
 const links=group.items.map(([id,title],i)=>{
  const href="#/special/"+group.kind+(id?"/"+encodeURIComponent(id):"");
  return '<a class="f90-special-section-option" href="'+href+'" aria-label="'+esc(title)+'">'+
  '<span class="f90-special-option-number">'+String(i+1).padStart(2,"0")+'</span><strong>'+esc(title)+'</strong><span aria-hidden="true">‹</span></a>';
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
 '<div><span>العمولة '+feePercent+'٪</span><strong data-fee>'+fmt(fee)+'</strong></div>'+
 '<div class="f90-special-net"><span>الصافي بعد العمولة</span><strong data-net>'+fmt(net)+'</strong></div></div>';
}
const input=(name,label,type="text",attr="")=>'<label class="field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" '+attr+'></label>';
function render(kind,settings,user,selected="",rates=[]){
 visibleRates=Array.isArray(rates)?rates:[];
 const config=settings?.config||{},sal=config.salary_withdrawal||{},tr=config.money_transfer||{};
 const c=visibleConfig={...conf(settings),
  salary_usd_per_100k:Number(sal.coins_per_usd)>0?100000/Number(sal.coins_per_usd):10,
  salary_fee_percent:0,transfer_fee_percent:num(tr.fee_percent,2,0,30),
  transfer_eta_min_minutes:num(tr.eta_min_minutes,5,5,2880),
  transfer_eta_max_minutes:num(tr.eta_max_hours,48,1,48)*60
 };
 const d=kind||"transfer";
 if(d==="website"){location.hash="#/product/f90-full-website-500";return;}
 const isVerified=!!user?.profile?.is_verified,isSigned=!!user;
 canSubmitTransfer=isVerified&&isSigned;
 const salary=d==="salary",transfer=d==="transfer",account=d==="account",design=d==="design",website=d==="website";
 const methods=visibleMethods=Array.isArray(tr.methods)?tr.methods.filter(x=>x?.enabled!==false):[];
 const title=salary?"سحب رواتب Xena Live":transfer?"تحويل الأموال":account?"شراء حسابات Xena Live":design?"احصل على تصميم":"احصل على موقع كامل ملك لك";
 const banner=String(c[d+"_banner_url"]||images[d]||images.website);
 const desc=(salary?sal.details_ar:undefined)||c[d+"_description"]||defaults[d+"_description"]||"";
 let fields="";
 if(salary){
   const min=Math.max(100000,Number(sal.minimum_coins)||100000);
   fields=input("account","ID حساب Xena Live","text",'required minlength="2" maxlength="120" autocomplete="off"')+
   input("amount","كمية الكوينز للسحب","number",'required min="'+min+'" step="1" inputmode="numeric" value="'+min+'"')+
   '<p class="f90-special-tiny">الحد الأدنى '+min.toLocaleString('en-US')+' كوينز • لا يوجد سقف ثابت معلن</p>'+
   moneyPanel(min*c.salary_usd_per_100k/100000,0,min*c.salary_usd_per_100k/100000,0,"الرصيد المستحق بعد الاعتماد");
 }else if(transfer){
   fields='<label class="field"><span>وسيلة التحويل</span><select name="service" required>'+
     methods.map(x=>'<option value="'+esc(x.id)+'" '+(selected===x.id?'selected':'')+'>'+esc(x.name_ar)+' · '+esc(x.currency||"USD")+'</option>').join("")+'</select></label>'+
   '<div class="f90-transfer-methods" role="group" aria-label="خيارات التحويل">'+
     methods.map((x,i)=>'<button type="button" data-f90-transfer-method="'+esc(x.id)+'" aria-pressed="'+(selected?selected===x.id:i===0)+'">'+esc(x.name_ar)+'</button>').join("")+'</div>'+
   input("amount","قيمة السحب بعملة الخدمة المختارة","number",'required min="1" max="100000000" step="0.01" inputmode="decimal" placeholder="0.00"')+
   '<p class="f90-special-tiny" data-target-currency>العملة: '+esc(methods.find(x=>x.id===selected)?.currency||methods[0]?.currency||"USD")+'</p>'+
   '<label class="field"><span>بيانات المستلم والتحويل</span><textarea name="details" required minlength="3" maxlength="2000" rows="4" placeholder="بيانات المستلم والوسيلة ورقم الحساب أو العنوان"></textarea></label>'+
   moneyPanel(0,0,0,c.transfer_fee_percent,"إجمالي الخصم من المحفظة USD")+
   '<p class="f90-special-tiny" data-target-net>المبلغ الذي سيصل للمستفيد: —</p>'+
   '<p class="f90-special-tiny">تضاف عمولة '+c.transfer_fee_percent+'٪ فوق المبلغ الصافي. المدة المتوقعة: من '+c.transfer_eta_min_minutes+' إلى '+c.transfer_eta_max_minutes+' دقيقة بعد المراجعة.</p>'+
   '<p class="f90-special-tiny">رصيد محفظتك الحالي: '+(isSigned?fmt(Number(user?.wallet?.balance_usd)||0):"سجّل الدخول")+'</p>';
 }else{
   fields=(design?'<label class="field"><span>نوع التصميم</span><select name="service">'+defaults.design_services.map((x,i)=>'<option '+(selected===String(i+1)?'selected':'')+'>'+x+'</option>').join("")+'</select></label>':'')+
     input("contact","رقم واتساب للتواصل","tel",'required minlength="6" maxlength="90" inputmode="tel" dir="ltr" placeholder="+970..."')+
     (design?'<label class="field"><span>تفاصيل التصميم</span><textarea name="details" rows="3" maxlength="3000" placeholder="الفكرة، المناسبة، الألوان والمقاسات المطلوبة"></textarea></label>':"");
   const price=website?num(c.website_price_usd,500,0):account?num(c.account_price_usd,0,0):0;
   fields+='<div class="f90-special-quote"><span>'+(price?"سعر الخدمة المعلن":"السعر بعد مراجعة التفاصيل")+'</span><strong>'+(price?fmt(price):"يُحدد عند التواصل")+'</strong></div>';
 }
 const notice=(!isSigned?'<p class="f90-special-alert">سجّل الدخول قبل إرسال طلبك. <a href="#/auth">تسجيل الدخول</a></p>':
 ((salary||transfer)&&!isVerified?'<p class="f90-special-alert">توثيق الحساب مطلوب قبل العمليات المالية. <a href="#/verification">توثيق الحساب</a></p>':''));
 const enabled=c["show_"+d]!==false && (!salary||sal.enabled===true) && (!transfer||tr.enabled===true&&methods.length>0);
 const footnote=transfer?"يُخصم صافي المبلغ والعمولة من المحفظة فور تقديم الطلب، ويُسترد المبلغ عند رفضه بعد مراجعة الإدارة.":
   salary?"لا يُضاف الرصيد إلا بعد مراجعة سحب الراتب واعتماده.":"هذا طلب خدمة وتواصل، وليس خصمًا من محفظتك.";

 document.getElementById("mainContent").innerHTML=
 '<section class="f90-special-page" data-kind="'+esc(d)+'"><a class="f90-special-back" href="#/">‹ العودة إلى الرئيسية</a>'+
 '<div class="f90-special-banner"><img src="'+esc(banner)+'" alt="'+esc(title)+'"></div>'+
 '<div class="f90-special-panel"><h1>'+title+'</h1><p>'+esc(desc)+'</p>'+
 notice+'<form id="f90SpecialForm" data-kind="'+esc(d)+'"><input type="hidden" name="kind" value="'+esc(d)+'">'+
 fields+'<p class="f90-special-footnote">'+esc(footnote)+'</p><p class="f90-special-alert" data-status hidden></p>'+
 '<button class="button full" type="submit" '+(!enabled||!isSigned||((salary||transfer)&&!isVerified)?"disabled":"")+'>'+
 (transfer?"تأكيد طلب التحويل":"إرسال الطلب للمراجعة")+'</button></form></div></section>';
 updateEstimate(document.getElementById("f90SpecialForm"));
}
function updateEstimate(form){
 if(!form)return;
 const k=form.dataset.kind,c=visibleConfig;
 if(!["salary","transfer"].includes(k))return;
 const v=Math.max(0,Number(form.elements.amount?.value)||0);
 const selected=visibleMethods.find(x=>x.id===form.elements.service?.value);
 const currency=selected?.currency||"USD";
 const rate=visibleRates.find(x=>x.currency===currency&&x.is_enabled&&Number(x.per_usd)>0);
 const perUsd=currency==="USD"?1:Number(rate?.per_usd)||0;
 const usd=k==="transfer"&&perUsd?v/perUsd:0;
 const fee=k==="salary"?0:usd*num(c.transfer_fee_percent,2,0,30)/100;
 const total=k==="salary"?v*num(c.salary_usd_per_100k,10,0)/100000:usd+fee;
 form.querySelector("[data-gross]").textContent=fmt(total);
 form.querySelector("[data-fee]").textContent=fmt(fee);
 form.querySelector("[data-net]").textContent=k==="salary"?fmt(total):targetMoney(v,currency);
 if(k==="transfer"){
   form.querySelector("[data-target-currency]").textContent="عملة الخدمة: "+currency;
   form.querySelector("[data-target-net]").textContent=perUsd?"سيصل للمستفيد: "+targetMoney(v,currency)+" · سعر التحويل: "+perUsd.toLocaleString("en-US")+" "+currency+" لكل دولار":"سعر تحويل العملة غير متاح. اختر عملة مفعّلة من الإدارة.";
   form.querySelector('button[type="submit"]').disabled=!canSubmitTransfer||!perUsd||!v;
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
document.addEventListener("input",ev=>{if(ev.target.closest?.("#f90SpecialForm"))updateEstimate(ev.target.form);});
document.addEventListener("change",ev=>{if(ev.target.closest?.("#f90SpecialForm"))updateEstimate(ev.target.form);});
document.addEventListener("submit",async ev=>{
 if(ev.target?.id!=="f90SpecialForm")return;
 ev.preventDefault();
 const form=ev.target,button=form.querySelector("button[type=submit]"),out=form.querySelector("[data-status]");
 if(button.disabled||form.dataset.busy)return;
 const client=window.F90API?.client;
 if(!client?.rpc){out.hidden=false;out.textContent="الاتصال الآمن غير متاح حاليًا";return;}
 const d=new FormData(form),kind=String(d.get("kind")||"");
 const service=kind==="transfer"||kind==="design"?String(d.get("service")||""):kind==="salary"?"Xena Live":kind==="website"?"إنشاء موقع كامل":"حساب Xena Live";
 const value=Number(d.get("amount")||0);
 if(!form.dataset.requestKey)form.dataset.requestKey=crypto.randomUUID();
 const key=form.dataset.requestKey;
 if(kind==="transfer"){
   const method=visibleMethods.find(x=>x.id===service),currency=method?.currency||"USD";
   const perUsd=currency==="USD"?1:Number(visibleRates.find(x=>x.currency===currency&&x.is_enabled)?.per_usd)||0;
   if(!perUsd){out.hidden=false;out.textContent="سعر التحويل غير متاح لهذه العملة";return;}
   const total=value/perUsd*(1+num(visibleConfig.transfer_fee_percent,2,0,30)/100);
   const ok=window.confirm("سيُخصم من محفظتك تقريبًا "+fmt(total)+" مقابل وصول "+targetMoney(value,currency)+". يؤكد الخادم السعر لحظة الإرسال. تأكيد تقديم الطلب؟");
   if(!ok)return;
 }
 button.disabled=true;form.dataset.busy="1";out.hidden=false;out.textContent="جارٍ إرسال الطلب للتحقق على الخادم…";
 try{
   let result;
   if(kind==="salary"){
     result=await client.rpc("f90_submit_salary",{p_account:String(d.get("account")||""),p_coins:value,p_key:key});
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
   out.textContent=kind==="transfer"?
     "تم تسجيل التحويل وخصم الإجمالي من المحفظة، ورقم المتابعة "+String(data.id||"").slice(0,8)+".":
     kind==="salary"?"تم إرسال طلب سحب الراتب للمراجعة. سيُضاف الرصيد عند اعتماد الإدارة. رقم "+String(data.id||"").slice(0,8):
     "تم إرسال الطلب للمراجعة برقم "+String(data.id||"").slice(0,8)+". لم يتم خصم رصيد.";
   form.dataset.submitted="1";delete form.dataset.requestKey;
   form.reset();updateEstimate(form);
 }catch(err){out.textContent=String(err?.message||"تعذر تسجيل الطلب");button.disabled=false;}
 finally{delete form.dataset.busy;}
});
window.F90Special={home,render,category,defaults};
})();
