
// Contabilità Ricariche – service-worker.js v3
// Cache app-shell + SWR per richieste GET; fallback offline; SPA routing

const CACHE_VERSION = 'v3.0.0';
const STATIC_CACHE = `ricariche-static-${CACHE_VERSION}`;

// App shell da pre-cachare
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // gestiamo solo GET

  const url = new URL(req.url);

  // SPA: per navigazioni documento, serviamo index.html dal cache
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((res) => res || fetch('./index.html'))
    );
    return;
  }

  // Cache-first per app shell/static assets
  const isAppShell = APP_SHELL.some((p) => url.pathname.endsWith(p.replace('./','/')));
  if (isAppShell) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          }
          return networkRes;
        });
      })
    );
    return;
  }

  // SWR (stale-while-revalidate) per il resto
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          }
          return networkRes;
        })
        .catch(() => cached); // offline fallback

      return cached || networkFetch;
    })
  );
});

// Aggiornamento immediato opzionale
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
