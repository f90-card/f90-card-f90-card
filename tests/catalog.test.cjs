const test = require("node:test"),
  assert = require("node:assert/strict");
test("a refill flag on an ancestor blocks child services in the catalog", async () => {
  const { parentRefilling } =
    await import("../supabase/functions/f90-platform/catalog.mjs");
  const categories = [
    {
      id: "games",
      is_active: true,
      presentation: { availability: "refilling" },
    },
    { id: "pubg", parent_id: "games", is_active: true, presentation: {} },
  ];
  assert.equal(parentRefilling("pubg", categories), true);
  categories[0].presentation.availability = "available";
  assert.equal(parentRefilling("pubg", categories), false);
  assert.equal(parentRefilling(null, categories), false);
  assert.equal(parentRefilling("missing", categories), true);
});
