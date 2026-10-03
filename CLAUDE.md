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

- Bump `CACHE` in `sw.js` every single change (currently `focci-v248`).
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

**Focci can never be trapped by a wall.** A scan (`.claude/trapscan.js`,
dev-only: set him down at ~2,500 points around every house, let the frame
settle his feet, try eight directions) found no walk-in pocket but dozens
of points INSIDE a wall cell for the feet height he settles at -- reached
by eave ground drops, hops, jumps off roofs. Inside a wall every step is
into a wall: "stuck at the house". The step code now ignores walls when
the spot he stands on is itself blocked, or when no direction is open; and
on a roof, pushing against the edge for half a second hops him down.

**A wall under a roof does not block someone on that roof.**
`blockedAt()` skips a wall cell when Focci's feet are near its top and the
roof around it reaches as high -- without that, standing on an eave over
a wall line counted as standing in a wall and every step off the roof was
refused (0 of 8 directions off hut 1; 7 of 8 after). From the floor the
walls are as solid as before.

**Placement uses `reachMask()`, not a straight line from spawn.** The old
test also capped the climb from spawn at 8 units on an island 6-30 high,
so every mushroom grew in one quarter. Mushrooms scatter out to radius 23
(the land's 95th percentile) 3 apart; animals out to 21, 3 apart, and
`findFlatGroundSpot` takes the first "flat enough" spot, not the flattest
-- the flattest ground is always the same meadow.

**During a voyage the camera follows the boat from the sea side**
(`voyageCamOn`, `camFocus`). On the land side of the dock every angle
tried was inside the village: rays from the camera to the boat were
blocked at every point of both legs.

**Music plays only while the island is on screen** (`syncMusic()`, run
from `animate()` and on visibilitychange). A swipe from the left edge on
the island is back to home; a drag anywhere else is still walking.

**Journal entries for comparisons are stored without the `why:` key
prefix.** With it, tapping one ran a nonsense comparison through the AI.
`search()` and `explainWordsOf()` strip a stray `why:` as well.

**Letter Trail and Word Pairs are daylight pages** (`#v-review.pg-day`,
set in `setPracticeMode` for everything but Speak Up), and so is Hot Take
-- see the DAYLIGHT block at the end of the stylesheet. Hot Take's source
filters are text chips now; the old logo tiles never lit up because
`chips()` looks for `.ht-chip` and they did not carry it.

**Never call `idbAll()` from anything interactive.** The library is 16k
records and 41MB; one read is 800ms. A game's dial read it three times
per turn, and five drags took the heap from 228MB to 557MB -- the white
screen. Use `idbAllCached()`: it shares the read in flight (without that,
ten drags during the first read were seventeen reads), and `idbPut` keeps
it current via `cacheUpsert()`.

**Under a roof near a house, the ground is `groundUnderRoof()`**, not the
house's floor height: under the eaves by each door the real ground is up
to 3 above the floor, and Focci sank into it. It keeps two readings per
cell (down from under the roof, and from the floor band) and takes the
one nearest his feet, so a two-storey house never lifts him upstairs.

**Hut furniture stands where the room actually is.** `buildHutInterior`
finds the cell furthest from any wall and scales the layout to the
largest size at which the bed and table clear every wall (the bed went
through the wall in 3 of 4 huts before). The lamp's on/off is `h.lampOn`;
the per-frame easing used to undo every tap.

**Vietnamese and multi-word searches go to the word page**, never to
`wordPopupForceAI` -- that asks the AI for an English headword, so
Vietnamese came back "not an English word" and cost a second call.

**One menu per screen:** on the island its own round menu and a
full-width search; over any panel the grid button, and the island menu
hidden (ONE MENU PER SCREEN block). In first person a pinch is field of
view (38-80), not camera distance.

A dev-only harness for driving the island lives at
`.claude/dev-harness.js` (excluded from git in `.git/info/exclude`):
`(0,eval)(await (await fetch('/.claude/dev-harness.js',{cache:'no-store'})).text())`.
The pane's localStorage is wiped whenever the preview server restarts.

**The look is COZY GLASS** (Sept 2026): cream and sage from the user's
reference picture, one `<style id="cozy-glass">` block placed AFTER
`theme-overrides.css` so it wins on order. The classic look is tag
`classic-v193` (and branch `classic`) -- `git revert` the cozy commits or
reset to the tag to go back. Rules of that block:
- Raleway everywhere via `:where(html body *){font-family:... !important}`
  (zero specificity), and light Helvetica (300) for every figure: `.num`,
  every older Helvetica rule restated with `!important`, and a list of
  counters/dates that had no class. **Put `.num` on any new figure.**
- The panel tokens (`--primary`, `--surface`, `--text`...) are set once for
  `.view.fw-panel` and the word page; the purple root set is overridden,
  not deleted. All four games are daylight now (`setPracticeMode` always
  adds `.pg-day`; `.su-active` still marks Speak Up's own layout).
- Glass is near-opaque white + a bright rim + a soft lift. No
  `backdrop-filter` over anything that moves.

**Home is a still, not WebGL.** `home-island.webp` (47KB) was rendered
from the real scene with an orthographic camera and graded to cream;
`home-focci.webp` is Focci from the same angle. If the island changes a
lot, re-render them rather than faking it. Home = four see-through rows
(Enter the island / Saved / Progress / Mini games; the pressed or hovered
one is the only white one), Focci standing in the scene, and one slim
Journal line at the foot. Mini games is home's second page
(`czPage('games')`, `#fw-home.cz-on-games`) with the mascots; `fwBack()`
returns from it to the rows. `fhEnterIsland()` shows `#fw-overlay` under
the still first, makes Focci hop, fades home at 400ms and calls
`fhShowWorld()` at 800ms; the overlay is only shown at 400ms, once he is
in the air, so the island's first frames cannot hold up the jump. If the world
is still loading he bounces in place (`html.world-loading`) and goes in by
himself when `worldReady`.

**The game banners are `gameHead(mode)` in app.js** (`PG_META`, including
Speak Up's `write`; Hot Take has the same `.gh` markup in index.html): the
user's art as the ground (`banner-*.webp`, flattened onto deep green and
cropped past the art's translucent edge -- that edge was the "white rim"),
name and welcome on the left over a shade, the mascot seated INSIDE the
128px frame. Games share `.pg-opts` pickers, the `.pq` card and `.rd`.

**The animals have minds: `pets.js`.** Each resident gets a voice and a
mastery (`persona`, assigned on first meeting, masteries unique while any
are free). A tap on an animal opens its bubble (`petTap`) -- it no longer
feeds on contact. Feed/pet/talk add to `bond` (capped per day); at
`GIFT_AT` thresholds a happy animal gives a gift (Gemini JSON: five
expressions from its mastery), kept in `fc_gifts`, shown in Saved > Gifts
and the Journal. One meal is one of ten bars (FEED_ENERGY 10), drawn on the
animal's nameplate sprite in world.js (`nameplateTexture`); `residentFx`
draws hearts/bursts. `petBack()` is first in `fwBack()`.

**Every number the games award lives in `XP-RULES.md`** (and in the app,
Progress > How XP works, `openXpRules` in pets.js). Change both together.

**Animals are life experts now, not grammar topics** (`MASTERIES` in
pets.js, 24 of them: healer, love, tarot, survival, office...). Old
records with a grammar mastery are reassigned by `ensurePersonas`. The
chat prompt asks for a friend's voice, short enough for a bubble.

**Talking happens in the world, not a sheet.** `petTalk` calls
`fwWorld.talkStart(id)` (world.js): Focci hops to 1.9 units, both face
each other, the camera goes side-on (with clearance kept -- camFocus used
to switch it off, and a hill filled the screen). pets.js places
`#pt-bme`/`#pt-bpet` over the two heads every frame from `talkAnchors()`.
Walking more than 6.5 away ends it (`focci-talk-end`). Replies come in up
to three parts split on `||`, paged in the bubble (`petPage`); a message
sent while an answer is pending is queued, not dropped (that was "stuck
after a suggestion"); 2.5 models get `thinkingBudget: 0` and a 25s cap.
Nameplates have depthTest on and fade out past 12 units. `window.fwWorld` is
the world API, set when the island is ready.

**Gifts come back from a long sleep** (pets.js): bond at the mark +
happiness 50+ + a 3-hour sleep sets `giftWaiting` on waking, one a day per
animal. Tapping care alone only fills the bond -- the user found gifts on
demand worthless.

**Sleep, bath, follow** (world.js `residentSleep/Bath/Follow`): a sleeping
animal walks to the nearest house door and is hidden until its record's
`sleepUntil` (3 h); pets.js `settleSleep` grants +50 energy on waking. Animals
with `b.busy`/`b.follow`/`b.talking` do not wander. The paragraph hunt
(`petPlay`) deals one paragraph per awake animal; gathered animals follow
Focci.

**Hints by proximity** (`tickHints` in world.js): near a house, an animal,
a gateway, a mushroom or a letter, with a cooldown per kind -- the
once-a-session `hintNear` remains for the tutorial lines.

**Music pauses while the clip player is open** (`syncMusic` checks
`html.ygm-on`).

**The small YouGlish player is `ygmPlay(phrases)` in pets.js.** YG.Widget
with `components: 2` puts the video at the top of its page, which is
cropped to it. The widget never fires `onCaptionConsumed` for the clip's
own caption (measured), so a clip is done when the NEXT caption starts
(`clipDone`); clips run 4-7s. Two clips a phrase, then the next phrase;
back only on the back button. `window.__ygm` is its state, for debugging.

**The daily nudge is `petNudge()` in pets.js**: at most twice a day, only
short of the goal, from a hungry animal if there is one. The 8pm system
notification can only fire while the app is alive (no push server).
Progress leads with today's ring, the four daily quests (`QUESTS`, now
with "look after an animal" from `petCareToday`), then title, level and
this week against last. `renderQuests` draws into `#pj-qlist` as well as
the hidden old dashboard's `#q-list` -- the same id twice drew nothing.

**Forgetting a looked-up word is `forgetSearch(w)`** (app.js): history,
behaviour log and every day of the journal (`jnForget` in journal.js).
The x in the search box's Recent list, the Casebook and the journal all
call it.

**Progress is a journey, not a trophy case.** The twelve cups are gone;
`JOURNEY` in app.js is a path of habit milestones (3/7/14/30 days in a
row, three days each busier than the one before, 100 lookups, 30 answers
at 80%+, 20 active days in four weeks), each earning a title the page
leads with. Streak milestones are judged on the best run ever (`bestStreak`,
`bestRise` from `computeInsights`) and stored in `sd_journey`, so a title
stays earned; the bar on the next one shows the current run.
`checkAchievements()` keeps its name (many callers) and now celebrates new
titles. `computeInsights` reads `idbAllCached()` -- it runs after every save.

**The island runs at half rate when nobody is touching it** (`halfRateSkip`
in `animate()`), and at a pixel ratio of 1.5 on touch screens. Both are
for heat, not frame time.

---

**Name new CSS classes with a fresh prefix and grep first.** Three times in
one round a new class collided with an old global rule: `.empty` (padding
34px, from the dictionary) made hexagram rows 68px tall, `.mp-card` (the
mascot picker) put a dark card behind the map, and the Relax button
`.fa-relax` was `display:none` because the relax overlay used the same
name. The symptom is always "my CSS is right but the box is wrong" --
read the computed padding/display before anything else.

**The Write tool turns `\u00b7` into a real `·`.** A file written with
Write has glyphs, not escapes, so a later patch that searches for the
escape fails its assertion. Match both (decode `\uXXXX` and retry).

**`raycaster.camera` must be set before raycasting a group with sprites**
(the nameplates): `Sprite.raycast` reads `raycaster.camera.matrixWorld` and
throws on null. It only worked before because a tap had set it.

**A `const` used by something that runs at boot must be declared before
that point in the file.** `layDown()` runs from `buildResident()` for an
animal already asleep; its spot table as a file-level const further down
killed the whole boot (TDZ). Keep such tables inside the function.

**Camera bearings for close shots: `pickCamAngle()`** (world.js) casts five
rays per candidate -- to the lens and four points round it, half a unit
past -- once, when the shot starts. The height field has no trees or
fences, and one centre ray came back clear while a crown filled the frame.
The follow camera has the same blind spot: `camClearance()` also tests its
14 line samples against each tree crown kept by `treeIndex()` (a cylinder:
lowest leaf to top, 95% of the widest leaf). Without it the spawn view was
three crowns.

**Shaders are warmed a material at a time: `warmShaders()`** (world.js),
1.5s after any `enterRoom()`. three.js compiles a program the first time a
material is DRAWN, so the island behind the camera at boot compiled when
the camera turned to it (5 programs in one look round = the walking
stutter). `renderer.compile(scene)` does it all but in one 565ms block.
The trick: `Object.create(scene)` with its own `traverse()` visiting one
object keeps the scene's lights/fog, so the program matches the real frame.
r149's `compile()` uses `traverse`, not `traverseVisible` -- hiding things
does not narrow it. Dev timing tools: `.claude/perf.js`, `gpu.js` (WebGL
timer query), `bench.js` (one frozen view), all excluded from git. Measured
steady frame: ~1.4ms script, ~2.3ms GPU; shadows are not the cost.

**Round buttons are `ringPress(root, onAct)`** (pets.js, also used by
focci-acts.js): the act fires on pointerup over the same button, and the
ring stops following its animal while a finger is down (`RG.press`) --
a button moving under the finger was "Bath does nothing". Icons are the
user's PNGs in `assets/icons/`.

**Keyboard: `visualViewport` sets `--kb`, `--vvh`, `--vvt` and
`html.kb-on`** (inline script before pets.js). Inputs that must stay above
the keyboard read those, not `100vh`. Not yet tested on a real iPhone.

**Hold-and-sweep lookup works in any `.lookable` block** (story.js
`selHostOf`): animal chat (`fmtMsg`), the hunt's paragraphs, Hot Take lines.
Text must go through `tokenizeForTap()` to get `.wtap` spans. The offline
library comes first (a phrase also tries "a/an/the ..." -- one-letter words
are not tappable); only a miss shows "Ask Focci" (`askFocciSheetHTML`). The
word sheet is z-index 110: Hot Take (90), the journal (91) and the oracle
(92) all open it from inside.

**Story night is a world with a radio in it** (focci-acts.js `RS`,
world.js `buildRadio/storyOn/renderStory/storyOrbit/storyRadio/storyPick`).
The Little Prince's book is 7.7 long; its long side is z, the pop-up (the
purple planet with the rose) on one half, a flat page on the other, where
the user's `radio-clock.glb` stands (height found by a ray down with the
opening animation wound to its end). Two orbits: round the book, and --
after a tap on the radio -- round the radio (`forb`). The radio model is
one mesh; its controls are overlays in the model's own coordinates
(front panel x = 0.80, keys at z 0.80/0.475/0.225, knobs at
-0.12/-0.365/-0.605 on the top, y 0.318), each with an invisible hit box.
Control names are PRINTED on the radio (`drawLabels`); HTML pills over the
keys were taken for the buttons. Swipe-back is off while `fa-storying`.
LED and strip show the station's own local time (`TZ`). Lists are a
three-row paper scroll (`openList`). `fc_story_last`, `fc_fm_favs`.

**Trees drop apples** (world.js `treeIndex/treeTap/dropApple`, three taps
on a trunk); the word on the apple is from the recent searches, skipping
the two newest (focci-acts.js `focci-apple` listener). **Gifts arrive in
`present.glb`** beside the animal (`giftBoxFor`, `openGiftBox`, its own
Open clip); the card is `giftHtml` in pets.js.

**Echo Catch is the listening game** (was "Listening"); a sentence scored
under 90 goes to `fc_echo_review`, replayed from the setup's review button.

**Guitar tracks:** `SONGS` in focci-acts.js wants four files in
`assets/audio/`; only `guitar-gentle-touch.mp3` exists (the others were
never on disk). HEAD requests find the real ones; the arrows hide with one.
ONE audio element (`gAudio`) is reused for every song -- a new Audio made
outside a tap is silent on iOS. The paws are solved to sit in front of the
guitar's face (`GUITAR_ARMS` comment); notes rise from the soundhole.

**Relax sounds** are the user's files by kind with versions (`SOUNDS`,
tap again for the next), one element through a Web Audio gain (iOS ignores
element volume). Closed eyes swap the black mesh for a copy without the eye
triangles (`focciEyeSwap`). The butterfly is ticked at the END of
`applyFocciPose` -- at the top Focci has just been stood up for the frame.

