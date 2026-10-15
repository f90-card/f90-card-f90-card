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
      const isReadOnly=["catalog","health","me","history","status","categories","services","service","balance","quote","news"].includes(action);
      const timeout=isReadOnly?13000:0;
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
    const audio = bucket === "f90-audio";
    if (!file || file.size > (video ? 20971520 : audio ? 12582912 : 5242880))
      throw new Error(video ? "اختر فيديو MP4 أو WebM لا يتجاوز ٢٠ ميجابايت" : audio ? "اختر ملف صوت MP3 أو OGG أو WAV حتى 12 ميجابايت" : "اختر صورة لا تتجاوز ٥ ميجابايت");
    const types = [
      "image/jpeg",
      "image/png",
      "image/webp",
      ...(bucket === "f90-images" || bucket === "f90-avatars"
        ? ["image/gif"] : []),
      ...(video ? ["video/mp4","video/webm"] : []),
      ...(audio ? ["audio/mpeg","audio/ogg","audio/wav","audio/mp4"] : []),
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
      (bucket === "f90-images" || bucket === "f90-videos" || bucket === "f90-audio" ? folder || "catalog" : user.id) +
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
      url: client.storage.from(bucket).getPublicUrl(path).data.publicUrl,
    };
  }
  window.F90API = { call, upload, endpoint, client };
})();
