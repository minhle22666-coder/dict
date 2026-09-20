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
  const ARC_UNLOCKED = opts.arcUnlocked || ARC_TITLES.map(() => true); // default: open, until the real app tells us otherwise
  const onOpenArc = typeof opts.onOpenArc === 'function' ? opts.onOpenArc : function () {};
  const onArcLocked = typeof opts.onArcLocked === 'function' ? opts.onArcLocked : function () {};
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
  const hemi = new THREE.HemisphereLight(0xfff3e6, 0x6a8a63, 0.85);
  const sun = new THREE.DirectionalLight(0xfff2df, 0.85);
  sun.position.set(30, 45, 20);
  const ambient = new THREE.AmbientLight(0xffffff, 0.28);
  scene.add(hemi, sun, ambient);

  const DAY_SKY = new THREE.Color(0x5fbdea), NIGHT_SKY = new THREE.Color(0x0d1a3a);
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true }));
  const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 16), new THREE.MeshBasicMaterial({ color: 0xf3f6ff, transparent: true }));
  sunDisc.position.set(58, 52, -58);
  moonDisc.position.set(-58, 50, -50);
  scene.add(sunDisc, moonDisc);

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
    hemi.intensity = 0.5 + d * 0.35;
    sun.intensity = 0.4 + d * 0.55;
    ambient.intensity = 0.22 + d * 0.12;
    sunDisc.material.opacity = d;
    moonDisc.material.opacity = 1 - d;
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
    const room = { key, name, group, spawn: { x: 0, z: 0 }, collidables: [], interactive: [], doe: null, mushrooms: [], chests: [], teleports: [] };
    rooms[key] = room;
    return room;
  }

  function heightAtFallback(x, z) { return 0; }
  const raycaster = new THREE.Raycaster();
  const DOWN = new THREE.Vector3(0, -1, 0);
  function surfaceYIn(room, x, z) {
    for (const obj of room.collidables) {
      raycaster.set(new THREE.Vector3(x, 200, z), DOWN);
      const hits = raycaster.intersectObject(obj, true);
      if (hits.length) return { y: hits[0].point.y, water: !!(hits[0].object.userData && hits[0].object.userData.isWater) };
    }
    return { y: heightAtFallback(x, z), water: false };
  }

  function tagWater(root3d) {
    root3d.traverse((n) => {
      if (n.isMesh && n.material && n.material.transparent && n.material.color) {
        const c = n.material.color;
        if (c.b >= c.r && c.b >= c.g * 0.9) n.userData.isWater = true;
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

  function scatterClone(room, template, count, minR, maxR, scale, opts) {
    opts = opts || {};
    const placed = [];
    for (let i = 0; i < count; i++) {
      let x, z, tries = 0, ok = false;
      do {
        const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
        x = Math.cos(a) * r; z = Math.sin(a) * r;
        ok = room.collidables.length > 0; tries++;
      } while (!ok && tries < 30);
      const inst = template.clone(true);
      inst.scale.setScalar(scale * (0.85 + Math.random() * 0.3));
      inst.rotation.y = Math.random() * Math.PI * 2;
      const surf = surfaceYIn(room, x, z);
      if (opts.avoidWater && surf.water) { i--; continue; }
      inst.position.set(x, surf.y, z);
      room.group.add(inst);
      placed.push(inst);
    }
    return placed;
  }

  /* ============================================================
     STATION ROOM (hub) — built on the flying island you sent
     ============================================================ */
  const station = makeRoom('station', 'Station');
  {
    const hub = await loadGLB(ASSET('hub-island.glb'));
    hub.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(hub.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = 34 / Math.max(size.x, size.z); // keep the whole hub compact — no more tired legs
    hub.scene.scale.setScalar(scale);
    hub.scene.position.y = -box.min.y * scale;
    tagWater(hub.scene);
    station.group.add(hub.scene);
    station.collidables.push(hub.scene);
    station.spawn = { x: 0, z: box.getCenter(new THREE.Vector3()).z * scale * 0.15 };

    // decorate with the two vegetation kits you sent (real files, real scale)
    const forestKit = await loadGLB(ASSET('forest-kit.glb'));
    const forestProps = extractPropGroups(forestKit.scene);
    forestProps.forEach((p) => scatterClone(station, p, 3, 4, 15, 0.7, { avoidWater: true }));

    const bushKit = await loadGLB(ASSET('bush-kit.glb'));
    const bushProps = extractPropGroups(bushKit.scene);
    bushProps.forEach((p) => scatterClone(station, p, 3, 4, 15, 0.9, { avoidWater: true }));

    // mushrooms — 15 individual finds, tucked near bushes/rocks, never in water
    const mushGlb = await loadGLB(ASSET('mushrooms.glb'));
    const mushProps = extractPropGroups(mushGlb.scene);
    mushProps.forEach((p) => {
      let x, z, surf, tries = 0;
      do {
        const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 14;
        x = Math.cos(a) * r; z = Math.sin(a) * r;
        surf = surfaceYIn(station, x, z);
        tries++;
      } while (surf.water && tries < 20);
      const inst = p.clone(true);
      inst.scale.setScalar(0.35); // mushrooms were comically huge before — this is human(fox)-scale now
      inst.position.set(x, surf.y, z);
      inst.userData.interactType = 'mushroom';
      station.group.add(inst);
      station.interactive.push(inst);
      station.mushrooms.push({ obj: inst, x, z, found: false });
    });

    // 3 chests
    const chestGlb = await loadGLB(ASSET('chest.glb'));
    for (let i = 0; i < 3; i++) {
      const inst = chestGlb.scene.clone(true);
      const mixer = new THREE.AnimationMixer(inst);
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 12;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const surf = surfaceYIn(station, x, z);
      inst.scale.setScalar(0.55);
      inst.position.set(x, surf.y, z);
      inst.rotation.y = Math.random() * Math.PI * 2;
      inst.userData.interactType = 'chest';
      station.group.add(inst);
      station.interactive.push(inst);
      station.chests.push({ obj: inst, mixer, clips: chestGlb.animations, opened: false });
    }

    // birds — a small flying loop, purely decorative
    const birdGlb = await loadGLB(ASSET('birds.glb'));
    const birdMixer = new THREE.AnimationMixer(birdGlb.scene);
    if (birdGlb.animations[0]) birdMixer.clipAction(birdGlb.animations[0]).play();
    birdGlb.scene.scale.setScalar(0.4);
    birdGlb.scene.position.set(0, 14, 0);
    station.group.add(birdGlb.scene);
    station._birdMixer = birdMixer;
    station._birdOrbit = { r: 12, speed: 0.15, y: 14 };
    station._birdRig = birdGlb.scene;

    // vine tree + doe — placed on a flat mid-height ledge, NOT the summit
    const treeGlb = await loadGLB(ASSET('vine-tree.glb'));
    const treeBox = new THREE.Box3().setFromObject(treeGlb.scene);
    const treeScale = 6 / Math.max(treeBox.getSize(new THREE.Vector3()).x, treeBox.getSize(new THREE.Vector3()).z);
    treeGlb.scene.scale.setScalar(treeScale);
    const treePos = { x: -6, z: 5 }; // a mid-slope spot near the water, not the peak
    const treeSurf = surfaceYIn(station, treePos.x, treePos.z);
    treeGlb.scene.position.set(treePos.x, treeSurf.y - treeBox.min.y * treeScale, treePos.z);
    treeGlb.scene.userData.interactType = 'vine-tree';
    station.group.add(treeGlb.scene);
    station.interactive.push(treeGlb.scene);
    station.vineTree = { obj: treeGlb.scene, x: treePos.x, z: treePos.z };

    const doeGlb = await loadGLB(ASSET('doe.glb'));
    const doeMixer = new THREE.AnimationMixer(doeGlb.scene);
    const clipByName = {};
    doeGlb.animations.forEach((c) => { clipByName[c.name.split('|').pop()] = c; });
    doeGlb.scene.scale.setScalar(1.1);
    const doeSurf = surfaceYIn(station, treePos.x + 2.5, treePos.z + 1.5);
    doeGlb.scene.position.set(treePos.x + 2.5, doeSurf.y, treePos.z + 1.5);
    station.group.add(doeGlb.scene);
    station.doe = {
      obj: doeGlb.scene, mixer: doeMixer, clips: clipByName,
      homeX: treePos.x + 2.5, homeZ: treePos.z + 1.5,
      state: 'idle', cooldown: 6 + Math.random() * 6, current: null,
      wanderTarget: null, calledHome: false
    };
    playDoeClip(station.doe, 'Dear_idle', true);

    // 4 teleport diamonds -> the 4 arc worlds, spaced around the station
    const diamondGlb = await loadGLB(ASSET('teleport-diamond.glb'));
    const spots = [{ x: 12, z: -8 }, { x: -12, z: -9 }, { x: 10, z: 11 }, { x: -10, z: 12 }];
    ARC_TITLES.slice(0, 4).forEach((title, i) => {
      const p = spots[i];
      const d = diamondGlb.scene.clone(true);
      const mixer = new THREE.AnimationMixer(d);
      if (diamondGlb.animations[0]) mixer.clipAction(diamondGlb.animations[0]).play();
      d.scale.setScalar(1.4);
      const surf = surfaceYIn(station, p.x, p.z);
      d.position.set(p.x, surf.y, p.z);
      d.userData.interactType = 'teleport';
      d.userData.targetArc = i;
      if (!ARC_UNLOCKED[i]) {
        // dim + desaturate a locked land's diamond so it visibly reads as "not open yet"
        // without hiding it — Focci can still walk up to and tap it (per your instructions),
        // it just won't take him through.
        d.traverse((n) => {
          if (n.isMesh && n.material) {
            n.material = n.material.clone();
            n.material.color.lerp(new THREE.Color(0x888888), 0.6);
            n.material.transparent = true;
            n.material.opacity = 0.55;
          }
        });
        mixer.timeScale = 0.4;
      }
      station.group.add(d);
      station.interactive.push(d);
      station.teleports.push({ obj: d, mixer, x: p.x, z: p.z, arcIndex: i, title, locked: !ARC_UNLOCKED[i] });
    });
  }

  /* ============================================================
     4 ARC ROOMS — one existing environment file per arc
     NOTE: none of your 4 environment files is literally a desert — this is
     a placeholder pairing until you have (or want) a proper desert asset.
     ============================================================ */
  const ARC_ENV_FILES = ['island.glb', 'camp.glb', 'waterfall.glb', 'secretcamp.glb'];
  const arcRoomKeys = [];
  for (let i = 0; i < ARC_TITLES.length && i < 4; i++) {
    const key = 'arc' + (i + 1);
    arcRoomKeys.push(key);
    const room = makeRoom(key, ARC_TITLES[i]);
    const gltf = await loadGLB(ASSET(ARC_ENV_FILES[i]));
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = 26 / Math.max(size.x, size.z);
    gltf.scene.scale.setScalar(scale);
    gltf.scene.position.y = -box.min.y * scale;
    tagWater(gltf.scene);
    room.group.add(gltf.scene);
    room.collidables.push(gltf.scene);
    room.spawn = { x: 0, z: 4 };

    // a "return to station" diamond in every arc room
    const diamondGlb = await loadGLB(ASSET('teleport-diamond.glb'));
    const d = diamondGlb.scene.clone(true);
    const mixer = new THREE.AnimationMixer(d);
    if (diamondGlb.animations[0]) mixer.clipAction(diamondGlb.animations[0]).play();
    d.scale.setScalar(1.4);
    d.position.set(0, 0, 0);
    d.userData.interactType = 'teleport-home';
    room.group.add(d);
    room.interactive.push(d);
    room._homeTeleport = { obj: d, mixer };

    // one "whole word" treasure per arc land — an occasional shortcut to
    // finding the current hunted word without spelling it letter by letter
    {
      const tex = makeWordTreasureTexture('?');
      const treasure = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ map: tex, flatShading: true, emissive: 0xffdd88, emissiveIntensity: 0.3 }));
      const ang = Math.random() * Math.PI * 2, r = 4 + Math.random() * 6;
      const tx = Math.cos(ang) * r, tz = Math.sin(ang) * r;
      const surf = surfaceYIn(room, tx, tz);
      treasure.position.set(tx, surf.y + 0.6, tz);
      treasure.userData.interactType = 'word-treasure';
      room.group.add(treasure);
      room.interactive.push(treasure);
      room.wordTreasure = { obj: treasure, x: tx, z: tz, y: surf.y, tex, found: false };
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
    wordHunt.letters.forEach((l) => station.group.remove(l.obj));
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
    for (let i = 0; i < word.length; i++) {
      const ang = Math.random() * Math.PI * 2, r = 5 + Math.random() * 24;
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      const surf = surfaceYIn(station, x, z);
      const tex = makeLetterTexture(word[i], LETTER_BG[i % LETTER_BG.length]);
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ map: tex, flatShading: true }));
      cube.position.set(x, surf.y + 0.75, z);
      cube.rotation.set(0.3, Math.random() * Math.PI, 0.1);
      cube.userData.interactType = 'letter';
      station.group.add(cube);
      station.interactive.push(cube);
      wordHunt.letters.push({ obj: cube, letter: word[i], found: false, phase: Math.random() * Math.PI * 2 });
    }
    // refresh every arc room's treasure to point at the same hunt
    Object.values(rooms).forEach((r) => { if (r.wordTreasure) r.wordTreasure.found = false, (r.wordTreasure.obj.visible = true); });
    onLetterProgress(word, progressMask());
  }
  function collectLetter(l) {
    if (l.found) return;
    l.found = true; l.obj.visible = false;
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
  const legGeo = new THREE.BoxGeometry(0.16, 0.26, 0.16);
  const legFL = new THREE.Mesh(legGeo, darkMat); legFL.position.set(-0.18, 0.13, 0.14); character.add(legFL);
  const legFR = new THREE.Mesh(legGeo, darkMat); legFR.position.set(0.18, 0.13, 0.14); character.add(legFR);
  const legBL = new THREE.Mesh(legGeo, darkMat); legBL.position.set(-0.18, 0.13, -0.14); character.add(legBL);
  const legBR = new THREE.Mesh(legGeo, darkMat); legBR.position.set(0.18, 0.13, -0.14); character.add(legBR);
  scene.add(character);

  const charState = { x: 0, z: 0, angle: 0, walkT: 0, inWater: false };
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
  function updateCamera() {
    cam.theta += (cam.tTheta - cam.theta) * 0.15;
    cam.phi += (cam.tPhi - cam.phi) * 0.15;
    cam.radius += (cam.tRadius - cam.radius) * 0.15;
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
  canvas.addEventListener('pointerdown', (e) => {
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
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && singleId === e.pointerId && moveOrigin) {
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
      if (lastPinch && d) cam.tRadius = Math.min(36, Math.max(6, cam.tRadius - (d - lastPinch) * 0.05));
      lastPinch = d;
    }
  });
  function endPointer(e) {
    if (e.pointerId === singleId && downPos) {
      const upDist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (upDist < 10 && (Date.now() - downTime) < 320) handleTap(e.clientX, e.clientY);
    }
    pointers.delete(e.pointerId);
    if (e.pointerId === singleId) { singleId = null; moveOrigin = null; moveVec = { x: 0, y: 0 }; }
    if (pointers.size < 2) { lastPinch = null; lastOrbitMid = null; }
    if (pointers.size === 1) { const id = pointers.keys().next().value; const p = pointers.get(id); singleId = id; moveOrigin = { x: p.x, y: p.y }; moveVec = { x: 0, y: 0 }; }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.tRadius = Math.min(36, Math.max(6, cam.tRadius + e.deltaY * 0.02)); }, { passive: false });

  const ndcVec = new THREE.Vector2();
  function handleTap(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndcVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndcVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndcVec, camera);
    const hits = raycaster.intersectObjects(activeRoom().interactive, true);
    if (!hits.length) return;
    let root3d = hits[0].object;
    while (root3d && !root3d.userData.interactType && root3d.parent) root3d = root3d.parent;
    if (!root3d || !root3d.userData.interactType) return;
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
        it.obj.rotation.y = Math.random() * Math.PI * 2;
      });
      list._respawnPending = false;
    }, RESPAWN_DELAY_MS);
  }

  function onInteract(obj) {
    const room = activeRoom();
    const type = obj.userData.interactType;
    if (type === 'teleport') {
      const idx = obj.userData.targetArc;
      if (!ARC_UNLOCKED[idx]) { onArcLocked(idx, ARC_TITLES[idx]); return; }
      enterRoom(arcRoomKeys[idx]);
      onOpenArc(idx, ARC_TITLES[idx]);
    } else if (type === 'teleport-home') {
      enterRoom('station', station.spawn);
    } else if (type === 'chest') {
      const c = room.chests.find((c) => c.obj === obj);
      if (c && !c.opened) {
        c.opened = true;
        const openClip = c.clips.find((cl) => /open/i.test(cl.name));
        if (openClip) { const a = c.mixer.clipAction(openClip); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.reset().play(); }
        onOpenSayIt();
      }
    } else if (type === 'mushroom') {
      const m = room.mushrooms.find((m) => m.obj === obj);
      if (m && !m.found) {
        m.found = true; obj.visible = false;
        onWordFound({ type: 'mushroom-exp' });
        maybeScheduleRespawn(room.mushrooms);
      }
    } else if (type === 'letter') {
      const l = wordHunt.letters.find((l) => l.obj === obj);
      if (l) collectLetter(l);
    } else if (type === 'word-treasure') {
      collectTreasure(room);
    } else if (type === 'vine-tree') {
      const doe = room.doe;
      if (doe) { doe.calledHome = true; doe.wanderTarget = null; }
      const msg = ANGEL_MESSAGES.length ? ANGEL_MESSAGES[Math.floor(Math.random() * ANGEL_MESSAGES.length)] : null;
      root.dispatchEvent(new CustomEvent('focci-quote', { detail: msg }));
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
  function tickDoe(doe, dt, t) {
    if (!doe) return;
    doe.mixer.update(dt);
    if (doe.calledHome) {
      const dx = doe.homeX - doe.obj.position.x, dz = doe.homeZ - doe.obj.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) {
        doe.obj.position.x += (dx / d) * 2.4 * dt;
        doe.obj.position.z += (dz / d) * 2.4 * dt;
        doe.obj.rotation.y = Math.atan2(dx, dz);
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
        doe.obj.position.x += (dx / d) * 1.4 * dt;
        doe.obj.position.z += (dz / d) * 1.4 * dt;
        doe.obj.rotation.y = Math.atan2(dx, dz);
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
      if (roll < 0.35) {
        doe.wanderTarget = { x: doe.homeX + (Math.random() - 0.5) * 6, z: doe.homeZ + (Math.random() - 0.5) * 6 };
      } else {
        const idleClips = ['Dear_look', 'Dear_eat', 'Dear_shake', 'Dear_idle'];
        playDoeClip(doe, idleClips[Math.floor(Math.random() * idleClips.length)], true);
      }
      doe.cooldown = 14 + Math.random() * 12; // deliberately infrequent — not a flicker-fest
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const room = activeRoom();

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
    const surf = surfaceYIn(room, charState.x, charState.z);
    charState.inWater = surf.water;
    const swing = (walking && !surf.water) ? Math.sin(charState.walkT) * 0.55 : 0;
    legFL.rotation.x = swing; legBR.rotation.x = swing; legFR.rotation.x = -swing; legBL.rotation.x = -swing;
    const bob = surf.water ? Math.sin(t * 3) * 0.05 - 0.32 : (walking ? Math.abs(Math.sin(charState.walkT)) * 0.07 : Math.sin(t * 1.6) * 0.02);
    character.position.set(charState.x, surf.y + bob, charState.z);

    if (room.doe) tickDoe(room.doe, dt, t);
    room.chests.forEach((c) => c.mixer.update(dt));
    room.teleports.forEach((tp) => tp.mixer.update(dt));
    if (room._homeTeleport) room._homeTeleport.mixer.update(dt);
    room.mushrooms.forEach((m) => { if (!m.found) m.obj.rotation.y = t * 0.6; });
    wordHunt.letters.forEach((l) => { if (!l.found) { l.obj.rotation.y = t * 0.5 + l.phase; l.obj.position.y += Math.sin(t * 2 + l.phase) * 0.0006; } });
    if (room.wordTreasure && !room.wordTreasure.found) {
      room.wordTreasure.obj.rotation.y = t * 0.8;
      room.wordTreasure.obj.position.y = room.wordTreasure.y + 0.6 + Math.sin(t * 1.6) * 0.1;
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

  return { toggleSound, nextTrack, enterRoom, arcRoomKeys, get currentRoom() { return currentRoomKey; } };
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
    return { toggleSound: function () {}, nextTrack: function () {}, enterRoom: function () {}, arcRoomKeys: [], currentRoom: 'error' };
  }
}
