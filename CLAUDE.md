# Focci's Little Tales — working notes

Read this before touching anything. Most of what follows was learned the
expensive way, and several items will silently waste an hour each if you
rediscover them yourself.

Line numbers here were correct at `30827ae` and drift with every edit —
grep for the quoted code instead of trusting them.

---

## What this is

A Vietnamese → English vocabulary PWA, built by one person as a hobby
project. Two halves that share one codebase:

- **A 2D app** — dictionary lookup (offline-first, IndexedDB), a story
  mode, mini games (Word Pairs, Letter Trail, Speak Up, Hot Take), a
  Saved area, a journal.
- **A 3D island** — Three.js. You walk a fox called Focci around, find
  letters, rescue animals, sail a boat, teleport between four "lands".

No build step. No framework. No package.json. Plain `<script>` tags and
one ES module. Everything ships as-is.

## Who you're working for

Non-technical hobby developer. Vietnamese speaker — **reply in
Vietnamese**, and write commit messages in English. They describe
problems by what they see ("the box is ugly", "it shows the old page"),
not by cause, so the first job on any report is almost always to find
the actual mechanism rather than to patch the symptom.

They push straight to `main` on `minhle22666-coder/dict` and have
standing authorisation for that. Commit and push as you go.

They notice when you claim something is done and it isn't. Don't call a
pass an "overhaul" unless you've checked every surface it touches — see
the Saved page story below.

## Running it

```bash
python -m http.server 8080
```

`.claude/launch.json` already defines this as `static-server`. It must be
served over HTTP — `file://` breaks GLTFLoader.

---

## THE CACHING PROBLEM — read this first

This has cost more time than every other issue combined, and it will
happen to you.

There are **three** independent cache layers between a file on disk and
the code running in the browser:

1. **Service worker** (`sw.js`) — was cache-first for everything.
2. **The browser's HTTP disk cache** — survives tab close, survives
   clearing Cache Storage, survives unregistering the service worker.
   There is no JS API to purge it.
3. **The page's already-loaded copy** — nothing reloads until you navigate.

**Symptoms you will misread as bugs:** a fix that "doesn't work", a page
that "still shows the old version", computed CSS values that don't match
the file you just edited, a function whose `.toString()` is the old body.

**What's already been done about it:** `sw.js` is now network-first for
`.html`/`.js`/`.css` (cache-first for images/models/fonts, which are big
and renamed rather than edited), and it requests code with
`cache: 'no-cache'` so the HTTP layer can't answer behind its back. That
fixes it for real users.

**It does NOT fix your dev loop.** When verifying your own work:

```js
// ALWAYS confirm what's actually running before trusting a measurement
performance.getEntriesByType('resource')
  .filter(r => /app\.js/.test(r.name))
  .map(r => r.deliveryType)          // "cache" means you're testing stale code
```

Reliable workarounds, in order of preference:

- Bump `CACHE` in `sw.js` every single change (currently `focci-v191`).
  Do this even for a one-line CSS edit. The user relies on it.
- Fetch fresh and re-install just the functions you're testing:
  ```js
  const src = await (await fetch('/app.js?b='+Date.now(), {cache:'no-store'})).text();
  // extract a function by brace-matching, then:
  (0,eval)('fnName = ' + body.replace(/^function \w+/, 'function'));
  ```
  Top-level `function` declarations are writable globals, so this works.
  Top-level `let`/`const` are **not** on `window` but **are** reachable
  from `eval` in the console.
- For CSS, fetch `index.html` fresh, extract every `<style>` block, and
  append them — later rules win on source order.
- Restarting the python server sometimes helps. Closing the tab does not.

---

## Other things that will bite you

**Heredocs mangle backslashes.** `bash -c 'python - <<EOF'` with `\n`,
`\t`, `→` in the payload will corrupt them. This has produced a
literal newline inside a JS string literal (syntax error, whole app
dead) more than once. **Write patch scripts with the Write tool, then
run them.** Don't inline Python in a heredoc if it contains escapes.

**`\u` escapes are literal text in these source files.** `app.js`
contains `'→'` as six characters in some places and a real `→`
glyph in others, inconsistently. When pattern-matching for a patch,
check which one you're looking at (`sed -n 'NNNp' file`) — a mismatch
just fails the assertion, but assuming wrong wastes a cycle.

**`body .view.fw-panel *` sets `Exo 2` on every descendant of every
panel** (index.html ~line 5202). Any font rule scoped less specifically
than that silently loses. If you set a font and it doesn't change, this
is why. You need `body .view.fw-panel#your-id *` to beat it.

