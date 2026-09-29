/* Focci service worker — offline app shell.
   Bump CACHE version whenever you change ANY file, to force an update.
   Only small, essential files are precached on install (so a typo in one
   of the many illustration paths can never break the whole install) —
   every image is cached automatically the first time it's fetched
   successfully, which happens naturally the first time you open the
   app online. */
const CACHE = 'focci-v184';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './residents.js',
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
  './focci-world/world.js',
  './focci-world/theme-overrides.css',
  './focci-world/vendor/three/three.module.js',
  './focci-world/vendor/three/GLTFLoader.js'
  // the .glb/.mp3 files under focci-world/assets/ are NOT in this list on
  // purpose — the fetch handler below already caches any same-origin GET
  // the first time it succeeds, so they'll be cached automatically the
  // first time someone opens the 3D world, without bloating initial install.
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
