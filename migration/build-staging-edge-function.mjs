// Build the guarded Supabase Edge Function for the NEW staging project only.
// Do not deploy this output to the old, live Supabase project.
// Zero secret material is required. All commercial actions fail closed.
import { readFile, writeFile, mkdir, readdir, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const sourceDir = resolve("supabase/functions/f90-platform");
const targetDir = resolve("dist-f90-staging-functions/f90-platform");
await mkdir(targetDir, { recursive: true });
const original = await readFile(join(sourceDir, "index.ts"), "utf8");
function replaceOnce(value, before, after) {
  if (value.split(before).length !== 2)
    throw Error("Refused: function source changed; review the staging guard before deploying.");
  return value.replace(before, after);
}
if (original.includes("F90_MIGRATION_ONLY"))
  throw Error("The committed production source must not include the staging guard.");
const insertion = `    const action = text(b.action, 80);
    // F90_MIGRATION_ONLY: no financial or fulfillment actions on staging.
    const stageAllowed = new Set([
      "health", "catalog", "quote", "media.state", "me", "balance",
      "recipients.list", "categories", "services", "service",
      "staff.catalog", "staff.list", "staff.inbox", "staff.order_requests",
      "staff.salary.list", "staff.finance", "staff.providers",
      "staff.alerts", "staff.traders", "staff.trader_keys",
    ]);
    if (!stageAllowed.has(action))
      throw new AppError("F90_MIGRATION_READONLY", 423, "نسخة النقل للقراءة فقط حتى اكتمال نقل العملاء والتحقق من العمليات");
`;
let guarded = replaceOnce(original, "    const action = text(b.action, 80);\n", insertion);
guarded = replaceOnce(guarded,
  'status: "ready",\n      checkout: "wallet",',
  'status: "migration_readonly",\n      checkout: "disabled",');
guarded = replaceOnce(guarded,
  '? { version: 3, checkout: "wallet" }',
  '? { version: 3, checkout: "disabled", status: "migration_readonly" }');
const files = await readdir(sourceDir, { withFileTypes: true });
for (const file of files) {
  if (!file.isFile()) continue;
  if (!/\.(ts|mjs|json)$/.test(file.name)) continue;
  if (file.name === "index.ts")
    await writeFile(join(targetDir, file.name), guarded);
  else
    await copyFile(join(sourceDir, file.name), join(targetDir, file.name));
}
if (!guarded.includes("F90_MIGRATION_ONLY") ||
    !guarded.includes('status: "migration_readonly"') ||
    !guarded.includes('checkout: "disabled"'))
  throw Error("Generated guard verification failed.");
console.log("F90 staging-only Edge Function created. Do not deploy to production.");
