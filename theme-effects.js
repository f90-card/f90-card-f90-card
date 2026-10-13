/* Decorative F90 assistant for the melon theme only. No data collection or purchases. */
(() => {
  "use strict";
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const root = document.documentElement;
  let wrap;
  const messages = [
    "أهلًا! أنا روبوت F90 🤖",
    "بتقدر تغيّر مظهر الموقع من القائمة.",
    "تأكد من بيانات الشحن قبل تأكيد الطلب.",
    "خد وقتك في اختيار الخدمة المناسبة."
  ];
  let index = 0;
  function ensure() {
    if (wrap) return;
    wrap = document.createElement("div");
    wrap.className = "f90-mascot";
    wrap.setAttribute("aria-label", "مساعد F90 الزخرفي");
    wrap.innerHTML =
      '<button type="button" class="f90-mascot-character" aria-label="تحدث مع روبوت F90" title="F90 Bot">' +
      '<span class="f90-mascot-antenna" aria-hidden="true"></span>' +
      '<span class="f90-mascot-face" aria-hidden="true"><span class="f90-mascot-eyes">•ᴗ•</span></span>' +
      '<span class="f90-mascot-label">F90</span></button>' +
      '<div class="f90-mascot-speech" role="status" aria-live="polite" hidden></div>' +
      '<button type="button" class="f90-mascot-close" aria-label="إخفاء روبوت F90">×</button>';
    document.body.appendChild(wrap);
    wrap.querySelector(".f90-mascot-character").addEventListener("click", () => {
      const speech = wrap.querySelector(".f90-mascot-speech");
      speech.textContent = messages[index++ % messages.length];
      speech.hidden = false;
    });
    wrap.querySelector(".f90-mascot-close").addEventListener("click", () => {
      wrap.hidden = true;
      try { sessionStorage.setItem("f90-mascot-hidden", "1"); } catch {}
    });
  }
  function refresh() {
    ensure();
    let hidden = false;
    try { hidden = sessionStorage.getItem("f90-mascot-hidden") === "1"; } catch {}
    wrap.hidden = root.dataset.theme !== "melon" || hidden;
    if (reduced?.matches) wrap.classList.add("f90-mascot-still");
    else wrap.classList.remove("f90-mascot-still");
  }
  function start() {
    refresh();
    new MutationObserver(refresh).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    reduced?.addEventListener?.("change", refresh);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
