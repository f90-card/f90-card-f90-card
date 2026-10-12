(function () {
  "use strict";
  const client = window.f90Supabase;
  const endpoint =
    window.F90_CONFIG.SUPABASE_URL + "/functions/v1/f90-platform";
  async function call(action, data = {}) {
    const {
      data: { session },
    } = await client.auth.getSession();
    const headers = {
      "Content-Type": "application/json",
      apikey: window.F90_CONFIG.SUPABASE_KEY,
    };
    if (session) headers.Authorization = "Bearer " + session.access_token;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...data }),
      cache: "no-store",
    });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("تعذّر الاتصال بالخدمة. حاول مجددًا");
    }
    if (!response.ok || body.error) {
      const err = new Error(body.error?.message || "تعذّر إكمال العملية");
      err.code = body.error?.code;
      throw err;
    }
    return body.data;
  }
  async function upload(file, bucket, folder) {
    if (!file || file.size > 5242880)
      throw new Error("اختر صورة لا تتجاوز ٥ ميجابايت");
    const types = [
      "image/jpeg",
      "image/png",
      "image/webp",
      ...(bucket === "f90-images" || bucket === "f90-avatars"
        ? ["image/gif"]
        : []),
    ];
    if (!types.includes(file.type)) throw new Error("اختر صورة بصيغة مدعومة");
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error("سجّل الدخول أولًا");
    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    }[file.type];
    const path =
      (bucket === "f90-images" ? folder || "catalog" : user.id) +
      "/" +
      crypto.randomUUID() +
      "." +
      extension;
    const { error } = await client.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error)
      throw new Error("تعذّر رفع الصورة. تحقق من الصلاحيات وحاول مجددًا");
    return {
      path,
      url: client.storage.from(bucket).getPublicUrl(path).data.publicUrl,
    };
  }
  window.F90API = { call, upload, endpoint, client };
})();
