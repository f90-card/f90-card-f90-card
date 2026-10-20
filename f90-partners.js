(function(){
'use strict';
const C=window.F90Core,e=C.escapeHTML,db=window.f90Supabase;
let spaces=[],categories=[],products=[],banners=[],loading=null;
const media=path=>path?db.storage.from('f90-partner-images').getPublicUrl(path).data.publicUrl:'';
function image(path,alt,cls=''){const url=media(path);return url?`<img src="${e(url)}" alt="${e(alt)}" class="${cls}" loading="lazy" decoding="async">`:'';}
function safeContact(url){try{const u=new URL(url);return ['https:','mailto:','tel:'].includes(u.protocol)?u.href:'';}catch{return '';}}
function purchaseUrl(url){return /^https:\/\/(?:wa\.me\/[1-9][0-9]{6,14}(?:\?text=\S*)?|api\.whatsapp\.com\/send\?phone=[1-9][0-9]{6,14}(?:&text=\S*)?)$/.test(url)?url:'';}
async function load(){
 if(loading)return loading;
 loading=(async()=>{
 if(!db)return;
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),6000);
 try{
 const result=await Promise.all([
 db.from('f90_partner_spaces').select('id,name,is_active,collaboration_image,contacts').eq('is_active',true).abortSignal(abort.signal),
 ...['categories','products','banners'].map(t=>db.from('f90_partner_'+t).select('*').eq('is_active',true).order('sort_order').order('id').limit(1000).abortSignal(abort.signal))]);
 if(result.some(r=>r.error))return;
 spaces=result[0].data||[];const ids=new Set(spaces.map(x=>x.id));
 categories=(result[1].data||[]).filter(x=>ids.has(x.space_id));const categoryIds=new Set(categories.map(x=>x.id));
 products=(result[2].data||[]).filter(x=>ids.has(x.space_id)&&categoryIds.has(x.category_id));
 banners=(result[3].data||[]).filter(x=>ids.has(x.space_id));
 }catch{/* The independent partner catalog must not prevent normal store access. */}finally{clearTimeout(timer);}
 })();return loading;
}
function aboveIntro(){
 return spaces.filter(s=>s.collaboration_image).map(s=>`<div class="partner-collaboration">${image(s.collaboration_image,'تعاون F90 CARD والأمين كارد')}</div>`).join('');
}
function home(){return categories.length?`<section class="partner-catalog" id="amin-card-catalog"><div class="section-head"><h2>الأمين كارد</h2></div><div class="image-grid">${categories.map(c=>`<a class="image-tile" href="#/partner/${encodeURIComponent(c.id)}" aria-label="${e(c.name)}">${image(c.image_path,c.name)}<span>${e(c.name)}</span></a>`).join('')}</div>${contacts()}</section>`:'';}
function contacts(){return spaces.map(s=>{const links=(s.contacts||[]).filter(x=>safeContact(x.url));return links.length?`<section class="partner-contact"><h2>تواصل مع الأمين كارد</h2><div class="actions">${links.map(x=>`<a class="button secondary" href="${e(safeContact(x.url))}" target="_blank" rel="noopener noreferrer">${e(x.label)}</a>`).join('')}</div></section>`:'';}).join('');}
function mainBanners(){return [];} 
function secondaryBanners(){return banners.filter(b=>b.placement==='small').map(b=>({id:b.id,title:b.title,image_url:media(b.image_path),link_url:C.safeUrl(b.link_url)||'#/',presentation:{}}));}
function whatsappNumber(value){try{const u=new URL(value);if(u.protocol!=='https:')return '';if(u.hostname==='wa.me')return /^\/[1-9][0-9]{6,14}$/.test(u.pathname)?u.pathname.slice(1):'';if(u.hostname==='api.whatsapp.com'&&u.pathname==='/send'){const phone=u.searchParams.get('phone')||'';return /^[1-9][0-9]{6,14}$/.test(phone)?phone:''}}catch{}return ''}
function openOrder(productId){const p=products.find(x=>x.id===productId);if(!p)return;const phone=whatsappNumber(p.purchase_url);if(!phone)return;const wrapper=document.createElement('dialog');wrapper.className='partner-order-dialog';const currency=p.currency;const price=Number(p.price);if(!Number.isFinite(price)||price<0)return;
wrapper.innerHTML=`<form method="dialog" class="partner-order-form"><h3>${e(p.name)}</h3><p>سعر الوحدة: ${e(new Intl.NumberFormat('ar',{style:'currency',currency}).format(price))}</p><label>معرّف الحساب أو البريد<input name="account" required maxlength="160" autocomplete="off" placeholder="ID / Email"></label><label>الكمية<input name="quantity" type="number" inputmode="numeric" required min="1" max="50000000" step="1" value="1"></label><strong data-total></strong><div class="actions"><button type="button" class="button secondary" data-close>إلغاء</button><button type="submit" class="button">متابعة عبر واتساب</button></div></form>`;
document.body.append(wrapper);const form=wrapper.querySelector('form'),qty=form.elements.quantity,total=wrapper.querySelector('[data-total]');const update=()=>{const count=Number(qty.value);total.textContent=Number.isSafeInteger(count)&&count>=1&&count<=50000000?new Intl.NumberFormat('ar',{style:'currency',currency,maximumFractionDigits:6}).format(price*count):'كمية غير صالحة'};qty.addEventListener('input',update);update();wrapper.querySelector('[data-close]').onclick=()=>wrapper.close();wrapper.addEventListener('close',()=>wrapper.remove());form.addEventListener('submit',ev=>{ev.preventDefault();if(!form.reportValidity())return;const count=Number(qty.value);if(!Number.isSafeInteger(count)||count<1||count>50000000)return;const account=String(form.elements.account.value||'').trim();if(!account)return;const amount=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:6}).format(price*count);const message=['طلب خدمة من الأمين كارد','الخدمة: '+p.name,'معرف العميل: '+account,'الكمية: '+count,'السعر: '+amount+' '+currency].join('\\n');window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');wrapper.close()});wrapper.showModal()}
async function render(main,id){
 main.innerHTML='<p role="status">جارٍ تحميل خدمات الأمين كارد…</p>';await load();
 if(decodeURIComponent((location.hash||'').split('/')[2]||'')!==id)return;
 const category=categories.find(c=>c.id===id);
 if(!category){main.textContent='هذا القسم غير متاح حاليًا';return;}
 main.innerHTML=`<div class="page-heading"><a href="#/">الرئيسية</a><h1>${e(category.name)}</h1></div><div class="image-grid">${products.filter(p=>p.category_id===id).map(p=>{
 const url=purchaseUrl(p.purchase_url);return `<article class="partner-product">${image(p.image_path,p.name)}<h3>${e(p.name)}</h3>${p.description?`<p>${e(p.description)}</p>`:''}<strong class="partner-price">${e(new Intl.NumberFormat('ar',{style:'currency',currency:p.currency,maximumFractionDigits:6}).format(p.price))}</strong>${url?`<button class="button" type="button" data-partner-order="${e(p.id)}">طلب الخدمة</button>`:''}</article>`;
 }).join('')}</div>${contacts()}`;
}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-partner-order]');if(b)openOrder(b.dataset.partnerOrder)});
window.F90Partners={load,aboveIntro,home,contacts,mainBanners,secondaryBanners,render};
})();