**The wisdom tree** (oracle.js): Ask (with the three steps explained) ->
Toss -> "hexagram made" -> Message, a steps bar on all. The user's
`coin.glb` is tossed on its own small WebGL canvas (`coins3d`, three.js
from `fwWorld.kit()`); +z up is 正 (3). Its two faces are the same gold,
so the face is written under each coin. No shake on iOS (it is Undo
Typing there). `html.oc-on` hides the island behind it.

**The radio's own knobs are cut out of its mesh at load** (buildRadio,
z -0.19/-0.43/-0.68 from the 300 triangles) and turn; its keys are only
painted, so caps of their measured size and colour sit on them. The story
camera is ONE free orbit whose centre slides from the book to the radio as
it comes in (`storyNear()`); there is no "back to the world" button.

**Guitar arms stay within 0.6-0.75 rad**: bigger turns stretch the
shoulder weights (swollen arms, smeared colour). Bring the guitar to the
paws, not the paws to the guitar.
His arms cannot reach in front of anything held before his belly (belly
front z 0.248, arms 0.29 from z 0.065), so the paws are drawn a second time
over the guitar: `pawLayerOn()` -- a copy of the paw triangles sharing his
skeleton, depthTest off, renderOrder 30.

**Heat on phones** (no leak was found; it is GPU fill): pixel ratio 1.25,
shadows every other frame, 20fps after 5s idle, `heatGuard` drops to 1.0
after 4s of slow frames, and no backdrop-filter over the island.

