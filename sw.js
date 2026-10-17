const CACHE = "f90-static-v3-16";
const STATIC = [
  "./offline.html",
  "./styles.css",
  "./store-core.js",
  "./f90-startup-rescue.js",
  "./f90-catalog-rescue.json",
  "./icon.svg",
  "./f90-logo.png",
];
self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(STATIC))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("f90-static-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
// Cache only public image responses; never cache auth, signed URLs or API data.
const IMAGE_CACHE = "f90-public-images-v1";
const IMAGE_TTL = 60 * 60 * 1000;
const imageRequests = new Map();
async function publicImage(req) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(req);
  if (cached && Date.now() - Number(cached.headers.get("x-f90-cached-at")) < IMAGE_TTL)
    return cached;
  if (imageRequests.has(req.url)) return (await imageRequests.get(req.url)).clone();
  const pending = (async () => {
    try {
      const response = await fetch(new Request(req, {mode: "cors", credentials: "omit"}));
      if (response.ok && response.type !== "opaque" &&
          (response.headers.get("content-type") || "").startsWith("image/")) {
        const body = await response.clone().blob();
        if (body.size <= 4 * 1024 * 1024) {
          const headers = new Headers(response.headers);
          headers.set("x-f90-cached-at", String(Date.now()));
          await cache.put(req, new Response(body, {status: response.status, headers}));
          const keys = await cache.keys();
          await Promise.all(keys.slice(0, Math.max(0, keys.length - 120)).map(key => cache.delete(key)));
        }
      }
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })();
  imageRequests.set(req.url, pending);
  try { return (await pending).clone(); }
  finally { imageRequests.delete(req.url); }
}
self.addEventListener("fetch", (ev) => {
  const req = ev.request,
    u = new URL(req.url);
  if (req.method === "GET" && req.destination === "image" &&
      u.origin === "https://xzqnrpycjxfbyrfaolud.supabase.co" &&
      u.pathname.startsWith("/storage/v1/object/public/f90-images/") &&
      !req.headers.has("Authorization") && !req.headers.has("Range")) {
    ev.respondWith(publicImage(req).catch(() => fetch(req)));
    return;
  }
  if (
    req.method !== "GET" ||
    u.origin !== location.origin ||
    u.pathname.includes("/api/") ||
    req.headers.has("Authorization")
  )
    return;
  if (req.mode === "navigate") {
    ev.respondWith(
      fetch(req).catch(() =>
        caches.match(new URL("./offline.html", location.href).href),
      ),
    );
    return;
  }
  if (!STATIC.some((p) => new URL(p, location.href).pathname === u.pathname))
    return;
  ev.respondWith(
    fetch(req)
      .then((r) => {
        if (r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone()));
        return r;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })),
  );
});
