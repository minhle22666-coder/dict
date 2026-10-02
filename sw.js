/* Focci service worker — offline app shell.
   Bump CACHE version whenever you change ANY file, to force an update.
   Only small, essential files are precached on install — every image is
   cached automatically the first time it's fetched successfully, which
   happens naturally the first time you open the app online. */
const CACHE = 'focci-v218';
const SHELL = [
  './',
  './index.html',
  './home-island.webp',
  './home-focci.webp',
  './banner-lettertrail.webp',
  './banner-listen.webp',
  './banner-wordpairs.webp',
  './banner-speakup.webp',
  './banner-hottake.webp',
  './app.js',
  './residents.js',
  './pets.js',
  './oracle.js',
  './focci-acts.js',
  './hexagrams.json',
  './hottake.js',
  './journal.js',
  './hottake.json',
  './box-hottake.png',
  './box-wordpairs.png',
  './box-lettertrail.png',
  './logo-ted.png',
  './logo-guardian.png',
  './logo-abcnews.png',
  './dict-system.js',
  './story.js',
  './random-quotes.js',
  './levels.txt',
  './manifest.json',
  './seed.json',
  './seed-files.txt',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './world.js',
  './theme-overrides.css',
  './vendor/three/three.module.js',
  './vendor/three/GLTFLoader.js'
  // These four used to be listed under './focci-world/...', left over from
  // the days when the world lived in a subfolder. The repo is flat, so all
  // four 404'd — and cache.addAll() rejects the WHOLE install if a single
  // request fails, so the install never once completed. Measured on the
  // live app: the cache existed and held exactly 0 entries, and no service
  // worker was ever active. That is why the app had no offline mode at all
  // and re-downloaded everything on every open.
  //
  // the .glb/.mp3 files under assets/ are NOT in this list on purpose —
  // the fetch handler below already caches any same-origin GET the first
  // time it succeeds, so they'll be cached automatically the first time
  // someone opens the 3D world, without bloating initial install.
];

// The daily-target reminder (pets.js) opens the app when tapped.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) =>
    cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
self.addEventListener('install', (e) => {
  /* One file at a time, each failure swallowed, instead of addAll().
     addAll() is atomic: one 404 anywhere in SHELL and the whole install
     rejects, leaving an empty cache and no worker — which is exactly what
     had been happening. A missing illustration should cost that one
     illustration, not the entire offline mode. */
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(
      SHELL.map((url) => c.add(url).catch((err) => {
        console.warn('[sw] precache skipped', url, err && err.message);
      }))
    )).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* The app's own code, as opposed to its pictures. */
const IS_CODE = /\.(?:html|js|css)$/i;

function putInCache(req, res) {
  if (!res || !res.ok) return;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Only handle same-origin GET (never touch the Gemini API call).
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const url = new URL(req.url);
  const isCode = req.mode === 'navigate' || IS_CODE.test(url.pathname);

  /* Code goes to the network first; everything else comes from the cache
     first.

     Cache-first for EVERYTHING was why a fixed bug could keep showing up
     for days. The cache only ever cleared on an install with a new CACHE
     name, and until that install ran — which needs the new sw.js to be
     fetched, which was itself being served from cache — every page, every
     script and every stylesheet came back at whatever version was stored.
     That is the "it still shows the old page" report, and it is also what
     made a stale search bar flash up on open: an old index.html answering
     instantly from disk.

     Pictures, models and fonts keep the old behaviour. They are big, they
     never change without being renamed, and they are the reason the cache
     exists at all.

     'no-cache' on the code request forces a revalidation rather than
     letting the browser's own HTTP cache answer behind the worker's back.
     That layer sits underneath this one and was quietly serving stale
     files even when this worker asked for them fresh. */
  if (isCode) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => { putInCache(req, res); return res; })
        .catch(() => caches.match(req).then((hit) =>
          hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // cache new same-origin GETs (this is how the illustration
        // library becomes available offline after first successful load)
        putInCache(req, res);
        return res;
      }).catch(() => undefined);
    })
  );
});
