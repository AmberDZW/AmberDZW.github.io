const CACHE_NAME = "ai-home-learning-pwa-v19";

const SITE_ROOT = new URL("../", self.location).pathname.replace(/\/\/+/g, "/");
const APP_ROOT = new URL("./", self.location).pathname.replace(/\/\/+/g, "/");

const toAbs = (path) => {
  try {
    return new URL(encodeURI(path), self.location).pathname;
  } catch (error) {
    return new URL(path, self.location).pathname;
  }
};

const PRECACHE_URLS = [
  `${APP_ROOT}`,
  toAbs("app.html"),
  toAbs("index.html"),
  toAbs("install.html"),
  toAbs("toolbox.html"),
  toAbs("styles.css"),
  toAbs("script.js"),
  toAbs("encrypted-page.js"),
  toAbs("site.webmanifest"),
  toAbs("offline.html"),
  toAbs("resource_packs/00_使用前先看/资料库首页-v0.1.html"),
  toAbs("resource_packs/00_使用前先看/隐私与反馈说明-v0.1.html"),
  toAbs("resource_packs/01_新手7天包/新手7天行动卡-组件版-v0.1.html"),
  toAbs("resource_packs/02_AI安全使用包/AI安全使用包-组件版-v0.1.html"),
  toAbs("resource_packs/03_国内AI工具池包/国内AI工具池-组件版-v0.1.html"),
  toAbs("resource_packs/04_Prompt卡片包/家庭学习Prompt工具箱-v0.2.html"),
  toAbs("icons/icon-72x72.svg"),
  toAbs("icons/icon-96x96.svg"),
  toAbs("icons/icon-128x128.svg"),
  toAbs("icons/icon-144x144.svg"),
  toAbs("icons/icon-192x192.svg"),
  toAbs("icons/apple-touch-icon-180x180.svg"),
  toAbs("icons/icon-512x512.svg")
];

const STATIC_EXTENSIONS = /\.(?:css|js|json|png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf|otf|mp4|webm|pdf)$/i;

function normalizeRequest(request) {
  return new URL(request.url);
}

async function preCache(cache) {
  const results = await Promise.allSettled(
    PRECACHE_URLS.map((url) => cache.add(url))
  );

  const failures = results
    .map((result, index) => (result.status === "rejected" ? PRECACHE_URLS[index] : null))
    .filter(Boolean);

  if (failures.length > 0) {
    console.warn("PWA: some pre-cache entries failed", failures);
  }
}

function isSameOrigin(request) {
  return normalizeRequest(request).origin === self.location.origin;
}

function isStaticAsset(request) {
  const url = normalizeRequest(request);
  return url.pathname.includes(".") && STATIC_EXTENSIONS.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => preCache(cache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || typeof event.data !== "object") {
    return;
  }

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !isSameOrigin(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            await cache.put(request, response.clone());
            return response;
          }
          return (
            (await cache.match(request)) ||
            (await cache.match(toAbs("index.html"))) ||
            (await cache.match(toAbs("offline.html")))
          );
        } catch (error) {
          return (
            (await cache.match(request)) ||
            (await cache.match(toAbs("index.html"))) ||
            (await cache.match(toAbs("offline.html")))
          );
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const fallback = await cache.match(toAbs("offline.html"));

      if (isStaticAsset(request)) {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            await cache.put(request, response.clone());
            return response;
          }
          return cached || fallback;
        } catch (error) {
          return cached || fallback;
        }
      }

      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
          return response;
        }
        return cached || response || fallback;
      } catch (error) {
        return fallback;
      }
    })()
  );
});
