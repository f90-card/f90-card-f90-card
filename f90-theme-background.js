(function(){
"use strict";
// F90 CARD background scene. It is decorative and never changes the document layout.
let scene=null, photo=null, shade=null, watermark=null, glow=null;
let currentConfig={}, logoSrc="",themeName="";
const clamp=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;};
function safeUrl(value){
 try{const u=new URL(String(value||""),location.href);return u.protocol==="https:"||u.protocol==="http:"?u.href:"";}catch{return "";}
}
function ensure(){
 if(scene || !document.body)return;
 scene=document.createElement("div");
 scene.id="f90ThemeBackdrop";
 scene.className="f90-theme-backdrop";
 scene.setAttribute("aria-hidden","true");
 photo=document.createElement("div");photo.className="f90-theme-photo";
 shade=document.createElement("div");shade.className="f90-theme-shade";
 watermark=document.createElement("div");watermark.className="f90-theme-watermark";
 glow=document.createElement("div");glow.className="f90-theme-watermark-glow";
 const img=document.createElement("img");img.alt="";img.decoding="async";img.draggable=false;
 watermark.append(glow,img);
 scene.append(photo,shade,watermark);
 document.body.insertBefore(scene,document.body.firstChild);
}
function render(){
 ensure();if(!scene)return;
 const name=themeName==="cream"?"cream":"dark";
 const site=currentConfig.site_background||{};
 const selected=site.themes?.[name] || (!site.themes ? site : {});
 // Independent global background/surface lightness for each theme. No whole-page
 // CSS filter: checkout text, product images and accessibility remain untouched.
 const brightness=clamp(selected?.brightness,50,150,100);
 const increase=brightness>=100;
 const intensity=increase
   ? (brightness-100)*(name==="dark"?.34:.4)
   : (100-brightness)*(name==="dark"?.42:.3);
 const mix=clamp(intensity,0,25,0);
 document.documentElement.style.setProperty("--f90-tone-color",increase?"#ffffff":"#000000");
 document.documentElement.style.setProperty("--f90-base-percent",(100-mix).toFixed(2)+"%");
 document.documentElement.style.setProperty("--f90-tint-percent",mix.toFixed(2)+"%");
 const bg=safeUrl(selected?.enabled?selected.url:"");
 const dim=clamp(selected?.dim,0,.85,name==="cream"?.28:.48);
 photo.style.backgroundImage=bg?"url("+JSON.stringify(bg)+")":"none";
 photo.style.opacity=bg?"1":"0";
 photo.style.filter="brightness("+(brightness/100).toFixed(2)+")";
 photo.style.backgroundPosition="center center";
 shade.style.backgroundColor=name==="cream"?"rgba(246,240,235,"+dim+")":"rgba(8,10,16,"+dim+")";
 shade.hidden=!bg;
 scene.classList.toggle("has-photo",!!bg);
 const wm=site.logo||{};
 const showLogo=wm.enabled!==false;
 const actualLogo=safeUrl(logoSrc)||new URL("./f90-logo.png",location.href).href;
 const img=watermark.querySelector("img");
 if(img.src!==actualLogo)img.src=actualLogo;
 watermark.hidden=!showLogo;
 watermark.style.setProperty("--f90-wm-opacity",String(clamp(wm.opacity,.03,.35,.13)));
 watermark.style.setProperty("--f90-wm-size",clamp(wm.size,160,660,360)+"px");
 watermark.style.setProperty("--f90-wm-duration",clamp(wm.speed,12,90,35)+"s");
 scene.dataset.theme=name;
 document.documentElement.classList.toggle("f90-custom-backdrop",!!bg);
}
function sync(config,logo){
 currentConfig=config&&typeof config==="object"?config:{};
 logoSrc=String(logo||"");
 themeName=document.documentElement.dataset.theme||"dark";
 render();
}
function setTheme(value){themeName=value==="cream"?"cream":"dark";render();}
window.F90ThemeBackground={sync,setTheme};
})();