**YouGlish on the word page is the full widget** (`ygOpen`, autoStart, a
420px roll), opened by the tap, stopped on leaving or backgrounding.

**Sleep timer** (home menu and island menu): `fcSleepOpen` in focci-acts.js, `fc_sleep_at`,
`html.fc-asleep` parks the island and its music; `window.close()` then a
Goodnight screen where the browser refuses.

**`node --check world.js` does not parse it as a module and missed a
syntax error.** Copy it to a `.mjs` first: `cp world.js $TEMP/w.mjs &&
node --check $TEMP/w.mjs`.

**Dead CSS sweep:** 579 rules went in Oct 2026 (index.html 664KB -> 597KB).
A class counts as live if any script or markup names it, OR any string
fragment ending at `+`/`${` is a prefix of it (`'pos-'+c`). Re-run the
same idea before deleting more; never trust a plain grep for the full name.

**Cloud save is `cloud.js` + Supabase** (`cloud-config.js` holds the URL
and the anon key -- public by design, RLS guards the `user_state` table,
`supabase/setup.sql`). Email + password with "Confirm email" OFF: Supabase's
free mailer answered 500 for every address. After sign-in both copies are
merged value by value (`mergeJ`), so work done before signing in is never
lost. The library is vendored (`vendor/supabase.js`), not a CDN; its
navigator.locks lock is replaced by a no-op (an iOS home-screen app frozen in
the background kept the lock and every request after hung -- "Saving..."
forever, signed out on the next open). `fc_cloud_who` remembers who is signed
in so the chip says Hello before the library loads; it is cleared only when
Supabase confirms the session is gone. iOS keeps a home-screen app's storage
apart from Safari/Chrome: each has to sign in once.

