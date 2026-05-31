const CACHE_NAME = "ai-home-learning-pwa-root-v24";

const ROOT = new URL("./", self.location);
const toPath = (path) => new URL(path, ROOT).pathname;

const APP_SHELL = toPath("website/toolbox.html");
const OFFLINE_URL = toPath("website/offline.html");

const PRECACHE_URLS = [
  toPath("website/"),
  toPath("website/app.html"),
  toPath("website/index.html"),
  toPath("website/install.html"),
  toPath("website/toolbox.html"),
  toPath("website/styles.css"),
  toPath("website/script.js"),
  toPath("website/encrypted-page.js"),
  toPath("website/site.webmanifest"),
  toPath("website/offline.html"),
  toPath("website/icons/icon-72x72.svg"),
  toPath("website/icons/icon-96x96.svg"),
  toPath("website/icons/icon-128x128.svg"),
  toPath("website/icons/icon-144x144.svg"),
  toPath("website/icons/icon-180x180.png"),
  toPath("website/icons/apple-touch-icon-180x180.png"),
  toPath("website/icons/icon-192x192.svg"),
  toPath("website/icons/icon-192x192.png"),
  toPath("website/icons/icon-512x512.svg"),
  toPath("website/icons/icon-512x512.png"),
  toPath("resource_packs/00_使用前先看/资料库首页-v0.1.html"),
  toPath("resource_packs/00_使用前先看/隐私与反馈说明-v0.1.html"),
  toPath("resource_packs/01_新手7天包/新手7天行动卡-v0.1.html"),
  toPath("resource_packs/01_新手7天包/新手7天行动卡-组件版-v0.1.html"),
  toPath("resource_packs/02_AI安全使用包/AI安全使用包-组件版-v0.1.html"),
  toPath("resource_packs/02_AI安全使用包/作业边界卡-v0.1.html"),
  toPath("resource_packs/02_AI安全使用包/家庭AI使用公约-v0.1.html"),
  toPath("resource_packs/02_AI安全使用包/家庭AI使用边界8条-v0.1.html"),
  toPath("resource_packs/02_AI安全使用包/核验清单-v0.1.html"),
  toPath("resource_packs/02_AI安全使用包/隐私不要上传清单-v0.1.html"),
  toPath("resource_packs/03_国内AI工具池包/国内AI工具池-组件版-v0.1.html"),
  toPath("resource_packs/03_国内AI工具池包/工具替换说明-v0.1.html"),
  toPath("resource_packs/03_国内AI工具池包/工具池月度复核表-v0.1.html"),
  toPath("resource_packs/04_Prompt卡片包/家庭学习Prompt卡片40张-v0.1.html"),
  toPath("resource_packs/04_Prompt卡片包/家庭学习Prompt工具箱-v0.2.html"),
  toPath("resource_packs/05_AI口语练习专题/AI口语练习小专题-v0.1.html")
];

const STATIC_EXTENSIONS = /\.(?:css|js|json|png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf|otf|mp4|webm|pdf)$/i;

function requestUrl(request) {
  return new URL(request.url);
}

function isSameOrigin(request) {
  return requestUrl(request).origin === self.location.origin;
}

function isStaticAsset(request) {
  const url = requestUrl(request);
  return url.pathname.includes(".") && STATIC_EXTENSIONS.test(url.pathname);
}

async function preCache(cache) {
  const results = await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(encodeURI(url))));
  const failures = results
    .map((result, index) => (result.status === "rejected" ? PRECACHE_URLS[index] : null))
    .filter(Boolean);

  if (failures.length) {
    console.warn("PWA: some pre-cache entries failed", failures);
  }
}

async function cachedFallback(cache, request) {
  return (
    (await cache.match(request)) ||
    (await cache.match(encodeURI(APP_SHELL))) ||
    (await cache.match(encodeURI(OFFLINE_URL)))
  );
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
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || typeof event.data !== "object") return;
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
          return (await cachedFallback(cache, request)) || response;
        } catch (error) {
          return cachedFallback(cache, request);
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      if (isStaticAsset(request)) {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            await cache.put(request, response.clone());
            return response;
          }
          return cached || response || (await cache.match(encodeURI(OFFLINE_URL)));
        } catch (error) {
          return cached || cache.match(encodeURI(OFFLINE_URL));
        }
      }

      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
          return response;
        }
        return response || cache.match(encodeURI(OFFLINE_URL));
      } catch (error) {
        return cache.match(encodeURI(OFFLINE_URL));
      }
    })()
  );
});
