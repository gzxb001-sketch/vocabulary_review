// 竹墨词库 — Service Worker
// 策略：应用壳缓存 + API 网络优先，保证快速加载的同时数据始终最新

const CACHE_NAME = "zhumo-v1";

// 安装时预缓存关键资源
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/review",
  "/manual",
  "/capture",
  "/words",
  "/login",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {
            // 忽略单个资源缓存失败（如未登录时某些页面可能重定向）
          })
        )
      );
    })
  );
  // 立即激活，不等待旧 SW
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  // 让新 SW 立即接管所有页面
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== self.location.origin) return;

  // API 请求：网络优先，失败时不做缓存回退（数据必须准确）
  if (url.pathname.startsWith("/api/")) {
    return; // 不做拦截，让浏览器正常走网络请求
  }

  // Next.js 开发时的 HMR / _next 资源：网络优先
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 导航请求（HTML 页面）：网络优先，离线时回退缓存
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他静态资源（图标等）：缓存优先
  event.respondWith(cacheFirst(request));
});

// 网络优先策略：先请求网络，失败时读缓存
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // 成功后更新缓存
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("离线状态，请联网后重试", { status: 503 });
  }
}

// 缓存优先策略：先读缓存，缓存未命中再请求网络
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("", { status: 408 });
  }
}
