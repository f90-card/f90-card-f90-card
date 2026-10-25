(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) root.F90Core = core;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const roles = {
    customer: "عميل",
    manager: "مدير عام",
    admin: "مسؤول المتابعة",
    designer: "مصمم",
    trader: "تاجر",
    charging_agent: "وكيل شحن",
    support: "الدعم الفني",
    amin_card: "الأمين كارد",
  };
  const statuses = {
    pending: "بانتظار التنفيذ",
    queued: "في قائمة التنفيذ",
    submitting: "جارٍ الإرسال للمورّد",
    processing: "قيد التنفيذ",
    completed: "مكتمل",
    partial: "مكتمل جزئيًا",
    failed: "فشل واستُرد المبلغ",
    review: "تحتاج مراجعة الإدارة",
    refunded: "مسترد",
    approved: "مقبول",
    rejected: "مرفوض",
    active: "نشط",
    suspended: "موقوف",
    banned: "محظور",
  };
  const currencyNames = { USD: "دولار", ILS: "شيكل", JOD: "دينار أردني", SAR: "ريال سعودي" };
  function enabledCurrency(code, rates) {
    return Array.isArray(rates) && rates.some(r => r.currency === code && r.is_enabled && !r.is_archived && Number(r.per_usd) > 0);
  }
  function currencyOptions(rates) {
    return (rates || []).filter(r => enabledCurrency(r.currency, rates)).map(r => [r.currency, r.name_ar || r.currency]);
  }
  function setCurrencyRates(rates) {
    for (const r of rates || []) if (r.currency && r.name_ar) currencyNames[r.currency] = r.name_ar;
  }
  const escapeHTML = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function safeUrl(v) {
    if (!v) return "";
    try {
      const u = new URL(
        v,
        typeof location === "object" ? location.href : "https://example.com/",
      );
      return ["https:", "http:"].includes(u.protocol) ? u.href : "";
    } catch {
      return "";
    }
  }
  function money(v, c = "USD", fine = false) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return (
      new Intl.NumberFormat("ar", {
        minimumFractionDigits: 2,
        maximumFractionDigits: fine ? 6 : 2,
      }).format(n) +
      " " +
      (currencyNames[c] || c)
    );
  }
  function convert(usd, c, rates) {
    if (c === "USD") return Number(usd);
    const r = rates?.find(
      (r) => r.currency === c && r.is_enabled && !r.is_archived && Number(r.per_usd) > 0,
    );
    return r ? Number(usd) * Number(r.per_usd) : null;
  }
  function date(v) {
    return v
      ? new Intl.DateTimeFormat("ar", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Hebron",
        }).format(new Date(v))
      : "—";
  }
  function duration(o) {
    if (!o.started_at) return "لم يبدأ بعد";
    const n = Math.max(
      0,
      Math.ceil(
        ((o.completed_at ? Date.parse(o.completed_at) : Date.now()) -
          Date.parse(o.started_at)) /
          60000,
      ),
    );
    return `${new Intl.NumberFormat("ar").format(n)} دقيقة`;
  }
  function unavailable(p) {
    return p?.stock === 0 || p?.commerce?.availability === "refilling";
  }
  function categoryUnavailable(c, categories, products, seen = new Set()) {
    if (c.presentation?.availability === "refilling") return true;
    if (seen.has(c.id)) return true;
    seen.add(c.id);
    const children = categories.filter(
        (x) => x.parent_id === c.id && x.is_active,
      ),
      items = products.filter((p) => p.category_id === c.id && p.is_active);
    if (!children.length && !items.length) return true;
    return (
      children.every((x) =>
        categoryUnavailable(x, categories, products, new Set(seen)),
      ) && items.every(unavailable)
    );
  }
  function visibleSchedule(p) {
    const n = Date.now();
    return (
      (!p.starts_at || Date.parse(p.starts_at) <= n) &&
      (!p.ends_at || Date.parse(p.ends_at) > n)
    );
  }
  function previewPrice(p, quantity = 1, options = {}) {
    const c = p.commerce || {};
    const fixed = c.currency_pricing;
    const code = options.currency || "USD";
    const fx = code === "USD" ? 1 : Number((options.rates || []).find(r=>r.currency===code&&r.is_enabled&&!r.is_archived)?.per_usd);
    const markup = Number(options.markup || 0);
    if (options.currencyPricingEnabled !== false && fixed?.enabled === true && Number(fixed.prices?.[code]) > 0) {
      const qty = c.type === "quantity" ? Number(quantity) : Number(c.pack_quantity || 1);
      return Number(fixed.prices[code]) * qty / Number(fixed.unit_quantity) / fx * (1+markup/100);
    }
    let price = Number(c.prices?.USD ?? (p.currency === "USD" ? p.price : NaN));
    const q = c.type === "quantity" ? Number(quantity) : 1;
    for (const t of [...(c.pricing_tiers || [])].sort(
      (a, b) => Number(a.min) - Number(b.min),
    ))
      if (q >= Number(t.min) && (t.max == null || t.max === "" || q <= Number(t.max))) price = Number(t.prices?.USD ?? price);
    return (c.type === "quantity"
      ? (price * q) / Number(c.unit_quantity || 1)
      : price) * (1+markup/100);
  }
  function key() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `f90-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  const paths = {
    menu: "M4 6h16M4 12h16M4 18h16",
    close: "m6 6 12 12M18 6 6 18",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    arrow: "M19 12H5m7-7-7 7 7 7",
    wallet: "M3 5h16v15H3zM3 9h18v7h-6V9",
    user: "M20 21v-2a7 7 0 0 0-14 0v2M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6",
    crown: "M3 6l4 4 5-7 5 7 4-4-2 13H5z",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    clock: "M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    copy: "M8 8h13v13H8zM16 8V3H3v13h5",
    plus: "M12 4v16M4 12h16",
    sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
    moon: "M20 14A9 9 0 0 1 10 4a9 9 0 1 0 10 10",
    heart: "M20 5c-4-4-8 1-8 1S8 1 4 5c-5 5 8 15 8 15S25 10 20 5",
    chart: "M4 20V4m0 16h17M8 16v-4m5 4V8m5 8V5",
    bell: "M18 8a6 6 0 0 0-12 0v8l-2 2h16l-2-2V8M10 21h4",
    doc: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7",
    support: "M4 15V9a8 8 0 0 1 16 0v6M4 10H2v7h4v-7m14 0h2v7h-4v-7M20 17v4h-5",
    logout: "M10 4H3v16h7M9 12h12m-5-5 5 5-5 5",
    check: "m5 12 4 4L19 6",
    download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
    edit: "m14 4 6 6M4 20l5-1L21 7l-5-5L4 14z",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
    move: "M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4",
    link: "M10 14l4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.grid}"/></svg>`;
  return {
    roles,
    statuses,
    currencyNames,
    enabledCurrency,
    currencyOptions,
    setCurrencyRates,
    escapeHTML,
    safeUrl,
    money,
    convert,
    date,
    duration,
    unavailable,
    categoryUnavailable,
    visibleSchedule,
    previewPrice,
    key,
    icon,
  };
});
