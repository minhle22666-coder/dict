/* Focci service worker — offline app shell.
   Bump CACHE version whenever you change ANY file, to force an update.
   Only small, essential files are precached on install (so a typo in one
   of the many illustration paths can never break the whole install) —
   every image is cached automatically the first time it's fetched
   successfully, which happens naturally the first time you open the
   app online. */
const CACHE = 'focci-v16';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './story-content.js',
  './story.js',
  './manifest.json',
  './seed.json',
  './seed-files.txt',
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
        // cache new same-origin GETs (this is how the illustration
        // library becomes available offline after first successful load)
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() =>
        // offline navigation → fall back to the app shell
        req.mode === 'navigate' ? caches.match('./index.html') : undefined
      );
    })
  );
});
