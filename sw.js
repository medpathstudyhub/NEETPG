/* MEDPATH service worker. Keep admin/login live-network only to avoid stale admin data. */
const VERSION = 'medpath-pwa-v1';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const APP_SHELL = [
  './', './index.html', './index2.html', './index3.html', './topics.html',
  './style.css', './pwa.js', './manifest.webmanifest',
  './icons/medpath-192.png', './icons/medpath-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('medpath-pwa-') && key !== SHELL && key !== RUNTIME)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('message', event => {
  if (event.data === 'MEDPATH_SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname.toLowerCase();
  // Admin and login pages must always use the network; never serve stale admin screens.
  if (/\/(admin\.html|login\.html)$/.test(path)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok && !/\/(admin\.html|login\.html)$/.test(new URL(request.url).pathname.toLowerCase())) {
          const cache = await caches.open(RUNTIME);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch (_) {
        return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Network-first keeps question banks and images current; cached copies support previously visited content offline.
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh.ok) {
        const cache = await caches.open(RUNTIME);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (_) {
      return (await caches.match(request)) || Response.error();
    }
  })());
});
