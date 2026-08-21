const CACHE = 'vali-shell-v2';

const CORE = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(CORE))
  );

  self.skipWaiting();
});


self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});


self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // درخواست‌های API کش نشوند
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // درخواست‌های خارج از دامنه برنامه کش نشوند
  if (url.origin !== self.location.origin) {
    return;
  }

  // صفحات برنامه
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();

          caches
            .open(CACHE)
            .then(cache =>
              cache.put(event.request, copy)
            );

          return response;
        })
        .catch(() =>
          caches.match('/index.html')
        )
    );

    return;
  }

  // فایل‌های CSS / JS / تصاویر
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) {
          return cached;
        }

        return fetch(event.request)
          .then(response => {
            if (!response || !response.ok) {
              return response;
            }

            const copy = response.clone();

            caches
              .open(CACHE)
              .then(cache =>
                cache.put(event.request, copy)
              );

            return response;
          });
      })
  );
});