**`.fw-panel`'s backdrop is still purple** —
`rgba(36,16,72,.58)` at index.html ~line 5148. This is the last of an
old theme and it shows through every translucent card in every panel
that doesn't override it. The user has complained about purple
repeatedly; **this single line is the cause** for the mini games and
anything else still wearing it. Saved and Speak Up override it locally.
Changing it at the root is the outstanding high-leverage fix.

**There are two parallel CSS token systems.** An older cream/brown set
(`--bg:#F8F3E6`, `--surface:#F3ECDD`) and a newer `--tint`-based
light/dark theme set. Both declare `:root`. Which one wins depends on
source order and on which scope you're in. **Never reason about a
variable's value from the source — read it off a live element** with
`getComputedStyle(el).getPropertyValue('--x')`.

Related trap: the `-bg` companion tokens (`--coral-bg`, `--amber-bg`,
etc.) are hardcoded literal rgba per theme, **not** derived from their
solid colour. Override `--coral` and `--coral-bg` will not follow. Only
`--primary-bg` uses `color-mix(var(--primary) …)`.

**`cache.addAll()` is atomic — one 404 kills the whole install.** `sw.js`
precached four `./focci-world/...` paths left over from when the world
lived in a subfolder, plus a `logo-guardian.png` that was not there. All
of them 404'd, so the install rejected **every time**, and the app had no
offline mode at all: verified on the live page, the cache existed and held
exactly **0 entries**, with no service worker ever active. Every open
re-downloaded everything. It installs one file at a time now, each failure
swallowed and logged, so a missing illustration costs that illustration
and nothing else. If you add to `SHELL`, check the path exists — the flat
layout rule below is exactly what got this wrong.

**Flat layout — never prefix a path with a subfolder.** `index.html` sits
at the *same* level as `world.js`, `vendor/`, `assets/`. Always `./thing`,
never `./focci-world/thing`. A wrong prefix on an ES module import 404s,
and a failed module import kills the **entire** `<script type="module">`
block silently — no partial execution, no error you'll notice. This broke
the 3D world completely once.

**`story.js` and `dict-system.js` are each wrapped in a file-spanning
IIFE.** Nothing inside them reaches `window` on its own — not `const`,
not `let`, not even a plain `function` declaration, because the IIFE is
the top level as far as scoping goes. **`app.js` is the exception**: it
is *not* wrapped, so a top-level `function` there does become a global
(this is why the `eval` trick in the caching section works on app.js).

If you need something out of story.js or dict-system.js, add
`window.X = X;` **inside that file's own IIFE**, next to the existing
exports at the bottom — not in an external bridge script, where the
identifier was never in scope. Getting this wrong throws a
`ReferenceError` that kills the rest of that `<script>` block, which is
how `openFocciWorld3D()` once silently stopped booting the world at all.
Currently exported from story.js: `ARC_LANDS`, `arcUnlocked`,
`showWordSheet`, `condensedEntryHTML`, `assetUrl`. From dict-system.js:
`dsSync`, `dsScreen`, `dsExport`, `dsImport`, `dsCount`, `dsState`,
`dsAllWords`.

**Skinned meshes: `.clone(true)` does not rebind the skeleton.** Animals
come out as pale blobs. `world.js` has a hand-written `cloneSkinned()`
because only `three.module.js` and `GLTFLoader.js` are vendored — no
SkeletonUtils.

**After setting a mesh's `scale`/`position`/`rotation`, call
`object.updateMatrixWorld(true)` again** before you raycast against it or
read a `Box3` from it. Stale world matrices were the real cause of props
appearing to float away from the ground; it looked like a placement bug
for a long time.

**Don't trust `hits[0]` or `hits[last]` from a downward raycast on this
island.** It is a lumpy sculpted rock: a ray can slip through a gap and
land on the underside of an overhang. `surfaceYIn` and `isStableGround`
exist because of this — use them rather than a bare raycast.

**Three.js is r149, minified** (593KB, minified from the dev build with
esbuild). `GLTFLoader.js` likewise. There is no DRACOLoader, which is why
the GLB models use quantization rather than Draco compression.

**Models are quantized.** `assets/glb/*.glb` went through
`gltf-transform prune --keep-attributes false` → `dedup` → `quantize`.
22MB → 13MB. This is safe and verified (identical topology, worst vertex
drift 0.0027 units on a 55-unit island; the collision grid steps 0.6).
**If you regenerate or replace a model, run it through the same pipeline
or the island gets heavy again.** Don't use `gltf-transform optimize` —
it includes `simplify`, which changes geometry, and the island's
triangles are what the collision height field is rasterised from.

