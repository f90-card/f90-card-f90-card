(function(){
 'use strict';
 const api=()=>window.F90API?.client;
 const escape=v=>window.F90Core?.escapeHTML(String(v??''))||String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const when=v=>{if(!v)return 'لم يُرصد بعد';try{return new Date(v).toLocaleString('ar-PS')}catch{return 'غير متاح'}};
 const label=s=>({phone:'هاتف',tablet:'جهاز لوحي',desktop:'حاسوب',unknown:'غير محسوم'}[s]||'غير محسوم');
 const country=code=>{if(!code)return 'غير متاحة';try{return new Intl.DisplayNames(['ar'],{type:'region'}).of(code)}catch{return code}};
 let activeUserId=null,lastRecord=0,recordBusy=false,recordQueued=false,managerTimer=null;
 const choiceKey=id=>'f90-location-sharing:'+id;
 const getStored=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
 const putStored=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
 const clearKey=id=>'f90-location-clear:'+id;
 async function call(action,args={},expectedUserId){
  const {data,error}=await api().auth.getSession();const session=data?.session;
  if(error||!session?.access_token||(expectedUserId&&session.user?.id!==expectedUserId))throw Error('AUTH_REQUIRED');
  const response=await fetch('/api/security-activity',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({action,...args}),signal:AbortSignal.timeout(25000)});
  const json=await response.json();if(!response.ok||json.error)throw Error(json.error||'SECURITY_ACTIVITY_UNAVAILABLE');return json;
 }
 const position=()=>new Promise((resolve,reject)=>{
  if(!navigator.geolocation){reject(Error('GEOLOCATION_UNAVAILABLE'));return;}
  navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),reject,{enableHighAccuracy:true,maximumAge:60000,timeout:8000});
 });
 async function hints(){
  try{const h=await navigator.userAgentData?.getHighEntropyValues?.(['model']);return {device_model:typeof h?.model==='string'?h.model.slice(0,80):null};}catch{return {};}
 }
 async function record(userId,force=false,extra={}){
  if(!userId||userId!==activeUserId||document.visibilityState==='hidden')return;
  if(recordBusy){if(force)recordQueued=true;return;}
  if(!force&&Date.now()-lastRecord<45000)return;
  recordBusy=true;
  try{
   const payload={...await hints(),device_label:getStored('f90-device-label:'+userId),...extra};
   if(getStored(clearKey(userId))==='1')payload.clear_location=true;
   else if(getStored(choiceKey(userId))==='shared'&&!payload.location){
    try{payload.location=await position();payload.location_consent=true;}
    catch(error){if(error?.code===1){putStored(choiceKey(userId),'declined');putStored(clearKey(userId),'1');payload.clear_location=true;renderConsent();}}
   }
   if(userId!==activeUserId)return;
   if(getStored(choiceKey(userId))!=='shared'){delete payload.location;delete payload.location_consent;}
   if(getStored(clearKey(userId))==='1'){payload.clear_location=true;delete payload.location;delete payload.location_consent;}
   const result=await call('record',payload,userId);
   if(result.saved){lastRecord=Date.now();if(payload.clear_location)putStored(clearKey(userId),'0');}
  }catch{ /* A telemetry outage never blocks login, checkout or deposits. */ }
  finally{recordBusy=false;if(recordQueued){recordQueued=false;setTimeout(()=>void record(activeUserId,true),0);}}
 }
 function renderConsent(open=false){
  let root=document.getElementById('f90LocationConsent');
  if(!activeUserId){root?.remove();return;}
  const mode=getStored(choiceKey(activeUserId));
  if(mode==='declined'&&!open){root?.remove();return;}
  if(!root){root=document.createElement('aside');root.id='f90LocationConsent';root.className='f90-location-consent';root.setAttribute('aria-label','مشاركة الموقع مع إدارة F90 CARD');document.body.appendChild(root);}
  root.innerHTML=mode==='shared'&&!open
   ?'<p>مشاركة موقعك مع إدارة F90 CARD مفعّلة أثناء استخدام المتجر.</p><button type="button" class="button secondary small" data-location-stop>إيقاف المشاركة وحذف الموقع المحفوظ</button>'
   :'<strong>مشاركة الموقع مع إدارة F90 CARD — اختياري</strong><p>عند السماح، يُحدّث موقع المتصفح أثناء فتح المتجر ويُعرض للإدارة على الخريطة. يمكنك إيقافه وحذف الموقع المحفوظ في أي وقت. لن يمنع الرفض استخدام المتجر.</p><label>اسم جهازك (اختياري)<input maxlength="80" data-device-label value="'+escape(getStored('f90-device-label:'+activeUserId)||'')+'" placeholder="مثال: هاتفي ريدمي"></label><div class="actions"><button type="button" class="button small" data-location-allow>السماح بمشاركة الموقع</button><button type="button" class="button secondary small" data-location-later>لاحقًا</button></div><small data-location-status></small>';
  root.querySelector('[data-device-label]')?.addEventListener('change',ev=>{putStored('f90-device-label:'+activeUserId,ev.target.value.slice(0,80));void record(activeUserId,true);});
  root.querySelector('[data-location-later]')?.addEventListener('click',()=>{putStored(choiceKey(activeUserId),'declined');renderConsent();});
  root.querySelector('[data-location-stop]')?.addEventListener('click',()=>{putStored(choiceKey(activeUserId),'declined');putStored(clearKey(activeUserId),'1');renderConsent();void record(activeUserId,true,{clear_location:true});});
  root.querySelector('[data-location-allow]')?.addEventListener('click',async ev=>{
   const id=activeUserId,button=ev.target;button.disabled=true;const status=root.querySelector('[data-location-status]');status.textContent='بانتظار إذن الموقع من جهازك…';
   try{const location=await position();if(id!==activeUserId)return;putStored(choiceKey(id),'shared');putStored(clearKey(id),'0');renderConsent();void record(id,true,{location_consent:true,location});}
   catch(error){if(status.isConnected)status.textContent=error?.code===1?'لم يُمنح إذن الموقع. يمكنك متابعة استخدام المتجر أو السماح من إعدادات المتصفح.':'تعذّر تحديد الموقع الآن؛ حاول لاحقًا. لم تُرسل إحداثيات.';if(button?.isConnected)button.disabled=false;}
  });
 }
 function networkDetails(s){
  const recent=s.last_seen_at&&Date.now()-Date.parse(s.last_seen_at)<120000;
  const locality=[s.city,s.region].filter(Boolean).join('، ');
  let html='<span class="f90-presence '+(recent?'recent':'')+'">'+(recent?'نشاط خلال آخر دقيقتين':'لا يوجد نبض نشاط حديث')+'</span>'+
   '<span>IP الإنترنت العام: <b dir="ltr">'+escape(s.ip||'غير متاح')+'</b></span>'+
   '<span>موقع IP التقريبي: '+escape(country(s.country))+(locality?' · '+escape(locality):' · المدينة غير متاحة')+'</span>'+
   '<span>الشبكة: '+escape(s.network||'غير متاحة')+(s.asn?' · AS'+escape(s.asn):'')+'</span>'+
   '<span>الجهاز المبلّغ: '+escape(label(s.device))+' · '+escape(s.os||'غير معروف')+' · '+escape(s.browser||'غير معروف')+'</span>'+
   (s.device_model?'<span>الموديل المبلّغ من المتصفح: '+escape(s.device_model)+'</span>':'<span>الموديل الدقيق: لا يتيحه هذا المتصفح</span>')+
   (s.device_label?'<span>اسم اختاره المستخدم للجهاز: '+escape(s.device_label)+'</span>':'')+
   '<small>آخر رصد: '+escape(when(s.last_seen_at))+' · '+(s.source==='cloudflare_signed_v1'?'شبكة موثّقة من بوابة الموقع':'سجل قديم؛ ينتظر اتصال المستخدم مجددًا')+'</small>';
  const loc=s.location;
  if(loc&&[loc.latitude,loc.longitude,loc.accuracy].every(v=>Number.isFinite(Number(v)))&&Math.abs(Number(loc.latitude))<=90&&Math.abs(Number(loc.longitude))<=180){
   const href='https://www.openstreetmap.org/?mlat='+encodeURIComponent(loc.latitude)+'&mlon='+encodeURIComponent(loc.longitude)+'#map=16/'+encodeURIComponent(loc.latitude)+'/'+encodeURIComponent(loc.longitude);
   html+='<span>موقع شاركه المستخدم بإذن المتصفح · دقة ±'+escape(Math.round(Number(loc.accuracy)))+' متر</span><small>وقت قياس الموقع: '+escape(when(loc.recorded_at))+'</small><a class="button secondary small" target="_blank" rel="noopener noreferrer" href="'+href+'">عرض الموقع المشارك على خريطة خارجية</a>';
  }else html+='<small>الموقع بإذن المتصفح: لم يشاركه المستخدم</small>';
  return html;
 }
 async function renderMine(elementId){
  const el=document.getElementById(elementId);if(!el)return;el.textContent='جارٍ تحميل سجل الأمان…';
  try{const {items}=await call('mine');if(!el.isConnected)return;
   el.innerHTML='<button class="button secondary small" type="button" data-location-settings>إدارة مشاركة موقعي واسم جهازي</button>'+(items||[]).map(s=>'<article class="f90-security-entry">'+networkDetails(s)+'</article>').join('');
   el.querySelector('[data-location-settings]')?.addEventListener('click',()=>renderConsent(true));
  }catch{el.textContent='تعذّر عرض سجل الأمان حاليًا.';}
 }
 async function renderManager(elementId){
  const el=document.getElementById(elementId);if(!el)return;clearInterval(managerTimer);
  el.innerHTML='<label class="field"><span>بحث العملاء</span><input class="f90-security-search" type="search" placeholder="الاسم، رقم العميل، المدينة، IP، الشبكة، الجهاز"></label><p class="muted small">تحديث تلقائي كل 15 ثانية. IP قد يتكرر بين أجهزة الشبكة نفسها ويتغير عند تبديل الاتصال. الدولة والمدينة تقدير للشبكة، والموقع المشارك يعتمد على إذن المستخدم ودقة جهازه.</p><p class="muted small">لا يكشف المتصفح IP الجهاز الداخلي أو اسمه النظامي؛ اسم الجهاز اختياري، والموديل يظهر فقط إذا أتاحه المتصفح.</p><p id="f90SecCounter" class="muted small">جارٍ التحميل…</p><small data-security-updated></small><button type="button" class="button secondary small" data-security-refresh>تحديث الآن</button><div class="f90-security-records"></div>';
  const search=el.querySelector('input'),list=el.querySelector('.f90-security-records');let rows=[],busy=false;
  const filter=()=>{const term=search.value.trim().toLocaleLowerCase('ar');let count=0;list.querySelectorAll('.f90-security-entry').forEach(row=>{row.hidden=!!term&&!row.textContent.toLocaleLowerCase('ar').includes(term);if(!row.hidden)count++;});el.querySelector('#f90SecCounter').textContent=count+' حساب · الأحدث أولًا';};
  const update=async()=>{
   if(!el.isConnected){clearInterval(managerTimer);return;}if(busy||document.visibilityState==='hidden')return;busy=true;
   try{const result=await call('manager_list');if(!el.isConnected)return;rows=result.items||[];const scroll=list.scrollTop;
    const names={active:'نشط',suspended:'موقوف',banned:'محظور'};
    list.innerHTML=rows.map(x=>'<article class="f90-security-entry f90-security-customer"><div class="f90-sec-name"><strong>'+escape(x.name||'عميل')+'</strong><small>رقم العميل: '+escape(x.customer_id||'—')+'</small><small>حالة الحساب: '+escape(names[x.status]||'غير معروفة')+'</small></div><div class="f90-sec-information">'+networkDetails(x)+'</div><button type="button" class="button secondary small" data-action="find-user" data-id="'+escape(x.user_id)+'">إدارة الحساب</button><a class="button secondary small" href="#/security-sessions/'+escape(x.user_id)+'">إدارة الجلسات</a></article>').join('');
    list.scrollTop=scroll;filter();el.querySelector('[data-security-updated]').textContent='آخر تحديث للوحة: '+when(result.server_time||new Date().toISOString());
   }catch(error){if(error.message==='MFA_REQUIRED'&&window.F90SecurityAdmin){clearInterval(managerTimer);await window.F90SecurityAdmin.mfa(el,()=>renderManager(elementId));return;}el.querySelector('[data-security-updated]').textContent='تعذّر التحديث. البيانات المعروضة آخر نتيجة ناجحة وليست رصدًا حيًا.';}
   finally{busy=false;}
  };
  search.addEventListener('input',filter);el.querySelector('[data-security-refresh]').addEventListener('click',()=>void update());
  await update();if(el.isConnected)managerTimer=setInterval(()=>void update(),15000);
 }
 function setUser(id){if(id!==activeUserId){activeUserId=id;lastRecord=0;renderConsent();}if(id)void record(id,true);}
 function start(){
  const auth=api()?.auth;if(!auth)return;
  auth.getSession().then(({data})=>setUser(data?.session?.user?.id||null)).catch(()=>{});
  auth.onAuthStateChange((event,session)=>{if(['SIGNED_IN','INITIAL_SESSION','TOKEN_REFRESHED','SIGNED_OUT'].includes(event))setTimeout(()=>setUser(session?.user?.id||null),0);});
  setInterval(()=>void record(activeUserId),60000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')void record(activeUserId);});
  window.addEventListener('online',()=>void record(activeUserId,true));
 }
 async function signIn(credentials){
  try{
   const r=await fetch('/api/auth-login',{method:'POST',headers:{'Content-Type':'application/json',apikey:window.F90_CONFIG.SUPABASE_KEY},body:JSON.stringify(credentials),cache:'no-store',signal:AbortSignal.timeout(25000)});
   if(r.status>=500)return await api().auth.signInWithPassword(credentials);
   let data;try{data=await r.json();}catch{return await api().auth.signInWithPassword(credentials);}
   if(!r.ok)return {data:null,error:{message:'بيانات الدخول غير صحيحة أو الاتصال غير متاح',status:r.status}};
   if(!data.access_token||!data.refresh_token)return {error:{message:'تعذر تأكيد الدخول'}};
   return await api().auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
  }catch{return await api().auth.signInWithPassword(credentials);}
 }
 setTimeout(start,0);window.F90SecurityUI={record,renderMine,renderManager,signIn,adminDenied:()=>call('admin_denied').catch(()=>{})};
})();
