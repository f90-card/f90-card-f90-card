// مثال خادم فقط. لا تضع مفتاحك في تطبيق العميل.
const endpoint =
  "https://xzqnrpycjxfbyrfaolud.supabase.co/functions/v1/f90-platform";

export async function request(action, payload = {}) {
  const token = process.env.F90_API_KEY;
  if (!token) throw new Error("اضبط F90_API_KEY على الخادم");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-f90-key": token },
    body: JSON.stringify({ ...payload, action }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message || "تعذّر إكمال الطلب");
    error.code = body.error?.code;
    error.status = response.status;
    throw error;
  }
  return body.data;
}

export const services = () => request("services");
export const balance = () => request("balance");
export const quote = (productId, quantity) =>
  request("quote", { product_id: productId, quantity });
export const status = (orderId) => request("status", { order: orderId });
export function purchase({
  productId,
  quantity = 1,
  accountId,
  fields,
  reference,
  expectedTotal,
}) {
  if (
    typeof reference !== "string" ||
    reference.length < 8 ||
    reference.length > 160
  )
    throw new Error("احفظ مرجعًا ثابتًا بطول ٨ إلى ١٦٠ محرفًا قبل أول اتصال");
  return request("checkout", {
    product_id: productId,
    quantity,
    fields: fields || { account_id: accountId },
    idempotency_key: reference,
    ...(expectedTotal != null ? { expected_total_usd: expectedTotal } : {}),
  });
}

// الاستخدام من خادمك بعد موافقة العميل:
// const price = await quote(productId, 1000);
// const order = await purchase({ productId, quantity: 1000, accountId: "12345",
//   reference: savedReference, expectedTotal: price.total_usd });
// await status(order.id);
// عند فقدان الاستجابة، استخدم savedReference نفسه؛ لا تنشئ شراء جديدًا تلقائيًا.
