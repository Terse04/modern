// Modern Social Listening Service Worker v2
const CACHE_NAME = 'modern-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Pass through non-GET requests (POST, DELETE, etc.)
  if (event.request.method !== 'GET') return;

  // Never cache API calls, Supabase, or audio streams — always network
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/audio/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('pixabay') ||
    url.hostname.includes('audius')
  ) {
    return;
  }

  // For HTML navigation requests (SPA routes like /room/xyz),
  // use network-first so the latest app shell is always served
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the fresh response for offline fallback
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          return response;
        })
        .catch(() => {
          // Offline: serve the cached app shell
          return caches.match('/');
        })
    );
    return;
  }

  // For static assets (JS, CSS, images): stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
