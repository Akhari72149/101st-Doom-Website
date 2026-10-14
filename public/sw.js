const CACHE_NAME = "101st-doom-pwa-v1";
const APP_SHELL = [
  "/offline",
  "/icons/pwa-192.png",
  "/icons/pwa-512.png",
  "/icons/pwa-maskable-512.png",
];

const PUBLIC_PAGES = new Set([
  "/",
  "/Art-of-War",
  "/Join",
  "/News",
  "/Who-We-Are",
  "/certifications",
  "/certs",
  "/documents",
  "/faq",
  "/grand-orbat",
  "/rank-structure",
  "/recognition",
  "/roster",
  "/rules-and-regulations",
  "/servers",
  "/uniform-guide",
  "/weekly-attendance",
  "/whos-who",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("101st-doom-pwa-") && key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

async function networkFirstPage(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok && PUBLIC_PAGES.has(url.pathname)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match("/offline");
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request, url));
    return;
  }

  const safeStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/");
  if (safeStaticAsset) event.respondWith(cacheFirstAsset(request));
});
