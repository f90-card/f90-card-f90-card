(function(){
"use strict";
const escape=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let loading=null,hasShown=false,items=null;
function bootIncomplete(){
  if(document.documentElement.dataset.f90Ready==="1")return false;
  const root=document.getElementById("mainContent");
  if(!root)return false;
  const text=(root.textContent||"").trim();
  return (root.querySelector(".loading")&&(/جارٍ تجهيز عالمك الرقمي|جارٍ تحميل|جارٍ تجهيز/.test(text)))
    || /تعذّر تحميل المتجر|تعذّر بدء تشغيل المتجر|الاتصال بالمتجر تأخر|تعذّر إكمال تحميل الصفحة|جارٍ استعادة الاتصال بالخادم/.test(text);
}
function image(url,name){const img=document.createElement("img");const link=String(url||"");if(/^https:\/\//i.test(link)&&link.length<1600){img.src=link;img.loading="lazy";img.decoding="async";img.alt=name||"";}else{img.alt="صورة الخدمة";img.hidden=true;}return img;}
function render(data){
 if(!bootIncomplete())return;
 const root=document.getElementById("mainContent");
 const cats=Array.isArray(data?.categories)?data.categories:[],products=Array.isArray(data?.products)?data.products:[];
 if(!cats.length)throw Error("empty fallback catalog");
 hasShown=true;items={cats,products};
 root.replaceChildren();
 const heading=document.createElement("section");heading.className="panel";heading.style.cssText="margin:14px auto 16px;padding:22px;border:1px solid #db325e66;border-radius:19px;background:linear-gradient(130deg,#1a1522,#28111f);color:white";
 heading.innerHTML='<div style="font-size:12px;color:#f9acbe">F90 CARD · أف تسعين كارد</div><h1 style="font-size:clamp(22px,5vw,36px);margin:9px 0">تصفح المتجر أثناء استعادة الاتصال</h1><p style="font-size:13px;line-height:1.8;color:#e2c9d1">هذه معاينة للأقسام والخدمات من نسخة محفوظة. الأسعار والشراء والإيداع لا تعمل حتى يعود الاتصال المباشر بالخادم، لحماية رصيدك وطلباتك.</p><div class="actions"><button id="f90LiveRetry" class="button" type="button">إعادة الاتصال الآن</button><a href="https://wa.me/970568181910" target="_blank" rel="noopener noreferrer" class="button secondary">التواصل مع الإدارة</a></div>';
 root.append(heading);
 heading.querySelector("#f90LiveRetry")?.addEventListener("click",()=>location.reload());
 const toolbar=document.createElement("div");toolbar.className="f90-rescue-toolbar";
 toolbar.style.cssText="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:10px 0;padding:10px 0";
 const input=document.createElement("input");input.type="search";input.placeholder="ابحث عن قسم أو خدمة";input.setAttribute("aria-label","البحث في الأقسام والخدمات");input.style.cssText="width:min(100%,360px);min-height:42px;border-radius:12px";
 toolbar.append(input);root.append(toolbar);
 const menu=document.createElement("div");menu.style.cssText="display:flex;gap:7px;flex-wrap:wrap;margin:8px 0 16px";root.append(menu);
 const grid=document.createElement("div");grid.style.cssText="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:11px;margin:12px 0 30px";root.append(grid);
 let current=null;
 const normalize=s=>String(s||"").toLowerCase().normalize("NFKC");
 function card(label,url,kind){
    const cell=document.createElement("div");cell.style.cssText="min-width:0;overflow:hidden;border:1px solid #f03b6475;border-radius:15px;background:#181624;color:#fff";
    const pic=image(url,label);pic.style.cssText="display:block;aspect-ratio:1/1;width:100%;object-fit:cover;background:#211724";cell.append(pic);
    const caption=document.createElement("div");caption.textContent=label;caption.style.cssText="padding:8px;font-size:12px;font-weight:700;line-height:1.45;overflow-wrap:anywhere";cell.append(caption);
    const type=document.createElement("small");type.textContent=kind;type.style.cssText="display:block;padding:0 8px 9px;color:#d2a5b0";cell.append(type);return cell;
 }
 function descendants(id,stack=new Set()){if(stack.has(id))return stack;stack.add(id);for(const c of cats){if(c.parent_id===id)descendants(c.id,stack)}return stack}
 function paint(){
    grid.replaceChildren();menu.replaceChildren();
    const term=normalize(input.value.trim());
    const show=products.filter(x=>(!current||descendants(current).has(x.category_id))&&(!term||normalize(x.name).includes(term))).slice(0,140);
    const visibleCats=cats.filter(x=>!term||normalize(x.name).includes(term));
    const all=document.createElement("button");all.type="button";all.className="button secondary small";all.textContent="جميع الخدمات";all.addEventListener("click",()=>{current=null;paint()});menu.append(all);
    for(const c of visibleCats.filter(c=>!c.parent_id||c.parent_id===current).slice(0,80)){const b=document.createElement("button");b.type="button";b.className="button secondary small";b.textContent=c.name;b.addEventListener("click",()=>{current=c.id;input.value="";paint()});menu.append(b)}
    if(!current&&!term)for(const c of cats.filter(c=>!c.parent_id).slice(0,32))grid.append(card(c.name,c.image_url,"قسم"));
    for(const p of show)grid.append(card(p.name,p.image_url,"للعرض فقط"));
    if(!grid.children.length){const e=document.createElement("p");e.textContent="لا توجد خدمات مطابقة في النسخة المحفوظة.";grid.append(e)}
 }
 input.addEventListener("input",paint);paint();
}
async function show(){
 if(!bootIncomplete())return false;
 if(loading)return loading;
 loading=(async()=>{
   try{
    const controller=new AbortController();
    const t=setTimeout(()=>controller.abort(),8000);
    let response;try{response=await fetch("./f90-catalog-rescue.json?v=1",{cache:"no-store",signal:controller.signal})}finally{clearTimeout(t)}
    if(!response.ok)throw Error("snapshot fetch "+response.status);
    const data=await response.json();
    render(data);return true;
   }catch(err){
    if(!bootIncomplete())return false;
    const root=document.getElementById("mainContent");root.innerHTML='<section class="panel" style="max-width:680px;margin:35px auto;text-align:center"><h2>تعذّر الاتصال بالمتجر</h2><p>خادم الخدمات أو الاتصال لديك غير متاح حالياً. لا تحاول تكرار أي عملية إيداع أو شراء غير مؤكدة.</p><button class="button" id="f90RetryConnection">إعادة المحاولة</button></section>';
    root.querySelector("#f90RetryConnection")?.addEventListener("click",()=>location.reload());
    return false;
   }finally{loading=null}
 })();
 return loading;
}
window.F90StartupRescue={show,bootIncomplete,get hasShown(){return hasShown}};
window.setTimeout(()=>{if(bootIncomplete())void show()},9500);
})();