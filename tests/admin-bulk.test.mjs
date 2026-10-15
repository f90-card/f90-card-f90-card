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
test("bulk product edits call authenticated server operations without local direct table writes", () => {
  assert.match(admin, /async function runBulkProducts\(pending, status\)/);
  assert.match(admin, /\["show", "hide", "move", "image", "delete", "fulfillment"\]/);
  assert.match(admin, /pending\.mode === "move" \? pending\.categoryId : null/);
  assert.match(admin, /A\.call\("catalog\.bulk_products", \{ ids: pending\.ids, mode: pending\.mode, value \}\)/);
  assert.match(admin, /A\.call\("catalog\.bulk_fulfillment", \{ ids: pending\.ids, mode: pending\.fulfillment \}\)/);
  assert.doesNotMatch(admin.slice(admin.indexOf("async function runBulkProducts"), admin.indexOf("function libraryButtons")), /\.from\("products"\)\.update\(/);
});
test("bulk tools are responsive", () => assert.match(css, /\.f90-bulk-bar/));
