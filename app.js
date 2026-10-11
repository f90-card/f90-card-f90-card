"use strict";

(() => {
  const db = window.f90Supabase;

  const $ = (id) => document.getElementById(id);

  const state = {
    products: [],
    categories: [],
    banners: [],
    cart: new Map(),
    user: null,
    currency: "ILS",
    search: ""
  };

  const money = (amount) =>
    new Intl.NumberFormat("ar", {
      style: "currency",
      currency: state.currency
    }).format(Number(amount) || 0);

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const safeImage = (url) => {
    try {
      const parsed = new URL(url, location.href);
      return ["https:", "http:"].includes(parsed.protocol)
        ? parsed.href
        : "";
    } catch {
      return "";
    }
  };

  function message(text, type = "") {
    const toast = $("toast");
    if (!toast) return;

    toast.textContent = text;
    toast.className = `toast ${type}`;

    clearTimeout(message.timer);
    message.timer = setTimeout(() => {
      toast.textContent = "";
      toast.className = "toast";
    }, 3500);
  }

  function showLoading(container, text) {
    if (container) {
      container.innerHTML =
        `<p class="loading">${escapeHTML(text)}</p>`;
    }
  }

  function showError(container, text) {
    if (container) {
      container.innerHTML =
        `<p class="error-state">${escapeHTML(text)}</p>`;
    }
  }

  async function loadSettings() {
    const { data, error } = await db
      .from("site_settings")
      .select("store_name,currency,announcement")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Settings error:", error.message);
      return;
    }

    if (!data) return;

    state.currency = data.currency || "ILS";

    if (data.store_name) {
      document.title = `${data.store_name} | متجرك الرقمي`;
    }

    const announcement = data.announcement?.trim();

    if (announcement) {
      let bar = document.getElementById("announcementBar");

      if (!bar) {
        bar = document.createElement("div");
        bar.id = "announcementBar";
        bar.className = "announcement-bar";

        document.querySelector(".header")?.before(bar);
      }

      if (bar) {
        bar.textContent = announcement;
      }
    }

    const year = $("year");
    if (year) year.textContent = new Date().getFullYear();
  }

  async function loadCategories() {
    const container = $("categoryGrid");
    if (!container) return;

    showLoading(container, "جاري تحميل التصنيفات...");

    const { data, error } = await db
      .from("categories")
      .select("id,name,slug,description,image_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Categories error:", error.message);
      showError(container, "تعذّر تحميل التصنيفات.");
      return;
    }

    state.categories = data || [];

    if (!state.categories.length) {
      container.innerHTML =
        '<p class="empty-state">لا توجد تصنيفات حاليًا.</p>';
      return;
    }

    container.innerHTML = state.categories.map((category) => {
      const image = safeImage(category.image_url);

      return `
        <button
          class="category-card"
          type="button"
          data-category="${escapeHTML(category.id)}"
        >
          ${
            image
              ? `<img src="${escapeHTML(image)}"
                   alt="${escapeHTML(category.name)}"
                   loading="lazy">`
              : ""
          }
          <h3>${escapeHTML(category.name)}</h3>
        </button>
      `;
    }).join("");
  }

  async function loadProducts() {
    const container = $("productGrid");
    if (!container) return;

    showLoading(container, "جاري تحميل المنتجات...");

    const { data, error } = await db
      .from("products")
      .select(`
        id,name,slug,description,price,currency,
        image_url,category_id,stock,is_featured
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Products error:", error.message);
      showError(container, "تعذّر تحميل المنتجات.");
      return;
    }

    state.products = data || [];
    renderProducts();
  }

  function renderProducts(categoryId = "") {
    const container = $("productGrid");
    if (!container) return;

    const filtered = state.products.filter((product) => {
      const matchesSearch =
        `${product.name} ${product.description || ""}`
          .toLowerCase()
          .includes(state.search.toLowerCase());

      const matchesCategory =
        !categoryId || product.category_id === categoryId;

      return matchesSearch && matchesCategory;
    });

    if (!filtered.length) {
      container.innerHTML =
        '<p class="empty-state">لا توجد منتجات مطابقة حاليًا.</p>';
      return;
    }

    container.innerHTML = filtered.map((product) => {
      const image = safeImage(product.image_url);
      const category = state.categories.find(
        (item) => item.id === product.category_id
      );

      const outOfStock =
        product.stock !== null &&
        Number(product.stock) <= 0;

      return `
        <article class="product-card">
          ${
            image
              ? `<img class="product-image"
                   src="${escapeHTML(image)}"
                   alt="${escapeHTML(product.name)}"
                   loading="lazy">`
              : '<div class="product-image">F90 CARD</div>'
          }

          <div class="product-info">
            ${
              category
                ? `<span class="product-category">
                     ${escapeHTML(category.name)}
                   </span>`
                : ""
            }

            ${
              product.is_featured
                ? '<span class="badge">منتج مميز</span>'
                : ""
            }

            <h3 class="product-title">
              ${escapeHTML(product.name)}
            </h3>

            <p class="product-description">
              ${escapeHTML(product.description)}
            </p>

            <div class="product-price">
              ${money(product.price)}
            </div>

            <div class="product-footer">
              <button
                class="button primary"
                type="button"
                data-add="${escapeHTML(product.id)}"
                ${outOfStock ? "disabled" : ""}
              >
                ${outOfStock ? "غير متوفر" : "أضف للسلة"}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadBanners() {
    const container = $("bannerGrid");
    if (!container) return;

    const { data, error } = await db
      .from("banners")
      .select("id,title,subtitle,image_url,link_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Banners error:", error.message);
      return;
    }

    state.banners = data || [];

    container.innerHTML = state.banners.map((banner) => {
      const image = safeImage(banner.image_url);
      const link = safeImage(banner.link_url);

      const content = `
        ${image
          ? `<img src="${escapeHTML(image)}"
               alt="${escapeHTML(banner.title)}"
               loading="lazy">`
          : ""
        }
        <div class="banner-content">
          <h3>${escapeHTML(banner.title)}</h3>
          <p>${escapeHTML(banner.subtitle)}</p>
        </div>
      `;

      return link
        ? `<a class="banner-card"
             href="${escapeHTML(link)}"
             target="_blank"
             rel="noopener noreferrer">${content}</a>`
        : `<div class="banner-card">${content}</div>`;
    }).join("");
  }

  function renderCart() {
    const count = $("cartCount");
    const container = $("cartItems");
    const totalElement = $("cartTotal");

    let total = 0;
    let quantity = 0;

    for (const [id, amount] of state.cart) {
      const product = state.products.find((p) => p.id === id);

      if (!product) {
        state.cart.delete(id);
        continue;
      }

      total += Number(product.price) * amount;
      quantity += amount;
    }

    if (count) count.textContent = String(quantity);

    if (container) {
      const entries = [...state.cart.entries()]
        .filter(([id]) => state.products.some((p) => p.id === id));

      container.innerHTML = entries.length
        ? entries.map(([id, amount]) => {
            const product = state.products.find((p) => p.id === id);

            return `
              <div class="cart-item">
                <div>
                  <strong>${escapeHTML(product.name)}</strong>
                  <p>${money(product.price)}</p>
                </div>

                <div class="cart-quantity">
                  <button type="button"
                    data-quantity="${escapeHTML(id)}"
                    data-delta="-1">−</button>

                  <span>${amount}</span>

                  <button type="button"
                    data-quantity="${escapeHTML(id)}"
                    data-delta="1">+</button>
                </div>

                <button type="button"
                  class="cart-remove"
                  data-remove="${escapeHTML(id)}">حذف</button>
              </div>
            `;
          }).join("")
        : '<p class="empty-state">السلة فارغة.</p>';
    }

    if (totalElement) {
      totalElement.textContent = `المجموع: ${money(total)}`;
    }
  }

  function addToCart(id) {
    const product = state.products.find((p) => p.id === id);

    if (!product) return;

    if (
      product.stock !== null &&
      Number(product.stock) <= 0
    ) {
      message("هذا المنتج غير متوفر حاليًا.", "error");
      return;
    }

    const current = state.cart.get(id) || 0;

    if (
      product.stock !== null &&
      current >= Number(product.stock)
    ) {
      message("وصلت إلى الكمية المتوفرة.", "error");
      return;
    }

    state.cart.set(id, current + 1);
    renderCart();
    message("تمت إضافة المنتج إلى السلة.", "success");
  }

  async function refreshUser() {
    const { data, error } = await db.auth.getUser();

    if (error) {
      console.error("Auth error:", error.message);
    }

    state.user = data?.user || null;

    const logout = $("logoutButton");
    const login = $("loginButton");
    const signup = $("signupButton");

    if (logout) logout.hidden = !state.user;
    if (login) login.hidden = !!state.user;
    if (signup) signup.hidden = !!state.user;
  }

  async function handleAuth(event) {
    event.preventDefault();

    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    const output = $("authMessage");

    if (output) output.textContent = "جاري المعالجة...";

    const { error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (output) {
        output.textContent = "تعذّر تسجيل الدخول. تحقق من بياناتك.";
      }
      return;
    }

    if (output) output.textContent = "تم تسجيل الدخول بنجاح.";
    await refreshUser();

    message("أهلًا بك في F90 CARD.", "success");
  }

  async function handleSignup() {
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    const output = $("authMessage");

    if (!email || password.length < 8) {
      if (output) {
        output.textContent =
          "أدخل بريدًا إلكترونيًا وكلمة مرور من 8 أحرف على الأقل.";
      }
      return;
    }

    if (output) output.textContent = "جاري إنشاء الحساب...";

    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: location.href
      }
    });

    if (error) {
      if (output) output.textContent = "تعذّر إنشاء الحساب.";
      return;
    }

    if (output) {
      output.textContent = data.session
        ? "تم إنشاء الحساب بنجاح."
        : "تحقق من بريدك الإلكتروني لإكمال التسجيل.";
    }

    await refreshUser();
  }

  function bindEvents() {
    $("searchInput")?.addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      renderProducts();
    });

    $("categoryGrid")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;

      renderProducts(button.dataset.category);

      $("products")?.scrollIntoView({
        behavior: "smooth"
      });
    });

    $("productGrid")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-add]");
      if (button) addToCart(button.dataset.add);
    });

    $("cartItems")?.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove]");

      if (remove) {
        state.cart.delete(remove.dataset.remove);
        renderCart();
        return;
      }

      const quantityButton = event.target.closest("[data-quantity]");
      if (!quantityButton) return;

      const id = quantityButton.dataset.quantity;
      const delta = Number(quantityButton.dataset.delta);
      const product = state.products.find((p) => p.id === id);
      const current = state.cart.get(id) || 0;
      const next = current + delta;

      if (next <= 0) {
        state.cart.delete(id);
      } else if (
        product?.stock === null ||
        product?.stock === undefined ||
        next <= Number(product.stock)
      ) {
        state.cart.set(id, next);
      } else {
        message("الكمية المطلوبة غير متوفرة.", "error");
      }

      renderCart();
    });

    $("cartButton")?.addEventListener("click", () => {
      $("cartDialog")?.showModal();
    });

    $("accountButton")?.addEventListener("click", () => {
      $("accountDialog")?.showModal();
    });

    $("authForm")?.addEventListener("submit", handleAuth);

    $("googleLoginButton")?.addEventListener("click", async () => {
      const output = $("authMessage");
      const button = $("googleLoginButton");

      try {
      if (!db) {
      throw new Error("اتصال Supabase غير جاهز.");
    }

      button.disabled = true;
      if (output) output.textContent = "جارٍ فتح تسجيل الدخول باستخدام Google...";

      const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: {
      redirectTo: window.location.origin + window.location.pathname
    }
    });

      if (error) throw error;

    } catch (error) {
      if (output) {
      output.textContent = "تعذّر تسجيل الدخول: " + error.message;
    }

      button.disabled = false;

    }
    });

    $("signupButton")?.addEventListener("click", handleSignup);

    $("logoutButton")?.addEventListener("click", async () => {
      const { error } = await db.auth.signOut();

      if (error) {
        message("تعذّر تسجيل الخروج.", "error");
        return;
      }

      await refreshUser();
      message("تم تسجيل الخروج.", "success");
    });

    db.auth.onAuthStateChange((event, session) => {
      state.user = session?.user || null;
    });
  }

  async function init() {
    if (!db) {
      message("اتصال Supabase غير مهيأ. راجع ملف config.js.", "error");
      showError($("productGrid"), "يرجى إعداد اتصال قاعدة البيانات.");
      showError($("categoryGrid"), "يرجى إعداد اتصال قاعدة البيانات.");
      return;
    }

    bindEvents();

    await Promise.all([
      loadSettings(),
      loadCategories(),
      loadProducts(),
      loadBanners(),
      refreshUser()
    ]);

    renderCart();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
