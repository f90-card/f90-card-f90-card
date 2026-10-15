(function(){
"use strict";
// F90 CARD: only the manager selects tracks and the public start position.
// Customers may set their personal volume; browser autoplay policy always applies.
const VOLUME_KEY="f90-radio-volume";
let bubble,panel,slider,percent,note,media,trackTitle;
let state={enabled:false,revision:"",tracks:[],selected_index:0,start_seconds:0,volume:.35,mode:"audio"};
let trackIndex=0,sourceUrl="",loading=false,loadSequence=0,seekOnLoad=0,started=false,userGesture=false;
let retryTimer=null,retryMs=3000,stallTimer=null,refreshing=false;
const clamp=(x,lo,hi,otherwise=lo)=>{const n=Number(x);return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):otherwise;};
function url(value){try{const parsed=new URL(String(value||""),location.href);return parsed.protocol==="https:"?parsed.href:"";}catch{return "";}}
function volume(){
 try{const value=localStorage.getItem(VOLUME_KEY);return value===null?clamp(state.volume,0,1,.35):clamp(value,0,1,.35);}catch{return clamp(state.volume,0,1,.35);}
}
function hint(message){if(note)note.textContent=message||"";}
function setVolume(v){try{localStorage.setItem(VOLUME_KEY,String(v));}catch{}}
function ensure(){
 if(bubble)return;
 bubble=document.createElement("aside");
 bubble.id="f90MediaDock";bubble.className="f90-radio-bubble";
 bubble.hidden=true;bubble.setAttribute("aria-label","راديو أف تسعين كارد");
 bubble.innerHTML='<button type="button" class="f90-radio-orb" id="f90RadioOrb" aria-label="التحكم في صوت الراديو" aria-expanded="false" aria-controls="f90RadioPopup">'+
 '<img class="f90-radio-default-logo" src="./f90-logo.png" alt="" width="42" height="42" loading="eager">'+
 '<img class="f90-radio-custom-icon" id="f90RadioIcon" alt="" hidden></button>'+
 '<div class="f90-radio-popup" id="f90RadioPopup" hidden>'+
 '<strong class="f90-radio-title">راديو أف تسعين</strong>'+
 '<small id="f90RadioTrack" class="f90-radio-current"></small>'+
 '<label for="f90RadioVolume">مستوى الصوت <output id="f90RadioPercent">35%</output></label>'+
 '<input type="range" id="f90RadioVolume" min="0" max="100" value="35" aria-label="مستوى صوت المتجر">'+
 '<small class="f90-radio-hint" id="f90RadioHint" role="status"></small></div>';
 document.body.appendChild(bubble);
 panel=bubble.querySelector("#f90RadioPopup");slider=bubble.querySelector("#f90RadioVolume");
 percent=bubble.querySelector("#f90RadioPercent");note=bubble.querySelector("#f90RadioHint");
 trackTitle=bubble.querySelector("#f90RadioTrack");
 bubble.querySelector("#f90RadioOrb").addEventListener("click",async()=>{
   userGesture=true;panel.hidden=!panel.hidden;
   bubble.querySelector("#f90RadioOrb").setAttribute("aria-expanded",String(!panel.hidden));
   if(state.enabled&&media?.paused)await play();
 });
 slider.addEventListener("input",()=>{
   userGesture=true;
   const v=clamp(Number(slider.value)/100,0,1);
   setVolume(v);percent.textContent=Math.round(v*100)+"%";
   if(media){media.volume=v;media.muted=v===0;}
   if(state.enabled&&media?.paused&&v>0)void play();
 });
 document.addEventListener("pointerdown",event=>{
   if(panel.hidden||bubble.contains(event.target))return;
   panel.hidden=true;bubble.querySelector("#f90RadioOrb").setAttribute("aria-expanded","false");
 });
 updateVolume();
}
function updateVolume(){
 if(!slider)return;
 const v=volume();slider.value=String(Math.round(100*v));percent.textContent=Math.round(100*v)+"%";
 if(media){media.volume=v;media.muted=v===0;}
}
function clearTimers(){
 if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}
 if(stallTimer){clearTimeout(stallTimer);stallTimer=null;}
}
function destroy(){
 loadSequence++;clearTimers();loading=false;sourceUrl="";started=false;
 if(media){media.pause();media.removeAttribute("src");media.load();media.remove();media=null;}
}
function currentTrack(){
 return state.tracks.length?state.tracks[trackIndex]||state.tracks[0]:null;
}
function updateTitle(){
 if(trackTitle)trackTitle.textContent=currentTrack()?.title||"البث الصوتي المباشر";
}
async function getTicket(index){
 const result=await window.F90API?.call?.("media.ticket",{track_index:index});
 const mediaUrl=url(result?.url);
 if(!mediaUrl)throw new Error("مصدر الصوت غير متاح");
 return mediaUrl;
}
async function loadTrack(index,initial=false){
 if(!state.enabled||!media||loading)return;
 const seq=++loadSequence,target=media;
 loading=true;
 trackIndex=state.tracks.length?(index+state.tracks.length)%state.tracks.length:0;
 seekOnLoad=initial?clamp(state.start_seconds,0,86400):0;
 updateTitle();clearTimers();sourceUrl="";
 try{
   const targetUrl=await getTicket(trackIndex);
   if(target!==media||seq!==loadSequence||!state.enabled)return;
   sourceUrl=targetUrl;
   media.src=targetUrl;media.load();
 }catch{
   if(seq===loadSequence)hint("تعذّر تحميل المقطع الصوتي، حاول مجددًا");
 }finally{if(seq===loadSequence)loading=false;}
}
async function play(){
 if(!media||!state.enabled)return;
 if(!sourceUrl){
   await loadTrack(trackIndex,!!seekOnLoad);
   if(!sourceUrl){hint("جاري تجهيز الصوت، حاول مجددًا");return;}
 }
 try{
   await media.play();started=true;retryMs=3000;hint("");
 }catch(error){
   if(error?.name==="NotAllowedError")hint("المس فقاعة الراديو لتفعيل الصوت");
   else hint("تعذّر تشغيل الصوت، المس الفقاعة للمحاولة مجددًا");
 }
}
function makeMedia(){
 destroy();if(!state.enabled)return;
 const item=currentTrack();
 const mode=item?.mode==="video"?"video":state.mode;
 const el=document.createElement(mode==="video"?"video":"audio");
 el.className="f90-radio-hidden-media";el.id="f90RadioMedia";el.controls=false;
 el.preload="auto";el.autoplay=false;el.loop=false;el.playsInline=true;
 el.setAttribute("playsinline","");el.setAttribute("aria-hidden","true");
 if(mode==="video")el.disablePictureInPicture=true;
 document.body.appendChild(el);media=el;updateVolume();
 el.addEventListener("loadedmetadata",()=>{
   if(el!==media)return;
   const seek=Math.max(0,seekOnLoad);
   seekOnLoad=0;
   if(seek){
     try{el.currentTime=Number.isFinite(el.duration)?Math.min(seek,Math.max(0,el.duration-0.25)):seek;}catch{}
   }
 });
 el.addEventListener("ended",async()=>{
   if(!state.enabled||el!==media)return;
   // Albums play in order and loop to the first track when finished.
   if(state.tracks.length>0){
     const next=(trackIndex+1)%state.tracks.length;
     if(state.tracks[next]?.mode!==currentTrack()?.mode){
       trackIndex=next;makeMedia();return;
     }
     await loadTrack(next);
     if(sourceUrl && (started||userGesture))void play();
   }else{
     try{el.currentTime=0;}catch{}
     if(started||userGesture)void play();
   }
 });
 el.addEventListener("playing",()=>{clearTimers();hint("");});
 const recover=()=>{
   if(el!==media||!state.enabled||retryTimer)return;
   hint("جاري إعادة الاتصال بالراديو");
   retryTimer=setTimeout(async()=>{
     retryTimer=null;
     if(el!==media||!state.enabled)return;
     await loadTrack(trackIndex);
     if(sourceUrl&&(started||userGesture))void play();
   },retryMs);
   retryMs=Math.min(retryMs*2,30000);
 };
 el.addEventListener("error",recover);
 el.addEventListener("waiting",()=>{
   if(stallTimer)clearTimeout(stallTimer);
   stallTimer=setTimeout(()=>{stallTimer=null;recover();},25000);
 });
 seekOnLoad=state.start_seconds;
 void loadTrack(trackIndex,true).then(()=>{if(state.enabled)void play();});
}
function appearance(input){
 ensure();const o=input&&typeof input==="object"?input:{};
 bubble.dataset.side=o.side==="left"?"left":"right";
 bubble.style.setProperty("--f90-radio-top",clamp(o.vertical,12,88,76)+"%");
 bubble.style.setProperty("--f90-radio-mobile-size",clamp(o.size_mobile,32,88,49)+"px");
 bubble.style.setProperty("--f90-radio-desktop-size",clamp(o.size_desktop,32,100,54)+"px");
 bubble.style.setProperty("--f90-radio-opacity",clamp(o.opacity,.35,1,.85));
 const custom=bubble.querySelector("#f90RadioIcon"),defaultLogo=bubble.querySelector(".f90-radio-default-logo");
 const src=url(o.icon_url);
 custom.hidden=!src;defaultLogo.hidden=!!src;
 if(src && custom.src!==src)custom.src=src;
}
function apply(next){
 ensure();
 const enabled=next?.enabled===true;
 const tracks=Array.isArray(next?.tracks)?next.tracks.slice(0,40).map(x=>({title:String(x.title||"مقطع صوتي").slice(0,90),mode:x.mode==="video"?"video":"audio"})):[];
 const index=tracks.length?clamp(next?.selected_index,0,tracks.length-1,0):0;
 const revision=String(next?.revision||"");
 const mode=next?.mode==="video"?"video":"audio";
 const changed=enabled!==state.enabled||revision!==state.revision||mode!==state.mode||
   JSON.stringify(tracks)!==JSON.stringify(state.tracks);
 state={enabled,tracks,selected_index:index,start_seconds:clamp(next?.start_seconds,0,86400),
    volume:clamp(next?.volume,0,1,.35),revision,mode};
 appearance(next?.bubble);
 bubble.hidden=!enabled;
 document.body.classList.toggle("f90-radio-on",enabled);
 if(!enabled){destroy();panel.hidden=true;return;}
 if(changed||!media){trackIndex=index;makeMedia();}
 else updateTitle();
 updateVolume();
}
async function refresh(){
 if(refreshing)return;
 refreshing=true;
 try{
  const result=await window.F90API?.call?.("media.state");
  if(result&&typeof result.enabled==="boolean")apply(result);
 }catch{/* Keep the active track when connection is interrupted. */}
 finally{refreshing=false;}
}
function sync(settings){
 const m=settings?.music||{};
 if(m.enabled===true&&!state.enabled)appearance(m.bubble);
 void refresh();
}
window.F90MediaPlayer={sync,refresh,status:()=>({
 enabled:state.enabled,playing:!!media&&!media.paused,track:currentTrack()?.title||"",trackIndex
})};
setInterval(()=>void refresh(),30000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)void refresh();});
})();