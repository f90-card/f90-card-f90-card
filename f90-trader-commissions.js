(async function(){
'use strict';
const db=window.f90Supabase,A=window.F90API,C=window.F90Core,e=C.escapeHTML,$=id=>document.getElementById(id);
let me,users=[],catalog=[],saving=false;
function check(r){if(r.error)throw new Error(r.error.message);return r.data;}
function options(rows){return '<option value="">اختر الحساب</option>'+rows.map(u=>`<option value="${u.id}">${e(u.display_name)} · ${e(u.customer_id)} · ${e(u.email)}</option>`).join('');}
async function history(){
 const [c,d,r]=await Promise.all([db.from('f90_trader_commissions').select('*').order('created_at',{ascending:false}).limit(100),db.from('f90_trader_commission_debts').select('*'),db.from('f90_trader_referrals').select('*')]);
 const rows=check(c),debts=check(d),referrals=check(r);
 $('commissionMain').innerHTML=`<h2>العملاء والعمولات</h2><p>عملاء مرتبطون: ${referrals.length} · عمولات مسجلة: ${rows.length}</p>`+
 (debts.some(x=>Number(x.amount_usd)>0)?'<p class="notice">توجد عمولات معكوسة لطلبات مستردة. تُسوّى من العمولات القادمة قبل إضافة رصيد جديد.</p>':'')+
 `<div class="records">${rows.map(row=>`<article class="record"><div class="record-main"><strong>${e(row.account_currency?new Intl.NumberFormat('ar',{style:'currency',currency:row.account_currency,maximumFractionDigits:6}).format(row.amount_currency||0):C.money(row.earned_usd))}</strong><p>النسبة: ${e(row.percent)}٪ · ${row.last_error?'بانتظار ضبط سعر الصرف':row.revision?'تمت التسوية':'بانتظار اكتمال الشراء'}</p><small>${e(C.date(row.created_at))}</small></div></article>`).join('')||'<p>لا توجد عمولات بعد. تُحتسب للمشتريات الجديدة بعد ربط العميل، وتُضاف بعد اكتمال التنفيذ.</p>'}</div>`+
 (me.role==='manager'?`<h3>الارتباطات الحالية</h3><div class="records">${referrals.map(r=>`<article class="record"><div class="record-main"><strong>${e(users.find(u=>u.id===r.customer_id)?.display_name||r.customer_id)}</strong><p>التاجر: ${e(users.find(u=>u.id===r.trader_id)?.display_name||r.trader_id)} · ${e(r.percent)}٪ · ${r.product_ids.length?'خدمات محددة':'جميع الخدمات'}</p></div><button class="button secondary" data-referral="${r.customer_id}">تعديل</button></article>`).join('')}</div>`:'');
 $('commissionMain').querySelectorAll('[data-referral]').forEach(b=>b.onclick=()=>{
 const r=referrals.find(x=>x.customer_id===b.dataset.referral);const f=$('referralForm');
 for(const [name,id] of [['customer_id',r.customer_id],['trader_id',r.trader_id]]){
 const sel=f.elements[name];if(![...sel.options].some(x=>x.value===id)){const option=document.createElement('option');option.value=id;option.textContent=users.find(u=>u.id===id)?.display_name||id;sel.append(option);}sel.value=id;
 }
 f.elements.percent.value=r.percent;for(const o of f.elements.product_ids.options)o.selected=r.product_ids.includes(o.value);f.scrollIntoView({behavior:'smooth'});
 });
}
function manager(){
 $('commissionManager').innerHTML=`<form id="referralForm"><h2>ربط عميل بتاجر</h2><p>تسري النسبة على المشتريات الجديدة للخدمات المختارة بعد الحفظ. نسبة صفر توقف العمولات الجديدة. لا يتغير سعر العميل.</p><div class="field-row"><label class="field"><span>بحث العميل بالاسم أو البريد أو رقم العميل</span><input id="referralCustomerSearch" type="search"><button class="button secondary" type="button" data-search="customer">بحث</button><select name="customer_id" required>${options(users)}</select></label><label class="field"><span>بحث التاجر</span><input id="referralTraderSearch" type="search"><button class="button secondary" type="button" data-search="trader">بحث</button><select name="trader_id" required>${options(users.filter(u=>u.role==='trader'))}</select></label></div><label class="field"><span>نسبة العمولة من قيمة الشراء بعد الاسترداد (%)</span><input name="percent" type="number" required min="0" max="100" step="0.0001"></label><label class="field"><span>الخدمات المشمولة (بدون اختيار = جميع الخدمات)</span><select name="product_ids" multiple size="8">${catalog.map(p=>`<option value="${p.id}">${e(p.name)}</option>`).join('')}</select></label><button class="button" type="submit">حفظ ارتباط العميل</button></form>`;
 const f=$('referralForm');f.onsubmit=async ev=>{
 ev.preventDefault();if(saving)return;saving=true;const button=f.querySelector('[type=submit]');button.disabled=true;
 try{check(await db.rpc('f90_set_trader_referral',{p_customer:f.elements.customer_id.value,p_trader:f.elements.trader_id.value,p_percent:Number(f.elements.percent.value),p_products:[...f.elements.product_ids.selectedOptions].map(x=>x.value)}));$('commissionMessage').textContent='حُفظ الارتباط. يبدأ احتساب العمولات للمشتريات الجديدة فقط.';await history();}catch(err){$('commissionMessage').textContent=err.message;}finally{saving=false;button.disabled=false;}
 };
 f.querySelectorAll('[data-search]').forEach(button=>button.onclick=async()=>{
 button.disabled=true;try{const trader=button.dataset.search==='trader',search=$(trader?'referralTraderSearch':'referralCustomerSearch').value;const r=await A.call('staff.list',{kind:'users',search,offset:0});const rows=trader?r.items.filter(u=>u.role==='trader'):r.items;for(const row of r.items)if(!users.some(u=>u.id===row.id))users.push(row);f.elements[trader?'trader_id':'customer_id'].innerHTML=options(rows);}catch(err){$('commissionMessage').textContent=err.message;}finally{button.disabled=false;}
 });
}
try{
 me=await A.call('me');if(!['manager','trader'].includes(me.role))throw new Error('هذه الصفحة مخصصة للتجار والمدير');
 if(me.role==='manager'){
 const [u,c]=await Promise.all([A.call('staff.list',{kind:'users',offset:0}),db.from('products').select('id,name').eq('is_active',true).order('name').limit(1000)]);users=u.items;catalog=check(c);manager();
 }
 await history();
}catch(err){$('commissionMain').textContent=err.message;}
})();
