(function () {
  "use strict";

  // ضع رابط مشروع Supabase ومفتاح النشر العام هنا.
  // لا تضع service_role أو secret key في هذا الملف.

  const SUPABASE_URL = "https://xzqnrpycjxfbyrfaolud.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

  if (
    SUPABASE_URL === "YOUR_SUPABASE_PROJECT_URL" ||
    SUPABASE_PUBLISHABLE_KEY === "YOUR_SUPABASE_PUBLISHABLE_KEY"
  ) {
    console.warn("F90 CARD: يرجى إعداد معلومات اتصال Supabase.");
    window.f90Supabase = null;
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    console.error("تعذّر تحميل مكتبة Supabase.");
    window.f90Supabase = null;
    return;
  }

  window.f90Supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
})();
