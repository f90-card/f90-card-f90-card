(() => {
  "use strict";
  const C = window.F90Core,
    $ = (id) => document.getElementById(id),
    e = C.escapeHTML;
  const db = window.f90Supabase;
  let lang;
  try {
    lang = localStorage.getItem("f90-language") === "en" ? "en" : "ar";
  } catch {
    lang = "ar";
  }
  const L = (ar, en) => (lang === "en" ? en : ar);
  const tabs = [
    ["overview", "نظرة عامة", "Overview", "grid"],
    ["products", "المنتجات", "Products", "game"],
    ["categories", "الأقسام", "Categories", "grid"],
    ["banners", "صور الإعلانات", "Banner images", "star"],
    ["promotions", "الشريط المتحرك", "Moving strip", "bolt"],
    ["notifications", "الإشعارات", "Notifications", "bell"],
    ["coupons", "الكوبونات", "Coupons", "ticket"],
    ["payments", "طرق الدفع", "Payment methods", "wallet"],
    ["pages", "الصفحات والسياسات", "Pages & policies", "receipt"],
    ["settings", "هوية وإعدادات المتجر", "Brand & settings", "info"],
  ];
  const state = {
    products: [],
    categories: [],
    banners: [],
    settings: C.settings(),
    rawSettings: null,
    schemaReady: false,
    tab: "overview",
    edited: {},
    fields: [],
    tiers: [],
    gallery: [],
    previewUrls: new Map(),
  };
  const activeName = (item) =>
    C.localized(
      item.name || item.title,
      item.commerce?.name_en || item.presentation?.name_en,
      lang,
    );
  const translation = (ar, en) =>
    `<span data-ar="${e(ar)}" data-en="${e(en)}">${e(L(ar, en))}</span>`;
  function status(ar, en, type = "info", detail = "") {
    $("statusMessage").hidden = false;
    $("statusMessage").className = `admin-status ${type}`;
    $("statusMessage").textContent = L(ar, en) + (detail ? `: ${detail}` : "");
  }
  function field(section, key, ar, en, type = "text", options = {}) {
    const id = `${section}-${key}`,
      required = options.required ? "required" : "",
      value = options.value ?? "";
    const attrs = `id="${id}" name="${key}" ${required} ${options.min != null ? `min="${options.min}"` : ""} ${options.max != null ? `max="${options.max}"` : ""} ${options.step != null ? `step="${options.step}"` : ""} ${options.maxlength != null ? `maxlength="${options.maxlength}"` : ""}`;
    let input;
    if (type === "textarea")
      input = `<textarea ${attrs}>${e(value)}</textarea>`;
    else if (type === "select")
      input = `<select ${attrs} ${options.multiple ? "multiple" : ""}>${(options.values || []).map(([v, a, b]) => `<option value="${e(v)}" data-ar="${e(a)}" data-en="${e(b)}" ${String(value) === String(v) ? "selected" : ""}>${e(L(a, b))}</option>`).join("")}</select>`;
    else
      input = `<input ${attrs} type="${type}" value="${e(value)}" ${type === "number" ? 'inputmode="decimal"' : ""}>`;
    return `<div class="form-field ${options.full ? "full" : ""}"><label for="${id}">${translation(ar, en)}</label>${input}${options.help ? `<small>${translation(options.help[0], options.help[1])}</small>` : ""}</div>`;
  }
  function check(section, key, ar, en, value = false, full = false) {
    return `<label class="check-field ${full ? "full" : ""}"><input id="${section}-${key}" name="${key}" type="checkbox" ${value ? "checked" : ""}>${translation(ar, en)}</label>`;
  }
  function upload(
    prefix,
    ar,
    en,
    url = "",
    removable = true,
    multiple = false,
  ) {
    const safe = C.safeUrl(url);
    return `<div class="upload-preview full">${safe ? `<img id="${prefix}-preview" src="${e(safe)}" alt="">` : `<img id="${prefix}-preview" alt="" hidden>`}<div style="min-width:0;flex:1"><label for="${prefix}-file">${translation(ar, en)}</label><input id="${prefix}-file" type="file" accept="image/jpeg,image/png,image/webp" ${multiple ? "multiple" : ""}><p>${translation("PNG / JPG / WebP، بحد أقصى 5 MB لكل صورة.", "PNG / JPG / WebP, up to 5 MB per image.")}</p>${removable ? check(prefix, "remove", "إزالة الصورة الحالية", "Remove current image") : ""}</div></div>`;
  }
  const sectionTitle = (ar, en) => `<h3>${translation(ar, en)}</h3>`;
  const submitButtons = (kind) =>
    `<div class="form-actions full"><button class="button primary" type="submit">${translation("حفظ التغييرات", "Save changes")}${C.icon("check")}</button><button class="button ghost" type="button" data-reset="${kind}">${translation("إلغاء / إضافة جديد", "Cancel / add new")}</button></div>`;
  function panel(kind, ar, en, lead, leadEn, form, list = true) {
    return `<section class="admin-panel" id="panel-${kind}" ${state.tab !== kind ? "hidden" : ""}><div class="admin-panel-heading"><div><span class="eyebrow">F90 CARD</span><h1>${translation(ar, en)}</h1><p>${translation(lead, leadEn)}</p></div></div><div class="admin-card"><form id="${kind}Form" class="admin-form" data-kind="${kind}">${form}</form></div>${list ? `<div class="admin-card"><h2>${translation("العناصر الحالية", "Current items")} <span class="admin-count-label" id="${kind}Count"></span></h2><input class="form-search" id="${kind}Search" type="search" data-placeholder-ar="ابحث بالاسم…" data-placeholder-en="Search by name…" placeholder="${e(L("ابحث بالاسم…", "Search by name…"))}"><div id="${kind}List" class="admin-list"></div></div>` : ""}</section>`;
  }
  function schedule(kind, seconds = false) {
    return `<div class="form-section">${sectionTitle("الظهور والجدولة", "Visibility & schedule")}<div class="section-inputs">${field(kind, "starts_at", "بداية العرض (اختياري)", "Start time (optional)", "datetime-local")}${field(kind, "ends_at", "نهاية العرض (اختياري)", "End time (optional)", "datetime-local")}${seconds ? field(kind, "display_seconds", "مدة الظهور لكل زيارة بالثواني", "Visible seconds per visit", "number", { value: 0, min: 0, max: 86400, step: 1, help: ["0 يبقى حتى الإغلاق أو نهاية الجدولة.", "0 stays until dismissal or schedule end."] }) : ""}</div>${check(kind, "enabled", "إظهار العنصر", "Show item", true)}</div>`;
  }
  function moneyInputs(kind, prices = {}, prefix = "price", required = true) {
    return C.currencies
      .map((currency) =>
        field(
          kind,
          `${prefix}_${currency}`,
          C.t(currency, "ar"),
          C.t(currency, "en"),
          "number",
          { value: prices[currency] ?? "", min: 0, step: "0.000001", required },
        ),
      )
      .join("");
  }
  function productForm(item = {}) {
    const c = C.commerce(item),
      newItem = !item.id;
    state.fields = Array.isArray(c.fields) ? structuredClone(c.fields) : [];
    state.tiers = Array.isArray(c.pricing_tiers)
      ? structuredClone(c.pricing_tiers)
      : [];
    state.gallery = Array.isArray(item.gallery)
      ? item.gallery.filter((v) => typeof v === "string")
      : [];
    const form =
      field(
        "products",
        "name",
        "اسم المنتج بالعربية",
        "Arabic product name",
        "text",
        { value: item.name || "", required: true, maxlength: 150 },
      ) +
      field(
        "products",
        "name_en",
        "اسم المنتج بالإنجليزية",
        "English product name",
        "text",
        { value: c.name_en || "", required: true, maxlength: 150 },
      ) +
      field("products", "slug", "الرابط المختصر", "Slug", "text", {
        value: item.slug || "",
        maxlength: 150,
        help: [
          "يُنشأ من الاسم إذا تركته فارغًا.",
          "Generated from the name when blank.",
        ],
      }) +
      field("products", "category_id", "القسم", "Category", "select", {
        value: item.category_id || "",
        required: true,
        values: [
          ["", "اختر القسم", "Choose category"],
          ...state.categories.map((cat) => [
            cat.id,
            cat.name,
            cat.presentation?.name_en || cat.name,
          ]),
        ],
      }) +
      field(
        "products",
        "description",
        "وصف المنتج بالعربية",
        "Arabic description",
        "textarea",
        { value: item.description || "" },
      ) +
      field(
        "products",
        "description_en",
        "الوصف بالإنجليزية",
        "English description",
        "textarea",
        { value: c.description_en || "" },
      ) +
      field("products", "type", "نوع التسعير", "Pricing type", "select", {
        value: c.type,
        values: [
          ["fixed", "سعر ثابت", "Fixed price"],
          ["quantity", "حسب كمية الكوينز / الوحدات", "By coins / units"],
        ],
      }) +
      field(
        "products",
        "sort_order",
        "ترتيب المنتج",
        "Display order",
        "number",
        { value: item.sort_order || 0, min: 0, step: 1 },
      ) +
      `<div class="form-section">${sectionTitle("الأسعار بالعملات الثلاث", "Prices in all three currencies")}<div class="section-inputs">${moneyInputs("products", newItem ? {} : c.prices)}</div></div>` +
      `<div class="form-section quantity-settings" ${c.type !== "quantity" ? "hidden" : ""}>${sectionTitle("الكميات والتسعير المرن", "Quantity & flexible pricing")}<div class="section-inputs">${field("products", "unit_quantity", "الأسعار أعلاه لكل كم وحدة؟", "Prices above are per how many units?", "number", { value: c.unit_quantity || 100000, min: 1, max: 1000000000, step: 1 })}${field("products", "quantity_min", "أقل كمية", "Minimum quantity", "number", { value: c.quantity_min || 1, min: 1, max: 1000000000, step: 1 })}${field("products", "quantity_max", "أكبر كمية", "Maximum quantity", "number", { value: c.quantity_max || 1000000000, min: 1, max: 1000000000, step: 1 })}${field("products", "quantity_step", "خطوة زيادة الكمية", "Quantity increment", "number", { value: c.quantity_step || 1, min: 1, max: 1000000000, step: 1 })}${field("products", "quantity_label_ar", "اسم الوحدة بالعربية", "Arabic unit name", "text", { value: c.quantity_label_ar || "كوينز" })}${field("products", "quantity_label_en", "اسم الوحدة بالإنجليزية", "English unit name", "text", { value: c.quantity_label_en || "Coins" })}</div><p>${translation("الشريحة الأعلى التي تبلغها الكمية تحدد سعر كامل الكمية. يمكنك مثلًا تسعير 100 ألف ثم سعر مختلف ابتداءً من مليون.", "The highest threshold reached sets the rate for the whole quantity. For example, price 100,000 units, then set a different rate starting at one million.")}</p><div id="pricingTiers"></div><button class="button small" type="button" id="addTier">${translation("إضافة شريحة سعرية", "Add price tier")}</button></div>` +
      field(
        "products",
        "stock",
        "المخزون (فارغ = غير محدود)",
        "Stock (blank = unlimited)",
        "number",
        { value: item.stock ?? "", min: 0, step: 1 },
      ) +
      field(
        "products",
        "delivery_time",
        "وقت الوصول بالعربية",
        "Arabic delivery time",
        "text",
        { value: c.delivery_time || "" },
      ) +
      field(
        "products",
        "delivery_time_en",
        "وقت الوصول بالإنجليزية",
        "English delivery time",
        "text",
        { value: c.delivery_time_en || "" },
      ) +
      upload(
        "product-image",
        "صورة المنتج المربعة 1:1",
        "Square product image 1:1",
        item.image_url,
      ) +
      `<div class="form-section">${sectionTitle("صور إضافية للمنتج", "Additional product images")}<div class="gallery-editor" id="galleryEditor">${state.gallery.map((url, i) => `<label>${C.safeUrl(url) ? `<img src="${e(C.safeUrl(url))}" alt="">` : ""}<input type="checkbox" data-gallery-remove="${i}" aria-label="${e(L("إزالة الصورة", "Remove image"))}"></label>`).join("")}</div>${upload("product-gallery", "إضافة صور إضافية", "Add gallery images", "", false, true)}</div>` +
      `<div class="form-section">${sectionTitle("خانات العميل الخاصة بهذا المنتج", "Customer fields for this product")}<p>${translation("أضف أو أخفِ أي خانة وحدد إن كانت مطلوبة. تظهر في تفاصيل المنتج وتُضمّن في رسالة واتساب.", "Add or hide fields and mark them required. They appear in product details and the WhatsApp message.")}</p><div id="requestFields"></div><button class="button small" type="button" id="addField">${translation("إضافة خانة", "Add field")}</button></div>` +
      check(
        "products",
        "is_active",
        "نشر المنتج",
        "Publish product",
        newItem || !!item.is_active,
      ) +
      check(
        "products",
        "is_featured",
        "إظهار قسمه في أشهر الخدمات",
        "Show its category in popular services",
        !!item.is_featured,
      ) +
      submitButtons("products");
    return panel(
      "products",
      "المنتجات",
      "Products",
      "صورة وتفاصيل وخانات وتسعير مستقل لكل خدمة.",
      "Independent imagery, fields and pricing for every service.",
      form,
    );
  }
  function categoryForm(item = {}) {
    const p = item.presentation || {};
    return panel(
      "categories",
      "الأقسام",
      "Categories",
      "إدارة الأقسام وصورها وبنر صفحة كل قسم.",
      "Manage categories, their images and each category's banner.",
      field(
        "categories",
        "name",
        "اسم القسم بالعربية",
        "Arabic category name",
        "text",
        { value: item.name || "", required: true },
      ) +
        field(
          "categories",
          "name_en",
          "اسم القسم بالإنجليزية",
          "English category name",
          "text",
          { value: p.name_en || "", required: true },
        ) +
        field("categories", "slug", "الرابط المختصر", "Slug", "text", {
          value: item.slug || "",
        }) +
        field(
          "categories",
          "sort_order",
          "ترتيب القسم",
          "Display order",
          "number",
          { value: item.sort_order || 0, min: 0, step: 1 },
        ) +
        field(
          "categories",
          "description",
          "وصف القسم بالعربية",
          "Arabic description",
          "textarea",
          { value: item.description || "" },
        ) +
        field(
          "categories",
          "description_en",
          "الوصف بالإنجليزية",
          "English description",
          "textarea",
          { value: p.description_en || "" },
        ) +
        upload(
          "category-image",
          "صورة القسم المربعة 1:1",
          "Square category image 1:1",
          item.image_url,
        ) +
        upload(
          "category-banner",
          "بنر صفحة القسم 1029 × 345",
          "Category page banner 1029 × 345",
          p.banner_url,
        ) +
        check(
          "categories",
          "is_active",
          "إظهار القسم",
          "Show category",
          !item.id || !!item.is_active,
        ) +
        check(
          "categories",
          "is_featured",
          "إظهاره في أشهر الخدمات",
          "Show in popular services",
          !!p.is_featured,
        ) +
        submitButtons("categories"),
    );
  }
  function bannerForm(item = {}) {
    const p = item.presentation || {};
    return panel(
      "banners",
      "صور الإعلانات",
      "Banner images",
      "إعلاناتك أنت، مع الإظهار والإخفاء والترتيب والجدولة.",
      "Your banners, with visibility, ordering and scheduling controls.",
      field(
        "banners",
        "title",
        "عنوان الإعلان بالعربية",
        "Arabic title",
        "text",
        { value: item.title || "", required: true },
      ) +
        field(
          "banners",
          "title_en",
          "العنوان بالإنجليزية",
          "English title",
          "text",
          { value: p.title_en || "", required: true },
        ) +
        field(
          "banners",
          "subtitle",
          "وصف بالعربية (اختياري)",
          "Arabic caption (optional)",
          "text",
          { value: item.subtitle || "" },
        ) +
        field(
          "banners",
          "subtitle_en",
          "وصف بالإنجليزية (اختياري)",
          "English caption (optional)",
          "text",
          { value: p.subtitle_en || "" },
        ) +
        upload(
          "banner-image",
          "صورة الإعلان — يُفضّل 1029 × 345",
          "Banner image — recommended 1029 × 345",
          item.image_url,
          false,
        ) +
        field(
          "banners",
          "link_url",
          "رابط الإعلان (اختياري)",
          "Banner link (optional)",
          "url",
          { value: item.link_url || "" },
        ) +
        field(
          "banners",
          "sort_order",
          "ترتيب الإعلان",
          "Display order",
          "number",
          { value: item.sort_order || 0, min: 0, step: 1 },
        ) +
        field(
          "banners",
          "slide_seconds",
          "مدة الشريحة بالثواني",
          "Slide duration in seconds",
          "number",
          { value: p.slide_seconds || 6, min: 2, max: 120, step: 1 },
        ) +
        check(
          "banners",
          "show_caption",
          "إظهار العنوان والوصف فوق الصورة",
          "Overlay title and caption",
          !!p.show_caption,
          true,
        ) +
        schedule("banners") +
        submitButtons("banners"),
    );
  }
  function simpleConfigForm(kind, item = {}) {
    let form = "",
      ar,
      en,
      lead,
      leadEn;
    if (kind === "promotions") {
      [ar, en, lead, leadEn] = [
        "الشريط المتحرك",
        "Moving strip",
        "نص وصورة متحركان، مع مدة ظهور وجدولة اختيارية.",
        "Moving text and images, with optional exposure duration and scheduling.",
      ];
      form =
        field(kind, "text_ar", "النص بالعربية", "Arabic text", "text", {
          value: item.text_ar || "",
        }) +
        field(kind, "text_en", "النص بالإنجليزية", "English text", "text", {
          value: item.text_en || "",
        }) +
        upload(
          "promotion-image",
          "صورة الشريط (اختيارية)",
          "Strip image (optional)",
          item.image_url,
        ) +
        field(
          kind,
          "animation_seconds",
          "مدة دورة الحركة بالثواني",
          "Animation cycle in seconds",
          "number",
          { value: item.animation_seconds || 25, min: 8, max: 120, step: 1 },
        ) +
        schedule(kind, true);
    } else if (kind === "notifications") {
      [ar, en, lead, leadEn] = [
        "إشعارات الموقع",
        "Site notifications",
        "تنبيهات تظهر للزائر داخل الموقع.",
        "Notifications shown to visitors inside the store.",
      ];
      form =
        field(kind, "title_ar", "العنوان بالعربية", "Arabic title", "text", {
          value: item.title_ar || "",
          required: true,
        }) +
        field(
          kind,
          "title_en",
          "العنوان بالإنجليزية",
          "English title",
          "text",
          { value: item.title_en || "", required: true },
        ) +
        field(kind, "text_ar", "النص بالعربية", "Arabic text", "textarea", {
          value: item.text_ar || "",
        }) +
        field(kind, "text_en", "النص بالإنجليزية", "English text", "textarea", {
          value: item.text_en || "",
        }) +
        upload(
          "notification-image",
          "صورة الإشعار (اختيارية)",
          "Notification image (optional)",
          item.image_url,
        ) +
        check(
          kind,
          "popup",
          "إظهار تنبيه عند زيارة الموقع",
          "Show a popup on visit",
          item.popup !== false,
          true,
        ) +
        schedule(kind, true);
    } else if (kind === "coupons") {
      [ar, en, lead, leadEn] = [
        "الكوبونات",
        "Coupons",
        "خصومات تُضمّن في رسالة الشراء لتأكيدها مع الإدارة.",
        "Discounts included in the purchase message for management to confirm.",
      ];
      form =
        field(kind, "code", "رمز الكوبون", "Coupon code", "text", {
          value: item.code || "",
          required: true,
          maxlength: 40,
        }) +
        field(kind, "type", "نوع الخصم", "Discount type", "select", {
          value: item.type || "percent",
          values: [
            ["percent", "نسبة مئوية", "Percentage"],
            ["fixed", "مبلغ ثابت", "Fixed amount"],
          ],
        }) +
        field(kind, "percent", "نسبة الخصم %", "Discount percent %", "number", {
          value: item.percent || 5,
          min: 0.01,
          max: 100,
          step: 0.01,
        }) +
        field(
          kind,
          "product_ids",
          "المنتجات (فارغ = كل المنتجات)",
          "Products (none = all products)",
          "select",
          {
            multiple: true,
            values: state.products.map((p) => [
              p.id,
              p.name,
              p.commerce?.name_en || p.name,
            ]),
          },
        ) +
        `<div class="form-section">${sectionTitle("مبلغ الخصم الثابت بالعملات الثلاث", "Fixed discount in all three currencies")}<div class="section-inputs">${moneyInputs(kind, item.prices || {}, "price", false)}</div>${sectionTitle("أقل قيمة طلب (0 = بدون حد)", "Minimum request value (0 = no minimum)")}<div class="section-inputs">${moneyInputs(kind, item.minimum || {}, "minimum", false)}</div></div>` +
        field(
          kind,
          "description_ar",
          "وصف الكوبون بالعربية",
          "Arabic description",
          "text",
          { value: item.description_ar || "" },
        ) +
        field(
          kind,
          "description_en",
          "الوصف بالإنجليزية",
          "English description",
          "text",
          { value: item.description_en || "" },
        ) +
        check(
          kind,
          "show_public",
          "إظهاره في صفحة كوبوناتي",
          "Show on My coupons",
          item.show_public !== false,
          true,
        ) +
        schedule(kind);
    } else {
      [ar, en, lead, leadEn] = [
        "طرق الدفع",
        "Payment methods",
        "أضف الصور وتفاصيل البنك أو المحفظة يدويًا.",
        "Manually add images and bank or wallet details.",
      ];
      form =
        field(
          kind,
          "name_ar",
          "اسم الطريقة بالعربية",
          "Arabic method name",
          "text",
          { value: item.name_ar || "", required: true },
        ) +
        field(kind, "name_en", "الاسم بالإنجليزية", "English name", "text", {
          value: item.name_en || "",
          required: true,
        }) +
        field(
          kind,
          "description_ar",
          "وصف مختصر بالعربية",
          "Short Arabic description",
          "text",
          { value: item.description_ar || "" },
        ) +
        field(
          kind,
          "description_en",
          "الوصف بالإنجليزية",
          "English description",
          "text",
          { value: item.description_en || "" },
        ) +
        field(
          kind,
          "details_ar",
          "تفاصيل الدفع بالعربية",
          "Arabic payment details",
          "textarea",
          { value: item.details_ar || "", required: true },
        ) +
        field(
          kind,
          "details_en",
          "تفاصيل الدفع بالإنجليزية",
          "English payment details",
          "textarea",
          { value: item.details_en || "", required: true },
        ) +
        upload(
          "payment-image",
          "صورة طريقة الدفع المربعة",
          "Square payment-method image",
          item.image_url,
        ) +
        check(
          kind,
          "enabled",
          "إظهار طريقة الدفع",
          "Show payment method",
          item.enabled !== false,
          true,
        );
    }
    form += submitButtons(kind);
    const output = panel(kind, ar, en, lead, leadEn, form);
    return output;
  }
  function settingsForm() {
    const s = state.settings,
      c = s.config;
    return panel(
      "settings",
      "هوية وإعدادات المتجر",
      "Brand & settings",
      "الاسم والشعار والثيم والإعلانات والتواصل والصيانة.",
      "Name, logo, theme, banners, contact details and maintenance.",
      field(
        "settings",
        "store_name",
        "اسم المتجر بالعربية",
        "Arabic store name",
        "text",
        { value: s.store_name, required: true },
      ) +
        field(
          "settings",
          "name_en",
          "اسم المتجر بالإنجليزية",
          "English store name",
          "text",
          { value: c.name_en, required: true },
        ) +
        upload(
          "store-logo",
          "شعار المتجر — PNG شفاف",
          "Store logo — transparent PNG",
          s.logo_url,
        ) +
        field(
          "settings",
          "logo_fit",
          "طريقة عرض الشعار",
          "Logo framing",
          "select",
          {
            value: c.logo_fit,
            values: [
              ["cover", "تكبير الشعار داخل الإطار", "Fill the logo frame"],
              ["contain", "عرض الصورة كاملة", "Show the complete image"],
            ],
            help: [
              "التكبير مناسب للشعار المحاط بفراغ. عند إزالة الصورة المخصصة يظهر الشعار الأصلي المرفق.",
              "Fill suits a logo with empty margins. Removing a custom image restores the supplied original logo.",
            ],
          },
        ) +
        field(
          "settings",
          "tagline_ar",
          "السطر التعريفي بالعربية",
          "Arabic tagline",
          "text",
          { value: c.tagline_ar },
        ) +
        field(
          "settings",
          "tagline_en",
          "السطر التعريفي بالإنجليزية",
          "English tagline",
          "text",
          { value: c.tagline_en },
        ) +
        field(
          "settings",
          "whatsapp",
          "واتساب استقبال الطلبات والدعم",
          "WhatsApp for requests & support",
          "tel",
          {
            value: c.whatsapp,
            required: true,
            help: [
              "رقم دولي، مثل +970568181910.",
              "International number, for example +970568181910.",
            ],
          },
        ) +
        field(
          "settings",
          "contact_email",
          "بريد التواصل",
          "Contact email",
          "email",
          { value: s.contact_email || "" },
        ) +
        field(
          "settings",
          "default_theme",
          "الثيم الافتراضي",
          "Default theme",
          "select",
          {
            value: c.default_theme,
            values: [
              ["dark", "الأسود والأحمر", "Black & red"],
              ["cream", "الحليبي الهادئ", "Soft cream"],
            ],
          },
        ) +
        field(
          "settings",
          "currency",
          "عملة العرض الافتراضية",
          "Default display currency",
          "select",
          {
            value: state.schemaReady ? s.currency : "USD",
            values: C.currencies.map((v) => [v, C.t(v, "ar"), C.t(v, "en")]),
          },
        ) +
        check(
          "settings",
          "show_banners",
          "إظهار صور الإعلانات أعلى الرئيسية",
          "Show banners at the top of home",
          c.show_banners,
          true,
        ) +
        field(
          "settings",
          "banner_seconds",
          "مدة تبديل الإعلان الافتراضية",
          "Default banner duration",
          "number",
          { value: c.banner_seconds, min: 2, max: 120, step: 1 },
        ) +
        `<div class="form-section">${sectionTitle("واجهة الترحيب عند إخفاء الإعلانات", "Welcome section when banners are hidden")}${check("settings", "show_intro", "إظهار واجهة الترحيب", "Show welcome section", c.show_intro)}<div class="section-inputs">${field("settings", "hero_title_ar", "العنوان بالعربية", "Arabic headline", "textarea", { value: c.hero_title_ar })}${field("settings", "hero_title_en", "العنوان بالإنجليزية", "English headline", "textarea", { value: c.hero_title_en })}${field("settings", "hero_text_ar", "الوصف بالعربية", "Arabic copy", "textarea", { value: c.hero_text_ar })}${field("settings", "hero_text_en", "الوصف بالإنجليزية", "English copy", "textarea", { value: c.hero_text_en })}</div>${upload("store-hero", "صورة واجهة الترحيب", "Welcome background", c.hero_image)}</div>` +
        `<div class="form-section">${sectionTitle("وسائل التواصل أسفل الموقع", "Social links in the footer")}<div id="socialLinksEditor"></div><button class="button small" type="button" id="addSocial">${translation("إضافة وسيلة تواصل", "Add social link")}</button></div>` +
        field(
          "settings",
          "footer_ar",
          "وصف أسفل الموقع بالعربية",
          "Arabic footer copy",
          "textarea",
          { value: c.footer_ar },
        ) +
        field(
          "settings",
          "footer_en",
          "الوصف بالإنجليزية",
          "English footer copy",
          "textarea",
          { value: c.footer_en },
        ) +
        `<div class="form-section">${sectionTitle("وضع الصيانة", "Maintenance mode")}${check("settings", "maintenance_enabled", "إيقاف المتجر للزوار مؤقتًا", "Temporarily pause the storefront", c.maintenance.enabled)}<div class="section-inputs">${field("settings", "maintenance_text_ar", "رسالة الصيانة بالعربية", "Arabic maintenance message", "textarea", { value: c.maintenance.text_ar })}${field("settings", "maintenance_text_en", "الرسالة بالإنجليزية", "English maintenance message", "textarea", { value: c.maintenance.text_en })}</div></div>` +
        submitButtons("settings"),
      false,
    );
  }
  function pagesForm() {
    const pages = state.settings.config.pages;
    return panel(
      "pages",
      "الصفحات والسياسات",
      "Pages & policies",
      "تحكم بمحتوى الصفحات في اللغتين وإظهارها في القائمة.",
      "Manage page content in both languages and menu visibility.",
      field("pages", "key", "الصفحة", "Page", "select", {
        full: true,
        values: Object.entries(pages).map(([key, p]) => [
          key,
          p.title_ar || C.t(key, "ar"),
          p.title_en || C.t(key, "en"),
        ]),
      }) +
        field(
          "pages",
          "title_ar",
          "عنوان الصفحة بالعربية",
          "Arabic page title",
          "text",
          { required: true },
        ) +
        field(
          "pages",
          "title_en",
          "العنوان بالإنجليزية",
          "English page title",
          "text",
          { required: true },
        ) +
        field(
          "pages",
          "ar",
          "محتوى الصفحة بالعربية",
          "Arabic content",
          "textarea",
          { full: true },
        ) +
        field(
          "pages",
          "en",
          "محتوى الصفحة بالإنجليزية",
          "English content",
          "textarea",
          { full: true },
        ) +
        check("pages", "enabled", "إظهار الصفحة", "Show page", true, true) +
        submitButtons("pages"),
      false,
    );
  }
  function overview() {
    return `<section class="admin-panel" id="panel-overview" ${state.tab !== "overview" ? "hidden" : ""}><div class="admin-panel-heading"><div><span class="eyebrow">F90 CARD</span><h1>${translation("كل التفاصيل بين يديك", "Every detail in your hands")}</h1><p>${translation("إدارة واضحة لمتجرك وخدماتك.", "A clear view of your store and services.")}</p></div></div><div class="overview-stats" id="overviewStats"></div><div class="admin-card"><h2>${translation("طريقة عمل المتجر", "How the store works")}</h2><p class="overview-note">${translation("الزائر يختار خدمة، يُدخل البيانات التي تحددها، ثم يفتح رسالة طلب جاهزة في واتساب. تأكيد السعر والدفع والتسليم معك مباشرة. تبقى لوحة الإدارة محمية بحساب المدير.", "Visitors choose a service, fill in the fields you define, then open a prepared WhatsApp request message. You confirm price, payment and delivery directly. Administration remains protected by an admin account.")}</p><div class="form-actions"><button class="button primary" type="button" data-tab="products">${translation("إدارة المنتجات", "Manage products")}</button><button class="button" type="button" data-tab="settings">${translation("تخصيص المتجر", "Customize store")}</button></div></div></section>`;
  }
  let socialDraft = [];
  function build() {
    $("adminNavigation").innerHTML = tabs
      .map(
        ([key, ar, en, ic]) =>
          `<button type="button" data-tab="${key}" class="${state.tab === key ? "active" : ""}">${C.icon(ic)}${translation(ar, en)}</button>`,
      )
      .join("");
    $("adminPanels").innerHTML =
      overview() +
      productForm() +
      categoryForm() +
      bannerForm() +
      ["promotions", "notifications", "coupons", "payments"]
        .map((kind) => simpleConfigForm(kind))
        .join("") +
      pagesForm() +
      settingsForm();
    renderFieldRows();
    renderTierRows();
    syncQuantityMode();
    socialDraft = structuredClone(state.settings.config.social_links);
    renderSocialRows();
    fillPage("about");
    translate();
  }
  function readRows(root) {
    return [...root.querySelectorAll(".repeater-row")].map((row) => {
      const data = { id: row.dataset.id };
      row.querySelectorAll("[data-key]").forEach((input) => {
        data[input.dataset.key] =
          input.type === "checkbox" ? input.checked : input.value;
      });
      return data;
    });
  }
  function rowInput(index, key, ar, en, type, value, options = {}) {
    return field(`row${index}`, key, ar, en, type, {
      ...options,
      value,
    }).replaceAll(`name="${key}"`, `name="${key}" data-key="${key}"`);
  }
  function rowCheck(index, key, ar, en, value) {
    return check(`row${index}`, key, ar, en, value).replaceAll(
      `name="${key}"`,
      `name="${key}" data-key="${key}"`,
    );
  }
  function syncQuantityMode() {
    const quantity = $("products-type")?.value === "quantity";
    document.querySelectorAll(".quantity-settings").forEach((section) => {
      section.hidden = !quantity;
      section
        .querySelectorAll("input,select,textarea,button")
        .forEach((input) => {
          input.disabled = !quantity;
        });
    });
  }
  function renderFieldRows() {
    $("requestFields").innerHTML = state.fields
      .map(
        (f, i) =>
          `<div class="repeater-row" data-id="${e(f.id || crypto.randomUUID())}"><div class="repeater-actions"><span>${translation("خانة العميل", "Customer field")} ${i + 1}</span><button type="button" data-remove-field="${i}">${translation("حذف", "Remove")}</button></div><div class="repeater-grid">${rowInput("f" + i, "label_ar", "اسم الخانة بالعربية", "Arabic label", "text", f.label_ar || "", { required: true })}${rowInput("f" + i, "label_en", "الاسم بالإنجليزية", "English label", "text", f.label_en || "", { required: true })}${rowInput(
            "f" + i,
            "type",
            "نوع الخانة",
            "Field type",
            "select",
            f.type || "text",
            {
              values: [
                ["text", "نص / أيدي حساب", "Text / account ID"],
                ["email", "بريد إلكتروني", "Email"],
                ["tel", "هاتف / واتساب", "Phone / WhatsApp"],
                ["number", "رقم", "Number"],
                ["textarea", "نص طويل", "Long text"],
                ["select", "قائمة خيارات", "Select options"],
              ],
            },
          )}${rowInput("f" + i, "max_length", "أقصى عدد حروف", "Maximum characters", "number", f.max_length || 250, { min: 1, max: 1000, step: 1 })}${rowInput("f" + i, "placeholder_ar", "نص توضيحي بالعربية", "Arabic placeholder", "text", f.placeholder_ar || "")}${rowInput("f" + i, "placeholder_en", "التوضيح بالإنجليزية", "English placeholder", "text", f.placeholder_en || "")}${rowInput("f" + i, "options_text", "خيارات القائمة: عربي | English، كل خيار بسطر", "Select options: Arabic | English, one per line", "textarea", (f.options || []).map((o) => (typeof o === "string" ? o : `${o.label_ar || o.value} | ${o.label_en || o.value}`)).join("\n"))}${rowCheck("f" + i, "required", "خانة مطلوبة", "Required field", !!f.required)}${rowCheck("f" + i, "enabled", "إظهار الخانة", "Show field", f.enabled !== false)}</div></div>`,
      )
      .join("");
    translate();
  }
  function collectFields() {
    return readRows($("requestFields")).map((f) => ({
      ...f,
      max_length: Number(f.max_length),
      options: String(f.options_text || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const [ar, en] = s.split("|").map((v) => v.trim());
          return { value: ar, label_ar: ar, label_en: en || ar };
        }),
      options_text: undefined,
    }));
  }
  function renderTierRows() {
    $("pricingTiers").innerHTML = state.tiers
      .map(
        (tier, i) =>
          `<div class="repeater-row"><div class="repeater-actions"><span>${translation("شريحة", "Tier")} ${i + 1}</span><button type="button" data-remove-tier="${i}">${translation("حذف", "Remove")}</button></div><div class="repeater-grid pricing-tier-grid">${rowInput("t" + i, "min_quantity", "ابتداءً من كمية", "Starting quantity", "number", tier.min_quantity || 1000000, { min: 1, max: 1000000000, step: 1, required: true })}${rowInput("t" + i, "unit_quantity", "لكل كم وحدة؟", "Per how many units?", "number", tier.unit_quantity || 1000000, { min: 1, max: 1000000000, step: 1, required: true })}${C.currencies.map((v) => rowInput("t" + i, `price_${v}`, C.t(v, "ar"), C.t(v, "en"), "number", tier.prices?.[v] ?? "", { min: 0, step: "0.000001", required: true })).join("")}</div></div>`,
      )
      .join("");
    translate();
  }
  function collectTiers() {
    return readRows($("pricingTiers")).map((r) => ({
      min_quantity: Number(r.min_quantity),
      unit_quantity: Number(r.unit_quantity),
      prices: Object.fromEntries(C.currencies.map((v) => [v, r[`price_${v}`]])),
    }));
  }
  function renderSocialRows() {
    $("socialLinksEditor").innerHTML = socialDraft
      .map(
        (link, i) =>
          `<div class="repeater-row" data-id="${e(link.id || crypto.randomUUID())}"><div class="repeater-actions"><span>${translation("وسيلة تواصل", "Social link")} ${i + 1}</span><button type="button" data-remove-social="${i}">${translation("حذف", "Remove")}</button></div><div class="repeater-grid">${rowInput("s" + i, "name_ar", "الاسم بالعربية", "Arabic name", "text", link.name_ar || "", { required: true })}${rowInput("s" + i, "name_en", "الاسم بالإنجليزية", "English name", "text", link.name_en || "", { required: true })}${rowInput("s" + i, "url", "الرابط الكامل", "Full URL", "text", link.url || "", { required: true })}${rowInput(
            "s" + i,
            "icon",
            "الأيقونة",
            "Icon",
            "select",
            link.icon || "link",
            {
              values: [
                ["whatsapp", "واتساب", "WhatsApp"],
                ["instagram", "إنستجرام", "Instagram"],
                ["tiktok", "تيك توك", "TikTok"],
                ["youtube", "يوتيوب", "YouTube"],
                ["facebook", "فيسبوك", "Facebook"],
                ["mail", "بريد", "Email"],
                ["link", "رابط / منصة أخرى", "Link / other platform"],
              ],
            },
          )}${rowCheck("s" + i, "enabled", "إظهار الرابط", "Show link", link.enabled !== false)}</div></div>`,
      )
      .join("");
    translate();
  }
  function translate() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-ar]").forEach((el) => {
      el.textContent = lang === "en" ? el.dataset.en : el.dataset.ar;
    });
    document.querySelectorAll("[data-placeholder-ar]").forEach((el) => {
      el.placeholder =
        lang === "en" ? el.dataset.placeholderEn : el.dataset.placeholderAr;
    });
    $("adminLanguage").textContent = lang === "ar" ? "EN" : "ع";
    document.title = L("إدارة F90 CARD", "F90 CARD administration");
  }
  function activateTab(tab) {
    if (!tabs.some((t) => t[0] === tab)) return;
    state.tab = tab;
    document.querySelectorAll(".admin-panel").forEach((el) => {
      el.hidden = el.id !== `panel-${tab}`;
    });
    document
      .querySelectorAll("[data-tab]")
      .forEach((el) => el.classList.toggle("active", el.dataset.tab === tab));
  }
  const v = (kind, key) => $(`${kind}-${key}`)?.value?.trim() || "";
  const checked = (kind, key) => !!$(`${kind}-${key}`)?.checked;
  function set(kind, key, value) {
    const input = $(`${kind}-${key}`);
    if (!input) return;
    if (input.type === "checkbox") input.checked = !!value;
    else input.value = value ?? "";
  }
  function localDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  function dates(kind) {
    const start = v(kind, "starts_at"),
      end = v(kind, "ends_at");
    const starts_at = start ? new Date(start).toISOString() : null,
      ends_at = end ? new Date(end).toISOString() : null;
    if (starts_at && ends_at && Date.parse(starts_at) >= Date.parse(ends_at))
      throw new Error(
        L(
          "نهاية العرض يجب أن تكون بعد بدايته.",
          "End time must follow start time.",
        ),
      );
    return { starts_at, ends_at };
  }
  function slug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}-]/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
  function prices(kind, prefix = "price", required = true) {
    return Object.fromEntries(
      C.currencies.map((currency) => {
        const value = v(kind, `${prefix}_${currency}`);
        if (required && !value)
          throw new Error(
            L(
              "أدخل سعر العملات الثلاث.",
              "Enter prices in all three currencies.",
            ),
          );
        C.micros(value || "0");
        return [currency, value || "0"];
      }),
    );
  }
  async function requireAdmin() {
    if (!db)
      throw new Error(
        L("تعذّر الاتصال بقاعدة البيانات.", "Database connection unavailable."),
      );
    const { data, error } = await db.auth.getUser();
    if (error || !data?.user)
      throw new Error(
        L(
          "انتهت الجلسة. سجّل الدخول مجددًا.",
          "Your session ended. Sign in again.",
        ),
      );
    const role = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (role.error) throw role.error;
    if (role.data?.role !== "admin")
      throw new Error(
        L("هذا الحساب ليس مديرًا.", "This account is not an administrator."),
      );
    return data.user;
  }
  function requireSchema() {
    if (!state.schemaReady)
      throw new Error(
        L(
          "شغّل تحديث قاعدة البيانات ثم أعد تحميل البيانات.",
          "Run the database migration, then reload data.",
        ),
      );
  }
  function showDashboard(visible) {
    $("loginSection").hidden = visible;
    $("dashboard").hidden = !visible;
    $("logoutButton").hidden = !visible;
  }
  async function allRows(table) {
    const rows = [];
    for (let start = 0; ; start += 500) {
      let query = db.from(table).select("*");
      query =
        table === "products"
          ? query.order("created_at", { ascending: false }).order("id")
          : query.order("sort_order").order("id");
      const { data, error } = await query.range(start, start + 499);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 500) return rows;
    }
  }
  async function refreshAll(first = false) {
    await requireAdmin();
    const results = await Promise.allSettled([
      allRows("products"),
      allRows("categories"),
      allRows("banners"),
      db.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    const failures = [];
    ["products", "categories", "banners"].forEach((key, index) => {
      const result = results[index];
      if (result.status === "fulfilled") state[key] = result.value;
      else failures.push(result.reason?.message || key);
    });
    const s = results[3];
    if (s.status === "fulfilled" && !s.value.error) {
      state.rawSettings = s.value.data;
      state.settings = C.settings(s.value.data || {});
      state.schemaReady =
        !!s.value.data?.config && Number(s.value.data.config.version) >= 2;
    } else
      failures.push(
        s.status === "fulfilled" ? s.value.error.message : s.reason?.message,
      );
    if (first) build();
    const selector = $("products-category_id");
    if (selector) {
      const selected = selector.value;
      selector.innerHTML =
        `<option value="">${e(L("اختر القسم", "Choose category"))}</option>` +
        state.categories
          .map(
            (cat) =>
              `<option value="${e(cat.id)}">${e(activeName(cat))}</option>`,
          )
          .join("");
      selector.value = selected;
    }
    $("schemaNotice").hidden = state.schemaReady;
    const customLogo = C.safeUrl(state.settings.logo_url);
    const logoFit =
      !customLogo || state.settings.config.logo_fit === "cover"
        ? " brand-image-cover"
        : "";
    $("adminBrand").innerHTML =
      `<img class="brand-image${logoFit}" src="${e(customLogo || "./f90-logo.png")}" alt="${e(state.settings.store_name)}">`;
    renderLists();
    renderOverview();
    translate();
    if (failures.length)
      status(
        "تعذّر تحميل بعض البيانات",
        "Some data could not be loaded",
        "error",
        failures.join(" · "),
      );
  }
  function configKey(kind) {
    return kind === "payments" ? "payment_methods" : kind;
  }
  function items(kind) {
    return ["products", "categories", "banners"].includes(kind)
      ? state[kind]
      : state.settings.config[configKey(kind)] || [];
  }
  function listName(item) {
    return C.localized(
      item.name ||
        item.title ||
        item.name_ar ||
        item.title_ar ||
        item.text_ar ||
        item.code,
      item.commerce?.name_en ||
        item.presentation?.name_en ||
        item.presentation?.title_en ||
        item.name_en ||
        item.title_en ||
        item.text_en ||
        item.code,
      lang,
    );
  }
  function renderList(kind) {
    const root = $(`${kind}List`);
    if (!root) return;
    const query = ($(`${kind}Search`)?.value || "").trim().toLowerCase(),
      all = items(kind),
      filtered = all.filter((item) =>
        `${listName(item)} ${item.code || ""}`.toLowerCase().includes(query),
      );
    $(`${kind}Count`).textContent = `(${all.length})`;
    root.innerHTML =
      filtered
        .map((item) => {
          const visible = item.is_active ?? item.enabled ?? true,
            url = C.safeUrl(item.image_url),
            meta =
              kind === "products"
                ? `${L("السعر الأساسي", "Base price")}: ${item.price} ${item.currency}`
                : kind === "categories"
                  ? `${state.products.filter((p) => p.category_id === item.id).length} ${L("منتج", "products")}`
                  : kind === "banners"
                    ? `${L("الترتيب", "Order")}: ${item.sort_order}`
                    : "";
          return `<article class="admin-item">${url ? `<img class="admin-item-image" src="${e(url)}" alt="" loading="lazy">` : `<span class="admin-item-image admin-item-placeholder">${C.icon("grid")}</span>`}<div class="admin-item-info"><h3>${e(listName(item))}</h3><p>${e(meta)}</p><span class="admin-item-state ${visible ? "" : "hidden-item"}">${translation(visible ? "مفعّل" : "مخفي", visible ? "Enabled" : "Hidden")}</span></div><div class="admin-item-actions"><button type="button" data-edit="${kind}" data-id="${e(item.id)}">${translation("تعديل", "Edit")}</button><button type="button" data-toggle="${kind}" data-id="${e(item.id)}">${translation(visible ? "إخفاء" : "إظهار", visible ? "Hide" : "Show")}</button><button type="button" class="danger" data-delete="${kind}" data-id="${e(item.id)}">${translation("حذف", "Delete")}</button></div></article>`;
        })
        .join("") ||
      `<p class="empty-state">${translation("لا توجد عناصر مطابقة.", "No matching items.")}</p>`;
  }
  function renderLists() {
    [
      "products",
      "categories",
      "banners",
      "promotions",
      "notifications",
      "coupons",
      "payments",
    ].forEach(renderList);
  }
  function renderOverview() {
    const root = $("overviewStats");
    if (!root) return;
    root.innerHTML = [
      ["المنتجات", "Products", state.products.length, "game"],
      ["الأقسام", "Categories", state.categories.length, "grid"],
      ["الإعلانات", "Banners", state.banners.length, "star"],
      ["طرق الدفع", "Payment methods", items("payments").length, "wallet"],
    ]
      .map(
        ([ar, en, count, ic]) =>
          `<article class="overview-stat"><span>${translation(ar, en)}</span><strong>${count}</strong>${C.icon(ic)}</article>`,
      )
      .join("");
  }
  function replacePanel(kind, markup) {
    $(`panel-${kind}`).outerHTML = markup;
    activateTab(kind);
    translate();
  }
  function fillSchedule(kind, item) {
    set(kind, "starts_at", localDate(item.starts_at));
    set(kind, "ends_at", localDate(item.ends_at));
    set(kind, "display_seconds", item.display_seconds || 0);
    set(kind, "enabled", item.is_active ?? item.enabled ?? true);
  }
  function edit(kind, item) {
    state.edited[kind] = item;
    if (kind === "products") {
      replacePanel(kind, productForm(item));
      renderFieldRows();
      renderTierRows();
      syncQuantityMode();
    } else if (kind === "categories") replacePanel(kind, categoryForm(item));
    else if (kind === "banners") {
      replacePanel(kind, bannerForm(item));
      fillSchedule(kind, item.presentation || {});
      set(kind, "enabled", !!item.is_active);
    } else {
      replacePanel(kind, simpleConfigForm(kind, item));
      fillSchedule(kind, item);
      if (kind === "coupons") {
        [...$("coupons-product_ids").options].forEach((option) => {
          option.selected = (item.product_ids || []).includes(option.value);
        });
      }
    }
    renderList(kind);
    $(`panel-${kind}`).scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function resetForm(kind) {
    state.edited[kind] = null;
    if (kind === "products") {
      replacePanel(kind, productForm());
      renderFieldRows();
      renderTierRows();
      syncQuantityMode();
    } else if (kind === "categories") replacePanel(kind, categoryForm());
    else if (kind === "banners") replacePanel(kind, bannerForm());
    else if (kind === "settings") {
      replacePanel(kind, settingsForm());
      socialDraft = structuredClone(state.settings.config.social_links);
      renderSocialRows();
    } else if (kind === "pages") {
      const key = v(kind, "key") || "about";
      replacePanel(kind, pagesForm());
      fillPage(key);
    } else replacePanel(kind, simpleConfigForm(kind));
    renderList(kind);
  }
  function fillPage(key) {
    const page = state.settings.config.pages[key];
    if (!page) return;
    set("pages", "key", key);
    set("pages", "title_ar", page.title_ar || C.t(key, "ar"));
    set("pages", "title_en", page.title_en || C.t(key, "en"));
    set("pages", "ar", page.ar || "");
    set("pages", "en", page.en || "");
    set("pages", "enabled", page.enabled !== false);
  }
  let currentUploads = [],
    mutationBusy = false;
  async function uploadImage(file, folder) {
    if (!file) return null;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      throw new Error(
        L(
          "الصورة يجب أن تكون PNG/JPG/WebP ولا تتجاوز 5 MB.",
          "Images must be PNG/JPG/WebP and no larger than 5 MB.",
        ),
      );
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const png =
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71,
      jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      webp =
        String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!(
      (file.type === "image/png" && png) ||
      (file.type === "image/jpeg" && jpg) ||
      (file.type === "image/webp" && webp)
    ))
      throw new Error(
        L(
          "محتوى الملف لا يطابق نوع الصورة.",
          "File contents do not match the image type.",
        ),
      );
    const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      }[file.type],
      path = `${folder}/${crypto.randomUUID()}.${extension}`;
    const result = await db.storage.from("f90-images").upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (result.error) throw result.error;
    currentUploads.push(path);
    return db.storage.from("f90-images").getPublicUrl(result.data.path).data
      .publicUrl;
  }
  async function resolveImage(prefix, existing, folder) {
    const file = $(`${prefix}-file`)?.files?.[0];
    if (file) return uploadImage(file, folder);
    return $(`${prefix}-remove`)?.checked ? null : existing || null;
  }
  async function saveRow(table, item, payload) {
    const result = item?.id
      ? await db.from(table).update(payload).eq("id", item.id).select("id")
      : await db.from(table).insert(payload).select("id");
    if (result.error) throw result.error;
    if (!result.data?.length)
      throw new Error(
        L(
          "لم يُحفظ العنصر. تحقق من الصلاحيات ثم أعد المحاولة.",
          "The item was not saved. Check permissions and try again.",
        ),
      );
  }
  async function saveProduct() {
    const item = state.edited.products || {},
      old = C.commerce(item),
      type = v("products", "type"),
      fields = collectFields(),
      tiers = collectTiers();
    fields.forEach((f) => {
      if (
        !f.label_ar ||
        !f.label_en ||
        !Number.isInteger(f.max_length) ||
        f.max_length < 1 ||
        f.max_length > 1000
      )
        throw new Error(
          L(
            "راجع أسماء الخانات وحدود الحروف.",
            "Check field labels and character limits.",
          ),
        );
      if (f.type === "select" && !f.options.length)
        throw new Error(
          L(
            "أضف خيارات لقائمة العميل.",
            "Add options for the customer select field.",
          ),
        );
    });
    const c = {
      ...old,
      type,
      name_en: v("products", "name_en"),
      description_en: v("products", "description_en"),
      prices: prices("products"),
      quantity_min: Number(v("products", "quantity_min") || 1),
      quantity_max: Number(v("products", "quantity_max") || 1000000000),
      quantity_step: Number(v("products", "quantity_step") || 1),
      unit_quantity: Number(v("products", "unit_quantity") || 1),
      quantity_label_ar: v("products", "quantity_label_ar") || "كوينز",
      quantity_label_en: v("products", "quantity_label_en") || "Coins",
      delivery_time: v("products", "delivery_time"),
      delivery_time_en: v("products", "delivery_time_en"),
      fields,
      pricing_tiers: type === "quantity" ? tiers : [],
    };
    if (type === "quantity") {
      if (
        ![
          c.quantity_min,
          c.quantity_max,
          c.quantity_step,
          c.unit_quantity,
        ].every((n) => Number.isSafeInteger(n) && n > 0 && n <= 1000000000) ||
        c.quantity_min > c.quantity_max
      )
        throw new Error(
          L("حدود الكمية غير صحيحة.", "Quantity limits are invalid."),
        );
      const thresholds = new Set();
      tiers.forEach((t) => {
        if (
          !Number.isInteger(t.min_quantity) ||
          t.min_quantity < c.quantity_min ||
          t.min_quantity > c.quantity_max ||
          !Number.isInteger(t.unit_quantity) ||
          t.unit_quantity < 1 ||
          thresholds.has(t.min_quantity)
        )
          throw new Error(
            L(
              "راجع حدود الشرائح؛ لا تكرر كمية البداية.",
              "Check tier thresholds; starting quantities must be unique.",
            ),
          );
        thresholds.add(t.min_quantity);
        C.currencies.forEach((currency) => C.micros(t.prices[currency]));
      });
      c.pricing_tiers.sort((a, b) => a.min_quantity - b.min_quantity);
    }
    const stock = v("products", "stock");
    if (stock && !Number.isSafeInteger(Number(stock)))
      throw new Error(
        L("المخزون يجب أن يكون عددًا صحيحًا.", "Stock must be an integer."),
      );
    const payload = {
      name: v("products", "name"),
      slug: slug(v("products", "slug") || v("products", "name")),
      description: v("products", "description"),
      price: Number(c.prices.USD),
      currency: "USD",
      category_id: v("products", "category_id"),
      stock: stock === "" ? null : Number(stock),
      sort_order: Number(v("products", "sort_order") || 0),
      is_active: checked("products", "is_active"),
      is_featured: checked("products", "is_featured"),
      commerce: c,
      updated_at: new Date().toISOString(),
    };
    if (!payload.slug)
      throw new Error(L("أدخل رابطًا مختصرًا صحيحًا.", "Enter a valid slug."));
    const validation = { ...payload, stock: null };
    C.currencies.forEach((currency) => {
      C.quote(validation, type === "quantity" ? c.quantity_min : 1, currency);
      if (type === "quantity") C.quote(validation, c.quantity_max, currency);
    });
    payload.image_url = await resolveImage(
      "product-image",
      item.image_url,
      "products",
    );
    const removed = new Set(
      [...document.querySelectorAll("[data-gallery-remove]:checked")].map(
        (input) => Number(input.dataset.galleryRemove),
      ),
    );
    payload.gallery = state.gallery.filter((_, i) => !removed.has(i));
    for (const file of [...($("product-gallery-file")?.files || [])])
      payload.gallery.push(await uploadImage(file, "products"));
    await saveRow("products", item, payload);
  }
  async function saveCategory() {
    const item = state.edited.categories || {},
      p = item.presentation || {};
    await saveRow("categories", item, {
      name: v("categories", "name"),
      slug: slug(v("categories", "slug") || v("categories", "name")),
      description: v("categories", "description"),
      sort_order: Number(v("categories", "sort_order") || 0),
      is_active: checked("categories", "is_active"),
      image_url: await resolveImage(
        "category-image",
        item.image_url,
        "categories",
      ),
      presentation: {
        ...p,
        name_en: v("categories", "name_en"),
        description_en: v("categories", "description_en"),
        is_featured: checked("categories", "is_featured"),
        banner_url: await resolveImage(
          "category-banner",
          p.banner_url,
          "category-banners",
        ),
      },
    });
  }
  async function saveBanner() {
    const item = state.edited.banners || {},
      image_url = await resolveImage("banner-image", item.image_url, "banners");
    if (!image_url)
      throw new Error(L("أضف صورة للإعلان.", "Add a banner image."));
    const link = v("banners", "link_url");
    if (link && !C.safeUrl(link))
      throw new Error(L("رابط الإعلان غير صحيح.", "Invalid banner URL."));
    await saveRow("banners", item, {
      title: v("banners", "title"),
      subtitle: v("banners", "subtitle"),
      image_url,
      link_url: link || null,
      sort_order: Number(v("banners", "sort_order") || 0),
      is_active: checked("banners", "enabled"),
      presentation: {
        ...item.presentation,
        ...dates("banners"),
        title_en: v("banners", "title_en"),
        subtitle_en: v("banners", "subtitle_en"),
        show_caption: checked("banners", "show_caption"),
        slide_seconds: Number(v("banners", "slide_seconds") || 6),
      },
    });
  }
  async function updateConfig(transform, base = {}) {
    const fresh = await db
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (fresh.error) throw fresh.error;
    if (!fresh.data?.config)
      throw new Error(
        L("حدّث قاعدة البيانات أولًا.", "Update the database first."),
      );
    const config = transform(structuredClone(C.settings(fresh.data).config)),
      payload = { ...base, config, updated_at: new Date().toISOString() };
    let query = db.from("site_settings").update(payload).eq("id", 1);
    if (fresh.data.updated_at)
      query = query.eq("updated_at", fresh.data.updated_at);
    const result = await query.select("id");
    if (result.error) throw result.error;
    if (!result.data?.length)
      throw new Error(
        L(
          "تغيّرت الإعدادات أثناء الحفظ. أعد تحميل البيانات وحاول مجددًا.",
          "Settings changed while saving. Reload data and try again.",
        ),
      );
  }
  async function saveConfigRecord(kind) {
    const old = state.edited[kind] || {},
      data = {
        ...old,
        id: old.id || crypto.randomUUID(),
        enabled: checked(kind, "enabled"),
        updated_at: new Date().toISOString(),
      };
    if (kind !== "payments") Object.assign(data, dates(kind));
    if (kind === "promotions") {
      Object.assign(data, {
        text_ar: v(kind, "text_ar"),
        text_en: v(kind, "text_en"),
        animation_seconds: Number(v(kind, "animation_seconds") || 25),
        display_seconds: Number(v(kind, "display_seconds") || 0),
        image_url: await resolveImage(
          "promotion-image",
          old.image_url,
          "promotions",
        ),
      });
      if (!data.text_ar && !data.text_en && !data.image_url)
        throw new Error(
          L("أضف نصًا أو صورة للشريط.", "Add text or an image to the strip."),
        );
      if ((data.text_ar && !data.text_en) || (data.text_en && !data.text_ar))
        throw new Error(
          L("أدخل نص الشريط باللغتين.", "Enter strip text in both languages."),
        );
    } else if (kind === "notifications")
      Object.assign(data, {
        title_ar: v(kind, "title_ar"),
        title_en: v(kind, "title_en"),
        text_ar: v(kind, "text_ar"),
        text_en: v(kind, "text_en"),
        popup: checked(kind, "popup"),
        display_seconds: Number(v(kind, "display_seconds") || 0),
        image_url: await resolveImage(
          "notification-image",
          old.image_url,
          "notifications",
        ),
      });
    else if (kind === "coupons") {
      Object.assign(data, {
        code: v(kind, "code").toUpperCase(),
        type: v(kind, "type"),
        percent: Number(v(kind, "percent")),
        prices: prices(kind, "price", false),
        minimum: prices(kind, "minimum", false),
        description_ar: v(kind, "description_ar"),
        description_en: v(kind, "description_en"),
        show_public: checked(kind, "show_public"),
        product_ids: [...$("coupons-product_ids").selectedOptions].map(
          (option) => option.value,
        ),
      });
      if (!/^[A-Z0-9_-]{2,40}$/.test(data.code))
        throw new Error(
          L(
            "استخدم حروفًا إنجليزية وأرقامًا لرمز الكوبون.",
            "Use English letters and numbers for the coupon code.",
          ),
        );
      if (
        data.type === "percent" &&
        (!(data.percent > 0) || data.percent > 100)
      )
        throw new Error(
          L(
            "نسبة الخصم يجب أن تكون أكبر من 0 وحتى 100.",
            "Discount percentage must be above 0 and at most 100.",
          ),
        );
    } else
      Object.assign(data, {
        name_ar: v(kind, "name_ar"),
        name_en: v(kind, "name_en"),
        description_ar: v(kind, "description_ar"),
        description_en: v(kind, "description_en"),
        details_ar: v(kind, "details_ar"),
        details_en: v(kind, "details_en"),
        image_url: await resolveImage(
          "payment-image",
          old.image_url,
          "payments",
        ),
      });
    await updateConfig((config) => {
      const key = configKey(kind),
        list = Array.isArray(config[key]) ? config[key] : [],
        existing = list.find((item) => item.id === data.id);
      if (
        old.id &&
        existing?.updated_at &&
        old.updated_at !== existing.updated_at
      )
        throw new Error(
          L(
            "عدّل مدير آخر هذا العنصر. أعد تحميله قبل الحفظ.",
            "Another admin changed this item. Reload it before saving.",
          ),
        );
      if (
        kind === "coupons" &&
        list.some((c) => c.id !== data.id && c.code === data.code)
      )
        throw new Error(
          L("رمز الكوبون مستخدم بالفعل.", "This coupon code already exists."),
        );
      config[key] = existing
        ? list.map((item) => (item.id === data.id ? data : item))
        : [...list, data];
      return config;
    });
  }
  async function saveSettings() {
    const c = state.settings.config,
      phone = C.phone(v("settings", "whatsapp")),
      links = readRows($("socialLinksEditor"));
    links.forEach((link) => {
      if (
        !C.safeUrl(link.url, ["mailto:", "tel:"]) ||
        !link.name_ar ||
        !link.name_en
      )
        throw new Error(
          L(
            "راجع أسماء وروابط وسائل التواصل.",
            "Check social-link names and URLs.",
          ),
        );
    });
    const values = {
      name_en: v("settings", "name_en"),
      logo_fit: v("settings", "logo_fit") === "contain" ? "contain" : "cover",
      tagline_ar: v("settings", "tagline_ar"),
      tagline_en: v("settings", "tagline_en"),
      whatsapp: phone,
      default_theme: v("settings", "default_theme"),
      banner_seconds: Number(v("settings", "banner_seconds") || 6),
      show_banners: checked("settings", "show_banners"),
      show_intro: checked("settings", "show_intro"),
      hero_title_ar: v("settings", "hero_title_ar"),
      hero_title_en: v("settings", "hero_title_en"),
      hero_text_ar: v("settings", "hero_text_ar"),
      hero_text_en: v("settings", "hero_text_en"),
      hero_image: await resolveImage("store-hero", c.hero_image, "branding"),
      social_links: links,
      footer_ar: v("settings", "footer_ar"),
      footer_en: v("settings", "footer_en"),
      maintenance: {
        enabled: checked("settings", "maintenance_enabled"),
        text_ar: v("settings", "maintenance_text_ar"),
        text_en: v("settings", "maintenance_text_en"),
      },
    };
    const base = {
      store_name: v("settings", "store_name"),
      currency: v("settings", "currency"),
      contact_email: v("settings", "contact_email") || null,
      logo_url: await resolveImage(
        "store-logo",
        state.settings.logo_url,
        "branding",
      ),
    };
    await updateConfig((config) => ({ ...config, ...values }), base);
  }
  async function savePages() {
    const key = v("pages", "key"),
      page = {
        title_ar: v("pages", "title_ar"),
        title_en: v("pages", "title_en"),
        ar: v("pages", "ar"),
        en: v("pages", "en"),
        enabled: checked("pages", "enabled"),
      };
    await updateConfig((config) => {
      config.pages[key] = { ...config.pages[key], ...page };
      return config;
    });
  }
  async function submit(event) {
    const form = event.target,
      kind = form.dataset.kind;
    if (!kind) return;
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const button = form.querySelector('[type="submit"]');
    if (button.disabled || mutationBusy) return;
    mutationBusy = true;
    button.disabled = true;
    currentUploads = [];
    try {
      await requireAdmin();
      requireSchema();
      if (kind === "products") await saveProduct();
      else if (kind === "categories") await saveCategory();
      else if (kind === "banners") await saveBanner();
      else if (kind === "settings") await saveSettings();
      else if (kind === "pages") await savePages();
      else await saveConfigRecord(kind);
      currentUploads = [];
      await refreshAll();
      resetForm(kind);
      status("تم حفظ التغييرات.", "Changes saved.", "success");
    } catch (error) {
      if (currentUploads.length) {
        try {
          await db.storage.from("f90-images").remove(currentUploads);
        } catch {
          /* Failed cleanup is retried through Storage by the owner. */
        }
      }
      currentUploads = [];
      status("تعذّر الحفظ", "Unable to save", "error", error.message);
    } finally {
      button.disabled = false;
      mutationBusy = false;
    }
  }
  async function toggle(kind, id) {
    if (mutationBusy) return;
    mutationBusy = true;
    try {
      await requireAdmin();
      const item = items(kind).find((item) => item.id === id);
      if (!item) return;
      if (["products", "categories", "banners"].includes(kind)) {
        await saveRow(kind, item, { is_active: !item.is_active });
      } else {
        requireSchema();
        await updateConfig((config) => {
          const key = configKey(kind);
          config[key] = (config[key] || []).map((row) =>
            row.id === id
              ? {
                  ...row,
                  enabled: row.enabled === false,
                  updated_at: new Date().toISOString(),
                }
              : row,
          );
          return config;
        });
      }
      await refreshAll();
      status("تم تحديث الظهور.", "Visibility updated.", "success");
    } catch (error) {
      status("تعذّر التحديث", "Update failed", "error", error.message);
    } finally {
      mutationBusy = false;
    }
  }
  async function remove(kind, id) {
    if (
      mutationBusy ||
      !window.confirm(L("هل تريد حذف هذا العنصر؟", "Delete this item?"))
    )
      return;
    mutationBusy = true;
    try {
      await requireAdmin();
      if (
        kind === "categories" &&
        state.products.some((p) => p.category_id === id)
      )
        throw new Error(
          L(
            "انقل منتجات هذا القسم أولًا، أو أخفِ القسم بدل حذفه.",
            "Move the category's products first, or hide the category instead.",
          ),
        );
      if (["products", "categories", "banners"].includes(kind)) {
        const result = await db.from(kind).delete().eq("id", id).select("id");
        if (result.error) throw result.error;
        if (!result.data?.length)
          throw new Error(L("لم يُحذف العنصر.", "The item was not deleted."));
      } else {
        requireSchema();
        await updateConfig((config) => {
          const key = configKey(kind);
          config[key] = (config[key] || []).filter((row) => row.id !== id);
          return config;
        });
      }
      await refreshAll();
      if (state.edited[kind]?.id === id) resetForm(kind);
      status("تم الحذف.", "Item deleted.", "success");
    } catch (error) {
      status("تعذّر الحذف", "Delete failed", "error", error.message);
    } finally {
      mutationBusy = false;
    }
  }
  async function login(event) {
    event.preventDefault();
    const button = event.target.querySelector('[type="submit"]');
    button.disabled = true;
    $("loginMessage").textContent = L("جارٍ تسجيل الدخول…", "Signing in…");
    try {
      if (!db)
        throw new Error(
          L(
            "راجع إعدادات اتصال المتجر.",
            "Check the store connection settings.",
          ),
        );
      const result = await db.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value,
      });
      if (result.error) throw result.error;
      await requireAdmin();
      $("password").value = "";
      showDashboard(true);
      await refreshAll(true);
      $("loginMessage").textContent = "";
    } catch (error) {
      showDashboard(false);
      $("loginMessage").textContent =
        L("تعذّر الدخول: ", "Sign-in failed: ") + error.message;
    } finally {
      button.disabled = false;
    }
  }
  async function logout() {
    const result = await db.auth.signOut();
    if (result.error) {
      status(
        "تعذّر تسجيل الخروج",
        "Sign-out failed",
        "error",
        result.error.message,
      );
      return;
    }
    showDashboard(false);
    $("loginMessage").textContent = "";
  }
  async function copyMigration() {
    try {
      const response = await fetch(
        "supabase/migrations/20261012025306_storefront_v2.sql",
      );
      if (!response.ok) throw new Error("Migration unavailable");
      await navigator.clipboard.writeText(await response.text());
      status(
        "تم نسخ تحديث قاعدة البيانات.",
        "Database migration copied.",
        "success",
      );
    } catch (error) {
      status(
        "استخدم رابط تحميل ملف التحديث.",
        "Use the migration download link.",
        "info",
      );
    }
  }
  function bind() {
    $("loginForm").addEventListener("submit", login);
    $("logoutButton").addEventListener("click", logout);
    $("adminLanguage").addEventListener("click", () => {
      lang = lang === "ar" ? "en" : "ar";
      try {
        localStorage.setItem("f90-language", lang);
      } catch {}
      translate();
      renderLists();
    });
    $("adminTheme").addEventListener("click", () => {
      const theme =
        document.documentElement.dataset.theme === "dark" ? "cream" : "dark";
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem("f90-theme", theme);
      } catch {}
    });
    $("copyMigration").addEventListener("click", copyMigration);
    $("refreshData").addEventListener("click", () =>
      refreshAll()
        .then(() => status("تم تحميل البيانات.", "Data reloaded.", "success"))
        .catch((error) =>
          status(
            "تعذّر تحميل البيانات",
            "Reload failed",
            "error",
            error.message,
          ),
        ),
    );
    document.addEventListener("submit", submit);
    document.addEventListener("input", (event) => {
      const id = event.target.id;
      if (id.endsWith("Search")) renderList(id.replace(/Search$/, ""));
    });
    document.addEventListener("change", (event) => {
      const input = event.target;
      if (input.id === "products-type") syncQuantityMode();
      if (input.id === "pages-key") fillPage(input.value);
      if (input.type === "file" && input.files[0]) {
        const prefix = input.id.replace(/-file$/, ""),
          preview = $(`${prefix}-preview`);
        if (preview) {
          const old = state.previewUrls.get(prefix);
          if (old) URL.revokeObjectURL(old);
          const url = URL.createObjectURL(input.files[0]);
          state.previewUrls.set(prefix, url);
          preview.src = url;
          preview.hidden = false;
          set(prefix, "remove", false);
        }
      }
    });
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.tab) activateTab(button.dataset.tab);
      if (button.dataset.edit) {
        const kind = button.dataset.edit,
          item = items(kind).find((row) => row.id === button.dataset.id);
        if (item) edit(kind, item);
      }
      if (button.dataset.toggle)
        toggle(button.dataset.toggle, button.dataset.id);
      if (button.dataset.delete)
        remove(button.dataset.delete, button.dataset.id);
      if (button.dataset.reset) resetForm(button.dataset.reset);
      if (button.id === "addField") {
        state.fields = collectFields();
        state.fields.push({
          id: crypto.randomUUID(),
          type: "text",
          required: true,
          enabled: true,
          max_length: 250,
        });
        renderFieldRows();
      }
      if (button.dataset.removeField != null) {
        state.fields = collectFields();
        state.fields.splice(Number(button.dataset.removeField), 1);
        renderFieldRows();
      }
      if (button.id === "addTier") {
        state.tiers = collectTiers();
        state.tiers.push({
          min_quantity: 1000000,
          unit_quantity: 1000000,
          prices: {},
        });
        renderTierRows();
      }
      if (button.dataset.removeTier != null) {
        state.tiers = collectTiers();
        state.tiers.splice(Number(button.dataset.removeTier), 1);
        renderTierRows();
      }
      if (button.id === "addSocial") {
        socialDraft = readRows($("socialLinksEditor"));
        socialDraft.push({
          id: crypto.randomUUID(),
          enabled: true,
          icon: "link",
        });
        renderSocialRows();
      }
      if (button.dataset.removeSocial != null) {
        socialDraft = readRows($("socialLinksEditor"));
        socialDraft.splice(Number(button.dataset.removeSocial), 1);
        renderSocialRows();
      }
    });
    db?.auth.onAuthStateChange?.((event, session) => {
      if (!session && event === "SIGNED_OUT") showDashboard(false);
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) requireAdmin().catch(() => showDashboard(false));
    });
  }
  document.addEventListener("DOMContentLoaded", async () => {
    bind();
    translate();
    if (!db) {
      $("loginMessage").textContent = L(
        "تعذّر تحميل إعدادات الاتصال.",
        "Connection settings could not be loaded.",
      );
      return;
    }
    try {
      const session = await db.auth.getSession();
      if (session.data?.session) {
        await requireAdmin();
        showDashboard(true);
        await refreshAll(true);
      }
    } catch (error) {
      showDashboard(false);
      $("loginMessage").textContent = error.message;
    }
  });
})();
