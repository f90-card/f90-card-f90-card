(function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const safe=x=>{try{const u=new URL(String(x||""),location.href);return ["https:","http:"].includes(u.protocol)?u.href:"";}catch{return "";}};
function homePhone(cfg,brandLogo){
  const c=cfg||{},p=c.promo_video||{};
  if(p.enabled!==true)return "";
  const mode=p.mode==="image"?"image":p.mode==="text"?"image":"video";
  const video=safe(p.url),still=safe(p.image_url||p.poster_url);
  const number=(value,min,max,fallback)=>{
    const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
  };
  const desktopSize=number(p.phone_size,1,480,178);
  const mobileSize=number(p.phone_size_mobile,1,360,153);
  const laptopSize=number(p.laptop_size,1,760,320);
  const laptopMobileSize=number(p.laptop_size_mobile,1,360,220);
  const dx=number(p.phone_x,-110,110,0),dy=number(p.phone_y,-90,90,0);
  const mediaStyle="--f90-media-scale:"+number(p.content_scale,.25,2,1)+";--f90-media-x:"+number(p.content_x,-50,50,0)+"%;--f90-media-y:"+number(p.content_y,-50,50,0)+"%;--f90-laptop-media-scale:"+number(p.laptop?.content_scale,.25,2,1)+";--f90-laptop-media-x:"+number(p.laptop?.content_x,-50,50,0)+"%;--f90-laptop-media-y:"+number(p.laptop?.content_y,-50,50,0)+"%;";
  const style=mediaStyle+"--f90-phone-size:"+desktopSize+"px;--f90-phone-mobile-size:"+mobileSize+"px;--f90-laptop-size:"+laptopSize+"px;--f90-laptop-mobile-size:"+laptopMobileSize+"px;--f90-phone-x:"+dx+"px;--f90-phone-y:"+dy+"px";
  const media=mode==="video"&&video
    ? '<video class="f90-home-phone-video" muted playsinline loop preload="none" disablepictureinpicture aria-label="إعلان F90 CARD"'+(still?' poster="'+esc(still)+'"':"")+'><source data-src="'+esc(video)+'" type="'+(/\.webm(?:[?#]|$)/i.test(video)?"video/webm":"video/mp4")+'"></video>'
    :still?'<img class="f90-home-phone-image" src="'+esc(still)+'" alt="إعلان متجر أف تسعين كارد" loading="lazy" decoding="async">':"";
  const laptop=p.laptop||{},laptopImage=safe(laptop.image_url),laptopVideo=safe(laptop.url);
  const laptopMedia=laptop.mode==="video"&&laptopVideo
    ? '<video class="f90-home-laptop-video" muted playsinline loop preload="none"'+(laptopImage?' poster="'+esc(laptopImage)+'"':"")+'><source data-src="'+esc(laptopVideo)+'" type="'+(/\.webm(?:[?#]|$)/i.test(laptopVideo)?"video/webm":"video/mp4")+'"></video>'
    : '<img src="'+esc(laptopImage||still||'./f90-logo.png')+'" alt="إعلان أف تسعين كارد" loading="lazy">';
  return '<section class="f90-home-phone-ad f90-home-devices" style="'+esc(style)+'" aria-label="إعلانات الأجهزة">'+
  '<div class="f90-home-phone-link" aria-label="إعلان F90 CARD">'+
  '<span class="f90-home-phone-shell"><span class="f90-home-phone-screen">'+media+'</span><img class="f90-home-phone-mark" src="'+esc(safe(brandLogo)||"./f90-logo.png")+'" alt="" aria-hidden="true" loading="lazy"></span></div>'+
  '<div class="f90-home-laptop-link" aria-label="إعلان الكمبيوتر المحمول"><span class="f90-home-laptop-shell"><span class="f90-home-laptop-display">'+laptopMedia+'</span><span class="f90-home-laptop-base"></span></span></div></section>';
}
window.F90WelcomeScene={homePhone};
})();
