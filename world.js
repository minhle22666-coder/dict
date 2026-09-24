/* Focci's World — real engine module.
   Drop this whole `focci-world/` folder into your repo root (or adjust the
   import/fetch paths below to match where you place it), then load it from
   index.html with:  <script type="module" src="./focci-world/world.js"></script>

   Everything here is a normal ES module using the real Three.js (r149) +
   the real GLTFLoader — no bundler needed, just a static file server
   (GitHub Pages serves this fine). See SETUP.md in this folder for the
   index.html / service-worker changes needed.
*/
import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

const ASSET = (p) => new URL('./assets/glb/' + p, import.meta.url).href;
const AUDIO = (p) => new URL('./assets/audio/' + p, import.meta.url).href;

/* ---------- tiny promise wrapper around GLTFLoader ---------- */
const loader = new GLTFLoader();
function loadGLB(url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

/* ============================================================
   BOOT
   ============================================================ */
export async function bootFocciWorld(root, opts) {
  opts = opts || {};
  const ANGEL_MESSAGES = opts.angelMessages || [];       // pass FOCCI_ANGEL_MESSAGES here
  const ARC_TITLES = opts.arcTitles || ['The Nameless Field', 'The Unspoken Sands', 'The Unmarked Woods', 'The Unchanging Garden'];
  // Every land is walkable any time now (see onInteract's 'teleport' case) —
  // opts.arcUnlocked/opts.onArcLocked are no longer read here at all. Left
  // harmless to pass from index.html; just unused.
  const onOpenArc = typeof opts.onOpenArc === 'function' ? opts.onOpenArc : function () {};
  const onOpenSayIt = typeof opts.onOpenSayIt === 'function' ? opts.onOpenSayIt : function () {};
  const onWordFound = typeof opts.onWordFound === 'function' ? opts.onWordFound : function () {};
  const onLetterProgress = typeof opts.onLetterProgress === 'function' ? opts.onLetterProgress : function () {};
  const onWordComplete = typeof opts.onWordComplete === 'function' ? opts.onWordComplete : function () {};
  // getNextTargetWord(): called whenever a new word-hunt round starts (first
  // boot, and again after the slow respawn). Must return a Promise<string>.
  // Kept OUTSIDE world.js on purpose — picking a real word (matching your
  // levels.txt B1-C2 filter + a real dict-00X.json entry) needs your real
  // IndexedDB, which only the integration script (running in the real app)
  // can see. world.js only handles the 3D scatter/collect mechanic.
  const getNextTargetWord = typeof opts.getNextTargetWord === 'function' ? opts.getNextTargetWord : async () => opts.targetWord || 'focci';

  try {
  const canvas = root.querySelector('#fw-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // Shadows were never switched on, which is why the island read as flat
  // no matter what the sun did: there was no cast shadow anywhere, so a
  // ridge and a flat plain caught exactly the same light.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
  if ('NoToneMapping' in THREE) renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  /* ============================================================
     DAY / NIGHT — driven by the visitor's real clock
     ============================================================ */
  /* Every water material in the scene, so the sea can be lit from inside
     after dark rather than just going dark with everything else. */
  /* Props and wander targets stay below the sky island. Measured on the
     real scene: Fox Island's own walkable surface runs y 6.1 to 29.7 (it has
     a tall central plateau), and the sky island's rocky underside bottoms
     out at 33.9 — so 32 sits in the gap. The first guess of 16 was cutting
     off the entire upper half of Fox Island, which would have stopped
     anything being placed on the plateau at all.
     Declared up here with waterMats for the same reason: station setup uses
     it long before the camera section further down would initialise it. */
  const GROUND_CEIL = 32;
  const waterMats = [];
  const WATER_GLOW = new THREE.Color(0x2FA8FF);
  // Declared up here, not beside tagWater: updateDayNight() runs during
  // setup, well before tagWater is ever reached, and a `const` further down
  // the same scope is in its temporal dead zone at that point — boot died
  // with "Cannot access 'waterMats' before initialization".

  const hemi = new THREE.HemisphereLight(0xfff3e6, 0x6a8a63, 0.85);
  // Warm, low and casting — a high overhead sun throws no visible shadow,
  // which is half of why there was no sense of morning light on the island.
  const sun = new THREE.DirectionalLight(0xffe7bd, 0.85);
  sun.position.set(46, 38, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(768, 768);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 34;   sun.shadow.camera.bottom = -34;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.03;
  // The moon is its own light, not the sun tinted down: it comes from the
  // other side, is cool white, and stays weak so the ridges it misses fall
  // genuinely dark instead of the whole island dimming evenly.
  const moon = new THREE.DirectionalLight(0xc8d8ff, 0);
  moon.position.set(-44, 34, -38);
  moon.castShadow = true;
  moon.shadow.mapSize.set(768, 768);
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 160;
  moon.shadow.camera.left = -34; moon.shadow.camera.right = 34;
  moon.shadow.camera.top = 34;   moon.shadow.camera.bottom = -34;
  moon.shadow.bias = -0.0012;
  moon.shadow.normalBias = 0.03;
  const ambient = new THREE.AmbientLight(0xffffff, 0.28);
  scene.add(hemi, sun, moon, ambient);

  const DAY_SKY = new THREE.Color(0x5fbdea), NIGHT_SKY = new THREE.Color(0x0d1a3a);
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true }));
  const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 16), new THREE.MeshBasicMaterial({ color: 0xf3f6ff, transparent: true }));
  // Sat where their own light actually comes from — they used to be parked
  // on the far side of the island from the sun direction, so you could
  // never see the disc the light was supposedly coming from.
  sunDisc.position.copy(sun.position).multiplyScalar(1.9);
  moonDisc.position.copy(moon.position).multiplyScalar(1.9);
  // A soft halo each, so they read as a light source rather than a ball.
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffdf9a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sunHalo.scale.setScalar(46); sunHalo.position.copy(sunDisc.position);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xbccdf5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  moonHalo.scale.setScalar(34); moonHalo.position.copy(moonDisc.position);
  scene.add(sunDisc, moonDisc, sunHalo, moonHalo);

  function dayFactor() {
    // 1 = full day, 0 = full night. Smooth 30-min ramps at 05:00 and 18:00.
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const rampInStart = 5 * 60, rampInEnd = 5 * 60 + 30;
    const rampOutStart = 18 * 60, rampOutEnd = 18 * 60 + 30;
    if (mins < rampInStart || mins >= rampOutEnd) return 0;
    if (mins >= rampInEnd && mins < rampOutStart) return 1;
    if (mins < rampInEnd) return (mins - rampInStart) / (rampInEnd - rampInStart);
    return 1 - (mins - rampOutStart) / (rampOutEnd - rampOutStart);
  }
  function updateDayNight() {
    const d = dayFactor();
    const sky = NIGHT_SKY.clone().lerp(DAY_SKY, d);
    scene.background = sky;
    scene.fog = scene.fog || new THREE.Fog(sky.getHex(), 60, 220);
    scene.fog.color.copy(sky);
    // Night is lit almost entirely by the moon, and the fill drops hard so
    // the faces it doesn't reach actually go dark — that contrast is what
    // makes the island's raised edges read as three-dimensional after dark.
    hemi.intensity = 0.22 + d * 0.63;
    sun.intensity = d * 1.05;
    moon.intensity = (1 - d) * 0.55;
    ambient.intensity = 0.1 + d * 0.22;
    sun.castShadow = d > 0.15;
    moon.castShadow = d <= 0.15;
    sunDisc.material.opacity = d;
    moonDisc.material.opacity = 1 - d;
    sunHalo.material.opacity = d * 0.85;
    moonHalo.material.opacity = (1 - d) * 0.6;
    // The sea lights up once the sun is gone — a deep blue glow from within
    // the water itself, brightest at full night.
    const night = 1 - d;
    for (const m of waterMats) {
      m.emissive.copy(WATER_GLOW);
      m.emissiveIntensity = night * 0.85;
      m.needsUpdate = false;
    }
  }
  updateDayNight();
  setInterval(updateDayNight, 30000); // real clock moves slowly; no need to check every frame

  /* ============================================================
     ROOMS — the station (hub) plus 4 teleportable arc worlds
     ============================================================ */
  const rooms = {}; // key -> { group, spawn:{x,z}, collidables:[], interactive:[], name }
  let currentRoomKey = 'station';

  function makeRoom(key, name) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);
    const room = { key, name, group, spawn: { x: 0, z: 0 }, collidables: [], interactive: [], doe: null, mushrooms: [], teleports: [], residents: [] };
    rooms[key] = room;
    return room;
  }

  function heightAtFallback(x, z) { return 0; }
  const raycaster = new THREE.Raycaster();
  const DOWN = new THREE.Vector3(0, -1, 0);
  /* `hit:false` means the ray found nothing at all at this x/z — off the
     edge of the island, over open air, not "ground at height 0". Callers
     that hand-pick fixed coordinates (teleport diamonds, chests) used to
     trust heightAtFallback()'s y:0 blindly, which is exactly how they ended
     up floating in mid-air past the island's actual (irregular, non-circular)
     footprint — a fixed radius that looked fine on one island shape can
     land in empty space on another. findGroundSpot() below uses this to
     retry instead of guessing. */
  /* `ceil` matters now that the sky island hangs over Fox Island. Every
     probe used to start at y 200 and take the topmost hit, which under the
     sky island is the sky island — Focci would have been walking around 27
     units in the air, and every prop would have been placed up there. Pass
     the height to search from and the first hit at or below it wins. */
  function surfaceYIn(room, x, z, ceil) {
    const lim = (ceil === undefined) ? Infinity : ceil;
    for (const obj of room.collidables) {
      raycaster.set(new THREE.Vector3(x, 200, z), DOWN);
      const hits = raycaster.intersectObject(obj, true);
      // The hub mesh isn't a single simple solid: a downward ray can return
      // several stacked hits at one x/z column (verified by sampling the raw
      // geometry directly — e.g. one column returned [26.1, 23.1, 0.39]).
      // Tried picking the LOWEST hit as "ground" once; live-tested it and it
      // was wrong — that low surface is a disconnected phantom underside,
      // confirmed visually (chest/diamond/letters/character all ended up
      // floating in open dark-blue void, detached from the visible mountain).
      // The TOPMOST hit is the real, visible, walkable surface — keep that.
      /* Topmost hit, buildings included. An attempt to let Focci walk in
         UNDER the roofs skipped the roof and took the next hit down — but
         Fox Island's huts have no interior floor, so that next hit was the
         underside of the island's own shell. Focci dropped through the
         world and could not be seen or steered back out, and every prop
         placed near a hut ended up hanging beneath the island. Going inside
         needs interior geometry this model simply does not have.
         The `building` flag below still keeps animals and props off the
         roofs; only Focci may climb them, which is now how he reaches the
         sky island. */
      let ground = null;
      for (const h of hits) { if (h.point.y <= lim) { ground = h; break; } }
      if (ground) {
        return {
          y: ground.point.y,
          water: !!(ground.object.userData && ground.object.userData.isWater),
          building: !!(ground.object.userData && ground.object.userData.isBuilding),
          hit: true
        };
      }
    }
    return { y: heightAtFallback(x, z), water: false, hit: false };
  }
  /* A raycast hit alone isn't enough proof of solid, walkable ground on a
     lumpy sculpted rock island: a downward ray can slip through a gap at
     the top and land on the underside of an overhang, or graze a thin
     outcropping — a real hit, but nowhere Focci could actually stand, and
     exactly how a diamond/chest ended up looking like it was floating in
     open air despite a "hit" being found. Requiring the four points right
     around it to also hit, at close to the same height, rejects those
     isolated/unstable spots without needing to know the island's actual
     shape. */
  function isStableGround(room, x, z, y) {
    const NEIGHBOR_R = 0.7, MAX_STEP = 1.5;
    for (const [dx, dz] of [[NEIGHBOR_R, 0], [-NEIGHBOR_R, 0], [0, NEIGHBOR_R], [0, -NEIGHBOR_R]]) {
      const n = surfaceYIn(room, x + dx, z + dz, GROUND_CEIL);
      if (!n.hit || n.water || Math.abs(n.y - y) > MAX_STEP) return false;
    }
    return true;
  }
  /* Local stability isn't enough either: this island is a chunky sculpted
     rock formation with real mountains on it (its raw bounding box is
     ~45 units tall — this is not a flat disc), so a small ledge or a
     separate outcropping can easily pass the 4-neighbor check above while
     still being nowhere near where Focci can actually walk from spawn.
     Walking a straight line of samples from the room's spawn point to the
     candidate, and requiring every step to also be solid ground with no
     sudden cliff (a big single-step height jump), is a cheap stand-in for
     "is this reachable" without needing real pathfinding or a navmesh. */
  function isReachableFromSpawn(room, x, z, y) {
    // 8, not 5: Fox Island's walkable surface spans y 6.1 to 29.7, so a
    // 5-unit cap from spawn rules out most of it before anything else runs.
    const STEPS = 10, MAX_JUMP = 2.2, MAX_TOTAL_DROP = 8;
    const sx = room.spawn.x, sz = room.spawn.z;
    const startY = surfaceYIn(room, sx, sz, GROUND_CEIL).y;
    // Per-step continuity alone isn't enough: a long, gradual, perfectly
    // "walkable" slope can still end up 15-20 units below where Focci
    // actually starts (found by comparing a prop's stored placement to its
    // real rendered height — a candidate can pass every single-step check
    // above while the terrain quietly slides downhill the whole way). That
    // reads exactly like the earlier floating-prop bug even though nothing
    // is technically disconnected — decorations belong on roughly the same
    // shelf Focci starts on, not down at the bottom of a hillside he'd have
    // to hike to. Capping the TOTAL elevation change from spawn catches
    // this in addition to the per-step jump check.
    if (Math.abs(y - startY) > MAX_TOTAL_DROP) return false;
    let prevY = startY;
    for (let i = 1; i <= STEPS; i++) {
      const t = i / STEPS;
      const px = sx + (x - sx) * t, pz = sz + (z - sz) * t;
      const s = surfaceYIn(room, px, pz, GROUND_CEIL);
      if (!s.hit || s.water || Math.abs(s.y - prevY) > MAX_JUMP) return false;
      prevY = s.y;
    }
    return Math.abs(prevY - y) < 0.5; // the walked path actually arrives at the candidate's own height
  }
  /* Pick a random point within [minR,maxR] of the room's own center that's
     confirmed solid, stable dry land — retries instead of trusting a
     hand-picked fixed coordinate is on-island. */
  function findGroundSpot(room, minR, maxR, tries) {
    tries = tries || 40;
    for (let i = 0; i < tries; i++) {
      const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const surf = surfaceYIn(room, x, z, GROUND_CEIL);
      if (surf.hit && !surf.water && !surf.building && isStableGround(room, x, z, surf.y) && isReachableFromSpawn(room, x, z, surf.y)) return { x, z, y: surf.y };
    }
    // Ceiling here too — without it this fallback probed straight up into
    // the sky island and handed back a spot 24 units in the air.
    return { x: room.spawn.x, z: room.spawn.z, y: surfaceYIn(room, room.spawn.x, room.spawn.z, GROUND_CEIL).y };
  }
  /* Same as findGroundSpot, but samples only within [angleFrom,angleTo) —
     used to spread the 4 teleport diamonds one per compass quadrant so they
     don't all land bunched together on whichever side of the island happens
     to be biggest. */
  function findGroundSpotInSlice(room, minR, maxR, angleFrom, angleTo, tries) {
    tries = tries || 40;
    for (let i = 0; i < tries; i++) {
      const a = angleFrom + Math.random() * (angleTo - angleFrom), r = minR + Math.random() * (maxR - minR);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const surf = surfaceYIn(room, x, z, GROUND_CEIL);
      if (surf.hit && !surf.water && !surf.building && isStableGround(room, x, z, surf.y) && isReachableFromSpawn(room, x, z, surf.y)) return { x, z, y: surf.y };
    }
    return findGroundSpot(room, minR, maxR, tries); // fall back to the full circle
  }
  /* Low-poly foliage (icosphere leaf clusters with real gaps between them)
     is a genuinely hard raycast target — tapping the visible leaves often
     lands in a gap and hits nothing, on a real touchscreen just as much as
     in testing. Every "tap this" prop gets an invisible, generously-sized
     sphere as its actual raycast target instead of relying on its exact
     (gappy) visible geometry — the sphere is what goes in room.interactive,
     the visible model stays purely decorative. */
  /* findGroundSpot only proves a point is solid and reachable — it says
     nothing about what the ground does across a prop's whole footprint. A
     6-unit-wide tree placed by its centre point alone kept landing where the
     terrain falls away, so its trunk buried itself on the high side while
     the roots hung out over the drop ("cắm và lòi ra 1 khúc đất"). This
     samples candidates and keeps the one whose ground varies least across a
     ring the size of the prop. */
  function findFlatGroundSpot(room, rMin, rMax, footprint, tries) {
    // Measured on the real hub: sampling 400 random walkable points, the
    // MEDIAN height spread across a 2.2-unit ring is 2.44 units and the
    // flattest point found was 0.45. Genuinely flat ground is rare here, so
    // this needs a lot of candidates and a realistic "good enough" bar —
    // 14 tries and a 0.25 threshold effectively never hit either.
    let best = null;
    for (let i = 0; i < (tries || 60); i++) {
      const spot = findGroundSpot(room, rMin, rMax);
      let lo = spot.y, hi = spot.y, ok = true;
      for (let a = 0; a < 8; a++) {
        const ang = (Math.PI / 4) * a;
        const surf = surfaceYIn(room, spot.x + Math.cos(ang) * footprint, spot.z + Math.sin(ang) * footprint, GROUND_CEIL);
        if (!surf.hit || surf.water) { ok = false; break; }
        lo = Math.min(lo, surf.y); hi = Math.max(hi, surf.y);
      }
      if (!ok) continue;
      const spread = hi - lo;
      if (!best || spread < best.spread) best = { x: spot.x, y: spot.y, z: spot.z, spread: spread, lowest: lo };
      if (spread < 0.5) break;   // flat enough for this terrain, stop looking
    }
    return best || findGroundSpot(room, rMin, rMax);
  }

  /* Mushrooms, for any island. Was inline in the station setup and so only
     ever ran there, which is why the arc lands had none. */
  const MUSH_TARGET = 0.45;
  function scatterMushrooms(room, rMin, rMax, count) {
    const props = extractPropGroups(mushGlb.scene);
    for (let i = 0; i < count; i++) {
      const p = props[i % props.length];
      const spot = findGroundSpot(room, rMin, rMax);
      const inst = p.clone(true);
      const mBox = new THREE.Box3().setFromObject(inst);
      const mSize = mBox.getSize(new THREE.Vector3());
      const mScale = MUSH_TARGET / Math.max(mSize.x, mSize.y, mSize.z, 0.0001);
      inst.scale.setScalar(mScale);
      const groundedY = spot.y - mBox.min.y * mScale;
      inst.position.set(spot.x, groundedY, spot.z);
      inst.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      room.group.add(inst);
      // An invisible hitbox roughly mushroom-sized is the real raycast
      // target, not the small (and rotating) visible cap.
      const hitbox = addInvisibleHitbox(room, spot.x, groundedY + MUSH_TARGET * 0.5, spot.z, MUSH_TARGET * 0.9, 'mushroom');
      room.mushrooms.push({ obj: inst, hitbox, x: spot.x, z: spot.z, found: false });
    }
  }

  /* A spot on a given BEARING, for things that must sit at fixed compass
     points. Searching a random quadrant does not work on Fox Island: the
     6-12 ring runs straight through the village (measured: roofs are the
     top surface at 41% of it), so two of the four quadrants yielded nothing
     at all and the diamonds that could not find a spot fell back to the
     island centre, stacking on top of each other.

     This walks outward along the bearing with a little angular jitter and
     takes the first spot that passes, then relaxes the requirements one at
     a time rather than giving up — a diamond slightly off the ideal shelf
     is far better than four in a heap. */
  function findSpotOnBearing(room, bearing, rMin, rMax) {
    const tries = [
      (su, x, z) => su.hit && !su.water && !su.building && isStableGround(room, x, z, su.y) && isReachableFromSpawn(room, x, z, su.y),
      (su, x, z) => su.hit && !su.water && !su.building && isStableGround(room, x, z, su.y),
      (su, x, z) => su.hit && !su.water && !su.building,
      (su) => su.hit && !su.water
    ];
    for (const ok of tries) {
      for (let step = 0; step < 40; step++) {
        const r = rMin + ((rMax - rMin) * (step % 10)) / 9;
        const a = bearing + (Math.floor(step / 10) - 1.5) * 0.18;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const su = surfaceYIn(room, x, z, GROUND_CEIL);
        if (ok(su, x, z)) return { x, z, y: su.y };
      }
    }
    return findGroundSpot(room, rMin, rMax);
  }

  function addInvisibleHitbox(room, x, y, z, radius, interactType) {
    const hit = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(x, y, z);
    hit.userData.interactType = interactType;
    room.group.add(hit);
    room.interactive.push(hit);
    return hit;
  }
  /* A soft radial-gradient sprite texture for glow effects (wisdom tree,
     any future magic prop) — cheap, no image asset needed. */
  function makeGlowTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,240,200,.6)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const GLOW_TEX = makeGlowTexture(); // one shared texture for every burst — no reason to re-render the canvas per pickup

  /* ============================================================
     PICKUP EFFECTS — mushrooms/letters used to just vanish with no
     feedback at all ("chưa có hiệu ứng gì cho việc nhặt được... user k
     biết nhặt để làm gì"). A short burst of glowing motes plus a quick
     light flash reads as "you got something" without needing any new
     art asset. `activeEffects` is ticked once per frame from animate()
     and self-removes when its animation finishes.
     ============================================================ */
  const activeEffects = [];
  function spawnPickupBurst(room, x, y, z, color) {
    const N = 7, DURATION = 0.65;
    const light = new THREE.PointLight(color, 1.6, 4, 2);
    light.position.set(x, y, z);
    room.group.add(light);
    const sprites = [];
    for (let i = 0; i < N; i++) {
      const mat = new THREE.SpriteMaterial({ map: GLOW_TEX, color, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(mat);
      const ang = (i / N) * Math.PI * 2 + Math.random() * 0.4;
      sp.userData.vx = Math.cos(ang) * (1.1 + Math.random() * 0.7);
      sp.userData.vz = Math.sin(ang) * (1.1 + Math.random() * 0.7);
      sp.userData.vy = 1.6 + Math.random() * 0.9;
      sp.scale.setScalar(0.32);
      sp.position.set(x, y, z);
      room.group.add(sp);
      sprites.push(sp);
    }
    let age = 0;
    activeEffects.push((dt) => {
      age += dt;
      const k = Math.min(1, age / DURATION);
      sprites.forEach((sp) => {
        sp.position.x += sp.userData.vx * dt;
        sp.position.z += sp.userData.vz * dt;
        sp.userData.vy -= 3.4 * dt;
        sp.position.y += sp.userData.vy * dt;
        sp.material.opacity = 1 - k;
        sp.scale.setScalar(0.32 * (1 - k * 0.55));
      });
      light.intensity = 1.6 * (1 - k);
      if (age < DURATION) return true;
      sprites.forEach((sp) => { room.group.remove(sp); sp.material.dispose(); });
      room.group.remove(light);
      return false;
    });
  }

  /* Fox Island ships with huts, fences and a totem, and a downward raycast
     returns the ROOF as the topmost hit at those columns — so the doe (and
     every animal that follows) treated a rooftop as ordinary ground and
     wandered up onto it. Tagged by material name here; surfaceYIn reports
     the flag and everything that chooses a spot refuses one. */
  /* Roofs and walls only. The first version also matched wood/plank/fence/
     totem, and on Fox Island the decking and railings ARE "wood" — that one
     word marked 214 of 400 sampled ground points as off-limits, more than
     half the island, and is why the four teleport diamonds could not find a
     single valid spot and all fell back to the centre on top of each other. */
  const BUILDING_MAT = /roof|tejado|home_body|casa1|window|chimney/i;
  /* Static scenery, merged one mesh per material.

     Measured before this: 789 draw calls per frame. Fox Island alone ships
     532 separate meshes and the sky island another 558, and every one of
     them is its own draw — on a phone that is the whole performance
     problem. They never move, so there is no reason for them to stay
     separate.

     three.module.js here does not bundle BufferGeometryUtils (only the
     error string telling you to use it), so this is a small hand-rolled
     concatenation: position/normal/uv only, indices re-based, geometry
     baked into the root's local space so the root's own transform still
     applies exactly once.

     Merging happens BEFORE tagWater/tagBuildings on purpose — both tag by
     material, and after the merge there is exactly one mesh per material,
     so the tags land on precisely the right geometry. */
  function mergeStaticByMaterial(root3d) {
    root3d.updateMatrixWorld(true);
    const toRoot = root3d.matrixWorld.clone().invert();
    const byMat = new Map();
    const originals = [];
    root3d.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      if (Array.isArray(o.material)) return;           // multi-material: leave alone
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(o);
      originals.push(o);
    });
    if (originals.length < 8) return 0;

    let made = 0;
    for (const [mat, list] of byMat) {
      let vTotal = 0, iTotal = 0;
      for (const m of list) {
        vTotal += m.geometry.attributes.position.count;
        iTotal += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
      }
      const pos = new Float32Array(vTotal * 3);
      const nor = new Float32Array(vTotal * 3);
      const uv  = new Float32Array(vTotal * 2);
      const idx = vTotal > 65535 ? new Uint32Array(iTotal) : new Uint16Array(iTotal);
      let vOff = 0, iOff = 0;
      const mtx = new THREE.Matrix4(), nmt = new THREE.Matrix3();
      const v = new THREE.Vector3();
      for (const m of list) {
        mtx.multiplyMatrices(toRoot, m.matrixWorld);
        nmt.getNormalMatrix(mtx);
        const g = m.geometry, p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(mtx);
          pos[(vOff + i) * 3] = v.x; pos[(vOff + i) * 3 + 1] = v.y; pos[(vOff + i) * 3 + 2] = v.z;
          if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nmt).normalize();
                   nor[(vOff + i) * 3] = v.x; nor[(vOff + i) * 3 + 1] = v.y; nor[(vOff + i) * 3 + 2] = v.z; }
          if (u) { uv[(vOff + i) * 2] = u.getX(i); uv[(vOff + i) * 2 + 1] = u.getY(i); }
        }
        if (g.index) { for (let i = 0; i < g.index.count; i++) idx[iOff + i] = g.index.getX(i) + vOff; iOff += g.index.count; }
        else { for (let i = 0; i < p.count; i++) idx[iOff + i] = vOff + i; iOff += p.count; }
        vOff += p.count;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      const merged = new THREE.Mesh(geo, mat);
      merged.name = 'merged_' + (mat.name || 'mat');
      root3d.add(merged);
      made++;
    }
    for (const o of originals) { if (o.parent) o.parent.remove(o); o.geometry.dispose(); }
    /* The merged meshes are brand-new children, so until the graph is walked
       again their matrixWorld is still identity — and every placement
       raycast that runs before the first rendered frame would then test
       geometry that is missing the root's scale and position entirely.
       That is exactly what put the mushrooms and the diamonds at y 0 while
       the ground under them measured 7.2: the same stale-matrix trap the
       hub itself already carries a comment about further down. */
    root3d.updateMatrixWorld(true);
    return made;
  }

  function tagBuildings(root3d) {
    root3d.traverse((n) => {
      if (n.isMesh && n.material && BUILDING_MAT.test(n.material.name || '')) n.userData.isBuilding = true;
    });
  }

  function tagWater(root3d) {
    root3d.traverse((n) => {
      if (n.isMesh && n.material && n.material.transparent && n.material.color) {
        const c = n.material.color;
        // The hub's actual water material is teal (#06A08F — green
        // slightly higher than blue), which narrowly failed the old
        // "blue-dominant" check (needed b >= g*0.9, teal's b sits just
        // under that) and went completely untagged — bushes/props kept
        // landing on it as if it were dry ground. Water reads as
        // cyan-ish: red clearly low, green AND blue both clearly above
        // red, not "blue is the single highest channel."
        if (c.r < 0.25 && c.b > 0.3 && c.g > c.r * 1.8 && c.b > c.r * 1.8) {
          n.userData.isWater = true;
          // Collected so updateDayNight can light them from within after
          // dark — see waterMats below.
          if (n.material.emissive && waterMats.indexOf(n.material) === -1) waterMats.push(n.material);
        }
      }
    });
  }

  /* extract each top-level named child of a loaded GLTF scene as its own
     placeable prop (works well for kit files like the mushroom/bush/forest packs,
     which are already exported as one wrapper group per prop — verified against
     your actual files: mushroom -> 15 groups, bush kit -> 4 groups, forest kit -> 17 groups) */
  function extractPropGroups(gltfScene) {
    let node = gltfScene;
    // Sketchfab exports usually wrap everything under Sketchfab_model > ... > RootNode
    while (node.children.length === 1 && !node.isMesh) node = node.children[0];
    return node.children.slice();
  }

  /* scatterClone() lived here: it normalised a kit prop to a target size
     and sprinkled N copies over validated ground. Both callers (the forest
     kit and the bush kit on the hub) are gone, so it went with them. */

  /* ============================================================
     ASSET LOADING — every GLB used to load one at a time (an `await`
     per file, ~17 of them back to back), which meant the network round
     trips just added up in serial before the first frame could ever
     render. None of these files depend on each other to FETCH — only
     to place afterwards — so they all load in parallel now instead.
     teleport-diamond.glb also used to get fetched 5 separate times (once
     for the hub, once per arc room); loaded once here and cloned instead.
     ============================================================ */
  const ARC_ENV_FILES = ['island.glb', 'camp.glb', 'waterfall.glb', 'secretcamp.glb'];
  const arcCount = Math.min(ARC_TITLES.length, 4);
  const [
    hub, mushGlb, birdGlb, skyGlb, pondGlb, doeGlb, diamondGlb,
    ...arcGltfs
  ] = await Promise.all([
    loadGLB(ASSET('fox-island.glb')),
    loadGLB(ASSET('mushrooms.glb')),
        loadGLB(ASSET('birds.glb')),
    loadGLB(ASSET('sky-island.glb')),
    loadGLB(ASSET('pond.glb')),
    loadGLB(ASSET('doe.glb')),
    loadGLB(ASSET('teleport-diamond.glb')),
    ...Array.from({ length: arcCount }, (_, i) => loadGLB(ASSET(ARC_ENV_FILES[i]))),
  ]);

  /* The raw diamond is 5.3 units tall (roughly 4x Focci's own height) with
     its origin nowhere near its base — the old flat `scale.setScalar(1.4)`
     plus `position.set(x, groundY, z)` (no ground-anchor offset) made it
     both way oversized ("quá to với Focci") AND half-buried in the terrain
     ("cắm vào bên trong đảo") at the same time. Measured once here and
     reused by every diamond (station teleports + each arc's way-home one)
     so they're all the same correct size, properly grounded, with a soft
     glow so it reads as a magic waypoint like the vine tree does. */
  const DIAMOND_TARGET = 0.9;
  const diamondBox = new THREE.Box3().setFromObject(diamondGlb.scene);
  const diamondSize = diamondBox.getSize(new THREE.Vector3());
  const diamondScale = DIAMOND_TARGET / Math.max(diamondSize.x, diamondSize.y, diamondSize.z, 0.0001);
  const DIAMOND_GLOW_COLOR = 0x7CFFC4;
  /* One hue per destination so the four of them are telling apart at a
     glance instead of being four identical glows. Index order matches
     ARC_TITLES; the way-home diamond in each arc keeps the default. */
  const ARC_GLOW_COLORS = [0x6FE3FF, 0xFFC44D, 0x9B8CFF, 0x6BF2A8];
  function spawnDiamond(room, x, y, z, interactType, targetArc, glowColor) {
    const d = diamondGlb.scene.clone(true);
    d.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const mixer = new THREE.AnimationMixer(d);
    if (diamondGlb.animations[0]) mixer.clipAction(diamondGlb.animations[0]).play();
    d.scale.setScalar(diamondScale);
    // Lifted a little: sitting exactly on the surface, the diamond's lower
    // point kept disappearing into any bump it happened to land on and the
    // silhouette came out clipped.
    const groundedY = (y - diamondBox.min.y * diamondScale) + 0.3;
    d.position.set(x, groundedY, z);
    d.userData.interactType = interactType;
    if (targetArc !== undefined) d.userData.targetArc = targetArc;
    room.group.add(d);
    room.interactive.push(d);
    const glowY = groundedY + diamondSize.y * diamondScale * 0.5;
    const col = glowColor !== undefined ? glowColor : DIAMOND_GLOW_COLOR;
    const light = new THREE.PointLight(col, 1.3, 7, 2);
    light.position.set(x, glowY, z);
    room.group.add(light);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: col, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.scale.setScalar(2.2);
    sprite.position.set(x, glowY, z);
    room.group.add(sprite);
    return { obj: d, mixer, glowLight: light, glowSprite: sprite };
  }

  /* ============================================================
     STATION ROOM (hub) — Fox Island
     ============================================================ */
  const station = makeRoom('station', 'Station');
  {
    hub.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(hub.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = 51 / Math.max(size.x, size.z); // 1.5x the old 34 — asked for a bigger hub
    hub.scene.scale.setScalar(scale);
    hub.scene.position.y = -box.min.y * scale;
    // Three.js only recomputes matrixWorld automatically once per rendered
    // frame — nothing has rendered yet at this point in setup, so without
    // this call every raycast below (findGroundSpot, isReachableFromSpawn,
    // spawn height itself) would run against the STALE pre-scale/position
    // transform, silently placing everything using the raw/unscaled/
    // unanchored geometry. This is what actually caused decorations to
    // "float" ~20 units away from Focci despite every placement check
    // passing — the checks were consistent with each other, just all
    // wrong against the same stale matrix, which only got corrected once
    // the first real frame rendered (by which point props were already
    // placed and baked into the wrong spot).
    hub.scene.updateMatrixWorld(true);
    mergeStaticByMaterial(hub.scene);
    // receiveShadow only. The island is what shadows land ON; having it cast
    // as well doubled it up in the shadow pass for no visible gain, since
    // nothing of it is ever backlit against anything else.
    hub.scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    tagWater(hub.scene);
    tagBuildings(hub.scene);
    station.group.add(hub.scene);
    station.collidables.push(hub.scene);
    /* Spawn on the island's MAIN SHELF, not its geometric centre — on Fox
       Island that centre is the top of the central mound at y 24.3, and
       since isReachableFromSpawn measures every candidate against the spawn
       height, starting up there disqualified the whole lower island.
       Sampling for the median walkable height and settling on a stable
       point near it puts Focci where most of the island actually is. */
    {
      const samples = [];
      for (let i = 0; i < 240; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 16;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const su = surfaceYIn(station, x, z, GROUND_CEIL);
        if (su.hit && !su.water && !su.building) samples.push({ x, z, y: su.y });
      }
      if (samples.length) {
        const median = samples.slice().sort((p, q) => p.y - q.y)[Math.floor(samples.length / 2)].y;
        samples.sort((p, q) => Math.abs(p.y - median) - Math.abs(q.y - median));
        const pick = samples.find((c) => isStableGround(station, c.x, c.z, c.y)) || samples[0];
        station.spawn = { x: pick.x, z: pick.z };
      } else {
        station.spawn = { x: 0, z: box.getCenter(new THREE.Vector3()).z * scale * 0.15 };
      }
    }

    // decorate with the two vegetation kits you sent — target sizes (largest
    // dimension, in world units) rather than a flat multiplier on whatever
    // scale the kit happened to export at; see scatterClone's comment.
    // Radii scaled up 1.5x to match the bigger hub above.
    // The forest kit's own scene includes a few small flower props
    // (named "flower1"/"flower2"/"flower3" in the source file) alongside
    // the actual trees — scatterClone normalizes EVERY template it's given
    // to the same targetSize (5, meant for a full tree), so a flower ended
    // up blown up to tree-sized and scattered with no purpose. Dropped
    // entirely rather than given their own separate smaller scatter pass —
    // asked to just remove them, not re-tune them.
    // NO scattered vegetation any more. Both kits used to be fanned out over
    // the island by scatterClone: the forest kit (17 groups — whole trees,
    // but also loose branches, leaf sprigs and flowers) and the bush kit.
    // Every one of those groups was normalized to a single targetSize, so a
    // branch or a leaf came out the size of a sapling, and they read as
    // shrunken trees and twigs stabbed into the ground at random angles.
    // The hub model already carries its own baked-in scenery, so the whole
    // decorative scatter is gone rather than re-tuned — what stays on the
    // island is only what the player can actually do something with: the
    // wisdom tree, mushrooms, word-hunt letters and teleports.
    // forest-kit.glb and bush-kit.glb are no longer fetched at all —
    // nothing else used them, so that is two fewer GLBs on first load.

    // mushrooms — 15 individual finds, tucked near bushes/rocks. Same two
    // fixes as scatterClone: measured + normalized scale instead of a flat
    // guess, and findGroundSpot instead of a water-only retry (a miss
    // entirely — off the island's edge — used to fall back to y:0, floating).
    scatterMushrooms(station, 3, 13, 15);

    // Chests removed on request — they are no longer part of the island.

    // birds — a small flying loop, purely decorative
    const birdMixer = new THREE.AnimationMixer(birdGlb.scene);
    if (birdGlb.animations[0]) birdMixer.clipAction(birdGlb.animations[0]).play();
    birdGlb.scene.scale.setScalar(0.4);
    birdGlb.scene.position.set(0, 14, 0);
    station.group.add(birdGlb.scene);
    station._birdMixer = birdMixer;
    station._birdOrbit = { r: 18, speed: 0.15, y: 20 };
    station._birdRig = birdGlb.scene;

    /* ============================================================
       THE SKY ISLAND

       vine-tree.glb is gone; the wisdom tree is now the cherry blossom on
       this floating island, which hangs in the air over Fox Island and is
       reached by flying up to its torii gate.

       Placed deliberately OFF-CENTRE and to one side: directly overhead it
       would sit on top of the player's own camera for most of the game.

       Everything below is measured out of the model rather than guessed —
       torii gate at (0, 306, 80), green lawn topping out at y 262, the
       cherry trunks clustered near (-15, 88). Those are model-space, so
       they all go through skyPoint() to come back as world coordinates.
       ============================================================ */
    /* Sized and lifted from measurements, not taste: the model trails a long
       rocky underside 1063 model-units below its lawn, so at the first try
       (span 34, lawn at 27) that tail reached down to y 1.3 and hung
       straight through Fox Island. Span 24 shortens the tail to ~18 and a
       lawn at 52 puts its lowest rock at ~34 — clear of Fox Island's 31.6
       peak, and above GROUND_CEIL so no ground probe can ever find it. */
    const SKY_SPAN = 34;                           // 40% bigger, as asked
    // Raised to match: the rocky tail is 1063 model-units long, so at span 34
    // it hangs 25.7 world-units below the lawn. A lawn at 62 puts its lowest
    // rock at ~36 — still clear of Fox Island's 31.6 peak and of GROUND_CEIL.
    const SKY_OFFSET = { x: 26, y: 62, z: -21 };   // high, and off to one side
    skyGlb.scene.updateMatrixWorld(true);
    const skyBox = new THREE.Box3().setFromObject(skyGlb.scene);
    const skySize = skyBox.getSize(new THREE.Vector3());
    const skyScale = SKY_SPAN / Math.max(skySize.x, skySize.z);
    skyGlb.scene.scale.setScalar(skyScale);
    // Anchor by the LAWN, not the bounding box: the model hangs a long rocky
    // underside below the island, and anchoring on that would push the part
    // you actually stand on far higher than SKY_OFFSET.y asks for.
    const LAWN_Y = 262;
    skyGlb.scene.position.set(
      SKY_OFFSET.x - (skyBox.getCenter(new THREE.Vector3()).x) * skyScale,
      SKY_OFFSET.y - LAWN_Y * skyScale,
      SKY_OFFSET.z - (skyBox.getCenter(new THREE.Vector3()).z) * skyScale
    );
    skyGlb.scene.updateMatrixWorld(true);
    mergeStaticByMaterial(skyGlb.scene);
    skyGlb.scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    tagWater(skyGlb.scene);
    tagBuildings(skyGlb.scene);
    station.group.add(skyGlb.scene);
    station.collidables.push(skyGlb.scene);

    // model space -> world space, for the landmarks measured above
    const skyPoint = (mx, my, mz) => new THREE.Vector3(mx, my, mz)
      .multiplyScalar(skyScale).add(skyGlb.scene.position);

    const gate = skyPoint(0, 250, 80);          // Torii-Gris, the gate's base plate
    // Offset well away from the gate: the trunk group's bounding-box centre
    // sits almost on the torii, and the two hitboxes were overlapping.
    const sakura = skyPoint(-135, 268, 40);     // the big cherry, at lawn height
    station.sky = { obj: skyGlb.scene, scale: skyScale, gate, sakura, offset: SKY_OFFSET };

    /* Pink halo, so it reads as the magical place rather than scenery: a
       broad additive sprite plus a rose light that actually tints the
       island's own geometry. */
    const skyGlowTex = makeGlowTexture();
    const skyHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: skyGlowTex, color: 0xFF9ED2, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    skyHalo.scale.setScalar(SKY_SPAN * 1.05);
    skyHalo.position.set(SKY_OFFSET.x, SKY_OFFSET.y + 2, SKY_OFFSET.z);
    station.group.add(skyHalo);
    // Kept gentle: at 2.2 the halo plus the light blew the whole island out
    // to near-white and you could not see the blossom at all.
    const skyLight = new THREE.PointLight(0xFF8FC8, 0.75, SKY_SPAN * 1.3, 2);
    skyLight.position.set(SKY_OFFSET.x, SKY_OFFSET.y + 5, SKY_OFFSET.z);
    station.group.add(skyLight);
    station.sky.halo = skyHalo;
    station.sky.light = skyLight;

    /* The pond, with its fish swimming, set on the lawn beside the gate —
       the spot circled on the reference. Its own animation clip is played
       on the station's mixer list so the fish keep moving. */
    {
      const pBox = new THREE.Box3().setFromObject(pondGlb.scene);
      const pSize = pBox.getSize(new THREE.Vector3());
      // Right in the middle of the torii, which stands at model (0, ·, 80).
      // Sized to sit inside the gate's 141-unit opening rather than swallow
      // the posts.
      const pScale = (SKY_SPAN * 0.085) / Math.max(pSize.x, pSize.z);
      pondGlb.scene.scale.setScalar(pScale);
      const spot = skyPoint(0, LAWN_Y, 80);
      pondGlb.scene.position.set(spot.x, spot.y - pBox.min.y * pScale - 0.04, spot.z);
      pondGlb.scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      station.group.add(pondGlb.scene);
      if (pondGlb.animations && pondGlb.animations.length) {
        const pm = new THREE.AnimationMixer(pondGlb.scene);
        pondGlb.animations.forEach((c) => pm.clipAction(c).play());
        station.pondMixer = pm;
      }
      station.sky.pond = pondGlb.scene;
    }

    /* The cherry blossom is the wisdom tree now — same interactType, so the
       listening moment, the camera swing and the quote all still work. */
    addInvisibleHitbox(station, sakura.x, sakura.y + SKY_SPAN * 0.09, sakura.z, SKY_SPAN * 0.055, 'vine-tree');
    station.vineTree = { obj: skyGlb.scene, x: sakura.x, z: sakura.z };
    const treeGlowColor = 0xFFC7E4;
    const treeLight = new THREE.PointLight(treeGlowColor, 0.9, SKY_SPAN * 0.45, 2);
    treeLight.position.set(sakura.x, sakura.y + SKY_SPAN * 0.13, sakura.z);
    station.group.add(treeLight);
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: treeGlowColor, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    glowSprite.scale.setScalar(SKY_SPAN * 0.2);
    glowSprite.position.copy(treeLight.position);
    station.group.add(glowSprite);
    station.vineTree.glowSprite = glowSprite;
    station.vineTree.glowLight = treeLight;

    /* The way up is the tallest roof on the island. Climb a hut, walk to
       the very top of its cap, and the flight starts on its own — no pad to
       tap, which is what was asked for.

       The peak is found from the geometry rather than hand-placed: of the
       meshes tagged as roofs, take the one that reaches highest, then
       raycast straight down onto it at its own centre to get the exact
       point of the cap. */
    {
      /* The HIGHEST point of the whole island, whatever it is made of —
         here that is the weather-vane tower at (-1.9, -0.1), y 31.6.
         Looking only at roof-material meshes picked a hut instead, which
         is why climbing "the roof" never triggered anything. */
      let best = null;
      station.collidables[0].traverse((o) => {
        if (!o.isMesh) return;
        const b = new THREE.Box3().setFromObject(o);
        if (!best || b.max.y > best.max.y) best = b;
      });
      if (best) {
        const c = best.getCenter(new THREE.Vector3());
        const su = surfaceYIn(station, c.x, c.z, GROUND_CEIL);
        const peakY = su.hit ? su.y : best.max.y;
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xB07CFF, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.setScalar(4.2);
        halo.position.set(c.x, peakY + 1.3, c.z);
        station.group.add(halo);
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 1.05, 4.2, 14, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xC79BFF, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
        );
        beam.position.set(c.x, peakY + 2.1, c.z);
        station.group.add(beam);
        const violet = new THREE.PointLight(0xA875FF, 1.5, 12, 2);
        violet.position.set(c.x, peakY + 1.6, c.z);
        station.group.add(violet);
        station.skyPad = { glow: halo, beam, light: violet, x: c.x, y: peakY, z: c.z };
      }
      /* ---------------- DOORWAYS ----------------
         Each hut gets a lit marker on the ground just outside it. Step into
         the marker and Focci goes in: the roof and walls of that hut turn
         transparent so you can see him inside, and a warm lamp switches on.

         Standing "inside" is a state, not a move — there is no interior
         floor in this model, so the hut is opened up around him rather than
         him being sent somewhere. Animals will use exactly the same
         markers, which is why this is keyed off the building meshes
         themselves rather than hand-placed points. */
      station.houses = [];
      {
        const seen = [];
        station.collidables[0].traverse((o) => {
          if (!o.isMesh || !o.userData.isBuilding) return;
          if (!/home_body|casa1/i.test((o.material && o.material.name) || '')) return;
          seen.push(o);
        });
        /* One merged mesh holds every wall, so the individual huts are
           recovered from the geometry: walk its bounding box in a grid and
           cluster the columns that hit a wall. */
        const wallMesh = seen[0];
        if (wallMesh) {
          const wb = new THREE.Box3().setFromObject(wallMesh);
          const clusters = [];
          for (let x = wb.min.x; x <= wb.max.x; x += 1.2) {
            for (let z = wb.min.z; z <= wb.max.z; z += 1.2) {
              raycaster.set(new THREE.Vector3(x, 200, z), DOWN);
              const hits = raycaster.intersectObject(wallMesh, true);
              if (!hits.length) continue;
              const near = clusters.find((c) => Math.hypot(c.x - x, c.z - z) < 4.5);
              if (near) { near.n++; near.sx += x; near.sz += z; near.x = near.sx / near.n; near.z = near.sz / near.n; }
              else clusters.push({ x, z, sx: x, sz: z, n: 1, y: hits[0].point.y });
            }
          }
          clusters.filter((c) => c.n >= 3).slice(0, 6).forEach((c) => {
            /* The doorway marker goes on open ground just outside the hut,
               found by stepping outward from its centre until the column
               stops being building. */
            let mx = c.x, mz = c.z, my = c.y;
            const dirx = c.x - station.spawn.x, dirz = c.z - station.spawn.z;
            const len = Math.hypot(dirx, dirz) || 1;
            for (let d = 2; d <= 7; d += 0.5) {
              const px = c.x - (dirx / len) * d, pz = c.z - (dirz / len) * d;
              const su = surfaceYIn(station, px, pz, GROUND_CEIL);
              if (su.hit && !su.water && !su.building) { mx = px; mz = pz; my = su.y; break; }
            }
            const ring = new THREE.Mesh(
              new THREE.CylinderGeometry(0.85, 0.85, 0.06, 18),
              new THREE.MeshStandardMaterial({ color: 0xFFE3AE, emissive: 0xFFC96B, emissiveIntensity: 1.1, transparent: true, opacity: 0.8 })
            );
            ring.position.set(mx, my + 0.04, mz);
            station.group.add(ring);
            const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xFFD98A, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
            spark.scale.setScalar(2.6);
            spark.position.set(mx, my + 0.9, mz);
            station.group.add(spark);
            // the lamp that comes on once he is inside
            const lamp = new THREE.PointLight(0xFFCE87, 0, 7, 2);
            lamp.position.set(c.x, c.y + 1.4, c.z);
            station.group.add(lamp);
            station.houses.push({ x: mx, z: mz, y: my, cx: c.x, cz: c.z, ring, spark, lamp, inside: false });
          });
        }
      }

      // The gate up top is the way back down.
      addInvisibleHitbox(station, gate.x, gate.y + SKY_SPAN * 0.045, gate.z, SKY_SPAN * 0.04, 'sky-gate');
    }

    const doeMixer = new THREE.AnimationMixer(doeGlb.scene);
    const clipByName = {};
    doeGlb.animations.forEach((c) => { clipByName[c.name.split('|').pop()] = c; });
    const DOE_SCALE = 1.1;
    doeGlb.scene.scale.setScalar(DOE_SCALE);
    // No bounding-box anchor here, deliberately. doe.glb is a single
    // SkinnedMesh whose rest geometry is FLAT — measured on the live scene,
    // its geometry bounding box is y 0 -> 0.017, so Box3.setFromObject
    // returns a 0.02-unit-tall box and any box.min.y offset taken from it is
    // meaningless. The shape comes from the 44 bones, and the lowest of them
    // (root_02) sits exactly at the object origin, i.e. the model is already
    // authored with its feet at y=0.
    // The real reason it was "chạy ở ngay không trung": tickDoe only ever
    // moved x and z. It was correctly grounded where it spawned and then
    // kept that one height for the rest of the session, so the moment it
    // wandered onto different terrain it was flying. Fixed by re-sampling
    // the surface every frame it moves — see groundDoe() in tickDoe.
    const doeFootOffset = 0;
    // The doe used to live beside the vine tree; with that gone she gets
    // her own validated patch of Fox Island.
    const doeHome = findFlatGroundSpot(station, 4, 10, 1.2, 40);
    const doeSpot = { x: doeHome.x, z: doeHome.z, y: doeHome.y };
    doeGlb.scene.position.set(doeSpot.x, doeSpot.y - doeFootOffset, doeSpot.z);
    station.group.add(doeGlb.scene);
    station.doe = {
      obj: doeGlb.scene, mixer: doeMixer, clips: clipByName,
      homeX: doeSpot.x, homeZ: doeSpot.z, footOffset: doeFootOffset,
      state: 'idle', cooldown: 6 + Math.random() * 6, current: null,
      wanderTarget: null, calledHome: false
    };
    playDoeClip(station.doe, 'Dear_idle', true);

    // 4 teleport diamonds -> the 4 arc worlds. findGroundSpot instead of 4
    // fixed {x,z} guesses (same off-island-floating risk as everything else
    // above), spread around the station by giving each a angular slice of
    // the compass to sample within rather than the full circle, so they
    // don't cluster on the same side by chance.
    ARC_TITLES.slice(0, 4).forEach((title, i) => {
      // Pushed further out (6-12 instead of 4-10) and picked for flatness,
      // so they stand in open ground instead of wedged against the hub's own
      // rocks and trees where their corners were being cut off.
      // One per compass corner — NE, SE, SW, NW — so all four are actually
      // findable and each leads to its own land.
      const bearing = (Math.PI / 4) + (Math.PI / 2) * i;
      let spot = findSpotOnBearing(station, bearing, 8, 15);
      // and clear of the launch pad, which is picked before these
      if (station.skyPad && Math.hypot(spot.x - station.skyPad.x, spot.z - station.skyPad.z) < 3) {
        spot = findSpotOnBearing(station, bearing + 0.5, 9, 16);
      }
      const spawned = spawnDiamond(station, spot.x, spot.y, spot.z, 'teleport', i, ARC_GLOW_COLORS[i % ARC_GLOW_COLORS.length]);
      station.teleports.push({ obj: spawned.obj, mixer: spawned.mixer, x: spot.x, z: spot.z, arcIndex: i, title, locked: false });
    });
  }

  /* ============================================================
     4 ARC ROOMS — one existing environment file per arc
     NOTE: none of your 4 environment files is literally a desert — this is
     a placeholder pairing until you have (or want) a proper desert asset.
     ============================================================ */
  const arcRoomKeys = [];
  for (let i = 0; i < arcCount; i++) {
    const key = 'arc' + (i + 1);
    arcRoomKeys.push(key);
    const room = makeRoom(key, ARC_TITLES[i]);
    const gltf = arcGltfs[i];
    gltf.scene.updateMatrixWorld(true);
    mergeStaticByMaterial(gltf.scene);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = 26 / Math.max(size.x, size.z);
    gltf.scene.scale.setScalar(scale);
    gltf.scene.position.y = -box.min.y * scale;
    gltf.scene.updateMatrixWorld(true); // see the matching comment on the hub setup above
    tagWater(gltf.scene);
    room.group.add(gltf.scene);
    room.collidables.push(gltf.scene);
    room.spawn = { x: 0, z: 4 };

    // a "return to station" diamond in every arc room (reuses the same
    // loaded diamondGlb from the station room above — spawnDiamond() takes
    // care of the same correct-size + grounded + glowing treatment).
    // findGroundSpot near the room's own center instead of a blind (0,0,0)
    // — same off-ground risk as everything else if that exact point isn't
    // actually solid on a given arc environment.
    scatterMushrooms(room, 3, 11, 8);

    const homeSpot = findGroundSpot(room, 0, 6);
    const homeSpawned = spawnDiamond(room, homeSpot.x, homeSpot.y, homeSpot.z, 'teleport-home');
    room._homeTeleport = { obj: homeSpawned.obj, mixer: homeSpawned.mixer };

    // one "whole word" treasure per arc land — an occasional shortcut to
    // finding the current hunted word without spelling it letter by letter.
    // findGroundSpot instead of an unvalidated random angle/radius, same
    // floating-prop fix as everywhere else.
    {
      const tex = makeWordTreasureTexture('?');
      const treasure = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ map: tex, flatShading: true, emissive: 0xffdd88, emissiveIntensity: 0.3 }));
      const spot = findGroundSpot(room, 4, 10);
      treasure.position.set(spot.x, spot.y + 0.6, spot.z);
      treasure.userData.interactType = 'word-treasure';
      room.group.add(treasure);
      room.interactive.push(treasure);
      room.wordTreasure = { obj: treasure, x: spot.x, z: spot.z, y: spot.y, tex, found: false };
    }
  }

  /* ============================================================
     WORD HUNT — letters are scattered in the station's open background
     (never on the islands); each arc land instead holds one "find the
     whole word" treasure as an occasional shortcut. Both feed the same
     target word and the same slow group-respawn once it's completed.
     ============================================================ */
  function makeLetterTexture(letter, bg) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#3b2a1a';
    ctx.font = "700 74px 'Baloo 2', sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(letter.toUpperCase(), 64, 70);
    return new THREE.CanvasTexture(c);
  }
  function makeWordTreasureTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff0b8'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#c98a1f'; ctx.font = "700 64px 'Baloo 2', sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', 64, 68);
    return new THREE.CanvasTexture(c);
  }
  const LETTER_BG = ['#ffe1b8', '#cfe8ff', '#ffd7ea', '#ddf5cf', '#fff0b8', '#e6d9ff', '#c9f2ea', '#ffd9cf'];

  const wordHunt = { word: '', letters: [], respawnPending: false };
  function clearWordHunt() {
    wordHunt.letters.forEach((l) => (l.room || station).group.remove(l.obj));
    wordHunt.letters = [];
  }
  function progressMask() {
    return wordHunt.word.split('').map((ch, i) => (wordHunt.letters[i] && wordHunt.letters[i].found ? ch.toUpperCase() : '_')).join('');
  }
  async function startNewWordHunt() {
    const word = String((await getNextTargetWord()) || 'focci').toLowerCase().replace(/[^a-z]/g, '') || 'focci';
    clearWordHunt();
    wordHunt.word = word;
    wordHunt.respawnPending = false;
    /* Letters are spread over ALL the islands, not just the station — the
       arc lands had none at all, so there was nothing to find once you
       teleported. Every island is guaranteed at least one when the word is
       long enough to go round, and the rest fall where they fall. */
    const hostKeys = Object.keys(rooms);
    const hosts = [];
    for (let i = 0; i < word.length; i++) {
      hosts.push(i < hostKeys.length ? rooms[hostKeys[i]] : rooms[hostKeys[Math.floor(Math.random() * hostKeys.length)]]);
    }
    // shuffle, so the first letters are not always on the same island
    for (let i = hosts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const tmp = hosts[i]; hosts[i] = hosts[j]; hosts[j] = tmp; }
    for (let i = 0; i < word.length; i++) {
      const host = hosts[i];
      // Validated placement, like every other prop: a raw random point used
      // to drop letters past the island's edge, over open air.
      const spot = findGroundSpot(host, 3, 13);
      const tex = makeLetterTexture(word[i], LETTER_BG[i % LETTER_BG.length]);
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ map: tex, flatShading: true }));
      cube.position.set(spot.x, spot.y + 0.75, spot.z);
      cube.rotation.set(0.3, Math.random() * Math.PI, 0.1);
      cube.castShadow = true;
      cube.userData.interactType = 'letter';
      host.group.add(cube);
      host.interactive.push(cube);
      wordHunt.letters.push({ obj: cube, letter: word[i], found: false, phase: Math.random() * Math.PI * 2, room: host });
    }
    // refresh every arc room's treasure to point at the same hunt
    Object.values(rooms).forEach((r) => { if (r.wordTreasure) r.wordTreasure.found = false, (r.wordTreasure.obj.visible = true); });
    onLetterProgress(word, progressMask());
  }
  /* Picking things up by walking into them. Tapping a 0.45-unit mushroom on
     a phone, while the camera is orbiting and Focci is moving, was a fiddly
     shot to line up; now contact is enough and the tap handlers just call
     the same two functions. Both still fire spawnPickupBurst, so there is
     always a visible burst saying what was collected. */

  /* ============================================================
     RESIDENTS — the animals living on the island.

     Their whole state (energy, happiness, age, names) belongs to
     residents.js and localStorage; this only builds bodies for whatever is
     in that list and keeps them moving. Models are fetched the first time
     a species actually appears, not at boot — five animal GLBs is ~7MB and
     most players will have none of them for days.

     An animal that has run out of energy is never hurt and never leaves.
     It simply stops wandering and sits. That is the whole design: the
     island asks for care, it does not punish neglect.
     ============================================================ */
  const animalCache = new Map();
  async function animalModel(species) {
    const sp = (window.RES_SPECIES || {})[species];
    if (!sp) return null;
    if (animalCache.has(species)) return animalCache.get(species);
    const p = loadGLB(ASSET(sp.file)).catch(() => null);
    animalCache.set(species, p);
    return p;
  }

  /* The little three-pip bar that floats over each head. Drawn once per
     level rather than per frame — it only ever has three states. */
  const barTextures = {};
  function energyBarTexture(level) {
    if (barTextures[level]) return barTextures[level];
    const c = document.createElement('canvas');
    c.width = 96; c.height = 30;
    const g = c.getContext('2d');
    const colours = { 1: '#F0776A', 2: '#F0C35A', 3: '#7BE052' };
    g.fillStyle = 'rgba(8,26,28,.72)';
    g.beginPath(); g.roundRect(0, 0, 96, 30, 11); g.fill();
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i < level ? colours[level] : 'rgba(255,255,255,.16)';
      g.beginPath(); g.roundRect(8 + i * 28, 9, 22, 12, 4); g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    barTextures[level] = tex;
    return tex;
  }

  async function buildResident(room, rec) {
    const gltf = await animalModel(rec.species);
    if (!gltf) return null;
    const obj = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    // normalise to a 1-unit creature, then apply the species' own adult
    // size and how grown this individual is
    const base = 1 / Math.max(size.x, size.y, size.z, 0.0001);
    const scale = base * (window.resScale ? window.resScale(rec) : 0.8);
    obj.scale.setScalar(scale);
    const spot = findFlatGroundSpot(room, 4, 12, 0.9, 30);
    const footOffset = box.min.y * scale;
    obj.position.set(spot.x, spot.y - footOffset, spot.z);
    obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    room.group.add(obj);

    const mixer = gltf.animations && gltf.animations.length ? new THREE.AnimationMixer(obj) : null;
    if (mixer) mixer.clipAction(gltf.animations[0]).play();

    const lvl = window.resLevel ? window.resLevel(rec) : 3;
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: energyBarTexture(lvl), transparent: true, depthWrite: false, depthTest: false }));
    const headY = (box.max.y - box.min.y) * scale;
    bar.scale.set(1.15, 0.36, 1);
    bar.position.set(spot.x, spot.y + headY + 0.5, spot.z);
    room.group.add(bar);

    const hit = addInvisibleHitbox(room, spot.x, spot.y + headY * 0.5, spot.z, Math.max(0.6, headY * 0.6), 'resident');
    hit.userData.residentId = rec.id;

    const body = {
      id: rec.id, obj, bar, hit, mixer, footOffset, headY,
      homeX: spot.x, homeZ: spot.z, level: lvl,
      target: null, cooldown: 2 + Math.random() * 6
    };
    room.residents.push(body);
    return body;
  }

  async function syncResidents(room) {
    if (!window.resLoad) return;
    const recs = window.resTick ? window.resTick() : window.resLoad();
    room.residents = room.residents || [];
    const known = new Set(room.residents.map((b) => b.id));
    for (const rec of recs) {
      if (known.has(rec.id)) continue;
      await buildResident(room, rec);
    }
  }

  function tickResidents(room, dt, t) {
    if (!room.residents || !room.residents.length) return;
    const recs = window.resLoad ? window.resLoad() : [];
    const byId = {};
    recs.forEach((r) => { byId[r.id] = r; });
    for (const b of room.residents) {
      const rec = byId[b.id];
      if (!rec) continue;
      if (b.mixer) b.mixer.update(dt);

      const lvl = window.resLevel ? window.resLevel(rec) : 3;
      if (lvl !== b.level) { b.level = lvl; b.bar.material.map = energyBarTexture(lvl); b.bar.material.needsUpdate = true; }

      /* Out of energy: it stays put. Not asleep, not dying — just quiet,
         and it picks straight back up the moment it is fed. */
      const lively = rec.energy >= 34;
      if (lively) {
        if (b.target) {
          const dx = b.target.x - b.obj.position.x, dz = b.target.z - b.obj.position.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.25) {
            const sp = 1.5 + (rec.happiness / 100) * 0.9;
            b.obj.position.x += (dx / d) * sp * dt;
            b.obj.position.z += (dz / d) * sp * dt;
            b.obj.rotation.y = Math.atan2(dx, dz);
            const surf = surfaceYIn(room, b.obj.position.x, b.obj.position.z, GROUND_CEIL);
            if (surf.hit && !surf.building) b.obj.position.y = surf.y - b.footOffset;
          } else { b.target = null; b.cooldown = 3 + Math.random() * 7; }
        } else {
          b.cooldown -= dt;
          if (b.cooldown <= 0) {
            for (let k = 0; k < 10; k++) {
              const cx = b.homeX + (Math.random() - 0.5) * 9, cz = b.homeZ + (Math.random() - 0.5) * 9;
              const su = surfaceYIn(room, cx, cz, GROUND_CEIL);
              if (su.hit && !su.water && !su.building) { b.target = { x: cx, z: cz }; break; }
            }
            b.cooldown = 4 + Math.random() * 6;
          }
        }
      }
      // a small idle bob only while it has the energy for it
      const bob = lively ? Math.abs(Math.sin(t * 2 + b.homeX)) * 0.04 : 0;
      b.bar.position.set(b.obj.position.x, b.obj.position.y + b.headY + 0.5 + bob, b.obj.position.z);
      if (b.hit) b.hit.position.set(b.obj.position.x, b.obj.position.y + b.headY * 0.5, b.obj.position.z);
    }
  }

  const PICKUP_REACH = 1.15;
  /* Collecting a mushroom, shared by the walk-over check and the tap
     handler so both paths give the same burst and the same XP. */
  function collectMushroom(room, m) {
    if (!m || m.found) return;
    m.found = true;
    if (m.hitbox) m.hitbox.visible = false;
    m.obj.visible = false;
    spawnPickupBurst(room, m.x, m.obj.position.y, m.z, 0xFF8A5C);
    onWordFound({ type: 'mushroom-exp' });
    maybeScheduleRespawn(room.mushrooms);
  }
  function checkWalkOverPickups(room) {
    const cx = charState.x, cz = charState.z;
    let got = false;
    if (room.mushrooms) {
      for (const m of room.mushrooms) {
        if (m.found) continue;
        if (Math.hypot(m.x - cx, m.z - cz) < PICKUP_REACH) { collectMushroom(room, m); got = true; }
      }
    }
    {
      for (const l of wordHunt.letters) {
        if (l.found || l.room !== room) continue;
        if (Math.hypot(l.obj.position.x - cx, l.obj.position.z - cz) < PICKUP_REACH + 0.2) { collectLetter(l); got = true; }
      }
    }
    if (got) focciReact();
    /* Doorways. Inside is a state: the hut's own meshes fade so Focci is
       visible through them and its lamp comes up. */
    if (room.houses && room.houses.length) {
      let anyInside = false;
      for (const h of room.houses) {
        const near = Math.hypot(h.x - cx, h.z - cz) < 1.3 || Math.hypot(h.cx - cx, h.cz - cz) < 2.6;
        if (near) anyInside = true;
        if (near !== h.inside) {
          h.inside = near;
          if (near) root.dispatchEvent(new CustomEvent('focci-quote', { detail: { message: 'Warm in here. Someone keeps this place tidy.', kind: 'reaction' } }));
        }
        h.lamp.intensity += ((near ? 2.2 : 0) - h.lamp.intensity) * 0.12;
      }
      if (anyInside !== room._inHouse) {
        room._inHouse = anyInside;
        // fade the walls and roofs as a group — they are merged by material
        room.collidables[0].traverse((o) => {
          if (!o.isMesh || !o.userData.isBuilding) return;
          o.material.transparent = true;
          o.userData._targetOpacity = anyInside ? 0.22 : 1;
        });
      }
      room.collidables[0].traverse((o) => {
        if (!o.isMesh || o.userData._targetOpacity === undefined) return;
        o.material.opacity += (o.userData._targetOpacity - o.material.opacity) * 0.14;
      });
    }
    /* Standing on the cap lifts you. Checked here, once a frame, with a
       height test as well as a distance one so walking past the hut at
       ground level does nothing. */
    if (room === station && room.skyPad && room.sky && !flight && !pendingTravel) {
      const p = room.skyPad;
      if (Math.hypot(p.x - cx, p.z - cz) < 2 && Math.abs(character.position.y - p.y) < 2) {
        askTravel('sky', 'Zen Island',
          'Would you like to visit Zen Island and meet the prophetic spirit of the wisdom trees?',
          'Take Me There', () => {
            const g = room.sky.gate;
            flyTo(room, { x: g.x, y: g.y + 0.2, z: g.z + 3.2 }, () => {
              root.dispatchEvent(new CustomEvent('focci-quote', { detail: { message: 'The gate lets Focci through. Everything up here smells of blossom.', kind: 'reaction' } }));
            });
          });
      }
    }
    /* Same for the four diamonds: step in, get asked, decide. */
    if (room.teleports && room.teleports.length && !flight && !pendingTravel) {
      for (const tp of room.teleports) {
        if (Math.hypot(tp.x - cx, tp.z - cz) > 1.8) continue;
        askTravel('arc', tp.title || 'Another land',
          'A gateway hums here. Travel to ' + (tp.title || 'another land') + '?',
          'Yes, take me', () => { enterRoom(arcRoomKeys[tp.arcIndex]); onOpenArc(tp.arcIndex, ARC_TITLES[tp.arcIndex]); });
        break;
      }
    }
  }
  function collectLetter(l) {
    if (l.found) return;
    l.found = true; l.obj.visible = false;
    spawnPickupBurst(l.room || station, l.obj.position.x, l.obj.position.y, l.obj.position.z, 0xFFD54A);
    onLetterProgress(wordHunt.word, progressMask());
    if (wordHunt.letters.every((x) => x.found)) completeWordHunt();
  }
  function completeWordHunt() {
    onWordComplete(wordHunt.word);
    if (wordHunt.respawnPending) return;
    wordHunt.respawnPending = true;
    setTimeout(startNewWordHunt, RESPAWN_DELAY_MS);
  }
  function collectTreasure(room) {
    const tr = room.wordTreasure;
    if (!tr || tr.found) return;
    tr.found = true; tr.obj.visible = false;
    wordHunt.letters.forEach((l) => { if (!l.found) { l.found = true; l.obj.visible = false; } });
    onLetterProgress(wordHunt.word, progressMask());
    completeWordHunt();
  }
  await startNewWordHunt();
  await syncResidents(station);
  // a new companion can arrive at any moment the streak completes
  document.addEventListener('focci-resident-new', () => { syncResidents(station); });

  function playDoeClip(doe, name, loop) {
    const clip = doe.clips[name];
    if (!clip) return;
    if (doe.current) doe.current.fadeOut(0.4);
    const action = doe.mixer.clipAction(clip);
    action.reset().fadeIn(0.4).play();
    if (!loop) action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = !loop;
    doe.current = action;
    doe.state = name;
  }

  /* ============================================================
     CHARACTER (Focci) — same verified vest/movement/camera system
     ============================================================ */
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xff7a1f, flatShading: true, roughness: 0.7 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xfff3df, flatShading: true, roughness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a1c10, flatShading: true, roughness: 0.7 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xf23c2e, flatShading: true, roughness: 0.7 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x1f8f2a, flatShading: true, roughness: 0.7 });
  const pocketMat = new THREE.MeshStandardMaterial({ color: 0x145c1c, flatShading: true, roughness: 0.7 });

  /* ---------- camera state (declared early: enterRoom() below needs it) ---------- */
  const DEFAULT_CAM = { theta: 0.7, phi: 1.05, radius: 14 };
  const cam = { theta: 0.7, phi: 1.05, radius: 14, tTheta: 0.7, tPhi: 1.05, tRadius: 14 };
  // Old cap (36) couldn't back far enough off the hub to see or rotate the
  // whole island once it went from 34 to 51 units across — raised so
  // pinch/wheel zoom-out actually reaches a full-island view on its own,
  // and overviewCamera() (an explicit "see the whole island" jump) has
  // real room to zoom out to.
  /* 60 still framed the island nearly edge to edge with no sky around it
     and the moon well outside the view. */
  const MAX_ZOOM = 150;
  /* Turning the island with one finger used to switch on automatically
     past 30 units of zoom. That silently took walking away: pull the camera
     back to look around and Focci simply stopped responding, with nothing
     on screen to say why. It is an explicit mode now — the overview button
     turns it on, and the first tap anywhere turns it off again. */
  let inspectMode = false;   // past this, a one-finger drag turns the island
  function overviewCamera() {
    setCamMode('orbit');
    inspectMode = true;
    // phi is measured from straight up, so a SMALLER value lifts the camera.
    // 0.72 puts it ~48 degrees above the island: high enough to take the
    // whole thing in, shallow enough that the relief still reads.
    cam.tPhi = 0.72; cam.tRadius = 96;   // room left to pinch further out by hand
  }

  /* Focci, exactly as he was — plain boxes, same sizes, same positions —
     with two arms added and nothing else touched. Two earlier passes went
     further than asked (a full sphere-and-capsule rebuild, then a rounded
     -box bevel) and both were rejected; the brief is only the arms.

     The arms hang inside Groups pivoted at the shoulder so they swing from
     there rather than spinning about their own middle, and they swing
     opposite their own side's front leg in the walk cycle below. */
  const character = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.42), orangeMat); body.position.y = 0.5; character.add(body);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.67, 0.36, 0.46), vestMat); vest.position.y = 0.56; character.add(vest);
  const pocketL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.05), pocketMat); pocketL.position.set(-0.17, 0.48, 0.25); character.add(pocketL);
  const pocketR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.05), pocketMat); pocketR.position.set(0.17, 0.48, 0.25); character.add(pocketR);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06), creamMat); belly.position.set(0, 0.33, 0.22); character.add(belly);
  const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.48), redMat); scarf.position.y = 0.8; character.add(scarf);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.42), orangeMat); head.position.y = 1.08; character.add(head);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.22), creamMat); muzzle.position.set(0, 1.0, 0.3); character.add(muzzle);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.06), darkMat); nose.position.set(0, 1.02, 0.42); character.add(nose);
  [-0.13, 0.13].forEach((dxv) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), darkMat); eye.position.set(dxv, 1.14, 0.32); character.add(eye);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 4), orangeMat); ear.position.set(dxv * 1.55, 1.42, -0.02); ear.rotation.y = Math.PI / 4; character.add(ear);
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.5), orangeMat); tail.position.set(0, 0.55, -0.38); tail.rotation.x = 0.4; character.add(tail);
  const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.16), creamMat); tailTip.position.set(0, 0.68, -0.6); character.add(tailTip);
  /* TWO legs, centred — adding arms to the original four left him with six
     limbs. The front pair is gone and the back pair moved to z 0, so he
     stands on two feet under the middle of his body. */
  const legGeo = new THREE.BoxGeometry(0.16, 0.26, 0.16);
  const legL = new THREE.Mesh(legGeo, darkMat); legL.position.set(-0.17, 0.13, 0); character.add(legL);
  const legR = new THREE.Mesh(legGeo, darkMat); legR.position.set(0.17, 0.13, 0); character.add(legR);

  // Arms, on shoulder pivots so they swing from the shoulder. The hands are
  // darkMat — the same brown as the feet.
  const armGeo = new THREE.BoxGeometry(0.13, 0.22, 0.14);
  const handGeo = new THREE.BoxGeometry(0.15, 0.1, 0.16);
  const makeArm = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.66, 0.02);
    const m = new THREE.Mesh(armGeo, orangeMat); m.position.y = -0.11; pivot.add(m);
    const hand = new THREE.Mesh(handGeo, darkMat); hand.position.y = -0.26; pivot.add(hand);
    character.add(pivot);
    return pivot;
  };
  const armL = makeArm(-0.37);
  const armR = makeArm(0.37);

  scene.add(character);
  character.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const charState = { x: 0, z: 0, angle: 0, walkT: 0, inWater: false, jumpY: 0, vy: 0 };
  const JUMP_V = 5.0, GRAVITY = 14;
  /* Flying to and from the sky island. While a flight is running the normal
     ground-following is skipped entirely and Focci is driven along an arc,
     because there is nothing under him to follow for most of the trip. */
  let flight = null;
  function flyTo(room, to, onArrive) {
    if (flight) return;
    flight = {
      from: new THREE.Vector3(charState.x, character.position.y, charState.z),
      to: new THREE.Vector3(to.x, to.y, to.z),
      t: 0, dur: 2.2, onArrive: onArrive || null, sparkle: 0
    };
    charState.jumpY = 0; charState.vy = 0;
    moveVec.x = 0; moveVec.y = 0;
    spawnPickupBurst(room, charState.x, character.position.y + 0.4, charState.z, 0xFF9ED2);
  }
  function startJump(room) {
    if (charState.jumpY > 0.001 || charState.inWater) return;
    charState.vy = JUMP_V;
    spawnPickupBurst(room, charState.x, character.position.y + 0.05, charState.z, 0xFFE9A8);
  }
  function activeRoom() { return rooms[currentRoomKey]; }
  function enterRoom(key, spawnOverride) {
    Object.values(rooms).forEach((r) => { r.group.visible = false; });
    currentRoomKey = key;
    const r = rooms[key];
    r.group.visible = true;
    const sp = spawnOverride || r.spawn;
    charState.x = sp.x; charState.z = sp.z;
    cam.tTheta = DEFAULT_CAM.theta; cam.tPhi = DEFAULT_CAM.phi; cam.tRadius = DEFAULT_CAM.radius;
  }
  enterRoom('station');

  function lerpAngle(a, b, t) {
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  /* ---------- camera ---------- */
  /* A held close-up while the tree speaks. The rig always orbits Focci, so
     putting the camera at his own facing angle (theta = charState.angle)
     puts it in FRONT of him — we see his face, not the back of his head —
     and a low phi with a short radius brings it down to eye level. The
     previous "effect" was a half-second glow bump with the camera left
     wherever it was, which is why the moment didn't land. */
  /* Nothing teleports on contact any more. Walking into a portal raises a
     question and waits for an answer — accidentally brushing past a
     diamond used to fling you to another land with no warning. */
  let pendingTravel = null;
  function askTravel(kind, title, body, confirmLabel, run) {
    if (pendingTravel || flight) return;
    pendingTravel = { run };
    root.dispatchEvent(new CustomEvent('focci-ask', {
      detail: { kind, title, body, confirm: confirmLabel, cancel: 'Not now' }
    }));
  }
  window.__fwAnswer = function (yes) {
    const p = pendingTravel; pendingTravel = null;
    if (yes && p && p.run) p.run();
  };

  let camCinematic = null;
  /* Two ways to look at the world, toggled by a double-tap on empty ground
     (see handleTap): the usual third-person orbit, and Focci's own eyes.
     First person hides the character model — otherwise you are staring at
     the inside of his head — and reuses cam.theta as the look direction so
     dragging to walk still sends him where the view is pointing. */
  let camMode = 'orbit';
  function setCamMode(m) {
    camMode = m;
    inspectMode = false;        // either view is for walking, not inspecting
    character.visible = (m !== 'fpv');
    if (m === 'fpv') { cam.tPhi = 1.45; cam.tRadius = 7; }
    else { cam.tPhi = 1.05; cam.tRadius = 14; }
  }
  function toggleCamMode() {
    setCamMode(camMode === 'fpv' ? 'orbit' : 'fpv');
    return camMode;
  }
  function focusOnFocci(ms) {
    if (camCinematic) clearTimeout(camCinematic.timer);
    const saved = camCinematic ? camCinematic.saved
      : { theta: cam.tTheta, phi: cam.tPhi, radius: cam.tRadius };
    cam.tTheta = charState.angle;
    cam.tPhi = 1.36;
    cam.tRadius = 4.1;
    camCinematic = {
      saved,
      timer: setTimeout(() => {
        cam.tTheta = saved.theta; cam.tPhi = saved.phi; cam.tRadius = saved.radius;
        camCinematic = null;
      }, ms)
    };
  }
  function updateCamera() {
    cam.theta += (cam.tTheta - cam.theta) * 0.15;
    cam.phi += (cam.tPhi - cam.phi) * 0.15;
    cam.radius += (cam.tRadius - cam.radius) * 0.15;
    if (camMode === 'fpv') {
      // Sat at Focci's eye line, looking the way he walks. "Forward" is
      // -sin/-cos of cam.theta, the same vector the movement code uses, so
      // the view and the controls can never disagree.
      /* Nudged forward along the view direction and given a walk bob.
         Sitting exactly on charState put the camera inside Focci's own
         collision volume at the near plane, so the screen filled with a
         flat colour and it looked as though nothing moved at all. */
      const eyeY = character.position.y + 1.18 + (Math.sin(charState.walkT * 2) * 0.035);
      const fx = -Math.sin(cam.theta), fz = -Math.cos(cam.theta);
      camera.position.set(charState.x + fx * 0.32, eyeY, charState.z + fz * 0.32);
      // Barely tilted down (~3 degrees over 8 units). At -0.9 the gaze ran
      // into the ground on any slope and the screen filled with dirt.
      camera.lookAt(charState.x + fx * 8, eyeY - 0.4, charState.z + fz * 8);
      return;
    }
    const sinPhi = Math.sin(cam.phi);
    const cx = charState.x + cam.radius * sinPhi * Math.sin(cam.theta);
    const cz = charState.z + cam.radius * sinPhi * Math.cos(cam.theta);
    const cy = character.position.y + cam.radius * Math.cos(cam.phi);
    camera.position.set(cx, cy + 1.1, cz);
    camera.lookAt(charState.x, character.position.y + 1.0, charState.z);
  }

  /* ---------- one-finger walk (drag from press point), two-finger look+zoom ---------- */
  const pointers = new Map();
  let moveOrigin = null, moveVec = { x: 0, y: 0 }, singleId = null;
  let lastOrbitMid = null, lastPinch = null, downTime = 0, downPos = null;
  function pinchDist() { const p = Array.from(pointers.values()); return p.length < 2 ? null : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
  /* A full-screen panel (Games, Saved, Settings...) sits on top of the
     canvas, but a pointer that lands on the canvas captures itself and
     keeps steering Focci from underneath. Gate every gesture on the
     overlay being closed, and drop any gesture still in flight when one
     opens. */
  function overlayOpen() {
    if (document.hidden) return true;                       // tab in the background
    var ov = document.getElementById('fw-overlay');
    if (ov && ov.style.display === 'none') return true;     // world not on screen at all
    if (document.documentElement.classList.contains('dict-open')) return true; // word entry
    return !!document.querySelector('.view.fw-panel.active'); // Games/Saved/Progress/Settings
  }
  function releaseGesture() {
    pointers.clear(); singleId = null; moveOrigin = null;
    moveVec.x = 0; moveVec.y = 0; lastPinch = null; lastOrbitMid = null;
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (overlayOpen()) return;
    // Touching the world always gives control straight back.
    if (camCinematic) { clearTimeout(camCinematic.timer); camCinematic = null; }
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { singleId = e.pointerId; moveOrigin = { x: e.clientX, y: e.clientY }; moveVec = { x: 0, y: 0 }; downTime = Date.now(); downPos = { x: e.clientX, y: e.clientY }; }
    else if (pointers.size >= 2) {
      singleId = null; moveOrigin = null; moveVec = { x: 0, y: 0 };
      const p = Array.from(pointers.values());
      lastOrbitMid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
      lastPinch = pinchDist();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (overlayOpen()) { releaseGesture(); return; }
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && singleId === e.pointerId && moveOrigin) {
      if (inspectMode) {
        moveVec.x = 0; moveVec.y = 0;
        const last = pointers.get(e.pointerId) || moveOrigin;
        cam.tTheta -= (e.clientX - moveOrigin.x) * 0.0006;
        cam.tPhi = Math.min(1.45, Math.max(0.25, cam.tPhi - (e.clientY - moveOrigin.y) * 0.0004));
        return;
      }
      const dx = e.clientX - moveOrigin.x, dy = e.clientY - moveOrigin.y;
      const dist = Math.hypot(dx, dy), MAXD = 58;
      if (dist > 5) { const m = Math.min(1, dist / MAXD); moveVec.x = (dx / dist) * m; moveVec.y = (dy / dist) * m; }
      else { moveVec.x = 0; moveVec.y = 0; }
    } else if (pointers.size >= 2) {
      const p = Array.from(pointers.values());
      const mid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
      if (lastOrbitMid) { cam.tTheta -= (mid.x - lastOrbitMid.x) * 0.006; cam.tPhi = Math.min(1.5, Math.max(0.32, cam.tPhi - (mid.y - lastOrbitMid.y) * 0.005)); }
      lastOrbitMid = mid;
      const d = pinchDist();
      if (lastPinch && d) cam.tRadius = Math.min(MAX_ZOOM, Math.max(6, cam.tRadius - (d - lastPinch) * 0.05));
      lastPinch = d;
    }
  });
  function endPointer(e) {
    if (e.pointerId === singleId && downPos) {
      const upDist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      const dyUp = downPos.y - e.clientY, dxAbs = Math.abs(e.clientX - downPos.x);
      const held = Date.now() - downTime;
      if (upDist < 10 && held < 320) handleTap(e.clientX, e.clientY);
      // A fast upward flick jumps. Held apart from the walk joystick by
      // speed, not direction: dragging up to walk forward is a sustained
      // press, this is a flick that is over in a quarter of a second.
      else if (held < 260 && dyUp > 55 && dxAbs < 70 && !inspectMode) startJump(activeRoom());
    }
    pointers.delete(e.pointerId);
    if (e.pointerId === singleId) { singleId = null; moveOrigin = null; moveVec = { x: 0, y: 0 }; }
    if (pointers.size < 2) { lastPinch = null; lastOrbitMid = null; }
    if (pointers.size === 1) { const id = pointers.keys().next().value; const p = pointers.get(id); singleId = id; moveOrigin = { x: p.x, y: p.y }; moveVec = { x: 0, y: 0 }; }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.tRadius = Math.min(MAX_ZOOM, Math.max(6, cam.tRadius + e.deltaY * 0.02)); }, { passive: false });

  const ndcVec = new THREE.Vector2();
  let lastEmptyTap = 0;
  function handleTap(clientX, clientY) {
    // Touching anything returns you to steering Focci.
    if (inspectMode) { inspectMode = false; root.dispatchEvent(new CustomEvent('focci-inspect', { detail: { on: false } })); }
    const rect = canvas.getBoundingClientRect();
    ndcVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndcVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndcVec, camera);
    const room = activeRoom();
    const hits = raycaster.intersectObjects(room.interactive, true);
    // No early return on an empty ray. That `if (!hits.length) return;` sat
    // ABOVE the double-tap branch below, so tapping open ground or sky —
    // the only place you would ever double-tap — bailed out before the
    // camera toggle could ever be reached. It never once fired.
    let root3d = hits.length ? hits[0].object : null;
    while (root3d && !root3d.userData.interactType && root3d.parent) root3d = root3d.parent;
    if (!root3d || !root3d.userData.interactType) {
      // Nothing interactive under the finger: a second tap here within
      // 320ms swaps the camera between the orbit view and Focci's own eyes.
      // Gating it on empty ground keeps taps on objects instant — no
      // double-tap delay to sit through before a chest or a letter reacts.
      const now = Date.now();
      if (now - lastEmptyTap < 320) {
        lastEmptyTap = 0;
        const m = toggleCamMode();
        root.dispatchEvent(new CustomEvent('focci-cammode', { detail: { mode: m } }));
      } else lastEmptyTap = now;
      return;
    }
    onInteract(root3d);
  }

  const RESPAWN_DELAY_MS = 90000; // deliberately slow — a "the grove quietly renews" beat, not an instant farm loop
  function maybeScheduleRespawn(list) {
    if (!list.length || list.some((it) => !it.found)) return;
    if (list._respawnPending) return;
    list._respawnPending = true;
    setTimeout(() => {
      list.forEach((it) => {
        it.found = false;
        it.obj.visible = true;
        if (it.hitbox) it.hitbox.visible = true;
        it.obj.rotation.y = Math.random() * Math.PI * 2;
      });
      list._respawnPending = false;
    }, RESPAWN_DELAY_MS);
  }

  function randomQuote() {
    return ANGEL_MESSAGES.length ? ANGEL_MESSAGES[Math.floor(Math.random() * ANGEL_MESSAGES.length)] : null;
  }
  // Short, light lines for tapping an ordinary object (letter/mushroom) —
  // the wisdom-tree quotes above are deliberately deep, life-advice-length
  // affirmations, wrong tone entirely for "picked up a letter cube".
  const TAP_REACTIONS = [
    "Ooh, found one!", "A little treasure!", "Focci wonders what this is for.",
    "Neat!", "Focci tucks it away carefully.", "One more piece of the puzzle.",
  ];
  // A separate, small pool for the moments the doe wanders off on its own —
  // framed as Focci noticing, since the speech bubble is Focci's, not a
  // second UI for the deer to "talk" through.
  const DOE_LINES = [
    "Off you go, then.", "She's exploring again.", "Focci watches her go.",
    "Careful out there.", "She never sits still for long.",
  ];
  function focciReact(pool) {
    const list = pool || TAP_REACTIONS;
    const message = list[Math.floor(Math.random() * list.length)];
    root.dispatchEvent(new CustomEvent('focci-quote', { detail: { message, kind: 'reaction' } }));
  }
  // Turns Focci to actually face a point (the wisdom tree, mainly) instead
  // of just popping a speech bubble while he's still looking wherever he
  // last walked — charState.angle is what the per-frame lerp in animate()
  // already rotates the character towards, so setting it once is enough;
  // it holds until the player moves again.
  function faceToward(x, z) {
    charState.angle = Math.atan2(x - charState.x, z - charState.z);
  }
  function onInteract(obj) {
    const room = activeRoom();
    const type = obj.userData.interactType;
    if (type === 'teleport') {
      // Every land is walkable any time now, regardless of story/arc
      // progress — the diamond used to check ARC_UNLOCKED and refuse to
      // teleport at all if the arc wasn't finished yet. Whether the story
      // text itself auto-opens still depends on real progress (that check
      // lives in the app's own onOpenArc handler, not here).
      const idx = obj.userData.targetArc;
      askTravel('arc', ARC_TITLES[idx],
        'A gateway hums here. Travel to ' + ARC_TITLES[idx] + '?',
        'Yes, take me', () => { enterRoom(arcRoomKeys[idx]); onOpenArc(idx, ARC_TITLES[idx]); });
    } else if (type === 'teleport-home') {
      enterRoom('station', station.spawn);
    } else if (type === 'resident') {
      // A tap is a handful of food and a word from them. The card with the
      // full story of the animal opens from the speech bubble.
      const id = obj.userData.residentId;
      const res = window.resFeed ? window.resFeed(id) : null;
      const rec = (window.resLoad ? window.resLoad() : []).find((r) => r.id === id);
      if (rec) {
        spawnPickupBurst(room, obj.position.x, obj.position.y, obj.position.z, res && res.ok ? 0x8CF0B0 : 0xFFC85C);
        root.dispatchEvent(new CustomEvent('focci-resident-tap', {
          detail: { id: id, name: rec.name, fed: !!(res && res.ok), reason: res ? res.reason : null }
        }));
      }
    } else if (type === 'sky-gate') {
      if (room.skyPad) {
        const p = room.skyPad;
        askTravel('home', 'Fox Island', 'Head back down to Fox Island?', 'Yes, take me home',
          () => flyTo(room, { x: p.x, y: p.y + 0.1, z: p.z + 1.2 }, null));
      }
    } else if (type === 'mushroom') {
      // obj here is the invisible hitbox (see addInvisibleHitbox), not the
      // visible mushroom itself.
      const m = room.mushrooms.find((m) => m.hitbox === obj);
      if (m) { collectMushroom(room, m); focciReact(); }
    } else if (type === 'letter') {
      const l = wordHunt.letters.find((l) => l.obj === obj);
      if (l) { collectLetter(l); focciReact(); }
    } else if (type === 'word-treasure') {
      collectTreasure(room);
    } else if (type === 'vine-tree') {
      // "Focci must focus on the wisdom tree" — turn to actually face it
      // and give its glow a pronounced boost, so this reads as a moment of
      // Focci listening to the tree, not just a text box popping up while
      // he's still facing wherever he last walked.
      const doe = room.doe;
      if (doe) { doe.calledHome = true; doe.wanderTarget = null; }
      if (room.vineTree) { faceToward(room.vineTree.x, room.vineTree.z); room.vineTree.listenBoost = 1; }
      focusOnFocci(7000);
      root.dispatchEvent(new CustomEvent('focci-wisdom-focus', { detail: { on: true } }));
      setTimeout(() => root.dispatchEvent(new CustomEvent('focci-wisdom-focus', { detail: { on: false } })), 7000);
      const q = randomQuote();
      root.dispatchEvent(new CustomEvent('focci-quote', { detail: q ? { ...q, kind: 'wisdom' } : null }));
    }
  }

  /* ============================================================
     SOUND — starts automatically; if the browser blocks autoplay
     (common without a prior tap), it unlocks on the first tap anywhere.
     ============================================================ */
  const TRACKS = ['ambient-lofi.mp3', 'calm-piano.mp3', 'feeling-content.mp3'];
  let trackIdx = 0;
  const bgm = new Audio(AUDIO(TRACKS[trackIdx]));
  bgm.loop = true; bgm.volume = 0.35;
  let soundOn = true;
  bgm.play().catch(function () {
    var unlock = function () { bgm.play().catch(function () {}); canvas.removeEventListener('pointerdown', unlock); };
    canvas.addEventListener('pointerdown', unlock);
  });
  function toggleSound() {
    soundOn = !soundOn;
    if (soundOn) bgm.play().catch(() => {}); else bgm.pause();
    return soundOn;
  }
  function nextTrack() {
    trackIdx = (trackIdx + 1) % TRACKS.length;
    bgm.src = AUDIO(TRACKS[trackIdx]);
    if (soundOn) bgm.play().catch(() => {});
    return TRACKS[trackIdx];
  }

  /* ============================================================
     ANIMATE
     ============================================================ */
  const clock = new THREE.Clock();
  const SPEED = 5.4;
  function tickDoe(room, doe, dt, t) {
    if (!doe) return;
    doe.mixer.update(dt);
    // Re-seat on the terrain every frame — see the placement comment above.
    const groundDoe = () => {
      const surf = surfaceYIn(room, doe.obj.position.x, doe.obj.position.z);
      // Never re-seat onto a building: crossing in front of a hut would
      // otherwise snap the doe up onto its roof for those few frames.
      if (surf.hit && !surf.building) doe.obj.position.y = surf.y - (doe.footOffset || 0);
    };
    if (doe.calledHome) {
      const dx = doe.homeX - doe.obj.position.x, dz = doe.homeZ - doe.obj.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) {
        doe.obj.position.x += (dx / d) * 2.4 * dt;
        doe.obj.position.z += (dz / d) * 2.4 * dt;
        doe.obj.rotation.y = Math.atan2(dx, dz);
        groundDoe();
        if (doe.state !== 'Dear_walk') playDoeClip(doe, 'Dear_walk', true);
      } else {
        doe.calledHome = false;
        playDoeClip(doe, 'Dear_look', true);
        doe.cooldown = 5;
      }
      return;
    }
    if (doe.wanderTarget) {
      const dx = doe.wanderTarget.x - doe.obj.position.x, dz = doe.wanderTarget.z - doe.obj.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) {
        doe.obj.position.x += (dx / d) * 2.2 * dt;
        doe.obj.position.z += (dz / d) * 2.2 * dt;
        doe.obj.rotation.y = Math.atan2(dx, dz);
        groundDoe();
        if (doe.state !== 'Dear_walk') playDoeClip(doe, 'Dear_walk', true);
      } else {
        doe.wanderTarget = null;
        playDoeClip(doe, 'Dear_idle', true);
        doe.cooldown = 10 + Math.random() * 10;
      }
      return;
    }
    doe.cooldown -= dt;
    if (doe.cooldown <= 0) {
      const roll = Math.random();
      // Was 35% wander / 65% idle-clip, and the idle pool weighted
      // 'Dear_shake' the same as everything else with no repeat-guard —
      // in practice it kept re-rolling the same head-shake clip back to
      // back, reading as "just shakes its head constantly" instead of a
      // living animal. Now mostly wanders around its home point (bigger
      // radius, a bit faster) like Focci does, and idle picks avoid
      // repeating whatever clip is already playing.
      if (roll < 0.65) {
        // Validated, not a blind random offset: an unchecked target could
        // sit on a roof or out over the water, and the doe would walk there.
        let wx = doe.homeX, wz = doe.homeZ;
        for (let k = 0; k < 12; k++) {
          const cx = doe.homeX + (Math.random() - 0.5) * 9, cz = doe.homeZ + (Math.random() - 0.5) * 9;
          const su = surfaceYIn(room, cx, cz, GROUND_CEIL);
          if (su.hit && !su.water && !su.building) { wx = cx; wz = cz; break; }
        }
        doe.wanderTarget = { x: wx, z: wz };
        if (Math.random() < 0.2) focciReact(DOE_LINES);
      } else {
        const idleClips = ['Dear_look', 'Dear_eat', 'Dear_idle', 'Dear_shake'].filter((c) => c !== doe.state);
        playDoeClip(doe, idleClips[Math.floor(Math.random() * idleClips.length)], true);
      }
      doe.cooldown = 8 + Math.random() * 8;
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    /* Nothing of this scene is visible while a full-screen panel covers
       it, so simulating and re-rendering it is pure battery burn — and
       on a phone it also steals frames from the panel's own scrolling.
       Park the loop instead: keep the rAF alive so it picks straight
       back up, but skip the work and reset the clock's delta so Focci
       doesn't lurch forward by the whole paused duration on resume. */
    if (overlayOpen()) { releaseGesture(); clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const room = activeRoom();
    for (let i = activeEffects.length - 1; i >= 0; i--) { if (!activeEffects[i](dt)) activeEffects.splice(i, 1); }

    if (flight) {
      flight.t += dt;
      const k = Math.min(1, flight.t / flight.dur);
      // ease-in-out, plus an arc that lifts well above both ends so it
      // reads as flying rather than sliding along a straight line
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const px = flight.from.x + (flight.to.x - flight.from.x) * e;
      const pz = flight.from.z + (flight.to.z - flight.from.z) * e;
      const base = flight.from.y + (flight.to.y - flight.from.y) * e;
      const lift = Math.sin(Math.PI * k) * 6;
      charState.x = px; charState.z = pz;
      character.position.set(px, base + lift, pz);
      character.rotation.y += dt * 2.4;                 // a slow spin on the way
      flight.sparkle -= dt;
      if (flight.sparkle <= 0) {
        flight.sparkle = 0.09;
        spawnPickupBurst(room, px, base + lift, pz, 0xFFC7E4);
      }
      if (k >= 1) {
        const cb = flight.onArrive; flight = null;
        charState.angle = character.rotation.y = 0;
        if (cb) cb();
      }
      updateCamera();
      renderer.render(scene, camera);
      return;
    }

    const fwdX = -Math.sin(cam.theta), fwdZ = -Math.cos(cam.theta);
    const rightX = Math.cos(cam.theta), rightZ = -Math.sin(cam.theta);
    const fwdAmt = -moveVec.y, rightAmt = moveVec.x;
    let moveX = fwdAmt * fwdX + rightAmt * rightX, moveZ = fwdAmt * fwdZ + rightAmt * rightZ;
    const mag = Math.hypot(moveX, moveZ);
    if (mag > 1) { moveX /= mag; moveZ /= mag; }

    if (mag > 0.04) {
      const speedMul = charState.inWater ? 0.55 : 1;
      charState.x += moveX * SPEED * speedMul * dt;
      charState.z += moveZ * SPEED * speedMul * dt;
      charState.angle = Math.atan2(moveX, moveZ);
      charState.walkT += dt * (charState.inWater ? 4.5 : 8.5);
    } else charState.walkT += dt * 2;
    character.rotation.y = lerpAngle(character.rotation.y, charState.angle, 0.2);

    const walking = mag > 0.04;
    /* Ceiling just above his head so he can step onto a hut roof without a
       probe from y 200 grabbing the sky island — but never BELOW
       GROUND_CEIL. A purely relative ceiling is a trap: Fox Island's ground
       sits as high as 29.7, so at spawn (y 0) a 2.5-unit ceiling found
       nothing at all and he was pinned under the island with no way back up.
       Taking the larger of the two keeps him on Fox Island anywhere on it,
       and once he is up on the sky lawn at y 52 his own height carries the
       ceiling with him. */
    const surf = surfaceYIn(room, charState.x, charState.z, Math.max(GROUND_CEIL, character.position.y + 2.5));
    charState.inWater = surf.water;
    const swing = (walking && !surf.water) ? Math.sin(charState.walkT) * 0.55 : 0;
    // Biped gait: each arm swings opposite the leg on its own side.
    legL.rotation.x = swing; legR.rotation.x = -swing;
    armL.rotation.x = -swing; armR.rotation.x = swing;
    const bob = surf.water ? Math.sin(t * 3) * 0.05 - 0.32 : (walking ? Math.abs(Math.sin(charState.walkT)) * 0.07 : Math.sin(t * 1.6) * 0.02);
    // Jump arc rides on top of whatever the terrain is doing underneath, so
    // he can leap off a slope and still land on it.
    if (charState.vy !== 0 || charState.jumpY > 0) {
      charState.vy -= GRAVITY * dt;
      charState.jumpY += charState.vy * dt;
      if (charState.jumpY <= 0) {
        charState.jumpY = 0; charState.vy = 0;
        spawnPickupBurst(room, charState.x, surf.y + 0.05, charState.z, 0xFFE9A8);
      }
    }
    // Tuck the legs and throw the arms up while airborne — without it the
    // jump reads as the whole model being slid upward.
    if (charState.jumpY > 0.02) {
      const k = Math.min(1, charState.jumpY / 1.2);
      legL.rotation.x = legR.rotation.x = -0.8 * k;
      armL.rotation.x = armR.rotation.x = -1.5 * k;
    }
    character.position.set(charState.x, surf.y + bob + charState.jumpY, charState.z);

    tickResidents(room, dt, t);
    checkWalkOverPickups(room);
    if (room.doe) tickDoe(room, room.doe, dt, t);
    if (room.pondMixer) room.pondMixer.update(dt);
    room.teleports.forEach((tp) => tp.mixer.update(dt));
    if (room._homeTeleport) room._homeTeleport.mixer.update(dt);
    room.mushrooms.forEach((m) => { if (!m.found) m.obj.rotation.y = t * 0.6; });
    wordHunt.letters.forEach((l) => { if (!l.found) { l.obj.rotation.y = t * 0.5 + l.phase; l.obj.position.y += Math.sin(t * 2 + l.phase) * 0.0006; } });
    if (room.wordTreasure && !room.wordTreasure.found) {
      room.wordTreasure.obj.rotation.y = t * 0.8;
      room.wordTreasure.obj.position.y = room.wordTreasure.y + 0.6 + Math.sin(t * 1.6) * 0.1;
    }
    if (room.houses) {
      for (const h of room.houses) {
        h.spark.material.opacity = 0.34 + Math.sin(t * 1.8 + h.x) * 0.16;
        h.ring.material.emissiveIntensity = 0.9 + Math.sin(t * 1.8 + h.x) * 0.3;
      }
    }
    if (room.skyPad && room.skyPad.glow) {
      room.skyPad.glow.material.opacity = 0.42 + Math.sin(t * 2.1) * 0.18;
      if (room.skyPad.beam) {
        room.skyPad.beam.material.opacity = 0.16 + Math.sin(t * 2.1) * 0.08;
        room.skyPad.beam.rotation.y = t * 0.5;
      }
    }
    if (room.sky && room.sky.halo) {
      room.sky.halo.material.opacity = 0.24 + Math.sin(t * 0.8) * 0.08;
    }
    if (room.vineTree && room.vineTree.glowSprite) {
      const pulse = 0.82 + Math.sin(t * 1.1) * 0.18;
      // listenBoost: a brief brighter/bigger glow while Focci is "listening"
      // right after tapping the tree (set in onInteract), decaying back to
      // the normal ambient pulse — makes the moment read as the tree
      // actually responding, not just a text box appearing out of nowhere.
      const boost = room.vineTree.listenBoost || 0;
      if (boost > 0) room.vineTree.listenBoost = Math.max(0, boost - dt / 2.2);
      room.vineTree.glowSprite.material.opacity = 0.65 + pulse * 0.25 + boost * 0.35;
      room.vineTree.glowSprite.scale.setScalar(6.4 + pulse * 1.2 + boost * 2.6);
      room.vineTree.glowLight.intensity = 1.1 + pulse * 0.6 + boost * 1.8;
    }
    if (room._birdMixer) {
      room._birdMixer.update(dt);
      const o = room._birdOrbit;
      room._birdRig.position.set(Math.cos(t * o.speed) * o.r, o.y + Math.sin(t * 0.4) * 1.2, Math.sin(t * o.speed) * o.r);
      room._birdRig.rotation.y = -t * o.speed + Math.PI / 2;
    }

    updateCamera();
    renderer.render(scene, camera);
  }

  resize();
  animate();





  return { toggleSound, nextTrack, enterRoom, arcRoomKeys, overviewCamera, get currentRoom() { return currentRoomKey; } };
  } catch (err) {
    // Surface the real error on-screen instead of a silent black canvas —
    // this is what to screenshot/read out if boot fails again.
    if (window.console) console.error('Focci World failed to boot:', err);
    var msg = document.createElement('div');
    msg.style.cssText = 'position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;'
      + 'padding:28px;color:#fff;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;text-align:center;'
      + 'background:#241a12;white-space:pre-wrap;';
    msg.textContent = 'Focci World failed to load:\n\n' + (err && err.message ? err.message : String(err))
      + '\n\nOpen your browser\'s console (or share a screenshot of this) to see exactly what broke.';
    var overlay = root.querySelector ? root.querySelector('#fw-overlay') : null;
    if (overlay) overlay.appendChild(msg);
    return { toggleSound: function () {}, nextTrack: function () {}, enterRoom: function () {}, arcRoomKeys: [], overviewCamera: function () {}, currentRoom: 'error' };
  }
}
