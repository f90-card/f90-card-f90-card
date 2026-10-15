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
 transfer:"./assets/f90-new/banner-transfer.webp",
 account:"./assets/f90-new/banner-digital.webp",
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
function home(settings){
 const c=conf(settings);
 const cards=links.filter(([k])=>c["show_"+k]!==false).map(([k,title,desc])=>'<a href="#/special/'+k+'" class="f90-special-tile"><img loading="lazy" src="'+images[k]+'" alt="'+esc(title)+'"><span><strong>'+title+'</strong><small>'+desc+'</small></span></a>').join("");
 const ads=[["transfer","تحويل الأموال"],["design","تصاميم احترافية"],["website","احصل على موقعك"],["account","حسابات Xena"],["salary","سحب رواتب Xena"]];
 return '<section class="f90-special-home"><h2>خدمات F90 CARD الإضافية</h2><div class="f90-special-tiles">'+cards+'</div>'+
 '<div class="f90-special-ad-strip" aria-label="إعلانات خاصة بالمتجر">'+ads.map(([id,title])=>'<a href="#/'+(id==="salary"?"special/salary":"special/"+id)+'" class="f90-special-ad"><img src="'+images[id]+'" alt="'+esc(title)+'" loading="lazy"></a>').join("")+'</div></section>';
}
function moneyPanel(gross,fee,net,feePercent,label){
 return '<div class="f90-special-estimate" role="status" aria-live="polite">'+
 '<div><span>'+(label||"المبلغ قبل العمولة")+'</span><strong data-gross>'+fmt(gross)+'</strong></div>'+
 '<div><span>العمولة '+feePercent+'٪</span><strong data-fee>'+fmt(fee)+'</strong></div>'+
 '<div class="f90-special-net"><span>الصافي بعد العمولة</span><strong data-net>'+fmt(net)+'</strong></div></div>';
}
const input=(name,label,type="text",attr="")=>'<label class="field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" '+attr+'></label>';
function render(kind,settings,user){
 const c=visibleConfig=conf(settings);
 const d=kind||"transfer";
 const isVerified=!!user?.profile?.is_verified;
 const isSigned=!!user;
 const salary=d==="salary",transfer=d==="transfer",account=d==="account",design=d==="design",website=d==="website";
 const methods=Array.isArray(c.transfer_methods)&&c.transfer_methods.length?c.transfer_methods:defaults.transfer_methods;
 const title=salary?"سحب رواتب Xena Live":transfer?"تحويل الأموال":account?"شراء حسابات Xena Live":design?"احصل على تصميم":"احصل على موقع كامل ملك لك";
 const banner=String(c[d+"_banner_url"]||images[d]||images.website);
 const desc=c[d+"_description"]||defaults[d+"_description"]||"";
 let fields="";
 if(salary){
   fields=input("account","ID حساب Xena Live","text",'required minlength="2" maxlength="200" autocomplete="off"')+
   input("amount","كمية الكوينز للسحب","number",'required min="100000" step="1" inputmode="numeric" value="100000"')+
   '<p class="f90-special-tiny">الحد الأدنى 100,000 كوينز • لا يوجد حد أقصى محدد</p>'+
   moneyPanel(10,0,10,num(c.salary_fee_percent,0,0,50),"قيمة الكوينز بالدولار");
 }else if(transfer){
   fields='<label class="field"><span>نوع التحويل</span><select name="service" required>'+methods.map(x=>'<option>'+esc(x)+'</option>').join("")+'</select></label>'+
   input("amount","القيمة بالدولار الأمريكي USD","number",'required min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"')+
   '<label class="field"><span>معلومات التحويل</span><textarea name="details" required minlength="8" maxlength="3000" rows="4" placeholder="الجهة المستلمة، وسيلة التواصل وأي بيانات لازمة للتحويل"></textarea></label>'+
   moneyPanel(0,0,0,num(c.transfer_fee_percent,2,0,50),"القيمة بالدولار")+
   '<p class="f90-special-tiny">مدة التنفيذ بعد اعتماد الإدارة: من '+num(c.transfer_eta_min_minutes,5,5,2880)+' دقيقة إلى '+num(c.transfer_eta_max_minutes,2880,5,2880)+' دقيقة. يتم تأكيد سعر الصرف قبل التنفيذ.</p>';
 }else{
   fields=(design?'<label class="field"><span>نوع التصميم</span><select name="service">'+defaults.design_services.map(x=>'<option>'+x+'</option>').join("")+'</select></label>':'')+
     input("contact","رقم واتساب للتواصل","tel",'required minlength="6" maxlength="90" inputmode="tel" dir="ltr" placeholder="+970... "')+
     (design?'<label class="field"><span>تفاصيل التصميم</span><textarea name="details" rows="3" maxlength="3000" placeholder="الفكرة، المناسبة، الألوان والمقاسات المطلوبة"></textarea></label>':"");
   const price=website?num(c.website_price_usd,500,0):account?num(c.account_price_usd,0,0):0;
   fields+='<div class="f90-special-quote"><span>'+(price?"السعر المعلن":"السعر بعد مراجعة التفاصيل")+'</span><strong>'+(price?fmt(price):"يُحدد عند التواصل")+'</strong></div>';
 }
 const notice=(!isSigned?'<p class="f90-special-alert">يجب تسجيل الدخول قبل إرسال الطلب. <a href="#/auth">تسجيل الدخول</a></p>':
 ((salary||transfer)&&!isVerified?'<p class="f90-special-alert">توثيق الحساب مطلوب قبل تقديم طلب مالي. <a href="#/verification">وثّق حسابك</a></p>':''));
 const enabled=c["show_"+d]!==false;
 document.getElementById("mainContent").innerHTML=
 '<section class="f90-special-page" data-kind="'+esc(d)+'"><a class="f90-special-back" href="#/">‹ العودة إلى الرئيسية</a>'+
 '<div class="f90-special-banner"><img src="'+esc(banner)+'" alt="'+esc(title)+'"></div>'+
 '<div class="f90-special-panel"><h1>'+title+'</h1><p>'+esc(desc)+'</p>'+
 notice+'<form id="f90SpecialForm" data-kind="'+esc(d)+'"><input type="hidden" name="kind" value="'+esc(d)+'">'+
 fields+'<p class="f90-special-alert" data-status hidden></p>'+
 '<button class="button full" type="submit" '+(!enabled||!isSigned||((salary||transfer)&&!isVerified)?"disabled":"")+'>إرسال الطلب للمراجعة</button></form>'+
 '<p class="f90-special-footnote">تقديم الطلب لا يخصم أو يضيف رصيدًا. تتم المعالجة والتحقق من التفاصيل بواسطة الإدارة قبل التنفيذ.</p></div></section>';
 updateEstimate(document.getElementById("f90SpecialForm"));
}
function updateEstimate(form){
 if(!form)return;
 const k=form.dataset.kind,c=visibleConfig;
 if(!["salary","transfer"].includes(k))return;
 const v=Math.max(0,Number(form.elements.amount?.value)||0);
 const gross=k==="salary"?v*num(c.salary_usd_per_100k,10,0)/100000:v;
 const pct=k==="salary"?num(c.salary_fee_percent,0,0,50):num(c.transfer_fee_percent,2,0,50);
 const fee=Math.round(gross*pct)/100;
 const net=Math.max(0,gross-fee);
 form.querySelector("[data-gross]").textContent=fmt(gross);
 form.querySelector("[data-fee]").textContent=fmt(fee);
 form.querySelector("[data-net]").textContent=fmt(net);
}
document.addEventListener("input",ev=>{if(ev.target.closest?.("#f90SpecialForm"))updateEstimate(ev.target.form);});
document.addEventListener("submit",async ev=>{
 if(ev.target?.id!=="f90SpecialForm")return;
 ev.preventDefault();
 const form=ev.target,button=form.querySelector("button[type=submit]"),out=form.querySelector("[data-status]");
 if(button.disabled||form.dataset.busy)return;
 const client=window.F90API?.client;
 if(!client?.rpc){out.hidden=false;out.textContent="الاتصال الآمن غير متاح حاليًا";return;}
 const d=new FormData(form),kind=String(d.get("kind")||"");
 const service=kind==="transfer"||kind==="design"?String(d.get("service")||""):kind==="salary"?"Xena Live":kind==="website"?"إنشاء موقع كامل":"حساب Xena Live";
 let key="F90S"+(crypto.randomUUID?crypto.randomUUID().replace(/-/g,""):String(Date.now())+Math.random().toString(36).slice(2));
 button.disabled=true;form.dataset.busy="1";out.hidden=false;out.textContent="جارٍ تسجيل الطلب دون أي خصم رصيد…";
 try{
   const {data,error}=await client.rpc("f90_special_submit",{
     p_kind:kind,p_service:service,p_account:String(d.get("account")||""),
     p_amount: Number(d.get("amount")||0),p_contact:String(d.get("contact")||""),
     p_details:String(d.get("details")||""),p_key:key
   });
   if(error)throw error;
   out.textContent="تم إرسال الطلب للمراجعة برقم "+String(data?.id||"").slice(0,8)+". لم يتم تغيير الرصيد.";
   form.reset();form.dataset.submitted="1";updateEstimate(form);
 }catch(err){out.textContent=String(err?.message||"تعذر تسجيل الطلب");button.disabled=false;}
 finally{delete form.dataset.busy;}
});
window.F90Special={home,render,defaults};
})();