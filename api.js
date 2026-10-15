(function () {
  "use strict";
  const client = window.f90Supabase;
  const endpoint = window.F90_CONFIG?.SUPABASE_URL
    ? window.F90_CONFIG.SUPABASE_URL + "/functions/v1/f90-platform" : "";
  async function call(action, data = {}) {
    // Public catalog/health are safe, anonymous, read-only calls.
    // Send them as CORS-simple requests: this avoids an OPTIONS preflight
    // that can succeed at the edge while the browser's POST never follows.
    const publicRead = action === "catalog" || action === "health";
    if ((!client && !publicRead) || !endpoint) {
      const error = new Error("تعذّر اتصال المتجر بالخادم. أعد المحاولة بعد التأكد من الاتصال بالإنترنت.");
      error.code = "F90_SDK_UNAVAILABLE";
      throw error;
    }
    // Public catalog never needs a session. Avoid blocking first paint on auth storage.
    const { data: { session } } = publicRead
      ? { data: { session: null } }
      : await client.auth.getSession();
    // A text/plain JSON body is intentionally accepted by f90-platform.
    // Keep apikey/Authorization for authenticated and financial actions.
    const headers = publicRead
      ? { "Content-Type": "text/plain;charset=UTF-8" }
      : {
          "Content-Type": "application/json",
          apikey: window.F90_CONFIG.SUPABASE_KEY,
        };
    if (session) headers.Authorization = "Bearer " + session.access_token;
    let response;
    try {
      const isReadOnly=["catalog","health","me","history","status","categories","services","service","balance","quote","news"].includes(action);
      // A bounded wait prevents indefinite spinners. Mutating calls remain ambiguous on timeout.
      const timeout=isReadOnly?13000:45000;
      const controller=timeout?new AbortController():null;
      const timeoutId=controller?setTimeout(()=>controller.abort(),timeout):null;
      try{
        response=await fetch(endpoint,{
          method:"POST",headers,body:JSON.stringify({action,...data}),
          cache:"no-store",...(controller?{signal:controller.signal}:{})
        });
      }finally{if(timeoutId)clearTimeout(timeoutId);}
    } catch(err) {
      // Read-only timeouts are safe to retry. Never assume a paid operation failed.
      const isReadOnly=["catalog","health","me","history","status","categories","services","service","balance","quote","news"].includes(action);
      const failure=new Error(isReadOnly?"تأخر اتصال الخادم. حاول إعادة تحميل المتجر.":"انقطع الاتصال قبل تأكيد نتيجة العملية");
      failure.code=isReadOnly?"F90_NETWORK_TIMEOUT":"F90_NETWORK_UNKNOWN";
      failure.uncertain=!isReadOnly;
      throw failure;
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
    if (!response.ok || body?.error) {
      const err = new Error(body?.error?.message || "تعذّر إكمال العملية");
      err.code = body?.error?.code;
      err.status = response.status;
      err.uncertain = response.status >= 500;
      throw err;
    }
    if (!body || typeof body !== "object" || !Object.prototype.hasOwnProperty.call(body, "data")) {
      const err = new Error("رد الخادم غير مكتمل. أعد المحاولة بعد التحقق من حالة الخدمة.");
      err.code = "F90_BAD_RESPONSE";
      err.uncertain = !["catalog","health","me","history","status","categories","services","service","balance","quote","news"].includes(action);
      throw err;
    }
    return body.data;
  }
  async function upload(file, bucket, folder) {
    if (!client) throw new Error("تعذّر تحميل اتصال التخزين بالخادم. حدّث الصفحة ثم حاول مجددًا.");
    const video = bucket === "f90-videos";
    const audio = bucket === "f90-audio";
    const radio = bucket === "f90-radio";
    if (!file || file.size > (radio ? 41943040 : video ? 20971520 : audio ? 12582912 : 5242880))
      throw new Error(radio ? "ملف الراديو يجب أن يكون صوتًا أو فيديو صالحًا ولا يتجاوز 40 ميجابايت" : video ? "اختر فيديو MP4 أو WebM لا يتجاوز ٢٠ ميجابايت" : audio ? "اختر ملف صوت MP3 أو OGG أو WAV حتى 12 ميجابايت" : "اختر صورة لا تتجاوز ٥ ميجابايت");
    const types = [
      "image/jpeg",
      "image/png",
      "image/webp",
      ...(bucket === "f90-images" || bucket === "f90-avatars"
        ? ["image/gif"] : []),
      ...(video || radio ? ["video/mp4","video/webm"] : []),
      ...(audio || radio ? ["audio/mpeg","audio/ogg","audio/wav","audio/mp4"] : []),
    ];
    if (!types.includes(file.type)) throw new Error(video ? "صيغة الفيديو غير مدعومة" : audio ? "صيغة الملف الصوتي غير مدعومة" : "اختر صورة بصيغة مدعومة");
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
      "audio/mpeg":"mp3", "audio/ogg":"ogg", "audio/wav":"wav","audio/mp4":"m4a",
    }[file.type];
    const path =
      (bucket === "f90-images" || bucket === "f90-videos" || bucket === "f90-audio" || bucket === "f90-radio" ? folder || "catalog" : user.id) +
      "/" +
      crypto.randomUUID() +
      "." +
      extension;
    const { error } = await client.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error)
      throw new Error(video ? "تعذّر رفع الفيديو. تحقق من الصلاحيات وحجم الملف وحاول مجددًا" : audio ? "تعذّر رفع الملف الصوتي" : "تعذّر رفع الصورة. تحقق من الصلاحيات وحاول مجددًا");
    return {
      path,
      url: radio ? "" : client.storage.from(bucket).getPublicUrl(path).data.publicUrl,
    };
  }
  window.F90API = { call, upload, endpoint, client };
})();