**The world's collision is a height field, not raycasts.** `world.js`
rasterises the island into a 0.6-unit grid at boot (`buildHeightField`)
and everything that moves reads `groundSmooth()`. A raycast costs 2.5ms;
the grid costs about a thousandth of that. `surfaceYIn` (the real
raycast) is kept only for the sky island (above `GROUND_CEIL`) and for
cliff cells where blending would float Focci in the air. Don't casually
add a per-frame raycast.

**Changing the number of visible lights recompiles every shader.** This
is the one that made the app close itself on iPhone, and it is worth
understanding before you touch lighting again.

three.js bakes the light *count* into every program it builds, so a
different count is a different program for every material in the scene.
Measured by driving the count by hand and timing `renderer.render()`:

| visible point lights | frame | programs |
|---|---|---|
| 0 | 265 ms | 12 |
| 2 | 320 ms | 17 |
| 5 | 414 ms | 22 |
| 8 | 477 ms | 27 |
| 3 | 345 ms | 32 |
| any count seen before | 0.6 ms | 32 |

A quarter to half a second of blocked main thread **per count the player
had not produced yet**, on a desktop. A phone compiles several times
slower, so those are multi-second freezes, and iOS kills a WebKit process
that stops responding — the "trắng trang rồi tự thoát" report.

The old `tickLightCull()` caused this: it hid lights that could not reach
the screen, which is a count change every 0.12s. `spawnPickupBurst` made
it worse by adding a light and removing it again, which is why *picking
something up* was the most reliable way to crash.

It is now `tickLightPool()`. The scene holds exactly `LIGHT_BUDGET` (5)
point lights, added once, **never hidden, never removed**. Every other
point light is a source: invisible from birth, never rendered, read only
for its position/colour/intensity/falloff, which the pool copies onto its
own lights each frame. One program set for the whole session.

**If you add a point light anywhere, use `sourceLight()`, not
`new THREE.PointLight`.** Born visible and hidden by the next scan is not
good enough — every frame drawn in that 0.12s gap counts it. Measured:
twelve burst lights created visible still cost 10 new programs; created
invisible, 0.

Scoring is from `character.position`, not the camera, and skips lights
whose room is hidden (`inLiveRoom()`) — every room Group is parked at the
same origin and switched with `.visible`, so an arc land's diamond sits a
few units from where Focci stands in the station.

**Never size a skinned model off `Box3.setFromObject`.** Since
quantization the geometry's own positions sit in a -1..1 cube and the
real size lives in the bones, so four of the five animals reported a box
of exactly 2 whatever they were (the rabbit came out a fifth of its size,
the cat 2.5x). Use `skinnedBox()` in world.js, which runs every vertex
through `boneTransform` first.

**Roofs are reached by jumping, not walking.** Near a house a surface over
Focci's head is a ceiling (that is what lets him go indoors), so walking
never lifts him onto a roof. `roofHopTarget()` hops him onto the nearest
standable roof when he jumps under or facing one; on the roof around the
tower a jump goes to the cap. `station.skyPad` is the tower's own axis and
cap height, found from its vertices -- not from a mesh box, because after
the boot-time merge the "tallest mesh" is 38 units wide.

**The camera pulls in rather than sitting behind a roof.**
`camClearance()` samples the Focci-to-lens line against the height field
(14 grid reads, no raycast). There was no camera collision at all before.

**One back gesture for the whole app: `window.fwBack()` in index.html.**
Every panel's X is hidden (`#fw-panel-close{display:none !important}`),
so a screen the swipe does not know about is a screen you cannot leave.
If you add an overlay, add its close to `fwBack()` in stack order, topmost
first. Do not add a second touch handler that goes back -- two handlers
on one gesture closed a layer AND the one under it. The games' own
handler only ever takes swipes to the LEFT (next question).

**Nothing may animate forever under a panel.** The panels are glass
(`#v-review` blurs what is behind it at 34px), so a looping animation on
the page underneath is a full-screen blur recomputed every frame -- that
was the heat and the stutter in the games. `#fw-home` pauses whenever a
layer covers it (including `::before/::after`, which `*` does not reach).
Anything always on screen should stop after a few loops, as the search
icon's pulse now does.

**Every search field goes through `window.fwRunSearch()` (index.html).**
There were three copies of the lookup -- home, Hot Take, and the row over
everything else -- and none of them looked at commas, so "general,
generic" came back as a word card. `fwRunSearch` sends anything
`isExplainQuery()` accepts to the word page, where `search()` now checks
for a comparison FIRST (it used to be after the API-key check, so a saved
comparison was refused for want of a key). `isExplainQuery` treats a
multi-word part that opens with a subject pronoun or has "n't" as a
sentence to translate. If you add a search field, wire it to
`fwRunSearch`, not to `idbGet`.