**Gemini keys are never in the repo** (it is public). They live in the
Vercel env var `GEMINI_KEYS`, one per line, used by `api/gemini.js`;
`gemini-keys.js` puts a `focci:N` sentinel in `sd_key` and reroutes the
fetch. An env var added after the last deploy is not live until a redeploy.
`sw.js` must not cache `/api/` (the key status froze).

**The leaderboard (`leaderboard.js`) is a SEPARATE Supabase table from
`user_state`, on purpose** (`supabase/leaderboard.sql`, run once in SQL
Editor like `setup.sql`). `user_state`'s row-level security only ever let
someone read their own row -- that is what makes the public anon key safe,
since a row there is the whole sync blob (searches, saved words, the
journal). A leaderboard needs every signed-in person to read every row, so
it is a table built to be public from the start, carrying only a name, XP,
a time-in-app total and a heartbeat -- nothing from the sync blob is ever
copied into it. Read policy is `auth.role() = 'authenticated'`; write is
own-row-only, same shape as `user_state`'s policies.

No Supabase Realtime: a presence socket is another persistent connection
on a phone for a feature this size. "Online" is a heartbeat instead --
every 25s while the tab is visible and someone is signed in, this device
upserts its own row with `last_seen = now()`; a row reads as online if
that is under 40s old (one missed beat still counts, two doesn't). Reuses
cloud.js's own client (`fcCloudClient()`/`fcCloudUser()`, exported for
this) rather than a second supabase-js instance, so it shares the no-op
auth lock. XP and time-in-app are already-synced localStorage keys
(`getXP()`, `sd_time_ms` plus the running `_sessionStart` -- a bare
identifier, not `window._sessionStart`: see the classic-script scoping
note above) with nothing new to track client-side.

