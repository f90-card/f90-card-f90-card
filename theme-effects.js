/* F90 visual assistant and optional weather. No network, purchases or personal data. */
(() => {
  "use strict";
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const store = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const read = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
  let bot, weather, hideButton, levelInput, modeInput;
  let lastWeatherKey = "";
  let scene = 0;
  let wandering = null;
  const messages = ["أهلًا من F90!", "كل شيء تمام؟", "تأكد من الآيدي قبل الشحن.", "غير ثيم المتجر من القائمة.", "أنا هنا للمساعدة!", "استمتع بوقتك!"];
  const objects = ["❄", "♥", "✦", "☁", "❋", "🕊"];
  const modes = { snow: ["❄", "❅", "❆"], rain: ["╱", "╲", "│"], wind: ["⌁", "➰", "·"], hearts: ["♥", "♡", "❤"], mix: objects };
  function drawWeather() {
    if (!weather) return;
    const level = read("f90-effects-level", "soft");
    const modeValue = read("f90-weather-mode", "mix");
    const mode = Object.hasOwn(modes, modeValue) ? modeValue : "mix";
    const active = root.dataset.theme === "melon" && level !== "off" && !reduced.matches;
    root.classList.toggle("f90-weather-active", active);
    root.dataset.weatherMode = active ? mode : "off";
    root.classList.toggle("f90-frosted", active && mode === "snow" && level === "full");
    const key = [active, level, mode, scene % 6].join(":");
    if (key === lastWeatherKey) return;
    lastWeatherKey = key;
    weather.replaceChildren();
    if (!active) return;
    const count = level === "full" ? 22 : 9;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const flake = document.createElement("span");
      flake.className = "f90-weather-particle";
      flake.textContent = modes[mode][(i + scene) % modes[mode].length];
      flake.style.setProperty("--particle-x", ((i * 37 + scene * 13) % 97) + "%");
      flake.style.setProperty("--particle-delay", "-" + ((i * 7) % 19) + "s");
      flake.style.setProperty("--particle-duration", (13 + (i * 3) % 12) + "s");
      fragment.appendChild(flake);
    }
    weather.appendChild(fragment);
  }
  function refresh() {
    const hidden = read("f90-bot-hidden", "0") === "1";
    if (bot) bot.hidden = hidden;
    if (bot) bot.classList.toggle("f90-mascot-still", reduced.matches);
    if (hideButton) {
      hideButton.textContent = hidden ? "إظهار بوت F90" : "إخفاء بوت F90";
      hideButton.setAttribute("aria-pressed", String(!hidden));
    }
    if (levelInput) levelInput.value = read("f90-effects-level", "soft");
    if (modeInput) modeInput.value = Object.hasOwn(modes, read("f90-weather-mode", "mix")) ? read("f90-weather-mode", "mix") : "mix";
    drawWeather();
  }
  function start() {
    hideButton = document.getElementById("f90BotToggle");
    levelInput = document.getElementById("f90EffectsLevel");
    modeInput = document.getElementById("f90WeatherMode");
    weather = document.createElement("div");
    weather.className = "f90-weather";
    weather.setAttribute("aria-hidden", "true");
    document.body.appendChild(weather);
    bot = document.createElement("div");
    bot.className = "f90-mascot f90-mascot-3d";
    bot.setAttribute("aria-label", "روبوت F90");
    bot.innerHTML = '<button type="button" class="f90-mascot-character" aria-label="التفاعل مع بوت F90"><span class="f90-mascot-antenna" aria-hidden="true"></span><span class="f90-mascot-face" aria-hidden="true"><span class="f90-mascot-eyes">•ᴗ•</span></span><span class="f90-mascot-label">F90</span></button><div class="f90-mascot-speech" role="status" hidden></div><button type="button" class="f90-mascot-close" aria-label="إخفاء بوت F90">×</button>';
    document.body.appendChild(bot);
    const speech = bot.querySelector(".f90-mascot-speech");
    const routeHint = () => {
      const page = (location.hash || "#/").split("/")[1] || "";
      if (page === "product") return "تأكد من بيانات حسابك قبل الطلب.";
      if (page === "deposit") return "الإيداع يحتاج حساب موثّق.";
      if (page === "orders") return "هنا تتابع طلباتك.";
      return messages[scene % messages.length];
    };
    bot.querySelector(".f90-mascot-character").addEventListener("click", () => {
      speech.textContent = routeHint();
      scene++;
      speech.hidden = false;
      bot.classList.remove("f90-bot-react");
      void bot.offsetWidth;
      bot.classList.add("f90-bot-react");
      bot.classList.toggle("f90-bot-left", scene % 2 === 0);
      drawWeather();
    });
    // Hide the decorative mascot while a dialog, drawer or payment form is active.
    const syncObstruction = () => {
      if (!bot) return;
      const dialogs = [...document.querySelectorAll(".modal, [role=dialog], #drawer")];
      const obstructed = dialogs.some((el) => !el.hidden && el.getAttribute("aria-hidden") !== "true" && el.offsetParent !== null);
      const focusedForm = !!document.activeElement?.closest("input,textarea,select");
      bot.classList.toggle("f90-bot-paused", obstructed || focusedForm);
    };
    const visibilityObserver = new MutationObserver(syncObstruction);
    visibilityObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "style", "aria-hidden"] });
    document.addEventListener("focusin", syncObstruction);
    document.addEventListener("focusout", () => requestAnimationFrame(syncObstruction));
    syncObstruction();
    const changeVisibility = () => {
      store("f90-bot-hidden", read("f90-bot-hidden", "0") === "1" ? "0" : "1");
      speech.hidden = true;
      refresh();
    };
    bot.querySelector(".f90-mascot-close").addEventListener("click", changeVisibility);
    hideButton?.addEventListener("click", changeVisibility);
    levelInput?.addEventListener("change", () => {
      store("f90-effects-level", levelInput.value);
      refresh();
    });
    modeInput?.addEventListener("change", () => {
      store("f90-weather-mode", modeInput.value);
      refresh();
    });
    reduced.addEventListener?.("change", refresh);
    // Keep the mascot playful without blocking taps or nagging the customer.
    // No auto-clicking, sales nudges or speech bubbles on timers.
    wandering = window.setInterval(() => {
      if (document.hidden || reduced.matches || bot.hidden || document.querySelector(".modal, .modal-backdrop, #drawer:not([hidden])")) return;
      bot.classList.toggle("f90-bot-left");
      bot.classList.remove("f90-bot-peek");
      void bot.offsetWidth;
      bot.classList.add("f90-bot-peek");
    }, 18000);
    new MutationObserver(refresh).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    refresh();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