**There is one search row design: the home page's.** `#fw-chrome`'s
`.fw-topbar` copies its geometry exactly (safe-area + 14px, 18px margins,
37px pill, 41px grid button that opens the menu); only its colours change,
by page, in the ONE SEARCH ROW block. Panels start at safe-area + 84px so
nothing sits pressed under it.

**The island runs at half rate when nobody is touching it** (`halfRateSkip`
in `animate()`), and at a pixel ratio of 1.5 on touch screens. Both are
for heat, not frame time.

---

## File map

| File | What's in it |
|---|---|
| `index.html` | 441KB. **All CSS**, all markup, and several inline scripts including the ES module that boots the world. The biggest file and the one most edits touch. |
| `app.js` | 373KB. Dictionary, search, IndexedDB, games, Saved, Gemini calls. |
| `world.js` | 186KB. The entire 3D island. ES module, `bootFocciWorld()`. |
| `story.js` | Story mode + the word "peek" sheet (`condensedEntryHTML`). |
| `story-content.js` | Story text. |
| `residents.js` | Rescued-animal species, names, breeding. |
| `hottake.js` / `hottake.json` | Newsstand reader + 90 articles. |
| `journal.js` | The learning journal + its chart. |
| `dict-system.js` | Dictionary seeding helpers. |
| `sw.js` | Service worker. **Bump `CACHE` on every change.** |
| `dict-00*.json` | ~45MB of dictionary seed shards. Not fetched at boot. |
| `assets/glb/` | 22 models, 13MB after quantization. |
| `vendor/three/` | three.js r149 + GLTFLoader, both minified. |

### Known-missing files (pre-existing, not yet chased)
`fonts/raleway-variable.woff2` and `fonts/raleway-italic-variable.woff2`
are referenced and absent — the Google Fonts `<link>` is what is actually
dressing the page. `seed-7000.json` is named in `seed-files.txt` and is
not in the repo either. All three 404 on every open.

### Things that are NOT wired to anything
`fishing-animation-preview-v2.html`, `generate.html`, `shard-tool.html`
are standalone tools/experiments. `.sy-body` CSS is dead (renamed to
`.sy-detail` long ago). Don't spend time on them.

---

## Current state

Everything below is committed and pushed to `main`.

**Recently finished:**
- Boot payload 18.2MB → under 10MB (model quantization, minified three.js,
  PNG→WebP, music and `levels.txt` off the critical path).
- 3D movement no longer raycasts per frame; point lights culled.
- House walls are solid; double-tap a hut to go inside in first person.
- Word page restored to the format the Word Pairs peek card kept, in green.
- Gemini calls all share one retry policy (`geminiPost`) — 429/5xx and
  MAX_TOKENS truncation were making lookups fail at random.
- Speak Up grading now measures **coverage** (did the answer say what the
  Vietnamese said) and caps the score by it, in code as well as in the
  prompt. A four-word fragment used to score 75/100.
- Saved rebuilt across all three tabs on one green palette.
- **The 3D world no longer white-screens and closes the app.** The cause
  was shader recompilation, not memory or triangles — see the light-count
  note above. Measured after: first frame 722ms → 112ms, worst frame while
  walking 265–477ms → 9.2ms, recompiles while picking things up 10 → 0.
- The four arc lands load when someone walks through a gateway instead of
  at boot (`ensureArcRoom()`), which is the deferral the previous session
  left as optional. 5 rooms built at boot → 1; 371 meshes → 237; 181k
  triangles → 130k. The word hunt deals letters by room **key** now, and
  `flushPendingLetters()` drops a land's letters in when it is built.
- `sw.js` actually installs now (0 cached entries → 64), so offline works.
- Removed 8 files nothing referenced: `animal-duck-baby.glb`,
  `forest-kit.glb`, `hub-island.glb`, `bush-kit.glb`, `chest.glb`, and the
  `fishing-animation-preview-v2.html` / `generate.html` / `shard-tool.html`
  tools. `git log` has them if one is ever wanted back.
- Zen Island is reachable again (jump onto a roof, jump onto the tower
  cap); the violet halo sits on the tower's axis; animals are their own
  size; the boat is solid and coming home shows Focci and whoever he
  brought; a mushroom is 1 XP; first person is fov 62.
