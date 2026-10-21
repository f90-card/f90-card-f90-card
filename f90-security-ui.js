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
    el.textContent="جارٍ تحميل سجلات الجلسات…";
    try{
      const {items}=await call("manager_list");
      if(!el.isConnected)return;
      const rows=items||[];
      el.innerHTML='<input class="f90-security-search" type="search" aria-label="بحث في نشاط العملاء" placeholder="ابحث باسم العميل أو IP أو البلد أو الجهاز">'+
        '<p class="muted small">'+rows.length+' جلسة معروضة من أحدث 100 جلسة خلال 30 يومًا.</p>'+
        '<div class="f90-security-records">'+(rows.length?rows.map(x=>item(x,true)).join(""):'<p class="muted">لا توجد بيانات مسجلة بعد. ستظهر الجلسات بعد دخول العملاء.</p>')+'</div>';
      const search=el.querySelector("input");
      search?.addEventListener("input",()=>{
        const term=search.value.trim().toLocaleLowerCase("ar");
        el.querySelectorAll(".f90-security-entry").forEach(row=>{
          row.hidden=!!term&&!row.textContent.toLocaleLowerCase("ar").includes(term);
        });
      });
    }catch{el.textContent="تعذّر تحميل السجل أو ليس لديك صلاحية المدير."}
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
