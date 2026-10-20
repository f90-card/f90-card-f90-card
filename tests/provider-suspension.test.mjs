import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const edge = readFileSync(new URL("../supabase/functions/f90-platform/index.ts", import.meta.url), "utf8");
const admin = readFileSync(new URL("../admin.js", import.meta.url), "utf8");
test("supplier suspension marks linked services as refilling while disconnect hides them", () => {
  assert.match(edge, /async function publicCatalog\(\)/);
  assert.match(edge, /providerById/);
  assert.match(edge, /hiddenProductIds/);
  assert.match(edge, /!hiddenProductIds\.has\(p\.id\)/);
  assert.match(edge, /pausedProductIds\.has\(p\.id\)/);
  assert.match(edge, /provider\.config\?\.disconnected/);
  assert.match(edge, /automatic_orders_enabled !== true/);
  assert.match(edge, /\.not\("provider_id", "is", null\)/);
});
test("disabled suppliers are blocked for quotes and new orders", () => {
  assert.match(edge, /async function assertProviderAvailable\(productId: string\)/);
  assert.match(edge, /if \(!p\?\.is_enabled \|\| p\.config\?\.disconnected \|\| p\.config\?\.archived_at\)/);
  assert.match(edge, /quoteProductId \? assertProviderAvailable\(quoteProductId\) : Promise\.resolve\(\)/);
  assert.match(edge, /const \[a\] = await Promise\.all\(/);
  assert.match(edge, /if \(action === "quote"\) \{[\s\S]*?await rpc\("f90_quote"/);
  const checkout=edge.slice(edge.indexOf('if (action === "checkout" || action === "add")'),edge.indexOf('if (action === "transaction.lookup")'));
  assert.ok(checkout.indexOf("if (previous)") < checkout.indexOf("await assertProviderAvailable(product)"));
  assert.ok(checkout.indexOf("await assertProviderAvailable(product)") < checkout.indexOf('rpc("f90_checkout"'));
});
test("supplier toggle modifies only the supplier state and adds audit", () => {
  const start = edge.indexOf('if (action === "provider.toggle")');
  const end = edge.indexOf('if (action === "provider.services")', start);
  assert.ok(start > -1 && end > start);
  const block = edge.slice(start,end);
  assert.match(block, /requireRole\(a, "manager"\)/);
  assert.match(block, /typeof b\.is_enabled !== "boolean"/);
  assert.match(block, /\.update\(\{ is_enabled: b\.is_enabled \}\)/);
  assert.match(block, /action: "provider.toggle"/);
  assert.doesNotMatch(block, /\.update\(\{ is_active:/);
});
test("admin asks for confirmation before supplier toggle", () => {
  assert.match(admin, /data-action="provider-toggle"/);
  assert.match(admin, /data-action="provider-toggle-confirm"/);
  assert.match(admin, /A\.call\("provider.toggle", \{ id: pending\.id, is_enabled: pending\.enable \}\)/);
});

