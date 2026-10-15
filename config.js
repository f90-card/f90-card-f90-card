(function () {
  "use strict";

  const SUPABASE_URL = "https://xzqnrpycjxfbyrfaolud.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cW5ycHljanhmYnlyZmFvbHVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzY3NDIsImV4cCI6MjEwNzMxMjc0Mn0.D3asmxTLRI7ZhKofbhxzP3FIaILepUVX2mYQT-mFrAk";

  if (
    !SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY === "YOUR_SUPABASE_PUBLISHABLE_KEY"
  ) {
    console.error("يرجى إعداد مفتاح Supabase العام.");
    window.f90Supabase = null;
    window.F90_CONFIG = null;
    return;
  }

  window.F90_CONFIG = {
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_KEY: SUPABASE_PUBLISHABLE_KEY,
  };
  if (!window.supabase?.createClient) {
    console.error("تعذّر تحميل مكتبة Supabase من مصادرها.");
    window.f90Supabase = null;
    return;
  }
  // Restricted/private browsers can throw while accessing localStorage.
  // Continue with an in-memory session rather than crashing the storefront.
  let storage = null;
  try {
    const candidate = window.localStorage;
    const probe = "f90-storage-probe";
    candidate.setItem(probe, "1");
    candidate.removeItem(probe);
    storage = candidate;
  } catch {
    console.warn("F90 browser storage unavailable: temporary session mode");
  }
  try {
    window.f90Supabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: !!storage,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          ...(storage ? { storage } : {}),
        },
      },
    );
  } catch (err) {
    console.error("تعذّرت تهيئة اتصال المتجر.", err);
    window.f90Supabase = null;
  }
})();
