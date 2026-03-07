const CACHE_NAME = "pokemon-cache-v2";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/offline.html"
];

self.addEventListener("install", event => {
  // Activate new SW immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(err => {
        // swallow so install doesn't fail silently; check DevTools for details
        console.error("SW install: cache.addAll failed:", err);
      })
  );
});

self.addEventListener("activate", event => {
  // Remove old caches and take control of clients
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;

  // Handle navigation requests (pages) with network-first, fallback to cache/offline
  if (req.mode === "navigate" || (req.method === "GET" && req.headers.get("accept")?.includes("text/html"))) {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Put copy in cache for offline use (only for successful responses)
          if (res && res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // For other GET requests, use cache-first then network, and cache network responses
  if (req.method === "GET") {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req)
          .then(res => {
            // Only cache successful responses
            if (!res || !res.ok) return res;
            // Only cache same-origin or CORS-safe responses
            const shouldCache = req.url.startsWith(self.location.origin);
            if (shouldCache) {
              const resClone = res.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
            }
            return res;
          })
          .catch(() => {
            // optional: return a generic fallback image for images, etc.
            return cached || undefined;
          });
      })
    );
  }
});
