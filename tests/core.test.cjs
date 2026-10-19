const test = require("node:test"),
  assert = require("node:assert/strict");
const C = require("../store-core.js");
test("pricing uses unit quantity, fixed packs and volume tiers", () => {
  const p = {
    commerce: {
      type: "quantity",
      prices: { USD: 15 },
      unit_quantity: 100000,
      pricing_tiers: [{ min: 1000000, prices: { USD: 12 } }],
    },
  };
  assert.equal(C.previewPrice(p, 10000), 1.5);
  assert.equal(C.previewPrice(p, 1000000), 120);
  assert.equal(
    C.previewPrice({ commerce: { type: "fixed", prices: { USD: 8 } } }, 999),
    8,
  );
});
test("FX conversion does not invent missing or disabled rates", () => {
  assert.equal(
    C.convert(10, "ILS", [{ currency: "ILS", is_enabled: true, per_usd: 3 }]),
    30,
  );
  assert.equal(
    C.convert(10, "ILS", [{ currency: "ILS", is_enabled: false, per_usd: 3 }]),
    null,
  );
  assert.equal(C.convert(10, "JOD", []), null);
});
test("zero stock and refilling remain unavailable across nested categories", () => {
  const cats = [
    { id: "a", is_active: true, presentation: {} },
    { id: "b", parent_id: "a", is_active: true, presentation: {} },
  ];
  const items = [{ category_id: "b", stock: 0, is_active: true, commerce: {} }];
  assert.equal(C.categoryUnavailable(cats[0], cats, items), true);
  items[0].stock = 1;
  assert.equal(C.categoryUnavailable(cats[0], cats, items), false);
  items[0].commerce.availability = "refilling";
  assert.equal(C.unavailable(items[0]), true);
});
test("render helpers escape markup and reject executable URLs", () => {
  assert.equal(C.safeUrl("javascript:alert(1)"), "");
  assert.match(C.escapeHTML('<img onerror="bad">'), /&lt;img/);
  assert.equal(C.escapeHTML('"'), "&quot;");
});
test("amount formatting preserves tiny financial discounts when requested", () => {
  assert.match(C.money(0.00005, "USD", true), /0\.00005|٠\.٠٠٠٠٥/);
});

test("bounded volume tiers honor inclusive endpoints and revert to base outside them",()=>{
 const p={currency:"USD",price:115,commerce:{type:"quantity",unit_quantity:1000000,prices:{USD:115},pricing_tiers:[{min:1,max:999999,prices:{USD:120}},{min:1000000,max:50000000,prices:{USD:110}}]}};
 for(const [q,expected] of [[1,0.00012],[999999,119.99988],[1000000,110],[50000000,5500],[50000001,5750.000115]])assert.ok(Math.abs(C.previewPrice(p,q)-expected)<0.0000001);
});
