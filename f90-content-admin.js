/* Independent F90 text, links, image and branding editors with pre-upload previews. */
(function(){
"use strict";
const e=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;":"&quot;","'":"&#39;"}[c]));
const input=(name,label,value,type="text",attr="")=>'<label class="field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+e(value??"")+'" '+attr+'></label>';
const multi=(name,label,value)=>'<label class="field"><span>'+label+'</span><textarea name="'+name+'" rows="3" maxlength="4000">'+e(value??"")+'</textarea></label>';
const box=(id,label,url,category="banners")=>'<div class="f90-media-editor-row"><strong>'+label+'</strong>'+
 '<div class="f90-media-editor-preview"><img data-location-preview="'+id+'" src="'+e(url||"./assets/sections/hero.png")+'" alt="معاينة '+label+'" loading="lazy"></div>'+
 input(id+"_url","رابط الصورة (اختياري)",url||"","url",'data-location-url="'+id+'"')+
 '<label class="field"><span>رفع صورة / GIF • '+category+'</span><input type="file" name="'+id+'_file" data-location-file="'+id+'" accept="image/png,image/jpeg,image/webp,image/gif"></label></div>';
let current={};
const pages={
 "content-text":["محرر النصوص","كل النصوص هنا، دون حقول رفع الصور"],
 "content-links":["إدارة الروابط","واتساب وروابط المنصات، مستقلة عن تحرير الصور"],
 "content-images":["مكتبة صور الواجهات","معاينة مباشرة لكل صورة قبل رفعها وتوضيح موضع عرضها"],
 "content-backgrounds":["خلفيات الثيمات","صورة مختلفة لكل ثيم ومراجعة معاينة مباشرة"],
 "content-branding":["الشعار وأيقونة التطبيق","الشعار الأصلي، وعلامة المتجر وأيقونة التثبيت"]
};
function editor(page,main,settings){
 current={page,settings};
 const c=settings?.config||{},sc=c.social_links||[],bg=c.site_background||{},themes=bg.themes||{};
 const [title,subtitle]=pages[page]||pages["content-text"];
 let content="";
 if(page==="content-text"){
  content='<section class="panel"><h2>النصوص العامة</h2>'+input("store_name","اسم المتجر",settings.store_name)+
    multi("announcement","نص شريط الأخبار",settings.announcement)+multi("footer_ar","نبذة التذييل",c.footer_ar)+
    input("welcome_title","عنوان التعرف على المتجر",c.welcome?.title_ar||"تعرّف على أف تسعين كارد")+
    multi("welcome_subtitle","الوصف أسفل تعرف على المتجر",c.welcome?.subtitle_ar||"")+
    multi("popup_text","محتوى الرسالة المنبثقة",c.popup_announcement?.text_ar||"")+'</section>';
 }else if(page==="content-links"){
  content='<section class="panel"><h2>روابط التواصل</h2>'+input("whatsapp","رقم واتساب الدعم",c.whatsapp||"","tel",'dir="ltr"')+
    input("whatsapp_channel_url","رابط قناة واتساب",c.whatsapp_channel_url||"","url",'dir="ltr"')+
    '<h3>منصات التواصل</h3><div class="f90-link-edit-rows">'+
    Array.from({length:Math.max(sc.length+2,5)},(_,i)=>{
      const item=sc[i]||{};
      return '<div class="f90-social-edit-row">'+input("social_"+i+"_name","المنصة "+(i+1),item.name_ar||"")+
        input("social_"+i+"_url","الرابط",item.url||"","url",'dir="ltr"')+
        input("social_"+i+"_icon","رابط الأيقونة",item.icon_url||"","url",'dir="ltr"')+
        '<label><input type="checkbox" name="social_'+i+'_enabled" '+(item.enabled!==false?"checked":"")+'> إظهار</label></div>';
    }).join("")+'</div></section>';
 }else if(page==="content-images"){
  content='<section class="panel"><h2>صور داخل الموقع</h2><p class="muted">صور الأقسام الفردية وبنراتها قابلة للتغيير من <a href="#/categories">إدارة الأقسام</a>. الإعلانات المنفصلة من <a href="#/banners">الإعلانات</a>.</p>'+
    box("hero_image","إعلان أعلى الصفحة الرئيسية",c.hero_image)+
    box("welcome_image","صورة التعرف على F90 CARD",c.welcome?.image_url)+
    box("phone_image","الصورة داخل شاشة الآيفون",c.promo_video?.image_url)+
    box("laptop_image","الصورة داخل شاشة اللابتوب",c.promo_video?.laptop?.image_url)+'</section>';
 }else if(page==="content-backgrounds"){
  content='<section class="panel"><h2>خلفيات الموقع</h2>'+
    box("dark_background","خلفية الثيم الداكن",themes.dark?.url||bg.url)+
    input("dark_brightness","إضاءة الخلفية الداكنة (%)",themes.dark?.brightness??100,"range",'min="50" max="150" step="1"')+
    box("light_background","خلفية الثيم الحليبي",themes.cream?.url)+
    input("light_brightness","إضاءة الخلفية الفاتحة (%)",themes.cream?.brightness??100,"range",'min="50" max="150" step="1"')+
    '<p class="muted">خلفيات الأقسام منفصلة عن خلفية الموقع الرئيسية.</p></section>';
 }else{
  content='<section class="panel"><h2>علامة F90 CARD</h2>'+
    box("brand_logo","الشعار الرسمي في رأس المتجر",settings.logo_url,"branding")+
    box("app_icon","أيقونة تثبيت التطبيق",c.app_icon_url||"./assets/icons/icon-192.png","branding")+
    input("primary_color","لون الهوية",settings.primary_color||"#fa2444","color")+'</section>';
 }
 main.innerHTML='<div class="page-head"><div><div class="eyebrow">لوحة إدارة F90 CARD</div><h1>'+title+'</h1><p>'+subtitle+'</p></div></div>'+
 '<form id="f90ContentForm" class="f90-manager-form" data-page="'+page+'">'+content+
 '<div class="f90-manager-save"><p role="status" id="f90ContentStatus"></p><button class="button" type="submit">حفظ التعديلات</button></div></form>';
}
document.addEventListener("change",ev=>{
 const f=ev.target.closest?.("[data-location-file]");if(!f?.files?.[0])return;
 const target=document.querySelector('[data-location-preview="'+f.dataset.locationFile+'"]');
 if(!target)return;
 if(target.dataset.objectUrl)URL.revokeObjectURL(target.dataset.objectUrl);
 target.dataset.objectUrl=URL.createObjectURL(f.files[0]);target.src=target.dataset.objectUrl;
});
document.addEventListener("input",ev=>{
 const el=ev.target.closest?.("[data-location-url]");if(!el||!/^https:\/\//.test(el.value))return;
 const img=document.querySelector('[data-location-preview="'+el.dataset.locationUrl+'"]');if(img)img.src=el.value;
});
document.addEventListener("submit",async ev=>{
 const f=ev.target;if(f?.id!=="f90ContentForm")return;
 ev.preventDefault();
 const button=f.querySelector('button[type="submit"]'),out=document.getElementById("f90ContentStatus"),d=new FormData(f);
 if(button.disabled)return;
 button.disabled=true;out.textContent="حفظ التغييرات…";
 try{
 const settings=current.settings,old=settings.config||{},cfg={...old};
 let name=settings.store_name,logo=settings.logo_url,color=settings.primary_color,announcement=settings.announcement;
 const url=async id=>{
   const file=f.elements[id+"_file"]?.files?.[0];
   if(file){
     if(!file.type.startsWith("image/")||file.size>5242880)throw Error("الصورة غير مدعومة أو أكبر من 5 ميجابايت");
     return (await window.F90API.upload(file,"f90-images",id==="brand_logo"||id==="app_icon"?"branding":"banners")).url;
   }
   return String(d.get(id+"_url")||"").slice(0,2000);
 };
 if(current.page==="content-text"){
   name=String(d.get("store_name")||"").slice(0,100);
   announcement=String(d.get("announcement")||"").slice(0,1000);
   cfg.footer_ar=String(d.get("footer_ar")||"").slice(0,4000);
   cfg.welcome={...cfg.welcome,title_ar:String(d.get("welcome_title")||"").slice(0,100),
     subtitle_ar:String(d.get("welcome_subtitle")||"").slice(0,400)};
   cfg.popup_announcement={...cfg.popup_announcement,text_ar:String(d.get("popup_text")||"").slice(0,1000)};
 }else if(current.page==="content-links"){
   cfg.whatsapp=String(d.get("whatsapp")||"").slice(0,60);
   cfg.whatsapp_channel_url=String(d.get("whatsapp_channel_url")||"").slice(0,500);
   const rows=f.querySelectorAll(".f90-social-edit-row");
   cfg.social_links=[...rows].map((_,i)=>({
     id:old.social_links?.[i]?.id || "social_"+i,
     name_ar:String(d.get("social_"+i+"_name")||"").slice(0,100),
     url:String(d.get("social_"+i+"_url")||"").slice(0,500),
     icon_url:String(d.get("social_"+i+"_icon")||"").slice(0,2000),
     enabled:d.get("social_"+i+"_enabled")==="on"
   })).filter(x=>x.name_ar&&x.url);
 }else if(current.page==="content-images"){
   cfg.hero_image=await url("hero_image");
   cfg.welcome={...cfg.welcome,image_url:await url("welcome_image")};
   cfg.promo_video={...cfg.promo_video,image_url:await url("phone_image"),
     laptop:{...cfg.promo_video?.laptop,image_url:await url("laptop_image")}};
 }else if(current.page==="content-backgrounds"){
   const dark=await url("dark_background"),light=await url("light_background");
   cfg.site_background={...cfg.site_background,themes:{
     ...cfg.site_background?.themes,
     dark:{...cfg.site_background?.themes?.dark,url:dark,enabled:!!dark,brightness:Number(d.get("dark_brightness")||100)},
     cream:{...cfg.site_background?.themes?.cream,url:light,enabled:!!light,brightness:Number(d.get("light_brightness")||100)}
   }};
 }else if(current.page==="content-branding"){
   logo=await url("brand_logo");cfg.app_icon_url=await url("app_icon");color=String(d.get("primary_color")||"#fa2444");
 }
 await window.F90API.call("settings.save",{data:{store_name:name,logo_url:logo,primary_color:color,
   currency:settings.currency,announcement,contact_email:settings.contact_email,config:cfg}});
 out.textContent="تم حفظ التغييرات. حدّث الموقع لمراجعتها.";
 }catch(err){out.textContent="تعذر الحفظ: "+(err?.message||"خطأ غير معروف");}
 finally{button.disabled=false;}
});
window.F90ContentAdmin={render:editor};
})();
