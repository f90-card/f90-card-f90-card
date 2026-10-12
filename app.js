(() => {
  "use strict";
  const C = window.F90Core;
  const $ = (id) => document.getElementById(id);
  const e = C.escapeHTML;
  const storage = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(`f90-${key}`);
        return value == null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`f90-${key}`, JSON.stringify(value));
      } catch {
        /* Browsing remains available without local storage. */
      }
    },
    plain(key) {
      try {
        return localStorage.getItem(`f90-${key}`);
      } catch {
        return null;
      }
    },
    setPlain(key, value) {
      try {
        localStorage.setItem(`f90-${key}`, value);
      } catch {
        /* Optional preference. */
      }
    },
  };
  const savedFavorites = storage.get("favorites", []);
  const savedRequests = storage.get("requests", []);
  const dismissed = storage.get("dismissed-notifications", []);
  const state = {
    lang: storage.plain("language") === "en" ? "en" : "ar",
    currency: C.currencies.includes(storage.plain("currency"))
      ? storage.plain("currency")
      : "USD",
    settings: C.settings(),
    categories: [],
    products: [],
    banners: [],
    loaded: false,
    search: "",
    categorySearch: "",
    favorites: new Set(
      Array.isArray(savedFavorites)
        ? savedFavorites.filter((x) => typeof x === "string")
        : [],
    ),
    requests: Array.isArray(savedRequests)
      ? savedRequests.filter(
          (r) =>
            r &&
            typeof r.reference === "string" &&
            typeof r.name_ar === "string" &&
            Number.isSafeInteger(r.quantity) &&
            Number.isFinite(r.amount) &&
            r.amount >= 0 &&
            Number.isFinite(Date.parse(r.time)),
        )
      : [],
    dismissed: new Set(Array.isArray(dismissed) ? dismissed : []),
    exposures: new Map(),
    noticeExposures: new Map(),
    slide: 0,
    carouselPaused: false,
    draft: null,
    appliedCoupon: "",
    scheduleSignature: "",
    error: false,
  };
  let slideTimer, clockTimer, toastTimer, drawerFocus;
  const tr = (key) => C.t(key, state.lang);
  const loc = (ar, en) => C.localized(ar, en, state.lang);
  const cfg = () => state.settings.config;
  const name = (item) =>
    loc(item.name, item.commerce?.name_en || item.presentation?.name_en);
  const description = (item) =>
    loc(
      item.description,
      item.commerce?.description_en || item.presentation?.description_en,
    );
  const number = (value) =>
    new Intl.NumberFormat(state.lang === "en" ? "en-US" : "ar").format(value);
  const normalize = (value) =>
    String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f\u064b-\u065f]/g, "")
      .toLowerCase();
  const arr = (key) => (Array.isArray(cfg()[key]) ? cfg()[key] : []);
  const image = (url, alt, className = "", lazy = true) => {
    const safe = C.safeUrl(url);
    return safe
      ? `<img class="${e(className)}" src="${e(safe)}" alt="${e(alt)}" ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`
      : C.icon("game");
  };
  function toast(text) {
    $("toast").textContent = text;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      $("toast").hidden = true;
    }, 3200);
  }
  function supportLink(message = "") {
    try {
      return C.whatsapp(cfg().whatsapp, message);
    } catch {
      return C.whatsapp("970568181910", message);
    }
  }
  function routeHref(type, id = "") {
    return `#/${type}${id ? `/${encodeURIComponent(id)}` : ""}`;
  }
  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    try {
      return {
        type: parts[0] || "home",
        id: decodeURIComponent(parts.slice(1).join("/")),
      };
    } catch {
      return { type: "invalid", id: "" };
    }
  }
  function brand() {
    const customLogo = C.safeUrl(state.settings.logo_url);
    const logo = customLogo || "./f90-logo.png";
    const fit =
      !customLogo || cfg().logo_fit === "cover" ? " brand-image-cover" : "";
    return `${image(logo, state.settings.store_name, "brand-image" + fit, false)}<span class="brand-copy"><strong>${e(loc(state.settings.store_name, cfg().name_en))}</strong><small>${e(cfg().name_en)}</small></span>`;
  }
  function applyLanguage() {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = tr(el.dataset.i18n);
    });
    document.querySelectorAll("[data-placeholder]").forEach((el) => {
      el.placeholder = tr(el.dataset.placeholder);
    });
    document.querySelectorAll("[data-label]").forEach((el) => {
      el.setAttribute("aria-label", tr(el.dataset.label));
      el.title = tr(el.dataset.label);
    });
    $("languageLabel").textContent = state.lang === "ar" ? "EN" : "ع";
    $("categoryNav").setAttribute("aria-label", tr("categories"));
    $("languageSelect").value = state.lang;
    $("currencySelect").value = state.currency;
    document.title = `${loc(state.settings.store_name, cfg().name_en)} | ${tr("categories")}`;
  }
  function setTheme(theme, persist = true) {
    document.documentElement.dataset.theme =
      theme === "cream" ? "cream" : "dark";
    $("themeButton").innerHTML = C.icon(theme === "cream" ? "moon" : "sun");
    $("themeSelect").value = document.documentElement.dataset.theme;
    document.querySelector('meta[name="theme-color"]').content =
      theme === "cream" ? "#dedad3" : "#080a0f";
    if (persist)
      storage.setPlain("theme", document.documentElement.dataset.theme);
  }
  function socials() {
    return arr("social_links")
      .filter((item) => C.active(item))
      .map((link) => {
        const url = C.safeUrl(link.url, ["mailto:", "tel:"]);
        return url
          ? `<a class="icon-button" href="${e(url)}" target="_blank" rel="noopener noreferrer" aria-label="${e(loc(link.name_ar, link.name_en))}" title="${e(loc(link.name_ar, link.name_en))}">${C.icon(link.icon || "link")}</a>`
          : "";
      })
      .join("");
  }
  function renderShell() {
    $("headerBrand").innerHTML = $("drawerBrand").innerHTML = brand();
    $("searchIcon").innerHTML = C.icon("search");
    $("bellIcon").innerHTML = C.icon("bell");
    $("menuButton").innerHTML = C.icon("menu");
    $("drawerClose").innerHTML = C.icon("close");
    const r = route();
    $("categoryNav").innerHTML =
      `<a href="#/" class="${r.type === "home" ? "active" : ""}">${C.icon("home")}${tr("home")}</a>` +
      state.categories
        .map(
          (cat) =>
            `<a href="${routeHref("category", cat.id)}" class="${r.id === cat.id ? "active" : ""}">${e(name(cat))}</a>`,
        )
        .join("");
    const links = [
      ["home", "home"],
      ["requests", "receipt"],
      ["favorites", "heart"],
      ["coupons", "ticket"],
      ["notifications", "bell"],
      ["payments", "wallet"],
      ["contact", "mail"],
    ];
    $("drawerLinks").innerHTML =
      links
        .map(
          ([key, ic]) =>
            `<a href="${key === "home" ? "#/" : routeHref(key)}">${C.icon(ic)}${tr(key)}</a>`,
        )
        .join("") +
      Object.entries(cfg().pages)
        .filter(([, p]) => p.enabled !== false)
        .map(
          ([key, p]) =>
            `<a href="${routeHref("page", key)}">${C.icon("info")}${e(loc(p.title_ar || C.t(key, "ar"), p.title_en || C.t(key, "en")))}</a>`,
        )
        .join("") +
      `<a href="${e(supportLink())}" target="_blank" rel="noopener noreferrer">${C.icon("support")}${tr("support")}</a>`;
    $("drawerSocial").innerHTML = socials();
    const notices = arr("notifications").filter((n) => C.active(n));
    const unseen = notices.filter(
      (n) => !state.dismissed.has(`${n.id}:${n.updated_at || ""}`),
    ).length;
    $("notificationCount").hidden = unseen === 0;
    $("notificationCount").textContent = number(unseen);
    const payments = arr("payment_methods").filter((item) => C.active(item));
    $("siteFooter").innerHTML =
      `<div class="container"><div class="footer-grid">
      <div><a class="brand" href="#/">${brand()}</a><p class="footer-description">${e(loc(cfg().footer_ar, cfg().footer_en))}</p><div class="social-links">${socials()}</div></div>
      <div><h3>${tr("quickLinks")}</h3><div class="footer-links"><a href="#/">${tr("home")}</a><a href="#/favorites">${tr("favorites")}</a><a href="#/contact">${tr("contact")}</a><a href="${e(supportLink())}" target="_blank" rel="noopener noreferrer">${tr("support")}</a></div></div>
      <div><h3>${tr("information")}</h3><div class="footer-links">${Object.entries(
        cfg().pages,
      )
        .filter(([, p]) => p.enabled !== false)
        .map(
          ([key, p]) =>
            `<a href="${routeHref("page", key)}">${e(loc(p.title_ar || C.t(key, "ar"), p.title_en || C.t(key, "en")))}</a>`,
        )
        .join("")}</div></div>
      <div><h3>${tr("payments")}</h3><div class="footer-payment-icons">${payments.map((p) => `<a href="${routeHref("payment", p.id)}" title="${e(loc(p.name_ar, p.name_en))}">${C.safeUrl(p.image_url) ? image(p.image_url, loc(p.name_ar, p.name_en)) : `<span>${e(loc(p.name_ar, p.name_en))}</span>`}</a>`).join("")}</div><a class="text-link" href="#/payments">${tr("paymentDetails")}${C.icon("arrow")}</a></div>
      </div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${e(loc(state.settings.store_name, cfg().name_en))} · ${tr("rights")}</span><span>${tr("privacyLocal")}</span></div></div>`;
    applyLanguage();
  }
  function closeDrawer() {
    if ($("drawer").hidden) return;
    $("drawer").hidden = $("drawerBackdrop").hidden = true;
    $("menuButton").setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
    document
      .querySelectorAll(".site-header,#mainContent,#siteFooter")
      .forEach((el) => {
        el.inert = false;
      });
    drawerFocus?.focus();
  }
  function openDrawer() {
    drawerFocus = document.activeElement;
    $("drawer").hidden = $("drawerBackdrop").hidden = false;
    $("menuButton").setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-open");
    document
      .querySelectorAll(".site-header,#mainContent,#siteFooter")
      .forEach((el) => {
        el.inert = true;
      });
    $("drawerClose").focus();
  }
  async function loadRows(table) {
    const result = [],
      size = 500;
    for (let offset = 0; ; offset += size) {
      let query = window.f90Supabase
        .from(table)
        .select("*")
        .eq("is_active", true);
      query =
        table === "products"
          ? query
              .order("sort_order")
              .order("created_at", { ascending: false })
              .order("id")
          : query.order("sort_order").order("id");
      const { data, error } = await query.range(offset, offset + size - 1);
      if (error) throw error;
      result.push(...(data || []));
      if (!data || data.length < size) return result;
    }
  }
  async function load() {
    state.error = false;
    state.loaded = false;
    $("mainContent").innerHTML =
      `<div class="loading-state" role="status">${tr("loading")}</div>`;
    if (!window.f90Supabase) {
      state.error = true;
      renderError();
      return;
    }
    const results = await Promise.allSettled([
      window.f90Supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle(),
      loadRows("categories"),
      loadRows("products"),
      loadRows("banners"),
    ]);
    const setting = results[0];
    if (
      setting.status === "fulfilled" &&
      !setting.value.error &&
      setting.value.data
    )
      state.settings = C.settings(setting.value.data);
    if (!storage.plain("theme")) setTheme(cfg().default_theme, false);
    let error = false;
    ["categories", "products", "banners"].forEach((key, index) => {
      const result = results[index + 1];
      if (result.status === "fulfilled") state[key] = result.value;
      else {
        console.warn(`F90 ${key}:`, result.reason?.message);
        if (key !== "banners") error = true;
      }
    });
    const activeIds = new Set(state.categories.map((c) => c.id));
    state.products = state.products.filter((p) => activeIds.has(p.category_id));
    state.loaded = true;
    state.error = error;
    if (error) {
      renderShell();
      renderError();
    } else render();
    clearInterval(clockTimer);
    clockTimer = setInterval(checkSchedules, 1000);
  }
  function renderError() {
    renderShell();
    $("mainContent").innerHTML =
      `<div class="empty-state">${C.icon("info")}<p>${tr("connectionError")}</p><button class="button primary" id="retryButton" type="button">${tr("retry")}</button></div>`;
  }
  function empty(key, ic = "grid") {
    return `<div class="empty-state">${C.icon(ic)}${tr(key)}</div>`;
  }
  function heading(title, lead = "", action = "") {
    return `<div class="section-heading"><div><h2>${e(title)}<i class="heading-mark" aria-hidden="true"></i></h2>${lead ? `<p>${e(lead)}</p>` : ""}</div>${action}</div>`;
  }
  function pageHeading(title, lead = "") {
    return `<div class="page-heading"><div><span class="eyebrow">${e(loc(state.settings.store_name, cfg().name_en))}</span><h1>${e(title)}</h1>${lead ? `<p>${e(lead)}</p>` : ""}</div></div>`;
  }
  function breadcrumbs(category, product) {
    return `<nav class="breadcrumbs" aria-label="${e(tr("back"))}"><a href="#/">${tr("home")}</a>${category ? `${C.icon("chevron")}<a href="${routeHref("category", category.id)}">${e(name(category))}</a>` : ""}${product ? `${C.icon("chevron")}<span>${e(name(product))}</span>` : ""}</nav>`;
  }
  function categoryCard(cat) {
    const count = state.products.filter((p) => p.category_id === cat.id).length;
    return `<a class="category-card" href="${routeHref("category", cat.id)}"><div class="category-art">${image(cat.image_url, name(cat))}</div><div class="category-info"><h3>${e(name(cat))}</h3><div class="category-bottom"><span>${number(count)} ${tr("services")}</span>${C.icon("arrow")}</div></div></a>`;
  }
  function matchingCategories() {
    const q = normalize(state.search);
    return state.categories.filter(
      (cat) =>
        !q ||
        normalize(
          `${cat.name} ${cat.presentation?.name_en || ""} ${cat.description || ""} ${cat.presentation?.description_en || ""}`,
        ).includes(q) ||
        state.products.some(
          (p) => p.category_id === cat.id && matchesProduct(p, q),
        ),
    );
  }
  function matchesProduct(product, query) {
    return normalize(
      `${product.name} ${product.commerce?.name_en || ""} ${product.description || ""} ${product.commerce?.description_en || ""}`,
    ).includes(normalize(query));
  }
  function activeBanners() {
    return cfg().show_banners
      ? state.banners.filter((b) => C.active(b) && C.safeUrl(b.image_url))
      : [];
  }
  function bannerMarkup() {
    const banners = activeBanners();
    if (!banners.length) return "";
    state.slide %= banners.length;
    return `<section class="banner-carousel" id="bannerCarousel" aria-label="${e(loc("إعلانات المتجر", "Store banners"))}" aria-roledescription="carousel">${banners
      .map((b, index) => {
        const p = b.presentation || {},
          title = loc(b.title, p.title_en),
          caption = p.show_caption
            ? `<div class="banner-caption"><h2>${e(title)}</h2><p>${e(loc(b.subtitle, p.subtitle_en))}</p></div>`
            : "";
        const img = image(b.image_url, title, "", false) + caption,
          link = C.safeUrl(b.link_url);
        return `<div class="banner-slide ${index === state.slide ? "active" : ""}" data-slide="${index}" aria-hidden="${index !== state.slide}">${link ? `<a href="${e(link)}" target="_blank" rel="noopener noreferrer" ${index !== state.slide ? 'tabindex="-1"' : ""}>${img}</a>` : img}</div>`;
      })
      .join(
        "",
      )}${banners.length > 1 ? `<div class="carousel-controls"><button type="button" class="icon-button" data-carousel="previous" aria-label="${e(tr("previous"))}">${C.icon("chevron")}</button><div class="carousel-dots">${banners.map((_, i) => `<button type="button" data-goto="${i}" class="${i === state.slide ? "active" : ""}" aria-label="${i + 1}" aria-pressed="${i === state.slide}"></button>`).join("")}</div><button class="icon-button" type="button" data-carousel="next" aria-label="${e(tr("next"))}">${C.icon("chevron", "arrow-flip")}</button><button class="icon-button" type="button" data-carousel="pause" aria-label="${e(tr(state.carouselPaused ? "play" : "pause"))}">${state.carouselPaused ? "▷" : "Ⅱ"}</button></div>` : ""}</section>`;
  }
  function exposureActive(record, map, start = true) {
    if (!C.active(record)) return false;
    const key = `${record.id}:${record.updated_at || ""}`;
    if (!map.has(key)) {
      if (!start) return true;
      map.set(key, Date.now());
    }
    const seconds = Number(record.display_seconds || 0);
    return !(seconds > 0 && Date.now() - map.get(key) >= seconds * 1000);
  }
  function promotions(start = false) {
    return arr("promotions").filter((p) =>
      exposureActive(p, state.exposures, start),
    );
  }
  function promoMarkup() {
    const promos = promotions(true);
    if (!promos.length) return "";
    const content = promos
      .map(
        (p) =>
          `<span class="marquee-item">${p.image_url ? image(p.image_url, loc(p.text_ar, p.text_en)) : ""}${e(loc(p.text_ar, p.text_en))}</span>`,
      )
      .join("");
    const seconds = Math.max(
      8,
      Math.min(120, Number(promos[0].animation_seconds) || 25),
    );
    return `<section class="promo-strip" id="promoStrip" style="--marquee-time:${seconds}s" aria-label="${e(tr("notifications"))}"><span class="promo-label">${C.icon("bolt")}</span><div class="marquee-viewport"><div class="marquee-track"><div class="marquee-content">${content}</div><div class="marquee-content" aria-hidden="true">${content}</div></div></div><button type="button" class="icon-button" id="pausePromo" aria-label="${e(tr("pause"))}" aria-pressed="false">Ⅱ</button></section>`;
  }
  function renderHome() {
    const banners = bannerMarkup();
    const intro =
      !banners && cfg().show_intro
        ? `<section class="home-intro">${image(cfg().hero_image, "", "intro-image", false)}<div class="intro-copy"><span class="eyebrow">${e(loc(cfg().tagline_ar, cfg().tagline_en))}</span><h1>${e(loc(cfg().hero_title_ar, cfg().hero_title_en))}</h1><p>${e(loc(cfg().hero_text_ar, cfg().hero_text_en))}</p><a class="button primary" href="#categories">${tr("discover")}${C.icon("arrow", "arrow-flip")}</a></div><span class="intro-serial" aria-hidden="true">F90 / DIGITAL WORLD</span></section>`
        : "";
    const featuredCategories = state.categories.filter(
      (cat) =>
        cat.presentation?.is_featured ||
        state.products.some((p) => p.category_id === cat.id && p.is_featured),
    );
    $("mainContent").innerHTML =
      banners +
      intro +
      promoMarkup() +
      `<section class="section" id="categories">${heading(tr("categories"), tr("categoryLead"))}<div class="category-grid" id="categoryGrid">${matchingCategories().map(categoryCard).join("") || empty("noCategories")}</div></section>` +
      (featuredCategories.length
        ? `<section class="section">${heading(tr("popular"), "", `<a class="text-link" href="#categories">${tr("seeAll")}${C.icon("arrow")}</a>`)}<div class="popular-grid">${featuredCategories.map((cat) => `<a class="popular-card" href="${routeHref("category", cat.id)}"><div class="category-art">${image(cat.image_url, name(cat))}</div><div class="popular-info"><div><h3>${e(name(cat))}</h3><p>${tr("explore")}</p></div>${C.icon("arrow")}</div></a>`).join("")}</div></section>`
        : "");
    startCarousel();
  }
  function startCarousel() {
    clearTimeout(slideTimer);
    const root = $("bannerCarousel"),
      banners = activeBanners();
    if (
      !root ||
      banners.length < 2 ||
      state.carouselPaused ||
      document.hidden ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      root.matches(":hover") ||
      root.contains(document.activeElement)
    )
      return;
    const seconds = Math.max(
      2,
      Number(
        banners[state.slide]?.presentation?.slide_seconds ||
          cfg().banner_seconds,
      ) || 6,
    );
    slideTimer = setTimeout(() => {
      setSlide(state.slide + 1);
    }, seconds * 1000);
  }
  function setSlide(index) {
    const banners = activeBanners();
    if (!banners.length || !$("bannerCarousel")) return;
    state.slide = (index + banners.length) % banners.length;
    document.querySelectorAll(".banner-slide").forEach((el, i) => {
      el.classList.toggle("active", i === state.slide);
      el.setAttribute("aria-hidden", String(i !== state.slide));
      el.querySelector("a")?.setAttribute(
        "tabindex",
        i === state.slide ? "0" : "-1",
      );
    });
    document.querySelectorAll("[data-goto]").forEach((el, i) => {
      el.classList.toggle("active", i === state.slide);
      el.setAttribute("aria-pressed", String(i === state.slide));
    });
    startCarousel();
  }
  function productCard(product) {
    const c = C.commerce(product),
      quantity = c.type === "quantity" ? Number(c.quantity_min) : 1;
    let quote = null;
    try {
      quote = C.quote(product, quantity, state.currency);
    } catch {
      /* Out of stock or invalid legacy metadata. */
    }
    const saved = state.favorites.has(product.id);
    return `<article class="product-card"><button type="button" class="icon-button favorite-button ${saved ? "saved" : ""}" data-favorite="${e(product.id)}" aria-label="${e(tr(saved ? "favoriteRemove" : "favoriteAdd"))}" aria-pressed="${saved}">${C.icon("heart")}</button><a href="${routeHref("product", product.id)}"><div class="product-art">${image(product.image_url, name(product))}</div><div class="product-card-body"><h3>${e(name(product))}</h3><p>${e(description(product))}</p><span class="price-main">${quote ? C.money(quote.amount, state.currency, state.lang) : tr(C.validQuantity(product, quantity) ? "priceMissing" : "unavailable")}</span>${c.type === "quantity" ? `<span class="price-label">${number(quantity)} ${e(loc(c.quantity_label_ar, c.quantity_label_en))}</span>` : ""}<div class="product-card-foot"><span class="text-link">${tr("details")}${C.icon("arrow")}</span>${c.delivery_time ? `<span class="pill">${e(loc(c.delivery_time, c.delivery_time_en))}</span>` : ""}</div></div></a></article>`;
  }
  function categoryProducts(cat) {
    return state.products.filter(
      (p) =>
        p.category_id === cat.id && matchesProduct(p, state.categorySearch),
    );
  }
  function renderCategory(id) {
    const cat = state.categories.find((c) => c.id === id || c.slug === id);
    if (!cat) {
      renderNotFound();
      return;
    }
    const products = categoryProducts(cat);
    $("mainContent").innerHTML =
      breadcrumbs(cat) +
      (C.safeUrl(cat.presentation?.banner_url)
        ? image(
            cat.presentation.banner_url,
            name(cat),
            "category-page-banner",
            false,
          )
        : "") +
      pageHeading(name(cat), description(cat)) +
      `<div class="category-toolbar"><label class="sr-only" for="categorySearch">${tr("categorySearch")}</label><input id="categorySearch" type="search" placeholder="${e(tr("categorySearch"))}" value="${e(state.categorySearch)}"><span class="pill" id="categoryResultCount">${number(products.length)} ${tr("services")}</span></div><div class="product-grid" id="productGrid">${products.map(productCard).join("") || empty("noProducts")}</div>`;
  }
  function fieldMarkup(field, index) {
    const label = loc(field.label_ar, field.label_en),
      placeholder = loc(field.placeholder_ar, field.placeholder_en);
    const id = `requestField${index}`,
      required = field.required ? "required" : "",
      max = Math.max(1, Math.min(1000, Number(field.max_length) || 250));
    let input;
    if (field.type === "textarea")
      input = `<textarea id="${id}" name="field_${index}" placeholder="${e(placeholder)}" maxlength="${max}" ${required}></textarea>`;
    else if (field.type === "select")
      input = `<select id="${id}" name="field_${index}" ${required}><option value="">${tr("choose")}</option>${(Array.isArray(field.options) ? field.options : []).map((o) => `<option value="${e(typeof o === "string" ? o : o.value)}">${e(typeof o === "string" ? o : loc(o.label_ar || o.value, o.label_en))}</option>`).join("")}</select>`;
    else
      input = `<input id="${id}" name="field_${index}" type="${["text", "email", "tel", "number"].includes(field.type) ? field.type : "text"}" placeholder="${e(placeholder)}" maxlength="${max}" ${required} ${field.type === "number" ? 'step="any"' : ""}>`;
    return `<div class="form-field"><label for="${id}">${e(label)} ${field.required ? '<span aria-hidden="true">*</span>' : `<small>(${tr("optional")})</small>`}</label>${input}</div>`;
  }
  function captureDraft() {
    const form = $("requestForm");
    if (!form) return;
    state.draft = { productId: form.dataset.product, values: {} };
    form.querySelectorAll("input,textarea,select").forEach((el) => {
      if (el.name) state.draft.values[el.name] = el.value;
    });
  }
  function restoreDraft(product) {
    if (state.draft?.productId !== product.id) {
      state.appliedCoupon = "";
      return;
    }
    for (const [key, value] of Object.entries(state.draft.values)) {
      const input = $("requestForm").querySelector(`[name="${key}"]`);
      if (input) input.value = value;
    }
  }
  function renderProduct(id) {
    const product = state.products.find((p) => p.id === id || p.slug === id);
    if (!product) {
      renderNotFound();
      return;
    }
    const cat = state.categories.find((c) => c.id === product.category_id),
      c = C.commerce(product),
      b = C.quantityBounds(product),
      quantity = c.type === "quantity" ? b.min : 1;
    const fields = (Array.isArray(c.fields) ? c.fields : []).filter(
      (f) => f.enabled !== false,
    );
    const gallery = [
      ...new Set([
        product.image_url,
        ...(Array.isArray(product.gallery)
          ? product.gallery.filter((u) => typeof u === "string")
          : []),
      ]),
    ].filter((url) => C.safeUrl(url));
    const saved = state.favorites.has(product.id);
    $("mainContent").innerHTML =
      breadcrumbs(cat, product) +
      `<div class="product-detail"><div class="detail-visual"><div class="detail-image" id="detailImage">${image(product.image_url, name(product), "", false)}</div>${gallery.length > 1 ? `<div class="gallery-thumbs">${gallery.map((url, i) => `<button type="button" data-gallery="${e(C.safeUrl(url))}" aria-label="${e(name(product))} ${i + 1}">${image(url, name(product))}</button>`).join("")}</div>` : ""}</div><div class="detail-copy"><span class="eyebrow">${e(cat ? name(cat) : tr("details"))}</span><h1>${e(name(product))}</h1><p class="detail-description">${e(description(product))}</p>${c.delivery_time ? `<div class="delivery-line">${C.icon("bolt")}<span>${tr("delivery")}: ${e(loc(c.delivery_time, c.delivery_time_en))}</span></div>` : ""}<div class="price-set" id="priceSet"></div><button class="button ghost small" type="button" data-favorite="${e(product.id)}" aria-pressed="${saved}">${C.icon("heart")}${tr(saved ? "favoriteRemove" : "favoriteAdd")}</button>
      <form class="order-form" id="requestForm" data-product="${e(product.id)}"><h2>${tr("customerInfo")}</h2>${c.type === "quantity" ? `<div class="form-field"><label for="orderQuantity">${tr("quantity")} (${e(loc(c.quantity_label_ar, c.quantity_label_en))})</label><input class="quantity-input" id="orderQuantity" name="quantity" type="number" inputmode="numeric" min="${b.min}" max="${b.max}" step="${b.step}" value="${quantity}" required><small>${tr("quantityHint")}: ${number(b.min)} — ${number(b.max)}</small></div>` : '<input name="quantity" id="orderQuantity" type="hidden" value="1">'}${fields.map(fieldMarkup).join("")}<div class="form-field"><label for="couponInput">${tr("coupon")} <small>(${tr("optional")})</small></label><div class="coupon-row"><input id="couponInput" name="coupon" type="text" maxlength="40" autocomplete="off"><button type="button" class="button" id="applyCoupon">${tr("apply")}</button></div><p class="coupon-result" id="couponResult" role="status"></p></div><div class="tier-note" id="tierNote" hidden></div><div class="quote-summary" id="quoteSummary" aria-live="polite"></div><p class="order-error" id="orderError" role="alert" hidden></p><button class="button primary buy-button" type="submit" id="buyButton">${tr("buy")}${C.icon("arrow", "arrow-flip")}</button><p class="checkout-note">${tr("checkoutHint")}</p></form></div></div>`;
    restoreDraft(product);
    updateQuote();
  }
  function currentQuote() {
    const form = $("requestForm"),
      product = state.products.find((p) => p.id === form?.dataset.product);
    if (!product) return null;
    const quantity = Number($("orderQuantity").value);
    if (!C.validQuantity(product, quantity))
      return { product, quantity, invalid: true };
    let quote;
    try {
      quote = C.quote(product, quantity, state.currency);
    } catch {
      return { product, quantity, invalid: true };
    }
    const code = state.appliedCoupon;
    const coupon = arr("coupons").find(
      (c) => String(c.code).toUpperCase() === code,
    );
    const discountCents =
      quote && code
        ? C.couponDiscount(coupon, quote.cents, state.currency, product.id)
        : null;
    return {
      product,
      quantity,
      quote,
      coupon: discountCents == null ? null : coupon,
      discountCents: discountCents || 0,
    };
  }
  function updateQuote() {
    const q = currentQuote();
    if (!q) return;
    const c = C.commerce(q.product);
    $("priceSet").innerHTML = C.currencies
      .map((currency) => {
        let value = null;
        try {
          value = C.quote(q.product, q.quantity, currency);
        } catch {
          /* Invalid in-progress input. */
        }
        return `<div class="price-chip ${currency === state.currency ? "selected" : ""} ${!value ? "unpriced" : ""}"><strong>${value ? C.money(value.amount, currency, state.lang) : tr(q.invalid ? "validQuantity" : "priceMissing")}</strong><span>${tr(currency)}</span></div>`;
      })
      .join("");
    const disabled = q.invalid || !q.quote;
    $("buyButton").disabled = disabled;
    $("quoteSummary").innerHTML = disabled
      ? `<p class="order-error">${tr(q.invalid ? "validQuantity" : "priceMissing")}</p>`
      : `<div class="quote-line"><span>${tr("subtotal")}</span><strong>${C.money(q.quote.amount, state.currency, state.lang)}</strong></div>${q.discountCents ? `<div class="quote-line"><span>${tr("discount")}</span><strong>− ${C.money(q.discountCents / 100, state.currency, state.lang)}</strong></div>` : ""}<div class="quote-line total"><span>${tr("total")}</span><strong>${C.money((q.quote.cents - q.discountCents) / 100, state.currency, state.lang)}</strong></div>`;
    $("tierNote").hidden = disabled || c.type !== "quantity";
    if (q.quote && c.type === "quantity")
      $("tierNote").textContent =
        `${tr("unitPrice")} ${number(q.quote.unit)} ${loc(c.quantity_label_ar, c.quantity_label_en)}: ${C.money(Number(q.quote.unit_price), state.currency, state.lang)}`;
    if (state.appliedCoupon)
      $("couponResult").textContent = tr(
        q.coupon ? "couponApplied" : "couponInvalid",
      );
  }
  function applyCoupon() {
    state.appliedCoupon = $("couponInput").value.trim().toUpperCase();
    updateQuote();
    if (!state.appliedCoupon) $("couponResult").textContent = "";
  }
  function submitRequest(event) {
    event.preventDefault();
    const form = $("requestForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const q = currentQuote();
    if (!q || q.invalid || !q.quote) {
      toast(tr("validQuantity"));
      return;
    }
    const c = C.commerce(q.product),
      fields = (Array.isArray(c.fields) ? c.fields : []).filter(
        (f) => f.enabled !== false,
      );
    const invalidField = fields.findIndex(
      (field, index) =>
        field.required && !$("requestField" + index).value.trim(),
    );
    if (invalidField >= 0) {
      $("orderError").hidden = false;
      $("orderError").textContent = tr("required");
      $("requestField" + invalidField).focus();
      return;
    }
    $("orderError").hidden = true;
    const values = fields
      .map((field, index) => ({
        label: loc(field.label_ar, field.label_en),
        value: $("requestField" + index).value.trim(),
      }))
      .filter((f) => f.value);
    const reference = `F90-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const text = C.requestMessage({
      store: loc(state.settings.store_name, cfg().name_en),
      product: q.product,
      quantity: q.quantity,
      currency: state.currency,
      price: q.quote.amount,
      fields: values,
      coupon: q.coupon?.code,
      discount: q.discountCents / 100,
      reference,
      lang: state.lang,
    });
    const url = supportLink(text);
    // Store only non-personal request metadata. Customer IDs, phone numbers and emails never enter storage or a database.
    state.requests.unshift({
      reference,
      product_id: q.product.id,
      name_ar: q.product.name,
      name_en: c.name_en || "",
      quantity: q.quantity,
      currency: state.currency,
      amount: (q.quote.cents - q.discountCents) / 100,
      time: new Date().toISOString(),
    });
    state.requests = state.requests.slice(0, 100);
    storage.set("requests", state.requests);
    window.location.assign(url);
  }
  function renderNotFound() {
    $("mainContent").innerHTML = empty("notFound", "info");
  }
  function renderFavorites() {
    const products = state.products.filter((p) => state.favorites.has(p.id));
    $("mainContent").innerHTML =
      pageHeading(tr("favorites"), tr("favoriteLead")) +
      `<div class="product-grid">${products.map(productCard).join("") || empty("noFavorites", "heart")}</div>`;
  }
  function renderRequests() {
    $("mainContent").innerHTML =
      pageHeading(tr("requests")) +
      `<p class="local-note">${tr("localRequests")}</p>` +
      (state.requests.length
        ? `<div class="request-list">${state.requests
            .map((r) => {
              const text = `${tr("followup")}\n${tr("requestRef")}: ${r.reference}\n${tr("product")}: ${loc(r.name_ar, r.name_en)}`;
              return `<article class="content-card request-card"><div><span class="pill">${tr("opened")}</span><h3>${e(loc(r.name_ar, r.name_en))}</h3><p dir="ltr">${e(r.reference)}</p><p>${number(r.quantity)} · ${C.money(Number(r.amount), C.currencies.includes(r.currency) ? r.currency : "USD", state.lang)} · ${e(new Date(r.time).toLocaleDateString(state.lang === "ar" ? "ar" : "en"))}</p></div><a class="button small" href="${e(supportLink(text))}" target="_blank" rel="noopener noreferrer">${tr("followup")}${C.icon("support")}</a></article>`;
            })
            .join(
              "",
            )}</div><button class="button ghost small" id="clearRequests" type="button" style="margin-top:20px">${tr("clearRequests")}</button>`
        : empty("noRequests", "receipt"));
  }
  function renderCoupons() {
    const coupons = arr("coupons").filter(
      (c) => c.show_public !== false && C.active(c),
    );
    $("mainContent").innerHTML =
      pageHeading(tr("coupons")) +
      `<div class="content-grid">${coupons.map((c) => `<article class="content-card coupon-card"><div class="coupon-code">${e(c.code)}</div><p>${e(loc(c.description_ar, c.description_en))}</p><button class="button small" type="button" data-copy="${e(c.code)}">${tr("copy")}${C.icon("copy")}</button></article>`).join("") || empty("noCoupons", "ticket")}</div>`;
  }
  function renderNotifications() {
    const notices = arr("notifications").filter((n) => C.active(n));
    $("mainContent").innerHTML =
      pageHeading(tr("notifications")) +
      `<div class="content-grid">${notices.map((n) => `<article class="content-card notification-card">${n.image_url ? image(n.image_url, loc(n.title_ar, n.title_en)) : ""}<h3>${e(loc(n.title_ar, n.title_en))}</h3><p class="prose">${e(loc(n.text_ar, n.text_en))}</p></article>`).join("") || empty("noNotifications", "bell")}</div>`;
  }
  function renderPayments(id) {
    const methods = arr("payment_methods").filter((item) => C.active(item));
    if (id) {
      const method = methods.find((m) => m.id === id);
      if (!method) {
        renderNotFound();
        return;
      }
      const details = loc(method.details_ar, method.details_en);
      $("mainContent").innerHTML =
        breadcrumbs() +
        pageHeading(loc(method.name_ar, method.name_en)) +
        `<div class="content-card">${method.image_url ? image(method.image_url, loc(method.name_ar, method.name_en), "payment-image") : ""}<p>${e(loc(method.description_ar, method.description_en))}</p><div class="payment-details">${e(details)}</div><button class="button small" type="button" data-copy="${e(details)}">${tr("copy")}${C.icon("copy")}</button></div>`;
    } else
      $("mainContent").innerHTML =
        pageHeading(tr("payments")) +
        `<div class="content-grid">${methods.map((m) => `<a class="content-card" href="${routeHref("payment", m.id)}">${m.image_url ? image(m.image_url, loc(m.name_ar, m.name_en), "payment-image") : C.icon("wallet")}<h3>${e(loc(m.name_ar, m.name_en))}</h3><p>${e(loc(m.description_ar, m.description_en))}</p><span class="text-link">${tr("paymentDetails")}${C.icon("arrow")}</span></a>`).join("") || empty("noPayments", "wallet")}</div>`;
  }
  function renderContact() {
    const email = C.safeUrl(`mailto:${state.settings.contact_email || ""}`, [
      "mailto:",
    ]);
    $("mainContent").innerHTML =
      pageHeading(tr("contact")) +
      `<div class="content-grid"><article class="content-card">${C.icon("support")}<h3>${tr("support")}</h3><a class="button primary" href="${e(supportLink())}" target="_blank" rel="noopener noreferrer">${tr("contact")}${C.icon("arrow")}</a></article>${state.settings.contact_email && email ? `<article class="content-card">${C.icon("mail")}<h3>${tr("email")}</h3><a href="${e(email)}" dir="ltr">${e(state.settings.contact_email)}</a></article>` : ""}${arr(
        "social_links",
      )
        .filter((item) => C.active(item))
        .map((l) => {
          const url = C.safeUrl(l.url, ["mailto:", "tel:"]);
          return url
            ? `<a class="content-card" href="${e(url)}" target="_blank" rel="noopener noreferrer">${C.icon(l.icon)}<h3>${e(loc(l.name_ar, l.name_en))}</h3>${tr("contact")}</a>`
            : "";
        })
        .join("")}</div>`;
  }
  function renderPage(id) {
    const page = Object.hasOwn(cfg().pages, id) ? cfg().pages[id] : null;
    if (!page || page.enabled === false) {
      renderNotFound();
      return;
    }
    $("mainContent").innerHTML =
      pageHeading(
        loc(page.title_ar || C.t(id, "ar"), page.title_en || C.t(id, "en")),
      ) +
      `<article class="content-card prose">${e(loc(page.ar, page.en) || tr("noContent"))}</article>`;
  }
  function renderPopups() {
    const notices = arr("notifications").filter(
      (n) =>
        C.active(n) &&
        n.popup !== false &&
        !state.dismissed.has(`${n.id}:${n.updated_at || ""}`),
    );
    $("notificationStack").innerHTML = notices
      .filter((n) => exposureActive(n, state.noticeExposures, false))
      .slice(0, 3)
      .filter((n) => exposureActive(n, state.noticeExposures, true))
      .map(
        (n) =>
          `<article class="notification-popup"><button type="button" data-dismiss="${e(`${n.id}:${n.updated_at || ""}`)}" aria-label="${e(tr("close"))}">${C.icon("close")}</button><h3>${e(loc(n.title_ar, n.title_en))}</h3><p>${e(loc(n.text_ar, n.text_en))}</p></article>`,
      )
      .join("");
  }
  function signature() {
    return JSON.stringify([
      activeBanners().map((b) => b.id),
      promotions().map((p) => p.id),
      arr("notifications")
        .filter((item) => C.active(item))
        .map((n) => n.id),
      arr("coupons")
        .filter((item) => C.active(item))
        .map((c) => c.code),
    ]);
  }
  function checkSchedules() {
    if (!state.loaded || state.error) return;
    const current = signature();
    if (current !== state.scheduleSignature) {
      captureDraft();
      render();
    } else renderPopups();
  }
  function render() {
    captureDraft();
    clearTimeout(slideTimer);
    renderShell();
    if (state.error) {
      renderError();
      return;
    }
    if (!state.loaded) return;
    if (cfg().maintenance.enabled) {
      $("mainContent").innerHTML =
        `<section class="maintenance-screen">${C.icon("bolt")}<h1>${tr("maintenance")}</h1><p>${e(loc(cfg().maintenance.text_ar, cfg().maintenance.text_en) || tr("maintenanceText"))}</p><a class="button primary" href="${e(supportLink())}">${tr("support")}${C.icon("support")}</a></section>`;
      $("notificationStack").innerHTML = "";
      return;
    }
    const r = route();
    switch (r.type) {
      case "home":
        renderHome();
        break;
      case "category":
        renderCategory(r.id);
        break;
      case "product":
        renderProduct(r.id);
        break;
      case "favorites":
        renderFavorites();
        break;
      case "requests":
        renderRequests();
        break;
      case "coupons":
        renderCoupons();
        break;
      case "notifications":
        renderNotifications();
        break;
      case "payments":
        renderPayments();
        break;
      case "payment":
        renderPayments(r.id);
        break;
      case "contact":
        renderContact();
        break;
      case "page":
        renderPage(r.id);
        break;
      default:
        renderNotFound();
    }
    renderPopups();
    state.scheduleSignature = signature();
  }
  function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    storage.set("favorites", [...state.favorites]);
    captureDraft();
    render();
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(tr("copied"));
    } catch {
      toast(tr("copyFailed"));
    }
  }
  function bind() {
    $("menuButton").addEventListener("click", openDrawer);
    $("drawerClose").addEventListener("click", closeDrawer);
    $("drawerBackdrop").addEventListener("click", closeDrawer);
    $("themeButton").addEventListener("click", () =>
      setTheme(
        document.documentElement.dataset.theme === "dark" ? "cream" : "dark",
      ),
    );
    $("themeSelect").addEventListener("change", (event) =>
      setTheme(event.target.value),
    );
    function language(lang) {
      captureDraft();
      state.lang = lang === "en" ? "en" : "ar";
      storage.setPlain("language", state.lang);
      render();
    }
    $("languageButton").addEventListener("click", () =>
      language(state.lang === "ar" ? "en" : "ar"),
    );
    $("languageSelect").addEventListener("change", (event) =>
      language(event.target.value),
    );
    $("currencySelect").addEventListener("change", (event) => {
      captureDraft();
      state.currency = C.currencies.includes(event.target.value)
        ? event.target.value
        : "USD";
      storage.setPlain("currency", state.currency);
      render();
    });
    $("globalSearch").addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      if (route().type !== "home") {
        location.hash = "#/";
        return;
      }
      const grid = $("categoryGrid");
      if (grid)
        grid.innerHTML =
          matchingCategories().map(categoryCard).join("") ||
          empty("noCategories");
    });
    document.addEventListener("input", (event) => {
      if (event.target.id === "orderQuantity") updateQuote();
      if (
        event.target.id === "couponInput" &&
        state.appliedCoupon !== event.target.value.trim().toUpperCase()
      ) {
        state.appliedCoupon = "";
        $("couponResult").textContent = "";
        updateQuote();
      }
      if (event.target.id === "categorySearch") {
        state.categorySearch = event.target.value.trim();
        const r = route(),
          cat = state.categories.find((c) => c.id === r.id || c.slug === r.id);
        if (cat) {
          const rows = categoryProducts(cat);
          $("productGrid").innerHTML =
            rows.map(productCard).join("") || empty("noProducts");
          $("categoryResultCount").textContent =
            `${number(rows.length)} ${tr("services")}`;
        }
      }
    });
    document.addEventListener("submit", (event) => {
      if (event.target.id === "requestForm") submitRequest(event);
    });
    document.addEventListener("click", (event) => {
      const el = event.target.closest("button,a");
      if (!el) return;
      if (el.dataset.favorite) {
        event.preventDefault();
        toggleFavorite(el.dataset.favorite);
      }
      if (el.dataset.copy != null) copy(el.dataset.copy);
      if (el.dataset.gallery)
        $("detailImage").innerHTML = image(el.dataset.gallery, "", "", false);
      if (el.id === "applyCoupon") applyCoupon();
      if (el.id === "retryButton") load();
      if (el.id === "pausePromo") {
        const strip = $("promoStrip"),
          paused = strip.classList.toggle("paused");
        el.setAttribute("aria-pressed", String(paused));
        el.setAttribute("aria-label", tr(paused ? "play" : "pause"));
        el.textContent = paused ? "▷" : "Ⅱ";
      }
      if (el.dataset.carousel) {
        if (el.dataset.carousel === "pause") {
          state.carouselPaused = !state.carouselPaused;
          el.setAttribute(
            "aria-label",
            tr(state.carouselPaused ? "play" : "pause"),
          );
          el.textContent = state.carouselPaused ? "▷" : "Ⅱ";
          startCarousel();
        } else
          setSlide(state.slide + (el.dataset.carousel === "next" ? 1 : -1));
      }
      if (el.dataset.goto != null) setSlide(Number(el.dataset.goto));
      if (el.dataset.dismiss) {
        state.dismissed.add(el.dataset.dismiss);
        storage.set(
          "dismissed-notifications",
          [...state.dismissed].slice(-300),
        );
        renderShell();
        renderPopups();
      }
      if (el.id === "clearRequests") {
        state.requests = [];
        storage.set("requests", []);
        renderRequests();
      }
      if (el.closest("#drawerLinks")) closeDrawer();
      if (el.getAttribute("href") === "#categories") {
        event.preventDefault();
        if (route().type !== "home") {
          location.hash = "#/";
          setTimeout(
            () => $("categories")?.scrollIntoView({ behavior: "smooth" }),
            0,
          );
        } else $("categories")?.scrollIntoView({ behavior: "smooth" });
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDrawer();
      if (!$("drawer").hidden && event.key === "Tab") {
        const focusable = [
            ...$("drawer").querySelectorAll("a[href],button,select,input"),
          ].filter((el) => !el.disabled && !el.hidden),
          first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    });
    document.addEventListener("pointerover", (event) => {
      if (event.target.closest("#bannerCarousel")) clearTimeout(slideTimer);
    });
    document.addEventListener("pointerout", (event) => {
      if (
        event.target.closest("#bannerCarousel") &&
        !$("bannerCarousel")?.contains(event.relatedTarget)
      )
        startCarousel();
    });
    document.addEventListener("focusin", (event) => {
      if (event.target.closest("#bannerCarousel")) clearTimeout(slideTimer);
    });
    document.addEventListener("focusout", (event) => {
      if (event.target.closest("#bannerCarousel")) setTimeout(startCarousel, 0);
    });
    document.addEventListener("visibilitychange", startCarousel);
    window.addEventListener("hashchange", () => {
      captureDraft();
      closeDrawer();
      state.categorySearch = "";
      render();
      window.scrollTo({ top: 0, behavior: "instant" });
      $("mainContent").focus({ preventScroll: true });
    });
    window.addEventListener(
      "scroll",
      () => {
        $("backTop").hidden = window.scrollY < 600;
      },
      { passive: true },
    );
    $("backTop").addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }
  document.addEventListener("DOMContentLoaded", () => {
    bind();
    renderShell();
    setTheme(storage.plain("theme") || "dark", false);
    load();
  });
})();
