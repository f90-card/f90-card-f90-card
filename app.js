(function () {
  "use strict";
  const C = window.F90Core,
    A = window.F90API,
    e = C.escapeHTML,
    I = C.icon,
    $ = (id) => document.getElementById(id),
    main = $("mainContent");
  const S = {
    settings: { config: {} },
    categories: [],
    products: [],
    banners: [],
    rates: [],
    vip: [],
    me: null,
    currency: "USD",
    route: 0,
    quote: null,
    checkoutKey: null,
    depositKey: null,
    selectedMethod: null,
    offset: 0,
    carousel: 0,
    favorites: [],
    authMode: "login",
    currencyPreference: false,
  };
  let toastTimer,
    bannerTimer,
    quoteTimer,
    maintenanceTimer,
    installPrompt,
    promoTimers = [];
  try {
    S.currencyPreference = !!localStorage.getItem("f90-currency");
    S.currency = localStorage.getItem("f90-currency") || "USD";
    S.favorites = JSON.parse(localStorage.getItem("f90-favorites") || "[]");
  } catch {}
  const href = (kind, id) => `#/${kind}/${encodeURIComponent(id)}`;
  const image = (src, alt = "", cls = "") =>
    C.safeUrl(src)
      ? `<img src="${e(C.safeUrl(src))}" alt="${e(alt)}" class="${cls}" loading="lazy" decoding="async">`
      : `<div class="image-placeholder">${I("grid")}<span>${e(alt)}</span></div>`;
  const field = (name, label, type = "text", value = "", attrs = "") =>
    `<label class="field"><span>${label}</span>${type === "textarea" ? `<textarea name="${name}" ${attrs}>${e(value)}</textarea>` : `<input name="${name}" type="${type}" value="${e(value)}" ${attrs}>`}</label>`;
  const select = (name, label, options, value) =>
    `<label class="field"><span>${label}</span><select name="${name}">${options.map(([v, t]) => `<option value="${e(v)}" ${String(v) === String(value) ? "selected" : ""}>${e(t)}</option>`).join("")}</select></label>`;
  const pageHead = (title, lead = "", actions = "") =>
    `<div class="page-head"><div><div class="eyebrow">أف تسعين كارد</div><h1>${e(title)}</h1>${lead ? `<p>${e(lead)}</p>` : ""}</div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>`;
  const empty = (text, icon = "grid") =>
    `<div class="empty">${I(icon)}<p>${e(text)}</p></div>`;
  const status = (s) =>
    `<span class="badge status-${e(s)}">${e(C.statuses[s] || s)}</span>`;
  function toast(text) {
    $("toast").textContent = text;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 4500);
  }
  function message(err) {
    return /[\u0600-\u06ff]/.test(err.message)
      ? err.message
      : "تعذّر إكمال العملية. تحقق من بياناتك وحاول مجددًا";
  }
  function modal(title, body) {
    $("modalRoot").innerHTML =
      `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-head"><h2 id="modalTitle">${e(title)}</h2><button class="icon-button" data-close-modal aria-label="إغلاق">${I("close")}</button></div>${body}</section></div>`;
    document.body.style.overflow = "hidden";
    $("modalRoot").querySelector("input,button")?.focus();
  }
  function closeModal() {
    $("modalRoot").innerHTML = "";
    document.body.style.overflow = "";
  }
  function toggleDrawer(open) {
    $("drawer").hidden = !open;
    $("drawerBackdrop").hidden = !open;
    $("menuButton").setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) $("drawerClose").focus();
    else $("menuButton").focus();
  }
  function theme(v) {
    document.documentElement.dataset.theme = v;
    const color = S.settings.primary_color || "#fa2444";
    document.documentElement.style.setProperty(
      "--accent",
      v === "cream" && color === "#fa2444" ? "#a91d3d" : color,
    );
    try {
      localStorage.setItem("f90-theme", v);
    } catch {}
    $("themeSelect").value = v;
    $("themeButton").innerHTML = I(v === "cream" ? "moon" : "sun");
  }
  function brand() {
    const c = S.settings.config || {},
      x = Math.max(-100, Math.min(100, Number(c.logo_x) || 0)),
      y = Math.max(-100, Math.min(100, Number(c.logo_y) || 0));
    for (const id of ["headerBrand"]) {
      const el = $(id);
      el.className = `brand ${c.logo_fit === "contain" ? "brand-contain" : ""} ${c.logo_motion ? "motion" : ""}`;
      el.style.setProperty("--logo-x", x + "px");
      el.style.setProperty("--logo-y", y + "px");
      el.innerHTML = S.settings.logo_url
        ? image(S.settings.logo_url, S.settings.store_name)
        : `<span class="brand-name">${e(S.settings.store_name || "أف تسعين كارد")}</span>`;
    }
    $("siteFavicon").href =
      C.safeUrl(c.app_icon_url || S.settings.logo_url) || "./icon.svg";
    $("siteFavicon").removeAttribute("type");
    document.querySelector("link[rel=apple-touch-icon]").href =
      /\.(png|jpe?g|webp)(\?|$)/i.test(
        c.app_icon_url || S.settings.logo_url || "",
      )
        ? C.safeUrl(c.app_icon_url || S.settings.logo_url)
        : "./assets/icons/icon-512.png";
    document.title = S.settings.store_name || "أف تسعين كارد";
    if (location.hostname.endsWith(".vercel.app") || c.vercel_manifest)
      document.querySelector("link[rel=manifest]").href = "./api/manifest";
  }
  function avatar(p, size = "") {
    return `<span class="avatar ${size}">${p?.avatar_url ? image(p.avatar_url, p.display_name) : I("user")}</span>`;
  }
  function verified(p) {
    return p?.is_verified
      ? `<span class="badge verified">${I("shield")}موثّق</span>`
      : `<span class="badge">غير موثّق</span>`;
  }
  function chrome() {
    brand();
    const me = S.me,
      p = me?.profile,
      c = S.settings.config || {};
    $("headerWallet").innerHTML =
      I("wallet") +
      `<span>${me && !me.needs_mfa ? e(C.money(me.wallet?.balance_usd, "USD")) : "المحفظة"}</span>`;
    $("headerUser").innerHTML = p?.avatar_url
      ? image(p.avatar_url, p.display_name)
      : I("user");
    $("headerUser").href = me ? "#/profile" : "#/auth";
    $("drawerProfile").innerHTML =
      `<a class="drawer-profile" href="${me ? "#/profile" : "#/auth"}">${avatar(p)}<div><strong>${e(p?.display_name || "أهلًا بك في أف تسعين")}</strong><span class="small">${me ? e(C.roles[me.role]) + " · " + e(p.customer_id || "") : "سجّل دخولك وابدأ رحلتك"}</span>${me && !me.needs_mfa ? verified(p) : ""}</div></a>`;
    const links = [
      ["/", "الرئيسية", "grid"],
      ["profile", "حسابي", "user"],
      ["wallet", "محفظتي", "wallet"],
      ["deposit", "إضافة رصيد", "plus"],
      ["orders", "تتبع طلباتي", "clock"],
      ["history", "سجل الحركات", "doc"],
      ["favorites", "المفضلة", "heart"],
      ["vip", "مستويات التميّز", "crown"],
      ["security", "أمان الحساب", "shield"],
      ["verification", "توثيق الهوية", "check"],
      ["install", "تثبيت التطبيق", "plus"],
      ["developers", "وكلاؤنا والمبرمجون", "link"],
      ["notifications", "الإشعارات", "bell"],
      ["policy/about", "من نحن", "doc"],
      ["support", "الدعم الفني", "support"],
    ];
    $("drawerLinks").innerHTML =
      links
        .map(
          ([route, label, icon]) =>
            `<a href="${route === "/" ? "#/" : "#/" + route}">${I(icon)}${label}</a>`,
        )
        .join("") +
      (me && ["manager", "admin", "designer", "support"].includes(me.role)
        ? `<a href="./admin.html">${I("chart")}لوحة الإدارة</a>`
        : "") +
      (me
        ? `<button data-action="logout">${I("logout")}تسجيل الخروج</button>`
        : "");
    const enabled = S.rates.filter((r) => r.is_enabled && r.per_usd);
    if (!enabled.some((r) => r.currency === S.currency)) S.currency = "USD";
    $("currencySelect").innerHTML = enabled
      .map(
        (r) =>
          `<option value="${e(r.currency)}" ${r.currency === S.currency ? "selected" : ""}>${e(r.name_ar)}</option>`,
      )
      .join("");
    $("categoryNav").innerHTML = "";
    $("footer").innerHTML =
      `<div class="container"><div class="footer-grid"><div><h3>${e(S.settings.store_name || "أف تسعين كارد")}</h3><p>${e(c.footer_ar || "كل عالمك الرقمي في مكان واحد. خدمات تُشترى من محفظتك، وتتابعها من حسابك.")}</p><span class="muted small">فلسطين · رام الله</span></div><div><h3>عالم المتجر</h3><nav><a href="#/">الأقسام</a><a href="#/wallet">محفظتي</a><a href="#/orders">طلباتي</a><a href="#/developers">وكلاؤنا والمبرمجون</a></nav></div><div><h3>المعلومات</h3><nav>${Object.entries(
        {
          about: "من نحن",
          privacy: "الخصوصية",
          terms: "الشروط والأحكام",
          purchase: "الشراء والاسترداد",
          usage: "الاستخدام",
          deposits: "الإيداع والمحفظة",
        },
      )
        .map(([id, n]) => `<a href="#/policy/${id}">${n}</a>`)
        .join(
          "",
        )}</nav></div><div><h3>نبقى معك</h3><nav><a href="#/support">الدعم الفني</a><a href="mailto:${e(S.settings.contact_email || "")}">البريد الإلكتروني</a>${(
        c.social_links || []
      )
        .filter((s) => s.enabled && C.safeUrl(s.url))
        .map(
          (s) =>
            `<a href="${e(C.safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.name_ar || "تواصل معنا")}</a>`,
        )
        .join(
          "",
        )}<a class="button ghost small" href="#/install">تثبيت التطبيق</a></nav></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${e(S.settings.store_name || "أف تسعين كارد")} · جميع الحقوق محفوظة</span><span>تم تطوير هذا الموقع بواسطة F90</span></div></div>`;
  }
  async function refreshMe() {
    const {
      data: { session },
    } = await A.client.auth.getSession();
    if (!session) {
      S.me = null;
      return;
    }
    try {
      S.me = await A.call("me");
    } catch (err) {
      S.me = null;
      if (err.code === "F90_FORBIDDEN") toast(message(err));
    }
  }
  function promotions() {
    promoTimers.forEach(clearTimeout);
    promoTimers = [];
    const rows = (S.settings.config.promotions || []).filter(
      (x) => x.enabled && C.visibleSchedule(x),
    );
    const el = $("promotionBar");
    function draw() {
      el.hidden = !rows.length;
      if (!rows.length) return;
      const content = rows
        .map(
          (p) =>
            `<span>${p.image_url ? image(p.image_url, p.text_ar || "إعلان") : ""}${e(p.text_ar || "")}</span>`,
        )
        .join("");
      el.innerHTML = `<div class="promotion-track" style="--promo-duration:${Math.max(8, Number(rows[0].animation_seconds) || 25)}s">${content}<span class="duplicate" aria-hidden="true">${content}</span></div><button class="icon-button" data-action="hide-promo" aria-label="إغلاق الإعلان">${I("close")}</button>`;
    }
    draw();
    for (const p of [...rows])
      if (Number(p.display_seconds) > 0)
        promoTimers.push(
          setTimeout(
            () => {
              const i = rows.indexOf(p);
              if (i >= 0) rows.splice(i, 1);
              draw();
            },
            Math.max(1, Number(p.display_seconds)) * 1000,
          ),
        );
  }
  function categoryTile(c) {
    const disabled = C.categoryUnavailable(c, S.categories, S.products);
    return `<a class="image-tile ${disabled ? "refilling" : ""}" href="${href("category", c.slug || c.id)}" aria-label="${e(c.name)}">${image(c.image_url, c.name)}${disabled ? '<span class="refill-badge">قيد التعبئة</span>' : ""}<span class="tile-caption">${e(c.name)}</span></a>`;
  }
  function productTile(p, pack = false) {
    const disabled = C.unavailable(p);
    if (pack)
      return `<a class="pack ${disabled ? "refilling" : ""}" href="${href("product", p.slug || p.id)}"><strong>${e(p.commerce?.pack_label || p.name)}</strong><span>${disabled ? "قيد التعبئة" : e(C.money(C.previewPrice(p, p.commerce?.quantity_min || 1), "USD", true))}</span></a>`;
    return `<a class="image-tile ${disabled ? "refilling" : ""}" href="${href("product", p.slug || p.id)}" aria-label="${e(p.name)}">${image(p.image_url, p.name)}${disabled ? '<span class="refill-badge">قيد التعبئة</span>' : ""}<span class="tile-caption">${e(p.name)}</span></a>`;
  }
  function home() {
    const c = S.settings.config,
      slides = S.banners.filter((b) => C.visibleSchedule(b.presentation || {})),
      hero =
        c.show_banners !== false && slides.length
          ? slides[S.carousel % slides.length]
          : null;
    const art = hero?.image_url || c.hero_image || "./assets/sections/hero.png";
    const target = hero?.link_url || "#/";
    main.innerHTML = `${c.show_intro === false && !hero ? "" : `<section class="home-hero" aria-label="إعلان المتجر"><a href="${e(C.safeUrl(target) || "#categories")}"><img src="${e(C.safeUrl(art))}" alt="${e(hero?.title || "أف تسعين كارد — اكتشف خدماتنا")}" fetchpriority="high" decoding="async"></a>${hero?.presentation?.overlay_enabled ? `<div class="hero-overlay"><h2>${e(hero.title)}</h2><p>${e(hero.subtitle)}</p></div>` : ""}${slides.length > 1 ? `<div class="carousel-control"><button data-action="prev-banner" aria-label="الإعلان السابق">‹</button><button data-action="pause-banner" aria-label="إيقاف الحركة">Ⅱ</button><button data-action="next-banner" aria-label="الإعلان التالي">›</button></div>` : ""}</section>`}
 <div class="section-head" id="categories"><h2>اختر عالمك</h2><span>كل ما تحتاجه، أقرب إليك</span></div>${
   S.categories.some((c) => !c.parent_id)
     ? `<div class="image-grid">${S.categories
         .filter((c) => !c.parent_id)
         .map(categoryTile)
         .join("")}</div>`
     : empty("تُجهّز أقسام المتجر حاليًا")
 }
 ${
   S.products.some((p) => p.is_featured)
     ? `<div class="section-head"><h2>خدمات تستحق التجربة</h2></div><div class="image-grid">${S.products
         .filter((p) => p.is_featured)
         .map((p) => productTile(p))
         .join("")}</div>`
     : ""
 }
 <div class="value-strip">${[
   ["wallet", "شراء من محفظتك", "سعر واضح قبل التأكيد"],
   ["clock", "تابع كل خطوة", "حالة طلبك داخل حسابك"],
   ["shield", "حسابك بين يديك", "حماية ثنائية اختيارية"],
   ["support", "دعم قريب منك", "واتساب عندما تحتاجه"],
 ]
   .map(
     ([i, t, s]) =>
       `<div class="value-item">${I(i)}<div><strong>${t}</strong><small>${s}</small></div></div>`,
   )
   .join("")}</div>`;
    clearInterval(bannerTimer);
    if (
      slides.length > 1 &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      bannerTimer = setInterval(
        () => {
          S.carousel++;
          if (location.hash === "#/" || !location.hash) home();
        },
        Math.max(3, Number(c.banner_seconds) || 6) * 1000,
      );
  }
  function category(slug) {
    const c = S.categories.find((x) => x.slug === slug || x.id === slug);
    if (!c) {
      main.innerHTML = empty("القسم غير موجود");
      return;
    }
    if (
      c.presentation?.routing === "direct" &&
      c.presentation.direct_product_id
    ) {
      location.hash = href("product", c.presentation.direct_product_id);
      return;
    }
    const parents = [];
    let parent = c;
    const visited = new Set();
    while (parent?.parent_id && !visited.has(parent.id)) {
      visited.add(parent.id);
      parent = S.categories.find((x) => x.id === parent.parent_id);
      if (parent) parents.unshift(parent);
    }
    const children = S.categories.filter((x) => x.parent_id === c.id),
      products = S.products.filter((p) => p.category_id === c.id);
    main.innerHTML = `<div class="breadcrumb"><a href="#/">الرئيسية</a>${parents.map((p) => `<span>‹</span><a href="${href("category", p.slug)}">${e(p.name)}</a>`).join("")}<span>‹</span><span>${e(c.name)}</span></div>${pageHead(c.name, "", `<button class="button secondary small" data-action="share">${I("copy")}نسخ رابط القسم</button>`)}${c.presentation?.banner_url ? image(c.presentation.banner_url, c.name, "category-art") : ""}${children.length || products.length ? `<label class="field f90-category-search"><span>ابحث داخل ${e(c.name)}</span><input id="categoryFilter" type="search" autocomplete="off" placeholder="ابحث عن قسم أو خدمة..." aria-label="البحث داخل القسم"></label>` : ""}${children.length ? `<div class="image-grid">${children.map(categoryTile).join("")}</div>` : ""}${products.length ? `${children.length ? '<div class="section-head"><h2>خدمات القسم</h2></div>' : ""}<div class="${c.presentation?.layout === "packs" ? "packs-grid" : "image-grid"}">${products.map((p) => productTile(p, c.presentation?.layout === "packs")).join("")}</div>` : ""}${!children.length && !products.length ? empty("هذا القسم قيد التعبئة. عُد قريبًا") : ""}`;
  }
  function priceBoard(total) {
    return ["USD", "ILS", "JOD"]
      .map((code) => {
        const n = C.convert(total, code, S.rates);
        return `<div class="${code === "USD" ? "usd" : ""}"><small>${C.currencyNames[code]}</small><strong>${n === null ? "لم يُحدد الصرف" : e(C.money(n, code))}</strong></div>`;
      })
      .join("");
  }
  async function quoteProduct(p) {
    const f = $("checkoutForm");
    if (!f) return;
    const qty = Number(f.elements.quantity?.value || 1),
      coupon = f.elements.coupon?.value || "";
    const seq = ++S.quoteSeq;
    try {
      const quote = await A.call("quote", {
        product_id: p.id,
        quantity: qty,
        coupon,
      });
      if (!f.isConnected || seq !== S.quoteSeq) return;
      S.quote = quote;
      $("priceBoard").innerHTML = priceBoard(quote.total_usd);
      $("checkoutTotal").textContent = C.money(
        C.convert(quote.total_usd, S.currency, S.rates),
        S.currency,
        true,
      );
      $("discountHint").textContent =
        Number(quote.discount_usd) > 0
          ? "الخصم المطبق: " + C.money(quote.discount_usd, "USD", true)
          : "";
      $("quoteError").textContent = "";
      $("buyButton").disabled = C.unavailable(p);
      const insufficient =
        S.me && Number(S.me.wallet?.balance_usd) < Number(quote.total_usd);
      $("walletHint").innerHTML = insufficient
        ? `<span class="notice error">رصيدك لا يكفي. <a href="#/deposit">أضف رصيدًا</a> وانتظر اعتماد الإيداع.</span>`
        : S.me
          ? `سيُخصم ${e(C.money(quote.total_usd, "USD", true))} من محفظتك عند التأكيد.`
          : "سجّل الدخول للشراء من محفظتك.";
    } catch (err) {
      if (!f.isConnected || seq !== S.quoteSeq) return;
      S.quote = null;
      $("quoteError").textContent = message(err);
      $("buyButton").disabled = true;
    }
  }
  function product(slug) {
    const p = S.products.find((p) => p.slug === slug || p.id === slug);
    if (!p) {
      main.innerHTML = empty("الخدمة غير موجودة");
      return;
    }
    const c = p.commerce || {},
      cat = S.categories.find((x) => x.id === p.category_id),
      quantity = c.type === "quantity",
      disabled = C.unavailable(p);
    S.quote = null;
    S.quoteSeq = 0;
    S.checkoutKey = C.key();
    const fields = c.fields?.length
      ? c.fields
      : [
          {
            id: "account_id",
            label_ar: "معرّف حسابك",
            type: "text",
            required: true,
          },
        ];
    main.innerHTML = `<div class="breadcrumb"><a href="#/">الرئيسية</a>${cat ? `<span>‹</span><a href="${href("category", cat.slug)}">${e(cat.name)}</a>` : ""}<span>‹</span>${e(p.name)}</div><div class="product-page"><div class="product-art ${disabled ? "refilling" : ""}">${image(p.image_url, p.name)}${disabled ? '<span class="refill-badge">قيد التعبئة</span>' : ""}</div><section class="product-info"><div class="eyebrow">${e(cat?.name || "خدمات أف تسعين")}</div><h1>${e(p.name)}</h1><div class="badges"><span class="badge">${I(c.fulfillment === "automatic" ? "link" : "user")}${c.fulfillment === "automatic" ? "تنفيذ آلي" : "تنفيذ يدوي"}</span>${c.delivery_time ? `<span class="badge">${I("clock")}${e(c.delivery_time)}</span>` : ""}</div>${p.description ? `<p class="product-description">${e(p.description)}</p>` : ""}<div class="actions"><button class="button secondary small" data-action="share">${I("copy")}نسخ الرابط</button><button class="button secondary small" data-action="favorite" data-id="${p.id}">${I("heart")}${S.favorites.includes(p.id) ? "إزالة من المفضلة" : "أضف للمفضلة"}</button></div><div class="price-board" id="priceBoard">${priceBoard(C.previewPrice(p, c.quantity_min || 1))}</div>
 <form id="checkoutForm" data-product="${p.id}">${quantity ? field("quantity", e(c.quantity_label_ar || "الكمية المطلوبة"), "number", c.quantity_min || 1, `min="${Number(c.quantity_min) || 1}" max="${Number(c.quantity_max) || 1000000000}" step="${Number(c.quantity_step) || 1}" required`) + `<p class="muted small">السعر لكل ${e(c.unit_quantity || 1)} ${e(c.quantity_label_ar || "وحدة")} · من ${e(c.quantity_min || 1)} إلى ${e(c.quantity_max || 1000000000)}</p>` : '<input type="hidden" name="quantity" value="1">'}${fields.map((f) => field("customer_" + f.id, e(f.label_ar || f.id), ["email", "number", "textarea", "url"].includes(f.type) ? f.type : "text", "", `${f.required ? "required" : ""} maxlength="1000" placeholder="${e(f.placeholder_ar || "")}"`)).join("")}${field("coupon", "رمز خصم <small>اختياري</small>", "text", "", 'maxlength="100" dir="ltr"')}<p id="discountHint" class="muted small"></p><div class="checkout-total"><span>الإجمالي</span><strong id="checkoutTotal">—</strong></div><p id="quoteError" class="inline-error"></p><button class="button full" id="buyButton" type="submit" disabled>${I("wallet")}${S.me ? "تأكيد الشراء من المحفظة" : "سجّل الدخول للشراء"}</button><p id="walletHint" class="muted small" style="margin-top:14px"></p></form></section></div>`;
    if (!disabled) quoteProduct(p);
    else
      $("quoteError").textContent = "الخدمة قيد التعبئة ولا يمكن شراؤها حاليًا";
  }
  function auth(mode = S.authMode) {
    S.authMode = mode;
    main.innerHTML = `<div class="auth-layout"><div class="auth-art">${image("./assets/sections/services.png", "عالم أف تسعين كارد")}</div><section class="panel auth-panel"><div class="eyebrow">رحلتك تبدأ هنا</div><h1>${mode === "register" ? "أهلًا بعالمك الرقمي" : mode === "forgot" ? "استعادة الحساب" : "أهلًا بعودتك"}</h1><div class="auth-tabs"><button data-action="auth-tab" data-mode="login" class="${mode === "login" ? "active" : ""}">تسجيل الدخول</button><button data-action="auth-tab" data-mode="register" class="${mode === "register" ? "active" : ""}">حساب جديد</button></div><form id="authForm" data-mode="${mode}">${mode === "register" ? field("display_name", "اسمك", "text", "", 'required maxlength="100" autocomplete="name"') : ""}${field("email", "البريد الإلكتروني", "email", "", 'required autocomplete="email" dir="ltr"')}${mode !== "forgot" ? field("password", "كلمة المرور", "password", "", 'required minlength="' + (mode === "register" ? "10" : "1") + '" autocomplete="' + (mode === "register" ? "new-password" : "current-password") + '" dir="ltr"') : ""}${
      mode === "register"
        ? `<div class="field-row">${select(
            "phone_country",
            "رمز الدولة",
            [
              ["+970", "فلسطين +970"],
              ["+972", "+972"],
              ["+962", "الأردن +962"],
              ["+966", "السعودية +966"],
              ["+971", "الإمارات +971"],
              ["+20", "مصر +20"],
              ["+90", "تركيا +90"],
              ["+964", "العراق +964"],
              ["+961", "لبنان +961"],
              ["+963", "سوريا +963"],
              ["+212", "المغرب +212"],
              ["+968", "عُمان +968"],
              ["+1", "+1"],
              ["+44", "+44"],
            ],
            "+970",
          )}${field("phone", "رقم الهاتف <small>اختياري</small>", "tel", "", 'autocomplete="tel-national" maxlength="25" dir="ltr"')}</div><label class="check-field"><input type="checkbox" required>أوافق على <a href="#/policy/terms">الشروط</a> و<a href="#/policy/privacy">سياسة الخصوصية</a></label>`
        : ""
    }<p class="inline-error" id="authError"></p><button class="button full" type="submit">${mode === "register" ? "إنشاء حساب" : mode === "forgot" ? "أرسل رابط الاستعادة" : "دخول"}</button></form>${mode !== "forgot" ? `<div class="divider">أو</div><button class="google-button" data-action="google">المتابعة باستخدام جوجل</button><button class="button ghost small" style="margin-top:16px" data-action="auth-tab" data-mode="forgot">نسيت كلمة المرور؟</button>` : '<p class="muted small" style="margin-top:16px">ستصلك رسالة إذا كان البريد مرتبطًا بحساب.</p>'}</section></div>`;
  }
  function loginRequired() {
    auth();
    main.insertAdjacentHTML(
      "afterbegin",
      '<div class="notice">سجّل الدخول لعرض هذه الصفحة.</div>',
    );
  }
  function profile() {
    const me = S.me,
      p = me.profile;
    main.innerHTML = `<section class="profile-cover">${avatar(p, "large")}<div><span class="small">كل تفاصيل عالمك، هنا</span><h1>${e(p.display_name)}</h1><div class="badges">${verified(p)}<span class="badge">${e(C.roles[me.role])}</span><span class="badge gold">مستوى ${e(me.vip_level)}</span></div><div class="profile-id">${e(p.customer_id)}</div><div class="f90-profile-links"><a class="button secondary small" href="#/install">تثبيت التطبيق</a><a class="button secondary small" href="#/verification">توثيق الحساب</a></div></div></section><div class="profile-grid"><section class="panel"><h2>معلوماتك الشخصية</h2><form id="profileForm">${field("display_name", "الاسم", "text", p.display_name, 'required maxlength="100"')}${field("email", "البريد الإلكتروني", "email", p.email, 'disabled dir="ltr"')}<div class="field-row">${field("phone_country", "رمز الدولة", "tel", p.phone_country || "+970", 'maxlength="8" dir="ltr"')}${field("phone", "الهاتف <small>اختياري</small>", "tel", p.phone || "", 'maxlength="25" dir="ltr"')}</div>${field("avatar", "صورة حسابك", "file", "", 'accept="image/png,image/jpeg,image/webp,image/gif"')}<button class="button" type="submit">حفظ التعديلات</button></form></section><div><section class="panel"><h3>نظرة على حسابك</h3><div class="profile-stats"><div><strong>${e(C.money(me.wallet.balance_usd))}</strong><span>رصيد المحفظة</span></div><div><strong>${e(C.money(me.spent_usd))}</strong><span>إنفاق مكتمل</span></div><div><strong>${e(me.vip_level)} / ٧</strong><span>مستوى التميّز</span></div></div><div class="actions"><a class="button secondary" href="#/orders">طلباتي</a><a class="button secondary" href="#/vip">امتيازاتي</a></div></section><section class="panel" style="margin-top:22px"><h3>أمانك أولًا</h3><p class="muted">تحكّم بالحماية الثنائية وكلمة المرور، أو قدّم توثيقًا اختياريًا لحسابك.</p><div class="actions"><a class="button ghost" href="#/security">أمان الحساب</a><a class="button secondary" href="#/verification">التوثيق</a></div></section></div></div>`;
  }
  function installPage() {
    main.innerHTML = `${pageHead("تثبيت تطبيق F90 Card", "اختصار آمن لمتجرك على شاشة هاتفك، دون تنزيل ملفات من جهات خارجية.")}<section class="panel f90-install-page"><div class="f90-install-icon"><img src="./assets/icons/icon-192.png" alt="شعار تطبيق F90 Card" width="104" height="104"></div><h2>أف تسعين كارد</h2><p class="muted">ثبّت الموقع كتطبيق للوصول بسرعة إلى المحفظة والطلبات والخدمات.</p><button class="button" data-action="install">تثبيت التطبيق الآن</button><div class="f90-install-instructions"><section><h3>أندرويد</h3><p>افتح الموقع عبر Chrome، ثم من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</p></section><section><h3>آيفون وآيباد</h3><p>افتح الموقع في Safari، واضغط «مشاركة»، ثم «إضافة إلى الشاشة الرئيسية».</p></section></div><p class="muted small">إذا كان التطبيق مثبتًا بالفعل، يمكنك فتحه مباشرة من الشاشة الرئيسية.</p></section>`;
  }
  async function wallet() {
    const me = S.me;
    main.innerHTML = `${pageHead("محفظتك الرقمية", "رصيد واحد بالدولار، لكل خدماتك")}<section class="wallet-showcase"><div>${I("wallet")}<p style="margin-top:13px;margin-bottom:5px">رصيدك الحالي</p><div class="amount">${e(C.money(me.wallet.balance_usd, "USD", true))}</div><small>الرصيد متاح بعد اعتماد إيداعك من الإدارة</small></div><div class="wallet-actions"><a class="button" href="#/deposit">${I("plus")}إضافة رصيد</a><a class="button secondary" href="#/history">سجل الحركات</a></div></section><div class="section-head"><h2>آخر الإيداعات</h2><a href="#/deposits" class="muted small">عرض السجل الكامل</a></div><div id="walletDeposits" class="loading">جارٍ تحميل السجل…</div>`;
    const r = await A.call("history", { kind: "deposits" });
    if ($("walletDeposits"))
      $("walletDeposits").outerHTML = r.items.length
        ? `<div class="records">${r.items.slice(0, 5).map(depositRecord).join("")}</div>`
        : empty("لم تقدّم طلب إيداع بعد", "wallet");
  }
  function depositRecord(d) {
    return `<article class="record"><div class="record-main"><h3>${e(d.method_name)}</h3><p>${e(C.date(d.created_at))} · ${e(C.money(d.amount, d.currency, true))}</p><div class="record-footer">${status(d.status)}${d.review_note ? `<span class="muted small">${e(d.review_note)}</span>` : ""}</div></div><strong class="record-price">${e(C.money(d.usd_amount, "USD", true))}</strong></article>`;
  }
  function deposit(methodId) {
    const methods = (S.settings.config.payment_methods || []).filter(
      (m) => m.enabled,
    );
    S.selectedMethod = methods.find((m) => m.id === methodId) || null;
    S.depositKey = C.key();
    const m = S.selectedMethod;
    main.innerHTML = `${pageHead("أضف رصيدًا لعالمك", "اختر طريقة الإيداع، وأرسل إيصالك للمراجعة", `<a class="button secondary small" href="#/deposits">طلبات الإيداع</a>`)}<div class="deposit-steps"><span><b>١</b>اختر الطريقة</span><span><b>٢</b>حوّل وارفع الإيصال</span><span><b>٣</b>اعتماد الإدارة</span></div>${
      !m
        ? methods.length
          ? `<div class="method-grid">${methods.map((x) => `<a class="method-tile" href="${href("deposit", x.id)}" aria-label="${e(x.name_ar)}">${image(x.image_url, x.name_ar)}</a>`).join("")}</div>`
          : empty(
              "لا توجد طرق إيداع مفعّلة. تواصل مع الإدارة لمعرفة الطرق المتاحة",
              "wallet",
            )
        : `<div class="split"><section class="panel"><div class="actions" style="margin-bottom:22px"><a class="button secondary small" href="#/deposit">تغيير الطريقة</a><h2 style="margin:0">${e(m.name_ar)}</h2></div>${image(m.image_url, m.name_ar, "file-preview")}<p class="product-description">${e(m.details_ar || "راجع بيانات التحويل مع الإدارة قبل إرسال المبلغ.")}</p>${m.destination ? `<div class="notice"><b>${e(m.destination)}</b><button class="button ghost small" data-action="copy-text" data-text="${e(m.destination)}">نسخ</button></div>` : ""}<p class="muted small">لا يُضاف الرصيد حتى تعتمد الإدارة صحة التحويل. سعر الصرف يُحفظ لحظة تقديم الطلب.</p></section><section class="panel"><h2>بيانات الإيداع</h2><form id="depositForm"><div class="field-row">${field("amount", "المبلغ المحوّل", "number", "", 'required min="0.000001" max="1000000" step="0.000001"')}${select(
            "currency",
            "عملة التحويل",
            S.rates
              .filter((r) => r.is_enabled && r.per_usd)
              .map((r) => [r.currency, r.name_ar]),
            S.currency,
          )}</div><div class="notice" id="depositEstimate">أدخل المبلغ لعرض الرصيد المتوقع بالدولار.</div>${field("reference", "رقم التحويل أو ملاحظة <small>اختياري</small>", "text", "", 'maxlength="300"')}${field("receipt", "صورة إيصال التحويل", "file", "", 'required accept="image/jpeg,image/png,image/webp"')}<button class="button full" type="submit">تقديم طلب الإيداع</button></form></section></div>`
    }${supportLink() ? `<div class="notice"><p>تحتاج مساعدة؟ التواصل اختياري، ويمكنك متابعة طلبك داخل الموقع.</p>${supportLink("تواصل مع الدعم")}</div>` : ""}`;
  }
  function orderRecord(o) {
    return `<a class="record" href="${href("order", o.id)}">${image(o.product_image, o.product_name, "record-image")}<div class="record-main"><h3>${e(o.product_name)}</h3><p>طلب #${e(o.order_number)} · ${e(C.date(o.created_at))}</p><div class="record-footer">${status(o.status)}<span class="badge">${o.fulfillment === "automatic" ? "آلي" : "يدوي"}</span></div></div><strong class="record-price">${e(C.money(o.total_usd))}</strong></a>`;
  }
  async function history(kind) {
    const seq = S.route,
      orders = kind === "orders",
      deposits = kind === "deposits";
    main.innerHTML =
      pageHead(
        orders
          ? "تتبّع طلباتي"
          : deposits
            ? "طلبات الإيداع"
            : "سجل حركات المحفظة",
        orders
          ? "من الدفع حتى التنفيذ. كل خطوة واضحة."
          : "سجلك محفوظ داخل حسابك",
        `<button class="button secondary small" data-action="report" data-kind="${kind}">${I("download")}تنزيل تقرير</button>`,
      ) + `<div id="records" class="loading">جارٍ تحميل السجل…</div>`;
    const r = await A.call("history", {
      kind: orders ? "orders" : deposits ? "deposits" : "ledger",
      offset: S.offset,
    });
    if (seq !== S.route) return;
    S.reportItems = r.items;
    S.reportKind = kind;
    const items = r.items;
    $("records").outerHTML = items.length
      ? `<div class="records">${items.map((x) => (orders ? orderRecord(x) : deposits ? depositRecord(x) : `<article class="record"><span class="avatar">${I(Number(x.amount_usd) > 0 ? "plus" : "wallet")}</span><div class="record-main"><h3>${e(x.description)}</h3><p>${e(C.date(x.created_at))} · الرصيد بعد الحركة ${e(C.money(x.balance_after, "USD", true))}</p></div><strong class="record-price ${Number(x.amount_usd) > 0 ? "ledger-plus" : "ledger-minus"}">${Number(x.amount_usd) > 0 ? "+" : ""}${e(C.money(x.amount_usd, "USD", true))}</strong></article>`)).join("")}</div><div class="pagination"><button class="button secondary small" data-action="page-prev" ${S.offset === 0 ? "disabled" : ""}>السابق</button><span class="muted small">${e(S.offset + 1)}–${e(Math.min(S.offset + 50, r.count))} من ${e(r.count)}</span><button class="button secondary small" data-action="page-next" ${S.offset + 50 >= r.count ? "disabled" : ""}>التالي</button></div>`
      : empty(
          orders
            ? "ليس لديك طلبات بعد"
            : deposits
              ? "لم تقدّم طلب إيداع بعد"
              : "لم تحدث حركة في محفظتك بعد",
          "clock",
        );
  }
  async function order(id) {
    const seq = S.route;
    main.innerHTML = '<div class="loading">جارٍ تحميل تفاصيل طلبك…</div>';
    const { order: o, events } = await A.call("order", { id });
    if (seq !== S.route) return;
    S.currentOrder = o;
    main.innerHTML = `${pageHead("طلبك #" + o.order_number, o.product_name, `<button class="button secondary small" data-action="order-pdf">${I("download")}تنزيل تفاصيل الطلب</button>`)}<div class="split"><section class="panel"><div class="record" style="padding:0;border:0;margin-bottom:24px">${image(o.product_image, o.product_name, "record-image")}<div>${status(o.status)}<p class="muted small">${o.fulfillment === "automatic" ? "تنفيذ آلي عبر المورّد" : "تنفيذ يدوي من الإدارة"}</p></div></div><div class="profile-stats"><div><strong>${e(C.money(o.total_usd))}</strong><span>المبلغ المدفوع</span></div><div><strong>${e(o.quantity)}</strong><span>الكمية</span></div><div><strong>${e(C.duration(o))}</strong><span>مدة التنفيذ</span></div></div><p class="muted small">التقديم: ${e(C.date(o.created_at))}<br>الوقت المتوقع: ${o.expected_minutes ? e(o.expected_minutes) + " دقيقة" : "حسب الخدمة وحالة التنفيذ"}<br>الإكمال: ${e(C.date(o.completed_at))}</p>${Number(o.refunded_usd) > 0 ? `<div class="notice success">استُرد ${e(C.money(o.refunded_usd, "USD", true))} إلى محفظتك.</div>` : ""}<h3>بيانات طلبك</h3>${Object.entries(
      o.customer_fields || {},
    )
      .map(
        ([k, v]) =>
          `<p class="small"><span class="muted">${k === "account_id" ? "معرّف الحساب" : e(k)}:</span> <b>${e(v)}</b></p>`,
      )
      .join(
        "",
      )}<div class="actions"><button class="button secondary" data-action="refresh-route">تحديث الحالة</button>${supportLink("مساعدة في الطلب " + o.order_number)}</div></section><section class="panel"><h2>رحلة طلبك</h2><div class="timeline">${events.map((ev) => `<div class="timeline-item"><h3>${e(C.statuses[ev.status] || ev.status)}</h3><p>${e(ev.note)}</p><small>${e(C.date(ev.created_at))}</small></div>`).join("")}</div></section></div>`;
  }
  function vip() {
    const me = S.me,
      current = S.vip.find((t) => t.level === me?.vip_level) || S.vip[0],
      next = S.vip.find((t) => t.level === Number(current.level) + 1),
      spent = Number(me?.spent_usd || 0),
      pct = next
        ? Math.max(
            0,
            Math.min(
              100,
              ((spent - Number(current.minimum_spend)) /
                (Number(next.minimum_spend) - Number(current.minimum_spend))) *
                100,
            ),
          )
        : 100;
    main.innerHTML = `${pageHead("كل خطوة لها امتياز", "سبعة مستويات. تزداد المزايا مع إنفاقك المكتمل.")}<section class="vip-hero"><div><div class="eyebrow" style="color:var(--gold)">مستويات التميّز</div><h2>${me ? "مستواك الحالي " + me.vip_level : "اكتشف امتيازاتك القادمة"}</h2><p>خصمك الحالي ${e(current.discount_percent)}٪ على الخدمات المؤهّلة.</p><div class="vip-progress"><span style="width:${pct}%"></span></div><p class="small">${next ? "متبقّي " + e(C.money(Math.max(0, Number(next.minimum_spend) - spent))) + " للمستوى التالي" : "وصلت إلى أعلى مستوى"}</p><a class="button" href="#/">اكتشف الخدمات</a></div><div class="vip-emblem">${I("crown")}<strong>${e(me?.vip_level || 1)}</strong><span>عالم التميّز</span></div></section><div class="vip-grid">${S.vip.map((t) => `<div class="vip-card ${Number(me?.vip_level) === t.level ? "current" : ""}">${I("crown")}<strong>المستوى ${e(t.level)}</strong><div class="discount">${e(t.discount_percent)}٪</div><small class="muted">من ${e(C.money(t.minimum_spend))}</small></div>`).join("")}</div><div class="notice">يُحسب المستوى من قيمة الطلبات المكتملة بعد الاسترداد. إذا أُدخل رمز خصم، يُطبّق الخصم الأعلى دون جمعه مع خصم المستوى. قد تخصّص الإدارة مستواك، وتسعير التاجر منفصل.</div>`;
  }
  async function security() {
    const factors = await A.client.auth.mfa.listFactors();
    const verifiedFactors =
      factors.data?.totp?.filter((f) => f.status === "verified") || [];
    S.factors = verifiedFactors;
    main.innerHTML = `<div class="security-intro">${I("shield")}<div><h1>أمان يليق بحسابك</h1><p class="muted">طبقة حماية إضافية، بإرادتك وفي الوقت الذي يناسبك.</p></div></div><div class="split"><section class="panel"><h2>التحقق بخطوتين</h2><p class="muted">بعد تفعيله، ستحتاج رمز تطبيق المصادقة عند تسجيل الدخول لإكمال العمليات المحمية.</p><div class="notice ${verifiedFactors.length ? "success" : ""}">${verifiedFactors.length ? "الحماية الثنائية مفعّلة" : "الحماية الثنائية غير مفعّلة"}</div>${verifiedFactors.length ? `<button class="button secondary" data-action="mfa-disable" data-id="${e(verifiedFactors[0].id)}">تعطيل الحماية الثنائية</button>` : `<button class="button" data-action="mfa-enroll">تفعيل الحماية</button>`}</section><section class="panel"><h2>كلمة المرور</h2><form id="passwordForm">${field("password", "كلمة مرور جديدة", "password", "", 'required minlength="10" autocomplete="new-password"')}${field("confirm", "تأكيد كلمة المرور", "password", "", 'required minlength="10" autocomplete="new-password"')}<button class="button secondary" type="submit">تغيير كلمة المرور</button></form><p class="muted small" style="margin-top:16px">استخدم كلمة طويلة وفريدة. لن يطلب منك الدعم كلمة المرور أو رمز المصادقة.</p></section></div>`;
  }
  async function verification() {
    const seq = S.route;
    main.innerHTML = `${pageHead("علامة ثقة بجانب اسمك", "توثيق الهوية اختياري، ومستنداتك خاصة بمراجعة الإدارة.")}<div class="split"><section class="panel"><h2>قدّم طلب التوثيق</h2><p class="muted small">هوية: وجه وظهر. جواز سفر: صفحة البيانات. أضف صورة سيلفي واضحة تحمل فيها المستند. الصور لا تظهر في صفحات المتجر.</p><form id="verificationForm">${select(
      "document_type",
      "نوع المستند",
      [
        ["id", "بطاقة هوية"],
        ["passport", "جواز سفر"],
      ],
      "id",
    )}${field("front", "وجه الهوية أو صفحة الجواز", "file", "", 'required accept="image/png,image/jpeg,image/webp"')}${field("back", "ظهر الهوية <small>مطلوب للهوية</small>", "file", "", 'accept="image/png,image/jpeg,image/webp"')}${field("selfie", "سيلفي وأنت تحمل المستند", "file", "", 'required accept="image/png,image/jpeg,image/webp"')}<label class="check-field"><input required type="checkbox">أوافق على تقديم الصور طوعًا لمراجعة التوثيق.</label><button class="button full" type="submit">إرسال للمراجعة</button></form></section><section class="panel"><h2>حالة التوثيق</h2><div class="notice">${S.me.profile.is_verified ? "حسابك موثّق" : "حسابك غير موثّق بعد"}</div><div id="verificationHistory" class="loading">جارٍ تحميل الطلبات…</div><p class="muted small">يمكنك طلب حذف مستنداتك من الإدارة بعد انتهاء المراجعة. لا تتغير بيانات التوثيق من تعديل الملف الشخصي.</p></section></div>`;
    const r = await A.call("history", { kind: "verification" });
    if (seq === S.route)
      $("verificationHistory").outerHTML = r.items.length
        ? r.items
            .map(
              (v) =>
                `<div class="notice">${status(v.status)}<p class="small">${e(C.date(v.created_at))}</p>${v.review_note ? `<p>${e(v.review_note)}</p>` : ""}</div>`,
            )
            .join("")
        : empty("لم تقدّم طلب توثيق بعد", "shield");
  }
  function supportLink(label = "تواصل عبر واتساب") {
    const n = String(S.settings.config.whatsapp || "").replace(/\D/g, "");
    return n
      ? `<a class="button secondary small" href="https://wa.me/${n}?text=${encodeURIComponent(label)}" target="_blank" rel="noopener noreferrer">${I("support")}${e(label)}</a>`
      : "";
  }
  function support() {
    main.innerHTML = `${pageHead("نحن بالقرب منك", "التواصل اختياري. شراء الخدمات ومتابعتها متاحان داخل حسابك.")}<div class="docs-grid"><section class="panel">${I("support")}<h3>تواصل مباشر</h3><p>إذا احتجت توضيحًا، أرسل رقم الطلب أو معرّف حسابك. لا ترسل كلمة المرور.</p>${supportLink()}</section><section class="panel">${I("clock")}<h3>تابع طلباتك</h3><p>راجع حالة التنفيذ والمواعيد والسجل من صفحة طلباتي.</p><a class="button secondary" href="#/orders">تتبع الطلبات</a></section><section class="panel">${I("doc")}<h3>البريد الإلكتروني</h3><p>للأسئلة وطلبات الخصوصية والتوثيق.</p><a class="button secondary" href="mailto:${e(S.settings.contact_email || "")}">إرسال بريد</a></section></div><section class="panel"><h2>قبل التواصل</h2><p class="muted">الإيداع بانتظار الموافقة؟ راجع سجل الإيداعات. الطلب قيد التنفيذ؟ المدة المعروضة تقديرية. فشل الطلب؟ تحقّق من رصيد الاسترداد في سجل الحركات. الموقع: فلسطين، رام الله.</p></section>`;
  }
  function policy(id) {
    const titles = {
        about: "من نحن",
        privacy: "سياسة الخصوصية",
        terms: "الشروط والأحكام",
        purchase: "الشراء والاسترداد",
        usage: "سياسة الاستخدام",
        deposits: "الإيداع والمحفظة",
        resellers: "سياسة التجار والموزعين",
      },
      page = S.settings.config.pages?.[id];
    main.innerHTML = `<div class="policy-layout"><nav class="policy-nav">${Object.entries(
      titles,
    )
      .map(
        ([k, n]) =>
          `<a href="#/policy/${k}" class="${k === id ? "active" : ""}">${n}</a>`,
      )
      .join(
        "",
      )}</nav><article class="policy-content"><div class="eyebrow">دليل تعاملنا معك</div><h1>${e(titles[id] || "المعلومات")}</h1><p class="policy-mark small">${e(S.settings.store_name)} · فلسطين، رام الله · ${e(S.settings.config.policy_updated || "١٢ أكتوبر ٢٠٢٦")}</p><div class="policy-text">${e(page?.ar || "يجري إعداد محتوى هذه الصفحة. تواصل مع الإدارة للحصول على التفاصيل.")}</div><div class="notice">لأي سؤال عن هذه السياسة، <a href="#/support">تواصل معنا</a>.</div></article></div>`;
  }
  function developers() {
    const example = JSON.stringify(
      {
        action: "add",
        service: "معرّف-المنتج",
        quantity: 1000,
        link: "معرّف-حساب-العميل",
        idempotency_key: "store-order-10001",
      },
      null,
      2,
    );
    main.innerHTML = `<section class="developers-hero"><div><div class="eyebrow">وكلاؤنا · المبرمجون · الموزعون</div><h1>خدماتنا.<br>داخل عالمك.</h1><p class="muted">اربط متجرك بخدمات أف تسعين كارد. مفتاح خاص بحساب التاجر، دفع من المحفظة، ومتابعة واضحة للطلبات.</p><div class="actions">${supportLink("طلب تفعيل حساب تاجر وربط متجري")}<a href="#/policy/resellers" class="button secondary">سياسة الموزعين</a></div></div><div class="code-window"><div class="code-head">POST /functions/v1/f90-platform</div><pre>${e(example)}</pre></div></section><div class="docs-grid">${[
      [
        "user",
        "١. تفعيل حساب التاجر",
        "أنشئ حسابًا وتواصل مع الإدارة لمنحك صلاحية تاجر. لا تُمنح الصلاحيات بمجرد التسجيل.",
      ],
      [
        "wallet",
        "٢. أضف رصيدًا",
        "قدّم طلب إيداع وانتظر اعتماد الإدارة. تُخصم الطلبات من رصيد محفظة التاجر بالدولار.",
      ],
      [
        "link",
        "٣. اربط متجرك",
        "أنشئ مفتاحًا، واحفظه في خادم متجرك. استخدم مرجعًا فريدًا للطلب لمنع التكرار.",
      ],
    ]
      .map(
        ([i, t, d]) =>
          `<section class="panel">${I(i)}<h3>${t}</h3><p>${d}</p></section>`,
      )
      .join(
        "",
      )}</div><section class="panel"><h2>مرجع الربط</h2><div class="notice"><strong>عنوان الاتصال</strong><div class="key-token">${e(A.endpoint)}</div><p class="small">طلب POST، ترويسة <b dir="ltr">x-f90-key</b> لمفتاحك، و<b dir="ltr">Content-Type: application/json</b>. الاستجابة الناجحة داخل <b dir="ltr">data</b> والخطأ داخل <b dir="ltr">error</b>.</p></div><div class="table-wrap"><table><thead><tr><th>العملية</th><th>القيمة البرمجية</th><th>الحقول</th></tr></thead><tbody><tr><td>قائمة الخدمات</td><td dir="ltr">services</td><td>لا حقول إضافية</td></tr><tr><td>رصيدك</td><td dir="ltr">balance</td><td>لا حقول إضافية</td></tr><tr><td>طلب شراء</td><td dir="ltr">add</td><td dir="ltr">service, quantity, link, idempotency_key</td></tr><tr><td>حالة الطلب</td><td dir="ltr">status</td><td dir="ltr">order: UUID</td></tr></tbody></table></div><p class="muted small" style="margin-top:18px">الحد الافتراضي ٦٠ طلبًا في الدقيقة لكل مفتاح. الرصيد غير الكافي يعيد 402، المرجع المتكرر يعيد الطلب نفسه. احفظ المفتاح في خادمك، وامنع ظهوره في تطبيق العميل. التنفيذ اليدوي يظهر بوضوح في بيانات الخدمة. لا إعادة إرسال تلقائية للطلبات المعلّقة للمراجعة.</p><div class="actions"><a class="button secondary" href="./docs/api-ar.md" download>تنزيل دليل الربط</a><a class="button secondary" href="./docs/reseller-example.mjs" download>تنزيل مثال خادم</a></div></section>${S.me?.role === "trader" ? `<section class="panel" style="margin-top:25px"><h2>مفاتيح متجرك</h2><form id="keyForm">${field("name", "اسم المفتاح", "text", "متجري", 'required maxlength="100"')}<button class="button" type="submit">إنشاء مفتاح جديد</button></form><div class="records" style="margin-top:20px">${(S.me.keys || []).map((k) => `<article class="record"><div class="record-main"><h3>${e(k.name)}</h3><p dir="ltr">${e(k.token_prefix)}</p>${status(k.is_active ? "active" : "suspended")}</div>${k.is_active ? `<button class="button ghost small" data-action="key-revoke" data-id="${k.id}">إلغاء المفتاح</button>` : ""}</article>`).join("")}</div></section>` : ""}`;
  }
  async function mfaChallenge() {
    const { data, error } = await A.client.auth.mfa.listFactors();
    if (error) throw error;
    const factor = data.totp.find((f) => f.status === "verified");
    if (!factor) throw new Error("لم توجد حماية ثنائية مفعّلة");
    S.mfaFactor = factor.id;
    modal(
      "تحقق من هويتك",
      `<p class="muted">أدخل الرمز من تطبيق المصادقة لإكمال دخولك.</p><form id="mfaForm">${field("code", "رمز التحقق", "text", "", 'required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" dir="ltr"')}<button class="button full" type="submit">تحقق</button></form>`,
    );
  }
  async function route() {
    const seq = ++S.route;
    clearInterval(bannerTimer);
    clearInterval(maintenanceTimer);
    document.body.classList.remove("f90-in-maintenance");
    clearTimeout(quoteTimer);
    closeModal();
    toggleDrawer(false);
    const raw = (location.hash || "#/").replace(/^#\/?/, "");
    let [page, id] = raw.split("/");
    try {
      id = id ? decodeURIComponent(id) : "";
    } catch {
      id = "";
    }
    main.dataset.page = page || "home";
    const back = $("pageBack");
    if (back) {
      let parentLink = "#/";
      if (page === "product") {
        const current = S.products.find((p) => p.slug === id || p.id === id);
        const category = S.categories.find((c) => c.id === current?.category_id);
        if (category) parentLink = href("category", category.slug || category.id);
      } else if (page === "category") {
        const current = S.categories.find((c) => c.slug === id || c.id === id);
        const parent = S.categories.find((c) => c.id === current?.parent_id);
        if (parent) parentLink = href("category", parent.slug || parent.id);
      }
      back.href = parentLink;
      back.hidden = !page;
    }
    if (!["orders", "deposits", "history"].includes(page)) S.offset = 0;
    const privatePages = [
      "profile",
      "wallet",
      "deposit",
      "orders",
      "order",
      "history",
      "deposits",
      "security",
      "verification",
      "reset",
    ];
    if (privatePages.includes(page) && !S.me) {
      loginRequired();
      return;
    }
    if (S.me?.needs_mfa && privatePages.includes(page)) {
      main.innerHTML =
        pageHead("أكمل حماية حسابك", "أدخل رمز المصادقة لفتح حسابك.") +
        `<button class="button" data-action="mfa-challenge">إدخال رمز التحقق</button>`;
      await mfaChallenge();
      return;
    }
    try {
      if (
        S.settings.config.maintenance?.enabled &&
        !["manager", "designer", "admin"].includes(S.me?.role) &&
        !["auth", "security", "support"].includes(page)
      ) {
        const maintenance = S.settings.config.maintenance;
        const until = maintenance.until ? new Date(maintenance.until).getTime() : NaN;
        const hasCountdown = Number.isFinite(until);
        document.body.classList.add("f90-in-maintenance");
        main.innerHTML = `<section class="f90-maintenance-screen" role="status" aria-label="الموقع تحت الصيانة"><div class="f90-maintenance-decor" aria-hidden="true"></div><div class="f90-maintenance-content"><img class="f90-maintenance-logo" src="./assets/icons/icon-192.png" alt="شعار F90 Card" width="110" height="110"><span class="f90-maintenance-tag">F90 CARD</span><h1>نعتذر لكم، الموقع قيد الصيانة حاليًا</h1><p>${e(maintenance.text_ar || "نعمل على تحسين خدماتنا، وسنعود للعمل قريبًا.")}</p>${hasCountdown ? '<div class="f90-maintenance-countdown" id="maintenanceClock" aria-label="الوقت المتبقي حتى الموعد المحدد"></div>' : '<p class="muted">سيعود الموقع للعمل عند انتهاء الصيانة.</p>'}<small>نشكر لكم صبركم وتفهّمكم</small></div></section>`;
        if (hasCountdown) {
          const tick = () => {
            const el = $("maintenanceClock");
            if (!el) return;
            const remaining = Math.max(0, until - Date.now());
            const days = Math.floor(remaining / 86400000);
            const hours = Math.floor((remaining % 86400000) / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            const format = (n) => String(n).padStart(2, "0");
            el.classList.toggle("urgent", remaining > 0 && remaining < 3600000);
            el.innerHTML = [[days, "يوم"], [hours, "ساعة"], [minutes, "دقيقة"], [seconds, "ثانية"]].map(([n, name]) => `<div><strong>${format(n)}</strong><span>${name}</span></div>`).join("");
            if (!remaining) {
              clearInterval(maintenanceTimer);
              el.insertAdjacentHTML("beforeend", '<p class="f90-maintenance-ended">وصلنا إلى موعد العودة المتوقع. حدّث الصفحة للتحقق من انتهاء الصيانة.</p>');
            }
          };
          tick();
          maintenanceTimer = setInterval(tick, 1000);
        }
        return;
      }
      if (!page) home();
      else if (page === "category") category(id);
      else if (page === "product") product(id);
      else if (page === "auth") auth();
      else if (page === "profile") profile();
      else if (page === "install") installPage();
      else if (page === "wallet") await wallet();
      else if (page === "deposit") deposit(id);
      else if (["orders", "deposits", "history"].includes(page))
        await history(page);
      else if (page === "order") await order(id);
      else if (page === "vip") vip();
      else if (page === "security") await security();
      else if (page === "verification") await verification();
      else if (page === "developers") developers();
      else if (page === "support") support();
      else if (page === "policy") policy(id);
      else if (page === "reset") {
        main.innerHTML =
          pageHead("اختر كلمة مرور جديدة") +
          `<section class="panel" style="max-width:500px"><form id="passwordForm">${field("password", "كلمة المرور", "password", "", 'required minlength="10"')}${field("confirm", "التأكيد", "password", "", 'required minlength="10"')}<button class="button" type="submit">حفظ كلمة المرور</button></form></section>`;
      } else if (page === "favorites") {
        const ps = S.products.filter((p) => S.favorites.includes(p.id));
        main.innerHTML =
          pageHead("خدماتك الأقرب إليك") +
          (ps.length
            ? `<div class="image-grid">${ps.map((p) => productTile(p)).join("")}</div>`
            : empty("لم تضف خدمة للمفضلة بعد", "heart"));
      } else if (page === "notifications") {
        main.innerHTML =
          pageHead("كل جديد، هنا") +
          (S.settings.config.notifications || [])
            .filter((n) => n.enabled && C.visibleSchedule(n))
            .map(
              (n) =>
                `<section class="panel" style="margin-bottom:15px"><h3>${e(n.title_ar)}</h3><p class="muted">${e(n.text_ar || n.body_ar)}</p></section>`,
            )
            .join("");
        if (!main.querySelector(".panel"))
          main.insertAdjacentHTML(
            "beforeend",
            empty("لا توجد إشعارات جديدة", "bell"),
          );
      } else if (page === "search") {
        const q = id || $("globalSearch").value;
        main.innerHTML =
          pageHead("نتائج البحث", q) +
          `<div class="image-grid">${S.categories
            .filter((c) => c.name.includes(q))
            .map(categoryTile)
            .join("")}${S.products
            .filter((p) => p.name.includes(q))
            .map((p) => productTile(p))
            .join("")}</div>`;
        if (!main.querySelector(".image-tile"))
          main.insertAdjacentHTML("beforeend", empty("لم توجد نتائج مطابقة"));
      } else main.innerHTML = empty("هذه الصفحة غير موجودة");
    } catch (err) {
      if (seq === S.route)
        main.innerHTML =
          pageHead("تعذّر تحميل الصفحة") +
          `<div class="notice error">${e(message(err))}</div><button class="button" data-action="refresh-route">حاول مجددًا</button>`;
    }
  }
  async function submit(form) {
    const data = Object.fromEntries(new FormData(form));
    if (form.id === "authForm") {
      if (
        data.password &&
        String(data.password).length < 10 &&
        form.dataset.mode === "register"
      )
        throw new Error("استخدم كلمة مرور من عشرة أحرف على الأقل");
      const redirect = new URL("./index.html", location.href).href;
      if (form.dataset.mode === "register") {
        const r = await A.client.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: redirect,
            data: {
              display_name: data.display_name,
              phone: data.phone || null,
              phone_country: data.phone_country,
            },
          },
        });
        if (r.error)
          throw new Error(
            "تعذّر إنشاء الحساب. تحقق من البريد وقوة كلمة المرور أو جرّب لاحقًا",
          );
        if (!r.data.session) {
          modal(
            "تحقق من بريدك",
            "<p>أرسلنا رابط تأكيد إلى بريدك إن كان التسجيل متاحًا. افتح الرسالة لتفعيل حسابك.</p>",
          );
          return;
        }
      } else if (form.dataset.mode === "forgot") {
        const r = await A.client.auth.resetPasswordForEmail(data.email, {
          redirectTo: redirect + "#/reset",
        });
        if (r.error)
          throw new Error("تعذّر إرسال رسالة الاستعادة. حاول لاحقًا");
        modal(
          "راجع بريدك",
          "<p>إذا كان البريد مسجّلًا، ستصلك رسالة لاستعادة حسابك.</p>",
        );
        return;
      } else {
        const r = await A.client.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (r.error)
          throw new Error(
            "البريد الإلكتروني أو كلمة المرور غير صحيحين، أو الحساب غير مفعّل",
          );
      }
      await refreshMe();
      chrome();
      location.hash = "#/profile";
      await route();
      return;
    }
    if (form.id === "checkoutForm") {
      if (!S.me) {
        location.hash = "#/auth";
        return;
      }
      if (S.me.needs_mfa) {
        await mfaChallenge();
        return;
      }
      if (!S.quote) throw new Error("انتظر تحديث السعر قبل التأكيد");
      if (Number(S.me.wallet.balance_usd) < Number(S.quote.total_usd))
        throw new Error("رصيد محفظتك غير كافٍ. قدّم إيداعًا وانتظر اعتماده");
      const p = S.products.find((p) => p.id === form.dataset.product),
        fields = {};
      for (const [k, v] of Object.entries(data))
        if (k.startsWith("customer_")) fields[k.slice(9)] = String(v);
      const o = await A.call("checkout", {
        product_id: p.id,
        quantity: Number(data.quantity),
        fields,
        idempotency_key: S.checkoutKey,
        expected_total_usd: S.quote.total_usd,
        coupon: data.coupon,
      });
      S.checkoutKey = C.key();
      await refreshMe();
      chrome();
      location.hash = href("order", o.id);
      toast("تم دفع طلبك من المحفظة");
      return;
    }
    if (form.id === "profileForm") {
      let photo;
      if (data.avatar?.size) photo = await A.upload(data.avatar, "f90-avatars");
      await A.call("profile.save", {
        display_name: data.display_name,
        phone: data.phone,
        phone_country: data.phone_country,
        avatar_url: photo?.url,
      });
      await refreshMe();
      chrome();
      profile();
      toast("تم تحديث ملفك");
      return;
    }
    if (form.id === "depositForm") {
      const receipt = await A.upload(data.receipt, "f90-receipts");
      await A.call("deposit.submit", {
        method_id: S.selectedMethod.id,
        currency: data.currency,
        amount: Number(data.amount),
        reference: data.reference,
        receipt_path: receipt.path,
        idempotency_key: S.depositKey,
      });
      S.depositKey = C.key();
      location.hash = "#/deposits";
      toast("تم تقديم الإيداع، بانتظار مراجعة الإدارة");
      return;
    }
    if (form.id === "verificationForm") {
      if (data.document_type === "id" && !data.back?.size)
        throw new Error("ارفع ظهر الهوية");
      const front = await A.upload(data.front, "f90-identity"),
        selfie = await A.upload(data.selfie, "f90-identity"),
        back = data.back?.size
          ? await A.upload(data.back, "f90-identity")
          : null;
      await A.call("verification.submit", {
        document_type: data.document_type,
        front_path: front.path,
        back_path: back?.path,
        selfie_path: selfie.path,
      });
      toast("تم إرسال التوثيق للمراجعة");
      await route();
      return;
    }
    if (form.id === "passwordForm") {
      if (data.password !== data.confirm)
        throw new Error("تأكيد كلمة المرور غير مطابق");
      const r = await A.client.auth.updateUser({ password: data.password });
      if (r.error)
        throw new Error("تعذّر تغيير كلمة المرور. قد تحتاج إعادة تسجيل الدخول");
      toast("تم تغيير كلمة المرور");
      return;
    }
    if (form.id === "mfaForm") {
      const r = await A.client.auth.mfa.challengeAndVerify({
        factorId: S.mfaFactor,
        code: data.code,
      });
      if (r.error) throw new Error("رمز المصادقة غير صحيح أو انتهت صلاحيته");
      closeModal();
      await refreshMe();
      chrome();
      await route();
      toast("تم التحقق");
      return;
    }
    if (form.id === "keyForm") {
      const key = await A.call("key.create", { name: data.name });
      await refreshMe();
      developers();
      modal(
        "احفظ مفتاحك الآن",
        `<p>يظهر المفتاح الكامل مرة واحدة. خزّنه على خادمك ولا تشاركه مع العملاء.</p><div class="key-token">${e(key.token)}</div><button class="button secondary" style="margin-top:16px" data-action="copy-text" data-text="${e(key.token)}">نسخ المفتاح</button>`,
      );
      return;
    }
  }
  document.addEventListener("submit", async (ev) => {
    const form = ev.target;
    if (form.id === "searchForm") {
      ev.preventDefault();
      S.offset = 0;
      location.hash = href("search", $("globalSearch").value.trim());
      return;
    }
    if (
      ![
        "authForm",
        "checkoutForm",
        "profileForm",
        "depositForm",
        "verificationForm",
        "passwordForm",
        "mfaForm",
        "keyForm",
      ].includes(form.id)
    )
      return;
    ev.preventDefault();
    if (form.dataset.busy) return;
    form.dataset.busy = "1";
    const button = form.querySelector("button[type=submit]");
    if (button) button.disabled = true;
    try {
      await submit(form);
    } catch (err) {
      toast(message(err));
      if (form.id === "authForm" && $("authError"))
        $("authError").textContent = message(err);
      if (err.code === "F90_PRICE_CHANGED") {
        const p = S.products.find((x) => x.id === form.dataset.product);
        if (p) quoteProduct(p);
      }
      if (err.code === "F90_MFA") mfaChallenge();
    } finally {
      delete form.dataset.busy;
      if (button?.isConnected) button.disabled = false;
    }
  });
  document.addEventListener("input", (ev) => {
    if (ev.target.closest("#checkoutForm")) {
      S.quote = null;
      const p = S.products.find(
        (x) => x.id === ev.target.closest("form").dataset.product,
      );
      $("buyButton").disabled = true;
      clearTimeout(quoteTimer);
      quoteTimer = setTimeout(() => quoteProduct(p), 350);
    }
    if (ev.target.closest("#depositForm")) {
      const f = $("depositForm"),
        r = S.rates.find((r) => r.currency === f.elements.currency.value);
      $("depositEstimate").textContent =
        "الرصيد المتوقع: " +
        C.money(
          Number(f.elements.amount.value || 0) / Number(r?.per_usd || 1),
          "USD",
          true,
        ) +
        " · بعد الموافقة";
    }
  });
  document.addEventListener("click", async (ev) => {
    const button = ev.target.closest("[data-action],[data-close-modal]");
    if (ev.target.closest("#drawer a")) toggleDrawer(false);
    if (!button) return;
    if (button.hasAttribute("data-close-modal")) {
      closeModal();
      return;
    }
    const action = button.dataset.action;
    try {
      if (action === "logout") {
        await A.client.auth.signOut();
        S.me = null;
        chrome();
        location.hash = "#/";
        route();
      } else if (action === "share" || action === "copy-text") {
        await navigator.clipboard.writeText(
          action === "share" ? location.href : button.dataset.text,
        );
        toast("تم النسخ");
      } else if (action === "auth-tab") auth(button.dataset.mode);
      else if (action === "google") {
        const r = await A.client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: new URL("./index.html", location.href).href },
        });
        if (r.error)
          throw new Error(
            "تعذّر دخول جوجل. يحتاج الربط إلى تفعيل مزوّد جوجل من الإدارة",
          );
      } else if (action === "favorite") {
        const id = button.dataset.id;
        S.favorites = S.favorites.includes(id)
          ? S.favorites.filter((x) => x !== id)
          : [...S.favorites, id];
        try {
          localStorage.setItem("f90-favorites", JSON.stringify(S.favorites));
        } catch {}
        toast(S.favorites.includes(id) ? "أضيفت للمفضلة" : "أزيلت من المفضلة");
      } else if (action === "hide-promo") $("promotionBar").hidden = true;
      else if (action === "next-banner" || action === "prev-banner") {
        S.carousel += action === "next-banner" ? 1 : S.banners.length - 1;
        home();
      } else if (action === "pause-banner") {
        clearInterval(bannerTimer);
        button.textContent = "▶";
        button.dataset.action = "next-banner";
      } else if (action === "refresh-route") {
        await refreshMe();
        chrome();
        await route();
      } else if (action === "page-next" || action === "page-prev") {
        S.offset = Math.max(0, S.offset + (action === "page-next" ? 50 : -50));
        route();
      } else if (action === "mfa-challenge") await mfaChallenge();
      else if (action === "mfa-enroll") {
        const factors = await A.client.auth.mfa.listFactors();
        for (const f of factors.data?.totp || [])
          if (f.status === "unverified")
            await A.client.auth.mfa.unenroll({ factorId: f.id });
        const r = await A.client.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "أف تسعين كارد",
        });
        if (r.error) throw new Error("تعذّر إعداد الحماية الثنائية");
        S.mfaFactor = r.data.id;
        modal(
          "اربط تطبيق المصادقة",
          `<p>امسح الرمز بتطبيق المصادقة، ثم أدخل الرمز لإتمام التفعيل.</p><img class="qr-code" src="${e(r.data.totp.qr_code)}" alt="رمز ربط تطبيق المصادقة"><form id="mfaForm">${field("code", "رمز التحقق", "text", "", 'required pattern="[0-9]{6}" inputmode="numeric" maxlength="6" dir="ltr"')}<button class="button full" type="submit">تأكيد التفعيل</button></form>`,
        );
      } else if (action === "mfa-disable") {
        modal(
          "تعطيل الحماية",
          `<p>سيُلغى عامل المصادقة. يمكنك تفعيله مجددًا من هذه الصفحة.</p><button class="button danger" data-action="mfa-confirm-disable" data-id="${e(button.dataset.id)}">تأكيد التعطيل</button>`,
        );
      } else if (action === "mfa-confirm-disable") {
        const r = await A.client.auth.mfa.unenroll({
          factorId: button.dataset.id,
        });
        if (r.error) throw new Error("أكمل التحقق الثنائي قبل التعطيل");
        closeModal();
        await refreshMe();
        await security();
        toast("تم تعطيل الحماية");
      } else if (action === "key-revoke") {
        await A.call("key.revoke", { id: button.dataset.id });
        await refreshMe();
        developers();
        toast("أُلغي المفتاح");
      } else if (action === "report") {
        await window.F90Reports.history(
          S.reportKind,
          S.reportItems,
          S.settings.store_name,
        );
      } else if (action === "order-pdf") {
        await window.F90Reports.order(S.currentOrder, S.settings.store_name);
      } else if (action === "install") {
        if (installPrompt) {
          await installPrompt.prompt();
          installPrompt = null;
        } else
          modal(
            "تثبيت أف تسعين كارد",
            "<p>على أندرويد: افتح قائمة المتصفح ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</p><p>على آيفون وآيباد: افتح الموقع في سفاري، اضغط مشاركة، ثم «إضافة إلى الشاشة الرئيسية».</p>",
          );
      }
    } catch (err) {
      toast(message(err));
    }
  });
  $("menuButton").innerHTML = I("menu");
  $("drawerClose").innerHTML = I("close");
  $("searchButton").innerHTML = I("search");
  $("menuButton").addEventListener("click", () => toggleDrawer(true));
  $("drawerClose").addEventListener("click", () => toggleDrawer(false));
  $("drawerBackdrop").addEventListener("click", () => toggleDrawer(false));
  $("themeButton").addEventListener("click", () =>
    theme(document.documentElement.dataset.theme === "dark" ? "cream" : "dark"),
  );
  $("themeSelect").addEventListener("change", (ev) => theme(ev.target.value));
  $("currencySelect").addEventListener("change", (ev) => {
    S.currency = ev.target.value;
    try {
      localStorage.setItem("f90-currency", S.currency);
    } catch {}
    route();
  });
  $("installButton").addEventListener("click", async () => {
    if (installPrompt) await installPrompt.prompt();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      closeModal();
      if (!$("drawer").hidden) toggleDrawer(false);
    }
    if (ev.key === "Tab") {
      const dialog =
        document.querySelector(".modal") ||
        (!$("drawer").hidden ? $("drawer") : null);
      if (!dialog) return;
      const focusables = [
        ...dialog.querySelectorAll("a,button,input,select,textarea"),
      ].filter((el) => !el.disabled && !el.hidden);
      const first = focusables[0],
        last = focusables.at(-1);
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last?.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first?.focus();
      }
    }
  });
  main.addEventListener("input", (ev) => {
    if (ev.target?.id !== "categoryFilter") return;
    const term = ev.target.value.trim().toLocaleLowerCase("ar");
    main.querySelectorAll(".image-grid .image-tile, .packs-grid .pack").forEach((tile) => {
      tile.hidden = !!term && !(tile.textContent || tile.getAttribute("aria-label") || "").toLocaleLowerCase("ar").includes(term);
    });
  });
  window.addEventListener("hashchange", () => {
    S.offset = 0;
    route();
  });
  window.addEventListener("beforeinstallprompt", (ev) => {
    ev.preventDefault();
    installPrompt = ev;
    $("installButton").hidden = false;
  });
  A.client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY")
      setTimeout(() => {
        location.hash = "#/reset";
      }, 0);
    if (event === "SIGNED_OUT") S.me = null;
  });
  async function boot() {
    try {
      Object.assign(S, await A.call("catalog"));
      if (!S.currencyPreference) S.currency = S.settings.currency || "USD";
      await refreshMe();
      chrome();
      let initialTheme = S.settings.config.default_theme || "dark";
      try {
        initialTheme = localStorage.getItem("f90-theme") || initialTheme;
      } catch {}
      theme(initialTheme);
      promotions();
      await route();
      if ("serviceWorker" in navigator)
        navigator.serviceWorker.register("./sw.js").catch(() => {});
    } catch (err) {
      main.innerHTML =
        pageHead("تعذّر تحميل المتجر") +
        `<div class="notice error">${e(message(err))}</div><button class="button" id="bootRetry">إعادة المحاولة</button>`;
      $("bootRetry").addEventListener("click", boot);
    }
  }
  boot();
})();