UI: the leaderboard is a SMALL CARD (`#lb-card`, in `#fw-chrome`) dropped
from the island's XP pill, not a screen -- the user asked for exactly that
after the first version was a full `.fw-panel`. Tapping `#fw-exp` toggles it
(`lbToggle`, `html.lb-on`); a tap anywhere else or the back gesture
(`lbBack`, in `fwBack()`) closes it. The pill itself was redesigned so it
reads as pressable: the companion's face (`mascotPick()`, else the time-of-day
one -- the picture picked in "Companion"), number, level, a 6px bar, "N to Lv
X", a trophy, a press-in, and a one-shot `.gain` flash when XP rises
(`fxRefreshXP`; `.fw-exp-n/-lv/-track` keep their names because it finds them
by those). The personal XP ring is one tap deeper: "Your XP" in the card, or
the menu. Rows: rank, avatar (the `avatar` column = a `mascot-*` file name,
validated against /^mascot-[\w-]+$/ on read), name, "Lv / time / online",
XP. No backdrop-filter on the card (the island moves behind it). A green dot
on the pill's face and `#fw-online` ("<face> Name +N is here", under the pill)
appear while someone else's heartbeat is fresh; both are hidden, not empty,
otherwise. Bug found in passing, not fixed: index.html's quote bubble
builds `'./mascot-' + mascotPick() + '.webp'`, but mascotPick() already
returns the `mascot-` prefix.

