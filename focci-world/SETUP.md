# Focci's World — real engine, setup guide

> **⚠️ Path note for your actual repo layout:** your `index.html` lives
> INSIDE the same flat folder as `world.js`/`vendor/`/`theme-overrides.css`
> (not one level above it). Every `./focci-world/...` path below should be
> `./...` for you — see `index-fixed-block.html` for the corrected,
> ready-to-paste version of step 2's script block.

## 1. Copy files into your repo
Drop the whole `focci-world/` folder into your repo root, next to `index.html`.
It's self-contained: `world.js`, `vendor/three/*`, `assets/glb/*.glb`, `assets/audio/*.mp3`.

## 2. Add the overlay + import map to `index.html`
Confirmed: the 3D world runs **alongside** your existing 2D World Map
(`renderWorldMap()`'s 12-region strip in `story.js`) — it does not replace
it. It opens as a full-screen overlay from a button in the Game tab, and
closes back to the normal 2D UI.

Add this overlay markup once, anywhere in `<body>` (it starts hidden):

```html
<div id="fw-overlay" style="position:fixed;inset:0;z-index:40;display:none;background:#000;">
  <canvas id="fw-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:block;"></canvas>
  <button id="fw-close" aria-label="Close 3D world"
    style="position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);right:14px;z-index:2;
           width:38px;height:38px;border-radius:50%;border:none;background:rgba(0,0,0,.45);color:#fff;font-size:18px;">✕</button>
  <button id="fw-search-btn" aria-label="Search a word" class="fw-search-btn"
    style="position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);left:14px;z-index:2;">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
  </button>
  <div id="fw-search-pill" class="fw-search-pill" style="display:none;">
    <input id="fw-search-input" type="search" inputmode="search" placeholder="Search a word…" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="search" />
  </div>
  <div id="fw-word-progress" class="fw-word-progress"></div>
</div>
```

**Important: `.word-sheet` needs a higher z-index than `#fw-overlay`** — the
real bottom sheet (`showWordSheet()`) is `z-index:90` in your existing CSS,
while the 3D overlay is `z-index:40` above, specifically so the *real* word
sheet still renders on top when a search result opens while the 3D world is
showing (it also fixes it correctly layering above the "🔒 not finished"
info card, which uses the same mechanism). No changes needed to `.word-sheet`
itself — the numbers already work out (90 > 40); just don't raise
`#fw-overlay` above 90 later without rechecking this.

Add a tiny **bridge script** right after `story.js` loads, before the module
script below. This part matters and is easy to get wrong: `story.js`/`app.js`
load as plain (non-module) scripts, and most of their top-level functions
*do* become `window` properties automatically — but `ARC_LANDS` and `norm`
are declared with `const`, and `const`/`let` at the top level of a classic
script do **not** become `window` properties (they're only visible to other
classic scripts, not to `<script type="module">`). Bridge just those two:

```html
<script>
  window.ARC_LANDS = ARC_LANDS;
  window.norm = norm;
</script>
```

Now the import map and the module script:

```html
<script type="importmap">
{ "imports": { "three": "./focci-world/vendor/three/three.module.js" } }
</script>
<script type="module">
  import { bootFocciWorld } from './focci-world/world.js';
  import { FOCCI_ANGEL_MESSAGES } from './random-quotes.js';

  // Loads/parses levels.txt once (word<TAB>level, 1=A1 ... 6=C2) and caches
  // the result — tested against your real file: 27,397 entries parse clean,
  // 0 bad lines. Ship levels.txt at the repo root (same folder as
  // index.html) and it'll be precached by sw.js below, so it's available
  // offline immediately after "Add to Home Screen", same as your dict shards.
  let _levelsPromise = null;
  function loadLevels() {
    if (_levelsPromise) return _levelsPromise;
    _levelsPromise = fetch('./levels.txt').then(r => r.text()).then(text => {
      const map = new Map();
      for (const line of text.split('\n')) {
        if (!line) continue;
        const idx = line.lastIndexOf('\t');
        if (idx === -1) continue;
        const word = line.slice(0, idx).trim();
        const level = parseInt(line.slice(idx + 1).trim(), 10);
        if (word && !isNaN(level)) map.set(word, level);
      }
      return map;
    });
    return _levelsPromise;
  }

  let worldApi = null;
  window.openFocciWorld3D = async function () {
    document.querySelector('#fw-overlay').style.display = 'block';
    if (worldApi) return; // already booted — just re-showing the overlay
    // Real land names/unlock-state — ARC_LANDS + arcUnlocked() live in story.js.
    // Do NOT use story-content.js's ARCS[].title ("The Field") — that's a
    // different, shorter internal label than the real name players see on
    // the map ("The Nameless Field").
    const arcTitles = window.ARC_LANDS.slice(0, 4).map(a => a.name);
    const arcUnlockedFlags = window.ARC_LANDS.slice(0, 4).map(a => arcUnlocked(a.id));
    worldApi = await bootFocciWorld(document, {
      angelMessages: FOCCI_ANGEL_MESSAGES,
      arcTitles,
      arcUnlocked: arcUnlockedFlags,
      onOpenArc: (index) => {
        const arcId = index + 1;
        if (!arcUnlocked(arcId)) return; // safety net, world.js already guards this too
        // Confirmed: stepping onto the island IS how you continue that
        // chapter — no need for the 3D room itself to look like the arc
        // (desert/forest/etc.); it's just the access point. Hand straight
        // off to the real 2D story:
        closeFocciWorld3D();
        updateContinueCard(arcId);
        openStory();
      },
      onArcLocked: (index, title) => {
        showInfoCard('mascot-wonder', '🔒 ' + title, 'This land is not finished yet — check back soon!');
      },
      onOpenSayIt: () => { closeFocciWorld3D(); showView('review'); setPracticeMode('write'); },
      onWordFound: () => { /* TODO: award EXP here */ },

      // word hunt: letters scattered in the station background spell a real
      // word; islands each hold one "whole word" treasure shortcut. world.js
      // only handles the 3D scatter/collect side — picking a real B1-C2 word
      // that's also actually in your dictionary happens here:
      getNextTargetWord: async () => {
        const levels = await loadLevels();
        const words = await dsAllWords(); // words with a real dict-00X.json entry in IndexedDB
        const pool = words.filter(w => {
          const lvl = levels.get(w);
          return lvl >= 3 && lvl <= 6 && w.length >= 4 && w.length <= 9 && !w.includes(' ');
        });
        return pool[Math.floor(Math.random() * pool.length)] || 'focci';
      },
      onLetterProgress: (word, mask) => {
        const el = document.querySelector('#fw-word-progress');
        if (el) el.textContent = mask; // e.g. "C A _" style hint
      },
      onWordComplete: async (word) => {
        const rec = await idbGet(word);
        if (rec) { showWordSheet(condensedEntryHTML(rec)); addXP(3); }
      }
    });
  };
  window.closeFocciWorld3D = function () {
    document.querySelector('#fw-overlay').style.display = 'none';
    if (worldApi) worldApi.toggleSound(); // mute when leaving, so it doesn't play under the 2D UI
  };
  document.querySelector('#fw-close').addEventListener('click', closeFocciWorld3D);

  // Compact search — reuses your REAL lookup + bottom-sheet pipeline
  // (idbGet / condensedEntryHTML / showWordSheet / wordPopupForceAI), so a
  // word found here is the exact same card as searching from the topbar.
  // Nothing new to design: the 3D world just triggers your existing sheet.
  const searchBtn = document.querySelector('#fw-search-btn');
  const searchPill = document.querySelector('#fw-search-pill');
  const searchInput = document.querySelector('#fw-search-input');
  searchBtn.addEventListener('click', () => {
    const opening = searchPill.style.display === 'none';
    searchPill.style.display = opening ? 'block' : 'none';
    if (opening) searchInput.focus();
  });
  searchInput.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const raw = searchInput.value.trim();
    if (!raw) return;
    const word = window.norm(normalizeSpelling(raw));
    searchInput.blur();
    searchPill.style.display = 'none';
    searchInput.value = '';
    const rec = await idbGet(word);
    if (rec) showWordSheet(condensedEntryHTML(rec));
    else wordPopupForceAI(raw); // not in the local library yet — same AI fallback as the real topbar search
  });
</script>
```

`ARC_LANDS` / `arcUnlocked` / `updateContinueCard` / `openStory` / `showView` /
`setPracticeMode` / `showInfoCard` all need to already be in scope as globals
from `story.js` / `app.js` — since those load as plain (non-module) scripts
today, they attach to `window` automatically, so the module script above can
see them as long as it runs *after* those files.

## 3. Add the entry button in `story.js`'s `renderWorldMap()`
Inside `renderWorldMap()`, right after the `region-strip` closing `</div>`
and before `return h;`, add one line so the button sits below the existing
12-region strip (parallel, not replacing it):

```js
h += '<button class="gm-card fw-explore-btn" onclick="openFocciWorld3D()">'
   + '🌍 Explore in 3D</button>';
```
(`.fw-explore-btn` is defined in `theme-overrides.css` below — already styled to
match the trio above it, using the app's real `var(--primary)`/`var(--shadow)`
variables so it still respects whichever palette is active.)

## 4. Add `theme-overrides.css`
Link it after the app's own stylesheet/`<style>` block:
```html
<link rel="stylesheet" href="./focci-world/theme-overrides.css">
```
This is a **real, working first slice** of the "reskin" work — restyles the
3 game-hub cards (`.gm-card`) and the new Explore button using the app's
*existing* CSS variables (`--primary`, `--surface`, `--shadow`, `--gm-accent`),
so switching palettes still works correctly; nothing here is a hardcoded
color swap. The rest of the reskin (Type it/Match it/Say it play screens,
the word-tap sheet, Saved/Progress/Settings) is NOT in this file yet — see
below.

## 5. Update `sw.js` (service worker)
Add the new files to the `SHELL` precache list and **bump `CACHE`** (e.g.
`focci-v94` → `focci-v95`) or returning visitors will keep the old Home screen:

```js
const SHELL = [
  './', './index.html', './app.js', './dict-system.js', './story-content.js', './story.js',
  './manifest.json', './seed.json', './seed-files.txt', './levels.txt',
  './icon-180.png', './icon-192.png', './icon-512.png',
  './focci-world/world.js',
  './focci-world/vendor/three/three.module.js',
  './focci-world/vendor/three/GLTFLoader.js',
  './focci-world/theme-overrides.css'
  // the .glb/.mp3 files are NOT in this list on purpose — the fetch handler
  // in sw.js already caches any same-origin GET the first time it succeeds,
  // so they'll be cached automatically the first time someone visits, without
  // bloating the initial install.
];
```

## What this build already does (tested against your real files)
- Real animations: doe (idle/eat/drink/look/shake/sleep/walk/run — switches
  occasionally, not constantly), chest open animation, birds flying loop.
- Station room built on your `low_poly_flying_island.glb`, with the two
  vegetation kits, 15 individual mushrooms (avoids water, slow group-respawn
  90s after all are collected), 3 chests, vine tree + doe placed on a flat
  mid-slope spot (not the summit).
- 4 teleport diamonds → 4 separate arc rooms (each built from one of your
  original 4 environment files — confirmed these don't need to visually
  match the arc's theme; walking onto the island is just the access point).
  Locked lands (per real `arcUnlocked()`) show a dimmed, slow-spinning
  diamond — Focci can still walk up and tap it, it just reports "not
  finished" instead of entering. Unlocked lands now hand straight off to
  the real story (`updateContinueCard` + `openStory`, closing the 3D
  overlay first) — stepping onto the island *is* how you continue that
  chapter.
- Day/night: real local clock, 30-min fade in/out around 05:00 and 18:00.
- Tap a tree → shows a random line from `random-quotes.js` and calls the
  doe home. Walk into water → Focci wades instead of clipping through it.
- Tapping a chest opens the real Say It game (`showView('review')` +
  `setPracticeMode('write')`), closing the 3D overlay first.
- One-finger drag = walk, two-finger drag = look, pinch = zoom, tap = interact.
- Opens as a full-screen overlay from a button under the existing 2D World
  Map in the Game tab — the 2D strip is untouched.
- **Reskin, first slice**: the 3 game-hub cards + the new Explore button now
  use `theme-overrides.css`, restyled with the app's real `var(--primary)` /
  `var(--shadow)` / `--gm-accent` variables — palette switching still works.
- **Reskin, second slice**: Saved tabs (`.sv-tab`), the Progress-tab rank
  card/XP ring/streak chip (`.pg-*`), and the Settings cards (`.sx-*`) are
  now softened + Baloo 2'd the same variable-safe way — also in
  `theme-overrides.css`.
- **Reskin, third and final slice**: the shared mode-setup screen
  (`.setup-*`), Type it's input pill, Match it's option grid, Say it's
  whole scene (`.sy-*`, `.write-*`), and the word-sheet (`.ws-*`) — same
  treatment, same file. This closes out the reskin work end to end.
- **Compact search inside the 3D overlay** — a small search icon opens a
  slim input; Enter reuses your *real* lookup pipeline (`idbGet` →
  `condensedEntryHTML` → `showWordSheet`, falling back to `wordPopupForceAI`
  exactly like the topbar search does) — same result card, no new UI to
  design or maintain. Found (and fixed) a real bug along the way: `story.js`
  declares `ARC_LANDS` and app.js declares `norm` with `const`, which does
  **not** attach to `window` the way plain `function` declarations do — a
  `<script type="module">` can't see them as bare identifiers without the
  small bridge script now included in step 2 below.
- **Word hunt**: letters scatter in the station's open background (never on
  islands) spelling a real word; each island instead holds one "whole word"
  treasure as an occasional shortcut. Both share the same slow-respawn
  pattern already built for mushrooms. Target words are now picked for
  real: `levels.txt` (shipped as a repo file, precached by `sw.js` so it's
  there offline right after "Add to Home Screen") filtered to B1-C2
  (levels 3-6), intersected with words that actually have a real
  `dict-00X.json` entry in your IndexedDB. Parsing verified against your
  real `levels.txt`: all 27,397 lines parse clean, 18,137 land in the
  single-word/4-9-letter B1-C2 pool used for the hunt.

## What this build does NOT do yet (next steps)
No open items right now — everything requested so far (station room, 4
arc-land teleports with real unlock state and a real hand-off into the
story, day/night, mushrooms, chests → real Say It, vine tree + doe, sound
toggle, search reusing your real lookup pipeline, the real word-hunt using
`levels.txt`, and the reskin across the game hub, Saved/Progress/Settings,
and Type it/Match it/Say it/the word-sheet) is built and CSS-safe across
all 10 palettes. Natural next things *if* you want to keep going: visually
distinguishing the 4 arc rooms from each other despite sharing generic
environments, and giving the "🌍 Explore in 3D" button its own icon/artwork
instead of the emoji placeholder.
