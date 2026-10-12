import { createClient } from "@supabase/supabase-js";
import { parentRefilling } from "./catalog.mjs";
import {
  callProvider,
  endpointURL,
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
  "support",
];
const errors: Record<string, [number, string]> = {
  F90_FORBIDDEN: [403, "لا تملك الصلاحية المطلوبة أو حسابك موقوف"],
  F90_NOT_FOUND: [404, "العنصر غير موجود"],
  F90_REFILLING: [409, "الخدمة قيد التعبئة حاليًا"],
  F90_QUANTITY: [400, "الكمية لا تطابق الحدود والخطوة المسموحة"],
  F90_RATE_MISSING: [409, "لم تضبط الإدارة سعر الصرف لهذه العملة"],
  F90_PRICE_MISSING: [409, "سعر الخدمة لم يجهّز بعد"],
  F90_INSUFFICIENT_BALANCE: [402, "رصيد محفظتك غير كافٍ. أضف رصيدًا أولًا"],
  F90_PRICE_CHANGED: [409, "تغيّر السعر. راجع الإجمالي وأكد الشراء مجددًا"],
  F90_ACCOUNT_ID: [400, "أدخل معرّف حسابك"],
  F90_FIELDS: [400, "أكمل بيانات الطلب المطلوبة"],
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
  F90_AUTH: [401, "سجّل الدخول لإكمال العملية"],
  F90_MFA: [403, "أدخل رمز التحقق الثنائي أولًا"],
  F90_LIMIT: [429, "طلبات كثيرة. انتظر دقيقة وحاول مجددًا"],
};
type Actor = {
  id: string;
  role: string;
  profile: any;
  needsMfa: boolean;
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
  return new Response(JSON.stringify({ error: { code, message } }), {
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
    api = check(
      await db
        .from("f90_api_keys")
        .select("*")
        .eq("token_hash", await hash(key))
        .eq("is_active", true)
        .maybeSingle(),
    );
    if (!api || (api.expires_at && Date.parse(api.expires_at) <= Date.now()))
      throw new AppError("F90_AUTH");
    if (
      !(await rpc("f90_limit", {
        p_key: `key:${api.id}`,
        p_limit: api.requests_per_minute,
      }))
    )
      throw new AppError("F90_LIMIT");
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
  if (profile.account_status !== "active" || (api && role !== "trader"))
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
    needsMfa:
      !api &&
      claims.factors.some((f: any) => f.status === "verified") &&
      claims.aal !== "aal2",
    keyId: api?.id,
    scopes: api?.scopes,
  };
}
function scoped(a: Actor, scope: string) {
  if (a.keyId && !a.scopes?.includes(scope))
    throw new AppError("F90_FORBIDDEN");
}
async function publicCatalog() {
  const rows = await Promise.all([
    db.from("site_settings").select("*").eq("id", 1).single(),
    db.from("categories").select("*").eq("is_active", true).order("sort_order"),
    db.from("products").select("*").eq("is_active", true).order("sort_order"),
    db.from("banners").select("*").eq("is_active", true).order("sort_order"),
    db.from("f90_rates").select("*").order("currency"),
    db.from("f90_vip_tiers").select("*").order("level"),
  ]);
  const categories = check(rows[1]);
  const visible = (id: string, seen = new Set<string>()): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    const c = categories.find((x: any) => x.id === id);
    return !!c && (!c.parent_id || visible(c.parent_id, seen));
  };
  return {
    settings: check(rows[0]),
    categories: categories
      .filter((c: any) => visible(c.id))
      .map((c: any) =>
        parentRefilling(c.id, categories)
          ? {
              ...c,
              presentation: { ...c.presentation, availability: "refilling" },
            }
          : c,
      ),
    products: check(rows[2])
      .filter((p: any) => !p.category_id || visible(p.category_id))
      .map((p: any) =>
        parentRefilling(p.category_id, categories)
          ? { ...p, commerce: { ...p.commerce, availability: "refilling" } }
          : p,
      ),
    banners: check(rows[3]),
    rates: check(rows[4]),
    vip: check(rows[5]),
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
            "id,name,token_prefix,scopes,is_active,created_at,expires_at,last_used_at",
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
  const secret = await rpc("f90_provider_secret", {
    p_actor: null,
    p_provider: id,
  });
  if (!secret || (!p.is_enabled && !readOnly)) throw new ProviderError("المورّد غير مفعّل");
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
  const { p, secret } = await provider(id, action === "services" || action === "balance");
  return callProvider(p, secret, action, args, fetch, dns);
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
        const response = await providerAction(o.provider_id, "add", {
          service: o.provider_service,
          quantity: o.quantity,
          link,
          client_reference: o.id,
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
      } else {
        const data = await providerAction(o.provider_id, "status", {
          order: o.provider_order_id,
        });
        const state = normalizeStatus(data, o.total_usd, o.quantity);
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
              provider_status: text(data.status, 100),
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
  return { processed };
}
function cleanCommerce(raw: any, existing: any = {}, designer = false) {
  const c = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  if (designer)
    return {
      ...existing,
      availability: c.availability === "refilling" ? "refilling" : "available",
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
  const result: any = {
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
    fields: cleanCommerce(c, existing, true).fields,
    pricing_tiers: [],
  };
  if (result.quantity_max < result.quantity_min)
    throw new AppError("F90_QUANTITY");
  result.pricing_tiers = (Array.isArray(c.pricing_tiers) ? c.pricing_tiers : [])
    .slice(0, 30)
    .map((t: any) => ({
      min: integer(t.min),
      prices: { USD: num(t.prices?.USD, 0.000001, 1000000) },
    }));
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
    is_active: d.is_active !== false,
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
        auto_margin: !!i.auto_margin,
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
async function staff(a: Actor, b: any) {
  const action = b.action;
  if (action === "staff.catalog") {
    requireRole(a, "manager", "designer");
    const rows = await Promise.all(
      ["categories", "products", "banners"].map((t) =>
        db.from(t).select("*").order("sort_order"),
      ),
    );
    return {
      categories: check(rows[0]),
      products: check(rows[1]),
      banners: check(rows[2]),
      internal:
        a.role === "manager"
          ? check(await db.from("f90_product_internal").select("*"))
          : [],
      providers:
        a.role === "manager"
          ? check(await db.from("f90_providers").select("id,name,is_enabled"))
          : [],
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
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(
        integer(b.offset || 0, 0, 100000),
        integer(b.offset || 0, 0, 100000) + 49,
      );
    if (b.status)
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
    const ids = [...new Set(items.map((p: any) => p.user_id).filter(Boolean))];
    const profiles = ids.length
      ? check(
          await db
            .from("profiles")
            .select("id,display_name,customer_id,email")
            .in("id", ids),
        )
      : [];
    return {
      items: items.map((p: any) => ({
        ...p,
        customer: profiles.find((u: any) => u.id === p.user_id),
      })),
      count: result.count,
    };
  }
  if (action === "staff.trader_keys") {
    requireRole(a, "manager");
    return check(
      await db
        .from("f90_api_keys")
        .select(
          "id,name,token_prefix,is_active,created_at,expires_at,last_used_at",
        )
        .eq("user_id", uuid(b.user_id))
        .order("created_at", { ascending: false }),
    );
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
  if (action === "staff.review_verification")
    return rpc("f90_review_verification", {
      p_actor: a.id,
      p_id: uuid(b.id),
      p_approve: !!b.approve,
      p_note: text(b.note),
    });
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
  if (action === "staff.user") {
    requireRole(a, "manager");
    if (b.role && !roleNames.includes(b.role)) throw new AppError("F90_FIELDS");
    return rpc("f90_change_user", {
      p_actor: a.id,
      p_user: uuid(b.id),
      p_role: b.role || null,
      p_status: b.status || null,
      p_vip: b.vip ? integer(b.vip, 1, 7) : null,
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
    if (b.kind === "deposit") {
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
    if (c.payment_methods) {
      c.payment_methods = c.payment_methods.slice(0, 50).map((m: any) => ({
        ...m,
        id: text(m.id, 100) || crypto.randomUUID(),
        name_ar: text(m.name_ar, 150),
        image_url: text(m.image_url, 2000),
        details_ar: text(m.details_ar, 8000),
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
      currency: text(d.currency || "USD", 8),
      config: { ...current.config, ...c, version: 3 },
    };
    return check(
      await db.from("site_settings").update(data).eq("id", 1).select().single(),
    );
  }
  if (action === "staff.rate") {
    requireRole(a, "manager");
    const currency = text(b.currency, 8).toUpperCase();
    if (!/^[A-Z]{3,8}$/.test(currency)) throw new AppError("F90_FIELDS");
    return check(
      await db
        .from("f90_rates")
        .upsert({
          currency,
          name_ar: text(b.name_ar, 100),
          per_usd: currency === "USD" ? 1 : num(b.per_usd, 0.00000001, 1e8),
          is_enabled: currency === "USD" || b.is_enabled !== false,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single(),
    );
  }
  if (action === "staff.vip") {
    requireRole(a, "manager");
    const level = integer(b.level, 1, 7);
    return check(
      await db
        .from("f90_vip_tiers")
        .update({
          minimum_spend: level === 1 ? 0 : num(b.minimum_spend),
          discount_percent: level === 1 ? 0 : num(b.discount_percent, 0, 2),
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
    );
  }
  if (action === "provider.save") {
    requireRole(a, "manager");
    endpointURL(b.endpoint);
    const d = {
      name: text(b.name, 150),
      endpoint: text(b.endpoint, 2000),
      adapter: ["smm", "json", "omega"].includes(b.adapter) ? b.adapter : "smm",
      currency: text(b.currency || "USD", 8),
      is_enabled: !!b.is_enabled,
      margin_percent: num(b.margin_percent ?? 20, 0, 10000),
      config: {},
    };
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
    if (b.token)
      await rpc("f90_provider_secret", {
        p_actor: a.id,
        p_provider: p.id,
        p_secret: text(b.token, 10000),
      });
    delete p.secret_id;
    return p;
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
  if (action === "provider.balance") {
    requireRole(a, "manager");
    return providerAction(uuid(b.id), "balance");
  }
  if (action === "provider.import") {
    requireRole(a, "manager");
    const importAdapter = check(await db.from("f90_providers").select("adapter").eq("id", uuid(b.id)).single());
    if (importAdapter.adapter === "omega") throw new AppError("F90_FIELDS", 400, "استيراد أوميغا يحتاج تهيئة حقول المنتجات والأسعار");
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
    const category = check(
      await db.from("categories").select("id").eq("id", categoryId).single(),
    );
    if (!category) throw new AppError("F90_FIELDS", 400, "القسم غير موجود");
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
      const name = text(b.names?.[id], 200);
      if (!name) throw new AppError("F90_FIELDS", 400, "أدخل اسمًا للخدمة " + id);
      return { service, name, cost, price };
    });
    const saved = [];
    for (const { service: s, name, cost, price } of preview) {
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
          category_id: categoryId,
          is_active: false,
          image_url: b.image_url || "",
          commerce: {
            type: "quantity",
            fulfillment: "automatic",
            prices: { USD: price },
            unit_quantity: s.unit_quantity,
            quantity_min: s.min,
            quantity_max: s.max,
            quantity_step: 1,
            fields: [
              {
                id: "account_id",
                label_ar: "رابط أو معرّف الحساب",
                type: "text",
                required: true,
              },
            ],
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
    const products = productIds.length
      ? check(await db.from("products").select("id,commerce,price,is_active").in("id", productIds))
      : [];
    const productsById = new Map(products.map((product: any) => [product.id, product]));
    const planned: any[] = [];
    let missing = 0;
    for (const row of rows) {
      const service = byId.get(String(row.provider_service));
      if (!service) { missing++; continue; }
      const supplierRate = Number(service.rate);
      const cost = supplierRate / perUSD;
      const proposed = Math.round(cost * (1 + margin / 100) * 1e6) / 1e6;
      const product: any = productsById.get(row.product_id);
      if (!product || !Number.isFinite(supplierRate) || supplierRate <= 0 ||
          !Number.isFinite(cost) || cost <= 0 || cost > 1000000 ||
          !Number.isFinite(proposed) || proposed <= 0 || proposed > 1000000)
        throw new AppError("F90_FIELDS", 400, "سعر غير صالح أو منتج مفقود. لم تتغير الأسعار");
      const oldPrice = Number(product.commerce?.prices?.USD ?? product.price);
      if (row.auto_margin && (!Number.isFinite(oldPrice) || oldPrice < 0))
        throw new AppError("F90_FIELDS", 400, "سعر المنتج الحالي غير صالح. لم تتغير الأسعار");
      planned.push({ id: row.product_id, product, cost, price: proposed,
        oldPrice, autoMargin: !!row.auto_margin, isActive: !!product.is_active });
    }
    const changing = planned.filter((item) => item.autoMargin && item.price !== item.oldPrice);
    const preview: any = {
      mapped: rows.length,
      ready: planned.length,
      missing,
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
      previous_cost: Number(rows.find((row: any) => row.product_id === item.id)?.cost_usd ?? 0),
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
    for (const item of planned) {
      check(await db.from("f90_product_internal")
        .update({ cost_usd: item.cost }).eq("product_id", item.id).eq("provider_id", id));
      if (item.autoMargin) {
        check(await db.from("products")
          .update({ price: item.price,
            commerce: { ...item.product.commerce,
              prices: { ...(item.product.commerce?.prices || {}), USD: item.price } } })
          .eq("id", item.id));
      }
    }
    return { updated: planned.length, ...preview };
  }
  if (action === "staff.worker") {
    requireRole(a, "manager");
    return work();
  }
  throw new AppError("F90_NOT_FOUND");
}

Deno.serve(async (req: Request) => {
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
    if (action === "worker") {
      const token = req.headers.get("x-f90-worker");
      if (
        !token ||
        !(await rpc("f90_worker_authorized", { p_hash: await hash(token) }))
      )
        throw new AppError("F90_AUTH");
      return out(await work());
    }
    if (action === "catalog" || action === "health")
      return out(
        action === "health"
          ? { version: 3, checkout: "wallet" }
          : await publicCatalog(),
      );
    const a = await actor(req, action === "quote");
    if (action === "quote") {
      if (a?.keyId) scoped(a, "orders");
      return out(
        await rpc("f90_quote", {
          p_user: a && !a.needsMfa ? a.id : null,
          p_product: uuid(b.product_id),
          p_quantity: integer(b.quantity || 1),
          p_coupon: "",
        }),
      );
    }
    if (!a) throw new AppError("F90_AUTH");
    if (
      a.keyId &&
      ![
        "services",
        "balance",
        "checkout",
        "add",
        "status",
        "order",
        "history",
      ].includes(action)
    )
      throw new AppError("F90_FORBIDDEN");
    if (action === "me") return out(await summary(a));
    protect(a);
    if (action === "services") {
      scoped(a, "catalog");
      const prices =
        a.role === "trader"
          ? check(
              await db
                .from("f90_product_internal")
                .select("product_id,trader_price_usd"),
            )
          : [];
      return out(
        (await publicCatalog()).products.map((p: any) => ({
          service: p.id,
          name: p.name,
          category: p.category_id,
          type: p.commerce.type || "fixed",
          rate:
            prices.find((i: any) => i.product_id === p.id)?.trader_price_usd ??
            p.commerce.prices?.USD,
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
        })),
      );
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
      if (!verification.is_verified) throw new AppError("F90_VERIFICATION_REQUIRED", 403, "يجب توثيق الحساب قبل الشراء. افتح صفحة توثيق الهوية من حسابك.");
      const product = uuid(b.product_id || b.service);
      const fields = b.fields || { account_id: b.link || b.account_id };
      const expected =
        b.expected_total_usd ??
        (a.keyId
          ? (
              await rpc("f90_quote", {
                p_user: a.id,
                p_product: product,
                p_quantity: integer(b.quantity || 1),
                p_coupon: "",
              })
            ).total_usd
          : null);
      if (a.keyId && !b.idempotency_key) throw new AppError("F90_IDEMPOTENCY");
      const data = await rpc("f90_checkout", {
        p_user: a.id,
        p_product: product,
        p_quantity: integer(b.quantity || 1),
        p_fields: fields,
        p_key: text(b.idempotency_key, 160),
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
    if (action === "status" || action === "order") {
      scoped(a, "orders");
      const o = check(
        await db
          .from("f90_orders")
          .select("*")
          .eq("id", uuid(b.id || b.order))
          .eq("user_id", a.id)
          .single(),
      );
      const events = check(
        await db
          .from("f90_order_events")
          .select("*")
          .eq("order_id", o.id)
          .order("created_at"),
      );
      return out({ order: customerOrder(o), events });
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
      const verification = check(await db.from("profiles").select("is_verified").eq("id", a.id).single());
      if (!verification.is_verified) throw new AppError("F90_VERIFICATION_REQUIRED", 403, "يجب توثيق الحساب قبل الإيداع. افتح صفحة توثيق الهوية من حسابك.");
      return out(
        await rpc("f90_submit_deposit", {
          p_user: a.id,
          p_method: text(b.method_id, 100),
          p_currency: text(b.currency, 8),
          p_amount: num(b.amount, 0.000001, 1000000),
          p_receipt: text(b.receipt_path, 500),
          p_reference: text(b.reference, 300),
          p_key: text(b.idempotency_key, 160),
        }),
        201,
      );
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
      const owner = a.role === "manager" && b.user_id ? uuid(b.user_id) : a.id;
      const target = check(
        await db
          .from("f90_user_roles")
          .select("role")
          .eq("user_id", owner)
          .single(),
      );
      if (target.role !== "trader")
        throw new AppError(
          "F90_FORBIDDEN",
          400,
          "امنح الحساب صلاحية تاجر أولًا",
        );
      const count = await db
        .from("f90_api_keys")
        .select("id", { count: "exact", head: true })
        .eq("user_id", owner)
        .eq("is_active", true);
      if ((count.count || 0) >= 10)
        throw new AppError("F90_FIELDS", 400, "الحد الأقصى عشرة مفاتيح نشطة");
      const random = crypto.getRandomValues(new Uint8Array(32));
      const token =
        "f90_live_" +
        [...random].map((x) => x.toString(16).padStart(2, "0")).join("");
      const key = check(
        await db
          .from("f90_api_keys")
          .insert({
            user_id: owner,
            name: text(b.name || "مفتاح متجر", 100),
            token_hash: await hash(token),
            token_prefix: token.slice(0, 16) + "…" + token.slice(-4),
            expires_at: b.expires_at || null,
          })
          .select("id,name,token_prefix,expires_at")
          .single(),
      );
      return out({ ...key, token }, 201);
    }
    if (action === "key.revoke") {
      if (a.keyId) throw new AppError("F90_FORBIDDEN");
      let q = db
        .from("f90_api_keys")
        .update({ is_active: false })
        .eq("id", uuid(b.id));
      if (a.role !== "manager") q = q.eq("user_id", a.id);
      check(await q);
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
    return fail(e);
  }
});
