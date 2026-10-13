import test from "node:test";
import assert from "node:assert/strict";
import { normalizeService, callProvider } from "../supabase/functions/f90-platform/provider.mjs";

test("Omega price is per item, with qty_values and required field names", () => {
  const p = normalizeService({
    id: 2054, name: "بطاقة رقمية", price: 8.5, category_name: "البطاقات الرقمية",
    product_type: "digital", qty_values: { min: 1, max: 10 },
    params: ["معرّف الحساب"], available: true,
  });
  assert.equal(p.id, "2054");
  assert.equal(p.rate, 8.5);
  assert.equal(p.unit_quantity, 1);
  assert.equal(p.min, 1);
  assert.equal(p.max, 10);
  assert.deepEqual(p.params, ["معرّف الحساب"]);
  assert.equal(p.category, "البطاقات الرقمية");
});
test("Omega unavailable or invalid services cannot be imported", () => {
  assert.equal(normalizeService({ id: 12, name: "unavailable", price: 1, available: false }), null);
  assert.equal(normalizeService({ id: 13, name: "", price: 2, product_type: "digital" }), null);
  assert.equal(normalizeService({ id: 14, name: "bad price", price: 0, product_type: "digital" }), null);
});
test("SMM services preserve per-1000 unit pricing", () => {
  const p = normalizeService({ service: 5, name: "Example", rate: "1.2", min: "10", max: "1000" });
  assert.equal(p.unit_quantity, 1000);
  assert.equal(p.rate, 1.2);
  assert.equal(p.omega, false);
});
test("Omega cannot submit paid orders, even when adapter receives a token", async () => {
  await assert.rejects(
    callProvider({ adapter: "omega", endpoint: "https://example.org" }, "redacted", "add", { service: 1 }),
    /طلبات أوميغا الآلية غير متاحة/,
  );
});
