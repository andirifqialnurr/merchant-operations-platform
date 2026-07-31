const APP_SHELL_CACHE = "merchant-application-shell-v1";
const APP_SHELL_URLS = ["/", "/design-system", "/manifest.webmanifest", "/merchant-pwa-icon.svg"];
const STATIC_ASSET_PREFIX = "/_next/static/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== APP_SHELL_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (url.pathname.startsWith(STATIC_ASSET_PREFIX)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (APP_SHELL_URLS.includes(url.pathname)) {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(APP_SHELL_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    throw new Error("Application shell is not cached yet.");
  }
}
