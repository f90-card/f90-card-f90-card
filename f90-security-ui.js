(function(){
  "use strict";
  const api=()=>window.F90API?.client;
  const escape=(v)=>window.F90Core?.escapeHTML(String(v??"")) || String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const when=(v)=>{try{return new Date(v).toLocaleString("ar-PS")}catch{return "—"}};
  const label=(s)=>({phone:"هاتف",tablet:"جهاز لوحي",desktop:"حاسوب",unknown:"غير معروف"}[s]||s||"غير معروف");
  async function call(action,args={}){
    if(!api()?.functions)throw new Error("خدمة الأمان غير جاهزة");
    const {data,error}=await api().functions.invoke("f90-security-activity",{body:{action,...args}});
    if(error||!data||data.error)throw new Error("تعذّر الاتصال بسجل الأمان");
    return data;
  }
  async function record(userId){
    if(!userId||document.visibilityState==="hidden")return;
    const key="f90-security-session:"+userId;
    try{if(Date.now()-Number(sessionStorage.getItem(key)||0)<4*3600000)return}catch{}
    try{
      const response=await call("record");
      if(response.saved)try{sessionStorage.setItem(key,String(Date.now()))}catch{}
    }catch{ /* Customer's normal session is never interrupted by telemetry failures. */ }
  }
  const item=(s,admin)=>'<article class="f90-security-entry">'+
    (admin?'<strong>'+escape(s.name||"عميل")+' · '+escape(s.customer_id||"")+'</strong>':'')+
    '<strong>'+escape(label(s.device))+' · '+escape(s.os||"غير معروف")+' · '+escape(s.browser||"غير معروف")+'</strong>'+
    '<span>الدولة التقريبية: '+escape(s.country||"غير متاحة")+' | IP: <b dir="ltr">'+escape(s.ip||"غير متاح")+'</b></span>'+
    '<small>آخر نشاط: '+escape(when(s.last_seen_at))+'</small></article>';
  async function renderMine(elementId){
    const el=document.getElementById(elementId);if(!el)return;
    el.textContent="جارٍ تحميل نشاط الدخول…";
    try{
      const {items}=await call("mine");
      if(!el.isConnected)return;
      el.innerHTML=(items||[]).length?(items||[]).map(x=>item(x,false)).join(""):
        '<p class="muted">لم تُسجل جلسات دخول حتى الآن.</p>';
    }catch{el.textContent="تعذّر عرض سجل الأمان حاليًا."}
  }
  async function renderManager(elementId){
    const el=document.getElementById(elementId);if(!el)return;
    el.textContent="جارٍ تحميل حسابات العملاء…";
    try{
      const {items}=await call("manager_list");
      if(!el.isConnected)return;
      const rows=items||[];
      const statusName={active:"نشط",suspended:"موقوف",banned:"محظور"};
      const card=(x)=>'<article class="f90-security-entry f90-security-customer">'+
        '<div class="f90-sec-name"><strong>'+escape(x.name||"عميل")+'</strong>'+
        '<small>رقم العميل: <b dir="ltr">'+escape(x.customer_id||"—")+'</b></small></div>'+
        '<div class="f90-sec-information"><span>الحالة: '+escape(statusName[x.status]||"غير معروفة")+'</span>'+
        '<span>الدولة: '+escape(x.country||"غير متاحة")+' · IP: <b dir="ltr">'+escape(x.ip||"غير متاح")+'</b></span>'+
        '<span>الجهاز: '+escape(label(x.device))+' · '+escape(x.os||"غير معروف")+' · '+escape(x.browser||"غير معروف")+'</span>'+
        '<small>آخر نشاط موثّق: '+escape(x.last_seen_at?when(x.last_seen_at):"لم يتم رصد جلسة بعد")+'</small></div>'+
        '<button type="button" class="button secondary small" data-action="find-user" data-id="'+escape(x.user_id)+'">إدارة الحساب</button></article>';
      el.innerHTML='<label class="field"><span>بحث العملاء</span><input class="f90-security-search" type="search" aria-label="بحث في حسابات العملاء" placeholder="الاسم، رقم العميل، الدولة، IP، الجهاز"></label>'+
        '<p class="muted small">كل الحسابات المسجّلة (القديمة والجديدة) · من أقدم نشاط إلى أحدث نشاط · بيانات الـ IP والجهاز قد لا تتوفر.</p>'+
        '<p class="muted small" id="f90SecCounter">'+rows.length+' حساب</p>'+
        '<div class="f90-security-records">'+(rows.length?rows.map(card).join(""):'<p class="muted">لا توجد حسابات مسجّلة.</p>')+'</div>';
      const search=el.querySelector("input");
      search?.addEventListener("input",()=>{
        const term=search.value.trim().toLocaleLowerCase("ar");
        let count=0;
        el.querySelectorAll(".f90-security-entry").forEach(row=>{
          const match=!term||row.textContent.toLocaleLowerCase("ar").includes(term);
          row.hidden=!match;
          if(match)count++;
        });
        const counter=el.querySelector("#f90SecCounter");if(counter)counter.textContent=count+" حساب مطابق";
      });
    }catch{el.textContent="تعذّر تحميل سجل العملاء أو ليس لديك صلاحية المدير."}
  }
  // Observe verified Supabase session events outside critical login/checkout flows.
  // Deferring the request avoids nested asynchronous calls in auth callbacks.
  function start(){
    const auth=api()?.auth;
    if(!auth)return;
    auth.getSession().then(({data})=>{
      const id=data?.session?.user?.id;
      if(id)setTimeout(()=>record(id),0);
    }).catch(()=>{});
    auth.onAuthStateChange((event,session)=>{
      const id=session?.user?.id;
      if(id&&["SIGNED_IN","INITIAL_SESSION","TOKEN_REFRESHED"].includes(event))
        setTimeout(()=>record(id),0);
    });
  }
  setTimeout(start,0);
  window.F90SecurityUI={record,renderMine,renderManager};
})();
