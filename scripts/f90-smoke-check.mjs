// F90 CARD lightweight nonfinancial release sanity checks.
// Uses only built-in Node.js modules; never calls APIs or touches wallet data.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const errors = [];
const requireFile = (name, reason) => {
  const path = join(root, name);
  if (!existsSync(path)) errors.push(`${reason}: missing ${name}`);
  return path;
};

const importantScripts = [
  "config.js", "store-core.js", "api.js", "reports.js", "app.js", "admin.js",
  "f90-quran.js", "f90-merchant-v2.js", "f90-welcome-scene.js", "f90-media-player.js"
];

for (const name of importantScripts) {
  const path = requireFile(name, "JavaScript");
  if (!existsSync(path)) continue;
  try {
    execFileSync(process.execPath, ["--check", path], { stdio: "pipe", timeout: 10000 });
  } catch (error) {
    errors.push(`JavaScript syntax: ${name}: ${String(error.stderr || error.message).slice(0, 320)}`);
  }
}

for (const name of ["index.html", "admin.html"]) {
  const path = requireFile(name, "Webpage");
  if (!existsSync(path)) continue;
  const html = readFileSync(path, "utf8");
  // Only files actually loaded by script/link tags; not runtime user-managed links.
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) || []) {
    const match = tag.match(/(?:src|href)="\.\/([^"?#]+)(?:\?[^"]*)?"/i);
    if (!match) continue;
    const filename = match[1];
    if (filename.includes("..")) {
      errors.push(`Suspicious asset path on ${name}: ${filename}`);
    } else {
      requireFile(filename, `${name} reference`);
    }
  }
  const requiredIDs = name === "index.html"
    ? ["mainContent", "drawer", "drawerLinks", "modalRoot", "headerWallet", "mobileDock"]
    : ["adminMain", "adminNav", "adminSidebar", "modalRoot"];
  for (const id of requiredIDs) {
    if (!html.includes(`id="${id}"`)) errors.push(`Missing required DOM node #${id} in ${name}`);
  }
}
for (const name of ["manifest.webmanifest", "admin.webmanifest", "docs/openapi.json", "docs/postman.json"]) {
  const path = requireFile(name, "Manifest/API spec");
  if (!existsSync(path)) continue;
  try {
    const json = JSON.parse(readFileSync(path, "utf8"));
    if (name.endsWith(".webmanifest")) {
      if (!json.start_url) errors.push(`${name} missing start_url`);
      for (const icon of json.icons || []) {
        if (icon.src?.startsWith("./")) requireFile(icon.src.slice(2), `${name} icon`);
      }
    }
  } catch (error) {
    errors.push(`Invalid JSON ${name}: ${error.message}`);
  }
}

if (errors.length) {
  for (const e of errors) console.error("FAIL:", e);
  console.error(`F90 checks failed: ${errors.length}`);
  process.exitCode = 1;
} else {
  console.log("F90 checks passed: core scripts, static assets, required page nodes and JSON.");
}
