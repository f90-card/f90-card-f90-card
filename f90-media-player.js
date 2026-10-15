(function(){
"use strict";
// Radio audio belongs to the page shell. Hash navigation does not recreate it.
const preference="f90-radio-playback", volumePreference="f90-radio-volume";
let dock=null, media=null, button=null, label=null, slider=null, notice=null;
let config={}, signature="", source="", enabled=false, desire=false, busy=false, lastError=0;
function safeURL(value){try{const u=new URL(String(value||""),location.href);return /^https?:$/.test(u.protocol)?u.href:"";}catch{return "";}}
function get(k){try{return localStorage.getItem(k);}catch{return null;}}
function put(k,v){try{localStorage.setItem(k,String(v));}catch{}}
function clamp(n, fallback){const v=Number(n);return Number.isFinite(v)?Math.min(1,Math.max(0,v)):fallback;}
function setNotice(message){if(notice)notice.textContent=message||"";}
function state(){
 if(!button)return;
 const active=!!media&&!media.paused&&!media.ended;
 button.textContent=active?"❚❚":"▶";
 button.setAttribute("aria-label",active?"إيقاف راديو أف تسعين":"تشغيل راديو أف تسعين");
 button.setAttribute("aria-pressed",String(active));
 if(label)label.textContent=active?"يعمل الآن · بث متواصل":"جاهز للتشغيل";
 dock?.classList.toggle("is-playing",active);
}
function ensure(){
 if(dock)return;
 dock=document.createElement("section");
 dock.id="f90MediaDock";dock.className="f90-radio-dock";dock.hidden=true;
 dock.setAttribute("aria-label","راديو أف تسعين كارد");
 dock.innerHTML='<div class="f90-radio-mark" aria-hidden="true">♫</div>'+
 '<div class="f90-radio-info"><strong>راديو F90 CARD</strong><small id="f90RadioState">جاهز للتشغيل</small></div>'+
 '<button type="button" class="f90-radio-control" id="f90RadioToggle" aria-label="تشغيل راديو أف تسعين">▶</button>'+
 '<label class="f90-radio-volume"><span aria-hidden="true">🔊</span><input id="f90RadioVolume" aria-label="مستوى صوت الراديو" type="range" min="0" max="100" step="1" value="35"><output id="f90RadioPercent">35%</output></label>'+
 '<small class="f90-radio-notice" id="f90RadioNotice" role="status"></small>';
 document.body.appendChild(dock);
 button=dock.querySelector("#f90RadioToggle");slider=dock.querySelector("#f90RadioVolume");
 label=dock.querySelector("#f90RadioState");notice=dock.querySelector("#f90RadioNotice");
 button.addEventListener("click",async()=>{
   if(!media || media.paused){desire=true;put(preference,"play");await start();}
   else{desire=false;put(preference,"pause");media.pause();setNotice("متوقف حتى تضغط تشغيل");state();}
 });
 slider.addEventListener("input",()=>{
   const volume=clamp(Number(slider.value)/100,0.35);
   if(media){media.volume=volume;media.muted=false;}
   dock.querySelector("#f90RadioPercent").value=Math.round(volume*100)+"%";
   dock.querySelector("#f90RadioPercent").textContent=Math.round(volume*100)+"%";
   put(volumePreference,volume);
 });
}
async function ticket(){
 if(config.private_track){
   if(!window.F90API?.call)throw new Error("الاتصال بالصوت غير متاح الآن");
   const result=await window.F90API.call("media.ticket");
   if(!result?.url)throw new Error("لم يتوفر رابط صوت صالح");
   return safeURL(result.url);
 }
 return safeURL(config.audio_url); // Legacy public audio, until it is replaced by a private upload.
}
async function setSource(force=false){
 if(!media)return;
 if(!force && source)return;
 const result=await ticket();
 if(!result)throw new Error("ارفع ملفًا من لوحة الإدارة أولًا");
 source=result;
 media.src=result;
 media.load();
}
async function start(force=false){
 if(!enabled||!media||busy||!desire)return;
 busy=true;
 try{
   if(force || !source) await setSource(force);
   if(!desire)return;
   // When the source was prefetched, play() runs inside the tap itself.
   await media.play();
   setNotice("");
 }catch(err){
   setNotice(err?.name==="NotAllowedError"?"اضغط تشغيل للسماح بالصوت":(err?.message||"تعذّر تشغيل المصدر"));
 }finally{busy=false;state();}
}
function teardown(){
 if(media){media.pause();media.removeAttribute("src");media.load();media.remove();media=null;}
 source="";busy=false;
}
function prepare(){
 ensure();dock.hidden=!enabled;
 document.body.classList.toggle("f90-radio-on",enabled);
 if(!enabled){teardown();state();return;}
 const type=config.mode==="video"?"video":"audio";
 media=document.createElement(type);
 media.id="f90RadioMedia";
 media.className="f90-radio-hidden-media";
 media.preload="auto";media.loop=true;media.controls=false;media.autoplay=false;
 if(type==="video"){media.playsInline=true;media.disablePictureInPicture=true;media.setAttribute("playsinline","");}
 media.setAttribute("aria-hidden","true");
 media.volume=get(volumePreference)===null?clamp(config.volume,0.35):clamp(get(volumePreference),0.35);
 slider.value=String(Math.round(media.volume*100));
 dock.querySelector("#f90RadioPercent").textContent=slider.value+"%";
 dock.appendChild(media);
 media.addEventListener("play",state);media.addEventListener("pause",state);
 media.addEventListener("ended",()=>{if(desire){media.currentTime=0;start();}});
 media.addEventListener("error",()=>{
   if(!desire||Date.now()-lastError<12000)return;
   lastError=Date.now();
   source="";
   setNotice("جارٍ استعادة البث…");
   start(true); // Refresh an expired short-lived signed URL, without a page reload.
 });
 // Autoplay may be blocked by the browser; never try to bypass that policy.
 if(desire)start();
 state();
}
function sync(settings){
 const music=settings?.music||{};
 const next={enabled:music.enabled===true,mode:music.mode==="video"?"video":"audio",
 private_track:music.private_track===true||Boolean(music.path),audio_url:music.audio_url||"",
 volume:clamp(music.volume,0.35)};
 const sig=JSON.stringify({enabled:next.enabled,mode:next.mode,private_track:next.private_track,audio_url:next.audio_url});
 if(sig===signature)return;
 const wasPlaying=!!media&&!media.paused;
 signature=sig;config=next;enabled=next.enabled;
 if(get(preference)!=="pause") desire=true;
 else desire=false;
 teardown();prepare();
}
function status(){return {enabled,mode:config.mode,playing:!!media&&!media.paused,loop:true};}
window.F90MediaPlayer={sync,status};
})();