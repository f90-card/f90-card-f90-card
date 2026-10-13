import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const admin = readFileSync(new URL("../admin.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../admin.css", import.meta.url), "utf8");
test("bulk editor supports filtered selection and explicit confirmation", () => {
  for(const key of ["bulk-select-visible", "bulk-clear", "bulk-confirm", "bulk-visibility", "bulk-move", "providerFilter", "f90-bulk-check"]) assert.ok(admin.includes(key));
  assert.match(admin, /const chosen = selectedBulkProducts\(\)/);
  assert.match(admin, /modal\("تأكيد تعديل "/);
});
test("each product modification uses authenticated catalog.save", () => {
  assert.match(admin, /await A\.call\("catalog\.save", \{ kind: "product", id, data \}\)/);
  assert.match(admin, /const data = \{ \.\.\.row \}/);
  assert.match(admin, /if \(pending\.mode === "hide"\) data\.is_active = false/);
  assert.match(admin, /if \(pending\.mode === "move"\) data\.category_id = pending\.categoryId/);
  assert.match(admin, /if \(!S\.categories\.some\(\(c\) => c\.id === target\)\)/);
});
test("bulk tools are responsive", () => assert.match(css, /\.f90-bulk-bar/));
