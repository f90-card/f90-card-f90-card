(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const config = window.F90_CONFIG;
  const sdk = window.supabase;

  if (
    !config ||
    !config.SUPABASE_URL ||
    !config.SUPABASE_KEY ||
    config.SUPABASE_URL.includes("_هنا") ||
    config.SUPABASE_KEY.includes("_هنا") ||
    !sdk
  ) {
    document.addEventListener("DOMContentLoaded", () => {
      const message = $("loginMessage");
      if (message) {
        message.textContent =
          "إعدادات Supabase غير مكتملة. راجع ملف config.js.";
      }
    });
    return;
  }

  const db = sdk.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_KEY
  );

  const BUCKET = "f90-images";
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  let categoriesCache = [];

  function status(message, type = "info") {
    const el = $("statusMessage");
    if (!el) return;

    el.textContent = message;
    el.className = `status-message show ${type}`;
  }

  function loginStatus(message) {
    const el = $("loginMessage");
    if (el) el.textContent = message;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}-]/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function requireAdmin() {
    const { data: sessionData, error: sessionError } =
      await db.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData.session?.user;
    if (!user) return false;

    const { data: role, error } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (role?.role !== "admin") {
      await db.auth.signOut();
      throw new Error("هذا الحساب ليس لديه صلاحية مدير.");
    }

    return true;
  }

  function showDashboard(visible) {
    $("loginSection").hidden = visible;
    $("dashboard").hidden = !visible;
    $("logoutButton").hidden = !visible;
  }

  function resetForm(formId) {
    $(formId)?.reset();

    const hiddenId = {
      productForm: "productId",
      categoryForm: "categoryId",
      bannerForm: "bannerId"
    }[formId];

    if (hiddenId) $(hiddenId).value = "";

    if (formId === "productForm") {
      $("productActive").checked = true;
      $("productFeatured").checked = false;
    }

    if (formId === "categoryForm") {
      $("categoryActive").checked = true;
    }

    if (formId === "bannerForm") {
      $("bannerActive").checked = false;
    }
  }

  async function uploadImage(file, folder) {
    if (!file) return null;

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("نوع الصورة غير مسموح.");
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error("حجم الصورة يتجاوز 5 ميغابايت.");
    }

    const extension = ({
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    })[file.type];

    const path =
      `${folder}/${crypto.randomUUID()}.${extension}`;

    const { data, error } = await db.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false
      });

    if (error) throw error;

    const { data: urlData } = db.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  function renderItems(containerId, items, type) {
    const container = $(containerId);

    if (!items.length) {
      container.textContent = "لا توجد بيانات لعرضها.";
      return;
    }

    container.replaceChildren();

    const list = document.createElement("div");
    list.className = "admin-list";

    for (const item of items) {
      const row = document.createElement("article");
      row.className = "admin-item";

      const image = document.createElement("img");
      image.alt = "";
      image.src = item.image_url || "";
      image.hidden = !item.image_url;

      const info = document.createElement("div");
      info.className = "admin-item-info";

      const title = document.createElement("h3");
      title.textContent =
        item.name || item.title || "بدون عنوان";

      const details = document.createElement("p");

      if (type === "products") {
        details.textContent =
          `السعر: ${item.price} ${item.currency}` +
          ` — ${item.is_active ? "منشور" : "مسودة"}`;
      } else {
        details.textContent =
          item.is_active ? "نشط" : "غير نشط";
      }

      info.append(title, details);

      const actions = document.createElement("div");
      actions.className = "admin-item-actions";

      const edit = document.createElement("button");
      edit.className = "btn btn-secondary";
      edit.textContent = "تعديل";
      edit.addEventListener("click", () => editItem(type, item));

      const remove = document.createElement("button");
      remove.className = "btn btn-danger";
      remove.textContent = "حذف";
      remove.addEventListener("click", () => deleteItem(type, item));

      actions.append(edit, remove);
      row.append(image, info, actions);
      list.append(row);
    }

    container.append(list);
  }

  async function loadProducts() {
    const { data, error } = await db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderItems("productList", data || [], "products");
  }

  async function loadCategories() {
    const { data, error } = await db
      .from("categories")
      .select("*")
      .order("sort_order");

    if (error) throw error;

    categoriesCache = data || [];

    const select = $("productCategory");
    select.replaceChildren(new Option("بدون تصنيف", ""));

    for (const category of categoriesCache) {
      select.add(new Option(category.name, category.id));
    }

    renderItems("categoryList", categoriesCache, "categories");
  }

  async function loadBanners() {
    const { data, error } = await db
      .from("banners")
      .select("*")
      .order("sort_order");

    if (error) throw error;

    renderItems("bannerList", data || [], "banners");
  }

  async function loadSettings() {
    const { data, error } = await db
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    $("storeName").value = data?.store_name || "F90 CARD";
    $("storeColor").value = data?.primary_color || "#2563eb";
    $("storeCurrency").value = data?.currency || "ILS";
    $("storeAnnouncement").value = data?.announcement || "";
    $("storeEmail").value = data?.contact_email || "";
  }

  async function refreshAll() {
    status("جارٍ تحميل بيانات المتجر...");

    try {
      await Promise.all([
        loadProducts(),
        loadCategories(),
        loadBanners(),
        loadSettings()
      ]);

      status("تم تحميل بيانات المتجر بنجاح.", "success");
    } catch (error) {
      status(`تعذّر تحميل البيانات: ${error.message}`, "error");
    }
  }

  function editItem(type, item) {
    if (type === "products") {
      $("productId").value = item.id;
      $("productName").value = item.name || "";
      $("productSlug").value = item.slug || "";
      $("productDescription").value = item.description || "";
      $("productPrice").value = item.price ?? 0;
      $("productCurrency").value = item.currency || "ILS";
      $("productCategory").value = item.category_id || "";
      $("productStock").value = item.stock ?? "";
      $("productActive").checked = !!item.is_active;
      $("productFeatured").checked = !!item.is_featured;
      status("عدّل بيانات المنتج ثم اضغط حفظ المنتج.");
    }

    if (type === "categories") {
      $("categoryId").value = item.id;
      $("categoryName").value = item.name || "";
      $("categorySlug").value = item.slug || "";
      $("categoryDescription").value = item.description || "";
      $("categoryActive").checked = !!item.is_active;
      status("عدّل بيانات التصنيف ثم اضغط حفظ التصنيف.");
    }

    if (type === "banners") {
      $("bannerId").value = item.id;
      $("bannerTitle").value = item.title || "";
      $("bannerSubtitle").value = item.subtitle || "";
      $("bannerLink").value = item.link_url || "";
      $("bannerActive").checked = !!item.is_active;
      status("عدّل بيانات الإعلان ثم اضغط حفظ الإعلان.");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteItem(type, item) {
    if (!confirm("هل أنت متأكد من حذف هذا العنصر؟")) return;

    const table = type === "products"
      ? "products"
      : type === "categories"
        ? "categories"
        : "banners";

    try {
      const { error } = await db
        .from(table)
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      status("تم الحذف بنجاح.", "success");
      await refreshAll();
    } catch (error) {
      status(`فشل الحذف: ${error.message}`, "error");
    }
  }

  async function saveProduct(event) {
    event.preventDefault();

    try {
      await requireAdmin();

      const id = $("productId").value;
      const file = $("productImage").files[0];

      let imageUrl = null;

      if (file) {
        imageUrl = await uploadImage(file, "products");
      } else if (id) {
        const { data, error } = await db
          .from("products")
          .select("image_url")
          .eq("id", id)
          .single();

        if (error) throw error;
        imageUrl = data.image_url;
      }

      const stockText = $("productStock").value;

      const payload = {
        name: $("productName").value.trim(),
        slug: slugify($("productSlug").value),
        description: $("productDescription").value.trim(),
        price: Number($("productPrice").value),
        currency: $("productCurrency").value,
        category_id: $("productCategory").value || null,
        stock: stockText === "" ? null : Number(stockText),
        is_active: $("productActive").checked,
        is_featured: $("productFeatured").checked
      };

      if (imageUrl) payload.image_url = imageUrl;

      if (id) {
        payload.updated_at = new Date().toISOString();

        const { error } = await db
          .from("products")
          .update(payload)
          .eq("id", id);

        if (error) throw error;
      } else {
        const { error } = await db
          .from("products")
          .insert(payload);

        if (error) throw error;
      }

      resetForm("productForm");
      status("تم حفظ المنتج.", "success");
      await refreshAll();
    } catch (error) {
      status(`تعذّر حفظ المنتج: ${error.message}`, "error");
    }
  }

  async function saveCategory(event) {
    event.preventDefault();

    try {
      await requireAdmin();

      const id = $("categoryId").value;
      const file = $("categoryImage").files[0];

      let imageUrl = null;

      if (file) {
        imageUrl = await uploadImage(file, "categories");
      } else if (id) {
        const { data, error } = await db
          .from("categories")
          .select("image_url")
          .eq("id", id)
          .single();

        if (error) throw error;
        imageUrl = data.image_url;
      }

      const payload = {
        name: $("categoryName").value.trim(),
        slug: slugify($("categorySlug").value),
        description: $("categoryDescription").value.trim(),
        is_active: $("categoryActive").checked
      };

      if (imageUrl) payload.image_url = imageUrl;

      const result = id
        ? await db.from("categories").update(payload).eq("id", id)
        : await db.from("categories").insert(payload);

      if (result.error) throw result.error;

      resetForm("categoryForm");
      status("تم حفظ التصنيف.", "success");
      await refreshAll();
    } catch (error) {
      status(`تعذّر حفظ التصنيف: ${error.message}`, "error");
    }
  }

  async function saveBanner(event) {
    event.preventDefault();

    try {
      await requireAdmin();

      const id = $("bannerId").value;
      const file = $("bannerImage").files[0];

      let imageUrl = null;

      if (file) {
        imageUrl = await uploadImage(file, "banners");
      } else if (id) {
        const { data, error } = await db
          .from("banners")
          .select("image_url")
          .eq("id", id)
          .single();

        if (error) throw error;
        imageUrl = data.image_url;
      }

      const payload = {
        title: $("bannerTitle").value.trim(),
        subtitle: $("bannerSubtitle").value.trim(),
        link_url: $("bannerLink").value.trim() || null,
        is_active: $("bannerActive").checked
      };

      if (imageUrl) payload.image_url = imageUrl;

      const result = id
        ? await db.from("banners").update(payload).eq("id", id)
        : await db.from("banners").insert(payload);

      if (result.error) throw result.error;

      resetForm("bannerForm");
      status("تم حفظ الإعلان.", "success");
      await refreshAll();
    } catch (error) {
      status(`تعذّر حفظ الإعلان: ${error.message}`, "error");
    }
  }

  async function saveSettings(event) {
    event.preventDefault();

    try {
      await requireAdmin();

      const file = $("storeLogo").files[0];

      let logoUrl = null;

      if (file) {
        logoUrl = await uploadImage(file, "branding");
      } else {
        const { data, error } = await db
          .from("site_settings")
          .select("logo_url")
          .eq("id", 1)
          .single();

        if (error) throw error;
        logoUrl = data.logo_url;
      }

      const payload = {
        store_name: $("storeName").value.trim(),
        primary_color: $("storeColor").value,
        currency: $("storeCurrency").value,
        announcement: $("storeAnnouncement").value.trim(),
        contact_email: $("storeEmail").value.trim() || null,
        updated_at: new Date().toISOString()
      };

      if (logoUrl) payload.logo_url = logoUrl;

      const { error } = await db
        .from("site_settings")
        .update(payload)
        .eq("id", 1);

      if (error) throw error;

      status("تم حفظ إعدادات المتجر.", "success");
      await loadSettings();
    } catch (error) {
      status(`تعذّر حفظ الإعدادات: ${error.message}`, "error");
    }
  }

  function activateTab(tabId) {
    document.querySelectorAll(".admin-tab").forEach((tab) => {
      tab.hidden = tab.id !== tabId;
    });

    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tabId);
    });
  }

  async function login(event) {
    event.preventDefault();
    loginStatus("جارٍ تسجيل الدخول...");

    try {
      const { error } = await db.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value
      });

      if (error) throw error;

      const authorized = await requireAdmin();

      if (!authorized) {
        throw new Error("يرجى تسجيل الدخول أولًا.");
      }

      showDashboard(true);
      loginStatus("");
      await refreshAll();
    } catch (error) {
      showDashboard(false);
      loginStatus(`تعذّر الدخول: ${error.message}`);
    }
  }

  async function logout() {
    await db.auth.signOut();
    showDashboard(false);
    loginStatus("تم تسجيل الخروج.");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    $("loginForm").addEventListener("submit", login);
    $("logoutButton").addEventListener("click", logout);
    $("productForm").addEventListener("submit", saveProduct);
    $("categoryForm").addEventListener("submit", saveCategory);
    $("bannerForm").addEventListener("submit", saveBanner);
    $("settingsForm").addEventListener("submit", saveSettings);

    $("cancelProduct").addEventListener("click", () => {
      resetForm("productForm");
    });

    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        activateTab(button.dataset.tab);
      });
    });

    document.querySelectorAll('form').forEach((form) => {
      form.addEventListener("input", () => {
        // No-op: prevents accidental implicit submission changes.
      });
    });

    showDashboard(false);

    try {
      if (await requireAdmin()) {
        showDashboard(true);
        await refreshAll();
      }
    } catch (error) {
      console.warn("Admin initialization:", error.message);
    }
  });
})();
