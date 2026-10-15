(function(){
"use strict";
const e=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function safe(src){try{const url=new URL(String(src||""),location.href);return /^https?:$/.test(url.protocol)?url.href:"";}catch{return "";}}
function scene(cfg,auth,logo){
const settings=cfg||{},promo=settings.promo_video||{}, text=String(promo.display_text||"F90 CARD · عالمك الرقمي").slice(0,130),
video=promo.enabled===true&&promo.mode!=="text"&&safe(promo.url),
poster=safe(promo.poster_url), phoneTitle=e(text), siteLogo=safe(logo)||"./f90-logo.png";
const messages=(Array.isArray(promo.messages)?promo.messages:[]).map(x=>String(x).trim()).filter(Boolean).slice(0,3);
while(messages.length<3)messages.push(["أولوياتنا إسعادك وراحتك معنا","خدماتك الرقمية بخطوات أسهل","أف تسعين كارد دائمًا بالقرب منك"][messages.length]);
const phoneVideo=video?'<video class="f90-welcome-screen-video" playsinline muted loop preload="none" '+(poster?'poster="'+e(poster)+'"':'')+'><source data-src="'+e(video)+'" type="'+(/\.webm(?:[?#]|$)/i.test(video)?"video/webm":"video/mp4")+'"></video>':'<div class="f90-welcome-phone-text">'+phoneTitle+'</div>';
return '<section class="f90-minimal-welcome" aria-label="مرحباً بك في F90 CARD">'+
'<h1 class="f90-minimal-title">مرحبًا بك في كازية أف تسعين كارد</h1>'+
'<div class="f90-minimal-stage">'+
'<div class="f90-welcome-flying-copy" aria-hidden="true"><span>'+e(messages[0])+'</span><span>'+e(messages[1])+'</span><span>'+e(messages[2])+'</span></div>'+
'<div class="f90-welcome-phone-scene"><div class="f90-welcome-real-phone">'+
'<div class="f90-welcome-metal-edge"></div><div class="f90-welcome-phone-screen">'+
'<div class="f90-welcome-dynamic-island"></div>'+
'<img class="f90-welcome-phone-logo" src="'+e(siteLogo)+'" alt="شعار أف تسعين كارد">'+
phoneVideo+
'<div class="f90-welcome-auth-overlay"><span>F90 CARD</span>'+
(auth?'<strong>مرحبًا بعودتك</strong><a href="#/profile">فتح حسابي</a>':
'<form id="authForm" class="f90-phone-login-form" data-mode="login" autocomplete="on">'+
'<label class="sr-only" for="f90PhoneLoginEmail">البريد الإلكتروني</label><input id="f90PhoneLoginEmail" type="email" name="email" required autocomplete="email" placeholder="البريد الإلكتروني" dir="ltr" maxlength="254">'+
'<label class="sr-only" for="f90PhoneLoginPassword">كلمة المرور</label><input id="f90PhoneLoginPassword" type="password" name="password" required autocomplete="current-password" placeholder="كلمة المرور" dir="ltr">'+
'<p id="authError" class="f90-phone-login-error" aria-live="polite"></p><button type="submit">تسجيل الدخول</button>'+ 
'<a href="#/auth">إنشاء حساب / نسيت كلمة المرور؟</a></form>')+
'</div></div><div class="f90-welcome-camera-decor" aria-hidden="true"><i></i><i></i><i></i></div></div></div></div></section>';
}
window.F90WelcomeScene={scene};
})();