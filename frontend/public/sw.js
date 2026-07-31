/* OpenTerminal service worker — shell + hashed assets only. Never caches live market data. */
const BUILD_ID = "__OTUI_BUILD_ID__";
const SHELL_CACHE = `otui-shell-${BUILD_ID}`;
const ASSET_CACHE = "otui-assets-v1";
const PRECACHE_ASSETS = [
  "/manifest.json",
  "/favicon.png",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => {
        // First install: activate immediately. Updates wait for the user banner.
        if (!self.registration.controller) {
          return self.skipWaiting();
        }
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Drop prior application-shell caches only. Keep ASSET_CACHE so tabs on an
      // older build retain hashed chunks until they reload (atomic deploy safety).
      await Promise.all(
        keys
          .filter((key) => key.startsWith("otui-shell-") && key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      );
      // Legacy single-cache names from earlier SW versions.
      await Promise.all(
        keys
          .filter((key) => key.startsWith("otui-static-") || key === "otui-static")
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isHtmlResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html");
}

function isScriptRequest(request, url) {
  if (request.destination === "script") return true;
  return /\.m?js$/i.test(url.pathname);
}

function isLiveDataPath(pathname) {
  if (pathname.startsWith("/api/")) return true;
  if (pathname === "/health") return true;
  // Auth and account surfaces must never be SW-cached.
  if (pathname.startsWith("/auth")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Never intercept non-GET, WebSocket upgrades, or live data.
  if (request.method !== "GET") return;
  if (request.headers.get("upgrade") === "websocket") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isLiveDataPath(url.pathname)) return;

  const isNavigation = request.mode === "navigate";
  const isHtml = request.headers.get("accept")?.includes("text/html");

  // Network-first for navigation and HTML. Cached shell only after network failure.
  if (isNavigation || isHtml) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return (
            (await caches.match("/app.html")) ||
            (await caches.match("/index.html")) ||
            (await caches.match("/offline.html")) ||
            Response.error()
          );
        }),
    );
    return;
  }

  // Network-first for JS modules/chunks and hashed /assets/*.
  // Never cache failed responses or HTML returned for a JavaScript request.
  if (isScriptRequest(request, url) || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const shouldCache = resp.ok && !isHtmlResponse(resp);
          if (shouldCache) {
            const copy = resp.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
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

  // Stale-while-revalidate for remaining static assets (icons, fonts, css).
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((resp) => {
          const shouldCache = resp.ok && !isHtmlResponse(resp);
          if (shouldCache) {
            const copy = resp.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
