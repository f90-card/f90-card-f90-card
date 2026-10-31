import { createClient } from "@supabase/supabase-js";
import { parentRefilling } from "./catalog.mjs";
import { recipientNameFromSupplier } from "./recipient-name.mjs";
import { cleanCurrencyPricing, nativePrice } from "./currency-pricing.mjs";
import { SHIHAB_ID, shihabSnapshot, shihabStatus, shihabPublicProduct } from "./shihab.mjs";
import {
  callProvider,
  endpointURL,
  f90SelfEndpoint,
  normalizeService,
  normalizeStatus,
  recoveryRedirect,
  ProviderError,
} from "./provider.mjs";

const url = Deno.env.get("SUPABASE_URL")!;
const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info,x-f90-key,x-f90-worker",
  "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
  "Cache-Control": "no-store",
};
function customerOrder(order: any) {
  const o = { ...order };
  if (order.provider_id === SHIHAB_ID && order.provider_status) {
    const supplierState = shihabStatus(order.provider_status);
    if ((order.status === "failed" && ["rejected","cancelled"].includes(supplierState)) ||
        (order.status === "processing" && supplierState === "pending")) o.status = supplierState;
  }
  for (const k of [
    "cost_usd",
    "provider_id",
    "provider_service",
    "provider_order_id",
    "provider_status",
    "dispatch_attempts",
    "next_sync_at",
    "idempotency_key",
    "stock_reserved",
  ])
    delete o[k];
  return o;
}
const roleNames = [
  "customer",
  "manager",
  "admin",
  "designer",
  "trader",
  "charging_agent",
  "support",
  "amin_card",
];
const errors: Record<string, [number, string]> = {
  F90_FORBIDDEN: [403, "لا تملك الصلاحية المطلوبة أو حسابك موقوف"],
  F90_NOT_FOUND: [404, "العنصر غير موجود"],
  F90_REFILLING: [409, "الخدمة قيد التعبئة حاليًا"],
  F90_QUANTITY: [400, "الكمية لا تطابق الحدود والخطوة المسموحة"],
  F90_CURRENCY_CODE: [400, "استخدم رمز عملة من 3 إلى 8 أحرف إنجليزية مثل SAR"],
  F90_RATE_BASE: [409, "الدولار هو العملة الأساسية؛ يبقى مفعّلًا بسعر 1 ولا يمكن حذفه"],
  F90_RATE_IN_USE: [409, "العملة مرتبطة بحسابات أو موردين أو هي العملة الافتراضية؛ غيّر ارتباطها قبل حذفها أو إيقافها"],
  F90_RATE_CHANGED: [409, "تغيّر سعر الصرف أثناء مراجعة الرصيد. افتح الحساب وراجع العملية مجددًا"],
  F90_RATE_MISSING: [409, "لم تضبط الإدارة سعر الصرف لهذه العملة"],
  F90_PRICE_MISSING: [409, "سعر الخدمة لم يجهّز بعد"],
  F90_INSUFFICIENT_BALANCE: [402, "رصيد محفظتك غير كافٍ. أضف رصيدًا أولًا"],
  F90_PRICE_CHANGED: [409, "تغيّر السعر. راجع الإجمالي وأكد الشراء مجددًا"],
  F90_SYNC_STALE: [409, "تغيّرت بيانات المورّد أو الأسعار بعد المعاينة. افتح مزامنة الأسعار مجددًا للحصول على معاينة حديثة."],
  F90_BALANCE_CHANGED: [409, "تغيّر رصيد العميل أثناء مراجعة العملية. افتح الحساب مجددًا قبل إضافة أو خصم رصيد."],
  F90_ACCOUNT_ID: [400, "أدخل معرّف حسابك"],
  F90_FIELDS: [400, "أكمل بيانات الطلب المطلوبة"],
  F90_IDEMPOTENCY_CONFLICT: [409, "مرجع العملية مستخدم ببيانات مختلفة"],
  F90_PROVIDER_NOT_READY: [409, "الخدمة الآلية غير جاهزة للتنفيذ بعد"],
  F90_COUPON: [400, "رمز الخصم غير صالح"],
  F90_RECEIPT: [400, "ارفع إيصال الإيداع من حسابك"],
  F90_PAYMENT_METHOD: [409, "طريقة الإيداع غير متاحة"],
  F90_AMOUNT: [400, "المبلغ غير صحيح"],
  F90_LAST_MANAGER: [409, "يجب أن يبقى مدير كامل الصلاحيات واحد على الأقل"],
  F90_SELF_MANAGER: [409, "لا يمكنك تعطيل حساب المدير الذي تستخدمه"],
  F90_CATEGORY_CYCLE: [400, "لا يمكن وضع القسم داخل نفسه أو داخل أحد فروعه"],
  F90_RECONCILE: [409, "راجع نتيجة المورّد قبل الاسترداد"],
  F90_IDEMPOTENCY: [400, "مرجع الطلب غير صحيح"],
  F90_STATUS: [400, "حالة الطلب غير صحيحة"],
  F90_CURRENT_SESSION: [409,"جلسة المدير الحالية محمية؛ اختر جلسة أخرى"],
  F90_SELF_VERIFICATION: [409,"لا يمكنك تعديل توثيق حسابك بنفسك"],
  F90_AUTH: [401, "سجّل الدخول لإكمال العملية"],
  F90_MFA: [403, "أدخل رمز التحقق الثنائي أولًا"],
  F90_LIMIT: [429, "طلبات كثيرة. انتظر دقيقة وحاول مجددًا"],
};
type Actor = {
  id: string;
  role: string;
  profile: any;
  needsMfa: boolean;
  aal?: string;
  sessionId?: string;
  keyId?: string;
  scopes?: string[];
  token?: string;
};
class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public publicMessage = "",
  ) {
    super(code);
  }
}
function out(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}
function fail(e: any) {
  const code =
    Object.keys(errors).find((c) => String(e?.message).includes(c)) ||
    e.code ||
    "F90_ERROR";
  const [status, message] = errors[code] || [
    e.status || 400,
    e.publicMessage || "تعذّر تنفيذ العملية. راجع البيانات وحاول مجددًا",
  ];
  const publicMessage = e instanceof AppError &&
    ["F90_AUTH", "F90_FORBIDDEN"].includes(code) && e.publicMessage
      ? e.publicMessage : message;
  return new Response(JSON.stringify({ error: { code, message: publicMessage } }), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}
// Successful select data is non-null; maybeSingle callers explicitly check null and mutation callers discard it.
function check<T>(r: { data: T; error: any }): NonNullable<T> {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
}
async function rpc(name: string, args: Record<string, unknown> = {}) {
  return check(await db.rpc(name, args));
}
function text(v: unknown, max = 2000) {
  return String(v ?? "")
    .trim()
    .slice(0, max);
}
function paymentReference(value: unknown) {
  if (typeof value !== "string" || value.length < 8 || value.length > 160 ||
      value.trim() !== value || value.split("").some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))
    throw new AppError("F90_IDEMPOTENCY", 400,
      "مرجع العملية مطلوب بطول 8 إلى 160 حرفًا، دون فراغات طرفية أو رموز تحكم");
  return value;
}
function uuid(v: unknown) {
  const s = text(v, 40);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  )
    throw new AppError("F90_FIELDS");
  return s;
}
function num(v: unknown, min = 0, max = 1e9) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new AppError("F90_AMOUNT");
  return n;
}
function integer(v: unknown, min = 1, max = 1e9) {
  const n = num(v, min, max);
  if (!Number.isSafeInteger(n)) throw new AppError("F90_QUANTITY");
  return n;
}
function requireRole(a: Actor, ...roles: string[]) {
  if (!roles.includes(a.role)) throw new AppError("F90_FORBIDDEN");
}
function protect(a: Actor) {
  if (a.needsMfa) throw new AppError("F90_MFA");
}
function securityManager(a: Actor) {
  requireRole(a,"manager");
  if(a.keyId) throw new AppError("F90_FORBIDDEN");
  if(!a.sessionId) throw new AppError("F90_AUTH",401);
}
async function securitySignal(kind:string,key:string,user:string|null=null,details:any={},threshold=1){
  try{await db.rpc("f90_security_signal",{p_kind:kind,p_key:key,p_user:user,p_details:details,p_threshold:threshold});}catch{console.error("Security signal unavailable");}
}
async function hash(value: string) {
  const raw = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(raw)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function actor(req: Request, optional = false): Promise<Actor | null> {
  const key = req.headers.get("x-f90-key");
  let userId: string,
    token: string | undefined,
    claims: any = {},
    api: any;
  if (key) {
    if (key.length > 200) throw new AppError("F90_AUTH");
    const apiSetting = check(await db.from("site_settings").select("config").eq("id", 1).single());
    if (apiSetting.config?.merchant_api_enabled === false)
      throw new AppError("F90_FORBIDDEN", 403, "واجهة التجار متوقفة مؤقتًا");
    api = check(
      await db
        .from("f90_api_keys")
        .select("*")
        .eq("token_hash", await hash(key))
        .eq("is_active", true)
        .maybeSingle(),
    );
    if (!api || (api.expires_at && Date.parse(api.expires_at) <= Date.now())) {
      await securitySignal("api_key_invalid",await hash(key),null,{message:"استخدام متكرر لمفتاح غير صالح"},5);
      throw new AppError("F90_AUTH", 401, "مفتاح التاجر غير صحيح أو ملغى أو منتهي الصلاحية");
    }
    if (
      !(await rpc("f90_limit", {
        p_key: `key:${api.id}`,
        p_limit: api.requests_per_minute,
      }))
    )
      throw new AppError("F90_LIMIT");
    if (api.allow_all_ips === false) {
      // IP restrictions are supplementary to a secret API token and require
      // a trusted IP header from the platform gateway. If absent, fail closed.
      const clientIP = req.headers.get("cf-connecting-ip")?.trim() || "";
      // Fail closed without a gateway-supplied client IP; reject spoofable x-real-ip fallback.
      if (!clientIP || !Array.isArray(api.allowed_ips) || !api.allowed_ips.includes(clientIP))
        throw new AppError("F90_FORBIDDEN",403,"عنوان الخادم غير موجود ضمن العناوين المسموحة لهذا المفتاح");
    }
    userId = api.user_id;
  } else {
    token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    // The publishable/anon token is not a user identity.
    if (!token) {
      if (optional) return null;
      throw new AppError("F90_AUTH");
    }
    const result = await db.auth.getUser(token);
    if (result.error || !result.data.user) {
      if (optional) return null;
      throw new AppError("F90_AUTH");
    }
    userId = result.data.user.id;
    try {
      claims = JSON.parse(
        atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
    } catch {
      throw new AppError("F90_AUTH");
    }
    if (
      !claims.session_id ||
      !(await rpc("f90_session_valid", {
        p_user: userId,
        p_session: claims.session_id,
      }))
    )
      throw new AppError("F90_AUTH");
    claims.factors = result.data.user.factors || [];
  }
  const [p, r] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).single(),
    db.from("f90_user_roles").select("role").eq("user_id", userId).single(),
  ]);
  const profile = check(p),
    role = check(r).role;
  if (profile.account_status !== "active" || (api && (role !== "trader" || !profile.is_verified)))
    throw new AppError("F90_FORBIDDEN");
  if (
    !api &&
    !(await rpc("f90_limit", { p_key: `user:${userId}`, p_limit: 180 }))
  )
    throw new AppError("F90_LIMIT");
  return {
    id: userId,
    role,
    profile,
    token,
    aal: claims.aal,
    sessionId: claims.session_id,
    needsMfa:
      role !== "manager" &&
      !api &&
      claims.factors.some((f: any) => f.status === "verified") &&
      claims.aal !== "aal2",
    keyId: api?.id,
    scopes: api?.scopes,
  };
}
function scoped(a: Actor, scope: string) {
  if (a.keyId && !a.scopes?.includes(scope))
    throw new AppError("F90_FORBIDDEN", 403, "مفتاح التاجر لا يملك صلاحية هذه العملية");
}
async function auditSafe(actorId: string, action: string, targetId: string, details: any) {
  try {
    const r = await db.from("f90_audit").insert({
      actor_id: actorId, action, target_id: targetId, details,
    });
    if (r.error) console.error("Audit insertion failed", r.error.code);
  } catch {
    console.error("Audit insertion failed");
  }
}
function keySettings(b: any, current: any = {}) {
  const name = String(b.name ?? current.name ?? "مفتاح متجر").trim();
  if (!name || name.length > 100) throw new AppError("F90_FIELDS");
  const scopes = b.scopes == null ? (current.scopes || ["catalog", "balance", "orders"]) : b.scopes;
  if (!Array.isArray(scopes) || !scopes.length || scopes.length > 3 ||
      new Set(scopes).size !== scopes.length ||
      scopes.some((v: any) => !["catalog", "balance", "orders"].includes(v)))
    throw new AppError("F90_FIELDS", 400, "اختر صلاحيات المفتاح المتاحة");
  const requests_per_minute = integer(
    b.requests_per_minute ?? current.requests_per_minute ?? 60, 10, 120);
  const inputExpiry = b.expires_at;
  const allow_all_ips = b.allow_all_ips === undefined ? (current.allow_all_ips !== false) : !!b.allow_all_ips;
  const rawIps = b.allowed_ips === undefined ? (current.allowed_ips || []) : b.allowed_ips;
  if (!Array.isArray(rawIps) || rawIps.length>20 || rawIps.some((ip: any) =>
      typeof ip!=="string" || ip.length>55 ||
      !(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip) && ip.split(".").every((n: string) => +n<=255) || /^[a-fA-F0-9:]+$/.test(ip) && ip.includes(":"))))
    throw new AppError("F90_FIELDS",400,"Use up to 20 valid IPv4 or IPv6 addresses");
  const allowed_ips=[...new Set(rawIps.map((ip: string)=>ip.trim()))];
  if (!allow_all_ips && !allowed_ips.length) throw new AppError("F90_FIELDS",400,"At least one allowed IP is required");
  if (inputExpiry === undefined)
    return { name, scopes, requests_per_minute, allow_all_ips,allowed_ips,expires_at: current.expires_at || null };
  let expires_at: string | null = null;
  if (inputExpiry) {
    const raw = String(inputExpiry);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) &&
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(raw))
      throw new AppError("F90_FIELDS");
    const date = new Date(raw.length === 10 ? raw + "T23:59:59.999Z" : raw);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now() ||
        date.getTime() > Date.now() + 366 * 86400000)
      throw new AppError("F90_FIELDS", 400, "حدّد تاريخ انتهاء مستقبليًا ضمن سنة");
    expires_at = date.toISOString();
  }
  return { name, scopes, requests_per_minute, expires_at,allow_all_ips,allowed_ips };
}
async function assertProviderAvailable(productId: string) {
  const link = check(await db.from("f90_product_internal")
    .select("provider_id")
    .eq("product_id", productId)
    .maybeSingle());
  if (!link?.provider_id) return;
  // These are independent read-only checks; requesting both concurrently
  // avoids one extra database roundtrip without weakening availability rules.
  const [productResult, providerResult] = await Promise.all([
    db.from("products").select("commerce").eq("id",productId).maybeSingle(),
    db.from("f90_providers").select("is_enabled,adapter,config")
      .eq("id",link.provider_id).maybeSingle()
  ]);
  const product=check(productResult);
  const p=check(providerResult);
  if (link.provider_id === SHIHAB_ID && (product?.commerce?.supplier_available === false ||
      p?.config?.automatic_orders_enabled !== true)) throw new AppError("F90_UNAVAILABLE",409);
  if (!p?.is_enabled || p.config?.disconnected || p.config?.archived_at)
    throw new AppError("F90_UNAVAILABLE", 409, "الخدمة قيد التعبئة لدى المورّد");
  if (product?.commerce?.fulfillment === "automatic" &&
      (p.adapter === "omega" || p.config?.automatic_orders_enabled !== true))
    throw new AppError("F90_PROVIDER_NOT_READY");
}
async function allCatalogRows(table: "products" | "f90_product_internal") {
  const rows: any[] = [];
  const pageSize = 900;
  for (let offset = 0; offset < 20000; offset += pageSize) {
    const result = table === "products"
      ? await db.from("products").select("*").eq("is_active", true)
        .order("sort_order").order("id").range(offset, offset + pageSize - 1)
      : await db.from("f90_product_internal").select("product_id,provider_id")
        .not("provider_id", "is", null).order("product_id")
        .range(offset, offset + pageSize - 1);
    const page = check(result);
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
  throw new AppError("F90_LIMIT", 503, "الكتالوج كبير جدًا؛ راجع الخدمات المنشورة");
}
// Public-only, short-lived in-memory cache for each warm edge isolate.
// It is never used to decide prices or authorize purchases: quote/order RPCs
// continue querying the live database. Collapse concurrent cold reads too.
let cachedPublicCatalog: any = null;
let cachedPublicCatalogUntil = 0;
let pendingPublicCatalog: Promise<any> | null = null;
async function publicCatalog() {
  if (cachedPublicCatalog && Date.now() < cachedPublicCatalogUntil)
    return cachedPublicCatalog;
  if (pendingPublicCatalog) return pendingPublicCatalog;
  pendingPublicCatalog = (async () => {
    const result = await buildPublicCatalog();
    cachedPublicCatalog = result;
    cachedPublicCatalogUntil = Date.now() + 12000;
    return result;
  })();
  try { return await pendingPublicCatalog; }
  finally { pendingPublicCatalog = null; }
}
async function buildPublicCatalog() {
  const rows = await Promise.all([
    db.from("site_settings").select("*").eq("id", 1).single(),
    db.from("categories").select("*").eq("is_active", true).order("sort_order"),
    allCatalogRows("products"),
    db.from("banners").select("*").eq("is_active", true).order("sort_order"),
    db.from("f90_rates").select("*").order("currency"),
    db.from("f90_vip_tiers").select("*").order("level"),
    allCatalogRows("f90_product_internal"),
    db.from("f90_providers").select("id,is_enabled,adapter,config"),
    db.from("f90_store_news").select("id,kind,title_ar,body_ar,product_id,created_at")
      .order("created_at", { ascending: false }).limit(40),
  ]);
  const shihabProvider = check(rows[7]).find((p:any)=>p.id===SHIHAB_ID);
  const privateIds = new Set(check(rows[1]).filter((c:any)=>String(c.slug||"").startsWith("f90-shihab-") &&
    (shihabProvider?.config?.catalog_visibility !== "public" || c.presentation?.catalog_visibility === "hidden" ||
     (Array.isArray(c.presentation?.visibility_roles) && c.presentation.visibility_roles.length>0))).map((c:any)=>c.id));
  const privateProductIds = new Set(check(rows[6]).filter((i:any)=>i.provider_id===SHIHAB_ID &&
    !shihabPublicProduct(check(rows[2]).find((p:any)=>p.id===i.product_id),shihabProvider)).map((i:any)=>i.product_id));
  const categories = check(rows[1]);
  const products = check(rows[2]);
  const linked = check(rows[6]);
  const allowedProviderIds = new Set(check(rows[7])
    .filter((p: any) => !p.config?.archived_at && !p.config?.disconnected)
    .map((p: any) => p.id));
  const allowedProductIds = new Set(linked
    .filter((entry: any) => allowedProviderIds.has(entry.provider_id))
    .map((entry: any) => entry.product_id));
  // Owner-managed manual services can be resold without a supplier mapping.
  // Linked archived/disconnected suppliers retain their existing exclusion.
  const explicitlyLinkedProductIds = new Set(linked.map((entry: any) => entry.product_id));
  for (const product of products) {
    if (!explicitlyLinkedProductIds.has(product.id) &&
        (product.commerce?.fulfillment || "manual") === "manual")
      allowedProductIds.add(product.id);
  }
  const allowedCategoryIds = new Set<string>();
  const categoriesById = new Map(categories.map((entry:any)=>[entry.id,entry]));
  // These owner-managed categories and their manual products belong beside the
  // supplier catalog. Keep the supplier filter for every other category.
  const ownerSlugs = new Set(["money-transfer","account-sales","design-services","complete-website"]);
  const ownerCategoryIds = new Set<string>(categories.filter((entry:any)=>ownerSlugs.has(entry.slug)).map((entry:any)=>entry.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const entry of categories) if (entry.parent_id && ownerCategoryIds.has(entry.parent_id) && !ownerCategoryIds.has(entry.id)) {
      ownerCategoryIds.add(entry.id); grew = true;
    }
  }
  for (const id of ownerCategoryIds) allowedCategoryIds.add(id);
  const providerProductIds = new Set(linked.map((entry:any)=>entry.product_id));
  for (const product of products) {
    if (!allowedProductIds.has(product.id)) continue;
    let categoryId = product.category_id;
    const seen = new Set<string>();
    while (categoryId && !seen.has(categoryId)) {
      allowedCategoryIds.add(categoryId);
      seen.add(categoryId);
      categoryId = (categoriesById.get(categoryId) as any)?.parent_id;
    }
  }
  const providerById = new Map(check(rows[7]).map((p: any) => [p.id, p]));
  const productById = new Map(products.map((p: any) => [p.id, p]));
  const hiddenProductIds = new Set(
    linked.filter((entry: any) => {
      const provider: any = providerById.get(entry.provider_id);
      return !provider || !!provider.config?.archived_at || !!provider.config?.disconnected;
    })
      .map((entry: any) => entry.product_id),
  );
  const pausedProductIds = new Set(linked.filter((entry: any) => {
    const provider: any = providerById.get(entry.provider_id);
    const product: any = productById.get(entry.product_id);
    return provider && (!provider.is_enabled ||
      (product?.commerce?.fulfillment === "automatic" &&
        (provider.adapter === "omega" || provider.config?.automatic_orders_enabled !== true)));
  }).map((entry: any) => entry.product_id));
  // A single category lookup instead of repeated linear scans for every
  // product and its ancestors. Cache results only inside this catalog build.
  const visibilityMemo = new Map<string,boolean>();
  const visible = (id: string, seen = new Set<string>()): boolean => {
    if (visibilityMemo.has(id)) return visibilityMemo.get(id)!;
    if (seen.has(id)) return false;
    seen.add(id);
    const item: any = categoriesById.get(id);
    const allowed = !!item && !privateIds.has(id) && (!item.parent_id || visible(item.parent_id,seen));
    visibilityMemo.set(id,allowed);
    seen.delete(id);
    return allowed;
  };
  const refillMemo = new Map<string,boolean>();
  const isCategoryRefilling = (id: string): boolean => {
    if (!id) return false;
    if (!refillMemo.has(id)) refillMemo.set(id,parentRefilling(id,categories));
    return refillMemo.get(id)!;
  };
  return {
    settings: {
      ...check(rows[0]),
      config: {
        ...check(rows[0]).config,
        music: (() => {
          const m = check(rows[0]).config?.music || {};
          // Never publish the path of an administrator's private upload.
          return {enabled:m.enabled===true,volume:Number(m.volume??0.35),loop:true,
            bubble:m.bubble||{}};
        })(),
      },
    },
    categories: categories
      .filter((c: any) => allowedCategoryIds.has(c.id) && !privateIds.has(c.id) && visible(c.id))
      .map((c: any) =>
        isCategoryRefilling(c.id)
          ? {
              ...c,
              presentation: { ...c.presentation, availability: "refilling" },
            }
          : c,
      ),
    products: products
      .filter((p: any) => (allowedProductIds.has(p.id) || (ownerCategoryIds.has(p.category_id) && !providerProductIds.has(p.id))) && !privateProductIds.has(p.id) && !hiddenProductIds.has(p.id) && (!p.category_id || visible(p.category_id)))
      .map((p: any) =>
        isCategoryRefilling(p.category_id) || pausedProductIds.has(p.id)
          ? { ...p, commerce: { ...p.commerce, availability: "refilling" } }
          : p,
      ),
    banners: check(rows[3]),
    rates: check(rows[4]).filter((r: any) => !r.is_archived),
    vip: check(rows[5]),
    news: check(rows[8]).filter((n: any) => !n.product_id || allowedProductIds.has(n.product_id)),
    version: 3,
  };
}
async function summary(a: Actor) {
  if (a.needsMfa)
    return {
      profile: {
        display_name: a.profile.display_name,
        avatar_url: a.profile.avatar_url,
      },
      role: a.role,
      needs_mfa: true,
    };
  const [wallet, spend, keys] = await Promise.all([
    db.from("f90_wallets").select("*").eq("user_id", a.id).single(),
    db
      .from("f90_orders")
      .select("total_usd,refunded_usd")
      .eq("user_id", a.id)
      .in("status", ["completed", "partial"]),
    a.role === "trader"
      ? db
          .from("f90_api_keys")
          .select(
            "id,name,token_prefix,scopes,is_active,created_at,expires_at,last_used_at,requests_per_minute,allow_all_ips,allowed_ips",
          )
          .eq("user_id", a.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const spent = check(spend).reduce(
    (s: any, o: any) => s + Number(o.total_usd) - Number(o.refunded_usd),
    0,
  );
  const tiers = check(
    await db.from("f90_vip_tiers").select("*").order("level"),
  );
  const tier =
    tiers.filter((t: any) => spent >= Number(t.minimum_spend)).at(-1) ||
    tiers[0];
  const userPricing = check(await db.from("f90_user_discounts").select("purchase_markup_percent,purchase_markup_enabled").eq("user_id",a.id).maybeSingle());
  await db
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", a.id);
  return {
    profile: a.profile,
    role: a.role,
    wallet: check(wallet),
    spent_usd: spent,
    vip_level: a.profile.vip_override || tier.level,
    keys: check(keys),
    needs_mfa: false,
    purchase_markup_percent: userPricing?.purchase_markup_enabled ? Number(userPricing.purchase_markup_percent) : 0,
  };
}
async function privatePath(a: Actor, bucket: string, path: unknown) {
  const p = text(path, 500);
  if (p.split("/")[0] !== a.id || p.includes(".."))
    throw new AppError("F90_FIELDS");
  const directory = p.slice(0, p.lastIndexOf("/")),
    name = p.slice(p.lastIndexOf("/") + 1);
  const objects = check(
    await db.storage.from(bucket).list(directory, { search: name, limit: 100 }),
  );
  if (!objects.some((o: any) => o.name === name))
    throw new AppError("F90_FIELDS");
  return p;
}
async function provider(id: string, readOnly = false) {
  const p = check(
    await db.from("f90_providers").select("*").eq("id", id).single(),
  );
  const secret = p.adapter === "shihab"
    ? Deno.env.get("SHIHAB_API_TOKEN")
    : await rpc("f90_provider_secret", {
      p_actor: null,
      p_provider: id,
    });
  if (p.config?.archived_at || !secret || (!p.is_enabled && !readOnly)) throw new ProviderError("المورّد غير مفعّل");
  if (!readOnly && (p.adapter === "omega" || p.config?.automatic_orders_enabled !== true))
    throw new ProviderError("الطلبات الآلية غير مفعّلة لهذا المورّد");
  return { p, secret };
}
async function dns(host: string) {
  const results = await Promise.allSettled([
    Deno.resolveDns(host, "A"),
    Deno.resolveDns(host, "AAAA"),
  ]);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
async function providerAction(id: string, action: string, args: any = {}) {
  const { p, secret } = await provider(id, ["services", "balance", "status"].includes(action));
  return callProvider(p, secret, action, args, fetch, dns);
}
async function syncShihab() {
  // This path only fetches catalog data. It never invokes add or order transitions.
  const {p,secret}=await provider(SHIHAB_ID,true);
  if (!p.is_enabled || p.config?.sync_enabled !== true || p.config?.disconnected)
    throw new AppError("F90_UNAVAILABLE",409);
  const items=await callProvider(p,secret,"services",{},fetch,dns);
  return rpc("f90_shihab_apply_snapshot",{p_items:shihabSnapshot(items)});
}
async function assertShihabCatalogAccess(productId:string,a:Actor|null) {
  const link=check(await db.from("f90_product_internal").select("provider_id").eq("product_id",productId).maybeSingle());
  if(link?.provider_id!==SHIHAB_ID || (a && ["manager","trader"].includes(a.role)))return;
  const catalog=await publicCatalog();
  if(!catalog.products.some((p:any)=>p.id===productId))throw new AppError("F90_FORBIDDEN",403);
}
// The database cron and the manager's button use the same restartable catalog
// fetch. Staging only inserts unseen supplier IDs; the SQL worker creates drafts.
async function smmCatalogFetch() {
  const claimed = await rpc("f90_smm_claim_fetch");
  if (!claimed) return { busy: true };
  let count = 0, added = 0;
  try {
    const items = await providerAction("c0e80eb6-7079-4071-8310-4c013614ffd5", "services");
    if (!Array.isArray(items)) throw new Error("قائمة SMMCPAN غير صالحة");
    count = items.length;
    for (let offset = 0; offset < items.length; offset += 100) {
      const staged = await rpc("f90_smm_stage", { p_items: items.slice(offset, offset + 100) });
      added += Number(staged.new || 0);
    }
    await rpc("f90_smm_finish_fetch", { p_count: count, p_error: null });
    return { found: count, new: added, queued: true };
  } catch (e) {
    await rpc("f90_smm_finish_fetch", { p_count: count,
      p_error: "تعذّر جلب أو حفظ قائمة الخدمات؛ ستعيد المهمة المحاولة" });
    throw e;
  }
}
function supplierRecipientNickname(data:any): string | null {
  return recipientNameFromSupplier(data);
}
async function rememberSupplierNickname(orderId:string,response:any) {
  const nickname=supplierRecipientNickname(response);
  if(!nickname)return;
  // Optional metadata must never fail a paid order or change its state.
  try {
    const result=await db.from("f90_orders")
      .update({supplier_account_name:nickname})
      .eq("id",orderId).is("supplier_account_name",null);
    if(result.error)console.error("Supplier nickname save failed",result.error.code);
  } catch {
    console.error("Supplier nickname save failed");
  }
}
// Completed orders are checked with the supplier's read-only /check endpoint.
// This cannot create new orders, re-charge a wallet or alter the order status.
async function syncCompletedSupplierName(order: any) {
  if(order.status !== "completed" || !order.provider_order_id || !order.provider_id)
    throw new AppError("F90_FIELDS",400,"يلزم طلب مكتمل مرتبط بياسين كارد");
  const checkedAt = new Date().toISOString();
  const attempts = Math.min(20, Math.max(0,Number(order.supplier_name_check_attempts)||0)+1);
  let response:any;
  try {
    response = await providerAction(order.provider_id,"status",{order:order.provider_order_id});
  } catch(err) {
    // Rate-limit failed read-only lookups as well. Never affect paid orders.
    await db.from("f90_orders").update({
      supplier_name_checked_at:checkedAt,supplier_name_check_attempts:attempts
    }).eq("id",order.id).eq("status","completed").is("supplier_account_name",null);
    throw err;
  }
  const nickname = response?.status === "completed" ? supplierRecipientNickname(response) : null;
  const changes:any = {
    supplier_name_checked_at:checkedAt,
    supplier_name_check_attempts:attempts,
  };
  if(nickname)changes.supplier_account_name=nickname;
  const updated=check(await db.from("f90_orders").update(changes)
    .eq("id",order.id).eq("status","completed").is("supplier_account_name",null)
    .select("supplier_account_name").maybeSingle());
  return {
    saved:!!(updated?.supplier_account_name),
    name:updated?.supplier_account_name || null,
    available:response?.status==="completed",
  };
}
async function backfillCompletedSupplierNames() {
  try {
    const providers=check(await db.from("f90_providers")
      .select("id").eq("adapter","yassen").eq("is_enabled",true));
    if(!providers.length)return 0;
    const until=new Date(Date.now()-12*3600*1000).toISOString();
    const rows=check(await db.from("f90_orders")
      .select("id,status,provider_id,provider_order_id,supplier_name_check_attempts")
      .eq("status","completed")
      .in("provider_id",providers.map((p:any)=>p.id))
      .not("provider_order_id","is",null)
      .is("supplier_account_name",null)
      .lt("supplier_name_check_attempts",3)
      .or("supplier_name_checked_at.is.null,supplier_name_checked_at.lt."+until)
      .order("created_at",{ascending:false}).limit(2));
    let found=0;
    for(const row of rows){
      try {
        const synced=await syncCompletedSupplierName(row);
        if(synced.saved)found++;
      } catch {
        // A metadata check never blocks paid order dispatch or status.
      }
    }
    return found;
  } catch {
    return 0;
  }
}
async function work() {
  const orders = await rpc("f90_claim_work");
  let processed = 0;
  for (const o of orders) {
    try {
      if (o.status === "submitting") {
        const link =
          o.customer_fields.link ||
          o.customer_fields.account_id ||
          Object.values(o.customer_fields)[0];
        const currentProvider = check(await db.from("f90_providers")
          .select("adapter").eq("id", o.provider_id).single());
        let params: Record<string, string> = {};
        if (currentProvider.adapter === "yassen" || currentProvider.adapter === "shihab") {
          const products = (await providerAction(o.provider_id, "services"))
            .map(normalizeService).filter(Boolean);
          const service = products.find((item: any) => item.id === String(o.provider_service));
          if (!service) throw new ProviderError("خدمة المورّد غير متاحة");
          const permitted = service.allowed_quantities;
          if (permitted && !permitted.includes(Number(o.quantity)))
            throw new ProviderError("الكمية غير مدعومة لدى ياسين");
          if (o.quantity < service.min || o.quantity > service.max)
            throw new ProviderError("الكمية خارج حدود ياسين");
          for (let i = 0; i < service.params.length; i++) {
            const value = o.customer_fields["param_" + (i + 1)];
            if (typeof value !== "string" || !value.trim())
              throw new ProviderError("بيانات خدمة ياسين غير مكتملة");
            params[service.params[i]] = value;
          }
        }
        const response = await providerAction(o.provider_id, "add", {
          service: o.provider_service,
          quantity: o.quantity,
          link,
          client_reference: o.id,
          ...(currentProvider.adapter === "f90_merchant" ? {
            fields: o.customer_fields, expected_total_usd: o.cost_usd,
          } : {}),
          params,
          ...(o.customer_fields.comments
            ? { comments: o.customer_fields.comments }
            : {}),
        });
        const external = response?.order ?? response?.order_id ?? response?.id;
        if (!external)
          throw new ProviderError("لم يؤكد المورّد رقم الطلب", true);
        await rpc("f90_order_transition", {
          p_actor: null,
          p_id: o.id,
          p_status: "processing",
          p_note: "استلم المورّد الطلب",
          p_external: String(external),
        });
        await rememberSupplierNickname(o.id,response);
      } else {
        const data = await providerAction(o.provider_id, "status", {
          order: o.provider_order_id,
        });
        const state = normalizeStatus(data, o.total_usd, o.quantity);
        if (o.provider_id === SHIHAB_ID) check(await db.from("f90_orders")
          .update({provider_status:text(data.supplier_status || data.status,100)}).eq("id",o.id));
        await rememberSupplierNickname(o.id,data);
        if (state.status !== "processing")
          await rpc("f90_order_transition", {
            p_actor: null,
            p_id: o.id,
            p_status: state.status,
            p_note: state.note || "تحديث نتيجة المورّد",
            p_refund: state.refund ?? null,
          });
        else
          await db
            .from("f90_orders")
            .update({
              provider_status: text(data.supplier_status || data.status, 100),
              next_sync_at: new Date(Date.now() + 120000).toISOString(),
            })
            .eq("id", o.id);
      }
    } catch (e) {
      if (o.status === "submitting")
        await rpc("f90_order_transition", {
          p_actor: null,
          p_id: o.id,
          p_status:
            e instanceof ProviderError && !e.uncertain ? "failed" : "review",
          p_note:
            e instanceof ProviderError && e.uncertain
              ? "نتيجة الاتصال غير مؤكدة؛ تحتاج الإدارة مراجعة المورّد قبل الإعادة أو الاسترداد"
              : "تعذّر تنفيذ الخدمة لدى المورّد",
        });
      // Poll failures do not prove an order failed. Retry status later, never add again.
      else
        await db
          .from("f90_orders")
          .update({ next_sync_at: new Date(Date.now() + 300000).toISOString() })
          .eq("id", o.id);
    }
    processed++;
  }
  await db
    .from("f90_rate_limits")
    .delete()
    .lt("window_start", new Date(Date.now() - 86400000).toISOString());
  const namesSynced = await backfillCompletedSupplierNames();
  return { processed, names_synced:namesSynced };
}
function cleanCommerce(raw: any, existing: any = {}, designer = false) {
  const c = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  if (designer)
    return {
      ...existing,
      availability: existing.supplier_refilling === true ? "refilling" :
        c.availability === "refilling" ? "refilling" : "available",
      ...(existing.supplier_refilling === true ? {
        supplier_previous_availability: c.availability === "refilling" ? "refilling" : "available",
      } : {}),
      search_aliases: (Array.isArray(c.search_aliases) ? c.search_aliases : existing.search_aliases || [])
        .slice(0, 20).map((value: unknown) => text(value, 120)).filter(Boolean),
      fields: Array.isArray(c.fields)
        ? c.fields.slice(0, 15).map((f: any) => ({
            id: text(f.id, 60),
            label_ar: text(f.label_ar, 150),
            type: ["text", "email", "number", "textarea", "url"].includes(
              f.type,
            )
              ? f.type
              : "text",
            required: !!f.required,
            placeholder_ar: text(f.placeholder_ar, 200),
          }))
        : existing.fields || [],
    };
  const currencyPricing = c.currency_pricing ?? existing.currency_pricing ?? {};
  let cleanedCurrencyPricing;
  try {
    cleanedCurrencyPricing = cleanCurrencyPricing(currencyPricing, (c.type === "quantity" ? c.unit_quantity : c.pack_quantity) || (existing.type === "quantity" ? existing.unit_quantity : existing.pack_quantity) || 1);
  } catch (err) {
    throw new AppError("F90_FIELDS",400,err.message);
  }
  const result: any = {
    currency_pricing: cleanedCurrencyPricing,
    type: c.type === "quantity" ? "quantity" : "fixed",
    availability: c.availability === "refilling" ? "refilling" : "available",
    fulfillment: c.fulfillment === "automatic" ? "automatic" : "manual",
    unit_quantity: integer(c.unit_quantity || 1),
    pack_quantity: integer(c.pack_quantity || 1),
    quantity_min: integer(c.quantity_min || 1),
    quantity_max: integer(c.quantity_max || 1000000000),
    quantity_step: integer(c.quantity_step || 1),
    quantity_label_ar: text(c.quantity_label_ar || "وحدة", 100),
    delivery_time: text(c.delivery_time, 200),
    expected_minutes: integer(c.expected_minutes || 0, 0, 525600),
    prices: { USD: num(c.prices?.USD || 0, 0, 1000000) },
    search_aliases: (Array.isArray(c.search_aliases) ? c.search_aliases : existing.search_aliases || [])
      .slice(0, 20).map((value: unknown) => text(value, 120)).filter(Boolean),
    fields: cleanCommerce(c, existing, true).fields,
    pricing_tiers: [],
  };
  if (existing.supplier_refilling === true) {
    result.supplier_refilling = true;
    result.supplier_previous_availability = result.availability;
    result.availability = "refilling";
  }
  // Keep special-service checkout guard when a manager edits a draft.
  if (existing.special_route === "transfer") {
    result.special_route = "transfer";
    result.transfer_method_id = text(existing.transfer_method_id, 100);
    result.no_checkout = true;
  } else if (existing.no_checkout === true && Number(result.prices.USD) <= 0) {
    result.no_checkout = true;
    result.admin_draft = true;
  }
  if (result.quantity_max < result.quantity_min)
    throw new AppError("F90_QUANTITY");
  result.pricing_tiers = (Array.isArray(c.pricing_tiers) ? c.pricing_tiers : [])
    .slice(0, 30)
    .map((t: any) => ({
      min: integer(t.min),
      ...(t.max == null || t.max === "" ? {} : {max:integer(t.max)}),
      prices: { USD: num(t.prices?.USD, 0.000001, 1000000) },
    }));
  result.pricing_tiers.sort((x: any,y: any)=>x.min-y.min);
  for(let n=0;n<result.pricing_tiers.length;n++) {
    const tier=result.pricing_tiers[n],prev=result.pricing_tiers[n-1];
    if(tier.min<1 || (tier.max!=null && tier.max<tier.min) ||
       (prev && (prev.min===tier.min || (prev.max!=null && prev.max>=tier.min))))
      throw new AppError("F90_QUANTITY");
  }
  return result;
}
async function catalogSave(a: Actor, b: any) {
  requireRole(a, "manager", "designer");
  const kind = b.kind;
  const tables: Record<string, string> = {
    category: "categories",
    product: "products",
    banner: "banners",
  };
  if (!tables[kind]) throw new AppError("F90_FIELDS");
  const table = tables[kind];
  let old: any = {};
  const id = b.id ? uuid(b.id) : null;
  if (id) old = check(await db.from(table).select("*").eq("id", id).single());
  const d = b.data || {};
  const data: any = {
    name: text(d.name || old.name, 200),
    slug: text(d.slug || old.slug || `${kind}-${crypto.randomUUID()}`, 250),
    image_url: text(d.image_url, 2000) || null,
    description: text(d.description, 10000),
    is_active: typeof d.is_active === "boolean" ? d.is_active : (id ? old.is_active === true : true),
    sort_order: integer(d.sort_order ?? old.sort_order ?? 0, 0, 100000),
  };
  if (kind === "category") {
    data.parent_id = d.parent_id ? uuid(d.parent_id) : null;
    data.presentation = {
      ...old.presentation,
      availability:
        d.presentation?.availability === "refilling"
          ? "refilling"
          : "available",
      routing: d.presentation?.routing === "direct" ? "direct" : "auto",
      direct_product_id: d.presentation?.direct_product_id
        ? uuid(d.presentation.direct_product_id)
        : null,
      layout: d.presentation?.layout === "packs" ? "packs" : "images",
      banner_url: text(d.presentation?.banner_url, 2000),
    };
  }
  if (kind === "product") {
    data.category_id = d.category_id ? uuid(d.category_id) : null;
    data.gallery = Array.isArray(d.gallery)
      ? d.gallery.slice(0, 8).map((v: any) => text(v, 2000))
      : [];
    data.commerce = cleanCommerce(
      d.commerce,
      old.commerce,
      a.role === "designer",
    );
    if (data.is_active && data.commerce?.special_route === "transfer")
      throw new AppError("F90_FIELDS", 400,
        "خدمات تحويل الأموال تستخدم نموذج التحويل المخصص ولا تُنشر للشراء المكرر");
    if (data.is_active && data.commerce?.no_checkout === true)
      throw new AppError("F90_FIELDS", 400,
        "حدّد سعر خدمة حقيقيًا أولًا، ثم احفظ المنتج وانشره");

    if (a.role === "manager") {
      data.price = data.commerce.prices.USD;
      data.currency = "USD";
      data.stock =
        d.stock == null || d.stock === ""
          ? null
          : integer(d.stock, 0, 1000000000);
      data.is_featured = !!d.is_featured;
    } else if (!id) {
      data.price = 0;
      data.currency = "USD";
      data.commerce = {
        ...data.commerce,
        type: "fixed",
        fulfillment: "manual",
        prices: { USD: 0 },
      };
      data.is_active = false;
    }
  }
  if (kind === "banner") {
    delete data.name;
    delete data.slug;
    delete data.description;
    data.title = text(d.title, 200);
    data.subtitle = text(d.subtitle, 1000);
    data.link_url = text(d.link_url, 2000);
    data.presentation = {
      ...d.presentation,
      overlay_enabled: !!d.presentation?.overlay_enabled,
      starts_at: d.presentation?.starts_at || null,
      ends_at: d.presentation?.ends_at || null,
    };
  }
  const saved = check(
    id
      ? await db.from(table).update(data).eq("id", id).select().single()
      : await db.from(table).insert(data).select().single(),
  );
  if (kind === "product" && a.role === "manager" && d.internal) {
    const i = d.internal;
    // A manual price edit must not be overwritten by the next supplier poll.
    // Image/category/name/visibility-only edits keep automatic pricing intact.
    let editedYassenPrice = false;
    if(id && i.provider_id){
      const selectedProvider = check(await db.from("f90_providers")
        .select("adapter").eq("id",uuid(i.provider_id)).single());
      const previousPrice=Number(old.commerce?.prices?.USD??old.price);
      const chosenPrice=Number(data.commerce?.prices?.USD??data.price);
      editedYassenPrice=selectedProvider.adapter==="yassen" &&
        Number.isFinite(previousPrice)&&Number.isFinite(chosenPrice) &&
        Math.abs(chosenPrice-previousPrice)>0.0000005;
    }
    check(
      await db.from("f90_product_internal").upsert({
        product_id: saved.id,
        provider_id: i.provider_id ? uuid(i.provider_id) : null,
        provider_service: text(i.provider_service, 100) || null,
        cost_usd:
          i.cost_usd === "" || i.cost_usd == null
            ? null
            : num(i.cost_usd, 0, 1000000),
        trader_price_usd:
          i.trader_price_usd === "" || i.trader_price_usd == null
            ? null
            : num(i.trader_price_usd, 0.000001, 1000000),
        auto_margin: !!i.auto_margin && !editedYassenPrice,
      }),
    );
  }
  await db.from("f90_audit").insert({
    actor_id: a.id,
    action: `catalog.${id ? "update" : "create"}`,
    target_id: saved.id,
    details: { kind },
  });
  return saved;
}
async function localizationResources(b: any, includePrivate = false) {
  const locale=text(b.locale,2);
  if(!["en","fr","pt"].includes(locale))throw new AppError("F90_FIELDS");
  const since=b.since?String(b.since):null;
  if(since&&!Number.isFinite(Date.parse(since)))throw new AppError("F90_FIELDS");
  const messages:Record<string,string>={};
  for(let offset=0;offset<20000;offset+=1000){
    let query=db.from("f90_i18n_text").select("source_text,"+locale).neq("provider","pending").order("source_text").range(offset,offset+999);
    if(!includePrivate)query=query.eq("is_public",true);
    if(since)query=query.gt("updated_at",since);
    const rows=check(await query);
    for(const row of rows)if(row[locale])messages[row.source_text]=row[locale];
    if(rows.length<1000)return {messages,locale,updated_at:new Date().toISOString()};
  }
  throw new AppError("F90_FIELDS",503,"موارد الترجمة كبيرة؛ يلزم تقسيم إضافي");
}
async function staff(a: Actor, b: any) {
  const action = b.action;
  if(action==="staff.i18n.resources"){
    requireRole(a,"manager","designer");protect(a);return localizationResources(b,true);
  }
  if(action.startsWith("staff.i18n.")){
    securityManager(a);
    if(action==="staff.i18n.save"){
      const source=text(b.source,12000);
      const saved=await rpc("f90_i18n_save",{p_actor:a.id,p_source:source,p_en:text(b.en,16000),p_fr:text(b.fr,16000),p_pt:text(b.pt,16000),p_reason:text(b.reason,500)});
      check(await db.from("f90_i18n_text").update({provider:"manual"}).eq("source_text",source));return saved;
    }
    if(action==="staff.i18n.list"){
      let q=db.from("f90_i18n_text").select("source_text,en,fr,pt,is_public,manual_locales,provider,updated_at",{count:"exact"}).order("updated_at",{ascending:false}).range(integer(b.offset||0,0,100000),integer(b.offset||0,0,100000)+49);
      if(b.search)q=q.ilike("source_text","%"+text(b.search,200).replace(/[\\%_]/g,"\\$&")+"%");
      if(b.pending===true)q=q.eq("provider","pending");
      const result=await q;check(result);
      const jobs=check(await db.from("f90_i18n_jobs").select("status").limit(20000));
      const counts:Record<string,number>={};for(const j of jobs)counts[j.status]=(counts[j.status]||0)+1;
      return {rows:result.data,count:result.count,jobs:counts,control:check(await db.from("f90_i18n_control").select("enabled,daily_neuron_cap").eq("id",1).single())};
    }
    if(action==="staff.i18n.retry"){
      const source=text(b.source,12000),reason=text(b.reason,500);if(reason.length<5)throw new AppError("F90_FIELDS");
      check(await db.from("f90_i18n_jobs").update({status:"pending",attempts:0,last_error:null,next_attempt_at:new Date().toISOString(),lease_id:null,lease_until:null}).eq("source_text",source));
      await auditSafe(a.id,"i18n.retry",await hash(source),{reason});return {queued:true};
    }
    throw new AppError("F90_NOT_FOUND");
  }
  if (action === "staff.radio.status") {
    requireRole(a, "manager");
    const [row, src] = await Promise.all([
      db.from("site_settings").select("config").eq("id",1).single(),
      db.from("f90_radio_sources").select("media_path,mode,direct_audio_url,youtube_url,updated_at").eq("id",1).single()
    ]);
    const m=check(row).config?.music||{}, r=check(src);
    return {enabled:m.enabled===true,volume:Number(m.volume??0.35),
      bubble:m.bubble||{},
      has_media:!!r.media_path||!!m.playlist?.length,has_direct:!!r.direct_audio_url,
      has_youtube:!!r.youtube_url,mode:r.mode||"audio",
      playlist:Array.isArray(m.playlist)&&m.playlist.length?m.playlist:(r.media_path?[{path:r.media_path,title:"المقطع الحالي"}]:[]),
      source_mode:m.source_mode==="link"?"link":m.source_mode==="file"?"file":r.direct_audio_url?"link":"file",
      selected_index:Number(m.selected_index||0),start_seconds:Number(m.start_seconds||0),
      direct_audio_url:r.direct_audio_url||"",
      youtube_url:r.youtube_url||"",updated_at:r.updated_at};
  }
  if (action === "staff.radio.preview") {
    requireRole(a,"manager");
    const settings=check(await db.from("site_settings").select("config").eq("id",1).single());
    const saved=Array.isArray(settings.config?.music?.playlist)?settings.config.music.playlist:[];
    const playlist=saved.length?saved:[{path:String(check(await db.from("f90_radio_sources").select("media_path").eq("id",1).single()).media_path||""),title:"المقطع الحالي"}];
    const idx=integer(b.index,0,Math.max(0,playlist.length-1));
    const path=String(playlist[idx]?.path||"");
    if(!/^tracks\/[0-9a-f-]{36}\.(mp3|ogg|wav|m4a|aac|mp4|webm)$/i.test(path))
      throw new AppError("F90_FIELDS",400,"ملف الألبوم غير صالح");
    const ticket=check(await db.storage.from("f90-radio").createSignedUrl(path,900));
    return {url:ticket.signedUrl};
  }
  if (action === "staff.radio.save") {
    requireRole(a,"manager");
    const current=check(await db.from("f90_radio_sources").select("*").eq("id",1).single());
    const p=b.media_path===undefined?current.media_path:text(b.media_path,400);
    const direct=b.direct_audio_url===undefined?current.direct_audio_url:text(b.direct_audio_url,1500);
    const youtube=b.youtube_url===undefined?current.youtube_url:text(b.youtube_url,1500);
    const mode=p?(/\.(mp4|webm)$/i.test(p)?"video":"audio"):"audio";
    if(p && !/^tracks\/[0-9a-f-]{36}\.(mp3|ogg|wav|m4a|aac|mp4|webm)$/.test(p))
      throw new AppError("F90_FIELDS",400,"مسار ملف الراديو غير مدعوم");
    const acceptable=(value:string)=>{
      if(!value)return true;
      try{const u=new URL(value);
        return u.protocol==="https:"&&!u.username&&!u.password&&
          !/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be|googlevideo\.com)$/i.test(u.hostname);
      }catch{return false;}
    };
    if(!acceptable(direct))throw new AppError("F90_FIELDS",400,"أدخل رابط بث صوت مباشر HTTPS وليس رابط YouTube");
    if(youtube){
      try{const u=new URL(youtube);
        if(u.protocol!=="https:"||
        !["youtube.com","www.youtube.com","m.youtube.com","youtu.be","www.youtu.be","www.youtube-nocookie.com"].includes(u.hostname))
          throw new Error("invalid");
      }catch{throw new AppError("F90_FIELDS",400,"رابط YouTube غير صحيح");}
    }
    const settings=check(await db.from("site_settings").select("config").eq("id",1).single());
    const previous=settings.config?.music||{};
    const playlistInput=b.playlist===undefined?(Array.isArray(previous.playlist)&&previous.playlist.length?previous.playlist:(current.media_path?[{path:current.media_path,title:"المقطع الحالي"}]:[])):b.playlist;
    if(!Array.isArray(playlistInput)||playlistInput.length>40)
      throw new AppError("F90_FIELDS",400,"الألبوم يسمح بحد أقصى 40 ملفًا صوتيًا");
    const playlist=playlistInput.map((item:any)=>{
      const path=text(item?.path,400),title=text(item?.title,90);
      if(!/^tracks\/[0-9a-f-]{36}\.(mp3|ogg|wav|m4a|aac|mp4|webm)$/i.test(path))
        throw new AppError("F90_FIELDS",400,"مسار أحد ملفات الألبوم غير مدعوم");
      return {path,title:title||"مقطع صوتي"};
    });
    if(new Set(playlist.map((x:any)=>x.path)).size!==playlist.length)
      throw new AppError("F90_FIELDS",400,"لا يمكن تكرار نفس الملف داخل الألبوم");
    const sourceMode=b.source_mode==="link"?"link":b.source_mode==="file"?"file":previous.source_mode==="link"?"link":"file";
    const selectedIndex=playlist.length?integer(b.selected_index??previous.selected_index??0,0,playlist.length-1):0;
    const startSeconds=num(b.start_seconds??previous.start_seconds??0,0,86400);
    const enabled=b.enabled===undefined?previous.enabled===true:b.enabled===true;
    if(enabled && (sourceMode==="link"?!direct:!(playlist.length||p)))
      throw new AppError("F90_FIELDS",400,"أضف ملفات صوتية للألبوم أو رابط بث مباشر قبل تشغيل الراديو");
    const volume=Math.max(0,Math.min(1,Number(b.volume??previous.volume??0.35)||0));
    const playbackChanged=JSON.stringify(playlist)!==JSON.stringify(previous.playlist||[])
      ||sourceMode!==previous.source_mode||selectedIndex!==Number(previous.selected_index||0)
      ||startSeconds!==Number(previous.start_seconds||0)
      ||p!==current.media_path||direct!==current.direct_audio_url;
    const revision=playbackChanged?new Date().toISOString():current.updated_at;
    check(await db.from("f90_radio_sources").update({media_path:p,
      direct_audio_url:direct,youtube_url:youtube,mode,updated_at:revision}).eq("id",1).select("id").single());
    const currentBubble=settings.config?.music?.bubble||{};
    const incoming=b.bubble&&typeof b.bubble==="object"&&!Array.isArray(b.bubble)?b.bubble:{};
    const side=["left","right"].includes(incoming.side)?incoming.side:(currentBubble.side==="left"?"left":"right");
    const bounded=(v:any,minimum:number,maximum:number,fallback:number)=>{
      const n=Number(v);return Number.isFinite(n)?Math.max(minimum,Math.min(maximum,n)):fallback;
    };
    const icon=typeof incoming.icon_url==="string"?incoming.icon_url.trim().slice(0,1500):String(currentBubble.icon_url||"");
    if(icon){
      try{const u=new URL(icon);if(u.protocol!=="https:"||u.username||u.password)throw new Error("bad icon");}
      catch{throw new AppError("F90_FIELDS",400,"رابط أيقونة الراديو يجب أن يكون HTTPS صالحًا");}
    }
    const bubble={
      side,
      vertical:bounded(incoming.vertical??currentBubble.vertical,12,88,62),
      size_mobile:bounded(incoming.size_mobile??currentBubble.size_mobile,32,88,44),
      size_desktop:bounded(incoming.size_desktop??currentBubble.size_desktop,32,100,50),
      icon_url:icon,
      opacity:bounded(incoming.opacity??currentBubble.opacity,0.35,1,0.7)
    };
    const config={...settings.config,music:{...previous,enabled,volume,loop:true,bubble,
      playlist,source_mode:sourceMode,selected_index:selectedIndex,start_seconds:startSeconds}};
    check(await db.from("site_settings").update({config}).eq("id",1).select("id").single());
    await auditSafe(a.id,"radio.configure","radio",{enabled,mode,has_media:!!p,has_direct:!!direct});
    return {saved:true,enabled,revision};
  }
  if (action === "staff.inbox") {
    requireRole(a, "manager", "admin", "support");
    if (a.keyId) throw new AppError("F90_FORBIDDEN");
    const canReviewIdentity = a.role !== "support";
    const canViewUsers = a.role === "manager";
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [orderReply, requestsReply, depositsReply, verificationReply, usersReply] =
      await Promise.all([
        db.from("f90_orders")
          .select("id,order_number,product_name,status,created_at")
          .in("status", ["pending","queued","submitting","processing","review"])
          .order("created_at",{ascending:false}).limit(15),
        db.from("f90_order_requests")
          .select("id,order_id,kind,reason,status,created_at")
          .eq("status","pending").order("created_at",{ascending:false}).limit(10),
        canReviewIdentity ? db.from("f90_deposits")
          .select("id,method_name,amount,currency,status,created_at")
          .eq("status","pending").order("created_at",{ascending:false}).limit(10)
          : Promise.resolve({ data: [], error:null }),
        canReviewIdentity ? db.from("f90_verifications")
          .select("id,status,created_at")
          .eq("status","pending").order("created_at",{ascending:false}).limit(10)
          : Promise.resolve({ data: [], error:null }),
        canViewUsers ? db.from("profiles")
          .select("id,display_name,created_at")
          .gte("created_at",since).order("created_at",{ascending:false}).limit(10)
          : Promise.resolve({ data: [], error:null }),
      ]);
    const orders = check(orderReply), requests = check(requestsReply),
      deposits = check(depositsReply), verifications = check(verificationReply),
      users = check(usersReply);
    const items = [
      ...orders.map((o:any) => ({
        kind:"orders", id:o.id, created_at:o.created_at,
        title:"طلب شحن جديد #" + String(o.order_number||""),
        detail:String(o.product_name||"خدمة رقمية").slice(0,150) +
          " · الحالة: " + String(o.status||"قيد التنفيذ"),
      })),
      ...requests.map((o:any) => ({
        kind:"order-requests", id:o.id, created_at:o.created_at,
        title:o.kind==="cancel"?"طلب إلغاء من عميل":"اعتراض على طلب",
        detail:"طلب مرتبط بالشحن · " + String(o.reason||"").slice(0,170),
      })),
      ...deposits.map((o:any) => ({
        kind:"deposits", id:o.id, created_at:o.created_at,
        title:"إيداع جديد بانتظار المراجعة",
        detail:String(o.method_name||"وسيلة دفع") + " · " +
          String(o.amount||"") + " " + String(o.currency||""),
      })),
      ...verifications.map((o:any) => ({
        kind:"verification", id:o.id, created_at:o.created_at,
        title:"طلب توثيق هوية جديد",
        detail:"مستندات الهوية الخاصة تنتظر مراجعة موظف مخوّل",
      })),
      ...users.map((o:any) => ({
        kind:"users", id:o.id, created_at:o.created_at,
        title:"حساب جديد في المتجر",
        detail:String(o.display_name||"عميل جديد").slice(0,100),
      })),
    ];
    return { items:items.sort((x,y)=>String(y.created_at).localeCompare(String(x.created_at))).slice(0,45) };
  }
  if (action === "staff.alerts") {
    requireRole(a, "manager", "admin", "support");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const checks = await Promise.all([
      db.from("f90_orders").select("id", { count: "exact", head: true })
        .in("status", ["pending", "queued", "submitting", "processing", "review"]),
      db.from("f90_deposits").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("f90_verifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("f90_order_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    ]);
    checks.forEach((r) => { if (r.error) throw r.error; });
    return { orders: checks[0].count || 0, deposits: checks[1].count || 0,
      verification: checks[2].count || 0, requests: checks[3].count || 0,
      new_users_24h: checks[4].count || 0,
    };
  }
  if (action === "staff.order_requests") {
    requireRole(a, "manager", "admin", "support");
    const offset = integer(b.offset || 0, 0, 100000);
    let query = db.from("f90_order_requests")
      .select("id,order_id,user_id,kind,reason,status,review_note,created_at,reviewed_at", { count: "exact" })
      .order("created_at", { ascending: false }).range(offset, offset + 49);
    if (b.status === "pending") query = query.eq("status", "pending");
    const response = await query;
    const items = check(response);
    const orderIds = [...new Set(items.map((x: any) => x.order_id))];
    const userIds = [...new Set(items.map((x: any) => x.user_id))];
    const orders = orderIds.length ? check(await db.from("f90_orders")
      .select("*")
      .in("id", orderIds)) : [];
    const users = userIds.length ? check(await db.from("profiles")
      .select("id,customer_id,display_name").in("id", userIds)) : [];
    return { count: response.count, items: items.map((x: any) => ({ ...x,
      order: { ...orders.find((o: any) => o.id === x.order_id),
        customer: users.find((u: any) => u.id === x.user_id) },
      customer: users.find((u: any) => u.id === x.user_id),
    })) };
  }
  if (action === "staff.review_order_request") {
    requireRole(a, "manager", "admin");
    if (!["approved", "rejected"].includes(b.status)) throw new AppError("F90_FIELDS");
    const id = uuid(b.id);
    const note = text(b.note, 2000).trim();
    if (note.length < 3) throw new AppError("F90_FIELDS", 400, "اكتب سبب القرار للعميل");
    const request = check(await db.from("f90_order_requests")
      .update({ status: b.status, review_note: note, reviewed_by: a.id,
        reviewed_at: new Date().toISOString() })
      .eq("id", id).eq("status", "pending")
      .select("id,order_id,user_id,kind,status,review_note,reviewed_at")
      .maybeSingle());
    if (!request) throw new AppError("F90_NOT_FOUND", 409, "الطلب راجعه مدير آخر أو لم يعد متاحًا");
    await auditSafe(a.id, "order.request.review", request.order_id,
      { request_id: id, kind: request.kind, status: request.status });
    return request;
  }
  if (action === "staff.availability.set") {
    requireRole(a,"manager");
    if(a.keyId)throw new AppError("F90_FORBIDDEN");
    const ids=Array.isArray(b.ids)?[...new Set(b.ids.map((v:unknown)=>uuid(v)))]:[];
    if(!ids.length||ids.length>100)throw new AppError("F90_FIELDS",400,"اختر من 1 إلى 100 خدمة");
    const state=String(b.availability||"");
    if(!["available","refilling","automatic"].includes(state))throw new AppError("F90_FIELDS");
    const list=check(await db.from("products").select("id,commerce").in("id",ids));
    if(list.length!==ids.length)throw new AppError("F90_NOT_FOUND",404);
    for(const p of list){
      const c=p.commerce||{};
      const override=state==="automatic"?null:state;
      const supplier=c.supplier_refilling===true;
      const availability=override||(supplier?"refilling":(c.supplier_previous_availability==="refilling"?"refilling":"available"));
      const updated={...c,manual_availability_override:override,availability};
      check(await db.from("products").update({commerce:updated}).eq("id",p.id).select("id").single());
    }
    await auditSafe(a.id,"catalog.availability.bulk","products",{ids,state});
    return {saved:list.length,state};
  }
  if (action === "staff.catalog") {
    requireRole(a, "manager", "designer");
    const rows = await Promise.all(
      ["categories", "products", "banners"].map((t) =>
        db.from(t).select("*").order("sort_order"),
      ),
    );
    const allProviders = check(await db.from("f90_providers")
      .select("id,name,is_enabled,config"));
    const internals = check(await db.from("f90_product_internal").select("*"));
    const managedProviders = allProviders.filter((p: any) => !p.config?.archived_at && !p.config?.disconnected);
    const managedProviderIds = new Set(managedProviders.map((p: any) => p.id));
    const managedProductIds = new Set(internals.filter((i: any) => managedProviderIds.has(i.provider_id))
      .map((i: any) => i.product_id));
    const ownerCategoryIds = new Set(check(rows[0])
      .filter((c: any) => ["money-transfer", "account-sales", "design-services", "complete-website"].includes(c.slug))
      .map((c: any) => c.id));
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const c of check(rows[0])) if (c.parent_id && ownerCategoryIds.has(c.parent_id) && !ownerCategoryIds.has(c.id)) {
        ownerCategoryIds.add(c.id); expanded = true;
      }
    }
    const linkedProductIds = new Set(internals.map((i: any) => i.product_id));
    return {
      categories: check(rows[0]),
      products: check(rows[1]).filter((p: any) => p.is_active === false || managedProductIds.has(p.id) ||
        (ownerCategoryIds.has(p.category_id) && !linkedProductIds.has(p.id))),
      banners: check(rows[2]),
      internal: a.role === "manager" ? internals.filter((i: any) => managedProviderIds.has(i.provider_id) || !i.provider_id) : [],
      providers: a.role === "manager" ? managedProviders.map(({ id, name, is_enabled, adapter }: any) =>
        ({ id, name, is_enabled, adapter })) : [],
    };
  }
  if (action === "catalog.save") return catalogSave(a, b);
  if (action === "catalog.duplicate") {
    requireRole(a, "manager", "designer");
    const tables: any = {
      category: "categories",
      product: "products",
      banner: "banners",
    };
    if (!tables[b.kind]) throw new AppError("F90_FIELDS");
    const source = check(
      await db.from(tables[b.kind]).select("*").eq("id", uuid(b.id)).single(),
    );
    const draft = (row: any) => ({
      ...row,
      name: `${row.name || row.title} — نسخة`,
      slug: `${row.slug || "banner"}-copy-${crypto.randomUUID().slice(0, 8)}`,
      title: `${row.title || ""} — نسخة`,
      is_active: false,
      sort_order: Number(row.sort_order) + 1,
    });
    const data: any = draft(source);
    if (b.kind === "product" && a.role === "manager")
      data.internal = check(
        await db
          .from("f90_product_internal")
          .select("*")
          .eq("product_id", source.id)
          .maybeSingle(),
      );
    let branches: any[] = [];
    let items: any[] = [];
    if (b.kind === "category" && (b.with_products || b.with_children)) {
      const all = check(await db.from("categories").select("*"));
      const queue = [source.id],
        seen = new Set<string>(queue);
      while (queue.length) {
        const parent = queue.shift();
        if (!b.with_children) continue;
        for (const c of all.filter(
          (c: any) => c.parent_id === parent && !seen.has(c.id),
        )) {
          branches.push(c);
          seen.add(c.id);
          queue.push(c.id);
        }
      }
      items = b.with_products
        ? check(
            await db
              .from("products")
              .select("*")
              .in("category_id", [...seen]),
          )
        : [];
      if (branches.length + items.length > 100)
        throw new AppError(
          "F90_FIELDS",
          400,
          "هذا القسم كبير. كرّر الأقسام الفرعية على دفعات لا تتجاوز مئة عنصر",
        );
    }
    const saved = await catalogSave(a, { kind: b.kind, data });
    if (b.kind === "category") {
      const mapped = new Map<string, string>([[source.id, saved.id]]);
      for (const c of branches) {
        const clone = await catalogSave(a, {
          kind: "category",
          data: {
            ...draft(c),
            is_active: c.is_active,
            parent_id: mapped.get(c.parent_id),
          },
        });
        mapped.set(c.id, clone.id);
      }
      for (const p of items) {
        const productData: any = {
          ...draft(p),
          is_active: p.is_active,
          category_id: mapped.get(p.category_id),
        };
        if (a.role === "manager")
          productData.internal = check(
            await db
              .from("f90_product_internal")
              .select("*")
              .eq("product_id", p.id)
              .maybeSingle(),
          );
        await catalogSave(a, { kind: "product", data: productData });
      }
    }
    return saved;
  }
  if (action === "catalog.delete") {
    requireRole(a, "manager", "designer");
    const table = (
      { category: "categories", product: "products", banner: "banners" } as any
    )[b.kind];
    if (!table) throw new AppError("F90_FIELDS");
    const id = uuid(b.id);
    if (table === "categories") {
      const children = check(
        await db.from("categories").select("id").eq("parent_id", id),
      );
      const products = check(
        await db.from("products").select("id").eq("category_id", id),
      );
      if (children.length || products.length)
        throw new AppError(
          "F90_FIELDS",
          409,
          "انقل المنتجات والأقسام الفرعية قبل حذف القسم",
        );
    }
    check(await db.from(table).delete().eq("id", id));
    return { deleted: true };
  }
  if (action === "catalog.reorder") {
    requireRole(a, "manager", "designer");
    const table = (
      { category: "categories", product: "products", banner: "banners" } as any
    )[b.kind];
    if (!table || !Array.isArray(b.ids) || b.ids.length > 500)
      throw new AppError("F90_FIELDS");
    for (let n = 0; n < b.ids.length; n++)
      check(
        await db.from(table).update({ sort_order: n }).eq("id", uuid(b.ids[n])),
      );
    return { saved: true };
  }
  if (action === "staff.list") {
    const table = (
      {
        orders: "f90_orders",
        deposits: "f90_deposits",
        verification: "f90_verifications",
        audit: "f90_audit",
        users: "profiles",
        ledger: "f90_wallet_ledger",
      } as any
    )[b.kind];
    if (!table) throw new AppError("F90_FIELDS");
    if(b.kind==="audit")securityManager(a);
    requireRole(
      a,
      ...(b.kind === "users" || b.kind === "audit"
        ? ["manager"]
        : b.kind === "orders"
          ? ["manager", "admin", "support"]
          : ["manager", "admin"]),
    );
    let query = db
      .from(table)
      .select(b.kind === "ledger" ? "id,user_id,amount_usd,balance_after,kind,reference_id,description,actor_id,created_at" : "*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(
        integer(b.offset || 0, 0, 100000),
        integer(b.offset || 0, 0, 100000) + 49,
      );
    if (b.kind === "ledger") {
      if (b.ledger_kind) {
        const ledgerKind = text(b.ledger_kind, 30);
        if (!["deposit", "purchase", "refund", "adjustment"].includes(ledgerKind))
          throw new AppError("F90_FIELDS");
        query = query.eq("kind", ledgerKind);
      }
      for (const key of ["from", "to"] as const) {
        if (!b[key]) continue;
        const value = text(b[key], 40);
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)))
          throw new AppError("F90_FIELDS");
        query = key === "from" ? query.gte("created_at", value) : query.lt("created_at", value);
      }
      if (b.from && b.to && Date.parse(b.from) >= Date.parse(b.to))
        throw new AppError("F90_FIELDS");
      if (b.customer_id) {
        const customerId = text(b.customer_id, 50);
        const profile = check(await db.from("profiles").select("id").eq("customer_id", customerId).maybeSingle());
        if (!profile) return { items: [], count: 0 };
        query = query.eq("user_id", profile.id);
      }
      query = query.order("id", { ascending: false });
    }
    if (b.status && b.kind !== "ledger")
      query = query.eq(
        b.kind === "users" ? "account_status" : "status",
        text(b.status, 30),
      );
    if (b.user_id)
      query = query.eq(
        table === "profiles" ? "id" : "user_id",
        uuid(b.user_id),
      );
    if (b.kind === "users" && b.search) {
      const s = text(b.search, 100).replace(/[,%()\\]/g, "");
      query = query.or(
        `email.ilike.%${s}%,customer_id.ilike.%${s}%,display_name.ilike.%${s}%`,
      );
    }
    const result = await query;
    const items = check(result);
    if (b.kind === "users") {
      const ids = items.map((p: any) => p.id);
      const roles = ids.length
        ? check(await db.from("f90_user_roles").select("*").in("user_id", ids))
        : [];
      const wallets = ids.length
        ? check(await db.from("f90_wallets").select("*").in("user_id", ids))
        : [];
      return {
        items: items.map((p: any) => ({
          ...p,
          role: roles.find((r: any) => r.user_id === p.id)?.role,
          balance_usd: wallets.find((w: any) => w.user_id === p.id)
            ?.balance_usd,
        })),
        count: result.count,
      };
    }
    const ids = [...new Set(items.flatMap((p: any) => [p.user_id,p.actor_id,p.reviewed_by]).filter(Boolean))];
    const profiles = ids.length
      ? check(
          await db
            .from("profiles")
            .select("id,display_name,customer_id,email,account_currency")
            .in("id", ids),
        )
      : [];
    return {
      items: items.map((p: any) => ({
        ...p,
        customer: profiles.find((u: any) => u.id === p.user_id),
        actor: profiles.find((u: any) => u.id === p.actor_id),
        reviewer: profiles.find((u: any) => u.id === p.reviewed_by),
      })),
      count: result.count,
    };
  }
  if (action === "staff.trader_keys") {
    requireRole(a, "manager");
    return check(
      await db
        .from("f90_api_keys")
        .select("id,name,token_prefix,scopes,requests_per_minute,is_active,created_at,expires_at,last_used_at,allow_all_ips,allowed_ips")
        .eq("user_id", uuid(b.user_id))
        .order("created_at", { ascending: false }),
    );
  }
  if (action === "staff.traders") {
    requireRole(a, "manager");
    const offset = integer(b.offset || 0, 0, 100000);
    const result = await db.from("f90_user_roles")
      .select("user_id,updated_at", { count: "exact" })
      .eq("role", "trader").order("updated_at", { ascending: false })
      .range(offset, offset + 49);
    const roles = check(result);
    const ids = roles.map((r: any) => r.user_id);
    if (!ids.length) return { items: [], count: result.count };
    const [profiles, wallets, keys] = await Promise.all([
      db.from("profiles").select("id,display_name,customer_id,email,is_verified,account_status")
        .in("id", ids),
      db.from("f90_wallets").select("user_id,balance_usd").in("user_id", ids),
      db.from("f90_api_keys").select("id,user_id,is_active").in("user_id", ids),
    ]);
    return { count: result.count, items: roles.map((r: any) => ({
      ...check(profiles).find((p: any) => p.id === r.user_id),
      id: r.user_id,
      balance_usd: check(wallets).find((w: any) => w.user_id === r.user_id)?.balance_usd ?? 0,
      active_keys: check(keys).filter((k: any) => k.user_id === r.user_id && k.is_active).length,
    })) };
  }
  if (action === "staff.erase_verification") {
    requireRole(a, "manager");
    const id = uuid(b.id),
      v = check(
        await db.from("f90_verifications").select("*").eq("id", id).single(),
      );
    if (v.status === "pending")
      throw new AppError(
        "F90_FIELDS",
        409,
        "أكمل مراجعة التوثيق قبل حذف المستندات",
      );
    check(
      await db.storage
        .from("f90-identity")
        .remove([v.front_path, v.back_path, v.selfie_path].filter(Boolean)),
    );
    check(
      await db
        .from("f90_verifications")
        .update({
          front_path: "",
          back_path: null,
          selfie_path: "",
          erased_at: new Date().toISOString(),
        })
        .eq("id", id),
    );
    check(
      await db.from("f90_audit").insert({
        actor_id: a.id,
        action: "identity.erase",
        target_id: id,
        details: { user_id: v.user_id },
      }),
    );
    return { erased: true };
  }
  if (action === "staff.review_deposit")
    return rpc("f90_review_deposit", {
      p_actor: a.id,
      p_id: uuid(b.id),
      p_approve: !!b.approve,
      p_note: text(b.note),
    });
  if (action === "staff.review_verification") {
    securityManager(a);
    return rpc("f90_review_verification", {
      p_actor: a.id,
      p_id: uuid(b.id),
      p_approve: !!b.approve,
      p_note: text(b.note),
    });
  }
  if (action === "staff.order") {
    requireRole(a, "manager", "admin");
    return rpc("f90_order_transition", {
      p_actor: a.id,
      p_id: uuid(b.id),
      p_status: text(b.status, 30),
      p_note: text(b.note),
      p_external: text(b.provider_order_id, 200) || null,
      p_cost:
        a.role !== "manager" || b.cost_usd == null || b.cost_usd === ""
          ? null
          : num(b.cost_usd),
      p_refund: b.refund == null ? null : num(b.refund),
    });
  }
  if (action === "staff.telegram.discover") {
    if(a.keyId)throw new AppError("F90_FORBIDDEN");
    requireRole(a,"manager");
    const bot=text(b.bot_token,180);
    if(!/^[0-9]{6,}:[A-Za-z0-9_-]{20,}$/.test(bot))
      throw new AppError("F90_FIELDS",400,"أدخل رمز بوت تلجرام الصحيح أولًا");
    let response:Response;
    try {
      response=await fetch("https://api.telegram.org/bot"+bot+"/getUpdates?limit=30&timeout=0",{
        signal:AbortSignal.timeout(10000)
      });
    } catch {throw new AppError("F90_FIELDS",503,"تعذر الاتصال بتلجرام لاكتشاف المحادثات");}
    const data=await response.json().catch(()=>null);
    if(!response.ok||data?.ok!==true)
      throw new AppError("F90_FIELDS",400,"لم يستجب بوت تلجرام؛ تأكد من التوكن ووقف أي Webhook قديم");
    const chats=new Map<string,any>();
    for(const update of data.result||[]){
      const c=update?.message?.chat || update?.my_chat_member?.chat || update?.channel_post?.chat ||
        update?.callback_query?.message?.chat;
      if(c?.id!=null){
        const id=String(c.id);
        if(/^-?[0-9]{4,}$/.test(id))
          chats.set(id,{id,type:String(c.type||"private").slice(0,35),
            name:String(c.title||c.first_name||c.username||"محادثة تلجرام").slice(0,90)});
      }
    }
    return {chats:Array.from(chats.values()).slice(0,12)};
  }
  if (action === "staff.telegram.connect") {
    if(a.keyId)throw new AppError("F90_FORBIDDEN");
    requireRole(a,"manager");
    const bot=text(b.bot_token,180),chat=text(b.chat_id,40);
    if(!/^[0-9]{6,}:[A-Za-z0-9_-]{20,}$/.test(bot)||! /^-?[0-9]{4,}$/.test(chat))
      throw new AppError("F90_FIELDS",400,"أدخل توكن بوت تلجرام ومعرّف المحادثة بصيغة صحيحة");
    let response:Response;
    try{
      response=await fetch("https://api.telegram.org/bot"+bot+"/getChat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({chat_id:chat}),signal:AbortSignal.timeout(10000)
      });
    }catch{
      throw new AppError("F90_FIELDS",503,"تعذّر الاتصال بتلجرام للتحقق من البوت، حاول لاحقًا");
    }
    const verification=await response.json().catch(()=>null);
    if(!response.ok||verification?.ok!==true)
      throw new AppError("F90_FIELDS",400,"تعذّر التحقق من المحادثة. افتح بوت تلجرام وأرسل /start ثم تأكد من Chat ID");
    return rpc("f90_telegram_configure",{p_actor:a.id,p_bot_token:bot,p_chat_id:chat});
  }
  if (action === "staff.telegram.test") {
    if(a.keyId)throw new AppError("F90_FORBIDDEN");
    requireRole(a,"manager");
    const configured=check(await db.rpc("f90_telegram_credentials"));
    if(!configured?.token || !configured?.chat || !configured?.dispatch)
      throw new AppError("F90_FIELDS",409,"اربط بوت تلجرام أولًا قبل إرسال تجربة");
    const result=check(await db.from("f90_telegram_alerts").insert({
      event_key:"test:"+crypto.randomUUID(),event_type:"test",
      payload:{created_at:new Date().toISOString()}
    }).select("id").single());
    await auditSafe(a.id,"telegram.test",String(result.id),{kind:"delivery_check"});
    return {queued:true,id:result.id};
  }
  if (action === "staff.salary.list") {
    if (a.keyId) throw new AppError("F90_FORBIDDEN");
    requireRole(a, "manager", "admin");
    const rows = check(await db.from("f90_salary_requests")
      .select("id,user_id,account_id,coins,usd_amount,status,created_at,reviewed_at,review_note,payout_currency,payout_amount,client_note,receipt_path")
      .order("created_at", { ascending: false }).limit(150));
    const ids = [...new Set(rows.map((x: any) => x.user_id))];
    const users = ids.length ? check(await db.from("profiles")
      .select("id,display_name,customer_id,account_currency").in("id",ids)) : [];
    const profiles = new Map(users.map((p: any) => [p.id,p]));
    return { items: rows.map((x: any) => ({...x,customer:profiles.get(x.user_id)||null})),
      pending: rows.filter((x: any) => x.status === "pending").length };
  }
  // This diagnostic checks Telegram's configured destination without
  // exposing bot credentials or a complete chat ID to the browser.
  if (action === "staff.telegram.destination") {
    if (a.keyId) throw new AppError("F90_FORBIDDEN");
    requireRole(a, "manager");
    const creds = check(await db.rpc("f90_telegram_credentials"));
    const bot = String(creds?.token || ""), chat = String(creds?.chat || "");
    if (!bot || !chat) return { configured: false };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const [target, me] = await Promise.all([
        fetch("https://api.telegram.org/bot" + bot + "/getChat?chat_id=" + encodeURIComponent(chat),
          { signal: controller.signal }),
        fetch("https://api.telegram.org/bot" + bot + "/getMe", { signal: controller.signal })
      ]);
      const aChat = await target.json().catch(() => null);
      const aBot = await me.json().catch(() => null);
      if (!target.ok || aChat?.ok !== true)
        return { configured: true, verified: false, chat_suffix: chat.slice(-4) };
      const result = aChat.result || {}, botResult = aBot?.result || {};
      return {
        configured: true, verified: true, chat_suffix: chat.slice(-4),
        chat_title: text(result.title || [result.first_name, result.last_name].filter(Boolean).join(" ") || result.username || "محادثة خاصة", 120),
        chat_type: text(result.type || "", 24),
        chat_username: text(result.username || "", 120),
        bot_username: me.ok && aBot?.ok === true ? text(botResult.username || "", 120) : ""
      };
    } catch {
      return { configured: true, verified: false, chat_suffix: chat.slice(-4) };
    } finally {
      clearTimeout(timer);
    }
  }
  if (action === "staff.telegram") {
    if(a.keyId)throw new AppError("F90_FORBIDDEN");
    requireRole(a,"manager");
    const q=await db.from("f90_telegram_alerts")
      .select("id,event_type,status,created_at,last_error,attempt_count")
      .order("created_at",{ascending:false}).limit(25);
    if(q.error)throw q.error;
    const pending=(q.data||[]).filter((x:any)=>["pending","failed","sending"].includes(x.status)).length;
    const credentials=check(await db.rpc("f90_telegram_credentials"));
    const configured=!!(credentials?.token && credentials?.chat && credentials?.dispatch);
    return {status:configured?"configured":"configuration_required",configured,
      recent:q.data||[],pending_recent:pending,
      info:"Bot credentials are encrypted in Supabase Vault and are never returned to browsers."};
  }
  if (action === "staff.runtime") {
    requireRole(a, "manager");
    const started = performance.now();
    const checks = await Promise.allSettled([
      db.from("f90_orders").select("id",{count:"exact",head:true}).in("status",["queued","submitting","processing","review"]),
      db.from("f90_deposits").select("id",{count:"exact",head:true}).eq("status","pending"),
      db.from("f90_notification_outbox").select("id",{count:"exact",head:true}).eq("status","pending")
    ]);
    const countAt = (i: number) => checks[i].status==="fulfilled" && !(checks[i].value as any).error
      ? (checks[i].value as any).count : null;
    return {
      collected_at:new Date().toISOString(),
      database:checks.every(x=>x.status==="fulfilled" && !(x.value as any).error)?"connected":"partial",
      sample_latency_ms:Math.round(performance.now()-started),
      active_orders:countAt(0),
      pending_deposits:countAt(1),
      pending_outbox:countAt(2),
      runtime:{
        platform:"Supabase Edge Functions",
        api_version:3,
        financial_base_currency:"USD",
        endpoint_configured:!!Deno.env.get("SUPABASE_URL"),
        server_credentials_configured:!!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      },
      note:"يتم عرض حالة إعداد المتغيرات فقط، ولا يتم كشف قيم مفاتيح التشغيل."
    };
  }
  if (action === "staff.finance") {
    requireRole(a, "manager");
    const userId = uuid(b.id);
    const [wallet, discount, rows, profile] = await Promise.all([
      db.from("f90_wallets").select("balance_usd").eq("user_id", userId).single(),
      db.from("f90_user_discounts").select("extra_discount_percent,purchase_markup_percent,purchase_markup_enabled").eq("user_id", userId).maybeSingle(),
      db.from("f90_wallet_ledger").select("id,amount_usd,balance_after,kind,description,created_at,actor_id,reference_id")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      db.from("profiles").select("id,display_name,customer_id,email").eq("id",userId).single(),
    ]);
    return {
      profile: check(profile),
      balance_usd: check(wallet).balance_usd,
      extra_discount_percent: check(discount)?.extra_discount_percent ?? 0,
      purchase_markup_percent: check(discount)?.purchase_markup_percent ?? 0,
      purchase_markup_enabled: check(discount)?.purchase_markup_enabled === true,
      ledger: check(rows),
    };
  }
  if (action === "staff.markup") {
    securityManager(a);
    if (typeof b.enabled !== "boolean") throw new AppError("F90_FIELDS");
    return rpc("f90_set_user_markup", { p_actor:a.id, p_user:uuid(b.id), p_percent:num(b.percent,0,10000), p_enabled:b.enabled===true });
  }
  if (action === "staff.currency_pricing") {
    securityManager(a);
    if (typeof b.enabled !== "boolean") throw new AppError("F90_FIELDS");
    return rpc("f90_currency_pricing_toggle", {p_actor:a.id,p_enabled:b.enabled,p_reason:text(b.reason,500)});
  }
  if (action === "staff.discount") {
    requireRole(a, "manager");
    return rpc("f90_set_user_discount", {
      p_actor: a.id,
      p_user: uuid(b.id),
      p_percent: num(b.percent, 0, 50),
    });
  }
  if (action === "staff.adjust") {
    requireRole(a, "manager");
    if (b.currency !== undefined) {
      if (a.keyId) throw new AppError("F90_FORBIDDEN");
      return rpc("f90_finance_adjust_currency",{p_actor:a.id,p_user:uuid(b.id),p_amount:num(b.amount,-1000000000,1000000000),p_currency:text(b.currency,8).toUpperCase(),p_note:text(b.note,500),p_request:uuid(b.request_id),p_expected:num(b.expected_balance,0,1e12),p_expected_rate:num(b.expected_rate,0.00000001,1e12)});
    }
    const amount = Number(b.amount_usd);
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000)
      throw new AppError("F90_AMOUNT");
    return rpc("f90_finance_adjust", {
      p_actor: a.id,
      p_user: uuid(b.id),
      p_amount: amount,
      p_note: text(b.note, 500),
      p_request: uuid(b.request_id),
      p_expected: num(b.expected_balance,0,1e12),
    });
  }
  if (action === "staff.sync_recipient_name") {
    requireRole(a, "manager", "admin");
    if (a.keyId) throw new AppError("F90_FORBIDDEN");
    const id=uuid(b.id);
    const row=check(await db.from("f90_orders")
      .select("id,status,provider_id,provider_order_id,supplier_account_name,supplier_name_check_attempts")
      .eq("id",id).single());
    const linked=check(await db.from("f90_providers")
      .select("adapter").eq("id",row.provider_id).single());
    if(linked.adapter!=="yassen" || row.status!=="completed" || !row.provider_order_id)
      throw new AppError("F90_FIELDS",400,"اسم الحساب متاح للمزامنة فقط للطلبات المكتملة عند ياسين");
    if(row.supplier_account_name)
      return {saved:true,name:row.supplier_account_name,previous:true};
    return syncCompletedSupplierName(row);
  }
  if (action === "staff.revoke_verification" || action === "staff.manual_verify") {
    securityManager(a);
    const reason=text(b.reason,500).trim();
    if(reason.length<8)throw new AppError("F90_FIELDS",400,"اكتب سبب القرار من 8 أحرف على الأقل");
    return rpc("f90_security_verification",{p_actor:a.id,p_actor_session:a.sessionId,p_user:uuid(b.id),p_verified:action==="staff.manual_verify",p_reason:reason});
  }
  if (action === "staff.user") {
    securityManager(a);
    if (b.role && !roleNames.includes(b.role)) throw new AppError("F90_FIELDS");
    return rpc("f90_change_user", {
      p_actor: a.id,
      p_user: uuid(b.id),
      p_role: b.role || null,
      p_status: b.status || null,
      p_vip: b.vip ? integer(b.vip, 1, 15) : null,
      p_clear_vip: !!b.clear_vip,
    });
  }
  if (action === "staff.reset_password") {
    requireRole(a, "manager");
    const p = check(
      await db.from("profiles").select("email").eq("id", uuid(b.id)).single(),
    );
    const origins =
      check(
        await db.from("site_settings").select("config").eq("id", 1).single(),
      ).config.allowed_origins || [];
    let redirect: URL;
    try {
      redirect = recoveryRedirect(b.redirect_to, origins);
    } catch {
      throw new AppError("F90_FIELDS");
    }
    check(
      await db.auth.resetPasswordForEmail(p.email, {
        redirectTo: redirect.href,
      }),
    );
    return { sent: true };
  }
  if (action === "staff.report") {
    requireRole(a, "manager", "admin");
    if (!/^\d{4}-\d{2}$/.test(b.month)) throw new AppError("F90_FIELDS");
    return rpc("f90_report", { p_actor: a.id, p_month: `${b.month}-01` });
  }
  if (action === "staff.file") {
    requireRole(a, "manager", "admin");
    let bucket: string, path: string;
    if (b.kind === "salary") {
      const d = check(
        await db
          .from("f90_salary_requests")
          .select("receipt_path")
          .eq("id", uuid(b.id))
          .single(),
      );
      bucket = "f90-receipts";
      path = d.receipt_path;
    } else if (b.kind === "deposit") {
      const d = check(
        await db
          .from("f90_deposits")
          .select("receipt_path")
          .eq("id", uuid(b.id))
          .single(),
      );
      bucket = "f90-receipts";
      path = d.receipt_path;
    } else {
      const d = check(
        await db
          .from("f90_verifications")
          .select("front_path,back_path,selfie_path")
          .eq("id", uuid(b.id))
          .single(),
      );
      bucket = "f90-identity";
      const part = (
        {
          front: "front_path",
          back: "back_path",
          selfie: "selfie_path",
        } as Record<string, "front_path" | "back_path" | "selfie_path">
      )[text(b.part)];
      if (!part) throw new AppError("F90_FIELDS");
      path = d[part];
    }
    if (!path) throw new AppError("F90_NOT_FOUND");
    return check(await db.storage.from(bucket).createSignedUrl(path, 300));
  }
  if (action === "settings.save") {
    requireRole(a, "manager");
    const d = b.data || {};
    const current = check(
      await db.from("site_settings").select("*").eq("id", 1).single(),
    );
    const c = d.config || {};
    delete c.name_en;
    // Never permit manager-only media paths to leak through the public settings API.
    if(c.music){
      c.music={enabled:c.music.enabled===true,volume:Number(c.music.volume??0.35),loop:true,
        bubble: (current.config?.music?.bubble)||{}};
    }
    // Only public configuration belongs in this row. Reject accidental credential fields.
    if (
      /"(?:token|secret|api_key|password|service_role)"\s*:/i.test(
        JSON.stringify(c),
      )
    )
      throw new AppError(
        "F90_FIELDS",
        400,
        "لا تضع مفاتيح أو كلمات مرور داخل إعدادات الموقع العامة",
      );
    // Other administration pages may save an older config snapshot. Do not
    // accidentally remove the salary payout table when they save unrelated
    // settings; only the dedicated editor sends payout_options explicitly.
    const previousSalary = current.config?.salary_withdrawal || {};
    const incomingSalary = c.salary_withdrawal;
    if (Array.isArray(previousSalary.payout_options) &&
        (!incomingSalary || !Array.isArray(incomingSalary.payout_options))) {
      c.salary_withdrawal = {
        ...previousSalary,
        ...(incomingSalary && typeof incomingSalary === "object" ? incomingSalary : {}),
        payout_options: previousSalary.payout_options,
      };
    }
    if (Array.isArray(c.salary_withdrawal?.payout_options)) {
      const rows = c.salary_withdrawal.payout_options;
      if (!rows.length || rows.length > 40) throw new AppError("F90_FIELDS");
      const seen = new Set<string>();
      c.salary_withdrawal.payout_options = rows.map((x: any) => {
        const currency = text(x.currency, 8).toUpperCase();
        const per100k = Number(x.per_100k);
        const perUsd = currency === "USD" ? 1 : Number(x.units_per_usd);
        if (!/^[A-Z]{3,8}$/.test(currency) || seen.has(currency) ||
            !Number.isFinite(per100k) || per100k <= 0 || per100k > 1e12 ||
            !Number.isFinite(perUsd) || perUsd <= 0 || perUsd > 1e12)
          throw new AppError("F90_FIELDS");
        seen.add(currency);
        return {
          currency, label_ar: text(x.label_ar || currency, 80),
          per_100k: per100k, units_per_usd: perUsd, enabled: x.enabled === true,
        };
      });
    }
    if (c.payment_methods) {
      c.payment_methods = c.payment_methods.slice(0, 50).map((m: any) => ({
        ...m,
        id: text(m.id, 100) || crypto.randomUUID(),
        name_ar: text(m.name_ar, 150),
        image_url: text(m.image_url, 2000),
        barcode_url: text(m.barcode_url, 2000),
        details_ar: text(m.details_ar, 8000),
        accepted_currencies: Array.isArray(m.accepted_currencies) ? m.accepted_currencies.slice(0,20).map((code:any)=>text(code,8).toUpperCase()).filter((code:string)=>/^[A-Z]{3,8}$/.test(code)) : undefined,
        enabled: !!m.enabled,
      }));
    }
    const data = {
      store_name: text(d.store_name || current.store_name, 100),
      logo_url:
        d.logo_url === undefined
          ? current.logo_url
          : text(d.logo_url, 2000) || null,
      primary_color: /^#[0-9a-f]{6}$/i.test(d.primary_color)
        ? d.primary_color
        : current.primary_color,
      announcement: text(d.announcement, 1000),
      contact_email: text(d.contact_email, 200),
      currency: (await (async () => { const c = text(d.currency || current.currency || "USD", 8).toUpperCase(); const r = check(await db.from("f90_rates").select("currency,is_enabled,per_usd").eq("currency",c).maybeSingle()); if(!r || !r.is_enabled || Number(r.per_usd)<=0) throw new AppError("F90_RATE_MISSING"); return c; })()),
      config: { ...current.config, ...c, version: 3 },
    };
    return check(
      await db.from("site_settings").update(data).eq("id", 1).select().single(),
    );
  }
  if (["staff.rate", "staff.rate.delete", "staff.rate.purge"].includes(action)) {
    requireRole(a, "manager");
    const currency = String(b.currency || "").trim().toUpperCase();
    const operation = action === "staff.rate" ? "save" : action === "staff.rate.delete" ? "delete" : "purge";
    return rpc("f90_manage_currency", {
      p_actor:a.id, p_action:operation, p_currency:currency,
      p_name:text(b.name_ar || "",100), p_rate:b.per_usd == null ? null : num(b.per_usd,0.00000001,100000000),
      p_enabled:b.is_enabled !== false,
    });
  }
  if (action === "staff.vip") {
    requireRole(a, "manager");
    const level = integer(b.level, 1, 15);
    return check(
      await db
        .from("f90_vip_tiers")
        .update({
          minimum_spend: level === 1 ? 0 : num(b.minimum_spend),
          discount_percent: level === 1 ? 0 : num(b.discount_percent, 0, 3),
        })
        .eq("level", level)
        .select()
        .single(),
    );
  }
  if (action === "staff.providers") {
    requireRole(a, "manager");
    return check(
      await db
        .from("f90_providers")
        .select(
          "id,name,endpoint,adapter,currency,is_enabled,margin_percent,config,created_at",
        )
        .order("created_at"),
    ).filter((p: any) => !p.config?.archived_at);
  }
  if (action === "provider.save") {
    requireRole(a, "manager");
    const adapter = b.adapter === "f90_merchant_get" ? "f90_merchant" :
      ["f90", "f90_merchant", "smm", "json", "omega", "yassen", "shihab"].includes(b.adapter) ? b.adapter : "smm";
    if (adapter !== "f90") endpointURL(b.endpoint);
    const old = b.id ? check(await db.from("f90_providers")
      .select("id,endpoint,adapter,currency,is_enabled,margin_percent,config")
      .eq("id", uuid(b.id)).single()) : null;
    if (old?.config?.archived_at) throw new AppError("F90_FIELDS", 400, "المورّد مؤرشف");
    if (!old && !b.token && !["f90","shihab"].includes(adapter)) throw new AppError("F90_FIELDS", 400, "أدخل مفتاح المورّد");
    if (adapter !== "f90" && new URL(b.endpoint).hostname === "api.yassen-card.com" && adapter !== "yassen")
      throw new AppError("F90_FIELDS", 400, "يجب اختيار بروتوكول ياسين كارد لهذا الرابط");
    if (adapter === "shihab" && new URL(b.endpoint).origin !== "https://api.shihabcard.com")
      throw new AppError("F90_FIELDS", 400, "استخدم رابط API شهاب المعتمد");
    if (adapter === "yassen" && new URL(b.endpoint).origin !== "https://api.yassen-card.com")
      throw new AppError("F90_FIELDS", 400, "استخدم رابط API العامل https://api.yassen-card.com");
    const endpoint = adapter === "f90" ? "https://www.f90card.online/" : text(b.endpoint, 2000);
    const currency = text(b.currency || "USD", 8);
    const f90Transport = adapter === "f90_merchant"
      ? b.adapter === "f90_merchant_get" || b.f90_transport === "get" ? "get"
        : b.f90_transport === "post" ? "post" : old?.config?.f90_transport === "get" ? "get" : "post"
      : null;
    const connectionChanged = !!old && (old.endpoint !== endpoint ||
      old.adapter !== adapter || (adapter === "f90_merchant" &&
        (old.config?.f90_transport || "post") !== f90Transport));
    if (old && old.currency !== currency)
      throw new AppError("F90_FIELDS", 400, "تغيير عملة المورّد يحتاج إعادة تسعير منتجاته أولًا؛ استخدم إعدادات الصرف والمزامنة");
    if (connectionChanged && !b.token && !["f90","shihab"].includes(adapter))
      throw new AppError("F90_FIELDS", 400, "أدخل مفتاح المورّد بعد تغيير رابط أو بروتوكول الاتصال");
    const autoOrders = adapter === "f90" ? false : b.automatic_orders_enabled == null
      ? old?.config?.automatic_orders_enabled === true
      : b.automatic_orders_enabled === true;
    if (adapter === "f90_merchant" && currency !== "USD")
      throw new AppError("F90_FIELDS", 400, "عملة API تجار F90 هي USD؛ اختر الدولار");
    if (autoOrders && adapter === "f90_merchant" && f90SelfEndpoint(endpoint))
      throw new AppError("F90_FIELDS", 400, "ربط المتجر بنفسه للفحص والاستيراد كمسودات فقط؛ أوقف الطلبات الآلية");
    if (autoOrders && adapter === "omega")
      throw new AppError("F90_FIELDS", 400, "أوميغا متاح للقراءة فقط حاليًا");
    const d = {
      name: text(b.name, 150),
      endpoint,
      adapter,
      currency,
      // Connection changes require a fresh read-only diagnosis before activation.
      is_enabled: adapter === "f90" ? (old ? !!old.is_enabled : true) :
        !!old?.is_enabled && !connectionChanged && !b.token,
      margin_percent: num(b.margin_percent ?? 20, 0, 10000),
      config: {
        ...(old?.config || {}),
        request_timeout_ms: integer(b.request_timeout_ms ?? old?.config?.request_timeout_ms ?? 20000, 5000, 30000),
        ...(adapter === "f90_merchant" ? { f90_transport: f90Transport } : {}),
        automatic_orders_enabled: autoOrders,
      },
    };
    // Reprice before saving the settings. An invalid margin must not leave
    // the provider showing a new percentage with old product prices.
    let marginUpdated: number | null = null;
    if (old && Number(old.margin_percent) !== Number(d.margin_percent)) {
      marginUpdated = await rpc("f90_provider_margin", {
        p_actor: a.id, p_provider: old.id, p_margin: d.margin_percent,
      });
    }
    const p = check(
      b.id
        ? await db
            .from("f90_providers")
            .update(d)
            .eq("id", uuid(b.id))
            .select()
            .single()
        : await db.from("f90_providers").insert(d).select().single(),
    );
    if (b.token && adapter !== "shihab")
      await rpc("f90_provider_secret", {
        p_actor: a.id,
        p_provider: p.id,
        p_secret: text(b.token, 10000),
      });
    await auditSafe(a.id, "provider.save", p.id,
      { connection_changed: connectionChanged, disabled: !d.is_enabled,
        adapter, automatic_orders_enabled: autoOrders });
    delete p.secret_id;
    return { ...p, margin_price_updates: marginUpdated };
  }
  if (action === "provider.toggle") {
    requireRole(a, "manager");
    const id = uuid(b.id);
    const current = check(await db.from("f90_providers").select("adapter,config")
      .eq("id", id).single());
    if (current.config?.archived_at) throw new AppError("F90_FIELDS", 400, "المورّد مؤرشف");
    if (typeof b.is_enabled !== "boolean") throw new AppError("F90_FIELDS");
    if (b.is_enabled && current.adapter !== "f90") {
      const services = await providerAction(id, "services");
      if (!Array.isArray(services))
        throw new AppError("F90_FIELDS", 400, "تعذّر قراءة خدمات المورّد؛ بقي موقوفًا");
    }
    const changed = check(
      await db.from("f90_providers")
        .update({ is_enabled: b.is_enabled })
        .eq("id", id)
        .select("id,name,is_enabled")
        .single(),
    );
    await db.from("f90_audit").insert({
      actor_id: a.id,
      action: "provider.toggle",
      target_id: id,
      details: { is_enabled: b.is_enabled },
    });
    return changed;
  }
  if (action === "provider.visibility") {
    requireRole(a, "manager");
    const id = uuid(b.id);
    if (typeof b.disconnected !== "boolean") throw new AppError("F90_FIELDS");
    const current = check(await db.from("f90_providers")
      .select("config").eq("id", id).single());
    if (current.config?.archived_at) throw new AppError("F90_FIELDS");
    if (!b.disconnected) {
      const services = await providerAction(id, "services");
      if (!Array.isArray(services)) throw new AppError("F90_UNAVAILABLE", 409, "تعذّر التحقق من اتصال المورّد");
    }
    const updated = check(await db.from("f90_providers")
      .update({ config: { ...current.config, disconnected: b.disconnected } })
      .eq("id", id).select("id,config").single());
    await auditSafe(a.id, "provider.visibility", id, { disconnected: b.disconnected });
    return updated;
  }
  if (action === "provider.archive") {
    requireRole(a, "manager");
    const id = uuid(b.id);
    await rpc("f90_archive_provider", { p_actor: a.id, p_provider: id });
    await auditSafe(a.id, "provider.archive", id, {});
    return { id, removed_from_catalog: true };
  }
  if (action === "catalog.bulk_products") {
    requireRole(a, "manager", "designer");
    if (!Array.isArray(b.ids) || b.ids.length < 1 || b.ids.length > 1000)
      throw new AppError("F90_FIELDS", 400, "اختر من منتج إلى ألف منتج");
    const ids = b.ids.map(uuid);
    const mode = text(b.mode, 20);
    if (!["show", "hide", "move", "image", "delete"].includes(mode))
      throw new AppError("F90_FIELDS");
    const value = mode === "move" ? uuid(b.value) :
      mode === "image" ? text(b.value || "", 2000) : null;
    return { changed: await rpc("f90_bulk_products",
      { p_actor: a.id, p_ids: ids, p_mode: mode, p_value: value }) };
  }
  if (action === "provider.services") {
    requireRole(a, "manager");
    const data = await providerAction(uuid(b.id), "services");
    if (!Array.isArray(data))
      throw new AppError(
        "F90_FIELDS",
        400,
        "قائمة خدمات المورّد غير متوافقة مع المحوّل",
      );
    return data.map(normalizeService).filter(Boolean);
  }
  if (action === "provider.smm_status") {
    requireRole(a, "manager");
    return rpc("f90_smm_status");
  }
  if (action === "provider.smm_approve") {
    requireRole(a, "manager");
    const productId = uuid(b.product_id);
    const result = await rpc("f90_smm_approve", { p_product: productId, p_actor: a.id });
    await auditSafe(a.id, "smm.approve", productId, {});
    return result;
  }
  if (action === "provider.smm_fetch") {
    requireRole(a, "manager");
    return smmCatalogFetch();
  }
  if (action === "provider.balance") {
    requireRole(a, "manager");
    return providerAction(uuid(b.id), "balance");
  }
  if (action === "provider.import") {
    requireRole(a, "manager");
    const id = uuid(b.id);
    const p = check(
      await db.from("f90_providers").select("*").eq("id", id).single(),
    );
    const services = (await providerAction(id, "services"))
      .map(normalizeService)
      .filter(Boolean);
    const rate = check(
      await db
        .from("f90_rates")
        .select("per_usd,is_enabled")
        .eq("currency", p.currency)
        .single(),
    );
    if (!rate.is_enabled || !rate.per_usd)
      throw new AppError("F90_RATE_MISSING");
    // Validate the entire batch before creating the first draft.
    // Never silently truncate an import or accept unknown/duplicate services.
    if (!Array.isArray(b.service_ids) || b.service_ids.length < 1 || b.service_ids.length > 100)
      throw new AppError("F90_FIELDS", 400, "اختر من خدمة واحدة إلى مئة خدمة في كل دفعة");
    const requested = b.service_ids.map((item: unknown) => text(item, 160));
    if (requested.some((id: string) => !id) || new Set(requested).size !== requested.length)
      throw new AppError("F90_FIELDS", 400, "توجد معرّفات خدمات فارغة أو مكررة");
    const categoryId = uuid(b.category_id);
    const allCategories = check(
      await db.from("categories").select("id,name"),
    );
    const categoryIds = new Set(allCategories.map((c: any) => c.id));
    if (!categoryIds.has(categoryId)) throw new AppError("F90_FIELDS", 400, "القسم غير موجود");
    // Individual service category IDs are verified server-side; the supplier
    // cannot select categories or create public catalog entries itself.
    const categoriesByService = b.category_ids && typeof b.category_ids === "object" &&
      !Array.isArray(b.category_ids) ? b.category_ids : {};
    const margin = Number(b.margin_percent ?? p.margin_percent);
    if (!Number.isFinite(margin) || margin < 0 || margin > 10000)
      throw new AppError("F90_FIELDS", 400, "هامش الربح غير صالح");
    const exchange = Number(rate.per_usd);
    if (!rate.is_enabled || !Number.isFinite(exchange) || exchange <= 0)
      throw new AppError("F90_RATE_MISSING");
    const serviceById = new Map(services.map((service: any) => [String(service.id), service]));
    const preview = requested.map((id: string) => {
      const service: any = serviceById.get(id);
      if (!service) throw new AppError("F90_FIELDS", 400, "خدمة مختارة غير موجودة لدى المورّد: " + id);
      const supplierPrice = Number(service.rate);
      const unit = Number(service.unit_quantity);
      const min = Number(service.min);
      const max = Number(service.max);
      const cost = supplierPrice / exchange;
      const price = Math.round(cost * (1 + margin / 100) * 1e6) / 1e6;
      if (![supplierPrice, unit, min, max, cost, price].every(Number.isFinite) ||
          supplierPrice <= 0 || unit <= 0 || min <= 0 || max < min || price <= 0)
        throw new AppError("F90_FIELDS", 400, "بيانات سعر أو كمية غير صالحة للخدمة " + id);
      const originalName = text(b.names?.[id] ?? service.name, 194);
      const name = p.adapter === "shihab" ? `F90 | ${originalName.replace(/^F90\s*[|:-]\s*/i, "")}` : originalName;
      if (!name) throw new AppError("F90_FIELDS", 400, "اسم الخدمة مفقود: " + id);
      const chosenCategoryId = uuid(categoriesByService[id] || categoryId);
      if (!categoryIds.has(chosenCategoryId))
        throw new AppError("F90_FIELDS", 400, "القسم المحدد للخدمة غير موجود: " + id);
      // Prices are marked up by 5% when Omega's configured margin is 5%;
      // the sale stays hidden until staff reviews the details and supplier.
      return { service, name, cost, price, chosenCategoryId };
    });
    const saved = [];
    for (const { service: s, name, cost, price, chosenCategoryId } of preview) {
      const existing = check(
        await db
          .from("f90_product_internal")
          .select("product_id")
          .eq("provider_id", id)
          .eq("provider_service", s.id)
          .maybeSingle(),
      );
      if (existing) {
        saved.push({ id: existing.product_id, skipped: true });
        continue;
      }
      const product = await catalogSave(a, {
        kind: "product",
        data: {
          name,
          ...(p.adapter === "smm" ? {
            description: "التفاصيل الأصلية للخدمة: " +
              String(s.raw?.name ?? s.name).slice(0, 9500) +
              (s.raw?.description ? "\n\nوصف الخدمة: " +
                String(s.raw.description).replace(/https?:\/\/[^\s<>]+/gi, "").slice(0, 9000) : ""),
          } : {}),
          category_id: chosenCategoryId,
          is_active: false,
          image_url: b.image_url || s.image_url || "",
          ...(p.adapter === "f90_merchant" ? { description: s.description || "" } : {}),
          commerce: {
            type: p.adapter === "f90_merchant" && s.type !== "quantity" ? "fixed" : "quantity",
            ...(p.adapter === "f90_merchant" ? {
              availability: s.availability, pack_quantity: s.pack_quantity,
            } : {}),
            ...(p.adapter === "shihab" ? {fulfillment_status:"unconfirmed"} : {}),
            fulfillment: p.adapter === "shihab" ? "manual" : p.config?.automatic_orders_enabled === true &&
              !s.allowed_quantities && p.adapter !== "omega" ? "automatic" : "manual",
            prices: { USD: price },
            unit_quantity: s.unit_quantity,
            quantity_min: s.min,
            quantity_max: s.max,
            quantity_step: p.adapter === "f90_merchant" ? s.quantity_step : s.allowed_quantities?.length > 1 &&
              s.allowed_quantities.every((v: number, i: number, ar: number[]) =>
                i === 0 || v - ar[i - 1] === ar[1] - ar[0])
              ? s.allowed_quantities[1] - s.allowed_quantities[0] : 1,
            fields: p.adapter === "f90_merchant" ? s.fields : s.params?.length
              ? s.params.map((label: string, i: number) => ({
                  id: "param_" + (i + 1),
                  label_ar: label,
                  type: "text",
                  required: true,
                }))
              : [{
                  id: "account_id",
                  label_ar: "رابط أو معرّف الحساب",
                  type: "text",
                  required: true,
                }],
          },
          internal: {
            provider_id: id,
            provider_service: s.id,
            cost_usd: cost,
            auto_margin: true,
          },
        },
      });
      saved.push(product);
    }
    return saved;
  }
  if (action === "provider.sync_prices") {
    requireRole(a, "manager");
    const id = uuid(b.id);
    const p = check(await db.from("f90_providers").select("*").eq("id", id).single());
    const services = (await providerAction(id, "services"))
      .map(normalizeService)
      .filter(Boolean);
    const exchange = check(
      await db.from("f90_rates").select("per_usd,is_enabled").eq("currency", p.currency).single(),
    );
    const perUSD = Number(exchange.per_usd);
    if (!exchange.is_enabled || !Number.isFinite(perUSD) || perUSD <= 0)
      throw new AppError("F90_RATE_MISSING");
    const margin = Number(p.margin_percent);
    if (!Number.isFinite(margin) || margin < 0 || margin > 10000)
      throw new AppError("F90_FIELDS", 400, "هامش ربح المورّد غير صالح");
    const rows = check(
      await db.from("f90_product_internal").select("*").eq("provider_id", id),
    );
    // Preflight ALL mapped services and current product pricing before any database writes.
    const byId = new Map<string, any>();
    for (const service of services) {
      const key = String(service.id);
      if (byId.has(key)) throw new AppError("F90_FIELDS", 400, "المورّد يعيد معرّفات خدمات مكررة");
      byId.set(key, service);
    }
    const productIds = rows.map((row: any) => row.product_id);
    // Keep the REST query URL well below reverse-proxy limits on large catalogs.
    const products: any[] = [];
    for (let offset = 0; offset < productIds.length; offset += 75) {
      const batch = check(await db.from("products")
        .select("id,category_id,commerce,price,is_active")
        .in("id", productIds.slice(offset, offset + 75)));
      products.push(...batch);
    }
    const productsById = new Map(products.map((product: any) => [product.id, product]));
    const categories = check(await db.from("categories")
      .select("id,parent_id,presentation"));
    const categoryById = new Map(categories.map((category: any) => [category.id, category]));
    const categoryMargin = (categoryId: string | null) => {
      let sum = 0;
      const seen = new Set<string>();
      let current = categoryId;
      while (current && !seen.has(current)) {
        seen.add(current);
        const category: any = categoryById.get(current);
        if (!category) break;
        sum += Number(category.presentation?.extra_margin_percent || 0);
        current = category.parent_id || null;
      }
      return sum;
    };
    const planned: any[] = [];
    const skipped: any[] = [];
    let missing = 0;
    for (const row of rows) {
      const service = byId.get(String(row.provider_service));
      if (!service) { missing++; continue; }
      const supplierRate = Number(service.rate);
      const cost = supplierRate / perUSD;
      const product: any = productsById.get(row.product_id);
      const extraMargin = product
        ? categoryMargin(product.category_id || null) +
          Number(product.commerce?.extra_margin_percent || 0)
        : 0;
      const proposed = Math.round(cost * (1 + (margin + extraMargin) / 100) * 1e6) / 1e6;
      if (!product || !Number.isFinite(supplierRate) || supplierRate <= 0 ||
          !Number.isFinite(cost) || cost <= 0 || cost > 1000000 ||
          !Number.isFinite(proposed) || proposed <= 0 || proposed > 1000000) {
        skipped.push({ product_id: row.product_id, provider_service: String(row.provider_service || ""),
          reason: !product ? "المنتج غير موجود" : "سعر المورّد خارج الحدود المسموحة" });
        continue;
      }
      const oldPrice = Number(product.commerce?.prices?.USD ?? product.price);
      if (row.auto_margin && (!Number.isFinite(oldPrice) || oldPrice < 0)) {
        skipped.push({ product_id: row.product_id, provider_service: String(row.provider_service || ""),
          reason: "السعر الحالي غير صالح" });
        continue;
      }
      planned.push({ id: row.product_id, product, cost, price: proposed,
        previousCost: row.cost_usd == null ? null : Number(row.cost_usd),
        oldPrice, autoMargin: !!row.auto_margin, isActive: !!product.is_active });
    }
    const changing = planned.filter((item) => item.autoMargin && item.price !== item.oldPrice);
    const preview: any = {
      mapped: rows.length,
      ready: planned.length,
      missing,
      skipped: skipped.length,
      skippedSamples: skipped.slice(0, 10),
      manualPreserved: planned.filter((item) => !item.autoMargin).length,
      changing: changing.length,
      activeChanging: changing.filter((item) => item.isActive).length,
      samples: changing.slice(0, 15).map((item) => ({
        id: item.id, old_price_usd: item.oldPrice, new_price_usd: item.price,
      })),
    };
    // Bind confirmation to the full price snapshot, not only the count of changed products.
    // Include cost-only updates and source pricing so unchanged change-counts cannot hide price differences.
    const snapshotRows = planned.map((item) => ({
      id: item.id,
      previous_cost: item.previousCost,
      next_cost: item.cost,
      previous_price: item.oldPrice,
      next_price: item.price,
      auto_margin: item.autoMargin,
      active: item.isActive,
    })).sort((left, right) => left.id.localeCompare(right.id));
    const snapshotData = JSON.stringify({
      provider_id: id,
      currency: p.currency,
      exchange: perUSD,
      margin,
      missing: rows.filter((row: any) => !byId.has(String(row.provider_service)))
        .map((row: any) => String(row.product_id)).sort(),
      skipped: skipped.map((item: any) => item.product_id).sort(),
      rows: snapshotRows,
    });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(snapshotData));
    const fingerprint = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    preview.fingerprint = fingerprint;
    if (b.dry_run === true) return preview;
    // Require an explicit snapshot acknowledgement obtained from a read-only preview.
    // Prevent accidental execution through a stale UI or a stray click.
    if (text(b.confirm_fingerprint, 64) !== fingerprint ||
        text(b.confirm_count, 15) !== String(preview.changing) ||
        text(b.confirm_ready, 15) !== String(preview.ready))
      throw new AppError("F90_FIELDS", 409, "بيانات المزامنة تغيّرت. عاين الأسعار من جديد قبل التأكيد");
    // One database transaction replaces hundreds of sequential writes.
    // The RPC revalidates the price snapshot and the manual/automatic flag.
    const applied = await rpc("f90_provider_sync_bulk", {
      p_actor: a.id, p_provider: id, p_margin: margin,
      p_entries: planned.map((item: any) => ({
        id: item.id, cost: item.cost, previous_cost: item.previousCost,
        previous_price: item.oldPrice, auto_margin: item.autoMargin,
        expected_price: item.price,
      })),
    });
    return { updated: Number(applied.price_updated || 0),
      costUpdated: Number(applied.cost_updated || 0), ...preview };
  }
  if (action === "staff.worker") {
    requireRole(a, "manager");
    return work();
  }
  throw new AppError("F90_NOT_FOUND");
}

