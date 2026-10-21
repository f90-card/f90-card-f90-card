(function(){
 "use strict";
 const h=s=>window.F90Core?.escapeHTML?.(String(s??""))||String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(n)||0);
 const date=s=>s?new Date(s).toLocaleString("ar-PS"):"لا يوجد نشاط مرصود";
 const api=()=>window.F90API?.client;
 const tabs=[["overview","المراقبة"],["security","أمان العملاء"],["lab","مختبر API"],["emergency","الطوارئ"],["profit","الأرباح"],["backup","النسخ الاحتياطي"]];
 let tab="overview",mount=null,nonce=0;
 async function call(action,values={}){
  const {data,error}=await api().functions.invoke("f90-ops-control",{body:{action,...values}});
  if(error||!data||data.error)throw Error(data?.error?.message||"تعذّر الاتصال الآمن بمركز التحكم");
  return data.data;
 }
 const cell=(label,value)=>'<div class="f90-ops-stat"><span>'+h(label)+'</span><strong>'+h(value)+'</strong></div>';
 const line=(title,text,meta)=>'<article class="f90-ops-line"><strong>'+h(title)+'</strong><span>'+h(text)+'</span>'+(meta?'<small>'+h(meta)+'</small>':"")+'</article>';
 const note=s=>'<p class="f90-ops-note">'+h(s)+'</p>';
 function shell(){
  const el=document.getElementById(mount);if(!el)return;
  el.innerHTML='<nav class="f90-ops-tabs" role="tablist" aria-label="أدوات مركز تحكم F90">'+
   tabs.map(([v,label])=>'<button type="button" role="tab" aria-selected="'+(tab===v)+'" data-ops-tab="'+h(v)+'">'+h(label)+'</button>').join("")+
   '</nav><div class="f90-ops-main" id="f90OpsBody" role="tabpanel"><p class="loading">جارٍ التحميل…</p></div>';
 }
 async function navigate(newTab){
  tab=newTab;nonce++;const current=nonce;
  shell();
  const el=document.getElementById("f90OpsBody");if(!el)return;
  try{
   let out="";
   if(tab==="overview"){
    const x=await call("overview");
    out='<div class="f90-ops-stats">'+cell("الطلبات في البيانات المقروءة",x.orders.count_sampled)+cell("طلبات قيد التنفيذ",x.orders.pending)+
      cell("إيداعات معلقة",x.deposits.pending)+cell("مفاتيح تجار مفعّلة",x.api.active)+
      cell("عناصر إشعارات قيد الانتظار (عينة)",x.notification_backlog.sampled)+cell("إشعارات غير مسودات (عينة)",x.notification_backlog.non_draft_in_sample)+'</div>'+
      '<h3>الموردون</h3><div class="f90-ops-lines">'+(x.providers||[]).map(p=>line(p.name,p.is_enabled?"مفعّل":"متوقف","الهامش العام: "+p.margin_percent+"%")).join("")+'</div>'+
      '<h3>آخر نشاط مرصود</h3>'+line("الطلبات",date(x.orders.last),"من قاعدة بيانات المتجر")+
      line("الإيداعات",date(x.deposits.last))+
      line("الأجهزة",date(x.session_latest))+note(x.note);
   }else if(tab==="lab"){
    const x=await call("api_lab");
    out='<div class="f90-ops-stats">'+cell("واجهة قراءة الكتالوج",x.catalog.ok?"ناجحة":"تحتاج مراجعة")+
      cell("زمن الفحص",x.latency_ms+" ms")+cell("عدد الخدمات في استجابة الكتالوج",x.catalog.products??"غير متاح")+
      cell("مفاتيح التجار المفعّلة",x.active_keys)+cell("مفاتيح نشطة منتهية",x.expired_keys)+'</div>'+
      '<h3>حالة الموردين</h3><div class="f90-ops-lines">'+(x.providers||[]).map(v=>line(v.name,v.is_enabled?"مفعّل":"متوقف",v.adapter)).join("")+'</div>'+
      '<h3>آخر استخدامات API</h3><div class="f90-ops-lines">'+(x.recent_usage||[]).slice(0,12).map(v=>line(v.action||"طلب API","رمز الاستجابة "+(v.http_status||"—"),date(v.created_at))).join("")+'</div>'+note(x.note);
   }else if(tab==="profit"){
    out='<div class="f90-ops-period"><label>الفترة <select id="f90OpsPeriod">'+[[7,"7 أيام"],[30,"30 يومًا"],[90,"90 يومًا"],[365,"سنة"]].map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join("")+'</select></label><button type="button" class="button secondary small" data-ops-action="profit.reload">تحديث التقرير</button></div><div id="f90OpsProfitResult">جارٍ حساب التقرير…</div>';
   }else if(tab==="emergency"){
    const x=await call("overview");
    const list=[["checkout_enabled","الشراء","إيقاف طلبات الشراء الجديدة"],["deposits_enabled","الإيداعات","إيقاف إنشاء طلبات الإيداع الجديدة"],["merchant_enabled","API التجار","إيقاف مفاتيح التجار مؤقتًا"]];
    out='<div class="notice">تُنفّذ هذه المفاتيح من قاعدة البيانات. لا تتأثر الطلبات القديمة أو أرصدة العملاء، لكن طلبات الشراء والإيداع الجديدة ستُرفض أثناء الإيقاف. جميع التغييرات مسجّلة بالسبب.</div>'+
      '<div class="f90-ops-lines">'+list.map(([key,title,desc])=>'<article class="f90-ops-line"><strong>'+h(title)+'</strong><span>'+h(desc)+'</span><small>الحالة الحالية: '+(x.flags[key]?"يعمل":"متوقف")+'</small>'+
      '<button type="button" class="button secondary small" data-ops-action="toggle" data-key="'+h(key)+'" data-value="'+(!x.flags[key])+'">'+(x.flags[key]?"إيقاف مؤقت":"إعادة التشغيل")+'</button></article>').join("")+'</div>';
   }else if(tab==="security"){
    const result=await api().functions.invoke("f90-security-activity",{body:{action:"manager_list"}});
    if(result.error||result.data?.error)throw Error("تعذّر تحميل العملاء");
    const rows=result.data?.items||[];
    out='<label>بحث في الحسابات <input type="search" class="f90-ops-search" id="f90OpsUserSearch" placeholder="الاسم أو الرقم أو الجهاز أو IP"></label>'+
      '<p class="muted small">يعرض جميع العملاء المسجّلين، مع بيانات الشبكة التقريبية المتاحة. الترتيب من الأقدم إلى الأحدث.</p>'+
      '<div id="f90OpsUsers" class="f90-ops-users">'+rows.map(x=>
       '<article class="f90-ops-user" data-search="'+h([x.name,x.customer_id,x.ip,x.device,x.os,x.browser].join(" ").toLowerCase())+'">'+
       '<strong>'+h(x.name||"عميل")+' <span>#'+h(x.customer_id||"—")+'</span></strong>'+
       '<small>الحالة: '+h(x.status||"غير معروف")+' | البلد: '+h(x.country||"غير متاح")+' | IP: '+h(x.ip||"غير متاح")+'</small>'+
       '<small>الجهاز: '+h(x.device||"غير معروف")+' / '+h(x.os||"غير معروف")+' / '+h(x.browser||"غير معروف")+'</small>'+
       '<small>آخر دخول: '+h(date(x.last_seen_at))+'</small>'+
       '<form data-ops-user="'+h(x.user_id)+'"><label>الإجراء <select name="mode"><option value="hour">إيقاف ساعة</option><option value="day">إيقاف يوم</option><option value="week">إيقاف أسبوع</option><option value="month">إيقاف شهر</option><option value="permanent">حظر نهائي</option><option value="restore">إعادة التفعيل</option></select></label>'+
       '<label>سبب الإجراء <input required minlength="8" maxlength="240" name="reason" placeholder="اكتب السبب لحفظه في سجل الإدارة"></label>'+
       '<button class="button secondary small" type="submit">تطبيق</button>'+
       '<button class="button ghost small" data-ops-action="password.reset" type="button" data-user="'+h(x.user_id)+'">رابط استعادة كلمة المرور</button></form></article>'
      ).join("")+'</div>';
   }else if(tab==="backup"){
    const x=await call("backup.list");
    out='<div class="f90-ops-toolbar"><button class="button" type="button" data-ops-action="backup.create">إنشاء نسخة تشغيلية خاصة</button><button class="button secondary" type="button" data-ops-action="backup.reload">تحديث</button></div>'+
      note(x.type)+
      '<div class="f90-ops-lines">'+((x.items||[]).length?(x.items||[]).map(a=>
      '<article class="f90-ops-line"><strong>'+h(date(a.created_at))+'</strong><span>الحجم: '+h(Math.round(a.size_bytes/1024))+' KB · SHA-256: <code>'+h(a.sha256.slice(0,22))+'…</code></span>'+
      '<button class="button secondary small" type="button" data-ops-action="backup.verify" data-id="'+h(a.id)+'">التحقق من سلامة الملف</button></article>'
      ).join(""):'<p class="muted">لا توجد نسخة تشغيلية مسجّلة بعد.</p>')+'</div>'+
      '<p class="f90-ops-note">النسخة خاصة وتحتوي بيانات تشغيلية مختارة. لا تُعد نسخة كاملة لقاعدة البيانات، والاستعادة ليست تلقائية. النسخ الكاملة تُدار من نسخ Supabase الرسمية.</p>';
   }
   if(current!==nonce)return;
   el.innerHTML=out||'<p class="muted">لا توجد بيانات.</p>';
   if(tab==="profit")await loadProfit();
  }catch(err){if(current!==nonce)return;el.innerHTML='<div class="notice error">'+h(err.message||"حدث خطأ")+'</div>'}
 }
 async function loadProfit(){
  const target=document.getElementById("f90OpsProfitResult");if(!target)return;
  target.textContent="جارٍ حساب الأرباح…";
  try{
   const days=Number(document.getElementById("f90OpsPeriod")?.value||30),x=await call("profits",{days});
   if(!target.isConnected)return;
   target.innerHTML='<div class="f90-ops-stats">'+cell("إيراد الطلبات المكتملة",money(x.gross_usd))+
    cell("المبالغ المستردة",money(x.refunds_usd))+cell("تكلفة المورد المسجّلة",money(x.supplier_cost_usd))+
    cell("الربح التقديري",money(x.estimated_profit_usd))+
    cell("إيداعات معتمدة (ليست ربحًا)",money(x.approved_deposits_usd))+
    cell("طلبات من دون تكلفة مسجّلة",x.missing_cost_orders)+'</div>'+
    '<h3>أكثر الخدمات من حيث الإيراد</h3><div class="f90-ops-lines">'+(x.top_services||[]).map(z=>line(z.name,money(z.revenue),"طلبات: "+z.orders+" | تكلفة: "+money(z.cost))).join("")+'</div>'+note(x.note);
  }catch(err){target.textContent=err.message||"تعذّر عرض التقرير";}
 }
 async function act(button){
  const action=button.dataset.opsAction;
  if(action==="toggle"){
   const key=button.dataset.key,enabled=button.dataset.value==="true";
   const why=prompt("اكتب سبب الإجراء لحفظه في سجل الإدارة (8 أحرف على الأقل):","");
   if(why===null)return;
   if(why.trim().length<8){alert("السبب يجب أن يكون من 8 أحرف على الأقل.");return;}
   if(!confirm(enabled?"تأكيد إعادة تشغيل هذه الخدمة؟":"تأكيد إيقاف هذه الخدمة عن استقبال طلبات جديدة؟"))return;
   button.disabled=true;
   try{await call("toggle",{key,enabled,reason:why.trim()});alert("تم تغيير الحالة على الخادم بنجاح.");await navigate("emergency")}
   catch(e){alert(e.message||"تعذّر تغيير حالة الخدمة")}
   finally{button.disabled=false}
   return;
  }
  if(action==="profit.reload"){await loadProfit();return;}
  if(action==="backup.reload"){await navigate("backup");return;}
  if(action==="backup.create"){
   if(!confirm("إنشاء نسخة تشغيلية خاصة من البيانات الحالية؟ هذه ليست نسخة كاملة لقاعدة البيانات."))return;
   button.disabled=true;try{const x=await call("backup.create");alert("تم إنشاء النسخة: "+x.id);await navigate("backup");}
   catch(e){alert(e.message)}finally{button.disabled=false}
  }
  if(action==="backup.verify"){
   button.disabled=true;try{const x=await call("backup.verify",{id:button.dataset.id});alert(x.matches?"تطابق بصمة الملف: سليم":"عدم تطابق البصمة: يجب فحص النسخة فورًا");}
   catch(e){alert(e.message)}finally{button.disabled=false}
  }
  if(action==="password.reset"){
   if(!confirm("إرسال رابط آمن لإعادة تعيين كلمة المرور إلى البريد المسجّل لهذا العميل؟"))return;
   try{await window.F90API.call("staff.reset_password",{id:button.dataset.user,redirect_to:"https://www.f90card.online/"});alert("أُرسل طلب الاستعادة إلى البريد المسجّل.")}
   catch(e){alert(e.message||"تعذّر إرسال الاستعادة")}
  }
 }
 async function submit(form){
  const mode=form.elements.mode.value,reason=String(form.elements.reason.value||"").trim(),uid=form.dataset.opsUser;
  if(mode!=="restore"&&reason.length<8){alert("اكتب سببًا واضحًا من 8 أحرف على الأقل.");return;}
  if(!confirm("تأكيد الإجراء على الحساب المحدد؟ قد يتم منع العميل من استخدام المتجر."))return;
  const btn=form.querySelector('[type="submit"]');if(btn)btn.disabled=true;
  try{await call("suspend",{user_id:uid,mode,reason});alert("تم تحديث حالة الحساب.");await navigate("security")}
  catch(e){alert(e.message)}finally{if(btn)btn.disabled=false}
 }
 function render(containerId){
  mount=containerId;nonce=0;tab="overview";const root=document.getElementById(mount);if(!root)return;
  root.addEventListener("click",e=>{
   const tabButton=e.target.closest("[data-ops-tab]");
   if(tabButton){void navigate(tabButton.dataset.opsTab);return;}
   const button=e.target.closest("[data-ops-action]");
   if(button)void act(button);
  });
  root.addEventListener("submit",e=>{const form=e.target.closest("[data-ops-user]");if(form){e.preventDefault();void submit(form)}});
  root.addEventListener("input",e=>{if(e.target.id!=="f90OpsUserSearch")return;const term=e.target.value.trim().toLowerCase();
   root.querySelectorAll(".f90-ops-user").forEach(x=>{x.hidden=!!term&&!x.dataset.search.includes(term)})});
  void navigate(tab);
 }
 window.F90OpsCenter={render};
})();