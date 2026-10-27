/* F90 CARD: manager-only issue, audit, and revoke single-use wallet credit codes.
 * All balances and permissions are enforced by Supabase transactional RPCs. */
(function(){
  "use strict";
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=v=>new Intl.NumberFormat("en-US",{maximumFractionDigits:6}).format(Number(v)||0);
  const client=()=>window.F90API?.client;
  async function rpc(name,args){
    const db=client();
    if(!db?.rpc)throw Error("اتصال Supabase غير متاح");
    const {data,error}=await db.rpc(name,args);
    if(error)throw new Error(({F90_FORBIDDEN:"هذه العملية للمدير فقط",F90_RECIPIENT_NOT_FOUND:"معرّف العميل غير موجود أو موقوف",F90_AMOUNT:"قيمة الكود غير صالحة",F90_CURRENCY:"العملة غير مفعّلة"})[error.message]||error.message);
    return data;
  }
  function status(row){
    return row.redeemed_at?"مستخدم":row.revoked_at?"ملغى":"غير مستخدم";
  }
  async function render(main,rates){
    main.innerHTML='<section class="panel f90-credit-admin"><h1>أكواد شحن الرصيد لمرة واحدة</h1><p class="muted">يمكن إصدار كود بالدولار أو بعملة مفعّلة. تُحفظ قيمته بالدولار عند الإصدار ولا تتأثر بتغيير الصرف لاحقًا. يعرض الكود مرة واحدة فقط لإرساله بأمان.</p>'+
      '<form id="f90IssueCreditCodeForm" class="f90-code-issue-form">'+
      '<label class="field"><span>قيمة الكود</span><input type="number" name="amount" min="0.000001" max="100000000" step="0.000001" required placeholder="مثال: 10"></label>'+
      '<label class="field"><span>عملة القيمة</span><select name="currency">'+(rates||[]).filter(x=>x.is_enabled&&!x.is_archived&&Number(x.per_usd)>0).map(r=>'<option value="'+esc(r.currency)+'">'+esc(r.name_ar||r.currency)+' ('+esc(r.currency)+')</option>').join("")+'</select></label>'+
      '<label class="field"><span>رقم العميل (اختياري)</span><input type="text" name="customer_id" maxlength="100" placeholder="اتركه فارغًا ليستخدمه أول عميل"></label>'+
      '<button class="button" type="submit">إنتاج كود جديد</button></form>'+
      '<div id="f90IssuedCreditCode" aria-live="polite"></div><h2>سجل الأكواد</h2>'+
      '<div id="f90CreditCodeList" role="status">جارٍ التحميل…</div></section>';
    await load();
  }
  async function load(){
    const host=document.getElementById("f90CreditCodeList");if(!host)return;
    try{
      const data=await rpc("f90_list_credit_codes",{});
      host.innerHTML='<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>القيمة</th><th>العميل المحدد</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>'+
        (Array.isArray(data)?data.map(c=>'<tr><td>'+esc(new Date(c.created_at).toLocaleString("ar"))+'</td><td>'+esc(money(c.face_value))+' '+esc(c.face_currency)+'<br><small>'+esc(money(c.amount_usd))+' USD</small></td><td>'+esc(c.recipient||"أي مستخدم")+'</td><td>'+esc(status(c))+(c.redeemed_by?'<br><small>'+esc(c.redeemed_by)+'</small>':"")+'</td><td>'+(c.redeemed_at||c.revoked_at?'—':'<button type="button" class="button secondary small" data-f90-credit-revoke="'+esc(c.id)+'">إلغاء الكود</button>')+'</td></tr>').join(""):'')+
        '</tbody></table></div>';
      if(!Array.isArray(data)||!data.length)host.textContent="لم تُصدر أكواد بعد.";
    }catch(err){host.textContent=err.message||"تعذّر قراءة الأكواد";}
  }
  document.addEventListener("submit",async ev=>{
    const form=ev.target;
    if(form.id!=="f90IssueCreditCodeForm")return;
    ev.preventDefault();ev.stopImmediatePropagation();
    if(form.dataset.busy)return;
    const output=document.getElementById("f90IssuedCreditCode"),button=form.querySelector("[type=submit]");
    form.dataset.busy="1";button.disabled=true;
    try{
      const value=Number(form.elements.amount.value);
      if(!Number.isFinite(value)||value<=0)throw Error("اكتب قيمة صحيحة");
      const result=await rpc("f90_issue_credit_code",{
        p_amount:value,p_currency:form.elements.currency.value,
        p_recipient_customer_id:form.elements.customer_id.value.trim()||null
      });
      output.innerHTML='<div class="notice"><strong>تم إصدار الكود. انسخه الآن، لن يظهر مرة ثانية.</strong><p dir="ltr" style="font-size:16px;font-weight:850;overflow-wrap:anywhere" id="f90NewCreditCode">'+esc(result.code)+'</p><button type="button" class="button secondary" data-f90-credit-copy="'+esc(result.code)+'">نسخ الكود</button><p>القيمة: '+esc(money(result.amount_usd))+' USD</p></div>';
      form.reset();await load();
    }catch(err){output.textContent=err.message||"تعذّر إصدار الكود";}
    finally{delete form.dataset.busy;button.disabled=false;}
  },true);
  document.addEventListener("click",async ev=>{
    const copy=ev.target.closest("[data-f90-credit-copy]");
    if(copy){ev.preventDefault();ev.stopImmediatePropagation();try{await navigator.clipboard.writeText(copy.dataset.f90CreditCopy);copy.textContent="تم النسخ";}catch{copy.textContent="حدد الكود وانسخه يدويًا";}return;}
    const cancel=ev.target.closest("[data-f90-credit-revoke]");
    if(!cancel)return;
    ev.preventDefault();ev.stopImmediatePropagation();
    if(!confirm("إلغاء هذا الكود غير المستخدم نهائيًا؟"))return;
    cancel.disabled=true;
    try{
      const ok=await rpc("f90_revoke_credit_code",{p_id:cancel.dataset.f90CreditRevoke});
      if(!ok)throw Error("الكود مستخدم أو ملغى بالفعل");
      await load();
    }catch(err){alert(err.message);cancel.disabled=false;}
  },true);
  window.F90CreditAdmin={render};
})();