- Swipe right is back on every screen (13 checked with real TouchEvents).
- Saved redrawn as grouped lists in one CSS block at the end of the
  stylesheet: rows 100px -> 59px, 4 -> 9 words to a phone screen. The
  Casebook's opened entries were near-white on mint (old purple theme)
  and are readable now. The menu drawer no longer throws a grey shadow
  down the right edge of every screen.

**In flight — I stopped mid-task here:**

1. **Mini games (Word Pairs, Letter Trail) still need the design pass.**
   - The purple is `.fw-panel`'s backdrop, index.html ~5148. Changing it
     to green fixes games and every other un-overridden panel at once.
   - Fonts need the `body .view.fw-panel#id *` treatment described above.
   - The setup controls at the top of a game are cramped and unstyled.
   - ~~Remove `← Games` and the round's `✕`.~~ **Done.** A right swipe is
     back (home, or Saved for a review started there); a round that has
     been played into asks for a second swipe first. `practiceStage` is
     'playing' the moment a rebuilt game opens -- the setup and the
     question are one screen -- so use `practiceHasProgress()`, not it.

2. ~~Back in the games lands on the OLD game page.~~ **Done.** The `←
   Games` button called `renderGameHub()`, the old hub, and so did
   `showView('review')` with no game named. Neither can reach it now.

3. **The journal page needs the same treatment as Saved** — the user says
   it's visually heavy and they don't want to read it. Simple, refined,
   easy to scan.

4. ~~Defer the four arc-room environments.~~ **Done** — see
   `ensureArcRoom()`. `waterfall.glb` is still here and still one of the
   four lands, not decoration; do not delete it.

---

## How to work on this

**Measure, don't eyeball.** Screenshots of the 3D scene have been wrong
every time they were trusted. Read computed styles, read
`renderer.info`, time things with `performance.now()`. When you claim a
number in a commit message, have actually measured it.

**Verify against the live page, and verify you're testing fresh code**
(see the caching section). A "fix that didn't work" is stale code often
enough that it should be your first hypothesis.

**Find the mechanism.** Every genuinely good fix in this repo's history
came from finding why, not from patching what. Examples worth imitating:
the Speak Up score was measuring naturalness and nothing was comparing
against the Vietnamese; the AI lookups failed at random because only the
background call retried; the word page looked flat because each of five
past complaints removed one more border.

**Don't nuke broadly to satisfy a narrow complaint.** The user once sent
a checklist saying "remove every box-shadow, force `--line` transparent,
`display:none` all pseudo-elements". Applying that literally would have
stripped deliberate design elements across the whole app. A scan showed
there were no unintended hairlines left at all. Say so, with evidence,
rather than complying.

**"Redesign the layout" means restructure the composition, not recolour
it.** This has been said more than once and recolouring has been
rejected more than once. Change what sits where, the hierarchy, the
grouping — not just the palette. And when the user supplies a reference
image, *measure* it (sizes, spacing, weights) rather than paraphrasing
the vibe.

**A panel-wide theme override bleeds into every sub-screen inside it.**
Scope to an id (`#v-saved`) and check the other tabs/screens under the
same parent before declaring done. This is exactly how the Saved "fix"
shipped broken: one tab restyled, two left with dark-background card
styles on a newly light page.

**The Browser pane is usually hidden, and a hidden page gets no
`requestAnimationFrame` at all** -- the island's loop simply stops, so
every position you read is frozen. To drive the world from the console:
set `window.__fwAwake = true`, replace `requestAnimationFrame` with a
`setTimeout(cb, 16)` shim, and take one screenshot to let the pending
native frame fire. To steer Focci with synthetic `PointerEvent`s, stub
`canvas.setPointerCapture` first -- it throws for a pointer the browser
never saw, and that exception aborts the handler before it records the
touch. The roof climb, the boat, and the tower were all tested this way.

**Browser-pane screenshots only capture roughly the left 80% of the
emulated viewport** and the pane sometimes fails to reflow after
`resize_window` — content renders in a narrow column with dark space
beside it. That's a tool artifact, not a CSS bug. Reload after resizing,
and prefer reading computed values over judging layout from the image.

**To test AI-dependent UI without burning quota**, stub `window.fetch`
for `generativelanguage` URLs and return a canned response. The Speak Up
coverage-cap fix was verified entirely this way — `localStorage` key for
the API key is `sd_key`.

**Comments in this codebase explain WHY, including what was tried and
failed.** Match that. They have repeatedly saved re-debugging the same
thing. Keep them.

**Commit messages** are prose, in English, explaining the mechanism and
what was measured. Look at `git log` for the register.

**Attribution:** end commit messages with the `Co-Authored-By` line the
harness reminder specifies (the model name changes between sessions).
