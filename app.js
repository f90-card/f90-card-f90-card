(function () {
  "use strict";
  if(!window.F90Core || !window.F90API?.client?.auth || !window.F90_CONFIG){
    const target=document.getElementById("mainContent");
    if(target){
      target.innerHTML='<section class="panel" style="margin:40px auto;max-width:650px;text-align:center"><h1>تعذّر بدء تشغيل المتجر</h1><p>تعذّر تحميل الاتصال الآمن. تحقق من الإنترنت ثم أعد المحاولة. لم يتم تنفيذ أي طلب أو خصم رصيد.</p><button type="button" id="f90BootReload" class="button">إعادة تحميل المتجر</button></section>';
      target.querySelector("#f90BootReload")?.addEventListener("click",()=>location.reload());
    }
    console.error("F90 startup dependency unavailable");
    return;
  }
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
    walletStale: false,
    currency: "USD",
    route: 0,
    quote: null,
    checkoutKey: null,
    depositKey: null,
    selectedMethod: null,
    offset: 0,
    carousel: 0,
    carouselPaused: false,
    favorites: [],
    savedRecipients: [],
    authMode: "login",
    currencyPreference: false,
  };
  let authUiRefreshTimer,
    authSignOutTimer,
    toastTimer,
    bannerTimer,
    introTimer,
    quoteTimer,
    orderPollTimer,
    orderSecondsTimer,
    maintenanceTimer,
    installPrompt,
    promoTimers = [],
    promoVideoObserver = null,
    quickProductOpener = null;
  try {
    S.currencyPreference = !!localStorage.getItem("f90-currency");
    S.currency = localStorage.getItem("f90-currency") || "USD";
    S.favorites = JSON.parse(localStorage.getItem("f90-favorites") || "[]");
  } catch {}
  const href = (kind, id) => `#/${kind}/${encodeURIComponent(id)}`;
  const image = (src, alt = "", cls = "") => {
    const valid = C.safeUrl(src);
    const fallback = C.safeUrl(S.settings?.config?.card_fallback_image || S.settings?.config?.card_back_image || "./assets/sections/services.png");
    const use = valid && !String(valid).includes("/app-placeholders/") ? valid : fallback;
    const checkout=String(cls).includes("f90-checkout-image");
    return use
      ? `<img src="${e(use)}" alt="${e(alt)}" class="${e(cls)}" width="256" height="256" loading="${checkout?"eager":"lazy"}" fetchpriority="${checkout?"high":"low"}" decoding="async" onerror="this.onerror=null;this.src='${e(fallback)}';">`
      : `<div class="image-placeholder">${I("grid")}<span>${e(alt)}</span></div>`;
  };
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
  function customerOrderStatus(value) {
    const labels={completed:"مكتمل",partial:"مكتمل جزئيًا",failed:"لم يكتمل",refunded:"مسترد"};
    return '<span class="badge status-'+e(value)+'">'+e(labels[value]||"قيد التنفيذ")+'</span>';
  }
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
    v = ["dark", "cream"].includes(v) ? v : "dark";
    document.documentElement.dataset.theme = v;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = v === "cream" ? "#ded9d1" : "#090b10";
    const color = S.settings.primary_color || "#fa2444";
    document.documentElement.style.setProperty(
      "--accent",
      v === "cream" && color === "#fa2444" ? "#a91d3d" : color,
    );
    try {
      localStorage.setItem("f90-theme", v);
    } catch {}
    window.F90ThemeBackground?.setTheme(v);
    const toggle=$("themeToggle");
    if(toggle){toggle.setAttribute("aria-pressed",String(v==="cream"));toggle.querySelector(".f90-theme-toggle-icon").textContent=v==="cream"?"☀":"☾";toggle.querySelector(".f90-theme-toggle-label").textContent=v==="cream"?"تفعيل الثيم الداكن":"تفعيل الثيم الفاتح";}
  }
  function brand() {
    const c = S.settings.config || {};
    window.F90ThemeBackground?.sync(c,S.settings.logo_url);
    window.F90MediaPlayer?.sync(c);
    document.documentElement.style.setProperty("--f90-edge-color", /^#[0-9a-fA-F]{6}$/.test(c.edge_glow_color || "") ? c.edge_glow_color : "#ff2444");
    document.documentElement.style.setProperty("--f90-edge-duration", `${Math.max(4, Math.min(60, Number(c.edge_glow_speed) || 14))}s`);
    document.documentElement.style.setProperty("--f90-reveal-duration", `${Math.max(0.2, Math.min(3, Number(c.card_flip_speed) || 0.8))}s`);
    document.documentElement.classList.toggle("f90-edge-on", c.edge_glow_enabled !== false);
    document.documentElement.classList.toggle("f90-flip-on", c.card_flip_enabled !== false);
    const
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
    // Decorative copies of the configured official logo only; never a substitute brand.
    let logoSky = document.getElementById("f90LogoSky");
    if (!logoSky) {
      logoSky = document.createElement("div");
      logoSky.id = "f90LogoSky";
      logoSky.setAttribute("aria-hidden", "true");
      document.body.prepend(logoSky);
    }
    const officialLogo = C.safeUrl(S.settings.logo_url);
    if (officialLogo && logoSky.dataset.logo !== officialLogo) {
      logoSky.dataset.logo = officialLogo;
      logoSky.replaceChildren();
      for (let n = 0; n < 6; n++) {
        const ghost = document.createElement("img");
        ghost.src = officialLogo;
        ghost.alt = "";
        ghost.decoding = "async";
        ghost.loading = "lazy";
        ghost.style.setProperty("--x", ((n * 37 + Math.floor(n / 6) * 11 + 13) % 92 + 4) + "%");
        ghost.style.setProperty("--y", ((n * 23 + Math.floor(n / 5) * 17 + 19) % 90 + 5) + "%");
        ghost.style.setProperty("--s", (36 + n % 5 * 15) + "px");
        ghost.style.setProperty("--delay", (-n * 5.6) + "s");
        ghost.style.setProperty("--drift", ((n % 2 ? -1 : 1) * (14 + n % 5 * 9)) + "px");
        logoSky.append(ghost);
      }
    } else if (!officialLogo) {
      logoSky.replaceChildren();
      delete logoSky.dataset.logo;
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
    const storeSearchName = String(S.settings.store_name || "أف تسعين كارد").trim() || "أف تسعين كارد";
    document.title = /شحن الألعاب والتطبيقات والبطاقات الرقمية/.test(storeSearchName)
      ? storeSearchName
      : storeSearchName + " | شحن الألعاب والتطبيقات والبطاقات الرقمية";
    const manifestLink=document.querySelector('link[rel="manifest"]');
    if(manifestLink && location.hostname.endsWith("github.io")){
      const dynamicIcons=c.app_icon_192_url&&c.app_icon_512_url;
      const rev=encodeURIComponent(String(c.app_icon_512_url||"").split("/").pop());
      const dynamic=window.F90_CONFIG.SUPABASE_URL+"/functions/v1/f90-install-manifest?app=store&rev="+rev;
      const desired=dynamicIcons?dynamic:new URL("./manifest.webmanifest",location.href).href;
      if(dynamicIcons)manifestLink.setAttribute("crossorigin","anonymous");
      if(manifestLink.href!==desired)manifestLink.href=desired;
    }else if(manifestLink && (location.hostname.endsWith(".vercel.app") || c.vercel_manifest)){
      const desired=new URL("./api/manifest",location.href).href;
      if(manifestLink.href!==desired)manifestLink.href=desired;
    }
  }
  function avatar(p, size = "") {
    return `<span class="avatar ${size}">${p?.avatar_url ? image(p.avatar_url, p.display_name) : I("user")}</span>`;
  }
  function verified(p) {
    return p?.is_verified
      ? `<span class="badge verified f90-verified-mark" title="حساب موثّق" aria-label="حساب موثّق">${I("check")}<span>موثّق</span></span>`
      : `<span class="badge">غير موثّق</span>`;
  }
  function f90SocialLinks() {
    const c = S.settings.config || {};
    const items = (Array.isArray(c.social_links) ? c.social_links : []).filter(x => x.enabled !== false && C.safeUrl(x.url));
    const channel = String(c.whatsapp_channel_url || "").trim();
    if (/^https:\/\/whatsapp\.com\/channel\/[a-zA-Z0-9]+\/?(?:\?.*)?$/.test(channel) &&
        !items.some(x => String(x.url).replace(/\/$/, "") === channel.replace(/\/$/, ""))) {
      items.unshift({name_ar:"قناة واتساب الرسمية",url:channel,icon_url:"",enabled:true,f90_channel:true});
    }
    return items.slice(0,24);
  }
  function f90PlatformIcon(item) {
    const label = String(item.name_ar || "").toLowerCase();
    const url = String(item.url || "").toLowerCase();
    const platforms = [
      [/whatsapp|واتساب/, "whatsapp"],
      [/instagram|انستغرام|إنستغرام/, "instagram"],
      [/facebook|فيسبوك/, "facebook"],
      [/tiktok|تيك.?توك/, "tiktok"],
      [/telegram|تيليجرام|تلغرام/, "telegram"],
      [/youtube|يوتيوب/, "youtube"],
      [/snapchat|سناب/, "snapchat"],
      [/twitter|x\\.com|تويتر/, "x"],
      [/discord|ديسكورد/, "discord"]
    ];
    const match = platforms.find(([re]) => re.test(label) || re.test(url));
    return match ? "https://cdn.simpleicons.org/" + match[1] : "";
  }
  function f90SocialCards() {
    return f90SocialLinks().map(x => {
      const name = e(x.name_ar || "تواصل معنا");
      const pic = C.safeUrl(x.icon_url) || f90PlatformIcon(x);
      const symbol = x.f90_channel ? "◉" : "↗";
      return `<a class="f90-social-card" href="${e(C.safeUrl(x.url))}" target="_blank" rel="noopener noreferrer" aria-label="${name}">${pic ? image(pic,name,"f90-social-card-icon") : `<span class="f90-social-fallback" aria-hidden="true">${symbol}</span>`}<span>${name}</span><span class="f90-social-arrow" aria-hidden="true">↗</span></a>`;
    }).join("");
  }
  function displayMoney(usd, fine = false) {
    const rate = S.rates.find(r=>r.currency===S.currency&&r.is_enabled&&Number(r.per_usd)>0);
    const code=rate?.currency||"USD";
    const value=code==="USD"?Number(usd):C.convert(usd,code,S.rates);
    if(!Number.isFinite(value))return "—";
    const symbols={USD:"$",ILS:"₪",JOD:"د.أ",EUR:"€",SAR:"ر.س",AED:"د.إ",EGP:"ج.م",TRY:"₺",GBP:"£"};
    let symbol=symbols[code];
    if(!symbol)try{symbol=new Intl.NumberFormat("en",{style:"currency",currency:code,currencyDisplay:"narrowSymbol"}).formatToParts(0).find(p=>p.type==="currency")?.value||code;}catch{symbol=code;}
    return symbol+" "+new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:fine?6:2}).format(value);
  }
  // Display-only formatting; full precision is retained in the authoritative
  // server quote, wallet checks, idempotency key and order confirmation.
  function f90CheckoutMoney(usd, balance = false){
    const rate=S.rates.find(r=>r.currency===S.currency&&r.is_enabled&&Number(r.per_usd)>0);
    const code=rate?.currency||"USD";
    const value=code==="USD"?Number(usd):C.convert(usd,code,S.rates);
    if(!Number.isFinite(value))return "—";
    const symbols={USD:"$",ILS:"₪",JOD:"د.أ",EUR:"€",SAR:"ر.س",AED:"د.إ",EGP:"ج.م",TRY:"₺",GBP:"£"};
    const symbol=symbols[code]||code;
    const printed=balance?Math.trunc(value):value;
    return symbol+" "+new Intl.NumberFormat("en-US",{
      minimumFractionDigits:0,maximumFractionDigits:balance?0:(Math.abs(value)<1?6:3)
    }).format(printed);
  }
  function f90ShortLimit(value){
    const n=Number(value);
    if(!Number.isFinite(n))return "—";
    const format=x=>new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(x);
    return Math.abs(n)>=1000000?format(n/1000000)+"M":format(n);
  }

  function chrome() {
    brand();
    const me = S.me,
      p = me?.profile,
      c = S.settings.config || {};
    updateStoreBell();
    $("headerWallet").setAttribute("href","#/deposit");
    $("headerWallet").setAttribute("aria-label","إضافة رصيد إلى حسابك");
    $("headerWallet").innerHTML =
      I("wallet") +
      `<span>${me && !me.needs_mfa ? (S.walletStale ? "تحديث الرصيد" : e(displayMoney(me.wallet?.balance_usd || 0))) : "المحفظة"}</span>`;
    // Preserve preference controls (and their event listeners) across drawer rebuilds.
    const preservedPreferences=document.querySelector("#drawer .drawer-preferences");
    if(preservedPreferences && preservedPreferences.parentElement?.id==="drawerProfile")
      $("drawerProfile").insertAdjacentElement("afterend",preservedPreferences);
    $("drawerProfile").innerHTML =
      `<section class="f90-drawer-identity"><a class="drawer-profile" href="${me ? "#/profile" : "#/auth"}">${avatar(p)}<div><strong>${e(p?.display_name || "أهلًا بك في أف تسعين")}</strong><span class="small">${me ? e(C.roles[me.role]) + " · " + e(p.customer_id || "") : "سجّل دخولك وابدأ رحلتك"}</span>${me && !me.needs_mfa ? verified(p) : ""}</div></a>${me ? `<button type="button" class="f90-drawer-session" data-action="logout">${I("logout")} تسجيل الخروج</button>` : `<a class="f90-drawer-session" href="#/auth">${I("user")} تسجيل الدخول</a>`}</section>`;
    $("drawerProfile").insertAdjacentHTML("beforeend", `<a class="f90-drawer-vip-link" href="#/vip">${I("crown")}<span>${me ? `مستواك VIP ${e(me.vip_level || 1)} · عرض المزايا` : "اكتشف مستويات VIP ومزاياها"}</span><span aria-hidden="true">‹</span></a>`);

    const drawerPreferences=document.querySelector("#drawer .drawer-preferences");
    if(drawerPreferences)document.querySelector("#drawerProfile .f90-drawer-wallet-card")?.insertAdjacentElement("afterend",drawerPreferences);
    const links = [
      ["@store", "المتجر"],
      ["/", "الرئيسية", "grid"],
      ["search", "ابحث عن خدمة", "search"],
      ["welcome", "التعرّف على F90", "doc"],
      ["agents", "وكلاؤنا", "user"],
      ["quran", "القرآن الكريم", "book"],
      ["favorites", "المفضلة", "heart"],
      ["@account", "حسابي ومعاملاتي"],
      ["profile", "حسابي", "user"],
      ["wallet", "محفظتي", "wallet"],
      ["deposit", "إضافة رصيد", "plus"],
      ["orders", "سجل حركات الخدمات", "clock"],
      ["history", "سجل الحركات", "doc"],
      ["@membership", "المزايا والأمان"],
      ["vip", "مستويات التميّز", "crown"],
      ["security", "أمان الحساب", "shield"],
      ["verification", "توثيق الهوية", "check"],
      ["notifications", "الإشعارات", "bell"],
      ["@help", "المزيد"],
      ["install", "تثبيت التطبيق", "plus"],
      ...(me?.role === "trader" ? [["developers", "إنشاء مفتاح API", "link"]] : []),
      ...(me?.role === "trader" ? [["api-guide", "دليل المطور وربط المتاجر", "doc"]] : []),
      ["policy/about", "من نحن", "doc"],
      ["support", "الدعم الفني", "support"],
    ];
    // Keep every existing destination; visually collapse secondary groups.
    let drawerGroup = false;
    $("drawerLinks").innerHTML = links.map(([route, label, icon]) => {
      if (route.startsWith("@")) {
        const close = drawerGroup ? "</div></details>" : "";
        drawerGroup = true;
        return close + `<details class="f90-drawer-accordion" ${route === "@store" ? "open" : ""}><summary>${e(label)}</summary><div class="f90-drawer-accordion-links">`;
      }
      return `<a href="${route === "/" ? "#/" : "#/" + route}">${I(icon)}<span>${e(label)}</span></a>`;
    }).join("") + (drawerGroup ? "</div></details>" : "");
    // Standalone final drawer links: accessible without opening accordions.
    const extra=[];
    if(me?.role==='charging_agent')extra.push('<a class="f90-drawer-standalone" href="./trader-commissions.html">'+I("wallet")+'<span>عمولاتي وعملائي</span></a>');
    if(me?.role==='manager')extra.push('<a class="f90-drawer-standalone" href="./trader-commissions.html">'+I("users")+'<span>وكلاء الموقع</span></a>');
    if(me && ['manager','admin','amin_card'].includes(me.role))extra.push('<a class="f90-drawer-standalone f90-amin-admin-link" href="./amin-card.html">'+I("grid")+'<span>'+(me.role==='amin_card'?'لوحة تحكم الامين كارد':'قسم الامين كارد')+'</span></a>');
    $('drawerLinks').insertAdjacentHTML('beforeend',extra.join('')+'<section class="f90-drawer-social" style="margin:14px 8px 24px"><div class="f90-drawer-social-title">تابع قنواتنا الرسمية</div><div class="f90-social-card-grid">'+(f90SocialCards()||'<span class="muted small">روابط التواصل تُضاف من لوحة الإدارة.</span>')+'</div></section>');
    document.getElementById('f90TraderCommissionsLink')?.remove();
    if(me?.role==='trader')$('drawerProfile').insertAdjacentHTML('beforeend','<a id="f90TraderCommissionsLink" class="button secondary" href="./trader-commissions.html">عملائي وعمولاتي</a>');
    const staff = me && ["manager", "admin", "designer", "support", "amin_card"].includes(me.role);
    let adminShortcut = document.getElementById("f90AdminShortcut");
    if (staff && !adminShortcut) {
      adminShortcut = document.createElement("a");
      adminShortcut.id = "f90AdminShortcut";
      adminShortcut.className = "icon-button f90-admin-shortcut";
      adminShortcut.href = "./admin.html";
      adminShortcut.title = adminShortcut.ariaLabel = "لوحة الإدارة";
      adminShortcut.innerHTML = I("chart");
      $("headerWallet").before(adminShortcut);
    } else if (!staff) adminShortcut?.remove();
    const enabled = S.rates.filter((r) => r.is_enabled && r.per_usd);
    if (!enabled.some((r) => r.currency === S.currency)) S.currency = S.settings.currency && enabled.some(r=>r.currency===S.settings.currency) ? S.settings.currency : "USD";
    $("currencySelect").innerHTML = enabled
      .map(
        (r) =>
          `<option value="${e(r.currency)}" ${r.currency === S.currency ? "selected" : ""}>${e(r.name_ar)}</option>`,
      )
      .join("");
    $("categoryNav").innerHTML = "";
    $("mobileDock").innerHTML = [
      ["profile", "حسابي", "user"],
      ["wallet", "المحفظة", "wallet"],
      ["", "الرئيسية", "grid"],
      ["orders", "طلباتي", "clock"],
      ["search", "بحث", "search"],
    ].map(([page, label, icon]) => `<a href="#/${page}" data-dock-page="${page}" aria-label="${label}">${page === "" ? `<img class="f90-home-dock-logo" src="${e(C.safeUrl(S.settings.logo_url || S.settings.config?.app_icon_url || "./f90-logo.png") || "./f90-logo.png")}" alt="" loading="eager">` : I(icon)}<span>${label}</span></a>`).join("");
    $("footer").innerHTML =
      `<div class="container"><div class="footer-grid"><div><img class="f90-footer-logo" src="./assets/icons/icon-192.png" width="54" height="54" alt="شعار F90 Card"><h3>${e(S.settings.store_name || "أف تسعين كارد")}</h3><p>${e(c.footer_ar || "كل عالمك الرقمي في مكان واحد. خدمات تُشترى من محفظتك، وتتابعها من حسابك.")}</p><span class="muted small">فلسطين · رام الله</span></div><div><h3>عالم المتجر</h3><nav><a href="#/">الأقسام</a><a href="#/wallet">محفظتي</a><a href="#/orders">طلباتي</a>${me?.role === "trader" ? '<a href="#/developers">صفحة التاجر</a>' : ""}</nav></div><div><h3>المعلومات</h3><nav><a href="#/agents">وكلاؤنا</a>${Object.entries(
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
        f90SocialLinks()
      )
        .filter((s) => s.enabled && C.safeUrl(s.url))
        .map(
          (s) =>
            `<a href="${e(C.safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${C.safeUrl(s.icon_url) ? image(s.icon_url, s.name_ar || "تواصل معنا", "f90-social-icon") : ""}${e(s.name_ar || "تواصل معنا")}</a>`,
        )
        .join(
          "",
        )}${f90InstallShortcuts(["ios","android","windows"],"footer")}</nav></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${e(S.settings.store_name || "أف تسعين كارد")} · جميع الحقوق محفوظة</span><span>تم تطوير هذا الموقع بواسطة F90</span></div></div>`;
  }
  let previousUnreadCount = null;
  function updateStoreBell() {
    const badge = $("storeBellCount");
    if (!badge) return;
    let seen = "";
    try { seen = localStorage.getItem("f90-news-seen") || ""; } catch {}
    const unread = (S.news || []).filter((n) => n.created_at && n.created_at > seen).length;
    const bell = $("storeBell");
    if (unread > 0 && (previousUnreadCount === null || unread > previousUnreadCount) && bell) {
      bell.classList.remove("f90-bell-new");
      void bell.offsetWidth;
      bell.classList.add("f90-bell-new");
    } else if (!unread) {
      bell?.classList.remove("f90-bell-new");
    }
    previousUnreadCount = unread;
    badge.hidden = !unread;
    badge.textContent = unread > 9 ? "9+" : String(unread);
    $("storeBell")?.setAttribute("aria-label", unread ? `الأخبار والإشعارات · ${unread} جديدة` : "الأخبار والإشعارات");
  }
  function closeBellPanel() {
    const panel=$("f90BellPanel");
    if(panel)panel.hidden=true;
    $("storeBell")?.setAttribute("aria-expanded","false");
  }
  function toggleBellPanel() {
    let panel=$("f90BellPanel");
    if(!panel){
      panel=document.createElement("section");
      panel.id="f90BellPanel";
      panel.className="f90-bell-panel";
      panel.setAttribute("role","dialog");
      panel.setAttribute("aria-label","مركز الإشعارات");
      panel.hidden=true;
      $("storeBell").insertAdjacentElement("afterend",panel);
    }
    if(!panel.hidden){closeBellPanel();return;}
    const announcements=(S.settings.config.notifications||[]).filter(n=>n.enabled&&C.visibleSchedule(n));
    const items=[...(S.news||[]).map(n=>({title:n.title_ar,body:n.body_ar,date:n.created_at,url:n.product_id?href("product",n.product_id):"#/notifications"})),...announcements.map(n=>({title:n.title_ar,body:n.text_ar||n.body_ar,date:n.created_at,url:"#/notifications"}))].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,12);
    panel.innerHTML=`<div class="f90-bell-panel-head"><div><strong>${I("bell")} إشعارات F90 CARD</strong><small>آخر الأخبار والتحديثات</small></div><button type="button" class="icon-button" data-action="close-bell-panel" aria-label="إغلاق الإشعارات">${I("close")}</button></div><div class="f90-bell-panel-list">${items.length?items.map(n=>`<a class="f90-bell-panel-item" href="${e(n.url)}"><span class="f90-bell-panel-item-icon">${I("bell")}</span><span><strong>${e(n.title||"إشعار")}</strong><small>${e(n.body||"")}</small><time>${n.date?e(C.date(n.date)):""}</time></span></a>`).join(""):'<p class="f90-bell-panel-empty">لا توجد إشعارات جديدة حاليًا.</p>'}</div><a class="f90-bell-panel-all" href="#/notifications">عرض جميع الإشعارات ${I("arrow-left")}</a>`;
    panel.hidden=false;
    $("storeBell").setAttribute("aria-expanded","true");
    const newest=(S.news||[]).map(n=>n.created_at).filter(Boolean).sort().pop();
    if(newest){try{localStorage.setItem("f90-news-seen",newest);}catch{}}
    updateStoreBell();
    panel.querySelector("button")?.focus();
  }
  // A network error or an expired access token is not a user sign-out.
  // Keep a single restoration attempt in flight while Supabase refreshes tokens.
  let pendingMeRefresh = null;
  async function refreshMe() {
    if (pendingMeRefresh) return pendingMeRefresh;
    pendingMeRefresh = (async () => {
      let authResult;
      try {
        authResult = await A.client.auth.getSession();
      } catch (err) {
        S.walletStale = true;
        console.warn("F90 session lookup interrupted", err);
        return false;
      }
      // Failed storage/refresh checks must never erase a known account.
      if (authResult.error) {
        S.walletStale = true;
        console.warn("F90 session temporarily unavailable", authResult.error);
        return false;
      }
      if (!authResult.data?.session) {
        S.me = null;
        S.walletStale = false;
        S.savedRecipients = [];
        return false;
      }
      try {
        const me = await A.call("me");
        // Google creates the auth user on callback. Respect a pre-login currency
        // choice only when the Supabase user was actually created by this flow.
        let pendingGoogle = null;
        try { pendingGoogle = JSON.parse(localStorage.getItem("f90-google-currency-pending") || "null"); } catch {}
        if (pendingGoogle) {
          const started = Number(pendingGoogle.started_at);
          const created = Date.parse(authResult.data.session.user?.created_at || "");
          const isNewGoogleAccount = authResult.data.session.user?.app_metadata?.provider === "google" &&
            Number.isFinite(started) && Date.now() - started >= 0 && Date.now() - started < 600000 &&
            Number.isFinite(created) && created >= started - 10000 && created <= Date.now() &&
            ["USD","ILS","JOD"].includes(pendingGoogle.currency);
          try {
            if (isNewGoogleAccount && me?.profile?.account_currency !== pendingGoogle.currency) {
              const result = await A.call("profile.currency", {currency:pendingGoogle.currency});
              if (result?.currency === pendingGoogle.currency) me.profile.account_currency = pendingGoogle.currency;
            }
          } catch (error) {
            console.warn("F90 first Google account currency could not be saved", error);
          } finally {
            try { localStorage.removeItem("f90-google-currency-pending"); } catch {}
          }
        }
        S.me = me;
        const accountCurrency=me?.profile?.account_currency;
        if(["USD","ILS","JOD"].includes(accountCurrency)){
          S.currency=accountCurrency;
          try{localStorage.setItem("f90-currency",accountCurrency);}catch{}
          S.currencyPreference=true;
        }
        S.walletStale = false;
        return true;
      } catch (err) {
        if (err.code === "F90_AUTH" || err.status === 401) {
          // A stale JWT can race with an automatic token refresh. Retry
          // the harmless profile read once, with a freshly issued token.
          // Never call signOut here: only explicit logout/confirmed auth
          // invalidation should end a persisted browser session.
          try {
            const refreshed = await A.client.auth.refreshSession();
            if (!refreshed.error && refreshed.data?.session) {
              const me = await A.call("me");
              S.me = me;
              S.walletStale = false;
              return true;
            }
          } catch (retryError) {
            console.warn("F90 account recheck deferred", retryError);
          }
        } else if (err.code === "F90_FORBIDDEN" || err.status === 403) {
          toast(message(err));
        }
        // A failed server request does not prove the session was revoked.
        // Keep the previous identity for navigation, but block checkout
        // until the authoritative balance can be fetched again.
        S.walletStale = true;
        return false;
      }
    })();
    try {
      return await pendingMeRefresh;
    } finally {
      pendingMeRefresh = null;
    }
  }
  function promotions() {
    promoTimers.forEach(clearTimeout);
    promoTimers = [];
    const rows=(S.settings.config.show_ticker===false?[]:(S.settings.config.promotions||[]).filter(x=>x.enabled&&C.visibleSchedule(x)));
    const el=$("promotionBar");
    el.hidden=!rows.length;
    if(!rows.length){el.replaceChildren();return;}
    const item=p=>'<span class="f90-ticker-item">'+(C.safeUrl(p.image_url)?image(p.image_url,p.text_ar||"إعلان"):"")+
      '<span class="f90-ticker-message">'+e(p.text_ar||"")+'</span></span>';
    const content=rows.map(p=>C.safeUrl(p.link_url)
      ? '<a class="f90-ticker-link" href="'+e(C.safeUrl(p.link_url))+'">'+item(p)+'</a>'
      : item(p)).join("");
    const duration=Math.max(30,Math.min(180,Number(rows[0].animation_seconds)||45));
    el.innerHTML='<div class="f90-ticker-window" dir="ltr"><div class="promotion-track" style="--promo-duration:'+duration+'s">'+
      '<div class="f90-ticker-copy" dir="rtl">'+content+'</div><div class="f90-ticker-copy" dir="rtl" aria-hidden="true">'+content+'</div></div></div>';
  }
  const f90Fallback = () => C.safeUrl(S.settings.config?.card_fallback_image || S.settings.config?.card_back_image || "./assets/sections/services.png");
  const f90RefillArt = (src, name) => image(C.safeUrl(src) || f90Fallback(), name || "قيد التعبئة", "f90-refill-image");
  function f90TileArt(src, name, disabled) {
    // One real thumbnail per product/category; the old two-face animation
    // doubled image downloads and delayed visible catalog icons.
    const front = image(C.safeUrl(src) && !String(src).includes("/app-placeholders/") ? src : f90Fallback(),name);
    return `<span class="f90-flip-inner"><span class="f90-flip-face f90-flip-front">${front}</span></span>`;
  }
  const f90SeenTiles = new Set();
  const f90FlipObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      f90FlipObserver.unobserve(el);
      const id = el.dataset.f90FlipId;
      if (id && !f90SeenTiles.has(id)) {
        f90SeenTiles.add(id);
        el.classList.add("f90-flip-play");
      }
    }
  }, { threshold: 0.15 }) : null;
  // Collect only newly inserted tile nodes. A global query on every subtree
  // mutation was repeatedly walking the entire catalog on mobile devices.
  const f90PendingTiles = new Set();
  let f90TileScheduled = false;
  function f90ObserveTiles(root) {
    if (!(root instanceof Element)) return;
    if (root.matches(".f90-flip-tile:not([data-f90-observed])"))
      f90PendingTiles.add(root);
    root.querySelectorAll(".f90-flip-tile:not([data-f90-observed])")
      .forEach(el => f90PendingTiles.add(el));
    if (f90TileScheduled || !f90PendingTiles.size) return;
    f90TileScheduled = true;
    requestAnimationFrame(() => {
      f90TileScheduled = false;
      for (const el of f90PendingTiles) {
        if (!el.isConnected || el.hasAttribute("data-f90-observed")) continue;
        el.dataset.f90Observed = "1";
        const name = el.getAttribute("href") || el.getAttribute("aria-label") || "";
        el.dataset.f90FlipId = name;
        if (f90FlipObserver) f90FlipObserver.observe(el);
        else if (!f90SeenTiles.has(name)) {
          f90SeenTiles.add(name);
          el.classList.add("f90-flip-play");
        }
      }
      f90PendingTiles.clear();
    });
  }
  const f90CardObserver = new MutationObserver(records => {
    for (const record of records)
      for (const node of record.addedNodes) f90ObserveTiles(node);
  });
  f90CardObserver.observe(main, { childList: true, subtree: true });
  f90ObserveTiles(main);
  // Cache the original availability result only during a page render.
  const f90CategoryAvailability = new Map();
  const f90CategoryById = new Map();
  function categoryIsUnavailable(cat) {
    if (!cat?.id) return true; // Preserve the original orphan-product safety behavior.
    if(cat.presentation?.availability!=="refilling" && ["money-transfer","account-sales","design-services"].includes(cat.slug))return false;
    if(cat.presentation?.availability!=="refilling" && cat.slug?.startsWith("transfer-") && S.categories.some(p=>p.id===cat.parent_id&&p.slug==="money-transfer"))return false;
    if (f90CategoryAvailability.has(cat.id)) return f90CategoryAvailability.get(cat.id);
    const disabled=C.categoryUnavailable(cat,S.categories,S.products);
    f90CategoryAvailability.set(cat.id,disabled);
    return disabled;
  }
  function findCategory(id){
    if(!f90CategoryById.has(id)){
      const cat=S.categories.find(c=>c.id===id);
      if(cat)f90CategoryById.set(id,cat);
    }
    return f90CategoryById.get(id);
  }
  function categoryTile(c) {
    const specialRoutes={"money-transfer":"transfer","account-sales":"account","design-services":"design","complete-website":"website"};
    const specialRoute=specialRoutes[c.slug];
    const categoryLink=specialRoute==="website" ? href("product","f90-full-website-500") : specialRoute && !["account","design","transfer"].includes(specialRoute) ? "#/special/"+specialRoute : href("category",c.slug||c.id);
    const disabled = categoryIsUnavailable(c);
    return `<a class="image-tile f90-category-tile f90-flip-tile ${disabled ? "refilling" : ""}" ${disabled ? 'aria-disabled="true" tabindex="-1" data-refilling="true"' : `href="${categoryLink}"`} data-search="${e(window.F90CatalogSearch?.keys(c.name) || c.name)}" aria-label="${e(c.name)}">${f90TileArt(c.image_url,c.name,disabled)}${disabled ? '<span class="refill-badge">قيد التعبئة</span>' : ""}<span class="tile-caption">${e(c.name)}</span></a>`;
  }
  function productTile(p, pack = false, inline = false) {
    const disabled = C.unavailable(p) || categoryIsUnavailable(findCategory(p.category_id));
    const quick = inline ? ` data-action="quick-product" data-id="${e(p.id)}"` : "";
    if (pack)
      return `<a class="pack ${disabled ? "refilling" : ""}" ${disabled ? 'aria-disabled="true" tabindex="-1" data-refilling="true"' : `href="${href("product", p.slug || p.id)}"${quick}`} data-search="${e(window.F90CatalogSearch?.keys(p.name,p.commerce?.search_aliases || []) || p.name)}"><strong>${e(p.commerce?.pack_label || p.name)}</strong><span>${disabled ? "قيد التعبئة" : e(displayMoney(C.previewPrice(p, p.commerce?.quantity_min || 1), true))}</span></a>`;
    return `<a class="image-tile f90-product-tile f90-flip-tile ${disabled ? "refilling" : ""}" ${disabled ? 'aria-disabled="true" tabindex="-1" data-refilling="true"' : `href="${href("product", p.slug || p.id)}"${quick}`} data-search="${e(window.F90CatalogSearch?.keys(p.name,p.commerce?.search_aliases || []) || p.name)}" aria-label="${e(p.name)}">${f90TileArt(p.image_url,p.name,disabled)}${disabled ? '<span class="refill-badge">قيد التعبئة</span>' : ""}<span class="tile-caption">${e(p.name)}</span></a>`;
  }
  function syncHomePhoneVideo() {
    promoVideoObserver?.disconnect();
    promoVideoObserver=null;
    const videos=main.querySelectorAll(".f90-home-phone-video,.f90-home-laptop-video");
    if(!videos.length || typeof IntersectionObserver!=="function")return;
    promoVideoObserver=new IntersectionObserver(entries=>{
      for(const item of entries){
        const video=item.target;
        if(item.isIntersecting && document.visibilityState==="visible"){
          const source=video.querySelector("source[data-src]");
          if(source && !source.src){source.src=source.dataset.src;video.load();}
          video.play().catch(()=>{});
        }else video.pause();
      }
    },{threshold:0.4});
    videos.forEach(video=>{video.muted=true;video.volume=0;promoVideoObserver.observe(video)});
  }
  function welcome() {
    const c=S.settings.config||{},w=c.welcome||{};
    const methods=(c.payment_methods||[]).filter(m=>m.enabled);
    const available=S.products.filter(p=>p.is_active&&!C.unavailable(p));
    const heroArt=C.safeUrl(w.image_url||c.hero_image||"./assets/sections/hero.png");
    const cards=[["grid","استكشف الأقسام","اختر من الألعاب والتطبيقات والخدمات المتاحة","#/"],["wallet","محفظة واضحة","اعرف رصيدك وتابع الإيداعات والحركات","#/wallet"],["clock","طلباتك خطوة بخطوة","راجع الحالة والتفاصيل من حسابك","#/orders"],["shield","شراء بمعلومات واضحة","تحقق من الخدمة والسعر قبل التأكيد","#/policy/purchase"]];
    main.innerHTML=`<div class="f90-experience" dir="rtl">
      <section class="f90-experience-hero" aria-labelledby="f90-experience-title"><a class="f90-welcome-skip" data-f90-store-entry href="./index.html#/" aria-label="تخطي الترحيب والدخول إلى المتجر">تخطي الترحيب <span aria-hidden="true">←</span></a><div class="f90-welcome-lightmarks" aria-hidden="true"><i>F90</i><i>PLAY</i><i>LIVE</i><i>F90</i><i>CARD</i><i>EXPLORE</i></div>
        <div class="f90-experience-orbit orbit-one" aria-hidden="true"></div><div class="f90-experience-orbit orbit-two" aria-hidden="true"></div>
        <div class="f90-experience-copy"><span class="f90-experience-chip"><span class="f90-live-dot"></span> F90 CARD · أف تسعين كارد</span>
        <p class="f90-experience-pretitle">وجهتك إلى عالم الخدمات الرقمية</p>
        <h1 id="f90-experience-title">${e(w.title_ar || "عالمك الرقمي يبدأ هنا")} <span>F90 CARD.</span></h1>
        <p class="f90-experience-description">${e(w.subtitle_ar||"الألعاب، شحن التطبيقات والخدمات الرقمية في تجربة عربية واحدة. تصفّح، اختر، وتابع كل طلب بوضوح.")}</p>
        <div class="f90-experience-actions"><a class="button f90-welcome-enter" data-f90-store-entry href="./index.html#/">الدخول إلى المتجر ${I("arrow-left")}</a><a class="button secondary f90-welcome-deposit" href="#/deposit">إيداع نقود الآن ${I("wallet")}</a>${f90InstallShortcuts(["ios","android","windows"],"hero")}</div>
        <div class="f90-experience-signals"><span>${I("shield")} حساب موثّق للشراء</span><span>${I("clock")} متابعة الطلبات</span><span>${I("wallet")} محفظة بالدولار</span></div><div class="f90-experience-real-stats" aria-label="مؤشرات فعلية من المتجر"><div><strong>${S.categories.filter(c=>c.is_active&&!c.parent_id).length}</strong><span>قسم رئيسي متاح</span></div><div><strong>${available.length}</strong><span>خدمة متاحة بالكتالوج</span></div><div><strong>${methods.length}</strong><span>طريقة إيداع مفعّلة</span></div></div></div>
        <div class="f90-experience-visual"><div class="f90-experience-halo" aria-hidden="true"></div><div class="f90-experience-emblem"><img src="${e(C.safeUrl(S.settings.logo_url || "./f90-logo.png") || "./f90-logo.png")}" alt="الشعار الرسمي لمتجر أف تسعين كارد" fetchpriority="high" decoding="async"><strong>F90 CARD</strong><span>PLAY · CONNECT · EXPLORE</span></div><div class="f90-experience-float float-a">${I("grid")} ألعاب وتطبيقات</div><div class="f90-experience-float float-b">${I("wallet")} خدمات رقمية</div></div>
        <a class="f90-experience-scroll" href="#f90-experience-discover">اكتشف المزيد ↓</a>
      </section>
      <section class="f90-experience-featured-strip" aria-label="لماذا F90 CARD"><div><span aria-hidden="true">✦</span><strong>واجهة عربية مُخصصة</strong><small>كل الخدمات داخل متجر واحد</small></div><div><span aria-hidden="true">◇</span><strong>المحفظة والطلبات</strong><small>تسعير من الخادم وسجل واضح</small></div><div><span aria-hidden="true">◈</span><strong>التاجر والمبرمج</strong><small>دليل API ومفاتيح بتصريح الإدارة</small></div></section><section class="f90-experience-section" id="f90-experience-discover"><div class="f90-experience-section-heading"><span class="f90-experience-overline">تجربة صُمّمت لك</span><h2>كل ما تحتاجه. <em>في مكان واحد.</em></h2><p>اختصارات واضحة لخدمات فعلية داخل حسابك، بدون خطوات غير ضرورية.</p></div><div class="f90-experience-grid">${cards.map(([ic,t,d,link],i)=>`<a class="f90-experience-card" href="${link}"><span class="f90-experience-card-icon">${I(ic)}</span><span class="f90-experience-card-index">0${i+1}</span><h3>${t}</h3><p>${d}</p><span class="f90-experience-card-arrow">${I("arrow-left")}</span></a>`).join("")}</div></section>
      <section class="f90-experience-section"><div class="f90-experience-section-heading"><span class="f90-experience-overline">مختارات من المتجر</span><h2>اكتشف <em>الخدمات المتاحة.</em></h2><p>الخدمات المعروضة مأخوذة من كتالوج المتجر الفعلي.</p></div><div class="f90-experience-products">${available.slice(0,8).map(p=>`<a class="f90-experience-product" href="${href("product",p.slug||p.id)}">${image(p.image_url,p.name)}</a>`).join("")||'<p class="muted">ستظهر الخدمات عند توفرها.</p>'}</div><div class="f90-experience-centered"><a class="button secondary" href="#/">عرض جميع الأقسام ${I("arrow-left")}</a></div></section>
      <section class="f90-experience-journey"><div class="f90-experience-section-heading"><span class="f90-experience-overline">من البداية إلى المتابعة</span><h2>ثلاث خطوات <em>واضحة.</em></h2></div><div class="f90-experience-steps"><article><b>01</b><h3>أنشئ حسابك</h3><p>سجّل حسابًا ووثّقه قبل الإيداع والشراء.</p></article><article><b>02</b><h3>اختر خدمتك</h3><p>راجع بيانات الطلب والتكلفة قبل التأكيد.</p></article><article><b>03</b><h3>تابع التنفيذ</h3><p>راقب حالة طلبك وحركات رصيدك داخل حسابك.</p></article></div></section>
      <section class="f90-experience-section"><div class="f90-experience-section-heading"><span class="f90-experience-overline">الدفع والمحفظة</span><h2>خيارات الإيداع <em>المفعّلة.</em></h2><p>طرق الدفع أدناه مأخوذة من إعدادات المتجر الحالية.</p></div>${methods.length?`<div class="f90-experience-methods">${methods.map(m=>`<div class="f90-experience-method">${image(m.image_url,m.name_ar)}<strong>${e(m.name_ar)}</strong></div>`).join("")}</div>`:'<p class="muted">لا توجد طرق إيداع مفعّلة حاليًا.</p>'}<p class="muted small">إضافة الرصيد تتم بعد مراجعة التحويل واعتماده من الإدارة.</p></section>
      <section class="f90-experience-section f90-experience-questions"><div class="f90-experience-section-heading"><span class="f90-experience-overline">إجابات سريعة</span><h2>أسئلة <em>شائعة.</em></h2></div><div class="f90-experience-faq"><details><summary>كيف أبدأ باستخدام المتجر؟</summary><p>أنشئ حسابًا ثم وثّقه إذا أردت الإيداع والشراء، واختر الخدمة المناسبة من الأقسام.</p></details><details><summary>كيف أتابع طلباتي؟</summary><p>افتح صفحة طلباتي من القائمة أو من حسابك للاطلاع على حالة التنفيذ.</p></details><details><summary>متى يظهر الرصيد بعد الإيداع؟</summary><p>يظهر الرصيد بعد اعتماد طلب الإيداع من الإدارة. تابع حالته من سجل الإيداعات.</p></details><details><summary>ماذا لو كانت الخدمة قيد التعبئة؟</summary><p>الخدمة غير متاحة للطلب مؤقتًا، ويمكنك الرجوع لاحقًا لمعرفة حالة توفرها.</p></details></div></section>
      <section class="f90-experience-end"><img src="${e(C.safeUrl(S.settings.logo_url || "./f90-logo.png") || "./f90-logo.png")}" alt="" loading="lazy"><div><span class="f90-experience-overline">F90 CARD</span><h2>جاهز تبدأ رحلتك؟</h2><p>اكتشف الأقسام، أو تعرف أكثر على المتجر وخدماته.</p></div><div class="f90-experience-actions"><a class="button" data-f90-store-entry href="./index.html#/">دخول المتجر</a><a class="button secondary" href="#/policy/about">عن F90 CARD</a><a class="button secondary" href="#/api-guide">بوابة المبرمجين</a></div></section>
      <nav class="f90-experience-legal" aria-label="معلومات المتجر"><a href="#/policy/privacy">الخصوصية</a><a href="#/policy/terms">الشروط</a><a href="#/policy/purchase">الشراء والاسترداد</a><a href="#/support">الدعم الفني</a></nav>
    </div>`;
  }
  function musicPage(){
    // Radio controls are exclusively in the floating edge bubble.
    home();return;
    const music=S.settings.config?.music||{},status=window.F90MediaPlayer?.status();
    if(!music.enabled){
      main.innerHTML=pageHead("ميوزك أف تسعين كارد","المشغل متوقف حاليًا من إدارة المتجر.");
      return;
    }
    main.innerHTML=pageHead("ميوزك أف تسعين كارد","تشغيل الوسائط داخل موقع F90 CARD دون مغادرة صفحة المتجر.")+
      '<section class="panel f90-media-info"><h2>مشغّل الوسائط</h2>'+
      '<p>راديو F90 CARD يبث الصوت فقط دون عرض الفيديو. يمكنك تشغيله وإيقافه وضبط مستوى الصوت من الشريط الثابت أسفل المتجر؛ ويكرر المقطع أثناء التنقل بين الصفحات.</p>'+
      '<p>الحالة: '+e(status?.playing?"قيد التشغيل":"بانتظار التشغيل")+'</p><p class="muted small">يستطيع مدير المتجر تغيير المصدر أو إيقافه من مركز الموسيقى والوسائط في لوحة الإدارة.</p></section>';
  }
  // One real category per game and one real top-up product per live app.
  // No fake services, no derived purchase prices, and only a small first batch
  // of images to preserve the storefront's mobile loading performance.
  function home() {
    const c = S.settings.config;
    // Show the existing full introduction once per browser, without changing
    // its markup, settings or artwork. It remains accessible from the drawer.
    let introAlreadyShown = false;
    try { introAlreadyShown = localStorage.getItem("f90-home-intro-viewed-v1") === "1"; } catch {}
    const showHomeIntro = c.show_intro !== false && !introAlreadyShown;
    const slides = [...S.banners,...(window.F90Partners?.mainBanners()||[])].filter((b) => C.visibleSchedule(b.presentation || {})),
      hero =
        c.show_banners !== false && slides.length
          ? slides[S.carousel % slides.length]
          : null;
    const art = hero?.image_url || c.hero_image || "./assets/sections/hero.png";
    const target = hero?.link_url || "#/";
    main.innerHTML = `${c.show_banners === false ? "" : `<section class="home-hero f90-swipe-hero" aria-label="إعلانات المتجر" data-slides="${slides.length}"><div class="f90-hero-link"><img src="${e(C.safeUrl(art))}" alt="${e(hero?.title || "أف تسعين كارد — اكتشف خدماتنا")}" fetchpriority="high" decoding="async" draggable="false"></div><div class="hero-overlay" ${hero?.presentation?.overlay_enabled ? "" : "hidden"}><h2>${e(hero?.title || "")}</h2><p>${e(hero?.subtitle || "")}</p></div>${slides.length > 1 ? `<div class="f90-hero-controls"><span class="f90-hero-dots" aria-label="مؤشر الإعلان الحالي">${slides.map((_,i)=>`<i class="${i===S.carousel%slides.length?"active":""}"></i>`).join("")}</span></div>` : ""}</section>`}
 ${window.F90Special?.home(S.settings) || ''}

 ${window.F90Partners?.aboveIntro() || ''}
 ${c.show_intro===false ? "" : `<section class="f90-welcome-hero f90-home-intro" id="categories" aria-label="تعرّف على أف تسعين كارد"><div class="f90-welcome-copy"><span class="eyebrow">F90 CARD · أف تسعين كارد</span><h2>تعرّف على أف تسعين كارد</h2><p>${e(c.welcome?.subtitle_ar || "خدمات رقمية وشحن الألعاب والتطبيقات والبطاقات في مكان واحد. استعرض الأقسام، وتابع طلباتك ومحفظتك من حسابك.")}</p><div class="actions"><a class="button" href="#/deposit">إيداع نقود الآن</a><a class="button secondary" href="#/policy/about">من نحن</a></div></div>${C.safeUrl(c.welcome?.image_url || c.hero_image || "./assets/sections/hero.png") ? `<img class="f90-intro-carousel-image" src="${e(C.safeUrl(c.welcome?.image_url || c.hero_image || "./assets/sections/hero.png"))}" alt="${e(c.welcome?.image_alt_ar || "أف تسعين كارد")}" loading="lazy" decoding="async">` : ""}</section>`}
 ${c.promo_video?.enabled ? window.F90WelcomeScene.homePhone(c,S.settings.logo_url) : ''}
 <div class="section-head"><h2>أقسام المتجر</h2><span>اختر الخدمة المناسبة لك</span></div>${
   S.categories.some((c) => !c.parent_id)
     ? `<div class="image-grid">${S.categories
         .filter((c) => !c.parent_id)
         .map(categoryTile)
         .join("")}</div>`
     : empty("تُجهّز أقسام المتجر حاليًا")
 }
 ${window.F90Partners?.home() || ""}
 ${f90SocialLinks().length ? `<section class="f90-home-social"><div class="section-head"><h2>تواصل معنا وتابع جديدنا</h2><span>روابط منصات F90 CARD الرسمية</span></div><div class="f90-social-card-grid">${f90SocialCards()}</div></section>` : ""}
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
    // Independent introduction rotator; never changes the main ad carousel.
    clearInterval(introTimer);
    const introImage=main.querySelector('.f90-intro-carousel-image');
    const introSources=[c.welcome?.image_url,c.hero_image,...(Array.isArray(c.intro_banner_images)?c.intro_banner_images:[])]
      .map(v=>C.safeUrl(v)).filter((v,i,all)=>v&&all.indexOf(v)===i);
    if(introImage&&introSources.length>1){
      let introIndex=Math.max(0,introSources.indexOf(introImage.src));
      introTimer=setInterval(()=>{
        if(!introImage.isConnected){clearInterval(introTimer);return;}
        introIndex=(introIndex+1)%introSources.length;
        introImage.style.opacity='0.2';
        setTimeout(()=>{if(introImage.isConnected){introImage.src=introSources[introIndex];introImage.style.opacity='1';}},280);
      },6500);
    }
    // Partner ads share the existing secondary banner carousel; never the main hero.
    const partnerStrip=main.querySelector('.f90-special-ad-strip');
    for(const banner of (window.F90Partners?.secondaryBanners()||[])){
      if(!partnerStrip||!C.safeUrl(banner.image_url))continue;
      const card=document.createElement('div');card.className='f90-special-ad f90-amin-ad';
      const pic=document.createElement('img');pic.src=C.safeUrl(banner.image_url);pic.alt=banner.title||'إعلان الأمين كارد';pic.loading='lazy';
      const safeLink=C.safeUrl(banner.link_url);
      if(safeLink){const a=document.createElement('a');a.href=safeLink;a.target='_blank';a.rel='noopener noreferrer';a.append(pic);card.append(a);}else card.append(pic);
      partnerStrip.append(card);
    }
    // After the first view the exact original introduction is still available
    // in a small expandable section; its image and markup are never removed.
    const introSection = main.querySelector(".f90-home-intro");
    if (introSection && !showHomeIntro) {
      const wrapper = document.createElement("details");
      wrapper.className = "f90-home-intro-fold";
      const summary = document.createElement("summary");
      summary.textContent = "تعرّف على F90 CARD";
      introSection.before(wrapper);
      wrapper.append(summary, introSection);
    }
    if (showHomeIntro) {
      try { localStorage.setItem("f90-home-intro-viewed-v1", "1"); } catch {}
    }
    syncHomePhoneVideo();
    const promoEl=$("promotionBar");
    const heroElForTicker=main.querySelector(".f90-swipe-hero");
    if(promoEl&&heroElForTicker)heroElForTicker.insertAdjacentElement("afterend",promoEl);
    clearInterval(bannerTimer);
    if (slides.length > 1 && c.show_banners!==false) {
      const advance=(direction=1)=>{
        const section=main.querySelector(".f90-swipe-hero");
        if(!section)return;
        S.carousel=(S.carousel+direction+slides.length)%slides.length;
        const current=slides[S.carousel];
        const pic=section.querySelector(".f90-hero-link img");
        const link=section.querySelector(".f90-hero-link");
        const overlay=section.querySelector(".hero-overlay");
        const nextArt=C.safeUrl(current.image_url||c.hero_image||"./assets/sections/hero.png");
        pic.src=nextArt;
        pic.alt=current.title||"إعلان أف تسعين كارد";

        overlay.hidden=!current.presentation?.overlay_enabled;
        overlay.querySelector("h2").textContent=current.title||"";
        overlay.querySelector("p").textContent=current.subtitle||"";
        section.querySelectorAll(".f90-hero-dots i").forEach((dot,i)=>dot.classList.toggle("active",i===S.carousel));
      };
      const heroEl=main.querySelector(".f90-swipe-hero");
      let startX=null;
      heroEl.addEventListener("pointerdown",ev=>{if(ev.pointerType!=="mouse"||ev.button===0)startX=ev.clientX;},{passive:true});
      heroEl.addEventListener("pointerup",ev=>{if(startX===null)return;const dx=ev.clientX-startX;startX=null;if(Math.abs(dx)>45){advance(dx>0?-1:1);heroEl.dataset.swiped="1";setTimeout(()=>delete heroEl.dataset.swiped,400);}}, {passive:true});
      heroEl.querySelector(".f90-hero-link")?.addEventListener("click",ev=>{if(heroEl.dataset.swiped==="1")ev.preventDefault()});
      heroEl.f90Advance=advance;
      // Warm only the next image when idle; never preload all seven at once.
      const warmNextBanner = () => {
        if (navigator.connection?.saveData || document.visibilityState !== "visible") return;
        const next = slides[(S.carousel + 1) % slides.length];
        const src = C.safeUrl(next.image_url || c.hero_image || "./assets/sections/hero.png");
        if (src) { const imageAhead = new Image(); imageAhead.decoding = "async"; imageAhead.src = src; }
      };
      if ("requestIdleCallback" in window) requestIdleCallback(warmNextBanner, {timeout: 2200});
      else setTimeout(warmNextBanner, 1600);
      bannerTimer=setInterval(()=>{
        if(!S.carouselPaused && document.visibilityState === "visible" &&
           !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches &&
           (location.hash==="#/"||!location.hash)) advance();
      },Math.max(3,Number(c.banner_seconds)||6)*1000);
    }
  }
  function category(slug) {
    const c = S.categories.find((x) => x.slug === slug || x.id === slug);
    if (!c) {
      main.innerHTML = empty("القسم غير موجود");
      return;
    }
    if(c.slug?.startsWith("transfer-") &&
      S.categories.some(parent=>parent.id===c.parent_id && parent.slug==="money-transfer")){
      location.hash="#/special/transfer/"+encodeURIComponent(c.slug.slice("transfer-".length));
      return;
    }
    if (categoryIsUnavailable(c)) { main.innerHTML = pageHead(c.name) + `<div class="f90-closed-service">${f90RefillArt(c.image_url,c.name)}<h2>قيد التعبئة</h2><p>هذا القسم غير متاح مؤقتًا.</p><a class="button secondary" href="#/">العودة للرئيسية</a></div>`; return; }
    if (
      c.presentation?.routing === "direct" &&
      c.presentation.direct_product_id
    ) {
      location.hash = href("product", c.presentation.direct_product_id);
      return;
    }
    if(["money-transfer","account-sales","design-services","complete-website"].includes(c.slug) &&
      !S.categories.some(x=>x.parent_id===c.id) && !S.products.some(x=>x.category_id===c.id) &&
      window.F90Special?.category(c.slug,S.settings)) return;
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
    main.innerHTML = `<div class="breadcrumb"><a href="#/">الرئيسية</a>${parents.map((p) => `<span>‹</span><a href="${href("category", p.slug)}">${e(p.name)}</a>`).join("")}<span>‹</span><span>${e(c.name)}</span></div><section class="f90-category-top"><button class="button secondary small" data-action="share" aria-label="نسخ رابط القسم">${I("copy")} نسخ رابط القسم</button></section>${children.length || products.length ? `<label class="field f90-category-search"><input id="categoryFilter" type="search" autocomplete="off" placeholder="بحث في ${e(c.name)}..." aria-label="البحث داخل القسم"></label>` : ""}${children.length || products.length ? `<div class="image-grid">${[...children.map((item) => ({ kind: "category", item })), ...products.map((item) => ({ kind: "product", item }))].sort((a, b) => (a.kind === "category" ? a.item.sort_order || 0 : a.item.sort_order || 0) - (b.kind === "category" ? b.item.sort_order || 0 : b.item.sort_order || 0) || a.item.name.localeCompare(b.item.name, "ar")).map(({kind,item}) => kind === "category" ? categoryTile(item) : productTile(item, false, true)).join("")}</div>` : ""}${!children.length && !products.length ? empty("هذا القسم قيد التعبئة. عُد قريبًا") : ""}${products.length ? '<div id="quickProductBackdrop" class="f90-quick-backdrop" data-action="close-quick-product" hidden></div><section id="quickProductPanel" class="f90-quick-product" role="dialog" aria-modal="true" aria-label="تفاصيل الخدمة" hidden></section>' : ""}`;
    const copySection=main.querySelector(".f90-category-top button");
    if(copySection){copySection.innerHTML=I("copy");copySection.title="نسخ رابط القسم";}
    if ($("categoryFilter")) $("categoryFilter").closest("label")?.insertAdjacentHTML("afterend", '<p id="categoryNoResults" class="muted" hidden>لا توجد نتائج مطابقة داخل هذا القسم.</p>');
  }
  // Portaling the purchase sheet to <body> avoids parent stacking contexts
  // (the footer and mobile dock previously appeared above a clipped checkout).
  let checkoutPortalHome = null;
  let checkoutViewportFrame = 0;
  function updateCheckoutViewport() {
    if (!document.body.classList.contains("f90-checkout-open")) return;
    const view = window.visualViewport;
    const available = view?.height || window.innerHeight;
    const center = (view?.offsetTop || 0) + available / 2;
    document.documentElement.style.setProperty("--f90-checkout-height", Math.max(120,available)+"px");
    document.documentElement.style.setProperty("--f90-checkout-center", center+"px");
    const panel = $("quickProductPanel");
    const active = document.activeElement;
    if (panel && active && panel.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) {
      const box = active.getBoundingClientRect();
      const top = (view?.offsetTop || 0) + 8;
      const bottom = top + available - 12;
      if (box.bottom > bottom) panel.scrollTop += box.bottom - bottom + 10;
      if (box.top < top) panel.scrollTop -= top - box.top + 10;
    }
  }
  function scheduleCheckoutViewport() {
    if (checkoutViewportFrame) return;
    checkoutViewportFrame = requestAnimationFrame(() => {
      checkoutViewportFrame = 0;
      updateCheckoutViewport();
    });
  }
  window.visualViewport?.addEventListener("resize",scheduleCheckoutViewport,{passive:true});
  window.visualViewport?.addEventListener("scroll",scheduleCheckoutViewport,{passive:true});
  window.addEventListener("resize",scheduleCheckoutViewport,{passive:true});
  document.addEventListener("focusin",e=>{
    if (e.target.closest?.("#quickProductPanel")) scheduleCheckoutViewport();
  });
  function closeQuickProduct() {
    const panel = $("quickProductPanel");
    const backdrop = $("quickProductBackdrop");
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    if (backdrop) backdrop.hidden = true;
    panel.replaceChildren();
    document.body.classList.remove("f90-checkout-open");
    if (checkoutPortalHome?.isConnected) {
      if(backdrop)checkoutPortalHome.appendChild(backdrop);
      checkoutPortalHome.appendChild(panel);
    } else {
      backdrop?.remove();
      panel.remove();
    }
    checkoutPortalHome = null;
    document.documentElement.style.removeProperty("--f90-checkout-height");
    document.documentElement.style.removeProperty("--f90-checkout-center");
    S.quote = null;
    S.quoteSeq++;
    if (quickProductOpener?.isConnected) quickProductOpener.focus({preventScroll:true});
    quickProductOpener = null;
  }
  function priceBoard(total) {
    return [S.currency, ...S.rates.filter(r=>r.is_enabled&&r.currency!==S.currency).map(r=>r.currency)].slice(0,4)
      .map((code) => {
        const n = C.convert(total, code, S.rates);
        return `<div class="${code === S.currency ? "usd" : ""}"><small>${S.rates.find(r=>r.currency===code)?.name_ar || C.currencyNames[code] || code}</small><strong>${n === null ? "لم يُحدد الصرف" : e(C.money(n, code))}</strong></div>`;
      })
      .join("");
  }
  async function quoteProduct(p) {
    const f = $("checkoutForm");
    if (!p || !f || f.dataset.product !== String(p.id)) return;
    const qty = Number(f.elements.quantity?.value || 1);
    const seq = ++S.quoteSeq;
    const button = $("buyButton");
    if (button) button.disabled = true;
    f.dataset.pricePending = "1";
    const price = $("f90CheckoutTopTotal");
    if (price) price.setAttribute("aria-busy","true");
    try {
      // Only the authoritative quote from the server unlocks checkout.
      const quote = await A.call("quote", {product_id:p.id, quantity:qty});
      if (!f.isConnected || f !== $("checkoutForm") || seq !== S.quoteSeq ||
          Number(f.elements.quantity?.value || 1) !== qty) return;
      S.quote = quote;
      f.dataset.quotedQuantity = String(qty);
      delete f.dataset.pricePending;
      $("priceBoard")?.removeAttribute("aria-busy");
      if (price) {price.removeAttribute("aria-busy");price.textContent=f90CheckoutMoney(quote.total_usd);}
      $("checkoutTotal").textContent = C.money(
        C.convert(quote.total_usd,S.currency,S.rates),S.currency,true
      );
      if ($("f90CheckoutTopBalance")) $("f90CheckoutTopBalance").textContent = S.me ?
        f90CheckoutMoney(S.me.wallet?.balance_usd,true) : "سجّل الدخول";
      const remainingLabel = $("f90CheckoutTopRemaining");
      if (remainingLabel) {
        const balance = Number(S.me?.wallet?.balance_usd);
        remainingLabel.textContent = !S.me ? "سجّل الدخول"
          : !Number.isFinite(balance) || !Number.isFinite(Number(quote.total_usd)) ? "—"
          : balance < Number(quote.total_usd) ? "رصيد غير كافٍ"
          : f90CheckoutMoney(balance-Number(quote.total_usd),true);
      }
      $("discountHint").textContent = Number(quote.discount_usd)>0
        ? "خصم VIP: " + displayMoney(quote.discount_usd,true) : "";
      $("quoteError").textContent = "";
      if (button) button.disabled = C.unavailable(p);
      const insufficient = S.me && Number(S.me.wallet?.balance_usd) < Number(quote.total_usd);
      $("walletHint").innerHTML = insufficient
        ? '<span class="f90-visa-shortfall">الرصيد غير كافٍ · <a href="#/deposit">إضافة رصيد</a></span>' : "";
    } catch(err) {
      if (!f.isConnected || f !== $("checkoutForm") || seq !== S.quoteSeq) return;
      S.quote = null;
      delete f.dataset.quotedQuantity;
      delete f.dataset.pricePending;
      $("priceBoard")?.removeAttribute("aria-busy");
      if (price) {price.removeAttribute("aria-busy");price.textContent="السعر غير متاح";}
      if ($("f90CheckoutTopRemaining")) $("f90CheckoutTopRemaining").textContent = "—";
      $("checkoutTotal").textContent = "السعر غير متاح";
      $("walletHint").textContent = "";
      $("quoteError").textContent = message(err);
      if (button) button.disabled = true;
    }
  }
  function recipientFieldKind(field) {
    const id = String(field?.id || "").toLowerCase();
    if (/email|e_mail|mail/.test(id) || field?.type === "email") return "email";
    if (/phone|mobile|whatsapp|telephone|tel/.test(id)) return "phone";
    if (/account|player|user|character|uid|(^id$)|_id$/.test(id)) return "account_id";
    return null;
  }
  function product(slug, inline = false) {
    const p = S.products.find((p) => p.slug === slug || p.id === slug);
    if (!p) {
      main.innerHTML = empty("الخدمة غير موجودة");
      return;
    }
    const c = p.commerce || {},
      cat = S.categories.find((x) => x.id === p.category_id),
      quantity = c.type === "quantity",
      disabled = C.unavailable(p) || (cat && categoryIsUnavailable(cat));
    if (disabled) { if (!inline) main.innerHTML = pageHead(p.name) + `<div class="f90-closed-service">${f90RefillArt(p.image_url,p.name)}<h2>قيد التعبئة</h2><p>الخدمة غير متاحة مؤقتًا.</p><a class="button secondary" href="#/">العودة للرئيسية</a></div>`; return; }
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
    const checkoutWords = [cat?.name, cat?.slug, p.name].filter(Boolean).join(" ").toLowerCase();
    const checkoutKind = /تطبيق|لايف|كوينز|coins|live|شات|chat/.test(checkoutWords) ? "apps"
      : /ببجي|جواكر|العاب|ألعاب|game|pubg|free fire|roblox|steam|ludo/.test(checkoutWords) ? "games"
      : /اشتراك|ترفيه|شاهد|نتفلكس|netflix|disney|streaming/.test(checkoutWords) ? "subscriptions"
      : /بطاق|كود|gift|itunes|apple|google play/.test(checkoutWords) ? "cards"
      : /تواصل|انستجرام|فيسبوك|social|تيك توك/.test(checkoutWords) ? "social"
      : /رصيد هاتف|اتصالات|mobile/.test(checkoutWords) ? "mobile" : "services";
    const checkoutQuantityLabel = c.quantity_label_ar || (checkoutKind === "apps" ? "كمية الكوينز" : "الكمية المطلوبة");
    const officialLogo = C.safeUrl(S.settings.logo_url) || "./f90-logo.png";
    const productHtml = `<div class="product-page f90-visa-purchase f90-premium-checkout" data-checkout-kind="${e(checkoutKind)}" dir="rtl">
      <img class="f90-visa-watermark" src="${e(officialLogo)}" alt="" aria-hidden="true" loading="lazy">
      <div class="f90-visa-card-header">
        <img class="f90-visa-logo" src="${e(officialLogo)}" alt="F90 CARD" loading="lazy">
        ${inline ? '<button type="button" class="f90-visa-close" data-action="close-quick-product" aria-label="إغلاق كرت الشراء">×</button>' : '<a href="#/" class="f90-visa-close" aria-label="العودة إلى المتجر">×</a>'}
      </div>
      <div class="f90-visa-product">
        <span class="f90-premium-chip" aria-hidden="true"><svg viewBox="0 0 44 32" fill="none"><rect x="1" y="1" width="42" height="30" rx="6" stroke="currentColor" stroke-width="2"/><path d="M15 1v30M29 1v30M1 11h42M1 21h42M15 11l14 10M29 11 15 21" stroke="currentColor" stroke-width="1.5"/></svg></span>
        <div class="product-art">${image(p.image_url,p.name,"f90-checkout-image")}${Array.isArray(p.gallery)&&p.gallery.length?`<div class="f90-product-gallery" aria-label="صور إضافية للخدمة">${[p.image_url,...p.gallery].filter(C.safeUrl).slice(0,9).map((url,n)=>`<button type="button" class="f90-gallery-thumb" data-action="gallery-switch" data-image="${e(C.safeUrl(url))}" aria-label="عرض الصورة ${n+1}">${image(url,p.name)}</button>`).join("")}</div>`:''}</div>
        <div class="product-info">
          <h1>${e(p.name)}</h1>
          <p class="f90-visa-subtitle">${e(c.fulfillment === "automatic" ? "شحن إلكتروني مباشر" : "خدمة رقمية عبر F90 CARD")}</p>
          <div class="f90-visa-statuses"><span class="f90-visa-status">${I(c.fulfillment === "automatic" ? "link" : "clock")}${c.fulfillment === "automatic" ? "تنفيذ مباشر" : "حسب معالجة الطلب"}</span><span class="f90-visa-available"><span aria-hidden="true">●</span> متاح الآن</span></div>
        </div>
        <button type="button" class="f90-favorite-icon f90-visa-favorite ${S.favorites.includes(p.id) ? "is-saved" : ""}" data-action="favorite" data-id="${e(p.id)}" aria-pressed="${S.favorites.includes(p.id)}" aria-label="${S.favorites.includes(p.id) ? "إزالة من المفضلة" : "حفظ بالمفضلة"}" title="المفضلة">${I("heart")}</button>
      </div>
      <div class="price-board f90-purchase-hidden" id="priceBoard" hidden>${priceBoard(C.previewPrice(p,c.quantity_min||1))}</div>
      <form id="checkoutForm" data-product="${e(p.id)}" class="f90-visa-form">
        ${S.me && fields.some(recipientFieldKind) ? '<label class="field f90-recipient-chooser"><span>اختيار حساب محفوظ</span><select id="savedRecipient" disabled><option>جارٍ التحميل…</option></select></label>' : ""}
        ${fields.map((f)=>'<div class="f90-visa-inputrow"><span class="f90-visa-inputicon" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-2a8 8 0 0 1 16 0v2"></path></svg></span>'+field("customer_"+f.id,e(f.label_ar||f.id),["email","number","textarea","url"].includes(f.type)?f.type:"text","",(f.required?"required ":"")+'maxlength="1000" placeholder="'+e(f.placeholder_ar||"")+'"')+'</div>').join("")}
        <div class="f90-purchase-qty-price">
        ${quantity ? '<div class="f90-visa-inputrow"><span class="f90-visa-inputicon" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v5c0 2 4 3 9 3s9-1 9-3V5M3 10v5c0 2 4 3 9 3s9-1 9-3v-5M3 15v4c0 2 4 3 9 3s9-1 9-3v-4"></path></svg></span>'+field("quantity",e(checkoutQuantityLabel),"number",c.quantity_min||1,'min="'+(Number(c.quantity_min)||1)+'" max="'+(Number(c.quantity_max)||1000000000)+'" step="'+(Number(c.quantity_step)||1)+'" required')+'</div>' : '<input type="hidden" name="quantity" value="1">'}
        ${quantity?'<div class="f90-quantity-limits"><span>الحد الأدنى: <strong>'+f90ShortLimit(c.quantity_min||1)+'</strong></span><span>الحد الأقصى: <strong>'+f90ShortLimit(c.quantity_max||1000000000)+'</strong></span></div>':""}
        <div class="f90-checkout-summary f90-premium-summary" aria-label="ملخص الشراء">
          <div class="f90-visa-price"><span>السعر النهائي</span><strong id="f90CheckoutTopTotal" aria-live="polite" aria-busy="true">جارٍ حساب السعر…</strong></div>
        </div>
        </div>
        <p id="discountHint" class="f90-visa-discount"></p>
        <p class="f90-visa-note"><span class="f90-visa-warn-icon" aria-hidden="true">!</span> تأكد من صحة البيانات قبل الشراء</p>
        <p id="quoteError" class="inline-error" role="status"></p>
        <strong id="checkoutTotal" hidden>—</strong>
        <div class="f90-visa-footer">
          <p id="walletHint" class="f90-visa-wallet-hint" role="status"></p>
          <button class="button full f90-visa-buy" id="buyButton" type="submit" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 2h3l2.2 13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-1.6L23 7H5"></path></svg><span>${S.me ? "شراء الآن" : "سجّل الدخول للشراء"}</span><span class="f90-visa-buy-arrow" aria-hidden="true">‹</span></button>
        </div>
      </form>
    </div>`;
    if (inline) {
      const panel = $("quickProductPanel");
      const backdrop = $("quickProductBackdrop");
      if (!panel || !backdrop) return;
      checkoutPortalHome = panel.parentElement;
      panel.innerHTML = productHtml;
      document.body.append(backdrop,panel);
      document.body.classList.add("f90-checkout-open");
      panel.hidden = false;
      backdrop.hidden = false;
      panel.scrollTop = 0;
      updateCheckoutViewport();
      panel.querySelector('[data-action="close-quick-product"]')?.focus({preventScroll:true});
    } else {
      main.innerHTML = productHtml;
    }
    // Keep the live price alongside quantity in the grid, rather than nesting a second card in the input.
    if (S.me) loadCheckoutRecipients($("checkoutForm"));
    if (!disabled) quoteProduct(p);
    else
      $("quoteError").textContent = "الخدمة قيد التعبئة ولا يمكن شراؤها حاليًا";
  }
  function auth(mode = S.authMode) {
    S.authMode = mode;
    main.innerHTML = `<div class="auth-layout"><div class="auth-art">${image("./assets/sections/services.png", "عالم أف تسعين كارد")}</div><section class="panel auth-panel"><div class="eyebrow">رحلتك تبدأ هنا</div><h1>${mode === "register" ? "أهلًا بعالمك الرقمي" : mode === "forgot" ? "استعادة الحساب" : "أهلًا بعودتك"}</h1><div class="auth-tabs"><button data-action="auth-tab" data-mode="login" class="${mode === "login" ? "active" : ""}">تسجيل الدخول</button><button data-action="auth-tab" data-mode="register" class="${mode === "register" ? "active" : ""}">حساب جديد</button></div><form id="authForm" data-mode="${mode}">${mode !== "forgot" ? select("account_currency", "عملة حسابك (يمكن تغييرها لاحقًا من القائمة)", [["USD","دولار أمريكي ($)"],["ILS","شيكل (₪)"],["JOD","دينار أردني (د.أ)"]], ["USD","ILS","JOD"].includes(S.currency) ? S.currency : "USD") : ""}${mode === "register" ? field("display_name", "اسمك", "text", "", 'required maxlength="100" autocomplete="name"') : ""}${field("email", "البريد الإلكتروني", "email", "", 'required autocomplete="email" dir="ltr"')}${mode !== "forgot" ? field("password", "كلمة المرور", "password", "", 'required minlength="' + (mode === "register" ? "10" : "1") + '" autocomplete="' + (mode === "register" ? "new-password" : "current-password") + '" dir="ltr"') : ""}${
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
    }<p class="inline-error" id="authError"></p><button class="button full" type="submit">${mode === "register" ? "إنشاء حساب" : mode === "forgot" ? "أرسل رابط الاستعادة" : "دخول"}</button></form>${mode !== "forgot" ? `<div class="divider">أو</div><button class="google-button" data-action="google"><span class="f90-google-mark" aria-hidden="true">G</span>المتابعة باستخدام جوجل</button><button class="button ghost small" style="margin-top:16px" data-action="auth-tab" data-mode="forgot">نسيت كلمة المرور؟</button>` : '<p class="muted small" style="margin-top:16px">ستصلك رسالة إذا كان البريد مرتبطًا بحساب.</p>'}</section></div>`;
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
    main.innerHTML = `<section class="profile-cover f90-vip-${Math.max(1, Math.min(15, Number(me.vip_level) || 1))}"><img class="f90-profile-brand-watermark" src="${e(C.safeUrl(S.settings.logo_url || "./f90-logo.png") || "./f90-logo.png")}" alt="" loading="lazy">${avatar(p, "large")}<div><span class="small">كل تفاصيل عالمك، هنا</span><h1>${e(p.display_name)}</h1><div class="badges">${verified(p)}<span class="badge">${e(C.roles[me.role])}</span><span class="badge gold f90-vip-rank">${I("crown")} VIP ${e(me.vip_level)}</span></div><div class="profile-id"><span>معرّف العميل</span><b dir="ltr">${e(p.customer_id)}</b></div><div class="profile-id"><span>عملة الحساب المعتمدة للإيداع والرواتب</span><b dir="ltr">${e(p.account_currency||"USD")}</b></div><div class="f90-profile-links"><a class="button f90-profile-vip-button" href="#/vip">${I("crown")}عرض مستوى VIP ومزاياي</a><a class="button secondary small" href="#/">الرئيسية</a><a class="button secondary small" href="#/wallet">المحفظة</a><a class="button secondary small" href="#/orders">سجل طلباتي</a><a class="button secondary small" href="#/history">سجل الحركات</a><a class="button secondary small" href="#/search">البحث عن خدمة</a><a class="button secondary small" href="#/security">أمان الحساب</a><a class="button secondary small" href="#/install">تثبيت التطبيق</a><a class="button secondary small" href="#/verification">توثيق الحساب</a></div></div></section><div class="profile-grid"><section class="panel"><h2>معلوماتك الشخصية</h2><form id="profileForm">${field("display_name", "الاسم", "text", p.display_name, 'required maxlength="100"')}${field("email", "البريد الإلكتروني", "email", p.email, 'disabled dir="ltr"')}<div class="field-row">${field("phone_country", "رمز الدولة", "tel", p.phone_country || "+970", 'maxlength="8" dir="ltr"')}${field("phone", "الهاتف <small>اختياري</small>", "tel", p.phone || "", 'maxlength="25" dir="ltr"')}</div>${field("avatar", "صورة حسابك", "file", "", 'accept="image/png,image/jpeg,image/webp,image/gif"')}<button class="button" type="submit">حفظ التعديلات</button></form></section><div><section class="panel"><h3>نظرة على حسابك</h3><div class="profile-stats f90-profile-stats"><div><span class="f90-profile-stat-icon">${I("wallet")}</span><strong>${e(displayMoney(me.wallet.balance_usd))}</strong><span>رصيد المحفظة</span></div><div><span class="f90-profile-stat-icon">${I("grid")}</span><strong>${e(displayMoney(me.spent_usd))}</strong><span>إنفاق مكتمل</span></div><div><span class="f90-profile-stat-icon">${I("crown")}</span><strong>${e(me.vip_level)} / ١٥</strong><span>مستوى التميّز</span></div></div><div class="actions"><a class="button secondary" href="#/orders">طلباتي</a><a class="button secondary" href="#/vip">امتيازاتي</a></div></section><section class="panel" style="margin-top:22px"><h3>أمانك أولًا</h3><p class="muted">تحكّم بالحماية الثنائية وكلمة المرور. يلزم توثيق حسابك قبل الإيداع والشراء.</p><div class="actions"><a class="button ghost" href="#/security">أمان الحساب</a><a class="button secondary" href="#/verification">التوثيق</a></div></section></div></div>`;
  }
  function recipientStorageKey() {
    return S.me?.profile?.id || S.me?.profile?.customer_id
      ? "f90-recipients:" + (S.me.profile.id || S.me.profile.customer_id) : null;
  }
  function localRecipients() {
    const key = recipientStorageKey();
    if (!key) return [];
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data.filter((row) =>
        row && typeof row.id === "string" && typeof row.label === "string" &&
        typeof row.value === "string" && ["phone", "account_id", "email"].includes(row.kind)).slice(0, 100) : [];
    } catch { return []; }
  }
  function saveLocalRecipients(rows) {
    const key = recipientStorageKey();
    if (!key) throw new Error("سجّل الدخول لحفظ دفتر العملاء");
    try { localStorage.setItem(key, JSON.stringify(rows)); }
    catch { throw new Error("تعذّر الحفظ على هذا الجهاز؛ تحقق من مساحة المتصفح وإعدادات الخصوصية"); }
    S.savedRecipients = rows;
  }
  async function recipientUser() {
    const { data, error } = await A.client.auth.getUser();
    if (error || !data?.user?.id) throw new Error("انتهت جلسة الحساب، سجّل الدخول مجددًا لحفظ دفتر العملاء");
    return data.user.id;
  }
  async function cloudRecipients() {
    const userId = await recipientUser();
    const table = A.client.from("f90_saved_recipients");
    let { data, error } = await table.select("id,kind,label,value").eq("user_id",userId).order("created_at",{ascending:true}).limit(100);
    if (error) throw new Error("تعذر تحميل دفتر العملاء من حسابك: " + error.message);
    let rows = data || [];
    const migrationKey = "f90-recipients-cloud-import:" + userId;
    let imported = false;
    try { imported = localStorage.getItem(migrationKey) === "1"; } catch {}
    if (!imported) {
      const legacy = localRecipients().filter(item => !rows.some(row => row.kind === item.kind && row.value === item.value));
      if (legacy.length) {
        const payload = legacy.slice(0, Math.max(0,100 - rows.length)).map(item => ({
          id: crypto.randomUUID(), user_id:userId, kind:item.kind, label:item.label, value:item.value
        }));
        if (payload.length) {
          const response = await A.client.from("f90_saved_recipients").insert(payload).select("id,kind,label,value");
          if (response.error) throw new Error("تعذّر نقل البيانات القديمة إلى الحساب: " + response.error.message);
          rows = [...rows,...(response.data || [])];
        }
      }
      try { localStorage.setItem(migrationKey,"1"); } catch {}
    }
    S.savedRecipients = rows;
    try { saveLocalRecipients(rows); } catch {}
    return rows;
  }
  async function cloudSaveRecipient(item) {
    let userId;
    try { userId = await recipientUser(); }
    catch {
      saveLocalRecipients([...S.savedRecipients.filter(row => row.id !== item.id), item]);
      return "local";
    }
    const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id || "");
    const payload = {id: validId ? item.id : crypto.randomUUID(),user_id:userId,kind:item.kind,label:item.label,value:item.value};
    const { data, error } = await A.client.from("f90_saved_recipients").upsert(payload,{onConflict:"id"}).select("id,kind,label,value").single();
    const next = S.savedRecipients.filter(row => row.id !== item.id);
    if (error) {
      next.push({...item,id:payload.id});
      saveLocalRecipients(next);
      return "local";
    }
    next.push(data);
    S.savedRecipients = next;
    try { saveLocalRecipients(next); } catch {}
    return "account";
  }
  async function cloudDeleteRecipient(id) {
    let userId;
    try { userId = await recipientUser(); }
    catch {
      saveLocalRecipients(S.savedRecipients.filter(row => row.id !== id));
      return "local";
    }
    const {error} = await A.client.from("f90_saved_recipients").delete().eq("id",id).eq("user_id",userId);
    const next = S.savedRecipients.filter(row => row.id !== id);
    S.savedRecipients = next;
    if (error) { saveLocalRecipients(next); return "local"; }
    try { saveLocalRecipients(next); } catch {}
    return "account";
  }
  async function recipients() {
    const seq = S.route;
    main.innerHTML = pageHead("دفتر العملاء", "احفظ معرّفات حساباتك وأرقام الهاتف والبريد الإلكتروني لاستخدامها عند الشراء من أي جهاز. لا تحفظ كلمات مرور أو بيانات دفع.") +
      '<div id="recipientsContent" class="loading">جارٍ تحميل البيانات المحفوظة…</div>';
    let cloudError = null;
    let items = [];
    try { items = await cloudRecipients(); }
    catch (err) { cloudError = err; items = localRecipients(); }
    if (seq !== S.route) return;
    const result = { items };
    S.savedRecipients = result.items || [];
    $("recipientsContent").outerHTML = `${cloudError ? `<p class="notice error" role="alert">${e(cloudError.message)}. البيانات المعروضة نسخة محلية، ولن تُزامن حتى يعود الاتصال.</p>` : `<p class="notice" role="status">جهاتك محفوظة في حسابك ومتاحة على أجهزتك عند تسجيل الدخول.</p>`}<div class="f90-recipient-toolbar"><div><strong>جهاتك المحفوظة</strong><span class="muted small"> ${e(S.savedRecipients.length)} من 100 جهة</span></div><label class="f90-recipient-search"><span>بحث في دفتر العملاء</span><input id="recipientSearch" type="search" placeholder="ابحث بالاسم أو المعرّف" autocomplete="off"></label></div><p id="recipientSearchEmpty" class="muted small" hidden role="status">لا توجد جهة مطابقة. جرّب اسمًا أو معرّفًا آخر.</p><div class="f90-recipient-layout">
      <section class="panel"><h2 id="recipientFormTitle">إضافة جهة</h2>
        <form id="recipientForm">
          <input type="hidden" name="id" value="">
          ${field("label", "اسم مختصر", "text", "", 'required maxlength="50" placeholder="مثال: حساب ببجي"')}
          ${select("kind", "نوع المعرّف", [["account_id", "معرّف حساب أو لعبة"], ["phone", "رقم هاتف"], ["email", "بريد إلكتروني"]], "account_id")}
          ${field("value", "المعرّف أو رقم الهاتف", "text", "", 'required minlength="2" maxlength="120" autocomplete="off" dir="ltr"')}
          <p class="muted small">تُحفظ البيانات في حسابك لتظهر عند تسجيل الدخول من أجهزتك، مع محاولة نقل البيانات المحفوظة سابقًا على هذا الجهاز. لا تحفظ كلمات مرور أو بيانات دفع.</p>
          <div class="actions"><button class="button" type="submit">حفظ</button><button class="button secondary" type="button" data-action="recipient-reset">إلغاء التحرير</button></div>
        </form>
      </section>
      <section class="panel"><h2>البيانات المحفوظة</h2>
        ${S.savedRecipients.length ? `<div class="f90-recipient-list">${S.savedRecipients.map((item) => `<article class="f90-recipient-item" data-recipient-search="${e([item.label,item.value,item.kind].join(" ").toLocaleLowerCase("ar"))}"><div><strong>${e(item.label)}</strong><span class="muted small">${item.kind === "phone" ? "هاتف" : item.kind === "email" ? "بريد إلكتروني" : "معرّف حساب"}</span><code dir="ltr">${e(item.value)}</code></div><div class="actions"><button class="button secondary small" data-action="recipient-edit" data-id="${e(item.id)}">تعديل</button><button class="button ghost small" data-action="recipient-delete" data-id="${e(item.id)}">حذف</button></div></article>`).join("")}</div>` : '<p class="muted">لم تحفظ أي بيانات بعد.</p>'}
      </section>
    </div>`;
  }
  async function loadCheckoutRecipients(form) {
    const select = form.querySelector("#savedRecipient");
    if (!select) return;
    try {
      let items;
      try { items = await cloudRecipients(); } catch { items = localRecipients(); }
      const result = { items };
      if (!form.isConnected) return;
      S.savedRecipients = result.items || [];
      const product = S.products.find(p => p.id === form.dataset.product);
      const fieldKinds = (product?.commerce?.fields?.length ? product.commerce.fields : [{id:"account_id"}])
        .map(field => recipientFieldKind(field)).filter(Boolean);
      const kinds = [...new Set(fieldKinds)];
      const rows = S.savedRecipients.filter((item) => kinds.includes(item.kind));
      select.innerHTML = '<option value="">أدخل البيانات يدويًا</option>' +
        rows.map((item) => `<option value="${e(item.id)}">${e(item.label)} · ${e(item.value)}</option>`).join("");
      select.disabled = !rows.length;
      if (!rows.length) select.closest(".f90-recipient-chooser").hidden = true;
    } catch {
      if (form.isConnected) select.closest(".f90-recipient-chooser").hidden = true;
    }
  }
  function isAppInstalled() {
    return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }
  function f90InstallDevice() {
    const agent=navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(agent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
      ? "ios" : /Android/i.test(agent) ? "android" : "windows";
  }
  function f90InstallHelp(device) {
    if (device === "ios") return "على iPhone أو iPad: افتح F90 CARD باستخدام Safari، اضغط مشاركة، ثم «إضافة إلى الشاشة الرئيسية»، وأكّد الإضافة.";
    if (device === "windows") return "على Windows: افتح المتجر باستخدام Edge أو Chrome، ثم من قائمة المتصفح اختر «تثبيت هذا الموقع كتطبيق» إذا كان الخيار متاحًا.";
    return "على Android: افتح المتجر باستخدام Chrome، واضغط «تثبيت التطبيق» من قائمة المتصفح. إذا ظهر طلب تثبيت مباشر، وافق عليه.";
  }
  function f90InstallPlatforms(){
    return [
      {id:"ios",name:"Apple · iPhone",icon:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M17.05 12.5c-.03-3.02 2.46-4.5 2.57-4.57-1.4-2.04-3.57-2.32-4.34-2.34-1.84-.2-3.62 1.08-4.56 1.08-.96 0-2.41-1.05-3.99-1.02-2.06.03-3.97 1.2-5.03 3.03-2.15 3.73-.55 9.22 1.55 12.25 1.03 1.49 2.25 3.16 3.87 3.1 1.55-.07 2.14-.99 3.99-.99s2.4.99 4 .96c1.65-.03 2.7-1.5 3.71-3a12.2 12.2 0 0 0 1.7-3.51c-.04-.02-3.23-1.24-3.26-4.98ZM14.29 3.52C15.14 2.49 15.72 1.06 15.56 0c-1.22.05-2.7.81-3.58 1.84-.78.88-1.47 2.35-1.28 3.73 1.36.1 2.75-.7 3.59-2.05Z" transform="translate(2 1) scale(.82)"/></svg>'},
      {id:"android",name:"Android",icon:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M5.25 9a6.75 6.75 0 0 1 13.5 0ZM3.5 10.5h17v7.25A2.25 2.25 0 0 1 18.25 20H5.75a2.25 2.25 0 0 1-2.25-2.25ZM7 20h2v3H7Zm8 0h2v3h-2ZM2 11h1v7H2zm19 0h1v7h-1Z"/><path d="M6.5 2.5 9 6M17.5 2.5 15 6" stroke="currentColor" stroke-width="1.25"/><circle cx="8" cy="8.5" r=".7" fill="#111"/><circle cx="16" cy="8.5" r=".7" fill="#111"/></svg>'},
      {id:"windows",name:"Windows",icon:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M2 4.4 11 3v8H2zm10-1.56L22 1.4V11H12zM2 12h9v8.1L2 18.8zm10 0h10v10.6L12 21.1z"/></svg>'}

    ];
  }
  function f90InstallShortcuts(devices=["ios","android","windows"],location=""){
    const available=f90InstallPlatforms();
    return '<span class="f90-install-shortcuts'+(location?' f90-install-'+location:'')+
      '" role="group" aria-label="تثبيت التطبيق حسب النظام">'+devices.map(device=>{
        const item=available.find(x=>x.id===device);
        if(!item)return "";
        return '<button type="button" class="f90-install-icon-btn" data-action="install-platform" data-platform="'+item.id+
          '" aria-label="تثبيت F90 CARD على '+e(item.name)+'" title="تثبيت على '+e(item.name)+'">'+item.icon+'</button>';
      }).join("")+'</span>';
  }
  async function f90RequestInstall(device){
    if(isAppInstalled()){toast("التطبيق مثبت بالفعل على هذا الجهاز");return;}
    const platform=["ios","android","windows"].includes(device)?device:f90InstallDevice();
    const current=f90InstallDevice();
    const guide=f90InstallHelp(platform);
    if(platform==="ios"||platform!==current||!installPrompt){
      modal("تثبيت F90 CARD",'<p>'+e(guide)+'</p>');
      return;
    }
    const prompt=installPrompt;
    installPrompt=null;
    try{
      await prompt.prompt();
      // The browser owns approval and actual installation.
      await prompt.userChoice;
    }finally{syncInstallButtons();}
  }
  function syncInstallButtons() {
    const installed=isAppInstalled();
    const header=$("installButton");
    if(header){
      header.hidden=installed;
      if(!installed && !header.querySelector(".f90-install-shortcuts"))
        header.innerHTML=f90InstallShortcuts(["ios","android","windows"],"drawer");
    }
    const action=$("f90InstallAction");
    document.querySelectorAll('[data-action="install"]').forEach(button=>{
      if(button !== action)button.hidden=installed;
    });
    const state=$("f90InstallState");
    if(state)state.hidden=!installed;
    if(action){
      action.disabled=installed;
      const device=document.querySelector('.f90-install-platform[aria-pressed="true"]')?.dataset.platform || f90InstallDevice();
      action.setAttribute("aria-label",installed?"التطبيق مثبت بالفعل":"تثبيت تطبيق F90 CARD على "+device);
    }
  }
  function installPage() {
    const selected=f90InstallDevice();
    const installIcon=e(C.safeUrl(S.settings.config?.app_icon_url || "./assets/icons/icon-192.png") || "./assets/icons/icon-192.png");
    const official=e(C.safeUrl(S.settings.logo_url || "./f90-logo.png") || "./f90-logo.png");
    const platforms=f90InstallPlatforms();
    main.innerHTML = '<section class="f90-install-premium" aria-labelledby="f90InstallHeading"><header class="f90-install-top"><img src="'+official+'" alt="شعار F90 CARD"><span class="f90-install-label">F90 DIGITAL EXPERIENCE</span></header>'+
      '<div class="f90-install-hero"><div class="f90-install-hero-icon"><img src="'+installIcon+'" alt="أيقونة المتجر"></div><div><h1 id="f90InstallHeading">تثبيت F90 CARD</h1><p>أضف المتجر إلى جهازك للوصول السريع إلى خدماتك ومحفظتك وطلباتك.</p></div></div>'+
      '<div class="f90-install-platforms" role="group" aria-label="اختر نظام جهازك">'+platforms.map(x=>'<button type="button" class="f90-install-platform" data-action="install-platform" data-platform="'+x.id+'" aria-pressed="'+(x.id===selected)+'" aria-label="تثبيت على '+x.name+'">'+x.icon+'</button>').join("")+'</div>'+
      '<div class="f90-install-steps"><strong>طريقة التثبيت</strong><p id="f90InstallGuide">'+e(f90InstallHelp(selected))+'</p></div>'+
      '<p id="f90InstallState" class="f90-install-success" hidden>تم تشغيل المتجر بوضع التطبيق على هذا الجهاز.</p>'+
      '<div class="f90-install-page-icons">'+f90InstallShortcuts(["ios","android","windows"],"page")+'</div></section>';
    syncInstallButtons();
  }
  async function wallet() {
    const me = S.me, balance = Number(me.wallet?.balance_usd || 0);
    const logo = C.safeUrl(S.settings.logo_url || "./f90-logo.png") || "./f90-logo.png";
    const customerId = me.profile?.customer_id || "F90 CARD";
    main.innerHTML = pageHead("محفظة F90 CARD", "رصيدك وحركات المحفظة في صفحة واحدة، بعملة العرض المحددة.") +
      '<section class="f90-visa-wallet"><div class="f90-visa-top"><img src="'+e(logo)+'" alt="شعار F90 CARD"><span>F90 WALLET · DIGITAL</span></div>'+
      '<div class="f90-visa-chip" aria-hidden="true">▦</div><span class="f90-visa-label">رصيدك المتاح</span><strong class="f90-visa-amount">'+e(displayMoney(balance,true))+'</strong>'+
      '<div class="f90-visa-bottom"><span>'+e(me.profile?.display_name||"عميل F90")+'</span><span>'+e(customerId)+'</span></div>'+
      '<small class="f90-visa-rights">© F90 CARD · محفظة رقمية داخل المتجر، وليست بطاقة مصرفية</small></section>'+
      '<div class="f90-wallet-summary"><div><small>المحفظة الأساسية</small><strong>'+e(C.money(balance,"USD",true))+'</strong></div>'+
      '<div><small>عملة العرض</small><strong>'+e(S.currency)+'</strong></div>'+
      '<div><small>مشتريات مكتملة</small><strong>'+e(displayMoney(me.spent_usd,true))+'</strong></div></div>'+
      '<nav class="f90-wallet-links"><a class="button" href="#/deposit">إضافة رصيد</a><a class="button secondary" href="#/deposits">كل الإيداعات</a><a class="button secondary" href="#/orders">سجل الطلبات</a></nav>'+
      '<section class="panel f90-wallet-ledger"><div class="section-head"><h2>جدول العمليات والرصيد</h2><a href="#/history" class="muted small">عرض السجل الكامل</a></div><div id="f90WalletLedger" class="loading">جارٍ تحميل الحركات…</div></section>'+
      '<section class="panel"><div class="section-head"><h2>آخر الإيداعات</h2><a href="#/deposits" class="muted small">عرض الكل</a></div><div id="walletDeposits" class="loading">جارٍ التحميل…</div></section>';
    const [historyResult,depositsResult]=await Promise.allSettled([
      A.call("history",{kind:"ledger",offset:0}),A.call("history",{kind:"deposits",offset:0})
    ]);
    const ledgerBox=$("f90WalletLedger");
    if(ledgerBox)ledgerBox.outerHTML=historyResult.status==="fulfilled"
      ? (historyResult.value.items.length ? '<div class="table-wrap"><table class="f90-wallet-table"><thead><tr><th>التاريخ</th><th>العملية</th><th>المبلغ</th><th>الرصيد بعدها</th></tr></thead><tbody>'+
      historyResult.value.items.slice(0,20).map(x=>'<tr><td>'+e(C.date(x.created_at))+'</td><td>'+e(x.description||x.kind)+'</td><td class="'+(Number(x.amount_usd)>=0?'ledger-plus':'ledger-minus')+'">'+e(displayMoney(x.amount_usd,true))+'</td><td>'+e(displayMoney(x.balance_after,true))+'</td></tr>').join("")+
      '</tbody></table></div>' : empty("لا توجد حركات رصيد بعد","wallet")) : '<div class="notice error">تعذّر تحميل الحركات. حاول تحديث الصفحة.</div>';
    const depositsBox=$("walletDeposits");
    if(depositsBox)depositsBox.outerHTML=depositsResult.status==="fulfilled"
      ? (depositsResult.value.items.length ? '<div class="records">'+depositsResult.value.items.slice(0,5).map(depositRecord).join("")+'</div>' : empty("لم تقدّم طلب إيداع بعد","wallet"))
      : '<div class="notice error">تعذّر تحميل الإيداعات.</div>';
  }
  // Customer-facing numbers always use the account currency. Wallet
  // storage/credits remain USD; this helper does not change financial state.
  function accountMoney(usd,code=S.me?.profile?.account_currency||"USD",rates=S.rates) {
    const rate=rates.find(x=>x.currency===code&&x.is_enabled&&Number(x.per_usd)>0);
    if(!rate)return "—";
    const amount=Number(usd)*Number(rate.per_usd);
    if(!Number.isFinite(amount))return "—";
    return new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:3}).format(amount)+" "+code;
  }
  function financeSuccess({title,amount,reference,href:link="#/deposits"}) {
    return '<div class="f90-finance-success" role="status" aria-live="polite">'+
      '<span class="f90-finance-success-icon" aria-hidden="true">✓</span>'+
      '<h2>'+e(title)+'</h2><p>طلبك بانتظار مراجعة الإدارة.</p>'+
      (amount?'<div class="f90-finance-success-amount"><small>الصافي المتوقع في رصيدك</small><strong>'+e(amount)+'</strong></div>':'')+
      (reference?'<small>رقم المتابعة: '+e(String(reference).slice(0,8))+'</small>':'')+
      '<a class="button full" href="'+e(link)+'">عرض طلبات الإيداع</a>'+
      '<a class="f90-finance-success-back" href="#/deposit">العودة لطرق الإيداع</a></div>';
  }
  function depositRecord(d) {
    // Show the immutable recorded fee snapshot; never invent fees for older rows.
    const pct=Number(d.method_snapshot?.deposit_fee_percent);
    const hasFee=d.method_snapshot?.deposit_fee_percent!=null;
    const gross=Number(d.usd_amount||0);
    const fee=hasFee&&Number.isFinite(pct)?Math.round(gross*pct/100*1000000)/1000000:0;
    const net=Math.max(0,gross-fee);
    const currency=d.currency||"USD";
    const converted=Number(d.rate_snapshot)>0
      ?new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:3}).format(net*Number(d.rate_snapshot))+" "+currency
      :accountMoney(net,currency);
    const state=d.status||"pending";
    const detail=hasFee?'رسوم الإيداع '+e(pct)+'٪':'الرسوم بحسب السجل الأصلي';
    return '<article class="record f90-history-entry" data-state="'+e(state)+'">'+
      '<div class="f90-history-entry-main"><div class="f90-history-entry-title"><h3>'+e(d.method_name)+'</h3>'+status(state)+'</div>'+
      '<small>'+e(C.date(d.created_at))+'</small>'+
      '<strong class="f90-history-sum">'+e(converted)+'</strong>'+
      '<details class="f90-history-more"><summary>التفاصيل</summary>'+
      '<p>المبلغ المُحوّل: '+e(C.money(d.amount,currency,true))+' · '+detail+'</p>'+
      (d.review_note?'<p>'+e(d.review_note)+'</p>':'')+'</details></div></article>';
  }
  function deposit(methodId) {
    if (S.settings?.config?.deposit_requires_verification===true && !S.me?.profile?.is_verified) {
      main.innerHTML = pageHead("توثيق الحساب مطلوب", "يلزم توثيق حسابك قبل تقديم طلب الإيداع.") +
        '<section class="panel"><p>ارفع بيانات التوثيق من صفحة التحقق، وبعد موافقة الإدارة ستتمكن من الإيداع.</p><a class="button" href="#/verification">الانتقال إلى توثيق الهوية</a></section>';
      return;
    }
    const methods=S.settings.config.payment_methods||[];
    const salaryMethod=x=>x?.is_salary_withdrawal===true ||
      x?.id==="27c8ecef-f69d-4b36-bb88-70bba88c4062" ||
      (Array.isArray(x?.accepted_currencies)&&x.accepted_currencies.includes("XCN")&&/سحب رواتب|اكزينا|Xena/i.test(x.name_ar||""));
    S.selectedMethod=methods.find(m=>m.id===methodId&&m.enabled)||null;
    S.depositKey=C.key();
    const m=S.selectedMethod;
    if(m&&salaryMethod(m)){
      window.F90Special.render("salary",S.settings,S.me,"",S.rates);
      return;
    }
    const active=methods.filter(x=>x.enabled===true);
    const salaryEnabled=S.settings.config?.salary_withdrawal?.enabled===true &&
      S.settings.config?.special_services?.show_salary!==false;
    const fallbackSalary=salaryEnabled&&!methods.some(salaryMethod);
    if(!m){
      main.innerHTML=pageHead("طرق الإيداع", "اختر وسيلة الإيداع المناسبة. ستظهر لك تفاصيلها قبل الطلب.",
        '<a class="button secondary small" href="#/deposits">طلبات الإيداع</a>')+
        '<div class="method-grid f90-deposit-methods-with-images">'+methods.map(x=>x.enabled===true?
          '<a class="method-tile f90-method-active" href="'+(salaryMethod(x)?"#/special/salary":href("deposit",x.id))+'" aria-label="'+e(x.name_ar)+'">'+
          image(x.image_url,x.name_ar,"f90-deposit-method-art")+
          '<strong>'+e(x.name_ar)+'</strong><small>إيداع متاح الآن</small></a>':
          '<div class="method-tile f90-method-unavailable" aria-disabled="true">'+
          image(x.image_url,x.name_ar,"f90-deposit-method-art")+
          '<strong>'+e(x.name_ar)+'</strong><small>غير متاح حاليًا</small></div>').join("")+
        (fallbackSalary?'<a class="method-tile f90-method-active" href="#/special/salary">'+
          image(S.settings.config?.salary_withdrawal?.image_url||"./assets/f90-new/xena-salary-v2.webp","سحب رواتب Xena Live","f90-deposit-method-art")+
          '<strong>سحب رواتب Xena Live</strong><small>حساب الكوينز وتقديم الطلب</small></a>':"")+
        '</div>'+
        (!active.length&&!fallbackSalary?empty("لا توجد طرق إيداع مفعّلة حاليًا","wallet"):"");
      return;
    }
    const accountCurrency=S.me?.profile?.account_currency||"USD";
    const accountRate=S.rates.find(r=>r.currency===accountCurrency&&r.is_enabled&&Number(r.per_usd)>0);
    const methodSupports=!Array.isArray(m.accepted_currencies)||m.accepted_currencies.includes(accountCurrency);
    const canDeposit=!!accountRate&&methodSupports;
    const min=Number(m.minimum_amount)>0?Number(m.minimum_amount):0;
    const name=e(m.name_ar||"إيداع");
    const receiver=e(m.receiver_name||"");
    const destination=e(m.destination||"");
    const instructions=e(m.details_ar||"أكمل التحويل إلى بيانات الحساب المعتمدة ثم أرسل إيصال التحويل للمراجعة.");
    main.innerHTML=
      '<div class="f90-deposit-compact">'+
      '<nav class="f90-deposit-navigation"><a href="#/deposit">‹ جميع طرق الإيداع</a><a href="#/deposits">سجل الإيداعات</a></nav>'+
      '<section class="f90-deposit-request-card">'+

      '<header class="f90-deposit-request-head"><h1>'+name+'</h1>'+
      (receiver?'<strong>'+receiver+'</strong>':"")+
      (m.network_ar?'<span>'+e(m.network_ar)+'</span>':"")+
      '</header>'+
      (destination?'<div class="f90-deposit-destination"><span>حوّل إلى</span>'+
        '<strong dir="auto">'+destination+'</strong></div>':"")+
      (instructions?'<div class="f90-finance-visible-instructions" role="note"><strong>تعليمات الإيداع</strong><p>'+instructions+'</p></div>':"")+
      (C.safeUrl(m.barcode_url)?'<details class="f90-finance-help"><summary>عرض باركود الدفع</summary>'+
        '<div class="f90-deposit-barcode"><img src="'+e(C.safeUrl(m.barcode_url))+'" alt="باركود '+name+'" loading="lazy" decoding="async"></div></details>':"")+
      '<form id="depositForm" class="f90-deposit-order-form">'+
      
      '<input type="hidden" name="currency" value="'+e(accountCurrency)+'">'+
      (!canDeposit?'<div class="notice warning">طريقة الإيداع لا تدعم عملة حسابك حاليًا. اختر طريقة أخرى أو غيّر عملة حسابك من شريط العملات.</div>':"")+
      '<label class="field"><span>مبلغ الإيداع ('+e(accountCurrency)+')</span><input type="number" name="amount" required inputmode="decimal" min="'+e(min||0.000001)+'" max="1000000000000" step="any" placeholder="أدخل قيمة التحويل">'+
      (min?'<small>الحد الأدنى لهذه الطريقة: '+e(min)+' بعملة التحويل</small>':"")+'</label>'+
      '<div class="f90-deposit-net-box f90-deposit-output" id="depositEstimate" role="status" aria-live="polite"><small>سينضاف لرصيدك بعد الموافقة</small><strong class="f90-deposit-net-amount">—</strong></div>'+
      '<details class="f90-finance-help f90-salary-optional-note"><summary>ملاحظة (اختياري)</summary>'+
      '<label class="field"><span>'+e(m.reference_label||"رقم العملية")+'</span>'+
        '<input name="reference" type="text" maxlength="300" placeholder="رقم العملية أو ملاحظة"></label></details>'+
      '<label class="field f90-deposit-upload"><span>صورة الإيصال</span>'+
        '<input type="file" name="receipt" required accept="image/jpeg,image/png,image/webp">'+
        '<small>'+e(m.receipt_help||"ارفع إيصالًا واضحًا بصيغة JPG أو PNG أو WEBP، بحد أقصى 5 ميجابايت. لا يظهر الإيصال للعامة.")+'</small></label>'+
      '<p class="f90-deposit-request-footnote">يُضاف الرصيد بعد موافقة الإدارة.</p>'+
      '<button type="submit" class="button full" '+(!canDeposit?'disabled':'')+'>تقديم طلب الإيداع</button>'+
      '</form></section></div>';
  }
  function orderRecord(o) {
    const state=o.status||"pending";
    return '<a class="record f90-history-entry f90-history-order" data-state="'+e(state)+'" href="'+href("order",o.id)+'">'+
      image(o.product_image,o.product_name,"record-image")+
      '<div class="f90-history-entry-main"><div class="f90-history-entry-title"><h3>'+e(o.product_name)+'</h3>'+status(state)+'</div>'+
      '<small>'+e(C.date(o.created_at))+'</small>'+
      (orderRecipientFields(o).accountId?'<small> ID: '+e(orderRecipientFields(o).accountId)+'</small>':'')+
      (orderRecipientFields(o).accountName?'<small>اسم الحساب'+""+': '+e(orderRecipientFields(o).accountName)+'</small>':'')+
      '<strong class="f90-history-sum">'+e(accountMoney(o.total_usd))+'</strong></div>'+
      '<span class="f90-history-open" aria-hidden="true">‹</span></a>';
  }
  function salaryHistoryRecord(d){
    const state=d.status||"pending";
    return '<article class="record f90-history-entry" data-state="'+e(state)+'">'+
      '<div class="f90-history-entry-main"><div class="f90-history-entry-title"><h3>سحب رواتب Xena Live</h3>'+status(state)+'</div>'+
      '<small>'+e(C.date(d.created_at))+' · '+e(Number(d.coins).toLocaleString("en-US"))+' كوينز</small>'+
      '<strong class="f90-history-sum">'+e(accountMoney(d.usd_amount))+'</strong>'+
      '<details class="f90-history-more"><summary>التفاصيل</summary>'+
      '<p>المبلغ وقت الطلب: '+e(targetSalaryMoney(d))+'</p>'+
      (d.review_note?'<p>'+e(d.review_note)+'</p>':'')+'</details></div></article>';
  }
  function targetSalaryMoney(d){
    return Number(d.payout_amount||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:3})+
      " "+(d.payout_currency||"USD");
  }
  function ledgerRecord(x){
    const amount=Number(x.amount_usd||0),incoming=amount>=0;
    const name=x.kind==="deposit"?"إضافة رصيد":x.kind==="purchase"?"شراء خدمة":
      x.kind==="refund"?"استرداد رصيد":x.kind==="adjustment"?"تعديل رصيد":"حركة رصيد";
    return '<article class="record f90-history-entry" data-state="'+e(x.kind||"adjustment")+'">'+
      '<div class="f90-history-entry-main"><div class="f90-history-entry-title"><h3>'+e(name)+'</h3>'+
      '<span class="f90-history-type '+(incoming?'ledger-plus':'ledger-minus')+'">'+(incoming?'وارد':'صادر')+'</span></div>'+
      '<small>'+e(C.date(x.created_at))+'</small>'+
      '<strong class="f90-history-sum '+(incoming?'ledger-plus':'ledger-minus')+'">'+(incoming?'+':'−')+e(accountMoney(Math.abs(amount)))+'</strong>'+
      '<details class="f90-history-more"><summary>الرصيد بعد العملية</summary><p>'+e(accountMoney(x.balance_after))+'</p></details></div></article>';
  }
  function applyHistoryFilter() {
    const wrap=document.getElementById("f90HistoryView");if(!wrap)return;
    const term=String(document.getElementById("orderHistorySearch")?.value||"").trim().toLocaleLowerCase("ar");
    const selected=wrap.dataset.filter||"all";
    let visible=0;
    wrap.querySelectorAll("#historyRecords .record").forEach(row=>{
      const state=row.dataset.state||"";
      const group=wrap.dataset.page==="history"?state:
        ["pending","queued","submitting","processing","review"].includes(state)?"pending":
        ["approved","completed","partial"].includes(state)?"completed":
        ["rejected","failed","cancelled","refunded"].includes(state)?"rejected":"pending";
      const matches=(selected==="all"||selected===group)&&(!term||row.textContent.toLocaleLowerCase("ar").includes(term));
      row.hidden=!matches;if(matches)visible++;
    });
    const counter=document.getElementById("f90OrderSearchCount");
    if(counter)counter.textContent="النتائج: "+visible;
    const emptyState=document.getElementById("f90OrderSearchEmpty");
    if(emptyState)emptyState.hidden=visible>0;
    wrap.querySelectorAll("[data-f90-history-filter]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.f90HistoryFilter===selected)));
  }
  async function history(kind) {
    const seq=S.route,orders=kind==="orders",deposits=kind==="deposits";
    const title=orders?"سجل الطلبات":deposits?"سجل الإيداعات":"سجل العمليات";
    const links='<nav class="f90-history-nav" aria-label="أقسام السجلات">'+
      [['orders','الطلبات'],['deposits','الإيداعات'],['history','العمليات']].map(([id,label])=>
        '<a href="#/'+id+'" '+((orders&&id==="orders")||(deposits&&id==="deposits")||(!orders&&!deposits&&id==="history")?'aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav>';
    main.innerHTML=pageHead(title,"",
      '<button class="button secondary small" data-action="report" data-kind="'+e(kind)+'">PDF</button>'+
      '<button class="button secondary small" data-action="report-csv" data-kind="'+e(kind)+'">CSV</button>')+
      '<section class="f90-history-view" id="f90HistoryView" data-page="'+e(kind)+'" data-filter="all">'+links+
      '<div class="f90-history-tools">'+
      '<input id="orderHistorySearch" type="search" placeholder="بحث في '+title+'" autocomplete="off" aria-label="بحث في '+title+'">'+
      '<small id="f90OrderSearchCount" role="status"></small></div>'+
      '<div class="f90-history-filters" role="group" aria-label="تصفية السجل">'+
      (orders||deposits?[['all','الكل'],['pending','قيد المراجعة'],['completed','مكتمل'],['rejected','مرفوض']]:
        [['all','الكل'],['deposit','إيداع'],['purchase','شراء'],['refund','استرداد'],['adjustment','تسوية']]).map(([code,label])=>
        '<button type="button" data-f90-history-filter="'+code+'" aria-pressed="'+(code==="all")+'">'+label+'</button>').join('')+
      '</div><div id="records" class="loading">جارٍ تحميل السجل…</div></section>';
    const [r,salaryResult]=await Promise.all([
      A.call("history",{kind:orders?"orders":deposits?"deposits":"ledger",offset:S.offset}),
      deposits?A.call("history.salary",{offset:0}).catch(()=>null):Promise.resolve(null)
    ]);
    if(seq!==S.route)return;
    S.reportItems=r.items;S.reportKind=kind;
    const items=r.items||[];
    const rows=items.map(x=>orders?orderRecord(x):deposits?depositRecord(x):ledgerRecord(x)).join("");
    const paging='<div class="pagination"><button class="button secondary small" data-action="page-prev" '+(S.offset===0?'disabled':'')+'>السابق</button>'+
      '<span class="muted small">'+e(items.length?S.offset+1:0)+'–'+e(Math.min(S.offset+50,r.count))+' من '+e(r.count)+'</span>'+
      '<button class="button secondary small" data-action="page-next" '+(S.offset+50>=r.count?'disabled':'')+'>التالي</button></div>';
    const salaryRows=deposits&&S.offset===0&&salaryResult?.items?.length
      ?'<section class="f90-history-salary-group"><h2>سحب رواتب Xena Live</h2>'+
        '<div class="records">'+salaryResult.items.map(salaryHistoryRecord).join("")+'</div></section>':"";
    document.getElementById("records").outerHTML=
      '<div class="records" id="historyRecords">'+(items.length?rows:
        (salaryRows?'':'<p class="f90-history-no-records">'+(orders?"لا توجد طلبات حتى الآن":deposits?"لا توجد إيداعات حتى الآن":"لا توجد عمليات حتى الآن")+'</p>'))+
      (salaryRows?'<div class="f90-history-salary-in-list">'+salaryRows+'</div>':'')+'</div>'+
      '<p id="f90OrderSearchEmpty" class="f90-search-empty" hidden>لا توجد نتائج مطابقة.</p>'+(r.count>0?paging:'');
    applyHistoryFilter();
  }
  function orderRecipientFields(o){
    const fields=o.customer_fields && typeof o.customer_fields==="object"&&!Array.isArray(o.customer_fields)
      ? o.customer_fields:{};
    const values=Object.entries(fields).filter(([k,v])=>v!=null&&String(v).trim()!=="");
    const pick=(keys)=>{for(const key of keys){const entry=values.find(([k])=>k.toLowerCase()===key);if(entry)return String(entry[1]);}return "";};
    // param_1 is the supplied service recipient field for many older orders.
    // We never claim an externally verified player name from a numeric ID.
    const accountId=pick(["account_id","player_id","playerid","uid","game_id","user_id","recipient_id","target_id","param_1"]);
    const suppliedName=pick(["account_name","player_name","character_name","nickname","username","recipient_name","in_game_name"]);
    const supplierName=typeof o.supplier_account_name==="string"?o.supplier_account_name.trim():"";
    const accountName=supplierName||suppliedName;
    const extras=values.filter(([key])=>!["account_id","player_id","playerid","uid","game_id","user_id","recipient_id","target_id","param_1","account_name","player_name","character_name","nickname","username","recipient_name","in_game_name"].includes(key.toLowerCase()));
    return {accountId,accountName,accountNameSource:supplierName?"supplier":suppliedName?"entered":"",extras};
  }
  function orderSummaryFields(o){
    const recipient=orderRecipientFields(o);
    const quantity=Number(o.quantity)||0;
    const subtotal=Number(o.subtotal_usd);
    const unit=quantity>0&&Number.isFinite(subtotal)?subtotal/quantity:quantity>0?Number(o.total_usd)/quantity:0;
    return [
      ["اسم المنتج",String(o.product_name||"—")],
      ["الكمية",String(o.quantity??"—")],
      ["السعر",accountMoney(unit)],
      ["السعر الإجمالي",accountMoney(o.total_usd)],
      ["التاريخ والوقت",C.date(o.created_at)],
      ...(recipient.accountId?[["ID الشحن",recipient.accountId]]:[]),
      ...(recipient.accountName?[["اسم الحساب",recipient.accountName]]:[])
    ];
  }
  async function order(id) {
    const seq=S.route;
    main.innerHTML='<div class="loading">جارٍ تحميل تفاصيل طلبك…</div>';
    const {order:o,events=[],requests=[]}=await A.call("order",{id});
    if(seq!==S.route)return;
    S.currentOrder=o;
    const fields=orderSummaryFields(o);
    const recipient=orderRecipientFields(o);
    const openKinds=new Set(requests.filter(r=>r.status==="pending").map(r=>r.kind));
    const requestPanel='<section class="f90-order-requests"><h3>مراجعة أو اعتراض</h3>'+
      '<p class="muted small">طلبات الاعتراض والإلغاء تخضع لمراجعة الإدارة، ولا تُنفّذ تلقائيًا.</p>'+
      requests.map(r=>'<article class="record"><div class="record-main"><strong>'+e(r.kind==="cancel"?"طلب إلغاء":"اعتراض")+'</strong><p>'+e(r.reason)+'</p><small>'+e(C.date(r.created_at))+'</small>'+
      (r.review_note?'<p>'+e(r.review_note)+'</p>':'')+'</div>'+status(r.status)+'</article>').join("")+
      ((!openKinds.has("cancel")&&!["completed","partial","failed","refunded"].includes(o.status))||!openKinds.has("dispute")
        ?'<form id="orderRequestForm">'+select("kind","نوع الطلب",[
          ...(!openKinds.has("cancel")&&!["completed","partial","failed","refunded"].includes(o.status)?[["cancel","طلب إلغاء"]]:[]),
          ...(!openKinds.has("dispute")?[["dispute","اعتراض"]]:[])
         ],"")+field("reason","سبب الطلب","textarea","",'required minlength="5" maxlength="2000"')+
         '<button class="button secondary" type="submit">إرسال للمراجعة</button></form>':"")+'</section>';
    const rows=fields.map(([label,value])=>'<div class="f90-order-summary-row"><span>'+e(label)+'</span><strong dir="auto">'+e(value)+'</strong></div>').join("");
    const more=recipient.extras.length?
      '<details class="f90-order-extra"><summary>بيانات الشحن الإضافية</summary>'+
      recipient.extras.map(([key,val])=>'<p><span>'+e(key)+'</span><strong dir="auto">'+e(typeof val==="object"?JSON.stringify(val):val)+'</strong></p>').join("")+'</details>':"";
    // Customer-facing progress excludes provider diagnostics and internal notes.
    const eventsHtml='<div class="timeline-item">'+customerOrderStatus(o.status)+'</div>';
    main.innerHTML=pageHead("تفاصيل الطلب","",
      '<button class="button secondary small" data-action="order-pdf">'+I("download")+' تنزيل PDF</button>')+
      '<div class="f90-order-summary-layout"><section class="panel f90-order-summary-card">'+
      '<div class="f90-order-summary-heading"><img src="'+e(C.safeUrl(S.settings.logo_url||"./f90-logo.png")||"./f90-logo.png")+'" alt="F90 CARD" loading="lazy">'+
      '<div><h2>ملخص الطلب</h2><p id="f90OrderSeconds" class="f90-order-elapsed" aria-live="off">مدة التنفيذ: جارٍ الحساب…</p>'+customerOrderStatus(o.status)+'</div></div>'+
      '<div class="f90-order-summary-rows">'+rows+'</div>'+
      (Number(o.refunded_usd)>0?'<p class="notice success">قيمة مستردة: '+e(accountMoney(o.refunded_usd))+'</p>':"")+
      more+'</section>'+
      '<section class="panel f90-order-secondary"><h3>متابعة الطلب أو تقديم اعتراض</h3>'+
      '<div class="timeline">'+eventsHtml+'</div>'+requestPanel+
      '</section></div>';
    const startedAt=Date.parse(o.started_at||o.created_at)||Date.now();
    const terminal=['completed','partial','failed','rejected','refunded','cancelled','canceled'].includes(o.status);
    const finalAt=terminal?(Date.parse(o.completed_at||o.updated_at)||Date.now()):null;
    const seconds=()=>Math.max(0,Math.floor(((finalAt||Date.now())-startedAt)/1000));
    const label=$("f90OrderSeconds");
    const updateSeconds=()=>{if(label?.isConnected)label.textContent='مدة التنفيذ: '+new Intl.NumberFormat('ar').format(seconds())+' ثانية';};
    clearInterval(orderSecondsTimer);updateSeconds();
    if(!terminal)orderSecondsTimer=setInterval(updateSeconds,1000);
    clearTimeout(orderPollTimer);
    if(!terminal){
      const poll=()=>{
        if(S.route!==seq||main.dataset.page!=='order')return;
        const note=main.querySelector('#orderRequestForm textarea');
        if(note&&(document.activeElement===note||note.value.trim())){orderPollTimer=setTimeout(poll,12000);return;}
        order(id).catch(()=>{});
      };
      orderPollTimer=setTimeout(poll,12000);
    }
  }
  function vip() {
    const me = S.me,
      current = S.vip.find((t) => t.level === me?.vip_level) || S.vip[0] || { level: 1, minimum_spend: 0, discount_percent: 0 },
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
    main.innerHTML = `${pageHead("كل خطوة لها امتياز", "خمسة عشر مستوى VIP. تتدرج المزايا مع الإنفاق المكتمل، وخصم المستوى لا يتجاوز 3٪.")}<section class="vip-hero"><div><div class="eyebrow" style="color:var(--gold)">مستويات التميّز</div><h2>${me ? "مستواك الحالي " + me.vip_level : "اكتشف امتيازاتك القادمة"}</h2><p>خصمك الحالي ${e(current.discount_percent)}٪ على الخدمات المؤهّلة.</p><div class="vip-progress"><span style="width:${pct}%"></span></div><p class="small">${next ? "متبقّي " + e(C.money(Math.max(0, Number(next.minimum_spend) - spent))) + " للمستوى التالي" : "وصلت إلى أعلى مستوى"}</p><a class="button" href="#/">اكتشف الخدمات</a></div><div class="vip-emblem">${I("crown")}<strong>${e(me?.vip_level || 1)}</strong><span>عالم التميّز</span></div></section><div class="vip-grid">${S.vip.map((t) => `<div class="vip-card f90-vip-${Math.max(1, Math.min(15, Number(t.level) || 1))} ${Number(me?.vip_level) === t.level ? "current" : ""}"><span class="f90-vip-seal">${I("crown")}<b>${e(t.level)}</b></span><strong>المستوى ${e(t.level)}</strong><div class="discount">${e(t.discount_percent)}٪</div><small class="muted">من ${e(displayMoney(t.minimum_spend))}</small>${Number(me?.vip_level) === t.level ? '<span class="f90-vip-current-label">مستواك الحالي</span>' : ""}</div>`).join("")}</div><div class="notice">يُحسب المستوى من قيمة الطلبات المكتملة بعد الاسترداد. إذا أُدخل رمز خصم، يُطبّق الخصم الأعلى دون جمعه مع خصم المستوى. قد تخصّص الإدارة مستواك، وتسعير التاجر منفصل.</div>`;
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
    if (id === "about") {
      const description = page?.ar || "أف تسعين كارد متجر للخدمات الرقمية، نوفر تجربة عربية منظمة لشحن الألعاب والتطبيقات وشراء الخدمات الرقمية مع متابعة الطلبات من حساب واحد.";
      const highlights = [
        ["01", "اختيار واضح", "تصفح الأقسام والخدمات وقارن تفاصيل الطلب قبل تأكيده."],
        ["02", "محفظتك أمامك", "اعرف قيمة طلبك والرصيد المتبقي قبل إتمام العملية."],
        ["03", "متابعة من الحساب", "راجع حالة طلباتك وسجل حركات المحفظة ضمن صفحات مخصصة."],
        ["04", "تواصل مباشر", "اطلب المساعدة من فريق المتجر عبر صفحة الدعم."]
      ];
      main.innerHTML = `<section class="f90-about-hero" aria-labelledby="f90-about-title"><div class="f90-about-eyebrow">F90 CARD · عالم الخدمات الرقمية</div><div class="f90-about-split"><div class="f90-about-copy"><span class="f90-about-kicker">وجهتك الرقمية بطابع مختلف</span><h1 id="f90-about-title">أف تسعين كارد <span>أقرب لعالمك.</span></h1><p>${e(description)}</p><div class="f90-about-cta"><a class="button" href="#/">استكشف المتجر ${I("arrow-left")}</a>${f90InstallShortcuts(["ios","android"],"about")}</div></div><div class="f90-about-art" aria-label="هوية أف تسعين كارد"><img src="./f90-logo.png" alt="شعار أف تسعين كارد الأصلي" loading="eager"><div class="f90-about-art-caption">F90 CARD <span>خدمات رقمية · تجربة عربية</span></div></div></div><div class="f90-about-glow f90-about-glow-a" aria-hidden="true"></div><div class="f90-about-glow f90-about-glow-b" aria-hidden="true"></div></section><section class="f90-about-body"><div class="f90-about-heading"><span class="eyebrow">بُنيت التجربة لتكون أسهل</span><h2>كل خطوة في مكانها.</h2><p class="muted">تصميم واضح، تفاصيل مقروءة، ووصول سريع للخدمات والحساب.</p></div><div class="f90-about-features">${highlights.map(([n,t,d]) => `<article class="f90-about-feature"><span class="f90-about-number">${n}</span><h3>${t}</h3><p>${d}</p></article>`).join("")}</div><div class="f90-about-final"><div><span class="eyebrow">رحلتك تبدأ هنا</span><h2>اختر الخدمة. والباقي واضح.</h2><p>تصفح خدماتنا وتعرف على التفاصيل والسعر قبل الشراء.</p></div><div class="f90-about-cta"><a class="button" href="#/">تصفح الأقسام ${I("arrow-left")}</a><a class="button secondary" href="#/policy/terms">الشروط والأحكام</a></div></div></section>`;
      return;
    }
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

  function apiGuide() {
    if(S.me?.role!=="trader"){location.hash="#/";return;}
    main.innerHTML=window.F90MerchantViews.docs("https://www.f90card.online/api/merchant",C.safeUrl(S.settings.logo_url||"./f90-logo.png")||"./f90-logo.png");
  }
  function developers() {
    if(S.me?.role!=="trader"){location.hash="#/";return;}
    const cfg=S.settings.config||{};
    if(cfg.merchant_api_enabled===false){
      main.innerHTML=pageHead("API token","Merchant access is temporarily disabled.");
      return;
    }
    main.innerHTML=window.F90MerchantViews.tokens((S.me.keys||[]).filter(k=>k.is_active),
      S.me.profile?.is_verified,C.safeUrl(S.settings.logo_url||"./f90-logo.png")||"./f90-logo.png","https://www.f90card.online/api/merchant");
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
    const oldPromoVideo=main.querySelector(".f90-home-phone-video");
    if(oldPromoVideo)oldPromoVideo.pause();
    promoVideoObserver?.disconnect();
    promoVideoObserver=null;
    closeBellPanel();
    const ticker=$("promotionBar");
    if(ticker && ticker.parentElement===main)main.parentElement.insertBefore(ticker,main);
    clearInterval(bannerTimer);
    clearInterval(introTimer);
    clearInterval(maintenanceTimer);
    document.body.classList.remove("f90-in-maintenance");
    clearTimeout(quoteTimer);
    clearTimeout(orderPollTimer);
    clearInterval(orderSecondsTimer);
    f90CategoryAvailability.clear();
    f90CategoryById.clear();
    closeQuickProduct();
    closeModal();
    toggleDrawer(false);
    const raw = (location.hash || "#/welcome").replace(/^#\/?/, "");
    let [page, id, serviceChoice] = raw.split("/");
    try {
      id = id ? decodeURIComponent(id) : "";
    } catch {
      id = "";
    }
    main.dataset.page = page || "home";
    if(page) S.homeAnnouncementShown=false;
    document.body.classList.remove('f90-welcome-route');
    $("mobileDock")?.querySelectorAll("[data-dock-page]").forEach((link) => {
      link.classList.toggle("active", link.dataset.dockPage === (page || ""));
    });
    if (page === "developers" && !["trader","manager","admin"].includes(S.me?.role)) {
      location.hash = "#/";
      return;
    }
    if (!["orders", "deposits", "history"].includes(page)) S.offset = 0;
    const privatePages = [
      "profile",
      "recipients",
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
    // Do not interpret an unfinished Supabase session rehydration as logout.
    // This is particularly important when the app is opened directly at
    // #/deposit or #/special/salary on slower mobile browsers.
    const needsAccount=privatePages.includes(page)||(page==="special"&&id==="salary");
    if(needsAccount&&!S.me){
      main.innerHTML='<section class="panel f90-session-recovery" role="status" aria-live="polite">'+
        '<h2>جارٍ استعادة حسابك…</h2><p>نراجع الجلسة المحفوظة، دون تسجيل خروج أو تغيير الرصيد.</p></section>';
      if(pendingMeRefresh){
        try{await pendingMeRefresh;}catch{/* Recheck below */ }
        if(seq!==S.route)return;
      }
      if(!S.me){
        // A server timeout does not invalidate a stored authenticated session.
        // Retain the intended route, rather than losing it to #/auth.
        let checkSession;
        try{checkSession=await A.client.auth.getSession();}
        catch(err){checkSession={error:err};}
        if(seq!==S.route)return;
        if(checkSession?.error||checkSession?.data?.session){
          S.walletStale=true;
          main.innerHTML='<section class="panel f90-session-recovery" role="status">'+
            '<h2>تعذّر تحديث بيانات الحساب مؤقتًا</h2>'+
            '<p>الجلسة محفوظة. حاول إعادة الاتصال لعرض الإيداع بأمان.</p>'+
            '<button type="button" class="button" id="f90RestoreAccountRetry">إعادة الاتصال</button></section>';
          main.querySelector("#f90RestoreAccountRetry")?.addEventListener("click",async()=>{
            const button=main.querySelector("#f90RestoreAccountRetry");
            if(button)button.disabled=true;
            try{if(await refreshMe()){chrome();await route();return;}}
            catch(err){console.warn("F90 login recovery",err);}
            if(button)button.disabled=false;
            toast("تعذّرت استعادة الحساب مؤقتًا. حاول مجددًا");
          });
          return;
        }
        // Only a confirmed absence of a saved session requires a login.
        if(location.hash!=="#/auth")location.hash="#/auth";
        else loginRequired();
        return;
      }
    }
    if (S.me?.needs_mfa && privatePages.includes(page)) {
      main.innerHTML =
        pageHead("أكمل حماية حسابك", "أدخل رمز المصادقة لفتح حسابك.") +
        `<button class="button" data-action="mfa-challenge">إدخال رمز التحقق</button>`;
      await mfaChallenge();
      return;
    }
    if (!["welcome", "", "auth"].includes(page)) {
      main.innerHTML = '<div class="loading" role="status" aria-live="polite">جارٍ تحميل الصفحة…</div>';
    }
    try {
      if (
        S.settings.config.maintenance?.enabled &&
        !(S.settings.config.maintenance.until && Number.isFinite(Date.parse(S.settings.config.maintenance.until)) && Date.parse(S.settings.config.maintenance.until) <= Date.now()) &&
        !["manager", "admin"].includes(S.me?.role) &&
        !["auth", "security", "support"].includes(page)
      ) {
        const maintenance = S.settings.config.maintenance;
        const until = maintenance.until ? new Date(maintenance.until).getTime() : NaN;
        const hasCountdown = Number.isFinite(until);
        document.body.classList.add("f90-in-maintenance");
        main.innerHTML = `<section class="f90-maintenance-screen" role="status" aria-label="الموقع تحت الصيانة"><div class="f90-maintenance-decor" aria-hidden="true"></div><div class="f90-maintenance-content"><img class="f90-maintenance-logo" src="${e(C.safeUrl(S.settings.logo_url || "./f90-logo.png") || "./f90-logo.png")}" alt="شعار F90 Card" width="110" height="110"><span class="f90-maintenance-tag">F90 CARD</span><h1>نعتذر لكم، الموقع قيد الصيانة حاليًا</h1><p>${e(maintenance.text_ar || "نعمل على تحسين خدماتنا، وسنعود للعمل قريبًا.")}</p>${hasCountdown ? '<div class="f90-maintenance-countdown" id="maintenanceClock" aria-label="الوقت المتبقي حتى الموعد المحدد"></div>' : '<p class="muted">سيعود الموقع للعمل عند انتهاء الصيانة.</p>'}<small>نشكر لكم صبركم وتفهّمكم</small></div></section>`;
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
              route();
            }
          };
          tick();
          if (until > Date.now()) maintenanceTimer = setInterval(tick, 1000);
        }
        return;
      }
      if (page === "welcome") welcome();
      else if (page === "partner") await window.F90Partners?.render(main,id);
      else if (!page) {
        home();
        const announcement=S.settings.config?.popup_announcement;
        const alertKey="f90-home-announcement-shown:" + String(announcement?.revision || announcement?.text_ar || "").slice(0,120);
        let announcedThisSession=false;
        try { announcedThisSession=sessionStorage.getItem(alertKey)==="1"; } catch {}
        if(announcement?.enabled && announcement.every_home_visit && announcement.text_ar &&
          !S.homeAnnouncementShown && !announcedThisSession &&
          !$("modalRoot")?.children.length && !S.settings.config?.maintenance?.enabled){
          S.homeAnnouncementShown=true;
          try { sessionStorage.setItem(alertKey,"1"); } catch {}
          modal("إشعار F90 CARD",'<p class="f90-popup-copy">'+e(announcement.text_ar)+'</p>'+
            '<button type="button" class="button full" data-action="close-modal">متابعة المتجر</button>');
        }
        if (!S.greetedStore) {
          S.greetedStore = true;
          toast("أهلًا " + (S.me?.profile?.display_name || "بك") + " في أف تسعين كارد");
        }
      }
      else if (page === "quran") window.F90Quran?.render(main);
      else if (page === "music") musicPage();
      else if (page === "category") category(id);
      else if (page === "product") product(id);
      else if (page === "auth") auth();
      else if (page === "register") auth("register");
      else if (page === "profile") profile();
      else if (page === "recipients") profile();
      else if (page === "install") installPage();
      else if (page === "wallet") await wallet();
      else if (page === "deposit") deposit(id);
      else if (page === "special") window.F90Special?.render(id,S.settings,S.me,serviceChoice ? decodeURIComponent(serviceChoice) : "",S.rates);
      else if (["orders", "deposits", "history"].includes(page))
        await history(page);
      else if (page === "order") await order(id);
      else if (page === "vip") vip();
      else if (page === "security") await security();
      else if (page === "verification") await verification();
      else if (page === "api-guide") { if(S.me?.role==="trader") apiGuide(); else { location.hash="#/"; return; } }
      else if (page === "developers") { if(S.me?.role==="trader") developers(); else { location.hash="#/"; return; } }
      else if (page === "support") support();
      else if (page === "agents") await window.F90Agents.publicPage(main);
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
        // News is already supplied by the catalog loaded at startup.
        // Avoid a second network request and a blank waiting screen on each visit.
        if (seq !== S.route) return;
        if (S.news[0]?.created_at) {
          try { localStorage.setItem("f90-news-seen", S.news[0].created_at); } catch {}
        }
        updateStoreBell();
        const news = (S.news || []).map((n) =>
          `<a class="panel f90-news-item" href="${n.product_id ? href("product", n.product_id) : "#/"}"><span class="f90-news-icon" aria-hidden="true">${I("bell")}</span><div class="f90-news-content"><h3>${e(n.title_ar)}</h3><p class="muted">${e(n.body_ar)}</p><small>${e(C.date(n.created_at))}</small></div><span class="f90-news-arrow" aria-hidden="true">${I("arrow-left")}</span></a>`).join("");
        main.innerHTML =
          pageHead("كل جديد، هنا") +
          (S.settings.config.notifications || [])
            .filter((n) => n.enabled && C.visibleSchedule(n))
            .map(
              (n) =>
                `<section class="panel f90-news-item"><span class="f90-news-icon" aria-hidden="true">${I("bell")}</span><div class="f90-news-content"><h3>${e(n.title_ar)}</h3><p class="muted">${e(n.text_ar || n.body_ar)}</p></div></section>`,
            )
            .join("") + news;
        if (!main.querySelector(".panel"))
          main.insertAdjacentHTML(
            "beforeend",
            empty("لا توجد إشعارات جديدة", "bell"),
          );
      } else if (page === "search") {
        const searchInput = $("globalSearch");
        const q = String(id || searchInput?.value || "").trim().toLocaleLowerCase("ar");
        const normalize = window.F90CatalogSearch?.normalize || (value => String(value || "").toLocaleLowerCase("ar"));
        const term = normalize(q);
        const matchedCategories = term ? S.categories.filter(c=>window.F90CatalogSearch.matches(c.name,q,[c.description||""])) : S.categories.filter(c=>!c.parent_id).slice(0,12);
        const matchedProducts = term ? S.products.filter(p=>window.F90CatalogSearch.matches(p.name,q,[p.description||"",...(p.commerce?.search_aliases||[])])) : S.products.filter(p=>p.is_featured).slice(0,18);
        main.innerHTML =
          pageHead("البحث في المتجر", q ? "نتائج البحث عن: " + e(q) : "ابحث عن الألعاب والتطبيقات والخدمات") +
          `<form id="f90SearchPageForm" class="f90-search-page-form" role="search"><label for="f90SearchPageInput">ابحث في جميع أقسام المتجر</label><div><input id="f90SearchPageInput" type="search" value="${e(q)}" placeholder="اسم لعبة أو تطبيق أو خدمة..." autocomplete="off" required><button class="button" type="submit">${I("search")} بحث</button></div></form>` +
          `<p class="f90-search-result-count" role="status">${term ? "نتائج البحث: " : "الأقسام والخدمات المقترحة: "}${matchedCategories.length+matchedProducts.length}</p><div class="image-grid">${matchedCategories.map(categoryTile).join("")}${matchedProducts.map(p=>productTile(p)).join("")}</div>`;
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
      const redirect = "https://www.f90card.online/"; // Verified production origin for Auth email callbacks.
      if (form.dataset.mode === "register") {
        const r = await A.client.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: redirect,
            data: {
              display_name: data.display_name,
              account_currency: ["USD","ILS","JOD"].includes(String(data.account_currency)) ? String(data.account_currency) : "USD",
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
          redirectTo: redirect, // Supabase recovery event opens #/reset after consuming token.
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
      const restored = await refreshMe();
      if(!restored){
        // Supabase may have accepted the password while the F90 profile API
        // is temporarily offline. Keep the authenticated session intact and
        // do not bounce the customer back to the login page.
        let validSession=false;
        try{validSession=!!(await A.client.auth.getSession())?.data?.session;}catch{}
        if(validSession){
          const errorEl=$("authError");
          if(errorEl)errorEl.textContent="تم تسجيل الدخول، لكن تعذّر تحميل بيانات حسابك مؤقتًا. احتفظنا بالجلسة؛ حدّث الصفحة عند عودة الاتصال.";
          S.walletStale=true;
          return;
        }
        throw new Error("تعذّر تأكيد جلسة الدخول. حاول مجددًا.");
      }
      if(!S.settings?.store_name){
        const errorEl=$("authError");
        if(errorEl)errorEl.textContent="تم تسجيل الدخول. تعذّر تحميل بيانات المتجر مؤقتًا؛ حدّث الصفحة عند عودة الاتصال.";
        return;
      }
      chrome();
      if (location.hash === "#/profile") await route();
      else location.hash = "#/profile";
      return;
    }
    if (form.id === "recipientForm") {
      let rows;
      try { rows = await cloudRecipients(); } catch { rows = localRecipients(); }
      const kind = ["phone", "account_id", "email"].includes(data.kind) ? data.kind : "account_id";
      const label = String(data.label || "").trim().slice(0, 50);
      const value = String(data.value || "").trim().slice(0, 120);
      if (!label || value.length < 2) throw new Error("أدخل الاسم والمعرّف الصحيح");
      if (kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("أدخل بريدًا إلكترونيًا صحيحًا");
      const id = data.id || C.key();
      const index = rows.findIndex((item) => item.id === id);
      if (index < 0 && rows.length >= 100) throw new Error("دفتر العملاء ممتلئ");
      if (rows.some((row) => row.id !== id && row.kind === kind && row.value.trim() === value))
        throw new Error("هذا المعرّف محفوظ بالفعل. يمكنك تعديل الجهة الموجودة بدل إضافتها مرتين.");
      const item = { id, kind, label, value };
      if (index < 0) rows.push(item); else rows[index] = item;
      const storage = await cloudSaveRecipient(item);
      toast(storage === "local" ? "حُفظت البيانات على هذا الجهاز" : "تم حفظ البيانات في حسابك");
      await recipients();
      return;
    }
    if (form.id === "orderRequestForm") {
      const o = S.currentOrder;
      if (!o) throw new Error("تعذّر تحديد الطلب");
      const kind = data.kind;
      const reason = String(data.reason || "").trim();
      if (!["cancel", "dispute"].includes(kind) || reason.length < 5)
        throw new Error("اكتب سبب الطلب بوضوح");
      await A.call("order.request", { order_id: o.id, kind, reason });
      toast("وصل طلبك للإدارة ويمكنك متابعة القرار هنا");
      await order(o.id);
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
      if (S.settings?.config?.purchase_requires_verification===true && !S.me.profile?.is_verified) {
        modal("توثيق الحساب مطلوب", `<p>يلزم توثيق حسابك وموافقة الإدارة قبل تنفيذ الشراء.</p><a class="button" href="#/verification">انتقل إلى توثيق الهوية</a>`);
        return;
      }
      if (!S.quote || form.dataset.pricePending === "1" || form.dataset.quotedQuantity !== String(Number(form.elements.quantity?.value || 1))) throw new Error("انتظر السعر النهائي المحدث قبل التأكيد");
      // A cached balance must never authorize a new checkout after a failed refresh.
      if (S.walletStale) {
        const refreshed = await refreshMe();
        chrome();
        if (!refreshed)
          throw new Error("تعذّر تحديث المحفظة. تأكد من اتصالك وحاول مجددًا قبل إجراء شراء جديد.");
        if (S.settings?.config?.purchase_requires_verification===true && !S.me?.profile?.is_verified)
          throw new Error("يلزم توثيق الحساب قبل إجراء الشراء.");
      }
      if (Number(S.me.wallet.balance_usd) < Number(S.quote.total_usd))
        throw new Error("رصيد محفظتك غير كافٍ. قدّم إيداعًا وانتظر اعتماده");
      // The submit button spends the visible authoritative quote directly.
      // Server expected-total validation and idempotency remain mandatory.
      const total = Number(S.quote.total_usd);
      if (!Number.isFinite(total) || total <= 0) throw new Error("تعذّر التحقق من سعر الطلب");
      const p = S.products.find((p) => p.id === form.dataset.product),
        fields = {};
      for (const [k, v] of Object.entries(data))
        if (k.startsWith("customer_")) fields[k.slice(9)] = String(v);
      const reference = S.checkoutKey;
      let o;
      try {
        o = await A.call("checkout", {
          product_id: p.id,
          quantity: Number(data.quantity),
          fields,
          idempotency_key: reference,
          expected_total_usd: S.quote.total_usd,
        });
      } catch (error) {
        if (!error.uncertain) throw error;
        let recovered;
        try {
          recovered = await A.call("transaction.lookup", { kind: "order", idempotency_key: reference });
        } catch {
          throw new Error("لم نتمكن من تأكيد نتيجة الشراء. افحص طلباتك قبل المحاولة من جديد؛ لن نرسل شراءً إضافيًا تلقائيًا.");
        }
        if (!recovered?.found || !recovered.order?.id)
          throw new Error("لم يتأكد تسجيل عملية الشراء. راجع طلباتك قبل إرسال طلب آخر.");
        o = recovered.order;
      }
      // Keep the successful checkout in the same product panel. The backend
      // remains authoritative and the idempotency key is rotated only on success.
      S.checkoutKey = C.key();
      const completedForm = form;
      if (completedForm.isConnected) {
        completedForm.innerHTML = '<div class="notice success" role="status"><strong>تم تسجيل طلبك بنجاح</strong><p>يمكنك متابعة حالة الخدمة في سجل الطلبات.</p><a class="button" href="' + href("order", o.id) + '">عرض تفاصيل الطلب</a><button type="button" class="button secondary" data-action="close-quick-product">إغلاق</button></div>';
      }
      let refreshed = false;
      try {
        refreshed = await refreshMe();
        chrome();
      } catch {
        // Never turn a committed checkout into a misleading payment error.
      }
      toast(refreshed
        ? "تم تسجيل طلب الشراء. يمكنك متابعة حالته من طلباتك."
        : "تم تسجيل طلب الشراء، لكن تعذّر تحديث المحفظة. الرصيد المعروض قديم؛ راجع طلباتك.");
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
      const reference = S.depositKey;
      // Reuse the uploaded receipt on an uncertain retry, rather than uploading
      // a different file path with the same idempotency key.
      const file = data.receipt;
      const signature = file ? [file.name, file.size, file.lastModified].join(":") : "";
      const depositDetails = JSON.stringify({
        method_id: S.selectedMethod?.id,
        currency: S.me?.profile?.account_currency||"USD",
        amount: Number(data.amount),
        reference: data.reference || "",
      });
      // Once a receipt was uploaded for this reference, do not silently reuse
      // the key for different amounts, payment destinations or image files.
      if (S.pendingDepositReceipt?.key === reference &&
          (S.pendingDepositReceipt.signature !== signature ||
           S.pendingDepositReceipt.details !== depositDetails)) {
        throw new Error("غيّرت بيانات الإيداع بعد محاولة سابقة. راجع سجل الإيداعات قبل تقديم طلب جديد من صفحة الإيداع.");
      }
      let receiptPath = S.pendingDepositReceipt?.key === reference
        ? S.pendingDepositReceipt.path : null;
      if (!receiptPath) {
        const receipt = await A.upload(file, "f90-receipts");
        receiptPath = receipt.path;
        S.pendingDepositReceipt = {
          key: reference, signature, details: depositDetails, path: receiptPath,
        };
      }
      let submittedDeposit=null;
      try {
        submittedDeposit=await A.call("deposit.submit", {
          method_id: S.selectedMethod.id,
          currency: S.me?.profile?.account_currency||"USD",
          amount: Number(data.amount),
          reference: data.reference,
          receipt_path: receiptPath,
          idempotency_key: reference,
        });
      } catch (error) {
        if (!error.uncertain) throw error;
        let recovered;
        try {
          recovered = await A.call("transaction.lookup", { kind: "deposit", idempotency_key: reference });
        } catch {
          throw new Error("نتيجة الإيداع غير مؤكدة. راجع سجل إيداعاتك قبل إعادة الإرسال؛ لم نرسل طلبًا إضافيًا.");
        }
        if (!recovered?.found)
          throw new Error("لم يتأكد تسجيل الإيداع. راجع سجله قبل المحاولة من جديد.");
        submittedDeposit=recovered.deposit||recovered.row||null;
      }
      S.pendingDepositReceipt = null;
      S.depositKey = C.key();
      const recordedUsd=Number(submittedDeposit?.usd_amount||0);
      const savedPct=Number(submittedDeposit?.method_snapshot?.deposit_fee_percent??S.selectedMethod?.deposit_fee_percent??2);
      const netUsd=recordedUsd>0?recordedUsd*(1-Math.max(0,Math.min(50,savedPct))/100):0;
      const savedCode=submittedDeposit?.currency||S.me?.profile?.account_currency||"USD";
      const savedRate=Number(submittedDeposit?.rate_snapshot||0);
      const expected=netUsd>0?(savedRate>0?
        new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:3}).format(netUsd*savedRate)+" "+savedCode:
        accountMoney(netUsd,savedCode)):"";
      form.innerHTML=financeSuccess({title:"تم إرسال طلب الإيداع",amount:expected,reference:submittedDeposit?.id});
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
    if (form.id === "keyForm" || form.id === "keySettingsForm") {
      const scopes = form.id === "keyForm" ? ["catalog", "balance", "orders"] : ["catalog", "balance", "orders"].filter((scope) => form.elements["scope_" + scope]?.checked);
      if (!scopes.length) throw new Error("اختر صلاحية واحدة على الأقل");
      const values = {name:data.name,scopes,requests_per_minute:Number(data.requests_per_minute)||60,
        expires_at:data.expires_at||null,allow_all_ips:form.elements.allow_all_ips?.checked===true,
        allowed_ips:String(form.elements.allowed_ips?.value||"").split(/[\r\n,]+/).map(x=>x.trim()).filter(Boolean),
        replace_existing:!!S.me?.keys?.some(k=>k.is_active)};
      if (form.id === "keySettingsForm") {
        await A.call("key.update", { id: S.editKey.id, ...values });
        closeModal();
        await refreshMe();
        developers();
        toast("API token settings saved");
        return;
      }
      const key = await A.call("key.create", values);
      let apiTestMessage="لم يكتمل اختبار الاتصال؛ المفتاح أُنشئ ويمكن استخدامه من خادم متجرك.";
      try {
        const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
        try {
          const response=await fetch("https://www.f90card.online/api/merchant",{
            method:"POST",headers:{"Content-Type":"application/json","x-f90-key":key.token},
            body:JSON.stringify({action:"services"}),cache:"no-store",signal:ctrl.signal
          });
          const payload=await response.json();
          apiTestMessage=response.ok&&Array.isArray(payload?.data)
            ?"تم التحقق من الاتصال وجلب "+payload.data.length+" خدمة بالمفتاح الجديد."
            :"تعذر التحقق من API: "+String(payload?.error?.code||response.status);
        } finally {clearTimeout(timeout);}
      } catch {apiTestMessage="المفتاح أنشئ بنجاح، لكن لم يُحسم اختبار الاتصال التلقائي.";}
      await refreshMe();
      developers();
      modal(
        "SAVE YOUR API TOKEN",
        `<p>${e(apiTestMessage)}</p><p>انسخ المفتاح الآن، يظهر مرة واحدة فقط. احتفظ به في خادم متجرك ولا تنشره في الواجهة.</p><div class="key-token" dir="ltr">${e(key.token)}</div><button class="button secondary" style="margin-top:16px" data-action="copy-text" data-text="${e(key.token)}">Copy API TOKEN</button>`,
      );
      return;
    }
  }
  document.addEventListener("submit", async (ev) => {
    const form = ev.target;
    if (form.id === "f90SearchPageForm") {
      ev.preventDefault();
      const term=$("f90SearchPageInput")?.value.trim();
      if(term)location.hash=href("search",term);
      return;
    }
    if (form.id === "searchForm" || form.id === "homeSearchForm") {
      ev.preventDefault();
      S.offset = 0;
      const q = form.id === "homeSearchForm" ? $("homeSearch").value : $("globalSearch").value;
      location.hash = href("search", q.trim());
      return;
    }
    if (
      ![
        "authForm",
        "checkoutForm",
        "profileForm",
        "recipientForm",
        "orderRequestForm",
        "depositForm",
        "verificationForm",
        "passwordForm",
        "mfaForm",
        "keyForm",
        "keySettingsForm",
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
      if (button?.isConnected) button.disabled = form.id === "checkoutForm" ? !S.quote : false;
    }
  });
  document.addEventListener("input", (ev) => {
    if (ev.target?.id === "recipientSearch") {
      const term=ev.target.value.trim().toLocaleLowerCase("ar");
      let visible=0;
      document.querySelectorAll(".f90-recipient-item").forEach(item=>{
        item.hidden=!!term&&!item.dataset.recipientSearch.includes(term);
        if(!item.hidden)visible++;
      });
      const empty=$("recipientSearchEmpty");
      if(empty)empty.hidden=!term||visible>0;
      return;
    }
    if (ev.target?.id === "orderHistorySearch") {
      applyHistoryFilter();
      return;
    }
    if (ev.target.id === "savedRecipient") return;
    if (ev.target.closest("#checkoutForm") && ev.target.name === "quantity") {
      const form=ev.target.closest("form");
      const p=S.products.find(x=>x.id===form.dataset.product);
      if (!p) return;
      const raw=ev.target.value,qty=Number(raw);
      if (S.quote && form.dataset.quotedQuantity===String(qty)) return;
      // Customer ID, saved account and notes never affect the supplier's price.
      // Invalidate only on quantity changes to avoid an RPC per typed character.
      S.quote=null;
      ++S.quoteSeq;
      delete form.dataset.quotedQuantity;
      $("buyButton").disabled=true;
      const board=$("priceBoard");
      board?.setAttribute("aria-busy","true");
      const total=$("checkoutTotal");
      if(total)total.textContent="جارٍ تحديث السعر…";
      const shown=$("f90CheckoutTopTotal");
      // Never display a speculative price. The first visible amount must
      // come from the confirmed quote API for the current quantity.
      if ($("f90CheckoutTopRemaining")) $("f90CheckoutTopRemaining").textContent = "—";
      if(shown){
        shown.textContent="جارٍ تحديث السعر…";
        shown.setAttribute("aria-busy","true");
      }
      clearTimeout(quoteTimer);
      if(raw===""||!Number.isFinite(qty)||qty<=0||
        qty<Number(p.commerce?.quantity_min||1)||
        qty>Number(p.commerce?.quantity_max||1000000000)){
        if(shown){shown.textContent="أدخل كمية صحيحة";shown.removeAttribute("aria-busy");}
        return;
      }
      quoteTimer=setTimeout(()=>quoteProduct(p),85);
    }
    if (ev.target.closest("#depositForm")) {
      const f = $("depositForm");
      const estimate = $("depositEstimate");
      if (!estimate) return;
      const amount = Number(f.elements.amount.value);
      const min = Number(S.selectedMethod?.minimum_amount || 0);
      if (Number.isFinite(amount) && Number.isFinite(min) && min>0 && amount<min) {
        estimate.innerHTML='<strong class="f90-finance-inline-error">الحد الأدنى '+e(min)+' '+e(S.me?.profile?.account_currency||"USD")+'</strong>';
        return;
      }
      const rate = S.rates.find((row) => row.currency === (S.me?.profile?.account_currency||"USD") && row.is_enabled);
      const perUsd = Number(rate?.per_usd);
      if (!f.elements.amount.value || !Number.isFinite(amount) || amount <= 0) {
        estimate.innerHTML='<small>سينضاف لرصيدك بعد الموافقة</small><strong class="f90-deposit-net-amount">—</strong>';
        return;
      }
      if (!Number.isFinite(perUsd) || perUsd <= 0) {
        estimate.innerHTML='<strong class="f90-finance-inline-error">سعر الصرف غير متاح</strong>';
        return;
      }
      const gross = amount / perUsd;
      const configured = Number(S.selectedMethod?.deposit_fee_percent ?? 2);
      const pct = Number.isFinite(configured) ? Math.max(0,Math.min(50,configured)) : 2;
      const fee = Math.round(gross * pct / 100 * 1000000) / 1000000;
      const net = gross - fee;
      const currency=S.me?.profile?.account_currency||"USD";
      estimate.innerHTML='<small>سينضاف لرصيدك بعد الموافقة</small>'+
        '<strong class="f90-deposit-net-amount">'+e(accountMoney(net,currency))+'</strong>'+
        '<span class="f90-finance-fee-hint">شامل خصم عمولة الإيداع '+e(pct)+'٪</span>';
    }
  });
  document.addEventListener("change", (ev) => {
    if (ev.target.name === "account_currency" && ev.target.closest("#authForm") && !S.me) {
      const chosen = String(ev.target.value || "");
      if (!["USD", "ILS", "JOD"].includes(chosen)) return;
      S.currency = chosen;
      S.currencyPreference = true;
      try { localStorage.setItem("f90-currency", chosen); } catch {}
      const drawerSelect = $("currencySelect");
      if (drawerSelect?.querySelector('option[value="' + chosen + '"]')) drawerSelect.value = chosen;
      return;
    }
    if (ev.target.id !== "savedRecipient") return;
    const item = S.savedRecipients.find((row) => row.id === ev.target.value);
    const form = $("checkoutForm");
    const product = S.products.find(p => p.id === form?.dataset.product);
    const fields = product?.commerce?.fields?.length ? product.commerce.fields : [{id:"account_id"}];
    const field = item && fields.find(f => recipientFieldKind(f) === item.kind);
    const input = field && form?.elements["customer_" + field.id];
    if (input) {
      input.value = item.value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }
  });
  document.addEventListener("click",ev=>{
    const filter=ev.target.closest?.("[data-f90-history-filter]");
    if(!filter)return;
    ev.preventDefault();
    const wrap=document.getElementById("f90HistoryView");
    if(wrap){wrap.dataset.filter=filter.dataset.f90HistoryFilter;applyHistoryFilter();}
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
      if (action === "channel-dismiss") {
        try { localStorage.setItem(button.dataset.key, "1"); } catch {}
        closeModal();
      } else if (action === "popup-read") {
        try { localStorage.setItem(button.dataset.key, "1"); } catch {}
        closeModal();
      } else if (action === "recipient-reset") {
        const form = $("recipientForm");
        form?.reset();
        if (form) form.elements.id.value = "";
        $("recipientFormTitle").textContent = "إضافة جهة";
      } else if (action === "recipient-edit") {
        const item = S.savedRecipients.find((row) => row.id === button.dataset.id);
        const form = $("recipientForm");
        if (!item || !form) return;
        form.elements.namedItem("id").value = item.id;
        form.elements.namedItem("label").value = item.label;
        form.elements.namedItem("kind").value = item.kind;
        form.elements.namedItem("value").value = item.value;
        $("recipientFormTitle").textContent = "تعديل جهة";
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        form.elements.namedItem("label")?.focus();
      } else if (action === "recipient-delete") {
        const item = S.savedRecipients.find((row) => row.id === button.dataset.id);
        if (!item) return;
        modal("حذف البيانات المحفوظة", `<p>حذف ${e(item.label)} من دفتر العملاء؟ لن يؤثر ذلك على الطلبات السابقة.</p><div class="actions"><button class="button secondary" data-close-modal>إلغاء</button><button class="button" data-action="recipient-delete-confirm" data-id="${e(item.id)}">حذف</button></div>`);
      } else if (action === "recipient-delete-confirm") {
        await cloudDeleteRecipient(button.dataset.id);
        closeModal();
        toast("حُذفت البيانات المحفوظة");
        await recipients();
      } else if (action === "logout") {
        await A.client.auth.signOut();
        S.me = null;
        S.savedRecipients = [];
        chrome();
        if (location.hash === "#/auth") route();
        else location.hash = "#/auth";
      } else if (action === "share" || action === "copy-text") {
        await navigator.clipboard.writeText(
          action === "share" ? location.href : button.dataset.text,
        );
        toast("تم النسخ");
      } else if (action === "auth-tab") auth(button.dataset.mode);
      else if (action === "google") {
        // Carry the guest's currency choice only into a newly created Google account.
        // Existing accounts always retain their saved profile currency.
        if (!S.me) {
          const chosen = String(document.querySelector("#authForm [name=account_currency]")?.value || S.currency);
          if (["USD","ILS","JOD"].includes(chosen)) {
            try { localStorage.setItem("f90-google-currency-pending", JSON.stringify({currency:chosen,started_at:Date.now()})); } catch {}
          }
        }
        const r = await A.client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: "https://www.f90card.online/" },
        });
        if (r.error)
          throw new Error(
            "تعذّر دخول جوجل. يحتاج الربط إلى تفعيل مزوّد جوجل من الإدارة",
          );
      } else if (action === "quick-product") {
        ev.preventDefault();
        if (!button.dataset.id) return;
        quickProductOpener = button;
        product(button.dataset.id, true);
      } else if (action === "close-quick-product") {
        closeQuickProduct();
      } else if (action === "gallery-switch") {
        const src=C.safeUrl(button.dataset.image);
        const img=button.closest(".product-art")?.querySelector(".f90-checkout-image");
        if(src&&img){img.src=src;button.closest(".f90-product-gallery")?.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===button)))}
      } else if (action === "favorite") {
        const id = button.dataset.id;
        S.favorites = S.favorites.includes(id)
          ? S.favorites.filter((x) => x !== id)
          : [...S.favorites, id];
        try {
          localStorage.setItem("f90-favorites", JSON.stringify(S.favorites));
        } catch {}
        const saved = S.favorites.includes(id);
        document.querySelectorAll('[data-action="favorite"]').forEach((heart) => {
          if (heart.dataset.id !== id) return;
          heart.classList.toggle("is-saved", saved);
          heart.setAttribute("aria-pressed", String(saved));
          heart.setAttribute("aria-label", saved ? "إزالة من المفضلة" : "حفظ بالمفضلة");
          heart.setAttribute("title", saved ? "إزالة من المفضلة" : "حفظ بالمفضلة");
        });
        toast(saved ? "أضيفت للمفضلة" : "أزيلت من المفضلة");
      }
      else if (action === "pause-banner") {
        S.carouselPaused=!S.carouselPaused;
        button.textContent=S.carouselPaused?"▶":"Ⅱ";
        button.setAttribute("aria-pressed",String(S.carouselPaused));
        button.setAttribute("aria-label",S.carouselPaused?"تشغيل تبديل الإعلانات":"إيقاف تبديل الإعلانات");
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
      } else if (action === "key-settings") {
        const k = S.me?.keys?.find((item) => item.id === button.dataset.id);
        if (!k) throw new Error("المفتاح غير موجود");
        S.editKey = k;
        modal("API TOKEN Settings", `<form id="keySettingsForm" class="f90-api-token-form" dir="ltr">
          ${field("name","Token label","text",k.name,'required maxlength="100"')}
          <fieldset><legend>Permissions</legend>
          <label><input type="checkbox" name="scope_catalog" ${k.scopes.includes("catalog")?"checked":""}> Catalog</label>
          <label><input type="checkbox" name="scope_balance" ${k.scopes.includes("balance")?"checked":""}> Wallet balance</label>
          <label><input type="checkbox" name="scope_orders" ${k.scopes.includes("orders")?"checked":""}> Create and track orders</label></fieldset>
          ${field("requests_per_minute","Requests per minute (10–120)","number",k.requests_per_minute,'min="10" max="120" required')}
          ${field("expires_at","Expiration date (optional)","date",k.expires_at?.slice(0,10)||"")}
          <label class="f90-api-allowall"><input type="checkbox" name="allow_all_ips" ${k.allow_all_ips!==false?"checked":""}> Allow all IP addresses (testing only)</label>
          <p class="f90-api-warning">Turn this off after development if your server has a known trusted IP.</p>
          ${field("allowed_ips","Allowed IP addresses (one per line)","textarea",(k.allowed_ips||[]).join("\n"),'rows="3" placeholder="203.0.113.10"')}
          <button class="button" type="submit">Save API token settings</button></form>`);
      } else if (action === "key-logs") {
        const logs = await A.call("key.logs", { id: button.dataset.id });
        modal("API token usage", `<div class="records" dir="ltr">${logs.map((x) => `<article class="record"><strong>${e(x.action)}</strong><span>HTTP ${e(x.http_status)} · ${e(new Date(x.created_at).toLocaleString("en-US"))}</span></article>`).join("") || "<p>No usage recorded yet.</p>"}</div>`);
      } else if (action === "key-revoke") {
        if(!window.confirm("Revoke this API token? Your connected integration will stop working immediately."))return;
        await A.call("key.revoke", { id: button.dataset.id });
        await refreshMe();
        developers();
        toast("API token revoked");
      } else if (action === "report-csv") {
        const kind = S.reportKind === "orders" ? "orders" : S.reportKind === "deposits" ? "deposits" : "ledger";
        let offset = 0, count = Infinity;
        const items = [];
        while (offset < count) {
          const page = await A.call("history", { kind, offset });
          items.push(...(page.items || []));
          count = Number(page.count || 0);
          if (!page.items?.length) break;
          offset += page.items.length;
          if (offset > 100000 && offset < count) throw new Error("السجل كبير جدًا للتصدير مرة واحدة. تواصل مع الإدارة.");
        }
        window.F90Reports.downloadHistoryCSV(kind, items);
        toast("تم تجهيز ملف CSV");
      } else if (action === "report") {
        await window.F90Reports.history(
          S.reportKind,
          S.reportItems,
          S.settings.store_name,
        );
      } else if (action === "order-pdf") {
        await window.F90Reports.order(S.currentOrder, S.settings.store_name,
          orderSummaryFields(S.currentOrder));
      } else if (action === "copy-public-api-guide") {
        await navigator.clipboard.writeText("F90 CARD Merchant API\nEndpoint: " + A.endpoint + "\nDocumentation: " + new URL("./docs/F90_MERCHANT_API_EN.md",location.href).href + "\nHeader: x-f90-key: YOUR_SERVER_SIDE_TOKEN\nDo not include your private API key in this message.");
        toast("تم نسخ معلومات الربط الآمنة للمبرمج");
      } else if (action === "api-jump") {
        const target = document.getElementById(button.dataset.target);
        if (target && main.contains(target)) target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (action === "install-platform") {
        const device=ev.target.closest("[data-platform]")?.dataset.platform;
        if (!["ios","android","windows"].includes(device)) return;
        document.querySelectorAll(".f90-install-platform").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.platform===device)));
        const guide=$("f90InstallGuide");if(guide)guide.textContent=f90InstallHelp(device);
        await f90RequestInstall(device);
      } else if (action === "install") {
        const device=document.querySelector('.f90-install-platform[aria-pressed="true"]')?.dataset.platform || f90InstallDevice();
        await f90RequestInstall(device);
      }
    } catch (err) {
      toast(message(err));
    }
  });
  $("menuButton").innerHTML = I("menu");
  $("drawerClose").innerHTML = I("close");
  $("searchButton").innerHTML = I("search");
  $("storeBell")?.setAttribute("aria-expanded","false");
  $("storeBell")?.setAttribute("aria-haspopup","dialog");
  $("storeBell")?.addEventListener("click",ev=>{ev.preventDefault();toggleBellPanel();});
  document.addEventListener("click",ev=>{
    if(ev.target.closest('[data-action="close-bell-panel"]')){ev.preventDefault();closeBellPanel();return;}
    if(!$("f90BellPanel")?.hidden&&!ev.target.closest("#f90BellPanel")&&!ev.target.closest("#storeBell"))closeBellPanel();
  });
    $("menuButton").addEventListener("click", () => toggleDrawer(true));
  $("drawerClose").addEventListener("click", () => toggleDrawer(false));
  $("drawerBackdrop").addEventListener("click", () => toggleDrawer(false));
  $("themeToggle").addEventListener("click", () => theme(document.documentElement.dataset.theme === "cream" ? "dark" : "cream"));
  $("currencySelect").addEventListener("change", async (ev) => {
    const chosen=String(ev.target.value||"");
    const before=S.me?.profile?.account_currency||S.currency;
    if(!["USD","ILS","JOD"].includes(chosen)){ev.target.value=before;return;}
    if(S.me){
      ev.target.disabled=true;
      try{
        const result=await A.call("profile.currency",{currency:chosen});
        if(result?.currency!==chosen)throw Error("تعذّر حفظ عملة الحساب");
        S.me.profile.account_currency=chosen;
      }catch(error){
        ev.target.value=before;
        toast(message(error)||"تعذّر تغيير عملة الحساب");
        ev.target.disabled=false;return;
      }
      ev.target.disabled=false;
    }
    S.currency=chosen;
    try{localStorage.setItem("f90-currency",chosen)}catch{}
    S.currencyPreference = true;
    chrome();route();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      closeModal();
      closeBellPanel();
      closeQuickProduct();
      if (!$("drawer").hidden) toggleDrawer(false);
    }
    if (ev.key === "Tab") {
      const dialog =
        document.querySelector(".modal") ||
        (!$("drawer").hidden ? $("drawer") : null) ||
        (!$("quickProductPanel")?.hidden ? $("quickProductPanel") : null);
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
    const term = window.F90CatalogSearch?.normalize(ev.target.value) || ev.target.value.trim().toLocaleLowerCase("ar");
    let visible = 0;
    main.querySelectorAll(".image-grid .image-tile, .packs-grid .pack").forEach((tile) => {
      tile.hidden = !!term && !term.split(" ").every(part => (tile.dataset.search || window.F90CatalogSearch?.normalize(tile.textContent) || "").includes(part));
      if (!tile.hidden) visible++;
    });
    $("categoryNoResults")?.toggleAttribute("hidden", visible > 0 || !term);
  });
  // Preserve the previous view when users use browser Back/Forward, while
  // opening new sections at the top. Each history entry carries its scroll offset.
  if(window.history && "scrollRestoration" in window.history)
    window.history.scrollRestoration="manual";
  let f90RouteGeneration=0, f90BrowserTraversal=false;
  function f90ScrollTopNow(){
    const root=document.documentElement;
    root.classList.add("f90-route-jump");
    window.scrollTo({top:0,left:0,behavior:"instant"});
    root.scrollTop=0;
    document.body.scrollTop=0;
  }
  function f90RememberLocation(){
    try{
      window.history.replaceState({...window.history.state,
        f90ScrollY:Math.max(0,window.scrollY||document.documentElement.scrollTop||0),
        f90RouteHash:location.hash||"#/"}, "",location.href);
    }catch{}
  }
  // Welcome exits are real links, not only hash transitions; keep their first landing unobstructed.
  document.addEventListener("click",ev=>{
    if(!ev.target.closest?.("a[data-f90-store-entry]"))return;
    try{sessionStorage.setItem("f90-welcome-entry-uninterrupted","1")}catch{}
  },{capture:true});
  // Record the current page *before* a link changes the hash.
  document.addEventListener("click",ev=>{
    const link=ev.target.closest?.('a[href^="#/"]');
    if(!link||ev.defaultPrevented||ev.button!==0||ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey)return;
    f90RememberLocation();
    const target=link.getAttribute("href");
    if(target===(location.hash||"#/")){
      ev.preventDefault();
      if(!document.querySelector(".modal")&&!document.querySelector(".drawer:not([hidden])"))void route();
    }
  },{capture:true});
  window.addEventListener("pagehide",f90RememberLocation);
  window.addEventListener("popstate",()=>{f90BrowserTraversal=true;});
  document.addEventListener("click",ev=>{
    const link=ev.target.closest?.('a[href^="#"]:not([href^="#/"])');
    if(!link)return;
    const target=document.getElementById(link.getAttribute("href").slice(1));
    if(!target)return;
    ev.preventDefault();
    target.scrollIntoView({behavior:"smooth",block:"start"});
  },{capture:true});
  window.addEventListener("hashchange",async()=>{
    const current=location.href, generation=++f90RouteGeneration;
    const previouslySaved=window.history.state?.f90ScrollY;
    const restore=f90BrowserTraversal&&typeof previouslySaved==="number"&&Number.isFinite(previouslySaved)
      ?Math.max(0,previouslySaved):0;
    f90BrowserTraversal=false;
    f90ScrollTopNow();
    S.offset=0;
    try{await route();}
    finally{
      if(generation===f90RouteGeneration && current===location.href){
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          if(current===location.href){
            window.scrollTo({top:restore,left:0,behavior:"instant"});
            document.documentElement.classList.remove("f90-route-jump");
          }
        }));
      }
    }
  });
  window.addEventListener("beforeinstallprompt", (ev) => {
    ev.preventDefault();
    installPrompt = ev;
    syncInstallButtons();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt=null;
    syncInstallButtons();
  });
  window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change",syncInstallButtons);
    A.client?.auth?.onAuthStateChange?.((event) => {
    if (event === "PASSWORD_RECOVERY")
      setTimeout(() => {
        location.hash = "#/reset";
      }, 0);
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      clearTimeout(authSignOutTimer);
      // Supabase can restore credentials after the initial page render.
      // Defer work outside the auth callback to avoid auth-lock deadlocks.
      clearTimeout(authUiRefreshTimer);
      authUiRefreshTimer = setTimeout(async () => {
        if (!S.settings?.config || !S.settings?.store_name) return;
        try {
          const ok = await refreshMe();
          if (ok) {
            chrome();
            if (location.hash === "#/auth") location.hash = "#/profile";
            else if (document.querySelector(".f90-session-recovery")) await route();
          } else if (S.me) chrome();
        } catch { /* Keep the existing UI on transient errors. */ }
      }, 250);
    }
    if (event === "SIGNED_OUT") {
      clearTimeout(authUiRefreshTimer);
      clearTimeout(authSignOutTimer);
      // Supabase may briefly emit SIGNED_OUT during a failed refresh. Do not
      // redirect a customer away from their deposit form until its session
      // has been checked outside the auth callback's internal lock.
      authSignOutTimer = setTimeout(async () => {
        let result;
        try { result=await A.client.auth.getSession(); }
        catch { S.walletStale=true; return; }
        if(result.error){S.walletStale=true;return;}
        if(result.data?.session){
          try{
            if(await refreshMe()){
              chrome();
              if(document.querySelector(".f90-session-recovery"))await route();
            }
          }catch {/* A failed network read is not a confirmed sign-out. */}
          return;
        }
        S.me = null;
        S.walletStale = false;
        S.savedRecipients = [];
        if (S.settings?.store_name) chrome();
        const currentPage = (location.hash || "#/").split("/")[1] || "";
        const privatePages = ["profile", "recipients", "wallet", "deposit", "orders", "order", "history", "deposits", "security", "verification", "reset"];
        if (privatePages.includes(currentPage) || (location.hash||"").startsWith("#/special/salary")) {
          location.hash = "#/auth";
        } else if (S.settings?.store_name) {
          await route();
        }
      }, 350);
    }
  });
  // Restore stale account details after an offline/mobile background interval.
  // Never refresh while hidden, interrupt an active form, or turn an offline
  // read failure into an explicit logout.
  function recoverVisibleSession() {
    if (document.visibilityState !== "visible" || !S.walletStale || !S.settings?.store_name) return;
    void refreshMe().then(async (ok) => {
      if (!ok) return;
      chrome();
      const page = (location.hash || "#/").split("/")[1] || "";
      if ((["profile","wallet","deposit","orders","history","deposits","verification","developers"].includes(page) ||
          (location.hash||"").startsWith("#/special/salary")) &&
          !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName) &&
          !document.getElementById("depositForm") &&
          !document.getElementById("f90SpecialForm")) {
        await route();
      }
    }).catch(() => { /* Wait for the next connection/recovery event. */ });
  }
  document.addEventListener("visibilitychange", recoverVisibleSession);
  window.addEventListener("online", recoverVisibleSession);

  let bootRetryTimer = null;
  let bootRetryAttempts = 0;
  // Public catalog only: session-scoped warm start speeds repeat visits.
  // Never store wallet balances, auth, order state, or authoritative prices.
  const publicCatalogCacheKey="f90-public-catalog-fast-v1";
  function readWarmCatalog(){
    try{
      const record=JSON.parse(sessionStorage.getItem(publicCatalogCacheKey)||"null");
      if(!record||Date.now()-record.saved>45000 || record.saved>Date.now() ||
         !Array.isArray(record.catalog?.products) ||
         !Array.isArray(record.catalog?.categories) ||
         !record.catalog?.settings?.config) return null;
      return record.catalog;
    }catch{return null;}
  }
  function saveWarmCatalog(catalog){
    if(!Array.isArray(catalog?.products)||!Array.isArray(catalog?.categories)||
       !catalog.settings?.config)return;
    const save=()=>{
      try{
        const json=JSON.stringify({saved:Date.now(),catalog});
        if(json.length<2000000)sessionStorage.setItem(publicCatalogCacheKey,json);
      }catch{/* Browsers may disable session storage. */}
    };
    if("requestIdleCallback" in window)requestIdleCallback(save,{timeout:3000});
    else setTimeout(save,0);
  }
  async function boot() {
    if (bootRetryTimer) { clearTimeout(bootRetryTimer); bootRetryTimer = null; }
    try {
      const warmCatalog=readWarmCatalog();
      const networkCatalog=A.call("catalog");
      const catalogRequest=warmCatalog?Promise.resolve(warmCatalog):networkCatalog;
      if(!warmCatalog)networkCatalog.then(saveWarmCatalog).catch(()=>{});
      const accountRequest = refreshMe().catch((error) => error);
      const partnerLoad=window.F90Partners?.load();
      Object.assign(S, await catalogRequest);
      if(partnerLoad)await partnerLoad;
      if (!S.currencyPreference) S.currency = S.settings.currency || "USD";
      // Render authenticated navigation only after restoring the account.
      // Previously chrome() ran while S.me was still null, leaving the drawer
      // and wallet in guest mode even when a valid session existed.
      // Public pages must render even if Supabase auth session recovery is delayed.
      const recoveryPending=Symbol("auth-recovery-pending");
      const accountResult=await Promise.race([
        accountRequest,
        new Promise(resolve=>setTimeout(()=>resolve(recoveryPending),
          ["profile","wallet","deposit","orders","history","deposits","verification","developers","admin"].includes((location.hash||"#/").split("/")[1]||"") ||
          (location.hash||"").startsWith("#/special/salary")
            ? 3500 : 400))
      ]);
      if(accountResult===recoveryPending){
        S.walletStale=true;
        accountRequest.then(async(result)=>{
          if(result instanceof Error)return;
          try{
            chrome();
            const current=(location.hash||"#/").split("/")[1]||"";
            if(["profile","wallet","deposit","orders","history","deposits","verification","developers"].includes(current) ||
               (location.hash||"").startsWith("#/special/salary"))
              await route();
          }catch(err){console.warn("F90 deferred account refresh",err);}
        }).catch(()=>{});
      }else if(accountResult instanceof Error){
        S.walletStale=true;
        console.warn("F90 account refresh pending");
      }
      chrome();
      window.F90Support?.configure(S.settings.config);
      let initialTheme = S.settings.config.default_theme || "dark";
      try {
        initialTheme = localStorage.getItem("f90-theme") || initialTheme;
      } catch {}
      theme(initialTheme);
      promotions();
      await route();
      if(warmCatalog){
        networkCatalog.then(fresh=>{
          saveWarmCatalog(fresh);
          // Preserve an open quote or a focused user form without re-rendering.
          if(!document.getElementById("checkoutForm") &&
             !document.getElementById("depositForm") &&
             !document.getElementById("modalRoot")?.children.length){
            Object.assign(S,fresh);
          }
        }).catch(()=>{/* Public pages remain usable with the short-lived cache. */});
      }
      document.documentElement.dataset.f90Ready = "1";
      bootRetryAttempts = 0;
      // Receive new supplier price/status news while the store remains open.
      // This is a read-only poll; never modify checkout quotes or local catalog mid-purchase.
      let catalogRefreshBusy = false;
      setInterval(async () => {
        if (document.visibilityState === "hidden" || catalogRefreshBusy ||
            document.getElementById("checkoutForm") ||
            document.getElementById("depositForm")) return;
        catalogRefreshBusy = true;
        try {
          const latest = await A.call("catalog");
          if (!Array.isArray(latest?.news)) return;
          S.news = latest.news;
          const previousRates = JSON.stringify(S.rates.map(r => [r.currency,r.per_usd,r.is_enabled,r.name_ar]));
          const incomingRates = JSON.stringify((latest.rates||[]).map(r => [r.currency,r.per_usd,r.is_enabled,r.name_ar]));
          const oldDefaultCurrency = S.settings?.currency;
          if (Array.isArray(latest.rates)) S.rates = latest.rates;
          if (latest.settings) S.settings = latest.settings;
          const validCurrency = S.rates.some(r => r.currency === S.currency && r.is_enabled && Number(r.per_usd)>0);
          if (!S.currencyPreference || !validCurrency)
            S.currency = S.settings.currency || "USD";
          const displayCurrencyChanged = previousRates !== incomingRates || oldDefaultCurrency !== S.settings.currency || !validCurrency;
          // Keep refreshed availability in memory; do not interrupt an open purchase.
          const buying = !!document.getElementById("checkoutForm") || !!document.getElementById("depositForm") || !!document.getElementById("modalRoot")?.children.length;
          if (!buying && Array.isArray(latest.products) && Array.isArray(latest.categories)) {
            const snapshot = (products, categories) => JSON.stringify({
              products: products.map(p => [p.id,p.is_active,p.stock,p.price,p.currency,p.image_url,p.category_id,p.commerce?.availability]),
              categories: categories.map(c => [c.id,c.is_active,c.parent_id,c.sort_order,c.presentation?.availability])
            });
            const previous = snapshot(S.products, S.categories);
            const incoming = snapshot(latest.products, latest.categories);
            S.products = latest.products;
            S.categories = latest.categories;
            // Only repaint browse pages when the supplier-facing catalog actually changed.
            // Never interrupt an active modal, a focused input, or a checkout.
            const page = (location.hash || "#/").split("/")[1] || "";
            if (previous !== incoming && ["", "category", "favorites", "search"].includes(page)
                && !document.getElementById("modalRoot")?.children.length
                && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) {
              const oldScroll = window.scrollY;
              await route();
              window.scrollTo({ top: oldScroll, behavior: "instant" });
            }
          }
          if (displayCurrencyChanged && !buying && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) {
            const oldScroll = window.scrollY;
            chrome();
            await route();
            window.scrollTo({ top: oldScroll, behavior: "instant" });
          }
          updateStoreBell();
        } catch {
          // Keep previous news and continue normal browsing if offline.
        } finally {
          catalogRefreshBusy = false;
        }
      }, 360000);
      // On the newly connected domain first-time storage is empty. Do not overlay welcome
      // or interrupt its immediate store-entry transition with promotion dialogs.
      let justEnteredFromWelcome=false;
      try{
        justEnteredFromWelcome=sessionStorage.getItem("f90-welcome-entry-uninterrupted")==="1";
        sessionStorage.removeItem("f90-welcome-entry-uninterrupted");
      }catch{}
      const initialPage=(location.hash||"#/welcome").split("/")[1]||"";
      const mayShowLaunchPromotion=initialPage!=="welcome"&&!justEnteredFromWelcome;
      const channel = String(S.settings.config?.whatsapp_channel_url || "").trim();
      const channelValid = /^https:\/\/whatsapp\.com\/channel\/[a-zA-Z0-9]+\/?(?:\?.*)?$/.test(channel);
      const channelKey = "f90-channel-invite:" + channel;
      let channelSeen = false;
      try { channelSeen = localStorage.getItem(channelKey) === "1"; } catch {}
      // Never replace an already-open announcement or a customer form.
      if (mayShowLaunchPromotion && channelValid && S.settings.config?.whatsapp_channel_popup !== false &&
          !channelSeen && !$("modalRoot")?.children.length &&
          !document.getElementById("checkoutForm") && !document.getElementById("depositForm")) {
        modal("تابع قناة F90 CARD على واتساب",
          `<div class="f90-channel-invite"><span class="f90-channel-mark" aria-hidden="true">◉</span><p>انضم إلى قناتنا الرسمية لمتابعة الإعلانات والعروض والتحديثات المهمة.</p><p class="muted small">ننصح بالانضمام حتى تصلك المستجدات. يمكنك استخدام المتجر دون الاشتراك.</p><a class="button full" href="${e(channel)}" target="_blank" rel="noopener noreferrer">الانتقال إلى قناة واتساب</a><button class="button ghost full" data-action="channel-dismiss" data-key="${e(channelKey)}">متابعة التصفح</button></div>`);
      } else {
      const popup = S.settings.config?.popup_announcement;
      if (mayShowLaunchPromotion && popup?.enabled && popup.text_ar && !popup.every_home_visit) {
        const key = "f90-popup-read:" + (popup.revision || popup.text_ar);
        let read = false;
        try { read = localStorage.getItem(key) === "1"; } catch {}
        if (!read && !$("modalRoot")?.children.length) {
          modal("تنبيه من أف تسعين كارد",
            `<p class="f90-popup-copy">${e(popup.text_ar)}</p><button class="button" data-action="popup-read" data-key="${e(key)}">قرأت التنبيه</button>`);
        }
      }
      }
      if ("serviceWorker" in navigator)
        navigator.serviceWorker.register("./sw.js").catch(() => {});
    } catch (err) {
      // A read-only emergency catalog may already be visible. Do not hide it.
      if (!window.F90StartupRescue?.hasShown) {
        const requestedPage=(location.hash||"#/").split("/")[1]||"";
        if(requestedPage==="auth"||requestedPage==="register"){
          // Sign-in and sign-up use Supabase Auth directly. A temporary
          // public catalog failure must not remove their forms.
          auth(requestedPage==="register"?"register":"login");
          main.insertAdjacentHTML("afterbegin",
            '<div class="notice warning">تعذّر جلب المنتجات مؤقتًا؛ يمكنك تسجيل الدخول، ثم إعادة تحميل المتجر.</div>');
        }else{
          main.innerHTML =
            pageHead("جارٍ استعادة الاتصال بالخادم") +
            `<div class="notice error">${e(message(err))}</div><div class="actions"><button class="button" id="bootRetry">إعادة المحاولة الآن</button><a class="button secondary" href="#/auth">تسجيل الدخول</a></div>`;
          $("bootRetry")?.addEventListener("click", boot);
        }
      }
      if (bootRetryAttempts < 3) {
        const delay = [3000, 7000, 15000][bootRetryAttempts++];
        bootRetryTimer = setTimeout(() => {
          if (document.documentElement.dataset.f90Ready !== "1" && document.visibilityState !== "hidden") {
            boot().catch(() => {});
          }
        }, delay);
      }
    }
  }
  boot();
})();

