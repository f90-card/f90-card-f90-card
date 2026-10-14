(function () {
  "use strict";
  const C = window.F90Core,
    A = window.F90API,
    e = C.escapeHTML,
    I = C.icon,
    $ = (id) => document.getElementById(id),
    main = $("adminMain");
  const S = {
    me: null,
    settings: { config: {} },
    categories: [],
    products: [],
    banners: [],
    internal: [],
    providers: [],
    rates: [],
    vip: [],
    offset: 0,
    list: [],
    count: 0,
    filter: "",
    search: "",
    ledgerFilter: { ledger_kind: "", customer_id: "", from: "", to: "" },
    month: new Date().toISOString().slice(0, 7),
    active: "dashboard",
    edit: null,
    kind: null,
    token: 0,
  };
  const sections = [
    ["dashboard", "نظرة عامة", "chart", ["manager", "admin"]],
    ["alerts", "تنبيهات الإدارة", "bell", ["manager", "admin", "support"]],
    ["orders", "إدارة الطلبات", "clock", ["manager", "admin", "support"]],
    ["order-requests", "الاعتراضات والإلغاء", "bell", ["manager", "admin", "support"]],
    ["deposits", "طلبات الإيداع", "wallet", ["manager", "admin"]],
    ["verification", "توثيق الهوية", "shield", ["manager", "admin"]],
    ["ledger", "السجل المالي", "wallet", ["manager", "admin"]],
    ["users", "إدارة المستخدمين", "user", ["manager"]],
    ["traders", "التجار ومفاتيح API", "link", ["manager"]],
    ["leaderboard", "المتصدرون والتقارير", "crown", ["manager", "admin"]],
    ["categories", "الأقسام", "grid", ["manager", "designer"]],
    ["products", "المنتجات", "grid", ["manager", "designer"]],
    ["banners", "الإعلانات", "bell", ["manager", "designer"]],
    ["providers", "المورّدون والربط", "link", ["manager"]],
    ["integration", "مركز الربط والبروتوكولات", "link", ["manager"]],
    ["infrastructure", "الخوادم والمراقبة", "chart", ["manager"]],
    ["design-center", "التحكم المرئي في الموقع", "edit", ["manager"]],
    ["payments", "طرق الإيداع", "wallet", ["manager"]],
    ["rates", "العملات والصرف", "chart", ["manager"]],
    ["vip", "مستويات التميّز", "crown", ["manager"]],
    ["promotions", "الشريط الإعلاني", "bell", ["manager"]],
    ["notifications", "إشعارات المتجر", "bell", ["manager"]],
    ["policies", "المعلومات والسياسات", "doc", ["manager"]],
    ["settings", "الهوية والإعدادات", "edit", ["manager"]],
    ["audit", "سجل الإدارة", "shield", ["manager"]],
  ];
  const titles = {
    orders: "إدارة الطلبات",
    deposits: "طلبات الإيداع",
    verification: "توثيق الهوية",
    ledger: "السجل المالي",
    users: "إدارة المستخدمين",
    audit: "سجل الإدارة",
  };
  const library = [
    ["games", "الألعاب"],
    ["apps", "شحن التطبيقات"],
    ["streaming", "اشتراكات المشاهدة"],
    ["ai", "الذكاء الاصطناعي"],
    ["social", "السوشيال ميديا"],
    ["cards", "البطاقات الرقمية"],
    ["mobile", "أرصدة الجوال"],
    ["payments", "طرق الدفع"],
    ["services", "خدمات الموقع"],
    ["hero", "إعلان أف تسعين"],
  ];
  let toastTimer, dragId, alertsTimer;
  const manager = () => S.me?.role === "manager";
  const field = (name, label, type = "text", value = "", attrs = "") =>
    `<label class="field"><span>${label}</span>${type === "textarea" ? `<textarea name="${e(name)}" ${attrs}>${e(value)}</textarea>` : `<input name="${e(name)}" type="${type}" value="${e(value)}" ${attrs}>`}</label>`;
  const select = (name, label, options, value) =>
    `<label class="field"><span>${label}</span><select name="${e(name)}">${options.map(([v, t]) => `<option value="${e(v)}" ${String(value) === String(v) ? "selected" : ""}>${e(t)}</option>`).join("")}</select></label>`;
  const check = (name, label, value) =>
    `<label class="check-field"><input type="checkbox" name="${e(name)}" ${value ? "checked" : ""}>${label}</label>`;
  const head = (title, lead = "", actions = "") =>
    `<div class="page-head"><div><div class="eyebrow">مركز إدارة أف تسعين</div><h1>${e(title)}</h1><p>${e(lead)}</p></div><div class="actions">${actions}</div></div>`;
  const image = (src, alt = "", cls = "") =>
    C.safeUrl(src)
      ? `<img src="${e(C.safeUrl(src))}" alt="${e(alt)}" class="${cls}" loading="lazy">`
      : `<span class="${cls} image-placeholder">${I("grid")}</span>`;
  const status = (s) =>
    `<span class="badge status-${e(s)}">${e(C.statuses[s] || s)}</span>`;
  const customer = (p) =>
    `<div class="user-cell"><span class="avatar">${p?.avatar_url ? image(p.avatar_url, p.display_name) : I("user")}</span><div><strong>${e(p?.display_name || "عميل")}</strong><small>${e(p?.customer_id || "")}</small></div></div>`;
  const empty = (t) => `<div class="empty">${I("grid")}<p>${e(t)}</p></div>`;
  function toast(t) {
    $("toast").textContent = t;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 5000);
  }
  function errorMessage(err) {
    const message = String(err?.message || "تعذّر إكمال العملية");
    const code = err?.code ? " (" + String(err.code).slice(0, 60) + ")" : "";
    return message.slice(0, 280) + code;
  }
  function modal(title, body) {
    $("modalRoot").innerHTML =
      `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>${e(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="إغلاق">${I("close")}</button></div>${body}</section></div>`;
    document.body.style.overflow = "hidden";
    $("modalRoot").querySelector("input,button")?.focus();
  }
  function closeModal() {
    S.priceSyncPreview = null;
    S.pendingProviderImport = null;
    $("modalRoot").innerHTML = "";
    document.body.style.overflow = "";
  }
  function brand() {
    const c = S.settings.config || {};
    $("adminBrand").className =
      "brand " +
      (c.logo_fit === "contain" ? "brand-contain " : "") +
      (c.logo_motion ? "motion" : "");
    $("adminBrand").style.setProperty(
      "--logo-x",
      Math.max(-100, Math.min(100, Number(c.logo_x) || 0)) + "px",
    );
    $("adminBrand").style.setProperty(
      "--logo-y",
      Math.max(-100, Math.min(100, Number(c.logo_y) || 0)) + "px",
    );
    $("adminFavicon").href =
      C.safeUrl(c.app_icon_url || S.settings.logo_url) || "./f90-logo.png";
    $("adminBrand").innerHTML = image(
      S.settings.logo_url || "./f90-logo.png",
      "أف تسعين كارد",
    );
    $("adminIdentity").textContent =
      `${S.me?.profile.display_name || ""} · ${C.roles[S.me?.role] || ""}`;
  }
  function navigation() {
    const allowed = sections.filter((s) => s[3].includes(S.me.role));
    $("adminNav").innerHTML = allowed
      .map(
        ([id, n, i]) =>
          `<a href="#/${id}" class="${S.active === id ? "active" : ""}">${I(i)}${n}</a>`,
      )
      .join("");
  }
  async function catalogs() {
    const data = await A.call("staff.catalog");
    Object.assign(S, data);
  }
  async function refreshSettings() {
    const data = await A.call("catalog");
    S.settings = data.settings;
    S.rates = data.rates;
    S.vip = data.vip;
  }
  function permissions() {
    main.innerHTML = head(
      "الوصول غير متاح",
      "هذه الصفحة متاحة لصلاحيات محددة داخل المتجر.",
    );
  }
  function pagination() {
    return `<div class="pagination"><button class="button secondary small" data-action="prev" ${S.offset === 0 ? "disabled" : ""}>السابق</button><span class="muted small">${e(S.offset + 1)}–${e(Math.min(S.offset + 50, S.count))} من ${e(S.count)}</span><button class="button secondary small" data-action="next" ${S.offset + 50 >= S.count ? "disabled" : ""}>التالي</button></div>`;
  }
  async function refreshAdminAlerts() {
    if (!S.me || S.me.needs_mfa) return;
    const r = await A.call("staff.alerts");
    S.alerts = r;
    const count = Number(r.orders || 0) + Number(r.requests || 0) +
      (S.me.role === "support" ? 0 : Number(r.deposits || 0) + Number(r.verification || 0));
    const badge = $("adminBellCount");
    badge.hidden = !count;
    badge.textContent = count > 99 ? "99+" : String(count);
    return r;
  }
  async function alertsPage() {
    const r = await refreshAdminAlerts();
    if (!r) return;
    const cards = [
      ["orders", "طلبات قيد المتابعة", r.orders, true],
      ["order-requests", "اعتراضات وطلبات إلغاء", r.requests, true],
      ["deposits", "إيداعات تنتظر المراجعة", r.deposits, S.me.role !== "support"],
      ["verification", "طلبات توثيق الهوية", r.verification, S.me.role !== "support"],
      ["users", "مستخدمون جدد خلال ٢٤ ساعة", r.new_users_24h, manager()],
    ];
    main.innerHTML = head("تنبيهات الإدارة", "أعداد حية من قاعدة البيانات. افتح كل قائمة للتعامل مع طلباتها.") +
      `<div class="metric-grid">${cards.filter((x) => x[3]).map(([route, label, count]) => `<a class="metric f90-alert-card" href="#/${route}">${I("bell")}<strong>${e(count)}</strong><span>${e(label)}</span></a>`).join("")}</div><button class="button secondary" data-action="refresh-alerts">تحديث التنبيهات</button>`;
  }
  async function orderRequestsPage() {
    const seq = S.token;
    const result = await A.call("staff.order_requests", {
      offset: S.offset, status: S.filter !== "all" ? "pending" : undefined,
    });
    if (seq !== S.token) return;
    S.count = result.count;
    S.list = result.items;
    main.innerHTML = head("الاعتراضات وطلبات الإلغاء",
      "طلبات العملاء تصل للمراجعة. الموافقة هنا تسجل القرار فقط؛ غيّر حالة الطلب والاسترداد من صفحة الطلب بعد التحقق من المورّد.") +
      `<div class="toolbar"><label class="field"><span>الحالة</span><select id="requestFilter"><option value="pending" ${S.filter !== "all" ? "selected" : ""}>بانتظار القرار</option><option value="all" ${S.filter === "all" ? "selected" : ""}>الكل</option></select></label></div>` +
      (S.list.length ? `<div class="records">${S.list.map((r) => `<article class="record"><div class="record-main"><h3>${r.kind === "cancel" ? "طلب إلغاء" : "اعتراض"} · #${e(r.order?.order_number || "—")}</h3><p>${e(r.order?.product_name || "طلب سابق")} · ${e(r.customer?.display_name || "عميل")} · ${e(r.customer?.customer_id || "")}</p><p>${e(r.reason)}</p><small>${e(C.date(r.created_at))} · حالة الشراء: ${e(C.statuses[r.order?.status] || r.order?.status || "—")}</small>${r.review_note ? `<p>${e(r.review_note)}</p>` : ""}</div><div class="actions">${status(r.status)}${r.status === "pending" && (manager() || S.me.role === "admin") ? `<button class="button secondary small" data-action="review-order-request" data-id="${e(r.id)}">اتخاذ قرار</button>` : ""}<button class="button ghost small" data-action="request-order" data-id="${e(r.id)}">تفاصيل الطلب</button></div></article>`).join("")}</div>` : empty("لا توجد طلبات مراجعة في هذه القائمة")) + pagination();
  }
  function ledgerQuery(offset = S.offset) {
    const f = S.ledgerFilter;
    const start = f.from ? new Date(f.from + "T00:00:00").toISOString() : undefined;
    const endDate = f.to ? new Date(f.to + "T00:00:00") : null;
    if (endDate) endDate.setDate(endDate.getDate() + 1);
    const end = endDate?.toISOString();
    return { kind: "ledger", offset, ledger_kind: f.ledger_kind || undefined,
      customer_id: f.customer_id || undefined, from: start, to: end };
  }
  const ledgerBalanceBefore = (x) =>
    (Number(x.balance_after || 0) - Number(x.amount_usd || 0)).toFixed(6);
  async function dashboard(leader = false) {
    const seq = S.token;
    const report = await A.call("staff.report", { month: S.month });
    if (seq !== S.token) return;
    S.report = report;
    main.innerHTML =
      head(
        leader ? "المتصدرون والتقارير" : "نبض متجرك",
        leader
          ? "إنفاق مكتمل، وسجل شهري قابل للرجوع."
          : "أرقام فعلية من محفظة العملاء والطلبات.",
        `<button class="button secondary small" data-action="report">${I("download")}تنزيل التقرير</button>`,
      ) +
      `<div class="toolbar">${field("month", "الشهر", "month", S.month, 'id="reportMonth"')}</div>`;
    if (!leader)
      main.insertAdjacentHTML(
        "beforeend",
        `<div class="metric-grid">${[
          ["chart", C.money(report.revenue_usd), "إيراد الخدمات المكتملة"],
          [
            "wallet",
            C.money(report.known_profit_usd),
            "هامش الطلبات ذات التكلفة المسجّلة",
          ],
          ["user", report.users, "العملاء"],
          ["user", report.active_30d, "نشطون خلال ٣٠ يومًا"],
          ["clock", report.orders, "طلبات أُنشئت هذا الشهر"],
          ["clock", report.pending_orders, "طلبات تحتاج متابعة"],
          ["wallet", report.pending_deposits, "إيداعات بانتظار المراجعة"],
          ["wallet", C.money(report.wallet_liability), "أرصدة العملاء الحالية"],
        ]
          .map(
            ([i, v, t]) =>
              `<div class="metric">${I(i)}<strong>${e(v)}</strong><span>${t}</span></div>`,
          )
          .join(
            "",
          )}</div><div class="admin-warning-list">${report.pending_deposits ? `<a href="#/deposits">${I("wallet")}راجع ${e(report.pending_deposits)} طلب إيداع</a>` : ""}${report.pending_orders ? `<a href="#/orders">${I("clock")}تابع ${e(report.pending_orders)} طلبًا جاريًا</a>` : ""}${report.unpriced_cost_orders ? `<a href="#/orders">${I("chart")}هناك ${e(report.unpriced_cost_orders)} طلب مكتمل لم تُسجّل تكلفته؛ لا يدخل في هامش الربح أعلاه.</a>` : ""}${S.rates.some((r) => ["ILS", "JOD"].includes(r.currency) && !r.is_enabled) ? `<a href="#/rates">${I("chart")}اضبط سعر صرف الشيكل والدينار لتفعيل عرضهما والإيداع بهما.</a>` : ""}</div>`,
      );
    const board = report.leaderboard || [];
    if (leader) {
      const logo = C.safeUrl(S.settings.logo_url);
      const logoMarkup = logo ? `<img class="f90-board-logo" src="${e(logo)}" alt="شعار F90 Card">` : `<span class="f90-board-logo-text">F90</span>`;
      const poster = `<section class="f90-board-poster" id="leaderboardPoster" aria-label="لوحة المتصدرين للنشر"><header class="f90-board-head">${logoMarkup}<div><span class="f90-board-kicker">F90 CARD</span><h2>نجوم المتجر</h2><p>متصدرون حسب الإنفاق المكتمل · ${e(S.month)}</p></div></header><div class="f90-board-podium">${board.slice(0, 10).map((u, n) => `<article class="f90-board-entry ${n < 3 ? "f90-board-top" : ""}"><span class="f90-board-place">${n + 1}</span><span class="f90-board-private-avatar" aria-hidden="true">${I("user")}</span><div class="f90-board-member"><strong>المتصدر ${n + 1}</strong><span>الهوية محفوظة للخصوصية</span></div><strong class="f90-board-amount">${e(C.money(u.spent_usd))}</strong></article>`).join("") || '<p class="f90-board-empty">لا توجد طلبات مكتملة لهذا الشهر</p>'}</div><footer class="f90-board-footer"><span>أف تسعين كارد</span><span>الترتيب بعد احتساب الاستردادات</span></footer></section>`;
      main.insertAdjacentHTML("beforeend", `<div class="f90-board-tools"><p class="muted">لوحة جاهزة للتصوير والنشر دون عرض أسماء العملاء أو صورهم أو أرقام حساباتهم.</p><button class="button secondary small" data-action="print-leaderboard">${I("download")}حفظ أو طباعة لوحة المتصدرين</button></div>` + poster);
    }
    main.insertAdjacentHTML(
      "beforeend",
      `<div class="section-head"><h2>أكثر العملاء إنفاقًا · ${e(S.month)}</h2><span>بعد الاسترداد</span></div>${
        board.length
          ? `<div class="leaderboard-top">${board
              .slice(0, 3)
              .map(
                (u, n) =>
                  `<article class="leader-card"><span class="rank">${n + 1}</span>${customer(u)}<strong>${e(C.money(u.spent_usd))}</strong><span class="muted small">${e(u.orders)} طلب</span></article>`,
              )
              .join(
                "",
              )}</div><div class="table-wrap"><table><thead><tr><th>الترتيب</th><th>العميل</th><th>الإنفاق</th><th>الطلبات</th>${manager() ? "<th>الحساب</th>" : ""}</tr></thead><tbody>${board.map((u, n) => `<tr><td>${n + 1}</td><td>${customer(u)}</td><td>${e(C.money(u.spent_usd))}</td><td>${e(u.orders)}</td>${manager() ? `<td><button class="button ghost small" data-action="find-user" data-id="${u.user_id}">عرض الحساب</button></td>` : ""}</tr>`).join("")}</tbody></table></div>`
          : empty("لا توجد طلبات مكتملة لهذا الشهر")
      }<div class="admin-note">التوقيت: فلسطين. يتبع جدول الإنفاق شهر إكمال الطلب. الهامش يحسب من التكلفة المسجّلة، ولا يشمل مصاريف تشغيل خارج النظام. رصيد العملاء التزام محفظة وليس إيرادًا.</div>`,
    );
  }
  async function listPage(kind) {
    const seq = S.token;
    const r = await A.call("staff.list", kind === "ledger" ? ledgerQuery() : {
      kind,
      offset: S.offset,
      status: S.filter || undefined,
      search: kind === "users" ? S.search : undefined,
    });
    if (seq !== S.token) return;
    S.list = r.items;
    S.count = r.count;
    const filters =
      kind === "orders"
        ? [
            "pending",
            "queued",
            "submitting",
            "processing",
            "review",
            "completed",
            "partial",
            "failed",
            "refunded",
          ]
        : kind === "users"
          ? ["active", "suspended", "banned"]
          : kind === "audit" || kind === "ledger"
            ? []
            : ["pending", "approved", "rejected"];
    main.innerHTML =
      head(
        titles[kind],
        kind === "deposits"
          ? "قبول الإيداع يضيف الرصيد مرة واحدة بالدولار. الرفض لا يغيّر المحفظة."
          : kind === "verification"
            ? "صور خاصة، والتوثيق شرط للإيداع والشراء ويُراجع يدويًا."
            : kind === "users"
              ? "ابحث بالبريد أو معرّف العميل، ثم اضبط حالة الحساب وصلاحياته."
              : kind === "ledger"
                ? "حركات الرصيد الفعلية بالدولار، للقراءة والتدقيق فقط."
                : "سجل العمليات والمتابعات.",
        `<button class="button secondary small" data-action="reload">تحديث</button>${kind !== "audit" ? `<button class="button secondary small" data-action="list-pdf">${I("download")}تنزيل الصفحة</button>` : ""}${kind === "ledger" ? `<button class="button secondary small" data-action="ledger-csv">${I("download")}تصدير CSV كامل</button>` : ""}`,
      ) +
      `<div class="toolbar">${filters.length ? select("filter", "الحالة", [["", "كل الحالات"], ...filters.map((x) => [x, C.statuses[x]])], S.filter).replace("<select ", '<select id="listFilter" ') : ""}${kind === "users" ? `<form id="searchUsers" class="actions">${field("search", "بحث", "search", S.search, 'placeholder="البريد أو معرّف العميل"')}<button class="button secondary" type="submit">بحث</button></form>` : ""}</div>` +
      (kind === "ledger" ? `<form id="ledgerFilterForm" class="toolbar ledger-filters">${select("ledger_kind", "نوع الحركة", [["", "كل الحركات"], ["deposit", "إيداع"], ["purchase", "شراء"], ["refund", "استرداد"], ["adjustment", "تسوية"]], S.ledgerFilter.ledger_kind)}${field("customer_id", "رقم العميل", "search", S.ledgerFilter.customer_id, 'placeholder="F90..."')}${field("from", "من تاريخ", "date", S.ledgerFilter.from)}${field("to", "إلى تاريخ", "date", S.ledgerFilter.to)}<button class="button secondary" type="submit">تطبيق</button><button class="button secondary" type="button" data-action="ledger-reset">مسح الفلاتر</button></form>` : "");
    if (!r.items.length) {
      main.insertAdjacentHTML("beforeend", empty("لا توجد سجلات مطابقة"));
      return;
    }
    let columns, rows;
    if (kind === "orders") {
      columns = [
        "الطلب",
        "العميل",
        "الخدمة",
        "المبلغ",
        "التنفيذ",
        "الحالة",
        "متابعة",
      ];
      rows = r.items
        .map(
          (o) =>
            `<tr><td>#${e(o.order_number)}<br><small class="muted">${e(C.date(o.created_at))}</small></td><td>${customer(o.customer)}</td><td>${e(o.product_name)}<br><small class="muted">${e(o.quantity)} وحدة</small></td><td>${e(C.money(o.total_usd))}</td><td>${o.fulfillment === "automatic" ? "آلي" : "يدوي"}<br><small class="muted">${e(C.duration(o))}</small></td><td>${status(o.status)}</td><td><button class="button secondary small" data-action="detail-order" data-id="${o.id}">التفاصيل</button></td></tr>`,
        )
        .join("");
    } else if (kind === "deposits") {
      columns = [
        "العميل",
        "الطريقة",
        "المبلغ الأصلي",
        "الرصيد بالدولار",
        "الحالة",
        "المراجعة",
      ];
      rows = r.items
        .map(
          (d) =>
            `<tr><td>${customer(d.customer)}<small class="muted">${e(C.date(d.created_at))}</small></td><td>${e(d.method_name)}</td><td>${e(C.money(d.amount, d.currency, true))}</td><td>${e(C.money(d.usd_amount, "USD", true))}<br><small class="muted">صرف ${e(d.rate_snapshot)}</small></td><td>${status(d.status)}</td><td><button class="button secondary small" data-action="detail-deposit" data-id="${d.id}">الإيصال والمراجعة</button></td></tr>`,
        )
        .join("");
    } else if (kind === "verification") {
      columns = [
        "العميل",
        "نوع المستند",
        "تاريخ التقديم",
        "الحالة",
        "المراجعة",
      ];
      rows = r.items
        .map(
          (v) =>
            `<tr><td>${customer(v.customer)}</td><td>${v.document_type === "id" ? "هوية" : "جواز سفر"}</td><td>${e(C.date(v.created_at))}</td><td>${status(v.status)}</td><td><button class="button secondary small" data-action="detail-verification" data-id="${v.id}">عرض المستندات</button></td></tr>`,
        )
        .join("");
    } else if (kind === "users") {
      columns = ["العميل", "البريد", "الصلاحية", "الحالة", "الرصيد", "الإدارة"];
      rows = r.items
        .map(
          (u) =>
            `<tr><td>${customer(u)}${u.is_verified ? '<span class="badge verified">موثّق</span>' : ""}</td><td>${e(u.email)}</td><td>${e(C.roles[u.role])}</td><td>${status(u.account_status)}</td><td>${e(C.money(u.balance_usd))}</td><td><button class="button secondary small" data-action="detail-user" data-id="${u.id}">إدارة الحساب</button></td></tr>`,
        )
        .join("");
    } else if (kind === "ledger") {
      columns = ["التاريخ", "العميل", "الحركة", "المبلغ", "الرصيد قبل / بعد", "المرجع", "البيان"];
      rows = r.items.map((x) => {
        const amount = Number(x.amount_usd || 0);
        const before = ledgerBalanceBefore(x);
        const label = { deposit: "إيداع", purchase: "شراء", refund: "استرداد", adjustment: "تسوية" }[x.kind] || x.kind;
        return `<tr><td>${e(C.date(x.created_at))}</td><td>${customer(x.customer)}</td><td>${e(label)}</td><td class="${amount >= 0 ? "ledger-plus" : "ledger-minus"}">${e(C.money(amount))}</td><td>${e(C.money(before))}<br><strong>${e(C.money(x.balance_after))}</strong></td><td><small>${e(x.reference_id || x.id)}</small></td><td>${e(x.description || "—")}</td></tr>`;
      }).join("");
    } else {
      columns = ["التاريخ", "العملية", "العنصر", "المنفّذ"];
      rows = r.items
        .map(
          (x) =>
            `<tr><td>${e(C.date(x.created_at))}</td><td>${e(auditName(x.action))}</td><td><small>${e(x.target_id || "—")}</small></td><td><small>${e(x.actor_id || "النظام الآلي")}</small></td></tr>`,
        )
        .join("");
    }
    main.insertAdjacentHTML(
      "beforeend",
      `<div class="table-wrap"><table><thead><tr>${columns.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>${pagination()}`,
    );
  }
  async function traders() {
    const seq = S.token;
    const r = await A.call("staff.traders", { offset: S.offset });
    if (seq !== S.token) return;
    S.list = r.items;
    S.count = r.count;
    main.innerHTML = head("التجار ومفاتيح API",
      "حسابات التجار الحقيقية ومفاتيحها ومحافظها. امنح صلاحية التاجر من صفحة المستخدمين بعد التوثيق.",
      '<a class="button secondary small" href="#/users">إدارة المستخدمين</a><a class="button secondary small" href="./index.html#/developers">صفحة التاجر</a>') +
      (r.items.length ? `<div class="table-wrap"><table><thead><tr><th>التاجر</th><th>البريد</th><th>التوثيق والحالة</th><th>المحفظة</th><th>مفاتيح نشطة</th><th>الإدارة</th></tr></thead><tbody>${r.items.map((u) =>
        `<tr><td>${customer(u)}</td><td>${e(u.email)}</td><td>${u.is_verified ? "موثّق" : "غير موثّق"} · ${status(u.account_status)}</td><td>${e(C.money(u.balance_usd))}</td><td>${e(u.active_keys)}</td><td><button class="button secondary small" data-action="find-user" data-id="${e(u.id)}">إدارة الحساب والمفاتيح</button></td></tr>`).join("")}</tbody></table></div>${pagination()}`
        : empty("لا توجد حسابات تاجر حاليًا"));
  }
  function auditName(a) {
    return (
      {
        "deposit.review": "مراجعة إيداع",
        "identity.review": "مراجعة هوية",
        "user.permissions": "تعديل صلاحيات مستخدم",
        "catalog.create": "إنشاء عنصر",
        "catalog.update": "تعديل عنصر",
        "provider.save": "حفظ إعدادات مورّد",
        "provider.toggle": "تفعيل أو إيقاف مورّد",
        "key.create": "إصدار مفتاح تاجر",
        "key.update": "تعديل صلاحيات مفتاح تاجر",
        "key.revoke": "إلغاء مفتاح تاجر",
      }[a] ||
      (a.startsWith("order.")
        ? "تغيير حالة الطلب: " + (C.statuses[a.split(".")[1]] || "مراجعة")
        : "إجراء إداري")
    );
  }
  function detailOrder(o) {
    S.detail = o;
    const can = ["manager", "admin"].includes(S.me.role);
    modal(
      "الطلب #" + o.order_number,
      `<h3>${e(o.product_name)}</h3><div class="staff-detail-grid">${[
        ["العميل", o.customer?.display_name],
        ["رقم الحساب", o.customer?.customer_id],
        ["المبلغ", C.money(o.total_usd)],
        ["الكمية", o.quantity],
        ["الحالة", C.statuses[o.status]],
        ["التنفيذ", o.fulfillment === "automatic" ? "آلي" : "يدوي"],
        ["مدة التنفيذ", C.duration(o)],
        ["مرجع المورّد", o.provider_order_id || "—"],
      ]
        .map(([t, v]) => `<div><small>${t}</small><b>${e(v || "—")}</b></div>`)
        .join(
          "",
        )}</div><h3 style="margin-top:22px">بيانات العميل</h3>${Object.entries(
        o.customer_fields || {},
      )
        .map(
          ([k, v]) =>
            `<p class="small">${k === "account_id" ? "معرّف الحساب" : e(k)}: <b>${e(v)}</b></p>`,
        )
        .join(
          "",
        )}${o.status === "review" ? '<div class="notice warning">النتيجة غير مؤكدة. راجع الطلب عند المورّد قبل إعادة التنفيذ أو تأكيد الفشل. أدخل مرجع المورّد إذا ثبت قبوله.</div>' : ""}${
        can
          ? `<form id="orderActionForm">${select(
              "status",
              "الحالة الجديدة",
              [
                ["processing", "قيد التنفيذ"],
                ["completed", "تم بنجاح"],
                ["review", "مراجعة الإدارة"],
                ["failed", "فشل مع استرداد كامل"],
                ["refunded", "استرداد كامل"],
              ],
              o.status,
            )}${field("provider_order_id", "مرجع الطلب لدى المورّد <small>اختياري</small>", "text", o.provider_order_id || "")}${manager() ? field("cost_usd", "التكلفة الفعلية بالدولار <small>اختياري</small>", "number", o.cost_usd ?? "", 'min="0" step="0.000001"') : ""}${field("note", "ملاحظة تظهر في سجل الطلب", "textarea", "", 'maxlength="2000"')}<button class="button full" type="submit">تأكيد التحديث</button></form>`
          : ""
      }`,
    );
  }
  async function detailDeposit(d) {
    S.detail = d;
    modal(
      "مراجعة إيداع",
      `<div class="staff-detail-grid"><div><small>العميل</small><b>${e(d.customer?.display_name)}</b></div><div><small>رصيد يُضاف بعد القبول</small><b>${e(C.money(d.usd_amount, "USD", true))}</b></div><div><small>التحويل الأصلي</small><b>${e(C.money(d.amount, d.currency, true))}</b></div><div><small>سعر الصرف المحفوظ</small><b>${e(d.rate_snapshot)}</b></div></div><p class="small" style="margin-top:20px">${e(d.method_name)} · ${e(d.reference || "بدون ملاحظة")}</p><div id="receiptLoading" class="loading">جارٍ فتح الإيصال الخاص…</div>${d.status === "pending" ? `<form id="reviewDepositForm">${field("note", "ملاحظة المراجعة", "textarea", "", 'maxlength="2000"')}<div class="actions"><button class="button success" type="submit" name="approve" value="yes">قبول وإضافة الرصيد</button><button class="button danger" type="submit" name="approve" value="no">رفض الطلب</button></div></form>` : `${status(d.status)}<p>${e(d.review_note || "")}</p>`}`,
    );
    const r = await A.call("staff.file", { kind: "deposit", id: d.id });
    if ($("receiptLoading"))
      $("receiptLoading").outerHTML =
        `<img class="receipt-preview" src="${e(r.signedUrl)}" alt="إيصال إيداع العميل">`;
  }
  async function detailVerification(v) {
    S.detail = v;
    modal(
      "مراجعة التوثيق",
      `${customer(v.customer)}<div class="actions" style="margin-top:18px"><button class="button secondary small" data-action="verification-image" data-part="front">وجه المستند</button>${v.back_path ? '<button class="button secondary small" data-action="verification-image" data-part="back">ظهر المستند</button>' : ""}<button class="button secondary small" data-action="verification-image" data-part="selfie">سيلفي المستند</button></div><div id="identityImage"></div>${v.status === "pending" ? `<form id="reviewVerificationForm">${field("note", "ملاحظة المراجعة", "textarea", "", 'maxlength="2000"')}<div class="actions"><button class="button success" name="approve" value="yes" type="submit">قبول التوثيق</button><button class="button danger" name="approve" value="no" type="submit">رفض التوثيق</button></div></form>` : `${status(v.status)}<p>${e(v.review_note || "")}</p>${manager() && !v.erased_at ? '<button class="button ghost small" data-action="erase-identity">حذف صور المستند بعد المراجعة</button>' : ""}`}`,
    );
    const r = await A.call("staff.file", {
      kind: "verification",
      id: v.id,
      part: "front",
    });
    if ($("identityImage"))
      $("identityImage").innerHTML =
        `<img class="receipt-preview" src="${e(r.signedUrl)}" alt="مستند هوية خاص">`;
  }
  function detailUser(u) {
    S.detail = u;
    modal(
      "إدارة حساب " + u.display_name,
      `${customer(u)}<div class="notice"><p class="small">البريد: ${e(u.email)}<br>الرصيد: ${e(C.money(u.balance_usd))}<br>رقم الهاتف: ${e(u.phone_country || "")} ${e(u.phone || "غير مضاف")}</p></div><form id="userForm">${select("role", "الصلاحية", Object.entries(C.roles), u.role)}${select(
        "status",
        "حالة الحساب",
        [
          ["active", "تفعيل الحساب"],
          ["suspended", "إيقاف مؤقت"],
          ["banned", "حظر الحساب"],
        ],
        u.account_status,
      )}${select("vip", "المستوى", [["", "تلقائي بحسب الإنفاق"], ...S.vip.map((t) => [t.level, "تخصيص المستوى " + t.level])], u.vip_override || "")}<button class="button full" type="submit">حفظ صلاحيات وحالة الحساب</button></form><div class="actions" style="margin-top:20px"><button class="button secondary small" data-action="reset-user">إرسال رابط استعادة كلمة المرور</button>${u.role === "trader" ? '<button class="button ghost small" data-action="create-trader-key">إنشاء مفتاح للتاجر</button><button class="button secondary small" data-action="trader-keys">المفاتيح النشطة والملغاة</button>' : ""}</div><p class="muted small" style="margin-top:15px">لا يمكن إزالة آخر مدير كامل الصلاحيات. حظر الحساب يمنع العمليات حتى لو احتفظ بجلسة قديمة.</p>`,
    );
  }
  function categoryOptions(includeEmpty = true, exclude) {
    const list = includeEmpty ? [["", "بدون قسم / القسم الرئيسي"]] : [];
    function walk(parent, depth, seen) {
      for (const c of S.categories.filter(
        (c) => c.parent_id === parent && !seen.has(c.id) && c.id !== exclude,
      )) {
        list.push([c.id, "— ".repeat(depth) + c.name]);
        const next = new Set(seen);
        next.add(c.id);
        walk(c.id, depth + 1, next);
      }
    }
    walk(null, 0, new Set());
    return list;
  }
  async function catalogPage(kind) {
    await catalogs();
    const rows = S[kind];
    S.kind =
      kind === "categories"
        ? "category"
        : kind === "products"
          ? "product"
          : "banner";
    main.innerHTML =
      head(
        kind === "categories"
          ? "عالم الأقسام"
          : kind === "products"
            ? "منتجاتك وخدماتك"
            : "صور الإعلانات",
        "اسحب لترتيب العناصر، أو استخدم الأسهم. التكرار ينشئ نسخة مخفية حتى تنشرها.",
        `<button class="button" data-action="catalog-new">${I("plus")}إضافة ${kind === "categories" ? "قسم" : kind === "products" ? "منتج" : "إعلان"}</button>`,
      ) +
      `<div class="toolbar">${kind === "products" ? select("providerFilter", "المورّد", [["", "جميع المورّدين"], ["__local__", "منتجات بدون مورّد"], ...(S.providers || []).map((p) => [p.id, p.name])], S.providerFilter || "").replace("<select ", '<select id="providerFilter" ') : ""}${kind === "products" ? select("categoryFilter", "القسم", [["", "كل الأقسام"], ...categoryOptions(false)], S.categoryFilter || "").replace("<select ", '<select id="categoryFilter" ') : kind === "categories" ? select("sectionFilter", "الأقسام المعروضة", [["root", "الأقسام الرئيسية"], ["all", "جميع الأقسام"], ...categoryOptions(false)], S.sectionFilter || "root").replace("<select ", '<select id="sectionFilter" ') : ""}</div>${kind === "products" ? `<div class="f90-bulk-bar"><input id="productNameSearch" type="search" placeholder="بحث عن الخدمات والمنتجات..." aria-label="بحث عن الخدمات" value="${e(S.productSearch || '')}" style="min-width:180px;flex:1"><button type="button" class="button secondary small" data-action="bulk-fulfillment" data-mode="manual">شحن يدوي للمحدد</button><button type="button" class="button secondary small" data-action="bulk-fulfillment" data-mode="automatic">شحن آلي للمحدد</button><button type="button" class="button secondary small" data-action="bulk-select-visible">تحديد الظاهر</button><button type="button" class="button secondary small" data-action="bulk-clear">إلغاء التحديد</button><span id="bulkSelectionCount" class="muted small">0 محدد</span><button type="button" class="button secondary small" data-action="bulk-visibility" data-active="false">إخفاء المحدد</button><button type="button" class="button secondary small" data-action="bulk-visibility" data-active="true">إظهار المحدد</button><button type="button" class="button secondary small" data-action="bulk-move">نقل المحدد لقسم</button><button type="button" class="button secondary small" data-action="bulk-image">صورة موحدة/إزالة الصور</button><button type="button" class="button danger small" data-action="bulk-delete">حذف المحدد</button></div>` : ""}<p class="muted small">اعرض عناصر القسم المطلوب فقط، ثم حرّكها بالسحب أو بأسهم الترتيب. لا يتغير ترتيب العناصر خارج القسم.</p><div class="catalog-list">${
        rows
          .filter(
            (r) =>
              kind === "products"
                ? (!S.categoryFilter || r.category_id === S.categoryFilter) && (!S.providerFilter || (S.providerFilter === "__local__" ? !(S.internal || []).some((i) => i.product_id === r.id && i.provider_id) : (S.internal || []).some((i) => i.product_id === r.id && i.provider_id === S.providerFilter)))
                : kind === "categories"
                  ? (S.sectionFilter === "all" || (!S.sectionFilter || S.sectionFilter === "root" ? !r.parent_id : r.parent_id === S.sectionFilter))
                  : true,
          )
          .map(
            (r) =>
              `<article class="catalog-row" draggable="true" data-row-id="${r.id}">${kind === "products" ? `<input type="checkbox" class="f90-bulk-check" aria-label="تحديد ${e(r.name)}" value="${e(r.id)}">` : ""}<button type="button" class="catalog-drag-handle" aria-label="اضغط واسحب لترتيب ${e(r.name || r.title || "العنصر")}" title="اسحب لترتيب العنصر">⠿</button>${image(r.image_url, r.name || r.title, "row-image")}<div class="row-content"><h3>${e(r.name || r.title || "إعلان مصوّر")}</h3><p>${r.is_active ? "منشور" : "مخفي"}${kind === "products" ? " · " + (r.commerce?.fulfillment === "automatic" ? "آلي" : "يدوي") + " · " + (manager() ? e(C.money(r.commerce?.prices?.USD ?? r.price)) : "") : ""}${kind === "categories" && r.parent_id ? " · داخل " + e(S.categories.find((c) => c.id === r.parent_id)?.name || "قسم") : ""}</p>${C.unavailable(r) || r.presentation?.availability === "refilling" ? '<span class="badge">قيد التعبئة</span>' : ""}</div><div class="row-actions"><button class="icon-button" data-action="move-up" data-id="${r.id}" aria-label="تحريك للأعلى">↑</button><button class="icon-button" data-action="move-down" data-id="${r.id}" aria-label="تحريك للأسفل">↓</button><button class="icon-button" data-action="catalog-edit" data-id="${r.id}" aria-label="تعديل">${I("edit")}</button><button class="icon-button" data-action="catalog-duplicate" data-id="${r.id}" aria-label="تكرار">${I("copy")}</button><button class="icon-button" data-action="catalog-link" data-id="${r.id}" aria-label="نسخ الرابط">${I("link")}</button><button class="icon-button" data-action="catalog-delete" data-id="${r.id}" aria-label="حذف">${I("trash")}</button></div></article>`,
          )
          .join("") || empty("لا توجد عناصر بعد")
      }</div>`;
    if (kind === "products" && S.productSearch) { document.querySelectorAll(".catalog-list .catalog-row").forEach(row => { const p = S.products.find(x => x.id === row.dataset.rowId); row.style.display = String(p?.name || "").toLocaleLowerCase().includes(S.productSearch.toLocaleLowerCase()) ? "" : "none"; }); }
  }
  let pendingBulk = null;
  let bulkBusy = false;
  function selectedBulkProducts() {
    const ids = new Set([...document.querySelectorAll(".f90-bulk-check:checked")].map((el) => el.value));
    return S.products.filter((p) => ids.has(p.id));
  }
  function updateBulkCount() {
    const node = $("bulkSelectionCount");
    if (node) node.textContent = selectedBulkProducts().length + " محدد";
  }
  async function runBulkProducts(pending, status) {
    if (!pending || !["show", "hide", "move", "image", "delete", "fulfillment"].includes(pending.mode)) throw new Error("عملية جماعية غير معروفة");
    let value = pending.mode === "move" ? pending.categoryId : null;
    if (pending.mode === "image") {
      const file = $("bulkImageFile")?.files?.[0];
      value = file ? (await A.upload(file, "f90-images", "products")).url :
        $("bulkImageURL")?.value?.trim() || "";
    }
    const result = pending.mode === "fulfillment" ? await A.call("catalog.bulk_fulfillment", { ids: pending.ids, mode: pending.fulfillment }) : await A.call("catalog.bulk_products", { ids: pending.ids, mode: pending.mode, value });
    if (status) status.textContent = "اكتمل تعديل " + result.changed + " منتج";
    return { done: result.changed, failed: 0 };
  }
  function libraryButtons() {
    return `<div class="library-picker">${library.map(([k, n]) => `<button type="button" data-action="pick-image" data-url="./assets/sections/${k}.png" aria-label="${n}">${image("./assets/sections/" + k + ".png", n)}</button>`).join("")}</div>`;
  }
  function imageEditor(url = "") {
    return `<aside class="panel editor-aside"><h2>الصورة</h2><div id="imagePreview">${image(url, "صورة العنصر", "editor-preview")}</div>${field("image_url", "رابط الصورة", "text", url, 'id="imageURL" placeholder="أو ارفع صورة أدناه"')}${field("image_file", "رفع صورة جديدة", "file", "", 'accept="image/jpeg,image/png,image/webp,image/gif"')}<button type="button" class="button ghost small" data-action="clear-image">إزالة الصورة</button><div class="form-section"><h3>هوياتك الجاهزة</h3><p class="muted small">اختر صورة من هويتك، ويمكنك استبدالها أو حذفها من العنصر متى شئت.</p>${libraryButtons()}</div></aside>`;
  }
  function fieldsRows(rows) {
    return (rows || [])
      .map(
        (f, n) =>
          `<div class="dynamic-row" data-field-row><div class="field-row">${field("field_id_" + n, "المعرّف البرمجي", "text", f.id || "account_id")}${field("field_label_" + n, "الاسم الظاهر بالعربية", "text", f.label_ar || "معرّف الحساب")}</div>${select(
            "field_type_" + n,
            "نوع الحقل",
            [
              ["text", "نص"],
              ["number", "رقم"],
              ["email", "بريد إلكتروني"],
              ["url", "رابط"],
              ["textarea", "نص متعدد الأسطر"],
            ],
            f.type || "text",
          )}${check("field_required_" + n, "مطلوب", f.required !== false)}<button type="button" class="button ghost small" data-action="remove-row">حذف الحقل</button></div>`,
      )
      .join("");
  }
  function tiersRows(rows) {
    return (rows || [])
      .map(
        (t, n) =>
          `<div class="dynamic-row" data-tier-row><div class="field-row">${field("tier_min_" + n, "من كمية", "number", t.min, 'min="1" step="1"')}${field("tier_price_" + n, "السعر لكل وحدة تسعير بالدولار", "number", t.prices?.USD, 'min="0.000001" step="0.000001"')}</div><button type="button" class="button ghost small" data-action="remove-row">حذف الشريحة</button></div>`,
      )
      .join("");
  }
  function editCatalog(kind, item = null) {
    S.kind = kind;
    S.edit = item;
    const d = item || {},
      c = d.commerce || {},
      p = d.presentation || {},
      internal = S.internal.find((i) => i.product_id === d.id) || {};
    let body = `${field("name", kind === "banner" ? "عنوان الإعلان <small>وصف اختياري</small>" : "الاسم الداخلي والظاهر داخل الصفحة", "text", kind === "banner" ? d.title || "" : d.name || "", kind === "banner" ? 'maxlength="200"' : 'required maxlength="200"')}${kind !== "banner" ? field("slug", "آخر جزء من الرابط <small>اتركه فارغًا ليتولّد تلقائيًا</small>", "text", d.slug || "", 'maxlength="250"') : ""}${check("is_active", "نشر العنصر في المتجر", d.is_active !== false)}`;
    if (kind === "category")
      body +=
        select(
          "parent_id",
          "القسم الأب",
          categoryOptions(true, d.id),
          d.parent_id || "",
        ) +
        select(
          "routing",
          "عند الضغط على القسم",
          [
            ["auto", "عرض الأقسام الفرعية والمنتجات"],
            ["direct", "فتح منتج مباشرة"],
          ],
          p.routing || "auto",
        ) +
        select(
          "direct_product_id",
          "المنتج الذي يُفتح مباشرة",
          [["", "اختر المنتج"], ...S.products.map((p) => [p.id, p.name])],
          p.direct_product_id || "",
        ) +
        select(
          "layout",
          "طريقة عرض المنتجات داخل القسم",
          [
            ["images", "صور فقط"],
            ["packs", "باقات: اسم الباقة وسعرها بالدولار"],
          ],
          p.layout || "images",
        ) +
        select(
          "availability",
          "حالة التعبئة",
          [
            ["available", "حسب توفر المنتجات"],
            ["refilling", "قيد التعبئة"],
          ],
          p.availability || "available",
        ) +
        field(
          "banner_url",
          "صورة داخل صفحة القسم <small>اختياري</small>",
          "text",
          p.banner_url || "",
        ) +
        field(
          "banner_file",
          "رفع صورة داخل القسم",
          "file",
          "",
          'accept="image/jpeg,image/png,image/webp,image/gif"',
        ) +
        field(
          "description",
          "وصف داخلي <small>اختياري</small>",
          "textarea",
          d.description || "",
        );
    if (kind === "product") {
      body +=
        select("category_id", "القسم", categoryOptions(), d.category_id || "") +
        field(
          "description",
          "وصف المنتج <small>يظهر بعد فتحه فقط</small>",
          "textarea",
          d.description || "",
        ) +
        field("search_aliases", "أسماء بحث مخفية <small>مثال: الاسم الإنجليزي عندما يظهر الاسم بالعربية؛ افصلها بفاصلة</small>", "text", (c.search_aliases || []).join("، "), 'maxlength="1500"') +
        select(
          "availability",
          "حالة الخدمة",
          [
            ["available", "يمكن الشراء"],
            ["refilling", "قيد التعبئة — صورة بالأبيض والأسود"],
          ],
          c.availability || "available",
        ) +
        (c.supplier_refilling === true
          ? '<div class="admin-note" role="status"><strong>إيقاف تلقائي من المورد:</strong> المورد أبلغ أن الخدمة غير متاحة. ستعيد المزامنة الحالة السابقة حين يؤكد المورد توفرها. لا تفتحها للبيع قبل ذلك.</div>'
          : c.availability === "refilling"
            ? '<div class="admin-note" role="status"><strong>إيقاف مستقل عن المورد:</strong> هذه الحالة ليست معلّمة كتوقف تلقائي من API. إذا أظهرت بيانات المورد توفر الخدمة، راجع سبب الإيقاف ثم عدّل الحالة يدوياً من هذا الحقل.</div>'
            : internal.provider_id
              ? '<div class="admin-note">الخدمة مرتبطة بمورّد، لكن لا يوجد إيقاف تلقائي مسجّل حالياً.</div>'
              : '');
      if (manager())
        body += `<div class="form-section"><h3>التسعير والتنفيذ</h3>${select(
          "price_type",
          "نوع المنتج",
          [
            ["fixed", "باقة بسعر ثابت"],
            ["quantity", "كمية يحددها العميل"],
          ],
          c.type || "fixed",
        )}<div class="field-row">${field("price_usd", "السعر بالدولار", "number", c.prices?.USD ?? (d.currency === "USD" ? d.price : 0), 'required min="0.000001" step="0.000001"')}${field("unit_quantity", "السعر لكل كم وحدة؟", "number", c.unit_quantity || 1, 'required min="1" step="1"')}</div><p class="muted small">مثال: السعر ١٥ دولار، لكل ١٠٠٬٠٠٠ كوينز. الباقة الثابتة لا تضرب سعرها بعدد الوحدات.</p><div class="field-row">${field("pack_quantity", "عدد وحدات الباقة الثابتة", "number", c.pack_quantity || 1, 'min="1" step="1"')}${field("quantity_label_ar", "اسم الوحدة", "text", c.quantity_label_ar || "كوينز")}</div><div class="field-row">${field("quantity_min", "أقل كمية", "number", c.quantity_min || 1, 'min="1" step="1"')}${field("quantity_max", "أعلى كمية", "number", c.quantity_max || 1000000000, 'min="1" step="1"')}</div>${field("quantity_step", "زيادة الكمية المسموحة", "number", c.quantity_step || 1, 'min="1" step="1"')}${field("stock", "عدد الطلبات المتاحة <small>فارغ = بدون حد</small>", "number", d.stock ?? "", 'min="0" step="1"')}${select(
          "fulfillment",
          "طريقة التنفيذ",
          [
            ["manual", "يدوي — تتولاه الإدارة"],
            ["automatic", "آلي — عبر مورّد"],
          ],
          c.fulfillment || "manual",
        )}<div class="field-row">${field("delivery_time", "وصف مدة التنفيذ", "text", c.delivery_time || "")}${field("expected_minutes", "المدة المتوقعة بالدقائق <small>٠ = غير محددة</small>", "number", c.expected_minutes || 0, 'min="0" step="1"')}</div>${check("is_featured", "عرض في الخدمات المميزة", d.is_featured)}<h3>شرائح سعر حسب الكمية</h3><div id="tierRows" class="dynamic-rows">${tiersRows(c.pricing_tiers)}</div><button type="button" class="button secondary small" style="margin-top:12px" data-action="add-tier">إضافة شريحة</button></div><div class="form-section"><h3>المورّد والتكلفة</h3>${select("provider_id", "المورّد", [["", "بدون مورّد"], ...S.providers.map((p) => [p.id, p.name])], internal.provider_id || "")}${field("provider_service", "رقم الخدمة عند المورّد", "text", internal.provider_service || "")}<div class="field-row">${field("cost_usd", "تكلفة وحدة التسعير بالدولار <small>اختياري</small>", "number", internal.cost_usd ?? "", 'min="0" step="0.000001"')}${field("trader_price_usd", "سعر التاجر لكل وحدة تسعير <small>اختياري</small>", "number", internal.trader_price_usd ?? "", 'min="0.000001" step="0.000001"')}</div>${check("auto_margin", "تحديث السعر وفق هامش المورّد عند مزامنة الأسعار", internal.auto_margin)}</div>`;
      body += `<div class="form-section"><h3>البيانات المطلوبة من العميل</h3><p class="muted small">إذا لم تضف حقولًا، يُطلب معرّف الحساب تلقائيًا. لا تطلب كلمة مرور العميل.</p><div id="customerFields" class="dynamic-rows">${fieldsRows(c.fields)}</div><button type="button" class="button secondary small" style="margin-top:12px" data-action="add-field">إضافة حقل</button></div>`;
    }
    if (kind === "banner")
      body +=
        field(
          "link_url",
          "الرابط عند الضغط <small>اختياري</small>",
          "text",
          d.link_url || "",
        ) +
        field(
          "subtitle",
          "وصف مختصر <small>اختياري</small>",
          "text",
          d.subtitle || "",
        ) +
        check(
          "overlay_enabled",
          "إظهار العنوان والوصف فوق الصورة",
          p.overlay_enabled,
        ) +
        `<div class="field-row">${field("starts_at", "بداية العرض <small>اختياري</small>", "datetime-local", localDate(p.starts_at))}${field("ends_at", "نهاية العرض <small>اختياري</small>", "datetime-local", localDate(p.ends_at))}</div>`;
    main.innerHTML =
      head(
        (item ? "تعديل " : "إضافة ") +
          (kind === "product" ? "منتج" : kind === "category" ? "قسم" : "إعلان"),
        "كل التعديلات قابلة للمراجعة قبل الحفظ.",
        `<button class="button secondary small" data-action="back-catalog">رجوع</button>`,
      ) +
      `<form id="catalogForm"><div class="editor"><section class="panel">${body}<div class="form-section"><div class="actions"><button class="button" type="submit">${I("check")}حفظ التعديلات</button><button class="button secondary" data-action="back-catalog" type="button">إلغاء</button></div></div></section>${imageEditor(d.image_url || "")}</div></form>`;
  }
  const localDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  function publicListPage(kind) {
    if (kind === "coupons") { main.innerHTML = head("رموز الخصم غير متاحة", "تم إيقاف إدارة الكوبونات؛ خصومات VIP ما زالت مستقلة."); return; }
    const list = S.settings.config[kind] || [];
    S.dynamicKind = kind;
    S.dynamicItems = list;
    const names = {
      payments: "طرق الإيداع",
      promotions: "الشريط الإعلاني",
      notifications: "إشعارات المتجر",
      coupons: "رموز الخصم",
    };
    const key = kind === "payments" ? "payment_methods" : kind;
    const rows = S.settings.config[key] || [];
    S.dynamicItems = rows;
    main.innerHTML =
      head(
        names[kind],
        kind === "payments"
          ? "صور مربعة للطرق، وتعليمات التحويل التي يراها العميل."
          : "يمكنك تعديل العنصر أو إخفاؤه أو تكراره وترتيبه.",
        `<button class="button" data-action="dynamic-new">${I("plus")}إضافة</button>`,
      ) +
      `<div class="catalog-list">${rows.map((r, n) => `<article class="catalog-row" draggable="true" data-dynamic-index="${n}"><span class="catalog-drag-handle" aria-hidden="true">⠿</span>${r.image_url ? image(r.image_url, r.name_ar || r.text_ar, "row-image") : I(kind === "coupons" ? "doc" : "bell")}<div class="row-content"><h3>${e(r.name_ar || r.title_ar || r.text_ar || r.code || "عنصر")}</h3><p>${r.enabled ? "مفعّل" : "مخفي"}${kind === "coupons" ? " · " + e(r.percent) + "٪" : ""}</p></div><div class="row-actions"><button class="icon-button" data-action="dynamic-up" data-index="${n}" aria-label="تحريك للأعلى">↑</button><button class="icon-button" data-action="dynamic-down" data-index="${n}" aria-label="تحريك للأسفل">↓</button><button class="icon-button" data-action="dynamic-edit" data-index="${n}" aria-label="تعديل">${I("edit")}</button><button class="icon-button" data-action="dynamic-duplicate" data-index="${n}" aria-label="تكرار">${I("copy")}</button><button class="icon-button" data-action="dynamic-delete" data-index="${n}" aria-label="حذف">${I("trash")}</button></div></article>`).join("") || empty("لا توجد عناصر بعد")}</div>`;
  }
  function editDynamic(kind, item = null, index = -1) {
    if (kind === "coupons") throw new Error("إدارة الكوبونات متوقفة");
    S.edit = item;
    S.editIndex = index;
    S.dynamicKind = kind;
    const d = item || {};
    let body = check("enabled", "تفعيل العنصر", d.enabled !== false);
    if (kind === "payments")
      body +=
        field(
          "name_ar",
          "اسم طريقة الإيداع",
          "text",
          d.name_ar || "",
          "required",
        ) +
        field(
          "destination",
          "رقم الحساب أو عنوان التحويل <small>اختياري</small>",
          "text",
          d.destination || "",
        ) +
        field(
          "details_ar",
          "تفاصيل التحويل والتعليمات",
          "textarea",
          d.details_ar || "",
          "required",
        );
    if (kind === "promotions")
      body +=
        field(
          "text_ar",
          "النص المتحرك <small>اختياري إذا أضفت صورة</small>",
          "textarea",
          d.text_ar || "",
        ) +
        `<div class="field-row">${field("display_seconds", "مدة الظهور بالثواني <small>٠ = يبقى ظاهرًا</small>", "number", d.display_seconds || 0, 'min="0" max="86400"')}${field("animation_seconds", "مدة دورة الحركة بالثواني", "number", d.animation_seconds || 25, 'min="8" max="120"')}</div>`;
    if (kind === "notifications")
      body +=
        field("title_ar", "العنوان", "text", d.title_ar || "", "required") +
        field(
          "text_ar",
          "النص",
          "textarea",
          d.text_ar || d.body_ar || "",
          "required",
        );
    if (kind === "coupons")
      body +=
        field("code", "رمز الخصم", "text", d.code || "", 'required dir="ltr"') +
        select(
          "discount_type",
          "نوع الخصم",
          [
            ["percent", "نسبة مئوية"],
            ["fixed", "قيمة بالدولار"],
          ],
          d.type || "percent",
        ) +
        `<div class="field-row">${field("percent", "نسبة الخصم", "number", d.percent || 0, 'min="0" max="99" step="0.001"')}${field("fixed_usd", "الخصم بالدولار", "number", d.prices?.USD || 0, 'min="0" step="0.000001"')}</div>` +
        field(
          "minimum_usd",
          "الحد الأدنى للطلب بالدولار",
          "number",
          d.minimum?.USD || 0,
          'min="0" step="0.000001"',
        ) +
        field("description_ar", "وصف الرمز", "text", d.description_ar || "") +
        check(
          "show_public",
          "رمز عام يظهر في وصف المزايا",
          d.show_public !== false,
        );
    if (kind !== "payments")
      body += `<div class="field-row">${field("starts_at", "بداية العرض <small>اختياري</small>", "datetime-local", localDate(d.starts_at))}${field("ends_at", "نهاية العرض <small>اختياري</small>", "datetime-local", localDate(d.ends_at))}</div>`;
    main.innerHTML =
      head(
        item ? "تعديل العنصر" : "إضافة عنصر",
        "النصوص والصور وتوقيت العرض تحت تحكمك.",
        `<button class="button secondary small" data-action="back-dynamic">رجوع</button>`,
      ) +
      `<form id="dynamicForm"><div class="editor"><section class="panel">${body}<button class="button" type="submit">حفظ</button></section>${["payments", "promotions"].includes(kind) ? imageEditor(d.image_url || "") : ""}</div></form>`;
  }
  async function settings() {
    const d = S.settings,
      c = d.config;
    main.innerHTML =
      head(
        "هويتك، على طريقتك",
        "الشعار، التطبيق، المظهر الليلي والنهاري، وواجهة المتجر.",
      ) +
      `<form id="settingsForm" novalidate><div class="editor"><section class="panel">${field("store_name", "اسم الموقع", "text", d.store_name, 'required maxlength="100"')}${field("contact_email", "بريد التواصل", "email", d.contact_email || "")}${field("whatsapp", "رقم واتساب للدعم <small>اختياري</small>", "tel", c.whatsapp || "", 'dir="ltr"')}${field("primary_color", "لون الهوية", "color", d.primary_color || "#fa2444")}${select(
        "default_theme",
        "المظهر الافتراضي",
        [
          ["dark", "أسود وأحمر"],
          ["cream", "حليبي هادئ"],
        ],
        c.default_theme || "dark",
      )}${select(
        "currency",
        "عملة العرض الافتراضية",
        [["USD", "دولار أمريكي"]],
        "USD",
      )}${select(
        "logo_fit",
        "طريقة عرض الشعار",
        [
          ["cover", "إطار الشعار الأصلي"],
          ["contain", "الصورة كاملة"],
        ],
        c.logo_fit || "cover",
      )}<div class="field-row">${field("logo_x", "تحريك الشعار يمين / يسار", "number", c.logo_x || 0, 'min="-100" max="100"')}${field("logo_y", "تحريك الشعار أعلى / أسفل", "number", c.logo_y || 0, 'min="-100" max="100"')}</div>${check("logo_motion", "إضافة حركة لطيفة للشعار", c.logo_motion)}<div class="form-section"><h3>بطاقات الخدمات والأقسام</h3>${check("edge_glow_enabled", "إطار متوهج متحرك على البطاقات والأزرار", c.edge_glow_enabled !== false)}${field("edge_glow_color", "لون الإطار المتوهج", "color", c.edge_glow_color || "#ff2444")}${field("edge_glow_speed", "مدة دورة الإطار بالثواني (كلما زادت أصبح أبطأ)", "number", c.edge_glow_speed ?? 14, 'min="4" max="60" step="1"')}${select("card_flip_speed", "مدة تأثير الظهور الأول", [["0.4","سريع (0.4 ثانية)"],["0.8","متوسط (0.8 ثانية)"],["1.2","هادئ (1.2 ثانية)"],["2","بطيء (ثانيتان)"]], String([0.4,0.8,1.2,2].reduce((a,b)=>Math.abs(b-(Number(c.card_flip_speed)||0.8))<Math.abs(a-(Number(c.card_flip_speed)||0.8))?b:a,0.8)))}${check("card_flip_enabled", "تأثير ظهور خفيف مرة واحدة بدون دوران", c.card_flip_enabled !== false)}${field("card_back_image", "رابط صورة خلفية البطاقات", "url", c.card_back_image || "")}${field("card_back_file", "رفع صورة خلفية البطاقات", "file", "", 'accept="image/png,image/jpeg,image/webp"')}${field("card_fallback_image", "رابط الصورة الموحدة عند غياب الصورة أو توقف الخدمة", "url", c.card_fallback_image || "")}${field("card_fallback_file", "رفع الصورة الموحدة", "file", "", 'accept="image/png,image/jpeg,image/webp"')}<p class="muted small">صورة الخلفية تظهر أثناء دوران البطاقة، ثم تظهر صورة الخدمة. الصورة الموحدة تظهر عندما تكون الصورة الأصلية غير متاحة أو عند توقف الخدمة.</p></div><p class="muted small">يمكن رفع شعار متحرك. تعتمد الحركة على صورة متحركة أو خيار الحركة أعلاه.</p>${field("app_icon_url", "صورة أيقونة التطبيق <small>يفضل صورة مربعة ثابتة</small>", "text", c.app_icon_url || "")}${field("app_icon_file", "رفع أيقونة التطبيق", "file", "", 'accept="image/png,image/jpeg,image/webp"')}<div class="form-section"><h3>واجهة المتجر</h3>${check("show_banners", "إظهار صور الإعلانات", c.show_banners !== false)}${check("show_intro", "إظهار البانر الرئيسي عند عدم وجود إعلانات", c.show_intro !== false)}${field("hero_image", "صورة البانر الرئيسي", "text", c.hero_image || "./assets/sections/hero.png")}${field("hero_file", "رفع بانر رئيسي", "file", "", 'accept="image/png,image/jpeg,image/webp,image/gif"')}${field("banner_seconds", "مدة تبديل الإعلان بالثواني", "number", c.banner_seconds || 6, 'min="3" max="120"')}${field("announcement", "الإعلان النصي", "textarea", d.announcement || "")}${check("popup_enabled", "إظهار تنبيه في وسط الشاشة للزوار والعملاء", c.popup_announcement?.enabled)}${field("popup_text", "نص التنبيه", "textarea", c.popup_announcement?.text_ar || "", 'maxlength="1000"')}${field("footer_ar", "نبذة أسفل الموقع", "textarea", c.footer_ar || "")}</div><div class="form-section"><h3>واجهة التجار</h3>${check("merchant_api_enabled", "تفعيل صفحة الربط ومفاتيح API للتجار", c.merchant_api_enabled !== false)}<p class="muted small">عند الإيقاف تُرفض الطلبات باستخدام مفاتيح التجار، ولا تُحذف مفاتيحهم. تعود للعمل بعد التفعيل.</p></div><div class="form-section"><h3>صفحة الترحيب</h3>${field("welcome_title", "عنوان صفحة الترحيب", "text", c.welcome?.title_ar || "عالمك الرقمي يبدأ هنا", 'maxlength="100"')}${field("welcome_subtitle", "نبذة صفحة الترحيب", "textarea", c.welcome?.subtitle_ar || "استكشف خدماتنا الرقمية، أضف رصيدك بعد توثيق حسابك، وتابع طلباتك من مكان واحد.", 'maxlength="350" rows="3"')}${field("welcome_image", "صورة صفحة الترحيب", "text", c.welcome?.image_url || "")}<p class="muted small">تظهر الصفحة للزائر عند فتح رابط الموقع من دون مسار، ويمكن الوصول إليها من القائمة. الأقسام وطرق الإيداع تُقرأ من البيانات المفعّلة.</p></div><div class="form-section"><h3>الصيانة</h3>${check("maintenance_enabled", "تفعيل الصيانة للزوار والعملاء", c.maintenance?.enabled)}${field("maintenance_text", "رسالة الصيانة", "textarea", c.maintenance?.text_ar || "نجهّز لك تجربة أفضل. نعود قريبًا.")}${field("maintenance_until", "موعد انتهاء الصيانة (اختياري، بتوقيت جهازك)", "datetime-local", c.maintenance?.until ? (() => { const d = new Date(c.maintenance.until); return Number.isFinite(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : ""; })() : "")}</div><div class="form-section"><h3>قناة واتساب الرسمية</h3><p class="muted small">أدخل رابط القناة الحقيقي. تظهر دعوة الانضمام للزائر عند أول زيارة، دون منع تصفح المتجر.</p>${field("whatsapp_channel_url", "رابط قناة واتساب", "url", c.whatsapp_channel_url || "", 'placeholder="https://whatsapp.com/channel/..." dir="ltr"')}${check("whatsapp_channel_popup", "إظهار دعوة الانضمام عند أول دخول", c.whatsapp_channel_popup !== false)}</div><div class="form-section"><h3>روابط التواصل</h3><p class="muted small">يمكن تغيير اسم كل منصة ورابطها وأيقونتها مباشرة، أو رفع صورة جديدة بدل الأيقونة.</p><div id="socialRows" class="dynamic-rows">${(c.social_links || []).map((s, n) => socialRow(s, n)).join("")}</div><button type="button" class="button secondary small" data-action="add-social">إضافة رابط</button></div><button class="button" style="margin-top:25px" type="submit">حفظ إعدادات الموقع</button></section>${imageEditor(d.logo_url || "")}</div></form>`;
  }
  function socialRow(s, n) {
    return `<div class="dynamic-row" data-social-row>${field("social_name_" + n, "اسم المنصة", "text", s.name_ar || "")}${field("social_url_" + n, "الرابط", "url", s.url || "")}${field("social_icon_" + n, "رابط أيقونة المنصة", "url", s.icon_url || "")}${field("social_icon_file_" + n, "رفع أيقونة", "file", "", 'accept="image/png,image/jpeg,image/webp"')}${check("social_enabled_" + n, "إظهار الرابط", s.enabled !== false)}<button type="button" class="button ghost small" data-action="remove-row">إزالة</button></div>`;
  }
  function rates() {
    main.innerHTML =
      head(
        "العملات وسعر الصرف",
        "سعر الإدارة المعتمد: كم وحدة من العملة تعادل دولارًا واحدًا؟",
      ) +
      `<div class="notice warning">غيّر الصرف بعد مراجعة سعر التحويل الذي تعتمد عليه. الإيداعات السابقة تحتفظ بسعرها لحظة التقديم. الدولار ثابت ولا يتغير.</div><div class="docs-grid">${S.rates.map((r) => `<form class="panel rateForm" data-currency="${r.currency}"><h3>${e(r.name_ar)}</h3>${field("name_ar", "اسم العملة بالعربية", "text", r.name_ar, "required")}${field("per_usd", "كم وحدة تساوي دولارًا؟", "number", r.per_usd || "", 'required min="0.00000001" max="100000000" step="0.00000001" ' + (r.currency === "USD" ? "readonly" : ""))}${check("is_enabled", "تفعيل العملة", r.is_enabled)}<button class="button secondary" type="submit">حفظ</button><p class="muted small" style="margin-top:12px">آخر تحديث: ${e(C.date(r.updated_at))}</p></form>`).join("")}</div><section class="panel"><h2>إضافة عملة أخرى</h2><form id="newRateForm"><div class="field-row">${field("currency", "رمز العملة", "text", "", 'required pattern="[A-Za-z]{3,8}" maxlength="8" dir="ltr"')}${field("name_ar", "اسم العملة بالعربية", "text", "", "required")}</div>${field("per_usd", "كم وحدة تعادل دولارًا واحدًا؟", "number", "", 'required min="0.00000001" max="100000000" step="0.00000001"')}<button class="button" type="submit">إضافة العملة</button></form></section>`;
  }
  function vip() {
    main.innerHTML =
      head(
        "مستويات التميّز السبعة",
        "ترقية تلقائية وفق الإنفاق المكتمل. المدير يستطيع تخصيص مستوى العميل.",
      ) +
      `<div class="docs-grid">${S.vip.map((t) => `<form class="panel vipForm" data-level="${t.level}"><h3>المستوى ${t.level}</h3>${field("minimum_spend", "الإنفاق المطلوب بالدولار", "number", t.minimum_spend, 'required min="0" step="0.000001" ' + (t.level === 1 ? "readonly" : ""))}${field("discount_percent", "نسبة الخصم", "number", t.discount_percent, 'required min="0" max="2" step="0.001" ' + (t.level === 1 ? "readonly" : ""))}<button class="button secondary" type="submit">حفظ</button></form>`).join("")}</div><div class="notice">المستوى الأول دون خصم، والمستوى الأعلى لا يتجاوز ٢٪. اضبط حدود الإنفاق تصاعديًا بين المستويات.</div>`;
  }
  function policies() {
    const titles = {
      about: "من نحن",
      privacy: "سياسة الخصوصية",
      terms: "الشروط والأحكام",
      purchase: "الشراء والاسترداد",
      usage: "الاستخدام",
      deposits: "الإيداع والمحفظة",
      resellers: "التجار والموزعون",
    };
    main.innerHTML =
      head(
        "السياسات ومعلومات الموقع",
        "النصوص تعكس الشراء من المحفظة والإيداع المعتمد والخدمات اليدوية والآلية.",
      ) +
      `<form id="policiesForm"><div class="panel">${Object.entries(titles)
        .map(
          ([k, t]) =>
            `<div class="form-section">${field("page_" + k, t, "textarea", S.settings.config.pages?.[k]?.ar || "", 'rows="8"')}</div>`,
        )
        .join(
          "",
        )}<button class="button" type="submit">حفظ جميع السياسات</button></div></form>`;
  }
  async function providers() {
    S.providerRows = await A.call("staff.providers");
    main.innerHTML =
      head(
        "مصادر خدماتك",
        "مفاتيح المورّدين تُحفظ مشفّرة على الخادم. لا تدخل المتصفح مع بيانات المتجر.",
        `<button class="button" data-action="provider-new">إضافة مورّد</button>`,
      ) +
      `<section class="panel" style="margin-bottom:18px"><h3>مركز فحص المورّدين</h3><p class="muted">افحص الرصيد وقائمة الخدمات قبل الاستيراد. لا ينفّذ الفحص أي طلب مدفوع.</p><button class="button secondary" data-action="provider-diagnose-all">فحص جميع المورّدين</button><div id="providerDiagnostics" aria-live="polite"></div></section><div class="catalog-list">${S.providerRows.map((p) => `<article class="catalog-row">${I("link")}<div class="row-content"><h3>${e(p.name)}</h3><p>${p.config?.disconnected ? "الاتصال مفصول والخدمات مخفية" : p.is_enabled ? "مفعّل" : "قيد التعبئة"} · هامش ${e(p.margin_percent)}٪ · عملة التسعير ${e(C.currencyNames[p.currency] || p.currency)} · الطلبات الآلية ${p.config?.automatic_orders_enabled ? "مسموحة" : "موقوفة"} · مهلة ${e((p.config?.request_timeout_ms ?? 20000) / 1000)} ث</p><small class="muted">${e(p.endpoint)}</small><p class="muted small" aria-label="حالة المزامنة">المزامنة: ${e(p.config?.sync_state === "ok" ? "ناجحة" : p.config?.sync_state === "pending" ? "جارٍ التحديث" : p.config?.sync_state === "error" ? "حدث خطأ" : "لم تُسجّل بعد")} · آخر نجاح: ${e(p.config?.sync_last_success ? C.date(p.config.sync_last_success) : "غير متوفر")}${p.config?.sync_error ? " · الخطأ: " + e(String(p.config.sync_error).slice(0,180)) : ""}${p.config?.sync_last_success && Date.now()-Date.parse(p.config.sync_last_success)>900000 ? " · تنبيه: لم تنجح المزامنة منذ أكثر من 15 دقيقة" : ""}</p></div><div class="row-actions"><button class="button ${p.is_enabled ? "secondary" : "ghost"} small" data-action="provider-toggle" data-id="${p.id}" data-enabled="${p.is_enabled ? "false" : "true"}">${p.is_enabled ? "إيقاف جميع خدماته" : "إعادة تفعيل خدماته"}</button><button class="button secondary small" data-action="provider-edit" data-id="${p.id}">تعديل</button><button class="button ghost small" data-action="provider-visibility" data-id="${p.id}">${p.config?.disconnected ? "إعادة الاتصال والإظهار" : "قطع الاتصال وإخفاء الخدمات"}</button><button class="button secondary small" data-action="provider-import" data-id="${p.id}">استعراض واستيراد الخدمات</button><button class="button ghost small" data-action="provider-sync" data-id="${p.id}">مزامنة الأسعار</button><button class="button ghost small" data-action="provider-balance" data-id="${p.id}">رصيد المورّد</button><button class="button secondary small" data-action="provider-diagnose" data-id="${p.id}">فحص الاتصال</button><button class="button danger small" data-action="provider-archive" data-id="${p.id}">حذف المورّد</button></div></article>`).join("") || empty("لا يوجد مورّد مضاف")}<div class="admin-note"><strong>تمييز التوقف اليدوي عن توقف المورّد:</strong> قد تُعيد واجهة API خدمة متاحة بينما يظل المنتج «قيد التعبئة» إذا أوقفته الإدارة يدوياً. المزامنة لا تلغي إيقاف الإدارة حفاظاً على سلامة الشراء. راجع حالة المنتج في إدارة المنتجات قبل إعادة تفعيله، ولا تعتمد على حالة المورد وحدها. آخر مزامنة وحالة اتصال المورد تظهر في فحص الموردين.</div><div class="admin-note">ياسين كارد: استخدم عنوان https://api.yassen-card.com والبروتوكول المخصص. الاستيراد يحفظ الخدمات كمسودات مخفية حتى مراجعتها. يمكن إضافة مورّد آخر وتعديل مفتاحه أو حذفه من التشغيل. سجلات الطلبات السابقة محفوظة.</div><button class="button secondary" style="margin-top:20px" data-action="worker">تشغيل متابعة الطلبات الآلية الآن</button>`;
  }
  function editProvider(p = null) {
    S.edit = p;
    modal(
      p ? "تعديل المورّد" : "إضافة مورّد",
      `<form id="providerForm">${field("name", "اسم المورّد", "text", p?.name || "", "required")}${field("endpoint", "عنوان الاتصال الآمن", "url", p?.endpoint || "", 'required placeholder="https://provider.example/api/v2" dir="ltr"')}${select(
        "adapter",
        "بروتوكول الاتصال",
        [
          ["smm", "بروتوكول الخدمات الموحد"],
          ["json", "طلبات JSON بمفتاح Bearer"],
          ["omega", "أوميغا ستور (قراءة الخدمات والرصيد)"],
          ["yassen", "ياسين كارد (api-token)"],
        ],
        p?.adapter || "smm",
      )}${select(
        "currency",
        "عملة أسعار المورّد",
        S.rates.filter((r) => r.is_enabled).map((r) => [r.currency, r.name_ar]),
        p?.currency || "USD",
      )}${field("token", "مفتاح المورّد <small>اتركه فارغًا للإبقاء على المفتاح الحالي</small>", "password", "", 'autocomplete="new-password" ' + (p ? "" : "required"))}${field("margin_percent", "هامش الربح بالنسبة المئوية", "number", p?.margin_percent ?? 20, 'required min="0" max="10000" step="0.01"')}${field("request_timeout_ms", "مهلة الاتصال بالمللي ثانية (5,000–30,000)", "number", p?.config?.request_timeout_ms ?? 20000, 'required min="5000" max="30000" step="1000"')}${check("automatic_orders_enabled", "السماح بإرسال الطلبات الآلية بعد اختبار المحوّل", p?.config?.automatic_orders_enabled === true)}<div class="admin-note"><strong>خطوات الربط:</strong> ١. أدخل رابط API الرسمي للمورّد. ٢. اختر نوع الربط حسب توثيق المورّد. ٣. احفظ التوكن. ٤. من صفحة المورّدين اضغط «فحص الاتصال». ٥. فعّل المورّد من البطاقة بعد نجاح الفحص، ثم استورد الخدمات كمسودات وراجع أسعارها قبل نشرها. تغيير الرابط أو المحوّل أو المفتاح يوقف المورّد حتى فحصه مجددًا. السماح بالطلبات الآلية منفصل عن تفعيل عرض الخدمات. <strong>تنبيه:</strong> لا تفعّل الطلبات الآلية لمورّد جديد قبل اختبار الربط. ربط أوميغا حاليًا للقراءة فقط.</div><p class="provider-secret-hint">لن يُعاد عرض المفتاح بعد الحفظ. استخدم لوحة المورّد لإلغائه أو تغييره.</p><button class="button full" type="submit">حفظ المورّد</button></form>`,
    );
    const automatic = $("modalRoot").querySelector('[name="automatic_orders_enabled"]');
    if (automatic && p?.adapter === "omega") automatic.disabled = true;
    const endpointInput = $("modalRoot").querySelector('#providerForm [name="endpoint"]');
    const adapterInput = $("modalRoot").querySelector('#providerForm [name="adapter"]');
    // Advisory only: suggest a known adapter based on a VERIFIED known hostname.
    // Unknown supplier APIs require documentation and explicit administrator review.
    if (!p && endpointInput && adapterInput) {
      endpointInput.addEventListener("change", () => {
        let hostname = "";
        try { hostname = new URL(endpointInput.value).hostname.toLowerCase(); } catch { return; }
        if (hostname === "api.yassen-card.com" || hostname === "yassen-card.com") {
          adapterInput.value = "yassen";
          toast("تم اقتراح بروتوكول ياسين كارد؛ افحص الاتصال قبل التفعيل");
        }
      });
    }
  }
  async function importProvider(p) {
    S.pendingProviderImport = null;
    S.importProvider = p;
    await catalogs();
    const services = await A.call("provider.services", { id: p.id });
    if (!Array.isArray(services)) throw new Error("قائمة خدمات المورّد غير صالحة");
    S.importServices = services;
    const visibleServices = services.slice(0, 1000);
    const omega = p.adapter === "omega";
    const bulk = ["omega", "yassen"].includes(p.adapter);
    const fx = S.rates.find((rate) => rate.currency === p.currency);
    const ratePerUSD = fx?.is_enabled && Number(fx.per_usd) > 0 ? Number(fx.per_usd) : null;
    const priceNotice = ratePerUSD
      ? `<div class="notice">عملة المورّد: ${e(p.currency)} · سعر الصرف المعتمد: ${e(ratePerUSD)} ${e(p.currency)} مقابل 1 USD. الأسعار أدناه تقديرية وفق الهامش، ويُعاد حسابها على الخادم وقت الاستيراد.</div>`
      : '<div class="notice warning">سعر صرف عملة المورّد غير مفعّل أو غير مضبوط. يمكنك معاينة الخدمات، لكن لا يمكن استيرادها حتى تضبط سعر الصرف في لوحة الإدارة.</div>';
    main.innerHTML =
      head(
        "معاينة خدمات " + p.name,
        "هذه الصفحة تستعلم عن القائمة فقط. لا يحدث خصم أو شراء أو نشر تلقائي.",
        `<a class="button secondary small" href="#/providers">رجوع إلى المورّدين</a>`,
      ) +
      `<section class="panel"><div class="notice">${e(services.length)} خدمة صالحة لدى المورّد. ${services.length > 1000 ? "نعرض أول 1000 خدمة هنا؛ استخدم الاستيراد الشامل لبقية الخدمات." : "يمكن البحث واختيار الخدمات قبل الاستيراد."}</div>${omega ? '<div class="notice warning"><strong>أوميغا: مسودات فقط.</strong> الاستيراد لا ينشر المنتجات ولا يرسل طلبات تلقائية. راجع اسم كل خدمة وقسمها وحقولها قبل النشر.</div>' : ""}${priceNotice}<form id="importForm"><div class="field-row">${select("category_id", "القسم الذي تُضاف إليه", categoryOptions(false), "")}${field("margin_percent", "هامش الربح على التكلفة", "number", p.margin_percent, 'required min="0" max="10000" step="0.01"')}</div><div class="f90-import-toolbar"><label class="field"><span>بحث عن خدمة أو رقمها</span><input id="providerServiceSearch" type="search" placeholder="اكتب اسم الخدمة أو المعرّف" autocomplete="off"></label><div class="actions"><button type="button" class="button secondary small" data-action="import-select-visible">اختيار النتائج الظاهرة</button><button type="button" class="button ghost small" data-action="import-clear-selection">إلغاء الاختيار</button></div></div><p id="providerImportCount" class="muted small" role="status" aria-live="polite">المحدد: 0 من 100 كحد أقصى · المعروض: ${visibleServices.length}</p><div class="table-wrap service-select"><table><thead><tr><th>اختيار</th><th>رقم الخدمة</th><th>الاسم عند المورّد</th><th>اسم المنتج في F90</th><th>القسم</th><th>سعر المورّد</th><th>سعر بيع تقديري USD</th><th>الحدود</th></tr></thead><tbody>${visibleServices.map((service, n) =>
            `<tr data-provider-service-row data-search="${e((String(service.id) + " " + String(service.name) + " " + String(service.category || "")).toLocaleLowerCase("ar"))}"><td><input type="checkbox" name="service_${n}" value="${e(service.id)}" aria-label="اختيار خدمة ${e(service.name)}"></td><td dir="ltr">${e(service.id)}</td><td>${e(service.name)}</td><td><input type="text" name="name_${n}" maxlength="200" value="${e(service.name)}" placeholder="الاسم المعروض داخل F90" aria-label="اسم الخدمة في F90"></td><td>${`<label class="field"><span>${e(service.category || "اختر قسم الخدمة")}${omega && providerServiceCategory(service).review ? " · يحتاج مراجعة" : ""}</span><select name="category_${n}" aria-label="قسم ${e(service.name)}"><option value="">اختر القسم</option>${S.categories.map((c) => `<option value="${e(c.id)}" ${omega ? (!providerServiceCategory(service).review && providerServiceCategory(service).id === c.id ? "selected" : "") : (c.name === service.category ? "selected" : "")}>${e(c.name)}</option>`).join("")}</select></label>`}</td><td>${e(service.rate)} / ${e(service.unit_quantity)}</td><td data-import-preview data-supplier-rate="${e(service.rate)}">${ratePerUSD ? e(C.money(Math.round((Number(service.rate) / ratePerUSD) * (1 + (Number(p.margin_percent) || 0) / 100) * 1e6) / 1e6)) : "سعر الصرف غير متاح"}</td><td>${e(service.min)}–${e(service.max)}</td></tr>`
          ).join("")}</tbody></table></div><div class="f90-import-actions"><p class="muted small">الاستيراد يحفظ المنتجات كمسودات مخفية للمراجعة. لا تنشرها قبل التأكد من الاسم والسعر والحقول المطلوبة.</p><button class="button" id="providerImportSubmit" type="submit" disabled>استيراد الخدمات المحددة كمسودات</button>${bulk ? '<button class="button secondary" type="button" data-action="omega-import-all">استيراد جميع خدمات المورّد كمسودات</button>' : ""}</div></form></section>`;
  }
  function providerServiceCategory(service) {
    // Assign a confident category only. All imported Omega products remain
    // unpublished drafts regardless of this classification.
    const norm = (value) => String(value || "")
      .toLocaleLowerCase("ar")
      .normalize("NFKC")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const title = norm(service.name);
    const supplier = norm(service.category);
    const categories = S.categories || [];
    const bySlug = (slug) => categories.find((c) => c.slug === slug);
    const byName = (label) => categories.find((c) => norm(c.name) === label || norm(c.slug) === label);
    const fallback = bySlug("store-services") || categories[0];
    const fallbackResult = { id: fallback?.id || "", review: true };

    // Product-specific keywords outrank broad supplier labels such as
    // "Games" or "Applications": Steam gift cards are not game top-ups.
    const rules = [
      { slug: "digital-cards", pattern: /(?:بطاق(?:ه|ات)?|كروت|قسيم(?:ه|ات)?|gift card|voucher|wallet code|redeem code|steam wallet|google play|جوجل بلاي|itunes|ايتونز|amazon gift|امازون|apple gift|ابل ستور|playstation card|psn card|xbox gift)/u },
      { slug: "streaming", pattern: /(?:نتفلكس|netflix|شاهد|shahid|spotify|سبوتيفاي|disney|ديزني|prime video|اشتراك مشاهده)/u },
      { slug: "artificial-intelligence", pattern: /(?:chatgpt|openai|شات جي بي تي|ذكاء اصطناعي|midjourney|claude ai|gemini ai|perplexity)/u },
      { slug: "mobile-credit", pattern: /(?:رصيد هاتف|شحن هاتف|شحن جوال|اتصالات|airtime|mobile topup|mobile recharge)/u },
      { slug: "social-media", pattern: /(?:متابع(?:ين)?|لايكات|اعجابات|مشاهدات|followers|likes|views|instagram|انستغرام|facebook|فيسبوك|tiktok|تيك توك|youtube|يوتيوب|telegram|تلجرام)/u },
      { slug: "قسم-ألالعاب", pattern: /(?:pubg|ببجي|شدات|free fire|فري فاير|جواهر|roblox|روبلوكس|game topup|gaming credit|fortnite|فورتنايت|uc pubg)/u },
      { slug: "applications", pattern: /(?:تطبيقات|برامج|application|app subscription|اشتراك تطبيق|live app|لايف)/u },
    ];
    // A title with competing signals is uncertain, e.g. an Instagram
    // gift card or an AI subscription sold as a code.
    const titleMatches = rules.filter((rule) => rule.pattern.test(title) && bySlug(rule.slug));
    if (titleMatches.length === 1) return { id: bySlug(titleMatches[0].slug).id, review: false };
    if (titleMatches.length > 1) {
      // Explicit vouchers are stronger than the unrelated service brand.
      const card = titleMatches.find((rule) => rule.slug === "digital-cards");
      if (card && /(?:بطاق(?:ه|ات)?|كروت|قسيم(?:ه|ات)?|gift card|voucher|wallet code|redeem code|steam wallet|google play)/u.test(title))
        return { id: bySlug("digital-cards").id, review: false };
      return { ...fallbackResult, review: true };
    }

    // Use supplier's declared category before broad hints.
    if (supplier) {
      const exact = byName(supplier);
      if (exact) return { id: exact.id, review: false };
      const supplierAliases = [
        { slug: "قسم-ألالعاب", pattern: /^(?:ال)?العاب|^(?:ال)?gaming|^games?$/u },
        { slug: "digital-cards", pattern: /(?:بطاقات رقميه|بطاقات هدايا|gift cards|digital cards)/u },
        { slug: "social-media", pattern: /(?:سوشيال ميديا|social media|social services)/u },
        { slug: "streaming", pattern: /(?:ال)?بث|streaming services/u },
      ];
      const genericAlias = supplierAliases.find((entry) => entry.pattern.test(supplier) && bySlug(entry.slug));
      if (genericAlias) return { id: bySlug(genericAlias.slug).id, review: false };
      const supplierMatches = rules.filter((rule) => rule.pattern.test(supplier) && bySlug(rule.slug));
      if (supplierMatches.length === 1)
        return { id: bySlug(supplierMatches[0].slug).id, review: false };
    }
    // No confident signal: hold as an unpublished draft for manual sorting.
    return fallbackResult;
  }
  async function importAllProviderDrafts(provider, status) {
    if (!provider || !["omega", "yassen"].includes(provider.adapter))
      throw new Error("الاستيراد الشامل متاح لياسين وأوميغا");
    const services = S.importServices;
    if (!Array.isArray(services) || !services.length)
      throw new Error("تعذّر جلب قائمة الخدمات؛ أعد فتح استيراد المورّد");
    const ids = new Set();
    const entries = [];
    let review = 0;
    for (const item of services) {
      const id = String(item.id);
      if (ids.has(id)) continue;
      ids.add(id);
      if (!(Number(item.rate) > 0) || !item.name) continue;
      const category = providerServiceCategory(item);
      if (!category.id) throw new Error("لا توجد أقسام في المتجر لاستيراد الخدمات");
      if (category.review) review++;
      entries.push({ id, name: String(item.name).slice(0, 200), category: category.id });
    }
    if (!entries.length) throw new Error("لا توجد خدمات صالحة للاستيراد");
    const count = Math.ceil(entries.length / 50);
    let imported = 0, skipped = 0;
    for (let index = 0; index < entries.length; index += 50) {
      const batch = entries.slice(index, index + 50);
      if (status) status.textContent = "جاري استيراد الدفعة " + (Math.floor(index / 50) + 1) + " من " + count + " · تم فحص " + index + " من " + entries.length + " خدمة.";
      const payload = {
        id: provider.id,
        service_ids: batch.map((item) => item.id),
        names: Object.fromEntries(batch.map((item) => [item.id, item.name])),
        category_ids: Object.fromEntries(batch.map((item) => [item.id, item.category])),
        category_id: batch[0].category,
        margin_percent: Number(provider.margin_percent),
      };
      // Each batch is idempotent: the server skips existing mapped services.
      // Never create orders or enable product visibility here.
      const response = await A.call("provider.import", payload);
      imported += response.filter((item) => !item.skipped).length;
      skipped += response.filter((item) => item.skipped).length;
    }
    return { found: services.length, accepted: entries.length, imported, skipped, needsReview: review };
  }
  function updateProviderImportPreview() {
    const form = $("importForm");
    if (!form) return;
    const fx = S.rates.find((rate) => rate.currency === S.importProvider?.currency);
    const ratePerUSD = fx?.is_enabled && Number(fx.per_usd) > 0 ? Number(fx.per_usd) : null;
    const margin = Number(form.elements.margin_percent?.value);
    const validMargin = Number.isFinite(margin) && margin >= 0 && margin <= 10000;
    form.querySelectorAll("[data-import-preview]").forEach((cell) => {
      const supplierRate = Number(cell.dataset.supplierRate);
      const usd = ratePerUSD && validMargin && Number.isFinite(supplierRate) && supplierRate > 0
        ? Math.round((supplierRate / ratePerUSD) * (1 + margin / 100) * 1e6) / 1e6
        : null;
      cell.textContent = usd === null ? "غير متاح" : C.money(usd);
    });
    const rows = [...form.querySelectorAll("[data-provider-service-row]")];
    const query = (form.querySelector("#providerServiceSearch")?.value || "").trim().toLocaleLowerCase("ar");
    for (const row of rows) row.hidden = !!query && !row.dataset.search.includes(query);
    const selected = rows.filter((row) => row.querySelector('input[type="checkbox"]')?.checked).length;
    const visible = rows.filter((row) => !row.hidden).length;
    const status = $("providerImportCount");
    if (status) status.textContent = `المحدد: ${selected} من 100 كحد أقصى · المعروض: ${visible} من ${rows.length}`;
    const submit = $("providerImportSubmit");
    if (submit) submit.disabled = selected === 0 || selected > 100 || !ratePerUSD || !validMargin;
  }
  async function configSave(config) {
    await A.call("settings.save", {
      data: { ...S.settings, config: { ...S.settings.config, ...config } },
    });
    await refreshSettings();
    brand();
  }
  function configKey(kind) {
    return kind === "payments" ? "payment_methods" : kind;
  }
  function parseFields(form) {
    return [...form.querySelectorAll("[data-field-row]")].map((row) => ({
      id: row.querySelector("[name^=field_id]").value.trim(),
      label_ar: row.querySelector("[name^=field_label]").value.trim(),
      type: row.querySelector("select").value,
      required: row.querySelector("input[type=checkbox]").checked,
    }));
  }
  function parseTiers(form) {
    return [...form.querySelectorAll("[data-tier-row]")].map((row) => ({
      min: Number(row.querySelector("[name^=tier_min]").value),
      prices: { USD: Number(row.querySelector("[name^=tier_price]").value) },
    }));
  }
  function dateValue(v) {
    return v ? new Date(v).toISOString() : null;
  }
  async function selectedImage(form, current = "") {
    const file = form.elements.image_file?.files?.[0];
    return file
      ? (await A.upload(file, "f90-images", S.kind || "branding")).url
      : (form.elements.image_url?.value ?? current);
  }
  async function saveCatalog(form, d) {
    const old = S.edit || {},
      kind = S.kind;
    const data = {
      ...old,
      name: d.name,
      slug: d.slug || old.slug || kind + "-" + C.key(),
      description: d.description || "",
      is_active: form.elements.is_active.checked,
      image_url: await selectedImage(form),
      sort_order: old.sort_order || 0,
    };
    if (kind === "category")
      ((data.presentation = {
        ...old.presentation,
        routing: d.routing,
        direct_product_id: d.direct_product_id || null,
        layout: d.layout,
        availability: d.availability,
        banner_url: d.banner_url || "",
      }),
        (data.parent_id = d.parent_id || null));
    if (kind === "category" && d.banner_file?.size)
      data.presentation.banner_url = (
        await A.upload(d.banner_file, "f90-images", "category-banners")
      ).url;
    if (kind === "product") {
      data.category_id = d.category_id || null;
      // Supplier pauses are authoritative until a successful supplier sync.
      // Do not silently advertise a supplier-paused item as purchasable.
      const supplierPaused = old.commerce?.supplier_refilling === true;
      if (supplierPaused && d.availability === "available")
        throw new Error("هذه الخدمة متوقفة من المورد. انتظر تأكيد توفرها من المزامنة قبل إتاحتها للبيع.");
      data.commerce = {
        ...old.commerce,
        availability: d.availability,
        search_aliases: String(d.search_aliases || "").split(/[,،]/).map((x) => x.trim()).filter(Boolean).slice(0, 20),
        fields: parseFields(form),
      };
      if (manager()) {
        data.stock = d.stock === "" ? null : Number(d.stock);
        data.is_featured = form.elements.is_featured.checked;
        data.commerce = {
          ...data.commerce,
          type: d.price_type,
          prices: { USD: Number(d.price_usd) },
          unit_quantity: Number(d.unit_quantity),
          pack_quantity: Number(d.pack_quantity),
          quantity_min: Number(d.quantity_min),
          quantity_max: Number(d.quantity_max),
          quantity_step: Number(d.quantity_step),
          quantity_label_ar: d.quantity_label_ar,
          fulfillment: d.fulfillment,
          delivery_time: d.delivery_time,
          expected_minutes: Number(d.expected_minutes),
          pricing_tiers: parseTiers(form),
        };
        data.internal = {
          provider_id: d.provider_id || null,
          provider_service: d.provider_service || null,
          cost_usd: d.cost_usd === "" ? null : Number(d.cost_usd),
          trader_price_usd:
            d.trader_price_usd === "" ? null : Number(d.trader_price_usd),
          auto_margin: form.elements.auto_margin.checked,
        };
      }
    }
    if (kind === "banner") {
      data.title = d.name;
      data.subtitle = d.subtitle || "";
      data.link_url = d.link_url || null;
      data.presentation = {
        ...old.presentation,
        overlay_enabled: form.elements.overlay_enabled.checked,
        starts_at: dateValue(d.starts_at),
        ends_at: dateValue(d.ends_at),
      };
      if (!data.image_url) throw new Error("أضف صورة للإعلان");
    }
    await A.call("catalog.save", { kind, id: old.id, data });
    toast("تم حفظ العنصر");
    await catalogPage(
      kind === "category"
        ? "categories"
        : kind === "product"
          ? "products"
          : "banners",
    );
  }
  async function saveDynamic(form, d) {
    if (S.dynamicKind === "coupons") throw new Error("إدارة الكوبونات متوقفة");
    const old = S.edit || {},
      kind = S.dynamicKind,
      key = configKey(kind);
    const row = {
      ...old,
      id: old.id || C.key(),
      enabled: form.elements.enabled.checked,
    };
    if (kind === "payments")
      Object.assign(row, {
        name_ar: d.name_ar,
        destination: d.destination,
        details_ar: d.details_ar,
        image_url: await selectedImage(form),
      });
    if (kind === "promotions")
      Object.assign(row, {
        text_ar: d.text_ar,
        image_url: await selectedImage(form),
        display_seconds: Number(d.display_seconds),
        animation_seconds: Number(d.animation_seconds),
      });
    if (kind === "notifications")
      Object.assign(row, { title_ar: d.title_ar, text_ar: d.text_ar });
    if (kind === "coupons")
      Object.assign(row, {
        code: String(d.code).trim().toUpperCase(),
        type: d.discount_type,
        percent: Number(d.percent),
        prices: { USD: Number(d.fixed_usd) },
        minimum: { USD: Number(d.minimum_usd) },
        description_ar: d.description_ar,
        show_public: form.elements.show_public.checked,
        product_ids: old.product_ids || [],
      });
    if (kind !== "payments")
      Object.assign(row, {
        starts_at: dateValue(d.starts_at),
        ends_at: dateValue(d.ends_at),
      });
    if (row.starts_at && row.ends_at && row.starts_at >= row.ends_at)
      throw new Error("وقت النهاية يجب أن يأتي بعد البداية");
    const rows = [...(S.settings.config[key] || [])];
    if (S.editIndex >= 0) rows[S.editIndex] = row;
    else rows.push(row);
    await configSave({ [key]: rows });
    publicListPage(kind);
    toast("تم الحفظ");
  }
  async function saveSettings(form, d) {
    const c = S.settings.config;
    const icon = d.app_icon_file?.size
      ? (await A.upload(d.app_icon_file, "f90-images", "branding")).url
      : d.app_icon_url;
    const hero = d.hero_file?.size
      ? (await A.upload(d.hero_file, "f90-images", "banners")).url
      : d.hero_image;
    const cardBack = d.card_back_file?.size ? (await A.upload(d.card_back_file, "f90-images", "branding")).url : d.card_back_image;
    const cardFallback = d.card_fallback_file?.size ? (await A.upload(d.card_fallback_file, "f90-images", "branding")).url : d.card_fallback_image;
    const social = await Promise.all([...form.querySelectorAll("[data-social-row]")].map(
      async (row) => {
        const file = row.querySelector("[name^=social_icon_file]")?.files?.[0];
        return {
          id: C.key(),
          name_ar: row.querySelector("[name^=social_name]").value,
          url: row.querySelector("[name^=social_url]").value,
          icon_url: file ? (await A.upload(file, "f90-images", "branding")).url : row.querySelector("[name^=social_icon_]").value,
          enabled: row.querySelector("input[type=checkbox]").checked,
        };
      },
    ));
    await A.call("settings.save", {
      data: {
        store_name: d.store_name,
        contact_email: d.contact_email,
        logo_url: await selectedImage(form),
        primary_color: d.primary_color,
        announcement: d.announcement,
        currency: "USD",
        config: {
          ...c,
          whatsapp: d.whatsapp,
          whatsapp_channel_url: String(d.whatsapp_channel_url || "").trim().slice(0, 500),
          whatsapp_channel_popup: form.elements.whatsapp_channel_popup.checked,
          app_icon_url: icon,
          hero_image: hero,
          logo_fit: d.logo_fit,
          logo_x: Number(d.logo_x),
          logo_y: Number(d.logo_y),
          logo_motion: form.elements.logo_motion.checked,
          edge_glow_enabled: form.elements.edge_glow_enabled.checked,
          edge_glow_color: d.edge_glow_color,
          edge_glow_speed: Math.max(4, Math.min(60, Number(d.edge_glow_speed) || 14)),
          card_flip_speed: Math.max(0.2, Math.min(3, Number(d.card_flip_speed) || 0.8)),
          card_flip_enabled: form.elements.card_flip_enabled.checked,
          card_back_image: cardBack,
          card_fallback_image: cardFallback,
          default_theme: d.default_theme,
          show_banners: form.elements.show_banners.checked,
          show_intro: form.elements.show_intro.checked,
          banner_seconds: Number(d.banner_seconds),
          footer_ar: d.footer_ar,
          merchant_api_enabled: form.elements.merchant_api_enabled.checked,
          popup_announcement: {
            enabled: form.elements.popup_enabled.checked,
            text_ar: String(d.popup_text || "").trim().slice(0, 1000),
            revision: c.popup_announcement?.text_ar === String(d.popup_text || "").trim() &&
              c.popup_announcement?.enabled === form.elements.popup_enabled.checked ?
              c.popup_announcement?.revision : new Date().toISOString(),
          },
          welcome: {
            title_ar: String(d.welcome_title || "").trim().slice(0, 100),
            subtitle_ar: String(d.welcome_subtitle || "").trim().slice(0, 350),
            image_url: d.welcome_image || "",
          },
          social_links: social,
          maintenance: {
            enabled: form.elements.maintenance_enabled.checked,
            text_ar: d.maintenance_text,
            until: d.maintenance_until ? new Date(d.maintenance_until).toISOString() : null,
          },
        },
      },
    });
    await refreshSettings();
    brand();
    settings();
    toast("تم تحديث هوية وإعدادات المتجر");
  }
  function moveVisibleCatalogItem(items, visible, sourceId, targetId) {
    const allIds = items.map((item) => item.id);
    const slots = allIds.map((id, index) => visible.includes(id) ? index : -1).filter((index) => index >= 0);
    const ordered = slots.map((index) => allIds[index]);
    const from = ordered.indexOf(sourceId), to = ordered.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return null;
    ordered.splice(to, 0, ordered.splice(from, 1)[0]);
    slots.forEach((index, n) => { allIds[index] = ordered[n]; });
    return allIds;
  }
  let reorderBusy = false;
  async function reorder(kind, ids) {
    if (reorderBusy) return;
    reorderBusy = true;
    const list = main.querySelector(".catalog-list");
    const original = list ? [...list.querySelectorAll(".catalog-row[data-row-id]")] : [];
    const byId = new Map(original.map(row => [row.dataset.rowId, row]));
    if (list) {
      ids.forEach(id => { if (byId.has(id)) list.appendChild(byId.get(id)); });
      list.setAttribute("aria-busy", "true");
    }
    try {
      await A.call("catalog.reorder", { kind, ids });
      const key = kind === "category" ? "categories" : kind === "product" ? "products" : "banners";
      const positions = new Map(ids.map((id, i) => [id, i]));
      S[key].sort((a, b) => (positions.get(a.id) ?? 999999) - (positions.get(b.id) ?? 999999));
      toast("تم حفظ الترتيب");
    } catch (err) {
      if (list) original.forEach(row => list.appendChild(row));
      throw err;
    } finally {
      list?.removeAttribute("aria-busy");
      reorderBusy = false;
    }
  }

  async function infrastructurePage() {
    const started = performance.now();
    const healthCheck = A.call("health").then(
      value => ({ok:true,value,latency:performance.now()-started}),
      error => ({ok:false,error,latency:performance.now()-started})
    );
    const [healthResult, suppliers] = await Promise.all([
      healthCheck, A.call("staff.providers").then(
        value=>({status:"fulfilled",value}),
        reason=>({status:"rejected",reason})
      )
    ]);
    const health = healthResult.ok ? {status:"fulfilled",value:healthResult.value} : {status:"rejected",reason:healthResult.error};
    const latency = Math.max(0,Math.round(healthResult.latency));
    const pingOk = health.status==="fulfilled";
    const list = suppliers.status==="fulfilled" && Array.isArray(suppliers.value) ? suppliers.value : [];
    const running = list.filter(p=>p.is_enabled);
    const stale = running.filter(p=> !p.config?.sync_last_success ||
      Date.now()-Date.parse(p.config.sync_last_success)>15*60*1000);
    const errored = running.filter(p=>p.config?.sync_state==="error" || p.config?.sync_error);
    main.innerHTML=head("الخوادم والمراقبة","قراءات فعلية عند فتح الصفحة؛ لا تظهر أسرار API أو كلمات المرور.",
      '<button class="button secondary small" data-action="monitor-refresh">تحديث الفحص</button>')
      + `<div class="metric-grid">${[
         ["API",""+(pingOk?"متاح":"تعذّر الاتصال"),"اختبار اتصال مباشر"],
         ["Response","${e(latency)} ms","مدة الفحص من جهاز الإدارة"],
         ["Providers","${e(running.length)}","مورّدون مفعّلون"],
         ["Sync Alerts","${e(stale.length+errored.length)}","مزامنة متأخرة أو فيها خطأ"]
        ].map(([n,v,d])=>`<div class="panel f90-monitor-stat"><small>${n}</small><strong>${v}</strong><span>${d}</span></div>`).join("")}</div>
        <section class="panel"><h2>نتائج اتصال الموردين</h2><p class="muted">عرض حي للحالة المحفوظة؛ هذا الفحص لا ينفذ طلبات شراء.</p>
        ${suppliers.status==="rejected" ? '<p class="notice error">تعذّر قراءة الموردين؛ تحقق من الصلاحيات والاتصال.</p>' : ""}
        <div class="f90-monitor-list">${list.map(p=>`<article><strong>${e(p.name)}</strong><span>${p.is_enabled?"مفعّل":"موقوف"} · ${e(p.adapter)} · ${e(p.currency)}</span><span>آخر مزامنة ناجحة: ${e(p.config?.sync_last_success ? C.date(p.config.sync_last_success) : "غير مسجّلة")}</span>${p.config?.sync_error ? `<small class="f90-monitor-fault">${e(String(p.config.sync_error).slice(0,240))}</small>` : ""}</article>`).join("")||'<p class="muted">لا توجد مصادر خدمة.</p>'}</div>
        <div class="actions"><a class="button secondary" href="#/providers">إدارة الموردين</a><a class="button secondary" href="#/traders">التجار ومفاتيح API</a><a class="button secondary" href="#/audit">سجل العمليات</a></div>
        </section>
        <section class="panel"><h2>ما الذي نقيسه هنا؟</h2><p>يقيس Response مدة استجابة API من متصفح الإدارة، وليس إجمالي زمن الشراء أو الخادم الداخلي. تعني كلمة «متاح» نجاح فحص health فقط. تحتاج أخطاء التوصيل والتخزين إلى سجلات الخادم للتشخيص الكامل.</p><p class="muted">لا تكشف هذه الصفحة التوكنات أو رموز المزودين. لم يُفعّل Webhook أو IP Allowlist للتجار.</p></section>`;
  }
  function integrationCenter() {
    main.innerHTML=head("مركز الربط والبروتوكولات","استيراد من الموردين وتصدير خدمات F90 إلى التجار هما عمليتان منفصلتان.")+
      `<div class="f90-admin-center-grid">
       <section class="panel"><h2>01 · استيراد خدمات المورد</h2><p>تدعم البنية موصلات موردين معروفة مثل Yassen وOmega وSMM. يجب مراجعة الصيغ والأسعار والعملات قبل تشغيل الخدمات. التعرف التلقائي على جميع بروتوكولات العالم غير مضمون.</p><a class="button" href="#/providers">إدارة الموردين وفحص الاتصال</a></section>
       <section class="panel"><h2>02 · تصدير F90 للتجار</h2><p>التاجر الموثّق ينشئ توكن بصلاحيات ورصيد خاصين ويتابع استخدام المفتاح. لا يظهر السر بعد إصدار المفتاح للمرة الأولى.</p><a class="button" href="#/traders">إدارة التجار والتوكنات</a></section>
       <section class="panel"><h2>03 · Send to developer</h2><p>دليل كامل بالإنجليزية وشرح بالعربي وملفات OpenAPI وPostman. لا ترسل مفتاح التوكن إلى المبرمج داخل المحادثات العامة.</p><a class="button secondary" href="./docs/F90_MERCHANT_API_EN.md" download>Download Merchant API</a><a class="button secondary" href="./docs/F90_PROVIDER_PROTOCOL_EN.md" download>Download Provider Protocol</a></section>
       <section class="panel"><h2>04 · IP / Webhook status</h2><p>تقييد IP للطلبات الواردة وإرسال Webhook للتجار غير مفعّلين بعد. تُعرض هذه الحالة بوضوح حتى لا يعتمد أحد على حماية غير موجودة.</p><a class="button secondary" href="./index.html#/api-guide">صفحة دليل الربط العامة</a></section>
       </div>`;
  }
  function designCenter(){
    main.innerHTML=head("التحكم المرئي","مركز وصول سريع لجميع عناصر التصميم القابلة للتعديل حالياً.")+
    `<div class="f90-admin-center-grid">${[
      ["صورة الشعار والهوية","رفع الشعار وأيقونة التطبيق، ألوان المظهر، توهج الإطارات والبنر","settings"],
      ["صور وأسماء الأقسام","تحريك الصور ورفعها وتغيير أسماء وأوصاف الأقسام","categories"],
      ["صور وأسعار الخدمات","الصور والوصف والتصنيفات والترتيب، دون حذف طلبات العملاء","products"],
      ["طرق الإيداع","الصور والنصوص والتعليمات والترتيب الفوري","payments"],
      ["الإعلانات والترويج","صور الإعلانات والشريط والإشعارات","banners"],
      ["الصفحات القانونية والنصوص","صفحات التعريف والسياسات القابلة للتعديل","policies"]
    ].map(([title,desc,target])=>`<a class="panel f90-design-link" href="#/${target}"><h2>${title}</h2><p>${desc}</p><span>فتح الإدارة ←</span></a>`).join("")}</div>
    <p class="notice">تعديل أي نص أو تصميم تعسفي خارج الحقول المحددة يتطلب إضافة محرر مُراجع بدلاً من السماح بحقن HTML عشوائي داخل موقع الدفع.</p>`;
  }
  async function route() {
    S.token++;
    closeModal();
    document.body.classList.remove("admin-menu-open");
    const page =
      (location.hash || "#/dashboard").replace(/^#\/?/, "").split("/")[0] ||
      "dashboard";
    if (S.active !== page) {
      S.offset = 0;
      S.filter = "";
    }
    S.active = page;
    navigation();
    const allowed = sections.find(
      (s) => s[0] === page && s[3].includes(S.me.role),
    );
    if (!allowed) {
      permissions();
      return;
    }
    main.innerHTML = '<div class="loading">جارٍ تحميل أدوات الإدارة…</div>';
    try {
      if (["dashboard", "leaderboard"].includes(page))
        await dashboard(page === "leaderboard");
      else if (page === "alerts") await alertsPage();
      else if (page === "order-requests") await orderRequestsPage();
      else if (
        ["orders", "deposits", "verification", "users", "ledger", "audit"].includes(page)
      )
        await listPage(page);
      else if (["categories", "products", "banners"].includes(page))
        await catalogPage(page);
      else if (
        ["payments", "promotions", "notifications"].includes(page)
      )
        publicListPage(page);
      else if (page === "settings") await settings();
      else if (page === "rates") rates();
      else if (page === "vip") vip();
      else if (page === "policies") policies();
      else if (page === "providers") await providers();
      else if (page === "infrastructure") await infrastructurePage();
      else if (page === "integration") integrationCenter();
      else if (page === "design-center") designCenter();
      else if (page === "traders") await traders();
    } catch (err) {
      main.innerHTML =
        head("تعذّر فتح الأدوات") +
        `<div class="notice error">${e(errorMessage(err))}</div><button class="button" data-action="reload">حاول مجددًا</button>`;
    }
  }
  async function submit(form, d, submitter) {
    if (form.id === "orderRequestReviewForm") {
      await A.call("staff.review_order_request", {
        id: S.reviewRequestId, status: d.status, note: d.note,
      });
      closeModal();
      toast("حُفظ القرار وسيظهر للعميل في صفحة طلبه");
      return orderRequestsPage();
    }
    if (form.id === "ledgerFilterForm") {
      if (d.from && d.to && d.from > d.to) throw new Error("تاريخ البداية بعد تاريخ النهاية");
      S.ledgerFilter = { ledger_kind: d.ledger_kind, customer_id: d.customer_id.trim(), from: d.from, to: d.to };
      S.offset = 0;
      return listPage("ledger");
    }
    if (form.id === "catalogForm") return saveCatalog(form, d);
    if (form.id === "dynamicForm") return saveDynamic(form, d);
    if (form.id === "settingsForm") return saveSettings(form, d);
    if (form.id === "searchUsers") {
      S.search = d.search;
      S.offset = 0;
      return listPage("users");
    }
    if (form.id === "orderActionForm") {
      await A.call("staff.order", {
        id: S.detail.id,
        status: d.status,
        note: d.note,
        provider_order_id: d.provider_order_id,
        cost_usd: manager()
          ? d.cost_usd === ""
            ? null
            : Number(d.cost_usd)
          : undefined,
      });
      closeModal();
      toast("تم تحديث الطلب");
      return listPage("orders");
    }
    if (
      form.id === "reviewDepositForm" ||
      form.id === "reviewVerificationForm"
    ) {
      const verification = form.id === "reviewVerificationForm";
      await A.call(
        verification ? "staff.review_verification" : "staff.review_deposit",
        { id: S.detail.id, approve: submitter?.value === "yes", note: d.note },
      );
      closeModal();
      toast(verification ? "تمت مراجعة التوثيق" : "تمت مراجعة الإيداع");
      return listPage(verification ? "verification" : "deposits");
    }
    if (form.id === "userForm") {
      await A.call("staff.user", {
        id: S.detail.id,
        role: d.role,
        status: d.status,
        vip: d.vip || null,
        clear_vip: !d.vip,
      });
      closeModal();
      toast("حُفظت حالة وصلاحيات الحساب");
      return listPage("users");
    }
    if (form.matches(".rateForm") || form.id === "newRateForm") {
      await A.call("staff.rate", {
        currency: form.dataset.currency || d.currency,
        name_ar: d.name_ar,
        per_usd: Number(d.per_usd),
        is_enabled:
          form.id === "newRateForm" || form.elements.is_enabled.checked,
      });
      await refreshSettings();
      rates();
      toast("تم ضبط الصرف");
      return;
    }
    if (form.matches(".vipForm")) {
      await A.call("staff.vip", {
        level: Number(form.dataset.level),
        minimum_spend: Number(d.minimum_spend),
        discount_percent: Number(d.discount_percent),
      });
      await refreshSettings();
      vip();
      toast("تم ضبط المستوى");
      return;
    }
    if (form.id === "policiesForm") {
      const pages = { ...S.settings.config.pages };
      for (const [k, v] of Object.entries(d))
        if (k.startsWith("page_")) pages[k.slice(5)] = { ar: v, enabled: true };
      await configSave({
        pages,
        policy_updated: new Intl.DateTimeFormat("ar", {
          dateStyle: "long",
          timeZone: "Asia/Hebron",
        }).format(new Date()),
      });
      toast("تم حفظ السياسات");
      return;
    }
    if (form.id === "providerForm") {
      await A.call("provider.save", {
        id: S.edit?.id,
        name: d.name,
        endpoint: d.endpoint,
        adapter: d.adapter,
        currency: d.currency,
        token: d.token || undefined,
        margin_percent: Number(d.margin_percent),
        request_timeout_ms: Number(d.request_timeout_ms),
        automatic_orders_enabled: form.elements.automatic_orders_enabled.checked,
      });
      closeModal();
      toast("تم حفظ المورّد");
      return providers();
    }
    if (form.id === "importForm") {
      const fx = S.rates.find((rate) => rate.currency === S.importProvider?.currency);
      const perUSD = Number(fx?.per_usd);
      if (!fx?.is_enabled || !(perUSD > 0)) throw new Error("اضبط سعر صرف عملة المورّد قبل الاستيراد");
      const margin = Number(d.margin_percent);
      if (!Number.isFinite(margin) || margin < 0 || margin > 10000) throw new Error("هامش الربح غير صالح");
      if (!d.category_id || !S.categories.some((category) => category.id === d.category_id))
        throw new Error("اختر قسمًا صحيحًا لحفظ الخدمات");
      const selected = [];
      const names = {};
      const categoryIds = {};
      const quotes = [];
      S.importServices.slice(0, 1000).forEach((service, n) => {
        if (!form.elements["service_" + n]?.checked) return;
        const name = form.elements["name_" + n]?.value.trim();
        if (!name || name.length > 200) throw new Error("اكتب اسمًا صالحًا لكل خدمة تختارها");
        if (!Number.isFinite(Number(service.rate)) || Number(service.rate) <= 0)
          throw new Error("سعر المورّد غير صالح للخدمة " + String(service.id));
        const rate = Math.round((Number(service.rate) / perUSD) * (1 + margin / 100) * 1e6) / 1e6;
        if (!(rate > 0)) throw new Error("السعر المتوقع غير صالح للخدمة " + String(service.id));
        selected.push(service.id);
        names[service.id] = name;
        categoryIds[service.id] = form.elements["category_" + n]?.value || "";
        if (!S.categories.some((c) => c.id === categoryIds[service.id]))
          throw new Error("اختر قسمًا صالحًا للخدمة " + service.id);
        quotes.push({ id: String(service.id), name, rate, unit: service.unit_quantity, category: S.categories.find((c) => c.id === categoryIds[service.id])?.name || "" });
      });
      if (!selected.length) throw new Error("اختر خدمة واحدة على الأقل");
      if (selected.length > 100) throw new Error("استورد حتى مئة خدمة في المرة الواحدة");
      if (new Set(selected.map(String)).size !== selected.length) throw new Error("توجد معرّفات خدمات مكررة؛ راجع قائمة المورّد");
      const provider = S.importProvider;
      S.pendingProviderImport = {
        providerId: provider.id,
        service_ids: [...selected],
        names: { ...names },
        category_ids: { ...categoryIds },
        category_id: d.category_id,
        margin_percent: margin,
      };
      const category = S.categories.find((c) => c.id === d.category_id);
      modal(
        "تأكيد استيراد مسودات المورّد",
        `<div class="notice warning">راجع البيانات قبل المتابعة. سيتم حفظ المنتجات كمسودات غير منشورة فقط. الأسعار النهائية تُحتسب على الخادم عند الاستيراد وقد تتغير إذا تغيّر سعر المورّد.</div><div class="f90-import-confirm-stats"><div><small>المورّد</small><strong>${e(provider.name)}</strong></div><div><small>القسم</small><strong>${e(category?.name || "")}</strong></div><div><small>الخدمات</small><strong>${selected.length}</strong></div><div><small>هامش الربح</small><strong>${e(margin)}%</strong></div></div><div class="table-wrap f90-import-confirm-table"><table><thead><tr><th>الخدمة</th><th>سعر البيع التقريبي بالدولار</th></tr></thead><tbody>${quotes.slice(0, 20).map((quote) => `<tr><td>${e(quote.name)}</td><td>${e(C.money(quote.rate))} / ${e(quote.unit)}</td></tr>`).join("")}</tbody></table></div>${quotes.length > 20 ? `<p class="muted">معروض 20 من ${quotes.length} خدمة. بقية الاختيارات محفوظة ضمن هذه الدفعة.</p>` : ""}<div class="actions"><button type="button" class="button secondary" data-action="close-modal">رجوع للمراجعة</button><button type="button" class="button" data-action="confirm-provider-import">تأكيد إنشاء المسودات</button></div>`,
      );
      return;
    }
    if (form.id === "traderKeyForm" || form.id === "traderKeySettingsForm") {
      const scopes = ["catalog", "balance", "orders"].filter((scope) => form.elements["scope_" + scope]?.checked);
      if (!scopes.length) throw new Error("اختر صلاحية واحدة على الأقل");
      const values = { name: d.name, scopes, requests_per_minute: Number(d.requests_per_minute), expires_at: d.expires_at || null };
      if (form.id === "traderKeySettingsForm") {
        await A.call("key.update", { id: S.editKey.id, ...values });
        toast("حُفظت إعدادات المفتاح");
        closeModal();
        return;
      }
      const key = await A.call("key.create", { user_id: S.detail.id, ...values });
      modal(
        "احفظ مفتاح التاجر",
        `<p class="muted">يظهر مرة واحدة. سلّمه للتاجر عبر وسيلتك المعتادة، ولا تنشره.</p><div class="key-token">${e(key.token)}</div><button class="button secondary" style="margin-top:15px" data-action="copy-key" data-key="${e(key.token)}">نسخ المفتاح</button>`,
      );
      return;
    }
    if (form.id === "adminAuth") {
      const r = await A.client.auth.signInWithPassword({
        email: d.email,
        password: d.password,
      });
      if (r.error)
        throw new Error("بيانات الدخول غير صحيحة أو الحساب غير مفعّل");
      await boot();
      return;
    }
    if (form.id === "adminMfa") {
      const factors = await A.client.auth.mfa.listFactors();
      const f = factors.data?.totp?.find((f) => f.status === "verified");
      if (!f) throw new Error("لم يوجد عامل مصادقة مفعّل");
      const r = await A.client.auth.mfa.challengeAndVerify({
        factorId: f.id,
        code: d.code,
      });
      if (r.error) throw new Error("رمز التحقق غير صحيح");
      await boot();
      return;
    }
  }
  document.addEventListener("submit", async (ev) => {
    const form = ev.target;
    ev.preventDefault();
    if (form.dataset.busy) return;
    form.dataset.busy = "1";
    const buttons = [...form.querySelectorAll("button[type=submit]")];
    buttons.forEach((b) => (b.disabled = true));
    try {
      await submit(form, Object.fromEntries(new FormData(form)), ev.submitter);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      delete form.dataset.busy;
      buttons.forEach((b) => {
        if (b.isConnected) b.disabled = false;
      });
    }
  });
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-action]");
    if (!b) return;
    const action = b.dataset.action;
    try {
      if (action === "review-order-request") {
        S.reviewRequestId = b.dataset.id;
        modal("قرار طلب العميل", `<form id="orderRequestReviewForm">${select("status", "القرار", [["approved", "موافقة على المراجعة"], ["rejected", "رفض الطلب"]], "approved")}${field("note", "السبب والنتيجة للعميل", "textarea", "", 'required minlength="3" maxlength="2000"')}<p class="muted small">هذا القرار لا يلغي الطلب ولا يعيد الرصيد تلقائيًا. راجع حالة التنفيذ لدى المورّد أولًا.</p><button class="button" type="submit">حفظ القرار</button></form>`);
      } else if (action === "request-order") {
        const linked = S.list.find((x) => x.id === b.dataset.id)?.order;
        if (!linked?.id) throw new Error("تعذّر تحميل الطلب المرتبط");
        detailOrder(linked);
      } else if (action === "refresh-alerts") {
        await alertsPage();
      } else
      if (action === "provider-toggle") {
        const provider = S.providerRows?.find((p) => p.id === b.dataset.id);
        if (!provider) throw new Error("المورّد غير موجود");
        const enable = b.dataset.enabled === "true";
        S.pendingProviderToggle = { id: provider.id, enable };
        modal(enable ? "إعادة تفعيل المورّد" : "إيقاف خدمات المورّد",
          `<p>${enable ? "ستعود الخدمات المنشورة للبيع وفق حالتها السابقة." : "ستبقى الخدمات المنشورة ظاهرة مع علامة «قيد التعبئة» ولن يقبل المتجر شراءها حتى إعادة التفعيل."}</p><strong>${e(provider.name)}</strong><div class="actions" style="margin-top:16px"><button type="button" class="button secondary" data-action="close-modal">إلغاء</button><button type="button" class="button" data-action="provider-toggle-confirm">تأكيد</button></div>`);
      } else if (action === "provider-toggle-confirm") {
        const pending = S.pendingProviderToggle;
        if (!pending || b.disabled) return;
        b.disabled = true;
        try {
          await A.call("provider.toggle", { id: pending.id, is_enabled: pending.enable });
          S.pendingProviderToggle = null;
          closeModal();
          toast(pending.enable ? "تم تفعيل المورّد" : "تم إيقاف خدمات المورّد");
          await providers();
        } finally { if (b.isConnected) b.disabled = false; }
      } else if (action === "bulk-fulfillment") { const chosen = selectedBulkProducts(); if (!chosen.length) throw new Error("حدد منتجًا واحدًا على الأقل"); if (!manager()) throw new Error("هذا الإجراء متاح للمدير فقط"); const mode = b.dataset.mode; if (!["manual","automatic"].includes(mode)) throw new Error("طريقة تنفيذ غير صحيحة"); pendingBulk = { ids: chosen.map(p => p.id), mode: "fulfillment", fulfillment: mode }; modal("تعديل طريقة شحن " + chosen.length + " منتج", `<p>تغيير طريقة التنفيذ إلى ${mode === "automatic" ? "آلي عبر المورّد المرتبط" : "يدوي"} للمنتجات المحددة فقط. لن تتغير الأسعار أو الصور.</p><button class="button" data-action="bulk-confirm">تأكيد الحفظ</button><p id="bulkProgress" class="muted small"></p>`); } else if (action === "bulk-select-visible") {
        document.querySelectorAll(".f90-bulk-check").forEach((el) => { el.checked = el.closest(".catalog-row")?.style.display !== "none"; });
        updateBulkCount();
      } else if (action === "bulk-clear") {
        document.querySelectorAll(".f90-bulk-check").forEach((el) => { el.checked = false; });
        updateBulkCount();
      } else if (["bulk-visibility", "bulk-move", "bulk-image", "bulk-delete"].includes(action)) {
        if (bulkBusy) return;
        const chosen = selectedBulkProducts();
        if (!chosen.length) throw new Error("حدد منتجًا واحدًا على الأقل");
        const mode = action === "bulk-move" ? "move" :
          action === "bulk-image" ? "image" : action === "bulk-delete" ? "delete" :
          b.dataset.active === "true" ? "show" : "hide";
        pendingBulk = { ids: chosen.map((p) => p.id), mode };
        modal("تأكيد تعديل " + chosen.length + " منتج", `<p>ستُطبق العملية على ${chosen.length} منتج محدد فقط. تبقى سجلات الطلبات القديمة محفوظة.</p>${mode === "move" ? select("bulkTargetCategory", "القسم المستهدف", categoryOptions(false), S.categoryFilter || "").replace("<select ", '<select id="bulkTargetCategory" ') : ""}${mode === "image" ? '<label>رابط الصورة الموحدة (اتركه فارغًا لإزالة الصور)<input id="bulkImageURL" type="url" placeholder="https://..." dir="ltr"></label><label>أو ارفع صورة موحدة<input id="bulkImageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>' : ""}${mode === "delete" ? '<p class="notice warning">حذف المنتجات نهائي، ولن تُعاد إلا باستيرادها من المورد.</p>' : ""}<button class="button ${mode === "delete" ? "danger" : ""}" data-action="bulk-confirm">تأكيد التنفيذ</button><p class="muted small" id="bulkProgress"></p>`);
      } else if (action === "bulk-confirm") {
        if (!pendingBulk || bulkBusy) return;
        const pending = pendingBulk;
        if (pending.mode === "move") {
          const target = $("bulkTargetCategory")?.value;
          if (!S.categories.some((c) => c.id === target)) throw new Error("اختر قسمًا صحيحًا");
          pending.categoryId = target;
        }
        bulkBusy = true;
        b.disabled = true;
        try {
          const summary = await runBulkProducts(pending, $("bulkProgress"));
          pendingBulk = null;
          closeModal();
          toast("تم تعديل " + summary.done + " منتج، وتعذّر " + summary.failed);
          await catalogPage("products");
        } finally {
          bulkBusy = false;
          if (b.isConnected) b.disabled = false;
        }
      } else if (action === "erase-identity") {
        modal(
          "حذف صور التوثيق",
          `<p>ستُحذف الصور الخاصة، ويبقى سجل قرار المراجعة. استخدم ذلك بعد طلب العميل أو وفق سياسة الاحتفاظ.</p><button class="button danger" data-action="confirm-erase-identity">تأكيد حذف الصور</button>`,
        );
      } else if (action === "provider-visibility") {
        const provider = S.providerRows?.find((p) => p.id === b.dataset.id);
        if (!provider) throw new Error("المورّد غير موجود");
        const disconnected = !provider.config?.disconnected;
        modal(disconnected ? "إخفاء الخدمات وقطع الاتصال" : "إعادة الاتصال",
          `<p>${disconnected ? "ستختفي منتجات هذا المورد من المتجر. سيبقى مفتاحه وإعداداته محفوظة لإعادتها لاحقًا." : "سيتحقق الموقع من قائمة خدمات المورد قبل إعادة إظهار المنتجات المنشورة."}</p><button class="button" data-action="provider-visibility-confirm" data-id="${e(provider.id)}" data-disconnected="${disconnected}">تأكيد</button>`);
      } else if (action === "provider-visibility-confirm") {
        await A.call("provider.visibility", { id: b.dataset.id, disconnected: b.dataset.disconnected === "true" });
        closeModal();
        toast("تم تحديث ظهور خدمات المورد");
        return providers();
      } else if (action === "provider-archive") {
        const provider = S.providerRows?.find((p) => p.id === b.dataset.id);
        if (!provider) throw new Error("المورّد غير موجود");
        modal("حذف المورّد ومنتجاته", `<p>ستُحذف جميع خدمات ${e(provider.name)} من المتجر ويُلغى مفتاحه. تبقى بيانات الطلبات السابقة محفوظة.</p><button class="button danger" data-action="provider-archive-confirm" data-id="${e(provider.id)}">تأكيد الحذف</button>`);
      } else if (action === "provider-archive-confirm") {
        await A.call("provider.archive", { id: b.dataset.id });
        closeModal();
        toast("حُذف المورّد من التشغيل");
        return providers();
      } else if (action === "omega-import-all") {
        const provider = S.importProvider;
        if (!provider || !["omega", "yassen"].includes(provider.adapter)) throw new Error("المورّد غير مدعوم");
        const count = S.importServices?.length || 0;
        if (!count) throw new Error("لا توجد خدمات للاستيراد");
        modal("تأكيد استيراد جميع خدمات المورّد",
          `<div class="notice warning">سيتم محاولة حفظ ${e(count)} خدمة كمسودات مخفية مع هامش ${e(provider.margin_percent)}٪. الأقسام غير المعروفة تُحفظ في قسم خدمات الموقع لمراجعتها، ولن تنفذ أي طلبات مدفوعة.</div><div id="omegaBulkStatus" role="status">لم يبدأ الاستيراد بعد.</div><div class="actions"><button class="button secondary" data-action="close-modal">إلغاء</button><button class="button" data-action="omega-import-all-confirm">بدء استيراد كل الخدمات</button></div>`);
      } else if (action === "omega-import-all-confirm") {
        if (S.omegaBulkBusy) return;
        const provider = S.importProvider;
        const status = $("omegaBulkStatus");
        if (!provider || !status) throw new Error("أعد فتح صفحة المورّد");
        S.omegaBulkBusy = true;
        b.disabled = true;
        try {
          const outcome = await importAllProviderDrafts(provider, status);
          status.textContent = "اكتمل الاستيراد: " + outcome.imported + " مسودة جديدة، " +
            outcome.skipped + " موجودة سابقًا، " + outcome.needsReview +
            " خدمة تحتاج مراجعة تصنيف. جميع المسودات مخفية.";
          toast("اكتمل استيراد الخدمات كمسودات. راجع المنتجات قبل نشرها.");
        } catch (err) {
          if (status) status.textContent = "توقّف الاستيراد: " + errorMessage(err) +
            ". الدفعات المكتملة محفوظة؛ أعد المحاولة لاستكمال المتبقي دون تكرارها.";
          throw err;
        } finally {
          S.omegaBulkBusy = false;
          if (b.isConnected) b.disabled = false;
        }
      } else if (action === "confirm-provider-import") {
        const pending = S.pendingProviderImport;
        if (!pending || pending.providerId !== S.importProvider?.id || !$("importForm"))
          throw new Error("انتهت صلاحية المعاينة. افتح استيراد المورّد من جديد.");
        if (b.dataset.busy) return;
        b.dataset.busy = "1";
        b.disabled = true;
        try {
          const result = await A.call("provider.import", { id: pending.providerId,
            service_ids: pending.service_ids, names: pending.names,
            category_ids: pending.category_ids,
            category_id: pending.category_id, margin_percent: pending.margin_percent });
          S.pendingProviderImport = null;
          closeModal();
          toast("انتهى الاستيراد. راجع المنتجات المخفية قبل النشر.");
          location.hash = "#/products";
          if (location.hash === "#/products") await catalogPage("products");
        } catch (err) {
          toast(errorMessage(err));
        } finally {
          if (b.isConnected) { b.disabled = false; delete b.dataset.busy; }
        }
      } else if (action === "confirm-erase-identity") {
        await A.call("staff.erase_verification", { id: S.detail.id });
        closeModal();
        toast("حُذفت صور المستند");
        await listPage("verification");
      } else if (action === "close-modal") { if (!S.omegaBulkBusy) closeModal(); }
      else if (action === "reload") await route();
      else if (action === "next" || action === "prev") {
        S.offset = Math.max(0, S.offset + (action === "next" ? 50 : -50));
        await (S.active === "traders" ? traders() : S.active === "order-requests" ? orderRequestsPage() : listPage(S.active));
      } else if (action === "detail-order")
        detailOrder(S.list.find((x) => x.id === b.dataset.id));
      else if (action === "detail-deposit")
        await detailDeposit(S.list.find((x) => x.id === b.dataset.id));
      else if (action === "detail-verification")
        await detailVerification(S.list.find((x) => x.id === b.dataset.id));
      else if (action === "detail-user")
        detailUser(S.list.find((x) => x.id === b.dataset.id));
      else if (action === "verification-image") {
        const r = await A.call("staff.file", {
          kind: "verification",
          id: S.detail.id,
          part: b.dataset.part,
        });
        $("identityImage").innerHTML =
          `<img class="receipt-preview" src="${e(r.signedUrl)}" alt="مستند توثيق خاص">`;
      } else if (action === "find-user") {
        const r = await A.call("staff.list", {
          kind: "users",
          user_id: b.dataset.id,
        });
        if (r.items[0]) detailUser(r.items[0]);
      } else if (action === "reset-user") {
        await A.call("staff.reset_password", {
          id: S.detail.id,
          redirect_to: new URL("./index.html", location.href).href + "#/reset",
        });
        toast("أُرسل رابط الاستعادة إلى بريد العميل");
      } else if (action === "trader-keys") {
        const keys = await A.call("staff.trader_keys", {
          user_id: S.detail.id,
        });
        S.traderKeys = keys;
        modal("مفاتيح التاجر", `<div class="records">${keys.map((k) => `<article class="record"><div class="record-main"><h3>${e(k.name)}</h3><p dir="ltr">${e(k.token_prefix)}</p><p class="muted small">${e(k.scopes.join("، "))} · ${e(k.requests_per_minute)} طلب/دقيقة · انتهاء ${e(k.expires_at ? C.date(k.expires_at) : "بلا تاريخ")} · آخر استخدام ${e(k.last_used_at ? C.date(k.last_used_at) : "لم يستخدم")}</p>${status(k.is_active ? "active" : "suspended")}</div><div class="actions"><button class="button secondary small" data-action="trader-key-logs" data-id="${e(k.id)}">سجل الاستخدام</button>${k.is_active ? `<button class="button secondary small" data-action="edit-trader-key" data-id="${e(k.id)}">الإعدادات</button><button class="button ghost small" data-action="revoke-trader-key" data-id="${e(k.id)}">إلغاء</button>` : ""}</div></article>`).join("") || empty("لا توجد مفاتيح بعد")}</div>`);
      } else if (action === "revoke-trader-key") {
        await A.call("key.revoke", { id: b.dataset.id });
        toast("أُلغي المفتاح");
        b.closest(".record").remove();
      } else if (action === "create-trader-key") {
        modal(
          "مفتاح حساب التاجر",
          `<form id="traderKeyForm">${field("name", "اسم المفتاح", "text", "متجر العميل", 'required maxlength="100"')}${check("scope_catalog", "قراءة الأقسام والخدمات", true)}${check("scope_balance", "قراءة الرصيد", true)}${check("scope_orders", "إنشاء ومتابعة الطلبات", true)}${field("requests_per_minute", "طلبات في الدقيقة (10–120)", "number", 60, 'min="10" max="120" required')}${field("expires_at", "انتهاء المفتاح (اختياري، خلال سنة)", "date")}<button class="button" type="submit">إنشاء</button></form>`,
        );
      } else if (action === "edit-trader-key") {
        const k = S.traderKeys?.find((item) => item.id === b.dataset.id);
        if (!k) throw new Error("المفتاح غير موجود");
        S.editKey = k;
        modal("إعدادات مفتاح التاجر", `<form id="traderKeySettingsForm">${field("name", "اسم المفتاح", "text", k.name, 'required maxlength="100"')}${check("scope_catalog", "قراءة الأقسام والخدمات", k.scopes.includes("catalog"))}${check("scope_balance", "قراءة الرصيد", k.scopes.includes("balance"))}${check("scope_orders", "إنشاء ومتابعة الطلبات", k.scopes.includes("orders"))}${field("requests_per_minute", "طلبات في الدقيقة (10–120)", "number", k.requests_per_minute, 'min="10" max="120" required')}${field("expires_at", "انتهاء المفتاح (اختياري، خلال سنة)", "date", k.expires_at?.slice(0, 10) || "")}<button class="button" type="submit">حفظ الإعدادات</button></form>`);
      } else if (action === "trader-key-logs") {
        const logs = await A.call("key.logs", { id: b.dataset.id });
        modal("استخدام المفتاح", `<div class="records">${logs.map((x) => `<article class="record"><strong>${e(x.action)}</strong><span>${e(x.http_status)} · ${e(C.date(x.created_at))}</span></article>`).join("") || empty("لا استخدام مسجّل بعد")}</div>`);
      } else if (action === "copy-key") {
        await navigator.clipboard.writeText(b.dataset.key);
        toast("تم النسخ");
      } else if (action === "import-clear-selection") {
        document.querySelectorAll('#importForm [data-provider-service-row] input[type="checkbox"]').forEach((box) => { box.checked = false; });
        updateProviderImportPreview();
      } else if (action === "import-select-visible") {
        const form = $("importForm");
        if (!form) return;
        const rows = [...form.querySelectorAll("[data-provider-service-row]")];
        let selected = rows.filter((row) => row.querySelector('input[type="checkbox"]')?.checked).length;
        for (const row of rows) {
          if (row.hidden || selected >= 100) continue;
          const box = row.querySelector('input[type="checkbox"]');
          if (box && !box.checked && !box.disabled) { box.checked = true; selected++; }
        }
        updateProviderImportPreview();
      } else if (action === "catalog-new") editCatalog(S.kind);
      else if (action === "catalog-edit") {
        const list =
          S[
            S.kind === "category"
              ? "categories"
              : S.kind === "product"
                ? "products"
                : "banners"
          ];
        editCatalog(
          S.kind,
          list.find((x) => x.id === b.dataset.id),
        );
      } else if (action === "back-catalog")
        await catalogPage(
          S.kind === "category"
            ? "categories"
            : S.kind === "product"
              ? "products"
              : "banners",
        );
      else if (action === "pick-image") {
        $("imageURL").value = b.dataset.url;
        $("imagePreview").innerHTML = image(
          b.dataset.url,
          "الصورة المختارة",
          "editor-preview",
        );
      } else if (action === "clear-image") {
        $("imageURL").value = "";
        $("imagePreview").innerHTML = image("", "", "editor-preview");
        const f = document.querySelector("[name=image_file]");
        if (f) f.value = "";
      } else if (action === "add-field") {
        const rows = $("customerFields");
        rows.insertAdjacentHTML(
          "beforeend",
          fieldsRows([
            {
              id: "field_" + C.key().slice(0, 8),
              label_ar: "بيانات الخدمة",
              type: "text",
              required: true,
            },
          ]).replaceAll("_0", "_" + rows.children.length),
        );
      } else if (action === "add-tier") {
        const rows = $("tierRows");
        rows.insertAdjacentHTML(
          "beforeend",
          tiersRows([{ min: 1, prices: { USD: 1 } }]).replaceAll(
            "_0",
            "_" + rows.children.length,
          ),
        );
      } else if (action === "add-social") {
        const rows = $("socialRows");
        rows.insertAdjacentHTML(
          "beforeend",
          socialRow({}, rows.children.length),
        );
      } else if (action === "remove-row") b.closest(".dynamic-row").remove();
      else if (action === "catalog-duplicate") {
        S.pending = { kind: S.kind, id: b.dataset.id };
        modal(
          "تكرار العنصر",
          `<p>تبدأ النسخة مخفية، ويمكنك تعديل اسمها وصورتها ثم نشرها.</p>${S.kind === "category" ? '<label class="check-field"><input type="checkbox" id="duplicateContents">تكرار المنتجات والأقسام الفرعية أيضًا</label>' : ""}<button class="button" data-action="confirm-duplicate">إنشاء نسخة</button>`,
        );
      } else if (action === "confirm-duplicate") {
        await A.call("catalog.duplicate", {
          ...S.pending,
          with_products: !!$("duplicateContents")?.checked,
          with_children: !!$("duplicateContents")?.checked,
        });
        closeModal();
        toast("تم إنشاء النسخة");
        await route();
      } else if (action === "catalog-delete") {
        S.pending = { kind: S.kind, id: b.dataset.id };
        modal(
          "حذف العنصر",
          '<p>سيُحذف من كتالوج المتجر. تبقى سجلات الطلبات السابقة محفوظة. يجب نقل محتويات القسم قبل حذفه.</p><button class="button danger" data-action="confirm-delete">تأكيد الحذف</button>',
        );
      } else if (action === "confirm-delete") {
        await A.call("catalog.delete", S.pending);
        closeModal();
        toast("حُذف العنصر");
        await route();
      } else if (action === "catalog-link") {
        const item = S[
          S.kind === "category"
            ? "categories"
            : S.kind === "product"
              ? "products"
              : "banners"
        ].find((x) => x.id === b.dataset.id);
        const url = new URL("./index.html", location.href);
        url.hash =
          S.kind === "banner"
            ? "#/"
            : `#/${S.kind}/${encodeURIComponent(item.slug || item.id)}`;
        await navigator.clipboard.writeText(url.href);
        toast("نُسخ الرابط");
      } else if (action === "move-up" || action === "move-down") {
        const list =
          S[
            S.kind === "category"
              ? "categories"
              : S.kind === "product"
                ? "products"
                : "banners"
          ];
        const ids = list.map((x) => x.id);
        const visible = [...main.querySelectorAll(".catalog-row[data-row-id]")].map((row) => row.dataset.rowId);
        const position = visible.indexOf(b.dataset.id);
        const neighbor = visible[position + (action === "move-up" ? -1 : 1)];
        const index = ids.indexOf(b.dataset.id), to = ids.indexOf(neighbor);
        if (position >= 0 && index >= 0 && to >= 0) {
          [ids[index], ids[to]] = [ids[to], ids[index]];
          await reorder(S.kind, ids);
        }
      } else if (action === "monitor-refresh") {
        await infrastructurePage();
      } else if (action === "dynamic-new") editDynamic(S.dynamicKind);
      else if (action === "dynamic-edit")
        editDynamic(
          S.dynamicKind,
          S.dynamicItems[Number(b.dataset.index)],
          Number(b.dataset.index),
        );
      else if (action === "back-dynamic") publicListPage(S.dynamicKind);
      else if (
        [
          "dynamic-up",
          "dynamic-down",
          "dynamic-duplicate",
          "dynamic-delete",
        ].includes(action)
      ) {
        const rows = [...S.dynamicItems],
          n = Number(b.dataset.index);
        if (action === "dynamic-duplicate")
          rows.splice(n + 1, 0, { ...rows[n], id: C.key(), enabled: false });
        else if (action === "dynamic-delete") {
          S.pending = { kind: S.dynamicKind, index: n };
          modal(
            "إزالة العنصر",
            '<p>هل تريد إزالة هذا العنصر من الإعدادات؟</p><button class="button danger" data-action="confirm-dynamic-delete">إزالة</button>',
          );
          return;
        } else {
          const to = n + (action === "dynamic-up" ? -1 : 1);
          if (to < 0 || to >= rows.length) return;
          [rows[n], rows[to]] = [rows[to], rows[n]];
        }
        await configSave({ [configKey(S.dynamicKind)]: rows });
        publicListPage(S.dynamicKind);
        toast("حُفظ التعديل");
      } else if (action === "confirm-dynamic-delete") {
        const rows = [...S.settings.config[configKey(S.pending.kind)]];
        rows.splice(S.pending.index, 1);
        await configSave({ [configKey(S.pending.kind)]: rows });
        closeModal();
        publicListPage(S.pending.kind);
        toast("تمت الإزالة");
      } else if (action === "provider-new") editProvider();
      else if (action === "provider-edit")
        editProvider(S.providerRows.find((x) => x.id === b.dataset.id));
      else if (action === "provider-import") {
        b.disabled = true;
        await importProvider(S.providerRows.find((x) => x.id === b.dataset.id));
      } else if (action === "provider-sync") {
        const provider = S.providerRows?.find((item) => item.id === b.dataset.id);
        if (!provider) throw new Error("لم يُعثر على المورّد");
        if (b.disabled) return;
        b.disabled = true;
        try {
          const preview = await A.call("provider.sync_prices", { id: provider.id, dry_run: true });
          S.priceSyncPreview = { providerId: provider.id, preview };
          modal("معاينة مزامنة أسعار " + provider.name,
            `<div class="notice warning">هذا فحص للقراءة فقط. لا تتغير أسعار المنتجات إلا بعد تأكيدك. إذا تغيّرت بيانات المورّد قبل التأكيد سيعيد الخادم التحقق.</div><div class="f90-import-confirm-stats"><div><small>منتجات مرتبطة</small><strong>${e(preview.mapped)}</strong></div><div><small>خدمات متاحة</small><strong>${e(preview.ready)}</strong></div><div><small>أسعار ستتغير</small><strong>${e(preview.changing)}</strong></div><div><small>منتجات منشورة متأثرة</small><strong>${e(preview.activeChanging)}</strong></div></div>${preview.missing ? `<div class="notice warning">هناك ${e(preview.missing)} خدمات لم يُعثر عليها لدى المورّد، وسيتم تخطيها.</div>` : ""}<div class="table-wrap f90-import-confirm-table"><table><thead><tr><th>معرّف المنتج</th><th>السعر الحالي $</th><th>السعر الجديد $</th></tr></thead><tbody>${(preview.samples || []).map((item) => `<tr><td dir="ltr">${e(item.id)}</td><td>${e(C.money(item.old_price_usd))}</td><td>${e(C.money(item.new_price_usd))}</td></tr>`).join("") || '<tr><td colspan="3">لا توجد فروقات في الأسعار</td></tr>'}</tbody></table></div><div class="actions"><button type="button" class="button secondary" data-action="close-modal">إلغاء</button><button type="button" class="button danger" data-action="confirm-provider-sync" data-id="${e(provider.id)}">تأكيد المزامنة بعد مراجعة الأسعار</button></div>`);
        } finally {
          if (b.isConnected) b.disabled = false;
        }
      } else if (action === "confirm-provider-sync") {
        const pending = S.priceSyncPreview;
        const provider = S.providerRows?.find((item) => item.id === b.dataset.id);
        if (!pending || !provider || pending.providerId !== provider.id ||
            !$("modalRoot").querySelector(".modal")) throw new Error("انتهت صلاحية المعاينة. عاين الأسعار مجددًا.");
        if (b.disabled) return;
        b.disabled = true;
        try {
          const result = await A.call("provider.sync_prices", {
            id: provider.id,
            confirm_count: String(pending.preview.changing),
            confirm_ready: String(pending.preview.ready),
            confirm_fingerprint: pending.preview.fingerprint,
          });
          S.priceSyncPreview = null;
          closeModal();
          toast("تمت مراجعة ومزامنة " + result.updated + " خدمة. تحقق من الأسعار المنشورة.");
        } finally {
          if (b.isConnected) b.disabled = false;
        }
      } else if (action === "provider-diagnose-all") {
        const output = $("providerDiagnostics");
        if (output) output.textContent = "جارٍ فحص المورّدين...";
        const lines = [];
        for (const provider of S.providerRows) {
          const checks = [];
          for (const [label, operation] of [["الرصيد", "provider.balance"], ["الخدمات", "provider.services"]]) {
            try {
              const result = await A.call(operation, { id: provider.id });
              checks.push(label + ": ناجح" + (operation === "provider.services" ? " (" + (Array.isArray(result) ? result.length : 0) + ")" : ""));
            } catch (err) {
              checks.push(label + ": " + String(err?.message || err).slice(0, 180));
            }
          }
          lines.push("<p><strong>" + e(provider.name) + "</strong>: " + checks.map(e).join(" | ") + "</p>");
          if (output) output.innerHTML = lines.join("");
        }
      } else if (action === "provider-diagnose") {
        const results = [];
        for (const [label, endpoint] of [["الرصيد", "provider.balance"], ["الخدمات", "provider.services"]]) {
          try {
            const result = await A.call(endpoint, { id: b.dataset.id });
            const detail = endpoint === "provider.services" ? ("عدد الخدمات: " + (Array.isArray(result) ? result.length : "استجابة غير متوقعة")) : ("الرصيد: " + String(result?.balance ?? result?.amount ?? "غير متاح") + " " + String(result?.currency ?? ""));
            results.push("<p><strong>" + label + ": ناجح</strong> — " + e(detail) + "</p>");
          } catch (error) {
            results.push("<p><strong>" + label + ": فشل</strong> — " + e(String(error?.message || error).slice(0, 350)) + "</p>");
          }
        }
        modal("تشخيص اتصال المورّد", results.join("") + "<p class=\"admin-note\">فحص قراءة فقط؛ لا ينشئ طلبات ولا يخصم رصيدًا.</p>");
      } else if (action === "provider-balance") {
        const r = await A.call("provider.balance", { id: b.dataset.id });
        modal(
          "رصيد المورّد",
          `<p>${e(r.balance ?? r.amount ?? "غير متاح")} ${e(C.currencyNames[r.currency] || r.currency || "")}</p>`,
        );
      } else if (action === "worker") {
        modal("تأكيد تشغيل متابعة الطلبات", '<div class="notice warning">هذه ليست عملية فحص فقط. قد ترسل المتابعة طلبات تنفيذ فعلية إلى المورّدين المفعّلين. شغّلها فقط بعد مراجعة حالة الطلبات واتصال المورّد.</div><div class="actions"><button type="button" class="button secondary" data-action="close-modal">إلغاء</button><button type="button" class="button danger" data-action="confirm-provider-worker">تأكيد تشغيل المتابعة</button></div>');
      } else if (action === "confirm-provider-worker") {
        if (!$("modalRoot").querySelector(".modal") || b.disabled) return;
        b.disabled = true;
        try {
          const result = await A.call("staff.worker");
          closeModal();
          toast("جرت متابعة " + result.processed + " طلب");
        } finally {
          if (b.isConnected) b.disabled = false;
        }
      } else if (action === "ledger-reset") {
        S.ledgerFilter = { ledger_kind: "", customer_id: "", from: "", to: "" };
        S.offset = 0;
        await listPage("ledger");
      } else if (action === "ledger-csv") {
        const rows = [];
        for (let offset = 0; offset < 100000; offset += 50) {
          const batch = await A.call("staff.list", ledgerQuery(offset));
          if (batch.count > 100000) throw new Error("التصدير يتجاوز حد 100,000 حركة؛ ضيّق الفترة الزمنية");
          rows.push(...batch.items);
          if (rows.length >= batch.count || batch.items.length < 50) break;
        }
        window.F90Reports.downloadHistoryCSV("staff-ledger", rows.map((x) => ({
          customer_name: x.customer?.display_name || "",
          customer_id: x.customer?.customer_id || "",
          kind: x.kind, amount_usd: x.amount_usd,
          balance_before: ledgerBalanceBefore(x),
          balance_after: x.balance_after, reference_id: x.reference_id || "",
          description: x.description, created_at: x.created_at, id: x.id,
        })));
        toast("تم تجهيز " + rows.length + " حركة للتصدير");
      } else if (action === "report")
        await window.F90Reports.admin(S.report, S.settings.store_name);
      else if (action === "print-leaderboard") window.print();
      else if (action === "list-pdf")
        await window.F90Reports.staff(S.active, S.list, S.settings.store_name);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      if (b.isConnected) b.disabled = false;
    }
  });
  document.addEventListener("change", (ev) => {
    if (ev.target.id === "requestFilter") {
      S.filter = ev.target.value;
      S.offset = 0;
      orderRequestsPage().catch((err) => toast(errorMessage(err)));
      return;
    }
    if (ev.target.matches('#providerForm [name="adapter"]')) {
      const automatic = ev.target.form.elements.automatic_orders_enabled;
      automatic.disabled = ev.target.value === "omega";
      if (automatic.disabled) automatic.checked = false;
      return;
    }
    if (ev.target.matches('#importForm input[type="checkbox"]')) { updateProviderImportPreview(); return; }
    if (ev.target.id === "listFilter") {
      S.filter = ev.target.value;
      S.offset = 0;
      listPage(S.active).catch((err) => toast(errorMessage(err)));
    } else if (ev.target.id === "reportMonth") {
      S.month = ev.target.value;
      dashboard(S.active === "leaderboard").catch((err) =>
        toast(errorMessage(err)),
      );
    } else if (ev.target.matches(".f90-bulk-check")) {
      updateBulkCount();
    } else if (ev.target.id === "providerFilter") {
      S.providerFilter = ev.target.value;
      catalogPage("products").catch((err) => toast(errorMessage(err)));
    } else if (ev.target.id === "categoryFilter") {
      S.categoryFilter = ev.target.value;
      catalogPage("products");
    } else if (ev.target.id === "sectionFilter") {
      S.sectionFilter = ev.target.value;
      catalogPage("categories").catch((err) => toast(errorMessage(err)));
    } else if (ev.target.name === "image_file" && ev.target.files[0]) {
      const f = ev.target.files[0];
      if (f.size <= 5242880)
        $("imagePreview").innerHTML =
          `<img class="editor-preview" src="${URL.createObjectURL(f)}" alt="معاينة الصورة الجديدة">`;
    }
  });
  document.addEventListener("input", (ev) => {
    if (ev.target.id === "productNameSearch") { S.productSearch = ev.target.value; document.querySelectorAll(".catalog-list .catalog-row").forEach(row => { const p = S.products.find(x => x.id === row.dataset.rowId); row.style.display = String(p?.name || "").toLocaleLowerCase().includes(S.productSearch.toLocaleLowerCase()) ? "" : "none"; }); } if (ev.target.id === "providerServiceSearch" || ev.target.matches('#importForm [name="margin_percent"]')) updateProviderImportPreview();
    if (ev.target.id === "imageURL")
      $("imagePreview").innerHTML = image(
        ev.target.value,
        "معاينة الصورة",
        "editor-preview",
      );
  });
  // Pointer Events support both touchscreens and mouse without dragging the whole row.
  let touchSorting = null;
  document.addEventListener("pointerdown", (ev) => {
    const handle = ev.target.closest(".catalog-drag-handle");
    const row = handle?.closest(".catalog-row[data-row-id],.catalog-row[data-dynamic-index]");
    if (!row || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    if (touchSorting) return;
    const list = row.closest(".catalog-list");
    if (!list || !main.contains(list)) return;
    ev.preventDefault();
    touchSorting = {
      pointerId: ev.pointerId,
      handle,
      list,
      source: row.dataset.rowId ?? row.dataset.dynamicIndex,
      target: row.dataset.rowId ?? row.dataset.dynamicIndex,
      dynamic: row.hasAttribute("data-dynamic-index"),
      x: ev.clientX,
      y: ev.clientY,
      active: false,
    };
    handle.setPointerCapture?.(ev.pointerId);
  });
  document.addEventListener("pointermove", (ev) => {
    const drag = touchSorting;
    if (!drag || ev.pointerId !== drag.pointerId) return;
    if (!drag.active && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 9) return;
    drag.active = true;
    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(drag.dynamic ? ".catalog-row[data-dynamic-index]" : ".catalog-row[data-row-id]");
    drag.list.querySelectorAll(".drag-over, .touch-dragging").forEach((row) => row.classList.remove("drag-over", "touch-dragging"));
    const source = [...drag.list.querySelectorAll(drag.dynamic ? ".catalog-row[data-dynamic-index]" : ".catalog-row[data-row-id]")].find((row) => (row.dataset.rowId ?? row.dataset.dynamicIndex) === drag.source);
    source?.classList.add("touch-dragging");
    if (target && drag.list.contains(target)) {
      drag.target = target.dataset.rowId ?? target.dataset.dynamicIndex;
      target.classList.add("drag-over");
    }
    ev.preventDefault();
  }, { passive: false });
  async function endPointerSort(ev, cancel = false) {
    const drag = touchSorting;
    if (!drag || ev.pointerId !== drag.pointerId) return;
    touchSorting = null;
    drag.list.querySelectorAll(".drag-over, .touch-dragging").forEach((row) => row.classList.remove("drag-over", "touch-dragging"));
    if (drag.handle.hasPointerCapture?.(ev.pointerId)) drag.handle.releasePointerCapture(ev.pointerId);
    if (cancel || !drag.active || drag.source === drag.target || !drag.list.isConnected) return;
    if (drag.dynamic) {
      const from = Number(drag.source), to = Number(drag.target);
      const rows = [...S.dynamicItems];
      if (!Number.isInteger(from) || !Number.isInteger(to) || !rows[from] || !rows[to]) return;
      rows.splice(to,0,rows.splice(from,1)[0]);
      try {
        drag.list.setAttribute("aria-busy","true");
        await configSave({ [configKey(S.dynamicKind)]:rows });
        publicListPage(S.dynamicKind);
        toast("تم حفظ الترتيب مباشرة");
      } catch (err) {
        toast(errorMessage(err));
      } finally {
        drag.list.removeAttribute("aria-busy");
      }
      return;
    }
    const kind = S.kind;
    const items = S[kind === "category" ? "categories" : kind === "product" ? "products" : "banners"];
    const visible = [...drag.list.querySelectorAll(".catalog-row[data-row-id]")].map((row) => row.dataset.rowId);
    if (!visible.includes(drag.source) || !visible.includes(drag.target)) return;
    const ids = moveVisibleCatalogItem(items, visible, drag.source, drag.target);
    if (!ids) return;
    try {
      await reorder(kind, ids);
    } catch (err) {
      toast(errorMessage(err));
    }
  }
  document.addEventListener("pointerup", (ev) => { void endPointerSort(ev); });
  document.addEventListener("pointercancel", (ev) => { void endPointerSort(ev, true); });
  let dynamicDragFrom = null;
  document.addEventListener("dragstart",(ev)=>{
    const row = ev.target.closest(".catalog-row[data-dynamic-index]");
    if (!row || !S.dynamicKind) return;
    dynamicDragFrom = Number(row.dataset.dynamicIndex);
    ev.dataTransfer.setData("text/plain", String(dynamicDragFrom));
    ev.dataTransfer.effectAllowed = "move";
  });
  document.addEventListener("dragover",(ev)=>{
    if (dynamicDragFrom !== null && ev.target.closest(".catalog-row[data-dynamic-index]")) ev.preventDefault();
  });
  document.addEventListener("dragend",()=>{ dynamicDragFrom = null; });
  document.addEventListener("drop",async(ev)=>{
    const row = ev.target.closest(".catalog-row[data-dynamic-index]");
    if (!row || dynamicDragFrom === null || !S.dynamicKind) return;
    ev.preventDefault();
    ev.stopPropagation();
    const from = dynamicDragFrom, to = Number(row.dataset.dynamicIndex);
    dynamicDragFrom = null;
    if (from === to || from < 0 || to < 0) return;
    const rows = [...S.dynamicItems];
    if (!rows[from] || !rows[to]) return;
    rows.splice(to,0,rows.splice(from,1)[0]);
    try {
      row.closest(".catalog-list")?.setAttribute("aria-busy","true");
      await configSave({ [configKey(S.dynamicKind)]:rows });
      publicListPage(S.dynamicKind);
      toast("تم حفظ الترتيب مباشرة");
    } catch (err) {
      row.closest(".catalog-list")?.removeAttribute("aria-busy");
      toast(errorMessage(err));
    }
  });
  document.addEventListener("dragstart", (ev) => {
    const row = ev.target.closest("[data-row-id]");
    if (row) {
      dragId = row.dataset.rowId;
      ev.dataTransfer.setData("text/plain", dragId);
    }
  });
  document.addEventListener("dragover", (ev) => {
    const row = ev.target.closest("[data-row-id]");
    if (row) {
      ev.preventDefault();
      row.classList.add("drag-over");
    }
  });
  document.addEventListener("dragleave", (ev) =>
    ev.target.closest("[data-row-id]")?.classList.remove("drag-over"),
  );
  document.addEventListener("drop", async (ev) => {
    const row = ev.target.closest("[data-row-id]");
    if (!row) return;
    ev.preventDefault();
    row.classList.remove("drag-over");
    const list = S[S.kind === "category" ? "categories" : S.kind === "product" ? "products" : "banners"];
    const visible = [...main.querySelectorAll(".catalog-row[data-row-id]")].map((item) => item.dataset.rowId);
    const ids = moveVisibleCatalogItem(list, visible, dragId, row.dataset.rowId);
    if (!ids) return;
    try {
      await reorder(S.kind, ids);
    } catch (err) {
      toast(errorMessage(err));
    }
  });
  $("adminMenu").innerHTML = I("menu");
  $("adminMenu").setAttribute("aria-expanded", "false");
  $("adminMenu").setAttribute("aria-controls", "adminSidebar");
  const adminHeader = document.querySelector(".admin-top");
  if (adminHeader) {
    const syncHeaderHeight = () => document.documentElement.style.setProperty("--f90-admin-header-height", Math.ceil(adminHeader.getBoundingClientRect().height) + "px");
    syncHeaderHeight();
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(syncHeaderHeight).observe(adminHeader);
    else window.addEventListener("resize", syncHeaderHeight, { passive: true });
  }
  const setAdminMenu = (open) => {
    document.body.classList.toggle("admin-menu-open", open);
    $("adminMenu").setAttribute("aria-expanded", String(open));
  };
  $("adminMenu").addEventListener("click", () =>
    setAdminMenu(!document.body.classList.contains("admin-menu-open")),
  );
  $("adminNav").addEventListener("click", (event) => {
    if (event.target.closest("a")) setAdminMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("admin-menu-open")) {
      setAdminMenu(false);
      $("adminMenu").focus();
    }
  });
  function applyAdminTheme(value) {
    const selected = ["dark", "cream"].includes(value) ? value : "dark";
    document.documentElement.dataset.theme = selected;
    const toggle = $("adminThemeToggle");
    if (toggle) {
      toggle.textContent = selected === "dark" ? "المظهر النهاري" : "المظهر الليلي";
      toggle.setAttribute("aria-pressed", String(selected !== "dark"));
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = selected === "cream" ? "#ded9d1" : "#090b10";
    try { localStorage.setItem("f90-theme", selected); } catch {}
  }
  $("adminThemeToggle")?.addEventListener("click", () => {
    applyAdminTheme(document.documentElement.dataset.theme === "dark" ? "cream" : "dark");
  });
  applyAdminTheme(document.documentElement.dataset.theme);
  $("adminLogout").addEventListener("click", async () => {
    await A.client.auth.signOut();
    location.href = "./index.html#/auth";
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      closeModal();
      document.body.classList.remove("admin-menu-open");
    }
    if (ev.key === "Tab") {
      const modal = document.querySelector(".modal");
      if (!modal) return;
      const els = [
        ...modal.querySelectorAll("a,button,input,select,textarea"),
      ].filter((x) => !x.disabled && !x.hidden);
      const first = els[0],
        last = els.at(-1);
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last?.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first?.focus();
      }
    }
  });
  window.addEventListener("hashchange", () => {
    S.offset = 0;
    S.filter = "";
    S.search = "";
    if (S.me && !S.me.needs_mfa) route();
  });
  async function boot() {
    try {
      await refreshSettings();
      const {
        data: { session },
      } = await A.client.auth.getSession();
      if (!session) {
        $("adminNav").innerHTML = "";
        brand();
        main.innerHTML = `<section class="panel admin-empty-auth"><div class="eyebrow">أف تسعين كارد</div><h1>دخول الإدارة</h1><form id="adminAuth">${field("email", "البريد الإلكتروني", "email", "", 'required autocomplete="email" dir="ltr"')}${field("password", "كلمة المرور", "password", "", 'required autocomplete="current-password"')}<button class="button full" type="submit">دخول</button></form></section>`;
        return;
      }
      S.me = await A.call("me");
      brand();
      if (S.me.needs_mfa) {
        main.innerHTML = `<section class="panel admin-empty-auth"><h1>تحقق من هويتك</h1><form id="adminMfa">${field("code", "رمز المصادقة", "text", "", 'required pattern="[0-9]{6}" inputmode="numeric" maxlength="6"')}<button class="button full" type="submit">تحقق</button></form></section>`;
        return;
      }
      const allowed = sections.filter((s) => s[3].includes(S.me.role));
      if (!allowed.length) {
        permissions();
        return;
      }
      if (!location.hash || !allowed.some((s) => "#/" + s[0] === location.hash))
        location.hash = "#/" + allowed[0][0];
      await route();
      clearInterval(alertsTimer);
      refreshAdminAlerts().catch(() => {});
      alertsTimer = setInterval(() => refreshAdminAlerts().catch(() => {}), 45000);
    } catch (err) {
      main.innerHTML =
        head("تعذّر الاتصال") +
        `<div class="notice error">${e(errorMessage(err))}</div><a class="button secondary" href="./index.html#/auth">العودة لتسجيل الدخول</a>`;
    }
  }
  boot();
})();


