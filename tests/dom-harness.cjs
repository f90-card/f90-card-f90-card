const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const { parseHTML } = require("linkedom");
const { webcrypto } = require("node:crypto");
const root = path.resolve(__dirname, "..");
function fixture() {
  return {
    settings: {
      store_name: "أف تسعين كارد",
      logo_url: "./f90-logo.png",
      contact_email: "support@example.invalid",
      config: {
        hero_image: "./assets/sections/hero.png",
        show_intro: true,
        whatsapp: "970568181910",
        payment_methods: [
          {
            id: "bank",
            name_ar: "طريقة اختبار",
            image_url: "./assets/sections/payments.png",
            details_ar: "وجهة اختبار",
            enabled: true,
          },
        ],
        pages: { about: { ar: "عن المتجر" } },
      },
    },
    categories: [
      {
        id: "games",
        name: "الألعاب",
        slug: "games",
        parent_id: null,
        is_active: true,
        image_url: "./assets/sections/games.png",
        presentation: {},
      },
      {
        id: "pubg",
        name: "ببجي",
        slug: "pubg",
        parent_id: "games",
        is_active: true,
        image_url: "./assets/sections/games.png",
        presentation: { layout: "packs" },
      },
    ],
    products: [
      {
        id: "coins",
        name: "شحن كوينز",
        slug: "coins",
        category_id: "pubg",
        is_active: true,
        price: 5,
        currency: "USD",
        stock: null,
        image_url: "./assets/sections/apps.png",
        commerce: {
          type: "quantity",
          prices: { USD: 5 },
          unit_quantity: 1000,
          quantity_min: 1000,
          quantity_max: 100000,
          quantity_step: 1000,
          fulfillment: "manual",
          fields: [
            {
              id: "account_id",
              label_ar: "معرّف الحساب",
              required: true,
              type: "text",
            },
          ],
        },
      },
    ],
    banners: [],
    rates: [
      { currency: "USD", name_ar: "دولار", per_usd: 1, is_enabled: true },
      { currency: "ILS", name_ar: "شيكل", per_usd: 3, is_enabled: true },
      { currency: "JOD", name_ar: "دينار", per_usd: 0.7, is_enabled: true },
    ],
    vip: Array.from({ length: 7 }, (_, n) => ({
      level: n + 1,
      minimum_spend: n * 100,
      discount_percent: n === 6 ? 2 : 0,
    })),
    version: 3,
  };
}
async function harness(file = "index.html", options = {}) {
  const { window } = parseHTML(fs.readFileSync(path.join(root, file), "utf8"));
  const calls = [],
    opened = [];
  let catalog = options.catalog || fixture(),
    wallet = options.balance ?? 20;
  const me = {
    profile: {
      id: "user",
      display_name: "عميل",
      customer_id: "F90-123",
      email: "user@example.invalid",
      account_status: "active",
      is_verified: options.verified ?? true,
      ...(options.currency?{account_currency:options.currency}:{}),
    },
    role: options.role || "customer",
    wallet: { balance_usd: wallet },
    spent_usd: 0,
    vip_level: 1,
    keys: [],
    needs_mfa: false,
  };
  const auth = {
    getSession: async () => ({
      data: { session: options.guest ? null : { access_token: "fixture" } },
    }),
    getUser: async () => ({ data: { user: { id: "user" } } }),
    onAuthStateChange: () => ({}),
    signOut: async () => ({}),
    mfa: { listFactors: async () => ({ data: { totp: [] } }) },
  };
  const A = {
    client: { auth },
    upload: async () => ({
      path: "user/test.png",
      url: "https://example.invalid/test.png",
    }),
    endpoint: "https://example.invalid/functions/v1/f90-platform",
    call: async (action, args = {}) => {
      calls.push({ action, args });
      if (action === "catalog") return structuredClone(catalog);
      if (action === "me") return structuredClone(me);
      if (action === "quote" && options.quote) return structuredClone(options.quote);
      if (action === "quote")
        return {
          product_id: "coins",
          quantity: args.quantity,
          unit_quantity: 1000,
          subtotal_usd: (Number(args.quantity) * 5) / 1000,
          total_usd: (Number(args.quantity) * 5) / 1000,
          discount_usd: 0,
          vip_level: 1,
        };
      if (action === "checkout") {
        wallet -= Number(args.expected_total_usd);
        me.wallet.balance_usd = wallet;
        return { id: "order", order_number: 1 };
      }
      if (action === "staff.list" && args.kind === "users" && options.users) return {items:options.users,count:options.users.length};
      if (action === "staff.finance" && options.users) return {balance_usd:20,extra_discount_percent:0,purchase_markup_percent:5,purchase_markup_enabled:true,ledger:[],profile:options.users[0]};
      if (action === "history" || action === "staff.list")
        return { items: [], count: 0 };
      if (action === "staff.catalog")
        return { ...catalog, internal: [], providers: [] };
      if (action === "order")
        return {
          order: {
            id: "order",
            order_number: 1,
            product_name: "شحن كوينز",
            customer_fields: { account_id: "42" },
            quantity: 1000,
            total_usd: 5,
            refunded_usd: 0,
            status: "pending",
            fulfillment: "manual",
            created_at: new Date().toISOString(),
          },
          events: [],
        };
      if (action === "staff.report")
        return {
          month: "2026-10",
          leaderboard: [],
          users: 1,
          active_30d: 1,
          orders: 0,
          revenue_usd: 0,
          known_profit_usd: 0,
          known_cost_usd: 0,
          wallet_liability: 20,
        };
      return {};
    },
  };
  let hash = options.hash || "#/";
  const location = {
    href: "https://example.invalid/" + file + hash,
    hostname: "example.invalid",
    origin: "https://example.invalid",
    get hash() {
      return hash;
    },
    set hash(v) {
      hash = v;
      location.href = "https://example.invalid/" + file + v;
      window.dispatchEvent(new window.Event("hashchange"));
    },
  };
  const storage = new Map();
  // Browsers always supply history; LinkeDOM does not. Reproduce scroll state safely.
  const history = { state: null, scrollRestoration: "auto",
    replaceState(state) { this.state = state; },
    pushState(state) { this.state = state; } };

  const timers = new Set();
  const nativeTimeout = globalThis.setTimeout;
  const nativeInterval = globalThis.setInterval;
  const nativeClearTimeout = globalThis.clearTimeout;
  const nativeClearInterval = globalThis.clearInterval;
  const schedule = (callback, delay, ...args) => {
    const id = nativeTimeout(() => { timers.delete(id); callback(...args); }, delay);
    timers.add(id);
    // Short boot/quote timers must remain live until their test resolves.
    // Long scheduling timers must not keep Node waiting for minutes.
    if (Number(delay) > 1000) id.unref?.();
    return id;
  };
  const repeat = (callback, delay, ...args) => {
    const id = nativeInterval(callback, delay, ...args);
    timers.add(id);
    id.unref?.();
    return id;
  };
  const stopTimer = (id) => { nativeClearTimeout(id); nativeClearInterval(id); timers.delete(id); };
  Object.defineProperty(window, "navigator", {
    value: {
      clipboard: { writeText: async () => {} },
      serviceWorker: { register: async () => {} },
    },
    configurable: true,
  });
  Object.assign(window, {
    F90API: A,
    F90_CONFIG: { SUPABASE_URL: "https://example.invalid", SUPABASE_KEY: "test-public-key" },
    F90Core: require("../store-core.js"),
    F90Reports: {
      history: async () => {},
      order: async () => {},
      admin: async () => {},
      staff: async () => {},
    },
    location,
    history,
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, v),
    },
    URL,
    URLSearchParams,
    TextEncoder,
    structuredClone,
    scrollTo: () => {},
    requestAnimationFrame: (callback) => schedule(callback, 0),
    cancelAnimationFrame: stopTimer,
    console,
    setTimeout: schedule,
    clearTimeout: stopTimer,
    setInterval: repeat,
    clearInterval: stopTimer,
    matchMedia: () => ({ matches: true }),
    FormData: class {
      constructor(form) {
        this.entries = [];
        for (const el of form.querySelectorAll("input,select,textarea")) {
          if (
            !el.name ||
            el.disabled ||
            (el.type === "checkbox" && !el.checked)
          )
            continue;
          this.entries.push([el.name, el.value ?? ""]);
        }
      }
      [Symbol.iterator]() {
        return this.entries[Symbol.iterator]();
      }
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "elements", {
    configurable: true,
    get() {
      return new Proxy(
        {},
        { get: (_, name) => this.querySelector(`[name="${name}"]`) },
      );
    },
  });
  Object.defineProperty(window.HTMLInputElement.prototype, "checked", {
    configurable: true,
    get() {
      return this.hasAttribute("checked");
    },
    set(v) {
      if (v) this.setAttribute("checked", "");
      else this.removeAttribute("checked");
    },
  });
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get() {
      return (
        (this.querySelector("option[selected]") || this.querySelector("option"))
          ?.value || ""
      );
    },
    set(v) {
      for (const o of this.querySelectorAll("option")) {
        if (o.value === String(v)) o.setAttribute("selected", "");
        else o.removeAttribute("selected");
      }
    },
  });
  const context = vm.createContext(window);
  vm.runInContext(fs.readFileSync(path.join(root,"f90-catalog-search.js"),"utf8"),context);
  if (file==="index.html") vm.runInContext(fs.readFileSync(path.join(root,"f90-special.js"),"utf8"),context);
  if (file==="admin.html") {
    vm.runInContext(fs.readFileSync(path.join(root,"f90-special-admin.js"),"utf8"),context);
    vm.runInContext(fs.readFileSync(path.join(root,"f90-content-admin.js"),"utf8"),context);
  }
  vm.runInContext(
    fs.readFileSync(
      path.join(root, file === "admin.html" ? "admin.js" : "app.js"),
      "utf8",
    ),
    context,
  );
  const settle = () => new Promise((r) => setTimeout(r, 20));
  await settle();
  return {
    window,
    document: window.document,
    calls,
    opened,
    settle,
    catalog,
    me,
    cleanup() {
      for (const id of timers) stopTimer(id);
    },
  };
}
module.exports = { fixture, harness };
