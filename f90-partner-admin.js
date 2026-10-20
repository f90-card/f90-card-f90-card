(async function(){
'use strict';
const db=window.f90Supabase,C=window.F90Core,e=C.escapeHTML;
const $=id=>document.getElementById(id),message=$('partnerMessage'),main=$('partnerMain'),controls=$('partnerControls');
let spaces=[],space=null,categories=[],products=[],banners=[],usage={},page='products',busy=false,role='';
const tables={categories:'f90_partner_categories',products:'f90_partner_products',banners:'f90_partner_banners'};
function check(r){if(r.error)throw new Error(r.error.message);return r.data;}
function field(name,label,value='',type='text',attrs=''){return `<label class="field"><span>${e(label)}</span><input name="${e(name)}" type="${type}" value="${e(value)}" ${attrs}></label>`;}
const img=path=>path?db.storage.from('f90-partner-images').getPublicUrl(path).data.publicUrl:'';
function say(text){message.textContent=text;}
async function read(){
 const r=await Promise.all(Object.values(tables).map(table=>db.from(table).select('*').eq('space_id',space.id).order('sort_order').order('id').limit(1000)));
 [categories,products,banners]=r.map(check);usage=check(await db.rpc('f90_partner_usage',{p_space:space.id}));
}
function navigation(){
 controls.innerHTML=(spaces.length>1?`<label class="field"><span>المساحة</span><select id="partnerSpace">${spaces.map(s=>`<option value="${s.id}" ${s.id===space.id?'selected':''}>${e(s.name)}</option>`).join('')}</select></label>`:'')+
 `${!space.is_active?'<p class="notice" role="alert">قسم الأمين كارد غير منشور حاليًا، لذلك لن تظهر أقسامه ومنتجاته للزوار. اطلب من مدير الموقع تفعيل ظهور المساحة من «التواصل».</p>':''}<div class="partner-stats"><label>الصور: ${(Number(usage.used_bytes)/1048576).toFixed(1)} / 200 ميجابايت<progress max="${usage.limit_bytes}" value="${usage.used_bytes}"></progress></label><span>خدمات فعّالة: ${usage.active_products}</span><span>خدمات متوقفة: ${usage.inactive_products}</span></div>`+
 `<nav class="partner-tabs">${[['products','الخدمات'],['categories','الأقسام'],...(role==='manager'||role==='admin'?[['banners','إعلانات F90 الخاصة بالأمين']]:[]),['settings','التواصل'],['media','الصور']].map(([key,title])=>`<button type="button" data-page="${key}" class="button ${page===key?'':'secondary'}">${title}</button>`).join('')}</nav>`;
 $('partnerSpace')?.addEventListener('change',async ev=>{space=spaces.find(s=>s.id===ev.target.value);await refresh();});
}
async function refresh(){await read();navigation();await render();}
function imageField(path){return `<label class="field"><span>الصورة (حتى 5 ميجابايت)</span><input name="image_file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>${path?`<img class="partner-thumb" src="${e(img(path))}" alt="الصورة الحالية">`:''}`;}
function editor(kind,row={}){
 const form=document.createElement('form');form.id='partnerEditor';form.dataset.id=row.id||'';form.dataset.kind=kind;
 form.innerHTML=`<h2>${row.id?'تعديل':'إضافة'} ${kind==='categories'?'قسم':kind==='products'?'خدمة':'إعلان'}</h2>`+
 field(kind==='banners'?'title':'name','الاسم',row.name||row.title||'','text','required maxlength="200"')+
 (kind==='products'?`<label class="field"><span>القسم</span><select name="category_id" required>${categories.map(c=>`<option value="${c.id}" ${row.category_id===c.id?'selected':''}>${e(c.name)}</option>`).join('')}</select></label>`+
 field('description','وصف الخدمة',row.description||'','text','maxlength="3000"')+
 `<div class="field-row">${field('price','السعر',row.price??'','number','required min="0.000001" step="0.000001"')}<label class="field"><span>العملة الخاصة بالخدمة</span><select name="currency">${[['USD','دولار'],['ILS','شيقل'],['JOD','دينار'],['EGP','جنيه'],['EUR','يورو']].map(([k,v])=>`<option value="${k}" ${(row.currency||'USD')===k?'selected':''}>${v}</option>`).join('')}</select></label></div>`+
 field('purchase_url','رابط شراء واتساب',row.purchase_url||'','url','required placeholder="https://wa.me/962..." dir="ltr"'):'')+
 (kind==='banners'?`<p class="notice">يظهر الإعلان ضمن شريط البنرات أسفل الإعلان الرئيسي فقط، ولا يمكن إضافته للسلايدر الرئيسي.</p><input type="hidden" name="placement" value="small">`+field('link_url','رابط الإعلان (اختياري)',row.link_url||'','url','dir="ltr"'):'')+
 imageField(row.image_path)+field('sort_order','الترتيب',row.sort_order||0,'number','required step="1"')+
 `<label class="check-field"><input name="is_active" type="checkbox" ${row.is_active!==false?'checked':''}>فعّال</label><div class="actions"><button class="button" type="submit">حفظ</button><button class="button secondary" type="button" data-cancel>إلغاء</button></div>`;
 main.replaceChildren(form);form.addEventListener('submit',ev=>save(ev,kind,row));form.querySelector('[data-cancel]').onclick=render;
}
async function render(){
 if(page==='settings'){
 main.innerHTML=`<form id="partnerSettings"><h2>روابط التواصل</h2>${['manager','admin'].includes(role)?field('name','اسم المساحة',space.name,'text','required maxlength="100"')+'<label class="check-field"><input name="is_active" type="checkbox" '+(space.is_active?'checked':'')+'>عرض المساحة للجمهور</label><h3>لوغو التعاون</h3>'+imageField(space.collaboration_image):''}<h3>تواصل مع الأمين كارد</h3><p>أضف رابطًا أو بريدًا أو رقمًا في كل سطر، بهذا الشكل: واتساب | https://wa.me/962...</p><label class="field"><span>روابط التواصل</span><textarea name="contacts" rows="8" maxlength="12000">${e((space.contacts||[]).map(x=>x.label+' | '+x.url).join('\n'))}</textarea></label><button class="button" type="submit">حفظ</button></form>`;
 $('partnerSettings').onsubmit=saveSettings;return;
 }
 if(page==='banners'&&!['manager','admin'].includes(role)){main.textContent='إدارة البنرات متاحة لمدير الموقع فقط';return;}
 if(page==='media'){
 const list=check(await db.storage.from('f90-partner-images').list(space.id,{limit:1000,sortBy:{column:'name',order:'asc'}}));
 main.innerHTML='<h2>إدارة صور الأمين كارد</h2><p>يمكن حذف الصورة حتى لو كانت مرتبطة بخدمة أو قسم أو بنر، وسيتم فصلها عنه بعد التأكيد.</p><div class="partner-media-grid">'+list.filter(x=>x.id).map(x=>`<article><img class="partner-thumb" src="${e(img(space.id+'/'+x.name))}" alt="صورة مرفوعة"><small>${(Number(x.metadata?.size||0)/1048576).toFixed(2)} MB</small><button type="button" class="button secondary" data-remove-image="${e(x.name)}">حذف الصورة</button></article>`).join('')+'</div>';return;
 }
 const rows={categories,products,banners}[page];
 main.innerHTML=`<div class="section-head"><h2>${{categories:'أقسام الأمين كارد',products:'خدمات الأمين كارد',banners:'إعلانات الأمين كارد'}[page]}</h2><button type="button" class="button" data-new>إضافة</button></div>`+
 (page==='products'&&!categories.length?'<p>أضف قسمًا أولًا، ثم أضف الخدمات داخله.</p>':'')+
 `<div class="records">${rows.map(row=>`<article class="record">${row.image_path?`<img class="partner-thumb" src="${e(img(row.image_path))}" alt="">`:''}<div class="record-main"><h3>${e(row.name||row.title||'إعلان')}</h3><p>${row.is_active?'فعّال':'متوقف'} · ترتيب ${row.sort_order}</p>${page==='products'?`<strong>${e(new Intl.NumberFormat('ar',{style:'currency',currency:row.currency,maximumFractionDigits:6}).format(row.price))}</strong>`:''}</div><button class="button secondary" type="button" data-edit="${row.id}">تعديل</button><button class="button secondary" type="button" data-toggle="${row.id}">${row.is_active?'إيقاف':'تفعيل'}</button><button class="button secondary" type="button" data-delete="${row.id}" style="color:#ff7b8f">حذف</button></article>`).join('')}</div>`;
}
async function upload(file){
 if(!file?.size)return null;
 const types={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
 if(!types[file.type]||file.size>5242880)throw new Error('اختر صورة صحيحة بحد أقصى 5 ميجابايت');
 usage=check(await db.rpc('f90_partner_usage',{p_space:space.id}));
 if(Number(usage.used_bytes)+file.size>usage.limit_bytes)throw new Error('وصلت إلى حد الصور 200 ميجابايت. أزل صورة غير مستخدمة أولًا.');
 const path=space.id+'/'+crypto.randomUUID()+'.'+types[file.type];
 check(await db.storage.from('f90-partner-images').upload(path,file,{contentType:file.type,upsert:false}));return path;
}
async function save(ev,kind,row){
 ev.preventDefault();if(busy)return;busy=true;const f=ev.target,button=f.querySelector('[type=submit]');button.disabled=true;let newImage;
 try{
 const d=Object.fromEntries(new FormData(f));const data={sort_order:Number(d.sort_order),is_active:f.elements.is_active.checked};
 if(kind==='banners')Object.assign(data,{title:d.title,placement:'small',link_url:d.link_url||''});else data.name=d.name;
 if(kind==='products'){
 if(!/^https:\/\/(?:wa\.me\/[1-9][0-9]{6,14}(?:\?text=\S*)?|api\.whatsapp\.com\/send\?phone=[1-9][0-9]{6,14}(?:&text=\S*)?)$/.test(d.purchase_url))throw new Error('استخدم رابط واتساب صحيحًا يبدأ بـ https://wa.me/');
 Object.assign(data,{category_id:d.category_id,description:d.description,currency:d.currency,price:Number(d.price),purchase_url:d.purchase_url});
 }
 newImage=await upload(f.elements.image_file.files[0]);data.image_path=newImage||row.image_path||null;
 if(kind==='banners'&&!data.image_path)throw new Error('صورة الإعلان مطلوبة');
 const r=row.id?await db.from(tables[kind]).update(data).eq('id',row.id).eq('space_id',space.id).select('id').single():await db.from(tables[kind]).insert({...data,space_id:space.id}).select('id').single();check(r);
 say('حُفظ التعديل');await refresh();
 }catch(err){if(newImage)await db.storage.from('f90-partner-images').remove([newImage]);say('لم تُحفظ الإضافة: '+err.message);}finally{busy=false;button.disabled=false;}
}
async function saveSettings(ev){
 ev.preventDefault();if(busy)return;busy=true;let newImage;const f=ev.target,button=f.querySelector('[type=submit]');button.disabled=true;
 try{
 const links=f.elements.contacts.value.split('\n').filter(x=>x.trim()).map(line=>{
 const parts=line.split('|');const label=parts.shift().trim(),raw=parts.join('|').trim();
 const url=/^\+?[0-9 ()-]{7,25}$/.test(raw)?'tel:'+raw.replace(/[ ()-]/g,''):/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)?'mailto:'+raw:raw;
 if(!label||!(/^(https:\/\/|mailto:|tel:)/.test(url))||/[\r\n]/.test(url))throw new Error('تحقق من تسمية وروابط التواصل');return {label:label.slice(0,80),url:url.slice(0,1200)};
 });if(links.length>30)throw new Error('الحد الأقصى 30 رابط تواصل');
 const isManager=['manager','admin'].includes(role);
 if(isManager)newImage=await upload(f.elements.image_file?.files[0]);
 const data=isManager?{name:f.elements.name.value,is_active:f.elements.is_active.checked,contacts:links,collaboration_image:newImage||space.collaboration_image}:{contacts:links};
 check(await db.from('f90_partner_spaces').update(data).eq('id',space.id).select('id').single());Object.assign(space,data);say('حُفظت إعدادات الأمين كارد');await refresh();
 }catch(err){if(newImage)await db.storage.from('f90-partner-images').remove([newImage]);say(err.message);}finally{busy=false;button.disabled=false;}
}
document.addEventListener('click',async ev=>{
 const button=ev.target.closest('button');if(!button||busy)return;
 try{
 if(button.dataset.page){page=button.dataset.page;navigation();await render();}
 else if(button.hasAttribute('data-new'))editor(page);
 else if(button.dataset.edit)editor(page,{categories,products,banners}[page].find(x=>x.id===button.dataset.edit));
 else if(button.dataset.toggle){const row={categories,products,banners}[page].find(x=>x.id===button.dataset.toggle);check(await db.from(tables[page]).update({is_active:!row.is_active}).eq('id',row.id).eq('space_id',space.id).select('id').single());await refresh();}
 else if(button.dataset.delete){
 const row={categories,products,banners}[page].find(x=>x.id===button.dataset.delete);
 if(!row)throw new Error('العنصر غير موجود');
 if(page==='categories'&&products.some(p=>p.category_id===row.id))throw new Error('انقل أو احذف خدمات هذا القسم أولاً');
 if(!window.confirm('حذف '+(row.name||row.title)+' نهائيًا؟ لن يتأثر أي قسم أو منتج في F90 CARD.'))return;
 busy=true;
 try{check(await db.from(tables[page]).delete().eq('id',row.id).eq('space_id',space.id).select('id').single());say('تم الحذف');await refresh();}
 finally{busy=false;}
 }
 else if(button.dataset.removeImage){
 const path=space.id+'/'+button.dataset.removeImage;
 if(role==='amin_card'&&(space.collaboration_image===path||banners.some(x=>x.image_path===path)))throw new Error('صور الإعلانات ولوغو التعاون تُدار بواسطة مدير الموقع فقط');
 const linked=space.collaboration_image===path||[...categories,...products,...banners].some(x=>x.image_path===path);
 if(!window.confirm(linked?'الصورة مستخدمة حاليًا. سيتم فصلها عن محتوى الأمين وحذفها. متابعة؟':'حذف الصورة نهائيًا؟'))return;
 busy=true;
 try{
 if(space.collaboration_image===path){check(await db.from('f90_partner_spaces').update({collaboration_image:null}).eq('id',space.id).select('id').single());space.collaboration_image=null;}
 for(const [kind,rows] of Object.entries({categories,products,banners})){for(const row of rows.filter(x=>x.image_path===path)){check(await db.from(tables[kind]).update({image_path:null}).eq('id',row.id).eq('space_id',space.id).select('id').single());}}
 check(await db.storage.from('f90-partner-images').remove([path]));say('تم حذف الصورة');await refresh();
 }finally{busy=false;}
 }
 }catch(err){say(err.message);}
});
try{
 if(!db)throw new Error('تعذّر تحميل اتصال المتجر');
 const session=check(await db.auth.getSession())?.session;
 if(!session){main.innerHTML='<p>سجّل الدخول إلى حسابك لفتح لوحة الأمين كارد.</p><a class="button" href="./#/auth">تسجيل الدخول</a>';return;}
 role=check(await db.from('f90_user_roles').select('role').eq('user_id',session.user.id).single()).role;
 if(!['manager','admin','amin_card'].includes(role))throw new Error('هذه اللوحة مخصصة للأمين كارد وإدارة المتجر');
 spaces=check(await db.from('f90_partner_spaces').select('*').order('created_at'));
 if(role==='amin_card')spaces=spaces.filter(s=>s.owner_id===session.user.id);
 if(!spaces.length){main.innerHTML='<p>لم تُسند رتبة الأمين كارد إلى حساب بعد. يستطيع المدير إسنادها من صفحة المستخدمين.</p>';return;}
 space=spaces[0];await refresh();
}catch(err){main.textContent=err.message;}
})();
