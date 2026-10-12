(function (root, factory) {
  "use strict";
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) root.F90Core = core;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const currencies = ["USD", "JOD", "ILS"];
  const words = {
    home: ["الرئيسية", "Home"],
    categories: ["أقسام المتجر", "Store categories"],
    search: ["ابحث عن قسم أو خدمة…", "Search categories or services…"],
    categorySearch: ["ابحث داخل هذا القسم…", "Search this category…"],
    menu: ["القائمة", "Menu"],
    close: ["إغلاق", "Close"],
    theme: ["تغيير الثيم", "Switch theme"],
    dark: ["أسود وأحمر", "Black & red"],
    cream: ["حليبي هادئ", "Soft cream"],
    language: ["اللغة", "Language"],
    currency: ["العملة", "Currency"],
    USD: ["دولار أمريكي", "US dollar"],
    JOD: ["دينار أردني", "Jordanian dinar"],
    ILS: ["شيكل", "Shekel"],
    about: ["من نحن", "About us"],
    privacy: ["سياسة الخصوصية", "Privacy policy"],
    terms: ["شروط الاستخدام", "Terms of use"],
    purchase: ["سياسة الشراء", "Purchase policy"],
    usage: ["سياسة الاستخدام", "Usage policy"],
    payments: ["طرق الدفع", "Payment methods"],
    contact: ["تواصل معنا", "Contact us"],
    support: ["الدعم الفني", "Support"],
    favorites: ["المفضلة", "Favorites"],
    requests: ["طلباتي", "My requests"],
    coupons: ["كوبوناتي", "My coupons"],
    notifications: ["إشعارات الموقع", "Notifications"],
    popular: ["أشهر الخدمات", "Popular services"],
    discover: ["اكتشف الخدمات", "Explore services"],
    explore: ["تصفّح القسم", "Explore category"],
    services: ["خدمات", "services"],
    details: ["تفاصيل الخدمة", "Service details"],
    buy: ["شراء الآن", "Buy now"],
    unavailable: ["غير متوفر حاليًا", "Currently unavailable"],
    priceMissing: [
      "السعر غير محدد لهذه العملة",
      "Price unavailable in this currency",
    ],
    delivery: ["وقت الوصول", "Delivery time"],
    quantity: ["الكمية المطلوبة", "Quantity"],
    coins: ["كوينز", "Coins"],
    units: ["وحدات", "Units"],
    quantityHint: ["الكمية المسموحة", "Allowed quantity"],
    unitPrice: ["السعر لكل", "Price per"],
    customerInfo: ["بيانات الطلب", "Request details"],
    total: ["الإجمالي", "Total"],
    subtotal: ["السعر قبل الخصم", "Subtotal"],
    discount: ["الخصم", "Discount"],
    coupon: ["رمز الخصم", "Discount code"],
    apply: ["تطبيق", "Apply"],
    couponInvalid: [
      "رمز الخصم غير صالح لهذا الطلب",
      "This code is not valid for this request",
    ],
    couponApplied: ["تم تطبيق الخصم", "Discount applied"],
    checkoutHint: [
      "سيفتح الطلب برسالة جاهزة في واتساب. اضغط إرسال هناك لإكمال التواصل.",
      "Your request opens as a prepared WhatsApp message. Tap Send there to contact us.",
    ],
    favoriteAdd: ["إضافة إلى المفضلة", "Add to favorites"],
    favoriteRemove: ["إزالة من المفضلة", "Remove favorite"],
    noCategories: [
      "لا توجد أقسام منشورة حاليًا.",
      "No categories are published yet.",
    ],
    noProducts: [
      "لا توجد خدمات مطابقة حاليًا.",
      "No matching services at the moment.",
    ],
    noFavorites: [
      "لم تضف أي خدمة إلى المفضلة بعد.",
      "You have not saved any services yet.",
    ],
    noRequests: [
      "لم تفتح أي طلب عبر واتساب على هذا الجهاز بعد.",
      "You have not opened any WhatsApp requests on this device yet.",
    ],
    noCoupons: [
      "لا توجد كوبونات منشورة حاليًا.",
      "No coupons are currently published.",
    ],
    noNotifications: [
      "لا توجد إشعارات حاليًا.",
      "No notifications at the moment.",
    ],
    noPayments: [
      "تواصل مع الدعم لمعرفة طرق الدفع المتاحة.",
      "Contact support for available payment methods.",
    ],
    localRequests: [
      "هذه قائمة محلية بالطلبات التي فتحت رسائلها على هذا الجهاز. تأكيد الطلب ومتابعة تنفيذه عبر الدعم.",
      "This is a local list of requests whose messages you opened on this device. Confirm and follow up with support.",
    ],
    clearRequests: ["مسح القائمة من هذا الجهاز", "Clear this device's list"],
    followup: ["متابعة عبر الدعم", "Follow up with support"],
    opened: ["فُتحت رسالة الطلب", "Request message opened"],
    copy: ["نسخ", "Copy"],
    copied: ["تم النسخ", "Copied"],
    copyFailed: [
      "تعذّر النسخ؛ حدّد النص وانسخه.",
      "Select the text to copy it.",
    ],
    back: ["رجوع", "Back"],
    all: ["جميع الأقسام", "All categories"],
    loading: ["جارٍ تحميل الخدمات…", "Loading services…"],
    connectionError: [
      "تعذّر تحميل المتجر. حاول مجددًا.",
      "Unable to load the store. Please try again.",
    ],
    retry: ["إعادة المحاولة", "Try again"],
    notFound: ["هذه الصفحة غير متاحة.", "This page is unavailable."],
    noContent: [
      "تواصل معنا للحصول على المزيد من المعلومات.",
      "Contact us for more information.",
    ],
    rights: ["جميع الحقوق محفوظة.", "All rights reserved."],
    quickLinks: ["روابط سريعة", "Quick links"],
    information: ["معلومات المتجر", "Store information"],
    connected: ["ابقَ على تواصل", "Stay connected"],
    top: ["إلى أعلى الصفحة", "Back to top"],
    maintenance: [
      "نجهّز لك تجربة أفضل",
      "We are preparing a better experience",
    ],
    maintenanceText: [
      "المتجر في صيانة مؤقتة. يمكنك التواصل مع الدعم.",
      "The store is temporarily under maintenance. You can contact support.",
    ],
    email: ["البريد الإلكتروني", "Email"],
    optional: ["اختياري", "Optional"],
    paymentDetails: ["تفاصيل الدفع", "Payment details"],
    noImage: ["صورة الخدمة", "Service image"],
    choose: ["اختر…", "Choose…"],
    validQuantity: [
      "أدخل كمية صحيحة ضمن الحدود المسموحة.",
      "Enter a valid quantity within the allowed limits.",
    ],
    required: ["أكمل البيانات المطلوبة.", "Complete the required fields."],
    removed: ["تمت الإزالة", "Removed"],
    seeAll: ["عرض الكل", "View all"],
    previous: ["الإعلان السابق", "Previous banner"],
    next: ["الإعلان التالي", "Next banner"],
    pause: ["إيقاف الحركة", "Pause animation"],
    play: ["تشغيل الحركة", "Resume animation"],
    price: ["السعر", "Price"],
    requestRef: ["مرجع التواصل", "Request reference"],
    product: ["الخدمة", "Service"],
    requestTitle: ["طلب شراء", "Purchase request"],
    date: ["التاريخ", "Date"],
    discountCode: ["كوبون الخصم", "Discount code"],
    priceConfirm: [
      "يرجى تأكيد السعر وطريقة الدفع ووقت التسليم.",
      "Please confirm price, payment method and delivery time.",
    ],
    noAccount: ["تصفّح واختر خدمتك", "Browse and choose your service"],
    categoryLead: ["اختر ما يناسب عالمك", "Choose what fits your world"],
    favoriteLead: ["خدماتك الأقرب إليك", "Your saved services"],
    privacyLocal: [
      "تُحفظ المفضلة وقائمة التواصل على هذا الجهاز فقط.",
      "Favorites and the request list are stored only on this device.",
    ],
    administration: ["لوحة الإدارة", "Administration"],
  };
  const t = (key, lang = "ar") => words[key]?.[lang === "en" ? 1 : 0] || key;
  const localized = (ar, en, lang = "ar") =>
    lang === "en" ? en || ar || "" : ar || en || "";
  const escapeHTML = (value) =>
    String(value ?? "").replace(
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
  function safeUrl(value, extra = []) {
    if (!value || typeof value !== "string") return "";
    try {
      const u = new URL(
        value,
        typeof location === "object" ? location.href : "https://example.com/",
      );
      return ["https:", "http:", ...extra].includes(u.protocol) ? u.href : "";
    } catch {
      return "";
    }
  }
  function phone(value) {
    const digits = String(value || "").replace(/[\s()+-]/g, "");
    if (!/^[1-9]\d{7,14}$/.test(digits))
      throw new Error("Invalid international WhatsApp number");
    return digits;
  }
  const whatsapp = (number, message = "") =>
    `https://wa.me/${phone(number)}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
  function active(record, now = Date.now()) {
    if (record.is_active === false || record.enabled === false) return false;
    const p = record.presentation || record;
    if (p.starts_at) {
      const at = Date.parse(p.starts_at);
      if (!Number.isFinite(at) || at > now) return false;
    }
    if (p.ends_at) {
      const at = Date.parse(p.ends_at);
      if (!Number.isFinite(at) || at <= now) return false;
    }
    return true;
  }
  function defaultConfig() {
    return {
      version: 2,
      name_en: "F90 CARD",
      logo_fit: "cover",
      tagline_ar: "عالمك الرقمي. بأسلوبك.",
      tagline_en: "Your digital world. Your way.",
      hero_title_ar: "كل عالمك الرقمي\nفي مكان واحد",
      hero_title_en: "Your digital world.\nAll in one place.",
      hero_text_ar: "اختر خدمتك، حدّد تفاصيلها، وخلّ الباقي علينا.",
      hero_text_en:
        "Choose your service, set the details, and connect with us.",
      hero_image: "./digital-world.webp",
      show_intro: true,
      show_banners: true,
      default_theme: "dark",
      whatsapp: "970568181910",
      banner_seconds: 6,
      footer_ar:
        "خدمات رقمية تُناسب عالمك. تواصل مباشر وتجربة واضحة من الاختيار حتى الاستلام.",
      footer_en:
        "Digital services for your world. A clear, direct experience from selection to delivery.",
      social_links: [],
      payment_methods: [],
      promotions: [],
      notifications: [],
      coupons: [],
      maintenance: { enabled: false, text_ar: "", text_en: "" },
      pages: {
        about: {
          enabled: true,
          ar: "اف تسعين كارد متجر للخدمات والمنتجات الرقمية. اختر الخدمة المطلوبة واطّلع على تفاصيلها، ثم تواصل معنا مباشرة لإتمام طلبك.",
          en: "F90 CARD is a digital services and products store. Choose a service, review its details, then contact us directly to complete your request.",
        },
        privacy: {
          enabled: true,
          ar: "تُستخدم البيانات التي تدخلها لتجهيز رسالة الطلب والتواصل بشأن الخدمة. تُرسل الرسالة عبر واتساب عندما تضغط إرسال هناك. لا يحفظ المتجر تفاصيل طلبك الشخصية في قاعدة بياناته. تُحفظ المفضلة وقائمة رسائل الطلب محليًا على جهازك، ويمكنك مسح القائمة من صفحة طلباتي.",
          en: "The details you enter prepare your request message and help us communicate about the service. The message is sent through WhatsApp when you tap Send there. The store does not save your personal request details in its database. Favorites and the request-message list are stored locally on your device. You can clear the list from My requests.",
        },
        terms: {
          enabled: true,
          ar: "اطّلع على وصف الخدمة ومتطلباتها قبل الطلب. أدخل بيانات صحيحة تخص الحساب المستهدف. يُستكمل الاتفاق على السعر وطريقة الدفع ووقت التسليم مباشرة مع إدارة المتجر قبل تنفيذ الخدمة.",
          en: "Review the service description and requirements before requesting it. Enter accurate details for the intended account. Price, payment method and delivery time are confirmed directly with store management before fulfillment.",
        },
        purchase: {
          enabled: true,
          ar: "اختر الخدمة وحدّد الكمية وأكمل الخانات المطلوبة. يفتح زر شراء الآن رسالة جاهزة في واتساب؛ أرسلها لتأكيد تفاصيل الطلب مع الإدارة. تُحدَّد طريقة الدفع ووقت التسليم وأي طلب استرداد بالتواصل مع الإدارة وفق حالة الخدمة وطريقة الدفع.",
          en: "Choose a service, set the quantity and complete the required fields. Buy now opens a prepared WhatsApp message; send it to confirm details with management. Payment method, delivery time and any refund request are handled by contacting management according to the service status and payment method.",
        },
        usage: {
          enabled: true,
          ar: "استخدم الخدمات وفق شروط المنصة أو التطبيق المستهدف. تأكد من صحة معرّف الحساب والبريد والمعلومات المطلوبة، وراجع التفاصيل مع الدعم قبل تنفيذ الطلب.",
          en: "Use services in accordance with the target platform's terms. Check account identifiers, email and required information, and review details with support before fulfillment.",
        },
      },
    };
  }
  function settings(row = {}) {
    const d = defaultConfig(),
      c = row.config && typeof row.config === "object" ? row.config : {};
    return {
      ...row,
      store_name: row.store_name || "اف تسعين كارد",
      currency: currencies.includes(row.currency) ? row.currency : "USD",
      config: {
        ...d,
        ...c,
        maintenance: { ...d.maintenance, ...c.maintenance },
        pages: { ...d.pages, ...c.pages },
      },
    };
  }
  function commerce(product) {
    const c =
        product.commerce && typeof product.commerce === "object"
          ? product.commerce
          : {},
      prices = { ...c.prices };
    if (prices[product.currency] == null && product.price != null)
      prices[product.currency] = String(product.price);
    return {
      type: "fixed",
      quantity_min: 1,
      quantity_max: 1000000000,
      quantity_step: 1,
      unit_quantity: 1,
      quantity_label_ar: "كوينز",
      quantity_label_en: "Coins",
      fields: [],
      pricing_tiers: [],
      ...c,
      prices,
    };
  }
  function quantityBounds(product) {
    const c = commerce(product);
    return {
      min: Number(c.quantity_min),
      max:
        product.stock == null
          ? Number(c.quantity_max)
          : Math.min(Number(c.quantity_max), Number(product.stock)),
      step: Number(c.quantity_step),
    };
  }
  function validQuantity(product, quantity) {
    const q = Number(quantity),
      c = commerce(product);
    if (!Number.isSafeInteger(q) || q < 1) return false;
    if (c.type === "fixed")
      return q === 1 && (product.stock == null || Number(product.stock) >= 1);
    const b = quantityBounds(product);
    return q >= b.min && q <= b.max && b.step > 0 && (q - b.min) % b.step === 0;
  }
  function micros(value) {
    const s = String(value ?? "").trim();
    if (!/^\d+(\.\d{1,6})?$/.test(s)) throw new Error("Invalid price");
    const [w, f = ""] = s.split(".");
    return BigInt(w) * 1000000n + BigInt(f.padEnd(6, "0"));
  }
  function quote(product, quantity, currency = "USD") {
    if (!currencies.includes(currency) || !validQuantity(product, quantity))
      throw new Error("Invalid quantity or currency");
    const c = commerce(product);
    let prices = c.prices,
      unit = c.type === "quantity" ? Number(c.unit_quantity) : 1;
    if (c.type === "quantity") {
      const tiers = (Array.isArray(c.pricing_tiers) ? c.pricing_tiers : [])
        .filter((r) => Number(r.min_quantity) <= Number(quantity))
        .sort((a, b) => Number(b.min_quantity) - Number(a.min_quantity));
      if (tiers[0]) {
        prices = tiers[0].prices || {};
        unit = Number(tiers[0].unit_quantity);
      }
    }
    if (prices[currency] == null || prices[currency] === "") return null;
    if (!Number.isSafeInteger(unit) || unit < 1)
      throw new Error("Invalid pricing unit");
    const n = micros(prices[currency]) * BigInt(quantity),
      d = BigInt(unit) * 10000n,
      cents = (n + d / 2n) / d;
    if (cents > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error("Price exceeds supported range");
    return {
      cents: Number(cents),
      amount: Number(cents) / 100,
      currency,
      unit,
      unit_price: String(prices[currency]),
    };
  }
  function couponDiscount(
    coupon,
    amountCents,
    currency,
    productId,
    now = Date.now(),
  ) {
    if (
      !coupon ||
      !active(coupon, now) ||
      (coupon.product_ids?.length && !coupon.product_ids.includes(productId))
    )
      return null;
    if (amountCents < Number(coupon.minimum?.[currency] || 0) * 100)
      return null;
    let d;
    if (coupon.type === "percent") {
      const p = Number(coupon.percent);
      if (!Number.isFinite(p) || p <= 0 || p > 100) return null;
      d = Math.round((amountCents * p) / 100);
    } else {
      if (coupon.prices?.[currency] == null) return null;
      d = Number((micros(coupon.prices[currency]) + 5000n) / 10000n);
      if (d < 0) return null;
    }
    return Math.min(amountCents, d);
  }
  function money(amount, currency, lang = "ar") {
    return new Intl.NumberFormat(lang === "en" ? "en-US" : "ar", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  function requestMessage({
    store,
    product,
    quantity,
    currency,
    price,
    fields = [],
    coupon,
    discount = 0,
    reference,
    lang = "ar",
  }) {
    const c = commerce(product);
    return [
      store,
      t("requestTitle", lang),
      `${t("requestRef", lang)}: ${reference}`,
      `${t("product", lang)}: ${localized(product.name, c.name_en, lang)}`,
      `${t("quantity", lang)}: ${quantity}`,
      `${t("price", lang)}: ${money(price, currency, lang)}`,
      ...fields.map((f) => `${f.label}: ${f.value}`),
      ...(coupon
        ? [
            `${t("discountCode", lang)}: ${coupon}`,
            `${t("discount", lang)}: ${money(discount, currency, lang)}`,
          ]
        : []),
      `${t("total", lang)}: ${money(Math.max(0, price - discount), currency, lang)}`,
      t("priceConfirm", lang),
    ].join("\n");
  }
  const icons = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    arrow: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    chevron: '<path d="m14 6-6 6 6 6"/>',
    moon: '<path d="M20 13a8 8 0 0 1-9-9 8.5 8.5 0 1 0 9 9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    heart:
      '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    home: '<path d="m3 10 9-8 9 8v11h-6v-7H9v7H3Z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    support:
      '<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 11H2v7h4v-7Zm16 0h2v7h-4v-7ZM20 18c0 3-3 3-6 3"/>',
    ticket:
      '<path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z"/><path d="M15 5v3m0 3v2m0 3v3"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 7h6m-6 4h6m-6 4h4"/>',
    shield:
      '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>',
    wallet:
      '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="m4 5 13-3v3m-2 6h7v5h-7Z"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
    game: '<path d="M7 6h10c4 0 6 13 3 14-2 1-4-4-5-4H9c-1 0-3 5-5 4C1 19 3 6 7 6Z"/><path d="M7 9v6m-3-3h6m6-2h.1m2 3h.1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 6 9 7 9-7"/>',
    whatsapp:
      '<path d="M21 11.5a9 9 0 0 1-13.5 7.8L3 21l1.6-4.4A9 9 0 1 1 21 11.5Z"/><path d="M8 7c-2 2 5 9 7 7l1-2-3-1-1 1-2-2 1-1-1-3Z"/>',
    instagram:
      '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    youtube:
      '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/>',
    tiktok: '<path d="M14 3v13a4 4 0 1 1-4-4m4-9c0 4 3 6 6 6"/>',
    facebook:
      '<path d="M15 22V12h4l1-5h-5V5c0-2 2-2 5-2V0h-4c-5 0-6 4-6 7H6v5h4v10"/>',
    link: '<path d="m10 13 4-4m-5 8-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2-2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    check: '<path d="m5 12 4 4L20 5"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
    star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  };
  const icon = (name, cls = "") =>
    `<svg class="icon ${escapeHTML(cls)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.link}</svg>`;
  return {
    currencies,
    t,
    localized,
    escapeHTML,
    safeUrl,
    phone,
    whatsapp,
    active,
    defaultConfig,
    settings,
    commerce,
    quantityBounds,
    validQuantity,
    quote,
    couponDiscount,
    money,
    requestMessage,
    icon,
    micros,
  };
});
