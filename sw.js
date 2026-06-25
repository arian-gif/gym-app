// Service worker: cache the app shell for offline use, but keep the app's own
// files fresh. App assets are network-first (always latest when online, cache
// only as offline fallback); the Chart.js CDN file is cache-first.
// Data (/api/data) is never cached. Bump CACHE to force a refresh of cached assets.
const CACHE = "gym-shell-v2";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./workouts.js",
  "./manifest.json",
  "./icon.svg",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // never cache the API
  if (url.pathname.includes("/api/") || url.pathname.includes("/.netlify/")) return;
  if (e.request.method !== "GET") return;

  // Our own files (HTML/JS/CSS) -> network-first so template/code updates show up
  // immediately when online; fall back to cache only when offline.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cross-origin (Chart.js CDN) -> cache-first (it's versioned and rarely changes).
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
    )
  );
});
