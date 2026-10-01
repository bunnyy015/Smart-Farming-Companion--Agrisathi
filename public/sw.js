const CACHE_VERSION = "agrisathi-shell-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/agrisathi-icon.svg"];
const LIVE_DATA_HOSTS = [
  "api.data.gov.in",
  "api.open-meteo.com",
  "lgd-json-api.vercel.app",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("agrisathi-") && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") {
      event.respondWith(
        fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put("/index.html", copy));
            return response;
          })
          .catch(async () => (await caches.match(request)) || (await caches.match("/index.html")))
      );
      return;
    }

    if (url.pathname.startsWith("/assets/")) {
      event.respondWith(
        caches.match(request).then((cached) => {
          const fresh = fetch(request)
            .then((response) => {
              if (response.ok) {
                caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
              }
              return response;
            })
            .catch(() => cached);
          return cached || fresh;
        })
      );
    }
    return;
  }

  if (LIVE_DATA_HOSTS.includes(url.hostname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: "Offline and no saved data is available." }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        })
    );
  }
});
