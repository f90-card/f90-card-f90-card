const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const configuration = JSON.parse(fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8"));

test("production storefront hides internal project paths without protecting public shopping URLs", () => {
  const blocked = new Set((configuration.redirects || []).filter(x => x.destination === "/").map(x => x.source));
  for (const source of [
    "/tests/:path*", "/scripts/:path*", "/supabase/:path*", "/.github/:path*",
    "/marketing/:path*", "/SETUP.md", "/REVIEW.md", "/F90_REMAINING_WORK.md",
    "/assets/app-image-sources.json", "/assets/README.md", "/.gitignore",
    "/package.json", "/package-lock.json", "/vercel.json"
  ]) {
    assert.ok(blocked.has(source), source + " must not expose internal sources");
  }
  for (const publicPath of ["/", "/admin.html", "/api/manifest", "/docs/F90_MERCHANT_API_EN.md", "/assets/icons/icon-192.png"]) {
    assert.ok(!blocked.has(publicPath), publicPath + " must stay public");
  }
  // /index.html remains accessible through a permanent canonical redirect to /.
  const legacyIndex = (configuration.redirects || []).find(x => x.source === "/index.html");
  assert.ok(legacyIndex && legacyIndex.destination === "/" && legacyIndex.permanent === true,
    "/index.html must redirect to the public canonical homepage");
  assert.notEqual(configuration.headers?.length, 0, "secure site headers must remain configured");
});
