// Contabilità Ricariche – service-worker.js v3.3.1
const CACHE_VERSION = 'v3.3.1';
const STATIC_CACHE = `ricariche-static-${CACHE_VERSION}`;
const APP_SHELL = [
  './', './index.html', './styles.css', './app.js', './manifest.json',
  './assets/icon-192.png', './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(c => c.addAll(APP_SHELL)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k=>k!==STATIC_CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then(r => r || fetch('./index.html')));
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200) caches.open(STATIC_CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(()=>cached);
      return cached || network;
    })
  );
});