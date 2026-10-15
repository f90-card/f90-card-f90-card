(function(){
"use strict";
let host=null, audio=null, signature="",enabled=false,playing=false, config={};
function safeUrl(value){try{const u=new URL(String(value),location.href);return ["https:","http:"].includes(u.protocol)?u.href:"";}catch{return "";}}
function youtubeId(value){
 try{const u=new URL(value);if(["youtu.be","www.youtu.be"].includes(u.hostname))return /^[\w-]{11}$/.test(u.pathname.slice(1))?u.pathname.slice(1):null;
 if(["www.youtube.com","youtube.com","m.youtube.com","www.youtube-nocookie.com"].includes(u.hostname)){const id=u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();return /^[\w-]{11}$/.test(id||"")?id:null;}
 }catch{} return null;
}
function ensure(){
 if(host)return host;
 host=document.createElement("aside");host.id="f90MediaDock";host.className="f90-media-dock";host.setAttribute("aria-label","مشغّل وسائط F90 CARD");
 host.hidden=true;document.body.appendChild(host);
 return host;
}
function render(){
 const dock=ensure();dock.replaceChildren();
 if(!enabled){dock.hidden=true;return;}
 dock.hidden=false;dock.dataset.mode=config.mode||"audio";
 const head=document.createElement("div");head.className="f90-media-dock-head";
 head.innerHTML='<strong>F90 CARD · MUSIC</strong><button type="button" class="f90-media-minimize" aria-label="تصغير المشغل">−</button>';
 dock.append(head);
 head.querySelector("button").addEventListener("click",()=>dock.classList.toggle("is-minimized"));
 if(config.mode==="youtube"){head.querySelector("button").hidden=true;dock.classList.remove("is-minimized");}
 if(config.mode==="youtube"){
   const id=youtubeId(config.youtube_url||"");
   if(!id){dock.hidden=true;return;}
   const frame=document.createElement("iframe");
   frame.title="F90 CARD YouTube media";frame.width=280;frame.height=158;
   frame.src="https://www.youtube-nocookie.com/embed/"+id+"?playsinline=1&rel=0";
   frame.allow="encrypted-media; picture-in-picture; autoplay";frame.allowFullscreen=true;
   frame.referrerPolicy="strict-origin-when-cross-origin";frame.loading="lazy";
   dock.append(frame);
   const note=document.createElement("small");note.textContent="اضغط التشغيل داخل يوتيوب للتحكم بالصوت.";dock.append(note);
 }else{
   const url=safeUrl(config.audio_url);if(!url){dock.hidden=true;return;}
   audio=document.createElement("audio");audio.src=url;audio.preload="none";audio.loop=config.loop!==false;
   audio.volume=Math.min(1,Math.max(0,Number(config.volume)||0.35));audio.hidden=true;dock.append(audio);
   const ctr=document.createElement("button");ctr.type="button";ctr.className="f90-media-play";ctr.textContent="▶ تشغيل الموسيقى";
   ctr.addEventListener("click",async()=>{try{
     if(audio.paused){await audio.play();playing=true;ctr.textContent="Ⅱ إيقاف مؤقت";}
     else{audio.pause();playing=false;ctr.textContent="▶ تشغيل الموسيقى";}
   }catch{ctr.textContent="اضغط لتشغيل الصوت";}});
   dock.append(ctr);
   if(playing)audio.play().catch(()=>{playing=false;ctr.textContent="▶ تشغيل الموسيقى";});
 }
}
function sync(settings){
 const music=settings?.music||{};const next={enabled:music.enabled===true, mode:music.mode==="youtube"?"youtube":"audio",
 audio_url:music.audio_url||"",youtube_url:music.youtube_url||"",
 loop:music.loop!==false, volume:Number(music.volume??0.35)};
 const sig=JSON.stringify(next);if(sig===signature)return;
 signature=sig;config=next;enabled=next.enabled;
 const wasPlaying=playing;playing=wasPlaying&&next.mode==="audio";
 if(audio){audio.pause();audio.remove();audio=null;}render();
}
function status(){return {enabled,mode:config.mode,playing:audio?!audio.paused:false};}
window.F90MediaPlayer={sync,status,youtubeId};
})();