// Execution method is independent of quantity input and API dispatch.
export const SHIHAB_ID = "9c95e9bc-8930-490d-bb23-92d67a0dc428";
export function executionEvidence(item) {
  const evidence = [];
  for (const field of ["fulfillment", "execution_type", "execution_mode", "delivery_type"]) {
    const value = typeof item?.[field] === "string" ? item[field].trim().toLowerCase() : "";
    if (["auto", "automatic", "تلقائي"].includes(value)) evidence.push({field, value, mode:"automatic"});
    if (["manual", "يدوي"].includes(value)) evidence.push({field, value, mode:"manual"});
  }
  if (!evidence.length || new Set(evidence.map(e=>e.mode)).size !== 1) return null;
  return {mode:evidence[0].mode, fields:evidence};
}
export function shihabSnapshot(items) {
  if (!Array.isArray(items) || items.length < 100 || items.length > 5000)
    throw new Error("Invalid supplier catalog size");
  const seen = new Set();
  return items.map(item => {
    const id = String(item.id ?? "");
    if (!/^[0-9]{1,100}$/.test(id) || seen.has(id) || typeof item.available !== "boolean")
      throw new Error("Invalid or duplicate supplier service");
    seen.add(id);
    const price=Number(item.price);
    return {id, available:item.available && Number.isFinite(price) && price>0,
      evidence:executionEvidence(item),
      // Only catalog metadata is retained; credentials and profile data never enter snapshots.
      source:Object.fromEntries(["id","name","category_name","available","product_type","qty_values",
        "fulfillment","execution_type","execution_mode","delivery_type"].filter(k=>Object.hasOwn(item,k)).map(k=>[k,item[k]]))};
  });
}
export function shihabStatus(value) {
  const s=String(value??"").trim().toLowerCase().replace(/[ _-]/g,"");
  if (["accept","accepted","completed","complete","success","successful"].includes(s)) return "completed";
  if (["reject","rejected","failed","error"].includes(s)) return "rejected";
  if (["cancel","canceled","cancelled"].includes(s)) return "cancelled";
  if (["pending","waiting","queued","wait"].includes(s)) return "pending";
  return "processing";
}
export function shihabPublicProduct(product, provider) {
  return provider?.config?.catalog_visibility === "public" && product?.is_active === true &&
    !["hidden","admin","private"].includes(product?.commerce?.catalog_visibility) &&
    product?.commerce?.admin_only !== true;
}
