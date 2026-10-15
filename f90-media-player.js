(function(){
"use strict";
// The administrator selects sources and controls broadcast status.
// Visitors only receive an edge-mounted translucent volume control.
const VOLUME_KEY="f90-radio-volume";
let bubble=null,panel=null,slider=null,percent=null,note=null,media=null;
let state={enabled:false,mode:"audio",revision:""},cachedSource="";
let loading=false,retryDelay=3000,retryTimer=null,stallTimer=null,refreshing=false,lastInteraction=false,started=false;
function safeUrl(value){try{const u=new URL(String(value||""),location.href);return ["https:","http:"].includes(u.protocol)?u.href:"";}catch{return "";}}
function getVolume(){try{const v=localStorage.getItem(VOLUME_KEY);return v===null?0.35:Math.max(0,Math.min(1,Number(v)||0));}catch{return .35;}}
function setVolume(v){try{localStorage.setItem(VOLUME_KEY,String(v));}catch{}}
function setNote(v){if(note)note.textContent=v||"";}
function ensure(){
 if(bubble)return;
 bubble=document.createElement("aside");
 bubble.id="f90MediaDock";
 bubble.className="f90-radio-bubble";
 bubble.hidden=true;
 bubble.setAttribute("aria-label","مستوى صوت المتجر");
 bubble.innerHTML='<button type="button" class="f90-radio-orb" id="f90RadioOrb" aria-label="فتح التحكم بالصوت" aria-expanded="false" aria-controls="f90RadioPopup">'+
 '<svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>'+
 '<img class="f90-radio-custom-icon" id="f90RadioIcon" alt="" hidden></button><div class="f90-radio-popup" id="f90RadioPopup" hidden>'+
 '<label for="f90RadioVolume">الصوت <output id="f90RadioPercent">35%</output></label>'+
 '<input type="range" id="f90RadioVolume" min="0" max="100" value="35" aria-label="مستوى صوت المتجر">'+
 '<small class="f90-radio-hint" id="f90RadioHint" role="status"></small></div>';
 document.body.appendChild(bubble);
 panel=bubble.querySelector("#f90RadioPopup");
 slider=bubble.querySelector("#f90RadioVolume");
 percent=bubble.querySelector("#f90RadioPercent");
 note=bubble.querySelector("#f90RadioHint");
 const v=Math.round(getVolume()*100);
 slider.value=String(v);percent.textContent=v+"%";
 bubble.querySelector("#f90RadioOrb").addEventListener("click",async()=>{
   lastInteraction=true;
   panel.hidden=!panel.hidden;
   bubble.querySelector("#f90RadioOrb").setAttribute("aria-expanded",String(!panel.hidden));
   if(state.enabled && media?.paused)await begin();
 });
 slider.addEventListener("input",()=>{
   lastInteraction=true;
   const v=Math.max(0,Math.min(1,Number(slider.value)/100));
   percent.textContent=Math.round(v*100)+"%";
   setVolume(v);
   if(media){media.volume=v;media.muted=v===0;}
   if(state.enabled && media?.paused && v>0)void begin();
 });
 document.addEventListener("pointerdown",(event)=>{
   if(!bubble||panel?.hidden||bubble.contains(event.target))return;
   panel.hidden=true;
   bubble.querySelector("#f90RadioOrb").setAttribute("aria-expanded","false");
 });
}
function clearRetry(){if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}}
function destroy(){
 clearRetry();
 if(stallTimer){clearTimeout(stallTimer);stallTimer=null;}
 if(media){media.pause();media.removeAttribute("src");media.load();media.remove();media=null;}
 cachedSource="";started=false;loading=false;
}
async function obtain(){
 const ticket=await window.F90API?.call?.("media.ticket");
 const url=safeUrl(ticket?.url);
 if(!url)throw new Error("تعذّر تحميل مصدر الصوت");
 return url;
}
async function prepareSource(){
 if(!media||loading||cachedSource)return;
 loading=true;
 const target=media;
 try{
   const url=await obtain();
   if(target!==media||!state.enabled)return;
   target.src=url;
   cachedSource=url;
   target.load();
 }catch{
   if(state.enabled)setNote("المصدر غير متاح الآن");
 }finally{loading=false;}
}
async function begin(){
 if(!media||!state.enabled)return;
 // When the private ticket was prefetched, play() runs directly in the gesture.
 if(!cachedSource){await prepareSource();if(!cachedSource){setNote("جاري التحميل، المس الفقاعة مرة أخرى");return;}}
 try{
   await media.play();
   started=true;retryDelay=3000;
   setNote("");
 }catch(err){
   if(err?.name==="NotAllowedError")setNote("المس فقاعة الصوت لتفعيل البث");
   else setNote("تعذّر تشغيل الصوت. المس الفقاعة لإعادة المحاولة");
 }
}
function createMedia(mode){
 destroy();
 if(!state.enabled)return;
 const el=document.createElement(mode==="video"?"video":"audio");
 el.className="f90-radio-hidden-media";el.id="f90RadioMedia";
 el.loop=true;el.controls=false;el.preload="auto";
 el.autoplay=false;el.playsInline=true;
 el.setAttribute("playsinline","");
 el.setAttribute("aria-hidden","true");
 if(mode==="video")el.disablePictureInPicture=true;
 el.volume=getVolume();el.muted=el.volume===0;
 document.body.appendChild(el);
 media=el;
 const recover=()=>{
   if(!state.enabled||el!==media)return;
   setNote("جارٍ إعادة الاتصال بالصوت");
   cachedSource="";
   clearRetry();
   retryTimer=setTimeout(()=>{
     if(el!==media || !state.enabled)return;
     el.removeAttribute("src");el.load();
     void prepareSource().then(()=>{if(started||lastInteraction)void begin();});
   },retryDelay);
   retryDelay=Math.min(retryDelay*2,30000);
 };
 el.addEventListener("error",recover);
 el.addEventListener("waiting",()=>{
   if(stallTimer)clearTimeout(stallTimer);
   stallTimer=setTimeout(()=>{stallTimer=null;recover();},20000);
 });
 el.addEventListener("playing",()=>{
   if(stallTimer){clearTimeout(stallTimer);stallTimer=null;}
   clearRetry();
   setNote("");
 });
 el.addEventListener("ended",()=>{
   if(state.enabled){try{el.currentTime=0;}catch{} void begin();}
 });
 // Pre-fetch before the user taps, to preserve user activation for play().
 void prepareSource().then(()=>{if(state.enabled)void begin();});
}
function applyBubble(value){
 ensure();
 const o=value&&typeof value==="object"?value:{};
 const side=o.side==="left"?"left":"right";
 const bounded=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;};
 bubble.dataset.side=side;
 bubble.style.setProperty("--f90-radio-top",bounded(o.vertical,12,88,62)+"%");
 bubble.style.setProperty("--f90-radio-mobile-size",bounded(o.size_mobile,32,88,44)+"px");
 bubble.style.setProperty("--f90-radio-desktop-size",bounded(o.size_desktop,32,100,50)+"px");
 bubble.style.setProperty("--f90-radio-opacity",String(bounded(o.opacity,.35,1,.7)));
 const url=safeUrl(o.icon_url);
 const icon=bubble.querySelector("#f90RadioIcon");
 const original=bubble.querySelector("#f90RadioOrb svg");
 if(icon){
   icon.hidden=!url;
   if(url && icon.src!==url)icon.src=url;
   if(original)original.hidden=!!url;
 }
}
function apply(next){
 ensure();
 const enabled=next?.enabled===true;
 const mode=next?.mode==="video"?"video":"audio";
 const revision=String(next?.revision||"");
 const changed=enabled!==state.enabled || mode!==state.mode || revision!==state.revision;
 state={enabled,mode,revision};
 applyBubble(next?.bubble);
 bubble.hidden=!enabled;
 document.body.classList.toggle("f90-radio-on",enabled);
 if(!enabled){destroy();panel.hidden=true;return;}
 if(changed||!media)createMedia(mode);
}
async function refresh(){
 if(refreshing)return;
 refreshing=true;
 try{
   const result=await window.F90API?.call?.("media.state");
   if(result&&typeof result.enabled==="boolean")apply(result);
 }catch{/* Network failures must not stop already playing audio. */}
 finally{refreshing=false;}
}
function sync(settings){
 // Catalog state gives a quick first paint; the tiny status endpoint is authoritative.
 const m=settings?.music||{};
 if(m.enabled===true && !state.enabled)apply({enabled:true,mode:"audio",revision:"",bubble:m.bubble||{}});
 void refresh();
}
function status(){return {enabled:state.enabled,playing:!!media&&!media.paused,mode:state.mode};}
window.F90MediaPlayer={sync,status,refresh};
setInterval(()=>{void refresh();},30000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)void refresh();});
})();