Deno.serve(async (req: Request) => {
  let securityAction="",securityActor:Actor|null=null;
  let usage: { key_id: string; user_id: string; action: string } | null = null;
  const response = await (async () => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET")
    return out({
      name: "F90 CARD",
      version: 3,
      status: "ready",
      checkout: "wallet",
      docs: "استخدم طلب POST مع action في JSON أو نموذج؛ المفاتيح في ترويسة x-f90-key",
    });
  try {
    if (Number(req.headers.get("content-length") || 0) > 65536)
      throw new AppError("F90_FIELDS");
    const raw = await req.text();
    if (raw.length > 65536) throw new AppError("F90_FIELDS");
    let b: any;
    try {
      b = req.headers
        .get("content-type")
        ?.includes("application/x-www-form-urlencoded")
        ? Object.fromEntries(new URLSearchParams(raw))
        : JSON.parse(raw);
    } catch {
      throw new AppError("F90_FIELDS");
    }
    const action = text(b.action, 80);
    securityAction=action;
    if(action==="i18n.resources")return out(await localizationResources(b));
    if(action==="i18n.worker.claim"||action==="i18n.worker.complete"){
      const timestamp=Number(b.timestamp),payload=b.payload||{};
      if(!Number.isSafeInteger(timestamp)||Math.abs(Date.now()/1000-timestamp)>300)throw new AppError("F90_AUTH",403);
      const valid=await rpc("f90_i18n_worker_verify",{p_timestamp:timestamp,p_message:"f90-i18n-worker:"+timestamp+":"+action+":"+JSON.stringify(payload),p_signature:text(b.signature,64)});
      if(!valid)throw new AppError("F90_AUTH",403);
      return out(action==="i18n.worker.claim"?await rpc("f90_i18n_claim",{}):await rpc("f90_i18n_complete",{p_lease:uuid(payload.lease_id),p_rows:payload.rows}));
    }
    // Production financial actions enabled on explicit owner request, 2026-10-20.
    if (action === "worker" || action === "smm.catalog" || action === "shihab.audit" || action === "shihab.sync") {
      const token = req.headers.get("x-f90-worker");
      if (
        !token ||
        !(await rpc("f90_worker_authorized", { p_hash: await hash(token) }))
      )
        throw new AppError("F90_AUTH");
      if (action === "shihab.audit") return out(await providerAction("9c95e9bc-8930-490d-bb23-92d67a0dc428", "services"));
      if (action === "shihab.sync") return out(await syncShihab());
      return out(action === "worker" ? await work() : await smmCatalogFetch());
    }
    if (action === "media.state") {
      const [settings,source] = await Promise.all([
        db.from("site_settings").select("config").eq("id",1).single(),
        db.from("f90_radio_sources").select("media_path,direct_audio_url,mode,updated_at").eq("id",1).single()
      ]);
      const m=check(settings).config?.music||{},r=check(source);
      const list=Array.isArray(m.playlist)?m.playlist:[];
      const linkMode=m.source_mode==="link";
      return out({enabled:m.enabled===true&&!!(linkMode?r.direct_audio_url:(list.length||r.media_path)),
        mode:r.mode==="video"?"video":"audio",revision:r.updated_at||"",
        selected_index:Math.min(Math.max(0,Number(m.selected_index||0)),Math.max(0,list.length-1)),
        start_seconds:Number(m.start_seconds||0),
        volume:Number(m.volume??0.35),
        tracks:(linkMode?[]:list).map((x:any)=>({title:text(x.title,90),mode:/\.(mp4|webm)$/i.test(x.path)?"video":"audio"})),
        bubble:m.bubble||{} });
    }
    if (action === "media.ticket") {
      // The selected private track is resolved server-side, never from a
      // caller-supplied bucket or path. Only currently enabled radio can stream.
      const row = check(await db.from("site_settings").select("config").eq("id", 1).single());
      const music = row.config?.music || {};
      const selected=check(await db.from("f90_radio_sources").select("media_path,mode,direct_audio_url").eq("id",1).single());
      if(music.enabled!==true)throw new AppError("F90_NOT_FOUND",404,"الراديو متوقف من الإدارة");
      const playlist=Array.isArray(music.playlist)?music.playlist:[];
      if(music.source_mode!=="link"&&playlist.length){
        const index=integer(b.track_index??music.selected_index??0,0,playlist.length-1);
        const path=String(playlist[index]?.path||"");
        if(!/^tracks\/[0-9a-f-]{36}\.(mp3|ogg|wav|m4a|aac|mp4|webm)$/i.test(path))
          throw new AppError("F90_NOT_FOUND",404,"المقطع الصوتي غير متاح");
        const ticket=check(await db.storage.from("f90-radio").createSignedUrl(path,3600));
        return out({url:ticket.signedUrl,mode:/\.(mp4|webm)$/i.test(path)?"video":"audio",index});
      }
      if(music.source_mode==="link"&&selected.direct_audio_url)return out({url:selected.direct_audio_url,mode:"audio"});
      if(selected.media_path){
        const path=selected.media_path;
        if(!/^tracks\/[0-9a-f-]{36}\.(mp3|ogg|wav|m4a|aac|mp4|webm)$/.test(path))
          throw new AppError("F90_NOT_FOUND",404,"مصدر الراديو غير متاح");
        const ticket=check(await db.storage.from("f90-radio").createSignedUrl(path,3600));
        return out({url:ticket.signedUrl,mode:selected.mode==="video"?"video":"audio"});
      }
      if(selected.direct_audio_url)
        return out({url:selected.direct_audio_url,mode:"audio"});
      throw new AppError("F90_NOT_FOUND",404,"لم يُحدّد مصدر للراديو");
    }
    if (action === "catalog" || action === "health")
      return out(
        action === "health"
          ? { version: 3, checkout: "wallet", status: "ready" }
          : await publicCatalog(),
      );
    // Start the provider availability check alongside authentication.
    // Both must succeed before the non-mutating quote RPC can run.
    const quoteProductId = action === "quote" ? uuid(b.product_id) : null;
    const [a] = await Promise.all([
      actor(req, action === "quote"),
      quoteProductId ? assertProviderAvailable(quoteProductId) : Promise.resolve(),
    ]);
    securityActor=a;
    if (a?.keyId)
      usage = { key_id: a.keyId, user_id: a.id, action };
    if (action === "catalog.private") {
      if (!a || !["manager","trader"].includes(a.role) || a.needsMfa || a.keyId)
        throw new AppError("F90_FORBIDDEN",403);
      const cats = check(await db.from("categories").select("*").like("slug","f90-shihab-%"));
      const ids = cats.map((c:any)=>c.id);
      const items = ids.length ? check(await db.from("products").select("*").in("category_id",ids).eq("is_active",true)) : [];
      return out({categories:cats.filter((c:any)=>c.is_active),products:items.filter((p:any)=>cats.some((c:any)=>c.id===p.category_id&&c.is_active))});
    }
    if (action === "quote") {
      if (a?.keyId) scoped(a, "orders");
      await assertShihabCatalogAccess(quoteProductId!,a);
      return out(
        await rpc("f90_quote_currency", {
          p_user: a && !a.needsMfa ? a.id : null,
          p_currency: text(b.currency || "USD",8).toUpperCase(),
          p_product: quoteProductId!,
          p_quantity: integer(b.quantity || 1),
          p_coupon: "",
        }),
      );
    }
    if (!a) throw new AppError("F90_AUTH");
    if (
      a.keyId &&
      ![
        "categories",
        "services",
        "service",
        "balance",
        "checkout",
        "add",
        "status",
        "order",
        "history",
      ].includes(action)
    )
      throw new AppError("F90_FORBIDDEN");
    if (action.startsWith("staff.security.")) {
      securityManager(a);
      if(action==="staff.security.sessions") {
        const date=(v:any)=>{if(!v)return null;const d=new Date(v);if(!Number.isFinite(d.getTime()))throw new AppError("F90_FIELDS");return d.toISOString();};
        return out(await rpc("f90_security_sessions_list",{p_actor:a.id,p_actor_session:a.sessionId,p_user:b.user_id?uuid(b.user_id):null,p_from:date(b.from),p_to:date(b.to),p_status:text(b.status||"all",15),p_search:text(b.search,120),p_offset:integer(b.offset||0,0,100000)}));
      }
      if(action==="staff.security.revoke"){
        if(b.confirm_user_id!==b.user_id)throw new AppError("F90_FIELDS",400,"أكّد الحساب المستهدف قبل الإلغاء");
        const reason=text(b.reason,500).trim();
        if(reason.length<8)throw new AppError("F90_FIELDS",400,"سبب إلغاء الجلسة إلزامي (8 أحرف على الأقل)");
        return out(await rpc("f90_security_sessions_revoke",{p_actor:a.id,p_actor_session:a.sessionId,p_user:uuid(b.user_id),p_session:b.session_id?uuid(b.session_id):null,p_all:b.all===true,p_reason:reason}));
      }
      if(action==="staff.security.alerts"){
        const rows=check(await db.from("f90_security_alerts").select("id,kind,user_id,occurrences,details,first_seen_at,last_seen_at,acknowledged_at,acknowledgement_reason").not("alerted_at","is",null).order("last_seen_at",{ascending:false}).limit(100));
        check(await db.from("f90_audit").insert({actor_id:a.id,action:"security.alerts.read",target_id:a.id,details:{count:rows.length}}));
        return out({items:rows});
      }
      if(action==="staff.security.acknowledge"){
        const reason=text(b.reason,500).trim();if(reason.length<8)throw new AppError("F90_FIELDS");
        return out(await rpc("f90_security_acknowledge",{p_actor:a.id,p_actor_session:a.sessionId,p_alert:integer(b.id),p_reason:reason}));
      }
      throw new AppError("F90_FIELDS");
    }
    if (action === "me") return out(await summary(a));
    protect(a);
    if (action === "recipients.list") {
      return out({ items: check(await db.from("f90_saved_recipients")
        .select("id,kind,label,value,created_at")
        .eq("user_id", a.id).order("created_at", { ascending: false }).limit(30)) });
    }
    if (action === "recipients.save") {
      const kind = text(b.kind, 30);
      const label = String(b.label ?? "").trim();
      const value = String(b.value ?? "").trim();
      if (!["account_id", "phone"].includes(kind) || !label || label.length > 50 ||
          value.length < 2 || value.length > 120 || /[\r\n\t]/.test(value))
        throw new AppError("F90_FIELDS");
      if (kind === "phone" && !/^\+?[0-9 ()-]{6,25}$/.test(value))
        throw new AppError("F90_FIELDS");
      const data = { kind, label, value };
      if (b.id) {
        const updated = check(await db.from("f90_saved_recipients")
          .update(data).eq("id", uuid(b.id)).eq("user_id", a.id)
          .select("id,kind,label,value,created_at").maybeSingle());
        if (!updated) throw new AppError("F90_NOT_FOUND");
        return out(updated);
      }
      const { count, error } = await db.from("f90_saved_recipients")
        .select("id", { count: "exact", head: true }).eq("user_id", a.id);
      if (error) throw error;
      if ((count || 0) >= 30) throw new AppError("F90_FIELDS", 400, "الحد الأعلى ٣٠ جهة محفوظة");
      return out(check(await db.from("f90_saved_recipients")
        .insert({ ...data, user_id: a.id })
        .select("id,kind,label,value,created_at").single()));
    }
    if (action === "recipients.delete") {
      const removed = check(await db.from("f90_saved_recipients")
        .delete().eq("id", uuid(b.id)).eq("user_id", a.id)
        .select("id").maybeSingle());
      if (!removed) throw new AppError("F90_NOT_FOUND");
      return out({ deleted: true });
    }
    if (action === "categories") {
      scoped(a, "catalog");
      return out((await publicCatalog()).categories.map((c: any) => ({
        id: c.id, name: c.name, parent_id: c.parent_id, image_url: c.image_url || "", description: c.description || "",
      })));
    }
    if (action === "services" || action === "service") {
      scoped(a, "catalog");
      const prices =
        a.role === "trader"
          ? check(
              await db
                .from("f90_product_internal")
                .select("product_id,trader_price_usd"),
            )
          : [];
      const catalog = await publicCatalog();
      const userPricing = check(await db.from("f90_user_discounts").select("purchase_markup_percent,purchase_markup_enabled").eq("user_id",a.id).maybeSingle());
      const markup = userPricing?.purchase_markup_enabled ? Number(userPricing.purchase_markup_percent) : 0;
      const priceCurrency = String(a.profile.account_currency || "USD");
      const fx = Number(catalog.rates.find((r:any)=>r.currency===priceCurrency&&r.is_enabled)?.per_usd);
      if (!Number.isFinite(fx) || fx <= 0) throw new AppError("F90_RATE_MISSING");
      const items = catalog.products.map((p: any) => {
        const fixed=p.commerce.currency_pricing;
        const catalogQuantity=Number(p.commerce.type==='quantity' ? p.commerce.quantity_min||1 : p.commerce.pack_quantity||1);
        const localPrice=nativePrice(fixed,priceCurrency,catalogQuantity);
        const independent=catalog.settings.config?.currency_pricing_enabled!==false && fixed?.enabled===true && localPrice>0;
        const baseRate=independent
          ? localPrice/fx * Number(p.commerce.type==='quantity' ? p.commerce.unit_quantity||1 : p.commerce.pack_quantity||1)/Number(fixed.unit_quantity)
          : Number(prices.find((i:any)=>i.product_id===p.id)?.trader_price_usd ?? p.commerce.prices?.USD);
        return ({
          service: p.id,
          name: p.name,
          description: p.description || "",
          image_url: p.image_url || "",
          gallery: Array.isArray(p.gallery) ? p.gallery : [],
          currency: "USD",
          category: p.category_id,
          type: p.commerce.type || "fixed",
          rate: baseRate*(1+markup/100),
          price_currency: priceCurrency,
          currency_price_fixed: independent,
          currency_unit_quantity: independent ? fixed.unit_quantity : p.commerce.unit_quantity || 1,
          rate_currency: independent ? localPrice*(1+markup/100) : baseRate*fx*(1+markup/100),
          currency_pricing: fixed?.enabled===true && catalog.settings.config?.currency_pricing_enabled!==false ? {
            enabled:true, unit_quantity:fixed.unit_quantity,
            prices:Object.fromEntries(Object.entries(fixed.prices||{}).map(([k,v])=>[k,Number(v)*(1+markup/100)])),
            tiers_enabled:fixed.tiers_enabled===true,
            tiers:(fixed.tiers||[]).map((t:any)=>({min:t.min,prices:Object.fromEntries(Object.entries(t.prices||{}).map(([k,v])=>[k,Number(v)*(1+markup/100)]))})),
            quantity_rule:"whole_order_inclusive_minimum",
          } : null,
          unit_quantity: p.commerce.unit_quantity || 1,
          min: p.commerce.quantity_min || 1,
          max: p.commerce.quantity_max || 1,
          fulfillment: p.commerce.fulfillment || "manual",
          fields: p.commerce.fields || [],
          pack_quantity: p.commerce.pack_quantity || 1,
          quantity_step: p.commerce.quantity_step || 1,
          pricing_tiers: p.commerce.pricing_tiers || [],
          availability:
            p.stock === 0 || p.commerce.availability === "refilling"
              ? "refilling"
              : "available",
        });
      });
      if (action === "service") {
        const item = items.find((p: any) => p.service === uuid(b.service || b.id));
        if (!item) throw new AppError("F90_NOT_FOUND");
        return out(item);
      }
      return out(items);
    }
    if (action === "balance") {
      scoped(a, "balance");
      return out({
        balance: check(
          await db
            .from("f90_wallets")
            .select("balance_usd")
            .eq("user_id", a.id)
            .single(),
        ).balance_usd,
        currency: "USD",
      });
    }
    if (action === "checkout" || action === "add") {
      scoped(a, "orders");
      const verification = check(await db.from("profiles").select("is_verified").eq("id", a.id).single());
      const purchaseConfig=check(await db.from("site_settings").select("config").eq("id",1).single()).config||{};
      if(purchaseConfig.purchase_requires_verification===true && !verification.is_verified) throw new AppError("F90_VERIFICATION_REQUIRED",403,"يجب توثيق الحساب قبل الشراء.");
      const product = uuid(b.product_id || b.service);
      await assertShihabCatalogAccess(product,a);
      const fields = b.fields || { account_id: b.link || b.account_id };
      const reference = paymentReference(b.idempotency_key);
      const requestedQuantity = integer(b.quantity || 1);
      if (!fields || typeof fields !== "object" || Array.isArray(fields))
        throw new AppError("F90_FIELDS", 400, "حقول العميل يجب أن تكون كائنًا");
      const previous = check(await db.from("f90_orders")
        .select("*").eq("user_id", a.id)
        .eq("idempotency_key", reference).maybeSingle());
      if (previous) {
        const productInfo = check(await db.from("products")
          .select("commerce").eq("id", previous.product_id).maybeSingle());
        const storedFields = previous.customer_fields || {};
        const sortFields = (obj: any) => JSON.stringify(
          Object.keys(obj).sort().map((key) => [key, obj[key]]));
        const mismatch = previous.product_id !== product ||
          (productInfo?.commerce?.type === "quantity" &&
            Number(previous.quantity) !== requestedQuantity) ||
          sortFields(storedFields) !== sortFields(fields);
        if (mismatch)
          throw new AppError("F90_IDEMPOTENCY_CONFLICT", 409,
            "هذا المرجع مرتبط بطلب آخر أو ببيانات عميل مختلفة. افتح الطلب السابق بدل تكرار الدفع.");
        return out(customerOrder(previous), 200);
      }
      // Resolve existing paid references before checking current supplier availability.
      await assertProviderAvailable(product);
      const expected =
        b.expected_total_usd ??
        (a.keyId
          ? (
              await rpc("f90_quote", {
                p_user: a.id,
                p_product: product,
                p_quantity: requestedQuantity,
                p_coupon: "",
              })
            ).total_usd
          : null);
      const data = await rpc("f90_checkout", {
        p_user: a.id,
        p_product: product,
        p_quantity: requestedQuantity,
        p_fields: fields,
        p_key: reference,
        p_expected: expected,
        p_coupon: "",
      });
      if (a.keyId)
        await db
          .from("f90_api_keys")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", a.keyId);
      return out(customerOrder(data), 201);
    }
    if (action === "transaction.lookup") {
      // Read-only recovery by original reference: never places orders or credits a wallet.
      // Authentication is required and only the current user's records are visible.
      if (a.keyId) throw new AppError("F90_FORBIDDEN");
      const reference = paymentReference(b.idempotency_key);
      const kind = text(b.kind, 20);
      if (kind === "order") {
        const prior = check(await db.from("f90_orders").select("*")
          .eq("user_id", a.id).eq("idempotency_key", reference).maybeSingle());
        return out(prior ? { found: true, kind, order: customerOrder(prior) } : { found: false, kind });
      }
      if (kind === "deposit") {
        const prior = check(await db.from("f90_deposits")
          .select("id,status,amount,currency,usd_amount,created_at,method_id")
          .eq("user_id", a.id).eq("idempotency_key", reference).maybeSingle());
        return out(prior ? { found: true, kind, deposit: prior } : { found: false, kind });
      }
      throw new AppError("F90_FIELDS", 400, "نوع العملية غير مدعوم");
    }
    if (action === "status" || action === "order") {
      scoped(a, "orders");
      const o = check(
        await db
          .from("f90_orders")
          .select("*")
          .eq("id", uuid(b.id || b.order))
          .eq("user_id", a.id)
          .maybeSingle(),
      );
      if (!o) throw new AppError("F90_NOT_FOUND");
      const events = check(
        await db
          .from("f90_order_events")
          .select("*")
          .eq("order_id", o.id)
          .order("created_at"),
      );
      const requests = action === "order" ? check(await db.from("f90_order_requests")
        .select("id,kind,reason,status,review_note,created_at,reviewed_at")
        .eq("order_id", o.id).eq("user_id", a.id)
        .order("created_at", { ascending: false })) : [];
      return out({ order: customerOrder(o), events, requests });
    }
    if (action === "order.request") {
      if (a.keyId) throw new AppError("F90_FORBIDDEN");
      const orderId = uuid(b.order_id);
      const kind = text(b.kind, 20);
      const reason = text(b.reason, 2000).trim();
      if (!["cancel", "dispute"].includes(kind) || reason.length < 5)
        throw new AppError("F90_FIELDS", 400, "اكتب سبب الطلب بخمسة أحرف على الأقل");
      const order = check(await db.from("f90_orders")
        .select("id,status,order_number").eq("id", orderId)
        .eq("user_id", a.id).maybeSingle());
      if (!order) throw new AppError("F90_NOT_FOUND");
      if (kind === "cancel" && ["completed", "partial", "failed", "refunded"].includes(order.status))
        throw new AppError("F90_FIELDS", 409, "الطلب انتهى؛ استخدم الاعتراض للمراجعة");
      const prior = check(await db.from("f90_order_requests")
        .select("id").eq("order_id", orderId).eq("kind", kind)
        .eq("status", "pending").maybeSingle());
      if (prior) throw new AppError("F90_FIELDS", 409, "يوجد طلب مراجعة مفتوح بالفعل");
      const request = check(await db.from("f90_order_requests")
        .insert({ order_id: orderId, user_id: a.id, kind, reason })
        .select("id,kind,reason,status,created_at").single());
      await auditSafe(a.id, "order.request", orderId,
        { request_id: request.id, kind, order_number: order.order_number });
      return out(request, 201);
    }
    if (action === "history.salary") {
      // The customer may inspect only their own Xena payout requests.
      if(a.keyId) throw new AppError("F90_FORBIDDEN");
      scoped(a,"balance");
      const offset=integer(b.offset||0,0,100000);
      const rows=await db.from("f90_salary_requests")
        .select("id,coins,usd_amount,status,created_at,payout_currency,payout_amount,review_note",{count:"exact"})
        .eq("user_id",a.id).order("created_at",{ascending:false})
        .range(offset,offset+49);
      return out({items:check(rows),count:rows.count||0});
    }
    if (action === "history") {
      const table = (
        {
          orders: "f90_orders",
          deposits: "f90_deposits",
          ledger: "f90_wallet_ledger",
          verification: "f90_verifications",
        } as any
      )[b.kind];
      if (!table) throw new AppError("F90_FIELDS");
      scoped(a, b.kind === "orders" ? "orders" : "balance");
      const offset = integer(b.offset || 0, 0, 100000);
      const r = await db
        .from(table)
        .select("*", { count: "exact" })
        .eq("user_id", a.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + 49);
      return out({
        items: b.kind === "orders" ? check(r).map(customerOrder) : check(r),
        count: r.count,
      });
    }
    if (action === "deposit.submit") {
      const reference = paymentReference(b.idempotency_key);
      const verification = check(await db.from("profiles").select("is_verified,account_currency").eq("id", a.id).single());
      const depositConfig = check(await db.from("site_settings").select("config").eq("id",1).single()).config || {};
      if (depositConfig.deposit_requires_verification === true && !verification.is_verified) throw new AppError("F90_VERIFICATION_REQUIRED", 403, "يجب توثيق الحساب قبل الإيداع. افتح صفحة توثيق الهوية من حسابك.");
      const method = text(b.method_id, 100);
      // The account preference stored in Postgres is the sole authority. A
      // modified browser payload cannot change the deposit currency.
      const accountCurrency=String(verification.account_currency||"USD");
      if (!/^[A-Z]{3,8}$/.test(accountCurrency)) throw new AppError("F90_ACCOUNT_CURRENCY");
      const referenceCurrency=text(b.currency||"",8);
      const amount = num(b.amount,0.000001,1000000);
      const receipt = text(b.receipt_path, 500);
      const memo = text(b.reference, 300);
      // Read-only collision check. The database RPC still owns atomic insert/deduplication.
      const previous = check(await db.from("f90_deposits")
        .select("method_id,currency,amount,receipt_path,reference")
        .eq("user_id", a.id).eq("idempotency_key", reference).maybeSingle());
      const currency=previous?.currency||accountCurrency;
      if (!previous && referenceCurrency && referenceCurrency !== accountCurrency)
        throw new AppError("F90_ACCOUNT_CURRENCY",400,"عملة الإيداع يجب أن تطابق عملة الحساب");
      if (previous &&
          (previous.method_id !== method || previous.currency !== currency ||
           Number(previous.amount) !== amount || previous.receipt_path !== receipt ||
           (previous.reference || "") !== memo))
        throw new AppError("F90_IDEMPOTENCY_CONFLICT", 409,
          "مرجع الإيداع مستخدم لبيانات مختلفة. راجع الطلب السابق ولا تكرر الإرسال بمفتاح جديد تلقائيًا.");
      if (!previous) {
        // Check limits for new requests only; retrying an existing request
        // must remain possible if the manager subsequently edits the method.
        const settings = check(await db.from("site_settings").select("config").eq("id", 1).single());
        const paymentMethod = (Array.isArray(settings.config?.payment_methods)
          ? settings.config.payment_methods : []).find((m: any) => m.id === method && m.enabled === true);
        if (!paymentMethod || paymentMethod.is_salary_withdrawal === true)
          throw new AppError("F90_PAYMENT_METHOD");
        const minimum = Number(paymentMethod.minimum_amount || 0);
        if (Number.isFinite(minimum) && minimum > 0 && amount < minimum)
          throw new AppError("F90_AMOUNT", 400, "المبلغ أقل من الحد الأدنى المحدد لهذه الطريقة");
        if (Array.isArray(paymentMethod.accepted_currencies) &&
            !paymentMethod.accepted_currencies.includes(currency))
          throw new AppError("F90_DEPOSIT_CURRENCY", 400,
            "طريقة الإيداع لا تدعم عملة حسابك؛ اختر طريقة أخرى");
      }
      return out(
        await rpc("f90_submit_deposit", {
          p_user: a.id,
          p_method: method,
          p_currency: currency,
          p_amount: amount,
          p_receipt: receipt,
          p_reference: memo,
          p_key: reference,
        }),
        201,
      );
    }
    if (action === "profile.currency") {
      if (a.keyId || a.needsMfa) throw new AppError("F90_FORBIDDEN");
      const currency = text(b.currency, 8).toUpperCase();
      if (!/^[A-Z]{3,8}$/.test(currency)) throw new AppError("F90_ACCOUNT_CURRENCY");
      const rate = check(await db.from("f90_rates")
        .select("currency,is_enabled,per_usd,is_archived").eq("currency",currency).single());
      if (!rate.is_enabled || rate.is_archived || Number(rate.per_usd)<=0) throw new AppError("F90_RATE_MISSING");
      check(await db.from("profiles").update({account_currency:currency}).eq("id",a.id));
      return out({currency});
    }
    if (action === "profile.save") {
      const d: any = {
        display_name: text(b.display_name, 100),
        phone: text(b.phone, 25) || null,
        phone_country: text(b.phone_country, 8) || "+970",
      };
      if (!d.display_name) throw new AppError("F90_FIELDS");
      if (b.avatar_url) {
        const u = new URL(b.avatar_url);
        if (
          !u.href.startsWith(
            `${url}/storage/v1/object/public/f90-avatars/${a.id}/`,
          )
        )
          throw new AppError("F90_FIELDS");
        d.avatar_url = u.href;
      }
      check(await db.from("profiles").update(d).eq("id", a.id));
      return out({ saved: true });
    }
    if (action === "verification.submit") {
      const front = await privatePath(a, "f90-identity", b.front_path),
        selfie = await privatePath(a, "f90-identity", b.selfie_path),
        back = b.back_path
          ? await privatePath(a, "f90-identity", b.back_path)
          : null;
      if (b.document_type !== "passport" && !back)
        throw new AppError("F90_FIELDS", 400, "ارفع وجهي الهوية");
      return out(
        check(
          await db
            .from("f90_verifications")
            .insert({
              user_id: a.id,
              document_type: b.document_type === "passport" ? "passport" : "id",
              front_path: front,
              back_path: back,
              selfie_path: selfie,
            })
            .select()
            .single(),
        ),
        201,
      );
    }
    if (action === "key.create") {
      requireRole(a, "trader", "manager");
      if (a.keyId) throw new AppError("F90_FORBIDDEN");
      const apiSetting = check(await db.from("site_settings").select("config").eq("id", 1).single());
      if (apiSetting.config?.merchant_api_enabled === false)
        throw new AppError("F90_FORBIDDEN", 403, "واجهة التجار متوقفة مؤقتًا");
      const owner = a.role === "manager" && b.user_id ? uuid(b.user_id) : a.id;
      const [target, profile] = await Promise.all([
        db
          .from("f90_user_roles")
          .select("role")
          .eq("user_id", owner)
          .single(),
        db.from("profiles").select("is_verified,account_status")
          .eq("id", owner).single(),
      ]);
      if (check(target).role !== "trader")
        throw new AppError(
          "F90_FORBIDDEN",
          400,
          "امنح الحساب صلاحية تاجر أولًا",
        );
      if (!check(profile).is_verified || check(profile).account_status !== "active")
        throw new AppError("F90_VERIFICATION_REQUIRED", 403,
          "يجب تفعيل الحساب وتوثيقه قبل إصدار مفتاح التاجر");
      const settings = keySettings(b);
      const count = await db
        .from("f90_api_keys")
        .select("id", { count: "exact", head: true })
        .eq("user_id", owner)
        .eq("is_active", true);
      if (count.error) throw count.error;
      if ((count.count || 0) >= 1 && !b.replace_existing)
        throw new AppError("F90_FIELDS",409,"للتاجر مفتاح نشط واحد. دوّر المفتاح الحالي أو ألغِه أولًا.");
      const random = crypto.getRandomValues(new Uint8Array(32));
      const token =
        "f90_live_" +
        [...random].map((x) => x.toString(16).padStart(2, "0")).join("");
      const key = (await rpc("f90_rotate_merchant_key",{
        p_actor:a.id,p_owner:owner,p_name:settings.name,p_hash:await hash(token),
        p_prefix:token.slice(0,16)+"…"+token.slice(-4),
        p_scopes:settings.scopes,p_rpm:settings.requests_per_minute,
        p_expiry:settings.expires_at,p_allow_all:settings.allow_all_ips,
        p_allowed_ips:settings.allowed_ips
      })) as any;
      await auditSafe(a.id, "key.create", key.id,
        { owner, scopes: settings.scopes,
          requests_per_minute: settings.requests_per_minute });
      return out({ ...key, token }, 201);
    }
    if (action === "key.update") {
      if (a.keyId) throw new AppError("F90_FORBIDDEN");
      requireRole(a, "trader", "manager");
      const id = uuid(b.id);
      const current = check(await db.from("f90_api_keys")
        .select("id,user_id,name,scopes,requests_per_minute,expires_at,is_active,allow_all_ips,allowed_ips")
        .eq("id", id).single());
      if (a.role !== "manager" && current.user_id !== a.id)
        throw new AppError("F90_FORBIDDEN");
      if (!current.is_active) throw new AppError("F90_FIELDS", 409, "المفتاح ملغى");
      const settings = keySettings(b, current);
      const saved = check(await db.from("f90_api_keys")
        .update(settings).eq("id", id)
        .select("id,name,token_prefix,scopes,requests_per_minute,expires_at,is_active,last_used_at,allow_all_ips,allowed_ips")
        .single());
      await auditSafe(a.id, "key.update", id,
        { scopes: settings.scopes,
          requests_per_minute: settings.requests_per_minute });
      return out(saved);
    }
    if (action === "key.logs") {
      if (a.keyId) throw new AppError("F90_FORBIDDEN");
      requireRole(a, "trader", "manager");
      const id = uuid(b.id);
      const key = check(await db.from("f90_api_keys").select("user_id")
        .eq("id", id).single());
      if (a.role !== "manager" && key.user_id !== a.id)
        throw new AppError("F90_FORBIDDEN");
      return out(check(await db.from("f90_api_usage")
        .select("action,http_status,created_at")
        .eq("key_id", id).order("created_at", { ascending: false }).limit(100)));
    }
    if (action === "key.revoke") {
      if (a.keyId) throw new AppError("F90_FORBIDDEN");
      requireRole(a, "trader", "manager");
      let q = db
        .from("f90_api_keys")
        .update({ is_active: false })
        .eq("id", uuid(b.id));
      if (a.role !== "manager") q = q.eq("user_id", a.id);
      const removed = check(await q.select("id,user_id").maybeSingle());
      if (!removed) throw new AppError("F90_NOT_FOUND");
      await auditSafe(a.id, "key.revoke", removed.id, { owner: removed.user_id });
      return out({ revoked: true });
    }
    if (
      action.startsWith("staff.") ||
      action.startsWith("catalog.") ||
      action.startsWith("provider.") ||
      action === "settings.save"
    ) {
      if (a.keyId) throw new AppError("F90_FORBIDDEN");
      return out(await staff(a, b));
    }
    throw new AppError("F90_NOT_FOUND");
  } catch (e) {
    if(securityAction.startsWith("staff.") && securityActor && (String(e?.message).includes("F90_FORBIDDEN") || e?.code==="F90_FORBIDDEN"))
      await securitySignal("admin_denied",securityActor.id,securityActor.id,{action:securityAction},3);
    return fail(e);
  }
  })();
  // The callback above may assign usage asynchronously. Keep that type visible
  // to Deno's control-flow analysis without changing the audit behavior.
  const usageRecord=usage as { key_id:string; user_id:string; action:string } | null;
  if (usageRecord) {
    try {
      const [logged, touched] = await Promise.all([
        db.from("f90_api_usage").insert({ ...usageRecord, http_status: response.status }),
        db.from("f90_api_keys").update({ last_used_at: new Date().toISOString() })
          .eq("id", usageRecord.key_id),
      ]);
      if (logged.error || touched.error)
        console.error("API key usage logging failed", logged.error?.code, touched.error?.code);
    } catch {
      console.error("API key usage logging failed");
    }
  }
  return response;
});
