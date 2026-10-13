const CACHE = "f90-static-v3-9";
const STATIC = [
  "./offline.html",
  "./styles.css",
  "./store-core.js",
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
self.addEventListener("fetch", (ev) => {
  const req = ev.request,
    u = new URL(req.url);
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
      .catch(() => caches.match(req)),
  );
});
