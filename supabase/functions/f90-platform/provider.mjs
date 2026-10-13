// Pure adapter helpers shared by the Edge Function and Node integration tests.
export class ProviderError extends Error {
  constructor(message, uncertain = false) {
    super(message);
    this.uncertain = uncertain;
  }
}
export function publicAddress(ip) {
  const x = ip.toLowerCase();
  if (x.includes(":"))
    return !(/^(::|fc|fd|fe[89ab]|ff)/.test(x) || x.startsWith("::ffff:"));
  const a = x.split(".").map(Number);
  if (a.length !== 4 || a.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return false;
  return !(
    a[0] === 0 ||
    a[0] === 10 ||
    a[0] === 127 ||
    a[0] >= 224 ||
    (a[0] === 169 && a[1] === 254) ||
    (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
    (a[0] === 192 && [0, 168].includes(a[1])) ||
    (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
    (a[0] === 198 && [18, 19].includes(a[1]))
  );
}
export function endpointURL(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new ProviderError("عنوان المورّد غير صحيح");
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.hash ||
    (u.port && u.port !== "443") ||
    /^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname)
  )
    throw new ProviderError("استخدم عنوان HTTPS عامًا للمورّد");
  if (
    (u.hostname.includes(":") || /^\d+\./.test(u.hostname)) &&
    !publicAddress(u.hostname.replace(/[\[\]]/g, ""))
  )
    throw new ProviderError("عنوان المورّد غير مسموح");
  return u;
}
export function normalizeService(s) {
  if (!s || typeof s !== "object" || s.available === false) return null;
  // Omega's product API uses qty_values and product_type, and prices one
  // product unit. SMM panels conventionally quote per 1000 units.
  const omega = s.product_type != null || s.qty_values != null;
  const productType = String(s.product_type ?? "").toLowerCase();
  // A known empty stock must not be offered as a purchasable product.
  // Unknown stock is deliberately not treated as zero.
  if (omega && s.stock != null && Number(s.stock) === 0) return null;
  const rate = Number(s.rate ?? s.price);
  const min = Number(s.min ?? s.qty_values?.min ?? 1),
    max = Number(s.max ?? s.qty_values?.max ??
      (omega && productType !== "amount" ? 1 : 1000000)),
    unit = Number(s.unit_quantity ?? (omega ? 1 : 1000));
  if (
    (s.service == null && s.id == null) ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(max) ||
    !Number.isSafeInteger(unit) ||
    unit < 1 ||
    unit > 1000000000 ||
    min < 1 ||
    max < min
  )
    return null;
  const params = Array.isArray(s.params)
    ? s.params.filter((v) => typeof v === "string" && v.trim())
      .slice(0, 20).map((v) => v.trim().slice(0, 120))
    : [];
  const name = String(s.name ?? "").trim();
  if (!name) return null;
  return {
    id: String(s.service ?? s.id),
    name: name.slice(0, 200),
    category: String(s.category_name ?? s.category ?? "").slice(0, 200),
    rate, min, max,
    type: String(s.product_type ?? s.type ?? "Default"),
    unit_quantity: unit,
    params,
    omega,
    raw: s,
  };
}
export function recoveryRedirect(value, origins) {
  const redirect = new URL(value);
  const fragment = redirect.hash;
  redirect.hash = "";
  endpointURL(redirect.href);
  if (!Array.isArray(origins) || !origins.includes(redirect.origin))
    throw new ProviderError("رابط العودة غير معتمد للمتجر");
  redirect.hash = fragment;
  return redirect;
}
export function normalizeStatus(data, total, quantity) {
  const s = String(data.status ?? data.state ?? "")
    .toLowerCase()
    .replace(/[ _-]/g, "");
  if (["completed", "complete", "success", "successful"].includes(s))
    return { status: "completed" };
  if (["canceled", "cancelled", "failed", "rejected", "error"].includes(s))
    return { status: "failed" };
  if (s === "partial") {
    const remains = Number(data.remains);
    if (!Number.isFinite(remains) || remains < 0 || remains > quantity)
      return { status: "review", note: "نتيجة جزئية تحتاج مراجعة الكمية" };
    return {
      status: "partial",
      refund: Math.round(((Number(total) * remains) / quantity) * 1e6) / 1e6,
    };
  }
  return { status: "processing" };
}
/** @param {null|((hostname:string)=>Promise<string[]>)} resolver */
export async function callProvider(
  provider,
  key,
  action,
  args = {},
  fetcher = fetch,
  resolver = null,
) {
  const u = endpointURL(provider.endpoint);
  const configuredTimeout = Number(provider.config?.request_timeout_ms ?? 20000);
  const timeout = Number.isSafeInteger(configuredTimeout) &&
    configuredTimeout >= 5000 && configuredTimeout <= 30000
    ? configuredTimeout : 20000;
  if (resolver && !u.hostname.includes(":") && !/^\d+\./.test(u.hostname)) {
    const addresses = await resolver(u.hostname);
    if (!addresses.length || addresses.some((x) => !publicAddress(x)))
      throw new ProviderError("عنوان الشبكة الخاص بالمورّد غير مسموح");
  }
  const headers = { Accept: "application/json" };
  if (provider.adapter === "omega") {
    if (!["services", "balance"].includes(action))
      throw new ProviderError("طلبات أوميغا الآلية غير متاحة حتى تهيئة حقول المنتجات");
    const target = new URL(action === "services" ? "/client/api/products" : "/client/api/profile", u.origin);
    let response;
    try {
      response = await fetcher(target, {
        method: "GET",
        headers: { Accept: "application/json", "api-token": key },
        redirect: "manual",
        signal: AbortSignal.timeout(timeout),
      });
    } catch {
      throw new ProviderError("تعذر الاتصال بأوميغا");
    }
    if (!response.ok || response.status >= 300)
      throw new ProviderError("رفض أوميغا الاتصال، تحقق من الرابط والتوكن");
    const raw = await response.text();
    if (raw.length > 2000000) throw new ProviderError("استجابة المورّد كبيرة جدًا");
    let data;
    try { data = JSON.parse(raw); } catch { throw new ProviderError("استجابة أوميغا غير مفهومة"); }
    if (data?.status === "error" || data?.error)
      throw new ProviderError("رفض أوميغا الطلب، تحقق من صلاحية التوكن");
    return action === "services" ? (Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.data?.products) ? data.data.products : Array.isArray(data?.products) ? data.products : Array.isArray(data?.result) ? data.result : data) : data;
  }
  let body;
  if (provider.adapter === "smm") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams({
      key,
      action,
      ...Object.fromEntries(
        Object.entries(args).map(([k, v]) => [k, String(v)]),
      ),
    });
  } else {
    headers["Content-Type"] = "application/json";
    headers.Authorization = `Bearer ${key}`;
    body = JSON.stringify({ action, ...args });
  }
  let response;
  try {
    response = await fetcher(u, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new ProviderError("تعذّر تأكيد نتيجة المورّد", action === "add");
  }
  if (response.status >= 300 && response.status < 400)
    throw new ProviderError("تحويل عنوان المورّد غير مسموح", action === "add");
  // A server error after POST may still have created an upstream order.
  if (!response.ok)
    throw new ProviderError("رفض اتصال المورّد", action === "add");
  const raw = await response.text();
  if (raw.length > 2000000)
    throw new ProviderError("استجابة المورّد أكبر من الحد", action === "add");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ProviderError("استجابة المورّد غير مفهومة", action === "add");
  }
  if (data?.error) throw new ProviderError("رفض المورّد تنفيذ الطلب");
  return data;
}

