(function () {
  "use strict";

  // Separate F90 agents module. Does not modify or depend on wallet/catalog state.
  var TABLE = "f90_store_agents";
  var editingId = "";
  var adminRows = [];
  var boundAdminRoot = null;

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
    });
  }
  function client() {
    return window.F90API && window.F90API.client;
  }
  function numberForDial(phone) {
    var normalized = String(phone || "").trim().replace(/[\s().-]+/g, "");
    return /^\+?[0-9]{7,15}$/.test(normalized) ? normalized : "";
  }
  function userFacingError(error) {
    if (error && (error.code === "42501" || error.status === 403))
      return "لا تملك صلاحية تعديل الوكلاء. سجّل الدخول بحساب مدير مخوّل.";
    if (error && error.code === "23514")
      return "تحقق من طول الاسم أو الهاتف أو الموقع.";
    return "تعذّر إكمال العملية. تحقق من الاتصال وصلاحيات حساب الإدارة وحاول مجددًا.";
  }
  function statusMessage(root, value, type) {
    var el = root.querySelector("#f90AgentStatus");
    if (!el) return;
    el.textContent = value;
    el.className = "f90-agent-status" + (type === "error" ? " f90-agent-error" : "");
    el.hidden = !value;
  }
  function card(row) {
    var name = escapeHTML(row.name);
    var location = escapeHTML(row.location);
    var phone = escapeHTML(row.phone);
    var dial = numberForDial(row.phone);
    var mapLink = "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(String(row.location || "").trim());
    return '<article class="f90-agent-card">' +
      '<div class="f90-agent-avatar" aria-hidden="true">' +
      '<span class="f90-agent-avatar-text">F90</span></div>' +
      '<div class="f90-agent-details"><span class="f90-agent-role">وكيل F90 CARD</span>' +
      '<h3>' + name + '</h3>' +
      '<p class="f90-agent-location"><span aria-hidden="true">⌖</span> ' + location + '</p>' +
      '<p class="f90-agent-phone" dir="ltr">' + phone + '</p>' +
      '<div class="f90-agent-actions">' +
      (dial ? '<a class="button small" href="tel:' + escapeHTML(dial) + '">اتصال بالوكيل</a>' : '') +
      '<a class="button secondary small" href="' + escapeHTML(mapLink) +
      '" target="_blank" rel="noopener noreferrer">عرض الموقع على الخريطة</a>' +
      '</div></div></article>';
  }

  async function publicPage(root) {
    root.innerHTML = '<section class="f90-agent-hero">' +
      '<div class="f90-agent-hero-copy"><span class="eyebrow">F90 CARD · أف تسعين كارد</span>' +
      '<h1>وكلاؤنا</h1><p>تعرّف على وكلاء متجر أف تسعين كارد المعتمدين وطرق التواصل معهم حسب المنطقة.</p>' +
      '<a class="button secondary small" href="#/support">تواصل مع إدارة المتجر</a></div>' +
      '<img src="./f90-logo.png" alt="شعار F90 CARD" loading="eager" decoding="async"></section>' +
      '<section class="f90-agent-section"><div class="section-head"><h2>دليل الوكلاء</h2>' +
      '<span>معلومات الاتصال المنشورة من إدارة المتجر</span></div>' +
      '<div id="f90AgentDirectory" class="f90-agent-grid" aria-live="polite">' +
      '<p class="muted">جارٍ تحميل قائمة الوكلاء…</p></div></section>';
    var target = root.querySelector("#f90AgentDirectory");
    if (!client()) {
      target.innerHTML = '<p class="notice error">تعذّر الاتصال بالمتجر. أعد تحميل الصفحة.</p>';
      return;
    }
    try {
      var result = await client().from(TABLE)
        .select("id,name,phone,location,sort_order")
        .eq("is_active", true)
        .order("sort_order", {ascending:true})
        .order("created_at", {ascending:true})
        .limit(200);
      if (!target.isConnected) return;
      if (result.error) throw result.error;
      var rows = result.data || [];
      target.innerHTML = rows.length ? rows.map(card).join("") :
        '<div class="f90-agent-empty"><h3>لا يوجد وكلاء منشورون حاليًا</h3>' +
        '<p class="muted">ستظهر هنا معلومات الوكلاء عندما تضيفهم إدارة المتجر.</p>' +
        '<a class="button secondary" href="#/support">الدعم الفني</a></div>';
    } catch (error) {
      if (target.isConnected)
        target.innerHTML = '<div class="notice error">تعذّر تحميل الوكلاء. حاول مرة أخرى.</div>' +
          '<button type="button" class="button secondary f90-agent-retry">إعادة المحاولة</button>';
      var retry = target.querySelector(".f90-agent-retry");
      if (retry) retry.addEventListener("click", function () { publicPage(root); }, {once:true});
    }
  }

  function editorMarkup() {
    var found = adminRows.find(function (r) { return r.id === editingId; });
    var row = found || {name:"",phone:"",location:"",sort_order:0,is_active:true};
    return '<section class="panel f90-agent-editor" id="f90AgentEditorSection">' +
      '<h2>' + (found ? "تعديل الوكيل" : "إضافة وكيل جديد") + '</h2>' +
      '<p class="muted small">سيظهر الاسم والهاتف والموقع للزوار عند تفعيل الوكيل. تأكد من موافقته على نشر بيانات الاتصال.</p>' +
      '<form id="f90AgentEditor" data-agent-id="' + escapeHTML(found ? found.id : "") + '">' +
      '<div class="f90-agent-fields">' +
      '<label class="field"><span>اسم الوكيل</span><input name="name" maxlength="100" minlength="2" required ' +
      'autocomplete="off" value="' + escapeHTML(row.name) + '" placeholder="اسم الوكيل المعتمد"></label>' +
      '<label class="field"><span>رقم الهاتف (يفضّل مع رمز الدولة)</span>' +
      '<input name="phone" type="tel" dir="ltr" maxlength="32" minlength="7" required ' +
      'value="' + escapeHTML(row.phone) + '" placeholder="+970..."></label>' +
      '<label class="field"><span>موقع الوكيل (المدينة أو العنوان)</span>' +
      '<input name="location" maxlength="160" minlength="2" required ' +
      'value="' + escapeHTML(row.location) + '" placeholder="مثال: رام الله، فلسطين"></label>' +
      '<label class="field"><span>ترتيب الظهور</span><input name="sort_order" type="number" min="0" max="1000000" ' +
      'step="1" required value="' + escapeHTML(row.sort_order) + '"></label></div>' +
      '<label class="check-field"><input type="checkbox" name="is_active"' +
      (row.is_active ? ' checked' : '') + '> إظهار الوكيل للزوار</label>' +
      '<div class="f90-agent-editor-actions"><button class="button" type="submit">' +
      (found ? 'حفظ التعديلات' : 'إضافة الوكيل') + '</button>' +
      (found ? '<button class="button secondary" type="button" data-agent-action="cancel">إلغاء التعديل</button>' : '') +
      '</div></form></section>';
  }
  function rowMarkup(row) {
    return '<article class="f90-agent-admin-row">' +
      '<div><strong>' + escapeHTML(row.name) + '</strong>' +
      '<p class="muted small">' + escapeHTML(row.location) + ' · <bdi>' + escapeHTML(row.phone) +
      '</bdi></p><span class="f90-agent-visibility">' +
      (row.is_active ? "ظاهر للزوار" : "مخفي عن الزوار") + '</span></div>' +
      '<div class="f90-agent-row-actions">' +
      '<button class="button secondary small" type="button" data-agent-action="edit" data-id="' +
      escapeHTML(row.id) + '">تعديل</button>' +
      '<button class="button secondary small" type="button" data-agent-action="toggle" data-id="' +
      escapeHTML(row.id) + '">' + (row.is_active ? 'إخفاء' : 'إظهار') + '</button>' +
      '<button class="button ghost small" type="button" data-agent-action="delete" data-id="' +
      escapeHTML(row.id) + '">حذف</button></div></article>';
  }
  function bindAdmin(root) {
    if (boundAdminRoot === root) return;
    boundAdminRoot = root;
    root.addEventListener("submit", async function (event) {
      var form = event.target;
      if (!form || form.id !== "f90AgentEditor") return;
      event.preventDefault();
      event.stopPropagation();
      if (form.dataset.busy) return;
      form.dataset.busy = "1";
      var saveButton = form.querySelector('[type="submit"]');
      if (saveButton) saveButton.disabled = true;
      try {
        var payload = {
          name: form.elements.name.value.trim(),
          phone: form.elements.phone.value.trim(),
          location: form.elements.location.value.trim(),
          sort_order: Number(form.elements.sort_order.value),
          is_active: form.elements.is_active.checked,
          updated_at: new Date().toISOString()
        };
        if (payload.name.length < 2 || payload.name.length > 100 ||
            payload.phone.length < 7 || payload.phone.length > 32 ||
            payload.location.length < 2 || payload.location.length > 160 ||
            !Number.isInteger(payload.sort_order) || payload.sort_order < 0 ||
            payload.sort_order > 1000000)
          throw new Error("أدخل اسمًا وهاتفًا وموقعًا صحيحين، وترتيبًا بين 0 و1000000.");
        var query = form.dataset.agentId ?
          client().from(TABLE).update(payload).eq("id", form.dataset.agentId).select("id") :
          client().from(TABLE).insert(payload).select("id");
        var result = await query;
        if (result.error) throw result.error;
        if (!result.data || !result.data.length)
          throw new Error("لم يتم حفظ الوكيل. تحقق من الصلاحيات.");
        editingId = "";
        await adminPage(root);
        statusMessage(root, "تم حفظ الوكيل بنجاح.", "success");
      } catch (error) {
        statusMessage(root, error.message && /^(أدخل|لم يتم)/.test(error.message) ?
          error.message : userFacingError(error), "error");
      } finally {
        delete form.dataset.busy;
        if (saveButton && saveButton.isConnected) saveButton.disabled = false;
      }
    });
    root.addEventListener("click", async function (event) {
      var button = event.target.closest("[data-agent-action]");
      if (!button || !button.closest("#f90AgentAdmin")) return;
      var action = button.dataset.agentAction;
      var row = adminRows.find(function (r) { return r.id === button.dataset.id; });
      if (action === "edit" && row) {
        editingId = row.id;
        await adminPage(root);
        root.querySelector("#f90AgentEditorSection")?.scrollIntoView({block:"start"});
        return;
      }
      if (action === "cancel") {
        editingId = "";
        await adminPage(root);
        return;
      }
      if (!row || (action !== "toggle" && action !== "delete")) return;
      if (action === "delete" && !confirm('تأكيد حذف الوكيل "' + row.name + '" نهائيًا؟')) return;
      button.disabled = true;
      try {
        var result = action === "delete" ?
          await client().from(TABLE).delete().eq("id", row.id).select("id") :
          await client().from(TABLE).update({is_active:!row.is_active,updated_at:new Date().toISOString()})
            .eq("id", row.id).select("id");
        if (result.error) throw result.error;
        if (!result.data || !result.data.length)
          throw new Error("لم يتم تغيير بيانات الوكيل. تحقق من الصلاحيات.");
        if (editingId === row.id) editingId = "";
        await adminPage(root);
        statusMessage(root, action === "delete" ? "تم حذف الوكيل." : "تم تغيير حالة ظهور الوكيل.", "success");
      } catch (error) {
        statusMessage(root, error.message && error.message.startsWith("لم يتم") ?
          error.message : userFacingError(error), "error");
      } finally { if (button.isConnected) button.disabled = false; }
    });
  }
  async function adminPage(root) {
    bindAdmin(root);
    root.innerHTML = '<div id="f90AgentAdmin" class="f90-agents-admin">' +
      '<div class="page-head"><div><div class="eyebrow">مركز إدارة أف تسعين</div>' +
      '<h1>إدارة وكلائنا</h1><p>إضافة الوكلاء وتحديث أرقامهم ومواقعهم وإخفاؤهم أو حذفهم.</p></div>' +
      '<div class="actions"><a class="button secondary small" href="./index.html#/agents" target="_blank" rel="noopener noreferrer">عرض صفحة الوكلاء</a></div></div>' +
      '<p id="f90AgentStatus" class="f90-agent-status" role="status" hidden></p>' +
      '<div id="f90AgentAdminBody" class="loading">جارٍ تحميل الوكلاء…</div></div>';
    var target = root.querySelector("#f90AgentAdminBody");
    if (!client()) {
      target.textContent = "تعذّر الاتصال بالمتجر.";
      return;
    }
    try {
      var result = await client().from(TABLE).select("id,name,phone,location,is_active,sort_order,created_at")
        .order("sort_order", {ascending:true}).order("created_at", {ascending:true}).limit(500);
      if (!target.isConnected) return;
      if (result.error) throw result.error;
      adminRows = result.data || [];
      target.classList.remove("loading");
      target.innerHTML = editorMarkup() + '<section class="panel f90-agent-admin-list">' +
        '<h2>الوكلاء (' + adminRows.length + ')</h2>' +
        (adminRows.length ? '<div class="f90-agent-row-list">' + adminRows.map(rowMarkup).join("") +
        '</div>' : '<p class="muted">لا يوجد وكلاء بعد. أضف أول وكيل من النموذج أعلاه.</p>') +
        '</section>';
    } catch (error) {
      if (target.isConnected) {
        target.classList.remove("loading");
        target.innerHTML = '<div class="notice error">تعذّر تحميل الوكلاء. تحقق من صلاحيات الحساب أو الاتصال.</div>' +
          '<button class="button secondary" type="button" id="f90AgentRetryAdmin">إعادة المحاولة</button>';
        target.querySelector("#f90AgentRetryAdmin")?.addEventListener("click",
          function () { adminPage(root); }, {once:true});
      }
    }
  }

  window.F90Agents = {publicPage:publicPage,adminPage:adminPage};
})();
