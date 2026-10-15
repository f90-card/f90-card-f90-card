/* F90 CARD financial controls: supplier FX, fee, provider margin and extra per-category/product margin. */
(function(){
"use strict";
const e=x=>String(x??"").replace(/[&<>"']/g,k=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[k]));
const val=x=>{const n=Number(x);return Number.isFinite(n)?n:0};
const fld=(caption,value,limit=100)=>'<label class="field"><span>'+caption+'</span><input type="number" name="amount" min="0" max="'+limit+'" step="0.01" inputmode="decimal" value="'+e(value)+'" required></label>';
const state={cats:[],products:[],provider:null,root:null};
const say=(form,msg)=>{const el=form.querySelector("[data-feedback]");if(el)el.textContent=msg};
async function render(root){
 state.root=root;
 root.innerHTML='<div class="page-head"><h1>التسعير والأرباح</h1><p>جارٍ تحميل إعدادات المورد وهامش الأقسام والخدمات…</p></div>';
 const client=window.F90API?.client;
 const [suppliers,cats,products]=await Promise.all([
 window.F90API.call("staff.providers"),
 client.from("categories").select("id,name,presentation,parent_id").order("name").limit(1000),
 client.from("products").select("id,name,category_id,commerce,price").order("name").limit(1500)
 ]);
 if(cats.error||products.error)throw new Error(cats.error?.message||products.error?.message||"تعذر قراءة الأسعار");
 state.cats=cats.data||[];state.products=products.data||[];
 state.provider=(suppliers||[]).find(x=>x.adapter==="yassen"&&!x.config?.archived_at);
 const provider=state.provider;
 if(!provider)throw new Error("لم يتم العثور على مورد ياسين كارد");
 const input=(name,label,value,limit=1000)=>'<label class="field"><span>'+label+'</span><input type="number" name="'+name+'" value="'+e(value)+'" min="0" max="'+limit+'" step="0.01" required></label>';
 const categoryRows=state.cats.map(c=>'<article class="f90-pricing-item" data-label="'+e(c.name.toLowerCase())+'"><strong>'+e(c.name)+'</strong><form class="f90-margin-change" data-kind="category" data-id="'+e(c.id)+'">'+fld("زيادة هامش القسم ٪",val(c.presentation?.extra_margin_percent))+'<button type="submit" class="button secondary small">حفظ</button><small data-feedback role="status"></small></form></article>').join("");
 const productRows=state.products.map(p=>'<article class="f90-pricing-item" data-label="'+e(p.name.toLowerCase())+'"><strong>'+e(p.name)+'</strong><small>سعر البيع الحالي: '+e(val(p.price).toFixed(2))+' دولار</small><form class="f90-margin-change" data-kind="product" data-id="'+e(p.id)+'">'+fld("زيادة هامش الخدمة ٪",val(p.commerce?.extra_margin_percent))+'<button type="submit" class="button secondary small">حفظ</button><small data-feedback role="status"></small></form></article>').join("");
 root.innerHTML='<div class="page-head"><div><h1>الأسعار وهوامش الربح</h1><p>سعر المورد مستقل عن عملة العملاء. التغيير يؤثر على الأسعار المستقبلية فقط، ولا يغيّر عمليات الشراء السابقة أو رصيد المحفظة.</p></div></div>'+
 '<section class="panel"><h2>ياسين كارد</h2><p>التكلفة المعتمدة: 100 دولار من المورد = 320 شيقل. سعر عرض العملاء = 335 شيقل لكل 100 دولار (من صفحة العملات).</p>'+
 '<form id="f90SupplierPriceForm" data-id="'+e(provider.id)+'"><div class="field-row">'+
 input("fx","سعر المورد شيقل لكل دولار",provider.config?.supplier_ils_per_usd??3.20)+
 input("fee","عمولة المورد ٪",provider.config?.supplier_commission_percent??0,50)+
 input("margin","هامش المتجر الأساسي ٪",provider.margin_percent??13,100)+
 '</div><button class="button" type="submit">حفظ التسعير وتحديث الخدمات</button><p data-feedback role="status"></p></form></section>'+
 '<section class="panel"><h2>هوامش إضافية للأقسام</h2><p class="muted">هامش القسم يُضاف إلى الهامش الأساسي وينطبق على الخدمات داخل القسم وأقسامه الفرعية.</p>'+
 '<input type="search" class="f90-pricing-filter" data-target="f90MarginCategories" placeholder="بحث عن قسم…" aria-label="بحث عن قسم"><div id="f90MarginCategories" class="f90-pricing-entries">'+categoryRows+'</div></section>'+
 '<section class="panel"><h2>هوامش إضافية للخدمات</h2><input type="search" class="f90-pricing-filter" data-target="f90MarginProducts" placeholder="بحث عن خدمة…" aria-label="بحث عن خدمة"><div id="f90MarginProducts" class="f90-pricing-entries">'+productRows+'</div></section>';
}
document.addEventListener("input",event=>{
 const filter=event.target.closest?.(".f90-pricing-filter");if(!filter)return;
 const rows=document.getElementById(filter.dataset.target)?.querySelectorAll(".f90-pricing-item")||[];
 const q=filter.value.trim().toLowerCase();
 rows.forEach(row=>{row.hidden=!!q&&!row.dataset.label.includes(q)});
});
document.addEventListener("submit",async event=>{
 const form=event.target;
 if(form.id!=="f90SupplierPriceForm"&&!form.matches(".f90-margin-change"))return;
 event.preventDefault();
 if(form.dataset.busy)return;
 const numbers={};
 for(const element of form.querySelectorAll("input[type=number]")){
   const n=Number(element.value);
   if(!Number.isFinite(n)||n<0||n>Number(element.max||1000)){say(form,"قيمة غير صالحة");return;}
   numbers[element.name]=n;
 }
 if(form.id==="f90SupplierPriceForm"&&(!numbers.fx||numbers.fx>1000))return say(form,"سعر المورد يجب أن يكون أكبر من صفر");
 if(!window.confirm("تأكيد إعادة تسعير الخدمات القادمة؟ أسعار الطلبات السابقة لن تتغير."))return;
 form.dataset.busy="1";const btn=form.querySelector("button");btn.disabled=true;say(form,"جارٍ الحساب والحفظ على الخادم…");
 try {
 const params=form.id==="f90SupplierPriceForm"?
  {p_provider:form.dataset.id,p_fx:numbers.fx,p_commission:numbers.fee,p_margin:numbers.margin}:
  {p_kind:form.dataset.kind,p_id:form.dataset.id,p_percent:numbers.amount};
 const fn=form.id==="f90SupplierPriceForm"?"f90_manager_supplier_pricing":"f90_manager_extra_margin";
 const {data,error}=await window.F90API.client.rpc(fn,params);
 if(error)throw error;
 say(form,"تم الحفظ وإعادة تسعير "+Number(data||0)+" خدمة. حدّث صفحة المنتجات لمراجعة الأسعار.");
 }catch(err){say(form,"تعذر تحديث التسعير: "+String(err?.message||"خطأ"))}
 finally{btn.disabled=false;delete form.dataset.busy}
});
window.F90PricingAdmin={render};
})();