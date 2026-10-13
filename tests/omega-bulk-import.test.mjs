import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../admin.js", import.meta.url), "utf8");
const start = source.indexOf("  function providerServiceCategory(service) {");
const end = source.indexOf("  function updateProviderImportPreview()", start);
assert.ok(start >= 0 && end > start, "Omega import helpers not found");
const categories = [
  { id: "games", name: "الألعاب", slug: "قسم-ألالعاب" },
  { id: "cards", name: "البطاقات الرقمية", slug: "digital-cards" },
  { id: "social", name: "خدمات السوشيال ميديا", slug: "social-media" },
  { id: "other", name: "خدمات الموقع", slug: "store-services" },
  { id: "stream", name: "اشتراكات البث", slug: "streaming" },
  { id: "ai", name: "خدمات الذكاء الاصطناعي", slug: "artificial-intelligence" },
  { id: "mobile", name: "شحن الهاتف", slug: "mobile-credit" },
  { id: "apps", name: "التطبيقات", slug: "applications" },
];
function harness(services, send) {
  const S = { categories, importServices: services };
  const A = { call: async (action, payload) => {
    assert.equal(action, "provider.import");
    return send(payload);
  } };
  const f = vm.runInNewContext(source.slice(start, end) +
    "\n({ importAllProviderDrafts, providerServiceCategory })", { S, A });
  return f;
}
test("bulk import processes entire list beyond 1000 in safe 50-item batches", async () => {
  const services = Array.from({ length: 1051 }, (_, id) => ({
    id: id + 1, name: "PUBG UC " + id, category: "الألعاب", rate: 2, unit_quantity: 1,
  }));
  const seen = [];
  const h = harness(services, async (payload) => {
    seen.push(payload);
    assert.ok(payload.service_ids.length <= 50);
    assert.equal(payload.margin_percent, 5);
    assert.equal(Object.values(payload.category_ids).every((id) => id === "games"), true);
    return payload.service_ids.map((id) => ({ id }));
  });
  const result = await h.importAllProviderDrafts({
    id: "provider-test", adapter: "omega", margin_percent: 5,
  }, { textContent: "" });
  assert.equal(seen.length, 22);
  assert.equal(result.imported, 1051);
  assert.equal(result.accepted, 1051);
  assert.equal(result.needsReview, 0);
});
test("bulk import preserves supplier names, deduplicates IDs and flags uncertain categories", async () => {
  const result = await harness([
    { id: "2", name: "خدمة لا تصنيف لها", category: "مجهول", rate: 1 },
    { id: "2", name: "مكررة", category: "مجهول", rate: 1 },
    { id: "3", name: "بطاقة هدية", category: "البطاقات الرقمية", rate: 2 },
  ], async (payload) => {
    assert.deepEqual(Array.from(payload.service_ids), ["2", "3"]);
    assert.equal(payload.names["2"], "خدمة لا تصنيف لها");
    assert.equal(payload.category_ids["2"], "other");
    assert.equal(payload.category_ids["3"], "cards");
    return [{ skipped: true }, { id: "new" }];
  }).importAllProviderDrafts({ id: "provider", adapter: "omega", margin_percent: 5 }, {});
  assert.equal(result.skipped, 1);
  assert.equal(result.imported, 1);
  assert.equal(result.needsReview, 1);
});
test("bulk import cannot run for unrelated supplier", async () => {
  const h = harness([{ id: 1, name: "A", rate: 1 }], async () => []);
  await assert.rejects(h.importAllProviderDrafts({ adapter: "smm" }, {}), /مخصص لأوميغا/);
});

test("Omega classifier prioritizes gift-card products over generic game categories", () => {
  const { providerServiceCategory: resolve } = harness([], async () => []);
  assert.equal(resolve({ name: "Steam Wallet Gift Card 20 USD", category: "الألعاب" }).id, "cards");
  assert.equal(resolve({ name: "Google Play بطاقة 10$", category: "الألعاب" }).id, "cards");
  assert.equal(resolve({ name: "PUBG UC 60 شدة", category: "الالعاب" }).id, "games");
});
test("Omega classifier handles Arabic spelling and service-specific matches", () => {
  const { providerServiceCategory: resolve } = harness([], async () => []);
  assert.equal(resolve({ name: "اشتراك NETFLIX لمدة شهر", category: "متنوع" }).id, "stream");
  assert.equal(resolve({ name: "شحن رصيد هاتف", category: "غير مصنف" }).id, "mobile");
  assert.equal(resolve({ name: "متابعين Instagram", category: "متنوع" }).id, "social");
  assert.equal(resolve({ name: "اشتراك ChatGPT", category: "متنوع" }).id, "ai");
  assert.equal(resolve({ name: "خدمة عادية", category: "أَلْعَاب" }).id, "games");
});
test("Omega classifier holds unknown or conflicting services for human review", () => {
  const { providerServiceCategory: resolve } = harness([], async () => []);
  assert.equal(resolve({ name: "خدمة غير معروفة", category: "غير معروف" }).review, true);
  assert.equal(resolve({ name: "متابعين PUBG UC", category: "غير معروف" }).review, true);
  assert.equal(resolve({ name: "PUBG UC 60 شدة", category: "الألعاب" }).review, false);
});

test("manual Omega import preselects only confident classifications", () => {
  assert.match(source, /omega \? \(!providerServiceCategory\(service\)\.review/);
  assert.match(source, /providerServiceCategory\(service\)\.id === c\.id/);
  assert.match(source, /" · يحتاج مراجعة"/);
});
