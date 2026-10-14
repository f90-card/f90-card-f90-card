(function () {
  "use strict";

  const SUPABASE_URL = "https://xzqnrpycjxfbyrfaolud.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cW5ycHljanhmYnlyZmFvbHVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzY3NDIsImV4cCI6MjEwNzMxMjc0Mn0.D3asmxTLRI7ZhKofbhxzP3FIaILepUVX2mYQT-mFrAk";

  if (!window.supabase || !window.supabase.createClient) {
    console.error("تعذّر تحميل مكتبة Supabase.");
    window.f90Supabase = null;
    window.F90_CONFIG = null;
    return;
  }

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

  window.f90Supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: "f90-card-auth",
        flowType: "pkce",
      },
    },
  );
})();
