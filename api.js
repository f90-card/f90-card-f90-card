(function () {
  "use strict";
  const client = window.f90Supabase;
  const endpoint =
    window.F90_CONFIG.SUPABASE_URL + "/functions/v1/f90-platform";
  async function call(action, data = {}) {
    // Public catalog never needs a session. Avoid blocking first paint on auth storage.
    const { data: { session } } = action === "catalog" || action === "health"
      ? { data: { session: null } }
      : await client.auth.getSession();
    const headers = {
      "Content-Type": "application/json",
      apikey: window.F90_CONFIG.SUPABASE_KEY,
    };
    if (session) headers.Authorization = "Bearer " + session.access_token;
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ action, ...data }),
        cache: "no-store",
      });
    } catch {
      // The server may have committed a payment before the connection failed.
      const err = new Error("انقطع الاتصال قبل تأكيد نتيجة العملية");
      err.uncertain = true;
      throw err;
    }
    let body;
    try {
      body = await response.json();
    } catch {
      const err = new Error("تعذّر قراءة رد الخادم");
      // A successful or server-error response without valid JSON is ambiguous.
      err.uncertain = response.ok || response.status >= 500;
      throw err;
    }
    if (!response.ok || body.error) {
      const err = new Error(body.error?.message || "تعذّر إكمال العملية");
      err.code = body.error?.code;
      err.status = response.status;
      err.uncertain = response.status >= 500;
      throw err;
    }
    return body.data;
  }
  async function upload(file, bucket, folder) {
    const video = bucket === "f90-videos";
    if (!file || file.size > (video ? 20971520 : 5242880))
      throw new Error(video ? "اختر فيديو MP4 أو WebM لا يتجاوز ٢٠ ميجابايت" : "اختر صورة لا تتجاوز ٥ ميجابايت");
    const types = [
      "image/jpeg",
      "image/png",
      "image/webp",
      ...(bucket === "f90-images" || bucket === "f90-avatars"
        ? ["image/gif"] : []),
      ...(video ? ["video/mp4","video/webm"] : []),
    ];
    if (!types.includes(file.type)) throw new Error(video ? "صيغة الفيديو غير مدعومة" : "اختر صورة بصيغة مدعومة");
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error("سجّل الدخول أولًا");
    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "video/mp4": "mp4",
      "video/webm": "webm",
    }[file.type];
    const path =
      (bucket === "f90-images" || bucket === "f90-videos" ? folder || "catalog" : user.id) +
      "/" +
      crypto.randomUUID() +
      "." +
      extension;
    const { error } = await client.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error)
      throw new Error(video ? "تعذّر رفع الفيديو. تحقق من الصلاحيات وحجم الملف وحاول مجددًا" : "تعذّر رفع الصورة. تحقق من الصلاحيات وحاول مجددًا");
    return {
      path,
      url: client.storage.from(bucket).getPublicUrl(path).data.publicUrl,
    };
  }
  window.F90API = { call, upload, endpoint, client };
})();
