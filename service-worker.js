const CACHE_NAME = 'bamiweb-pwa-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa.js',
  './service-worker.js',
  './favicon.png',
  './darkmode.css',
  './ai.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || !isSameOrigin(request)) return;

  const destination = request.destination || 'document';

  if (request.mode === 'navigate' || destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (['script', 'style', 'image', 'font', 'manifest'].includes(destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return response;
          })
          .catch(() => null);

        return cached || networkFetch || caches.match('./index.html');
      })
    );
  }
});
