// Umpire Assistant — Service Worker v0.21
// Network-first strategy: always tries the network, falls back to cache.
// This ensures updates deploy immediately without manual cache clearing.

const CACHE_NAME = 'umpire-assistant-v0-21';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // activate immediately without waiting for old SW to die
});

// Activate: delete ALL old caches and take control of all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim()) // take control of all open tabs now
  );
});

// Fetch: NETWORK-FIRST for html/js/css (so updates always come through),
// cache-first only for images (they rarely change).
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Always network for external APIs
  if (url.includes('api.open-meteo.com') || url.includes('nominatim.openstreetmap.org')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        JSON.stringify({ current: null }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Images: cache-first (they don't change between versions)
  if (url.match(/\.(png|jpg|jpeg|svg|gif|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // Everything else (index.html, sw.js, manifest.json): NETWORK-FIRST
  // Try network, update the cache with the fresh copy, fall back to cache if offline
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});

// Listen for SKIP_WAITING message from the page to activate immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
