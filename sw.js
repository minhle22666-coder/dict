/* Smart.Dict service worker — offline app shell.
   Bump CACHE version whenever you change any file below, to force an update. */
const CACHE = 'smartdict-v3';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './seed.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Only handle same-origin GET (never touch the Gemini API call).
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // cache new same-origin GETs (e.g. after an update)
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() =>
        // offline navigation → fall back to the app shell
        req.mode === 'navigate' ? caches.match('./index.html') : undefined
      );
    })
  );
});