## File map

| File | What's in it |
|---|---|
| `index.html` | 605KB. **All CSS**, all markup, and several inline scripts including the ES module that boots the world. The biggest file and the one most edits touch. |
| `app.js` | 441KB. Dictionary, search, IndexedDB, games, Saved, Gemini calls. |
| `world.js` | 336KB. The entire 3D island. ES module, `bootFocciWorld()`. |
| `story.js` | Story mode + the word "peek" sheet (`condensedEntryHTML`). |
| `story-content.js` | Story text. |
| `residents.js` | Rescued-animal species, names, breeding. |
| `hottake.js` / `hottake.json` | Newsstand reader + 90 articles. |
| `journal.js` | The learning journal + its chart. |
| `dict-system.js` | Dictionary seeding helpers. |
| `cloud.js` / `cloud-config.js` | Cloud sign-in and sync (its own section below). |
| `leaderboard.js` | The leaderboard and the "online now" pill (its own section below). |
| `sw.js` | Service worker. **Bump `CACHE` on every change.** |
| `oracle.js` / `hexagrams.json` | The I Ching reading (Zen Island gate/tree). 64 hexagrams: Zhouyi from zh.wikisource, Legge 1882 for 1-31 (+32 judgment) from en.wikisource, app layer in Vietnamese. ctext.org disallows AI crawlers -- do not scrape it. |
| `focci-acts.js` | Hold Focci 1.5s: guitar (Karplus-Strong synth), jog, relax (lock, breathing, ambient synth), stories (LibriVox via archive.org, Radio Browser FM, YouTube playlist). Body in world.js (`focciDo`). |
| `map-*.webp` | Map cards: stills of each island rendered from the scene (orthographic, `.claude/still.js`). Re-render if an island changes. |
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

**Round of Oct 2026 (all pushed):** Progress is a month calendar;
Letter Trail is a connect board; **Listening** replaced Word Pairs on the
games page (Tatoeba sentences with native recordings, CORS-open; the API's
own download_url is a 404, use `/v1/audios/ID/file`; AI-podcast mode with
Gemini TTS); **Word Pairs is asked by the animals** (the ring's quiz).
A tap on an animal is a camera move plus a ring of round actions and a
status card (`focusStart/focusAnchor`); animals sleep lying down inside a
house (`layDown`, rays check the floor -- one hut has a raised bench);
Focci sleeps in the bed (`focciPose`, eyelids built from the eye vertices).
The island menu is one labelled card; the map is a swipe carousel with
`travelTo('zen')`. Phases from the user's list that are done: all of
A-G. Not done / worth knowing: Legge has no 33-64 in any open source
reachable here; the guitar music is synthesised, not recorded.

**In flight — I stopped mid-task here:**

1. ~~Mini games design pass.~~ **Done** for Letter Trail and Word Pairs
   (daylight, Raleway/Helvetica, the settings as one ruled card, an intro
   line on each banner). `.fw-panel`'s purple backdrop is still the root
   default for any panel that does not override it -- Progress and
   Settings still show it.
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
