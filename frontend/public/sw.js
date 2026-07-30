const BUILD_ID = self.registration?.scope ? "otui-static" : "otui-static";
// Cache name includes a deploy-friendly suffix; activate clears prior caches.
const CACHE_NAME = `otui-static-v6-${BUILD_ID}`;
const PRECACHE_ASSETS = ["/manifest.json", "/favicon.png", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isHtmlResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html");
}

function isScriptRequest(request, url) {
  if (request.destination === "script") return true;
  return /\.m?js$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept/cache API or health calls — data must always be fresh.
  if (url.pathname.startsWith("/api/") || url.pathname === "/health") return;

  const isNavigation = request.mode === "navigate";
  const isHtml = request.headers.get("accept")?.includes("text/html");

  // Network-first for navigation and HTML so deploys never leave stale shells
  // pointing at deleted hashed assets.
  if (isNavigation || isHtml) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match("/index.html");
        }),
    );
    return;
  }

  // Network-first for JS modules/chunks. Never cache failed responses or HTML
  // returned for a JavaScript request (SPA fallback on missing hashed files).
  if (isScriptRequest(request, url) || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const shouldCache =
            url.origin === self.location.origin &&
            resp.ok &&
            !isHtmlResponse(resp);
          if (shouldCache) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached && !isHtmlResponse(cached)) return cached;
          throw new TypeError("Failed to fetch asset");
        }),
    );
    return;
  }

  // Stale-while-revalidate for remaining static assets (icons, css, fonts).
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((resp) => {
          const shouldCache =
            url.origin === self.location.origin &&
            resp.ok &&
            !isHtmlResponse(resp);
          if (shouldCache) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
