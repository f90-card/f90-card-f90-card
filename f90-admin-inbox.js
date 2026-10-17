(function () {
  "use strict";
  // Authenticated admin-only inbox. The server always applies the staff role.
  const A = window.F90API;
  const $ = (id) => document.getElementById(id);
  const e = (value) => String(value == null ? "" : value).replace(/[&<>"']/g,
    c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const routes = {
    orders:"إدارة الطلبات",
    deposits:"طلبات الإيداع",
    verification:"توثيق الهوية",
    "order-requests":"الاعتراضات والإلغاء",
    users:"العملاء والأرصدة"
  };
  const state = { role:"",userId:"",items:[],known:null,opened:false,busy:null,audio:null,
    enabled:true,ready:false,init:false };
  const keyFor = (item) => item.kind + ":" + item.id;
  const inboxKey = () => "f90-admin-inbox-seen-v1:" + state.userId;
  const preferenceKey = "f90-admin-alert-sound-v1";
  const formatTime = (value) => {
    const time = Date.parse(String(value||""));
    return Number.isFinite(time) ? new Date(time).toLocaleString("ar",{
      dateStyle:"short",timeStyle:"short"
    }) : "";
  };
  function createAudio() {
    if(state.audio)return state.audio;
    const Constructor=window.AudioContext||window.webkitAudioContext;
    if(!Constructor)return null;
    try { state.audio=new Constructor(); } catch { return null; }
    return state.audio;
  }
  function unlockAudio() {
    const ctx=createAudio();
    if(ctx?.state==="suspended")ctx.resume().catch(()=>{});
  }
  function chime() {
    if(!state.enabled)return;
    try {
      const ctx=createAudio();
      if(!ctx||ctx.state!=="running")return;
      [660,880].forEach((frequency,index)=>{
        const start=ctx.currentTime+index*.13, oscillator=ctx.createOscillator(),
          gain=ctx.createGain();
        oscillator.type="sine";
        oscillator.frequency.value=frequency;
        gain.gain.setValueAtTime(.0001,start);
        gain.gain.exponentialRampToValueAtTime(.085,start+.025);
        gain.gain.exponentialRampToValueAtTime(.0001,start+.18);
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.start(start); oscillator.stop(start+.19);
      });
    } catch {/* browsers may block audio until the user opens the inbox */ }
  }
  function render() {
    const host=$("f90AdminInbox");
    if(!host)return;
    const list=host.querySelector("#f90AdminInboxList");
    if(!list)return;
    if(!state.items.length){
      list.innerHTML='<div class="f90-admin-inbox-empty">ما في إشعارات معلّقة حاليًا.</div>';
    }else{
      list.innerHTML=state.items.map(item=>{
        const route=Object.prototype.hasOwnProperty.call(routes,item.kind)?item.kind:"alerts";
        return '<details class="f90-admin-inbox-item"><summary>' +
          '<span class="f90-admin-inbox-item-title">'+e(item.title)+'</span>' +
          '<span class="f90-admin-inbox-date">'+e(formatTime(item.created_at))+'</span>' +
          '<span class="f90-admin-inbox-preview">'+e(item.detail)+'</span></summary>' +
          '<div class="f90-admin-inbox-detail"><p>'+e(item.detail)+'</p>' +
          '<a class="button secondary small" href="#/'+e(route)+'">الانتقال إلى '+e(routes[route]||"تنبيهات الإدارة")+'</a></div></details>';
      }).join("");
    }
    const count=host.querySelector("#f90AdminInboxCount");
    if(count)count.textContent=state.items.length+" إشعارًا في الصندوق";
    const sound=host.querySelector("#f90AdminSoundToggle");
    if(sound){sound.textContent=state.enabled?"🔊 الصوت مفعّل":"🔇 الصوت متوقف";
      sound.setAttribute("aria-pressed",String(state.enabled));}
  }
  function show(value) {
    const host=$("f90AdminInbox");
    if(!host)return;
    state.opened=!!value;
    host.hidden=!state.opened;
    $("adminBell")?.setAttribute("aria-expanded",String(state.opened));
    if(state.opened){
      unlockAudio(); render(); void refresh();
      host.querySelector("#f90AdminInboxClose")?.focus();
    }
  }
  async function refresh() {
    if(!state.ready||document.visibilityState==="hidden")return;
    if(state.busy)return state.busy;
    state.busy=(async()=>{
      try {
        const response=await A.call("staff.inbox");
        if(!Array.isArray(response?.items))return;
        const next=response.items.filter(item=>item&&typeof item.id==="string"&&
          typeof item.kind==="string"&&routes[item.kind]&&
          typeof item.title==="string"&&typeof item.detail==="string").slice(0,45);
        let known=state.known;
        if(known === null) {
          try {
            const saved=JSON.parse(sessionStorage.getItem(inboxKey())||"null");
            if(Array.isArray(saved))known=new Set(saved.filter(v=>typeof v==="string"));
          }catch{}
        }
        // Never play dozens of chimes for old requests on the first load.
        const newlyArrived=known!==null &&
          next.some(item=>!known.has(keyFor(item)));
        state.items=next;
        state.known=new Set(next.map(keyFor));
        try { sessionStorage.setItem(inboxKey(),JSON.stringify([...state.known])); } catch{}
        if(newlyArrived)chime();
        if(state.opened)render();
      }catch{
        const list=$("f90AdminInboxList");
        if(state.opened&&list&&!state.items.length)
          list.innerHTML='<p class="muted">تعذّر تحديث الإشعارات. جرّب إعادة فتح الصندوق.</p>';
      }
    })();
    try { await state.busy; } finally { state.busy=null; }
  }
  function init(role,userId) {
    if(!["manager","admin","support"].includes(role)||!userId)return;
    state.role=role; state.userId=String(userId);state.ready=true;
    try {state.enabled=localStorage.getItem(preferenceKey)!=="off";} catch{}
    const bell=$("adminBell");
    if(!bell)return;
    if(state.init)return;
    state.init=true;
    bell.setAttribute("aria-controls","f90AdminInbox");
    bell.setAttribute("aria-haspopup","dialog");
    bell.setAttribute("aria-expanded","false");
    const node=document.createElement("section");
    node.id="f90AdminInbox";
    node.className="f90-admin-inbox";
    node.setAttribute("role","dialog");
    node.setAttribute("aria-label","صندوق إشعارات الإدارة");
    node.hidden=true;
    node.innerHTML='<header class="f90-admin-inbox-head">' +
      '<div><h2>إشعارات الإدارة</h2><small id="f90AdminInboxCount">تحميل الإشعارات…</small></div>' +
      '<button type="button" class="icon-button" id="f90AdminInboxClose" aria-label="إغلاق الإشعارات">×</button></header>' +
      '<div class="f90-admin-inbox-tools">' +
      '<button type="button" class="button secondary small" id="f90AdminSoundToggle">🔊 الصوت مفعّل</button>' +
      '<button type="button" class="button secondary small" id="f90AdminInboxRefresh">تحديث</button></div>' +
      '<div id="f90AdminInboxList" class="f90-admin-inbox-list" aria-live="polite"></div>' +
      '<footer class="f90-admin-inbox-foot"><a href="#/alerts" class="button secondary small">مركز تنبيهات الإدارة</a>' +
      '<p>لتسمع الصوت، افتح الصندوق مرة واحدة على الأقل. بعض المتصفحات تمنع تشغيل الصوت تلقائيًا.</p></footer>';
    bell.insertAdjacentElement("afterend",node);
    bell.addEventListener("click",event=>{
      event.preventDefault();
      show(!state.opened);
    });
    node.addEventListener("click",event=>{
      const target=event.target;
      if(target.closest("#f90AdminInboxClose"))show(false);
      else if(target.closest("#f90AdminInboxRefresh"))void refresh();
      else if(target.closest("#f90AdminSoundToggle")){
        state.enabled=!state.enabled;
        try {localStorage.setItem(preferenceKey,state.enabled?"on":"off");}catch{}
        if(state.enabled)unlockAudio();
        render();
      } else if(target.closest('a[href^="#/"]'))show(false);
    });
    document.addEventListener("click",event=>{
      if(state.opened&&!event.target.closest("#f90AdminInbox,#adminBell"))show(false);
    });
    document.addEventListener("keydown",event=>{
      if(state.opened&&event.key==="Escape")show(false);
    });
    render();
  }
  window.F90AdminInbox={init,refresh};
})();
