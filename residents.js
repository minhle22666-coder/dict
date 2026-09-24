/* ============================================================
   RESIDENTS — the animals who come to live on Fox Island.

   The point of this system is the opposite of a pet-care treadmill. An
   animal that goes hungry is never harmed and never leaves: it just stops
   playing and sits quietly until someone has something to give. Feeding
   costs XP that Focci earned that day, so caring for them is a choice
   about what to do with what you have, not a bill that arrives whether you
   like it or not.

   State lives in localStorage; the 3D bodies are built from it in
   world.js, which reads this file's window.* API and nothing else.
   ============================================================ */
(function () {
  'use strict';

  var RES_LS = 'fc_residents';
  var DAYW_LS = 'fc_daywords';      // { '2026-09-24': 12, ... } words learned per day
  var STREAK_LS = 'fc_res_streak';  // the last day an adoption was granted

  /* Real maturity ages, in days, from actual animal development — a rabbit
     is grown at about six months, a wolf takes two years. Size follows the
     same curve, from 55% of adult on arrival to full. Nothing here is a
     round number for the sake of it. */
  var SPECIES = {
    rabbit: { file: 'animal-rabbit.glb', label: 'Rabbit', adultDays: 180, adultSize: 0.55, born: 'kit' },
    duck:   { file: 'animal-duck.glb',   label: 'Duck',   adultDays: 120, adultSize: 0.6,  born: 'duckling' },
    cat:    { file: 'animal-cat.glb',    label: 'Cat',    adultDays: 365, adultSize: 0.7,  born: 'kitten' },
    sheep:  { file: 'animal-sheep.glb',  label: 'Sheep',  adultDays: 365, adultSize: 0.95, born: 'lamb' },
    wolf:   { file: 'animal-wolf.glb',   label: 'Wolf',   adultDays: 730, adultSize: 1.05, born: 'pup' }
  };
  var ORDER = ['rabbit', 'duck', 'sheep', 'cat', 'wolf'];

  /* Deep enough that bringing home a fourth rabbit still gets a name of
     its own. When even these run out, nameFor() builds one instead of
     falling back to "Pim2". */
  var NAMES = {
    rabbit: ['Pim', 'Clover', 'Muji', 'Nubbin', 'Sorrel', 'Pip', 'Hazel', 'Thistle', 'Biscuit', 'Fen'],
    duck:   ['Pebble', 'Marlow', 'Sprig', 'Quill', 'Reed', 'Puddle', 'Cobble', 'Wren', 'Skiff', 'Tern'],
    cat:    ['Sable', 'Miso', 'Juniper', 'Pockets', 'Olive', 'Mackerel', 'Tallow', 'Plum', 'Smoke', 'Fig'],
    sheep:  ['Bramble', 'Tuft', 'Marzi', 'Dandelion', 'Bobbin', 'Clove', 'Meadow', 'Nutmeg', 'Fleece', 'Pom'],
    wolf:   ['Ash', 'Corvin', 'Silje', 'Rune', 'Bracken', 'Vesper', 'Kol', 'Storm', 'Bran', 'Yarrow']
  };
  var SYL_A = ['Bar', 'Mos', 'Tan', 'Lin', 'Ros', 'Dun', 'Kel', 'Sil', 'Mor', 'Fal'];
  var SYL_B = ['ket', 'sel', 'ny', 'wen', 'dra', 'mir', 'lo', 'ven', 'ric', 'ta'];
  function nameFor(species, used) {
    var pool = NAMES[species] || ['Friend'];
    for (var i = 0; i < pool.length; i++) if (used.indexOf(pool[i]) < 0) return pool[i];
    for (var t = 0; t < 200; t++) {
      var n = SYL_A[Math.floor(Math.random() * SYL_A.length)] + SYL_B[Math.floor(Math.random() * SYL_B.length)];
      if (used.indexOf(n) < 0) return n;
    }
    return pool[0] + ' ' + (used.length + 1);
  }

  /* Every animal gets one of these, kept on the record, so a second cat is
     a different cat and not a copy with a new label. */
  var TRAITS = [
    'Sleeps in the sun and pretends not to hear you',
    'Follows Focci everywhere, three steps behind',
    'Terrified of the sea, fascinated by the sea',
    'Will not eat anything that is not offered by hand',
    'Hums, quietly, when it thinks nobody is near',
    'Collects small stones and hides them in the grass',
    'First one awake, every single morning',
    'Only relaxes once everyone else is indoors',
    'Steals the warm spot the moment you stand up',
    'Watches the sky island for hours without blinking'
  ];
  var LIKES = ['blossom petals', 'warm bread', 'the sound of rain', 'the far end of the beach',
    'lantern light', 'the pond fish', 'long grass', 'the shelf by the window'];

  var DAY = 86400000;
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dayBefore(n) { var d = new Date(Date.now() - n * DAY); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function readJSON(k, fallback) { try { var v = JSON.parse(localStorage.getItem(k)); return v || fallback; } catch (e) { return fallback; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------------- per-day word counts ---------------- */
  function resDayBump() {
    var m = readJSON(DAYW_LS, {});
    var k = today();
    m[k] = (m[k] || 0) + 1;
    // keep a fortnight; the streak test only ever looks at four days
    var keep = {};
    for (var i = 0; i < 14; i++) { var d = dayBefore(i); if (m[d] !== undefined) keep[d] = m[d]; }
    writeJSON(DAYW_LS, keep);
    resCheckAdoption();
  }

  /* Three days in a row where each day beat the one before it. Measured on
     yesterday and back, never on today — today is still being written, and
     a streak that could evaporate before midnight is not something to hand
     out a companion for. */
  function resRisingStreak() {
    var m = readJSON(DAYW_LS, {});
    var d = [1, 2, 3, 4].map(function (i) { return m[dayBefore(i)] || 0; });  // yesterday .. 4 days ago
    return d[0] > d[1] && d[1] > d[2] && d[2] > d[3] && d[0] > 0;
  }

  function resCheckAdoption() {
    if (!resRisingStreak()) return null;
    if (localStorage.getItem(STREAK_LS) === today()) return null;   // one per day, at most
    var list = resLoad();
    // work through the roster in order, so the island fills with variety
    var have = {};
    list.forEach(function (r) { have[r.species] = (have[r.species] || 0) + 1; });
    var pick = ORDER.find(function (s) { return !have[s]; }) || ORDER[list.length % ORDER.length];
    var r = resCreate(pick);
    localStorage.setItem(STREAK_LS, today());
    try { if (window.fwToast) window.fwToast(r.name + ' the ' + SPECIES[pick].label.toLowerCase() + ' has come to stay'); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('focci-resident-new', { detail: { id: r.id } })); } catch (e) {}
    return r;
  }

  /* ---------------- the residents themselves ---------------- */
  function resLoad() { return readJSON(RES_LS, []); }
  function resSave(list) { writeJSON(RES_LS, list); }

  function resCreate(species, opts) {
    opts = opts || {};
    var list = resLoad();
    var used = list.map(function (r) { return r.name; });
    var name = opts.name || nameFor(species, used);
    var r = {
      id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      species: species,
      name: name,
      adoptedAt: Date.now(),
      bornAt: opts.bornAt || Date.now(),      // a bought animal arrives already part-grown
      energy: 70,
      happiness: 60,
      lastTick: Date.now(),
      fedTotal: 0,
      parentOf: null,
      mateId: null,
      trait: opts.trait || TRAITS[Math.floor(Math.random() * TRAITS.length)],
      likes: opts.likes || LIKES[Math.floor(Math.random() * LIKES.length)],
      found: opts.found || null       // where Focci picked them up, if at sea
    };
    list.push(r);
    resSave(list);
    return r;
  }

  /* Energy drains slowly and never below zero. Nothing dies, nothing
     leaves — an empty bar only means the animal sits quietly. */
  var DRAIN_PER_DAY = 34;
  function resTick() {
    var list = resLoad(), now = Date.now(), changed = false;
    list.forEach(function (r) {
      var dt = now - (r.lastTick || now);
      if (dt < 60000) return;
      var lost = (dt / DAY) * DRAIN_PER_DAY;
      r.energy = Math.max(0, +(r.energy - lost).toFixed(2));
      // happiness follows energy, but lags — a good week carries them
      var target = r.energy > 66 ? 90 : r.energy > 33 ? 60 : 25;
      r.happiness = Math.max(0, Math.min(100, +(r.happiness + (target - r.happiness) * Math.min(1, dt / (DAY * 2))).toFixed(2)));
      r.lastTick = now;
      changed = true;
    });
    if (changed) resSave(list);
    return list;
  }

  var FEED_XP = 2, FEED_ENERGY = 7;
  function resFeed(id) {
    var list = resTick();
    var r = list.find(function (x) { return x.id === id; });
    if (!r) return { ok: false, reason: 'gone' };
    if (r.energy >= 100) return { ok: false, reason: 'full', resident: r };
    var xp = (window.getXP && window.getXP()) || 0;
    if (xp < FEED_XP) return { ok: false, reason: 'no-xp', resident: r };
    if (window.addXP) window.addXP(-FEED_XP);
    r.energy = Math.min(100, r.energy + FEED_ENERGY);
    r.happiness = Math.min(100, r.happiness + 2);
    r.fedTotal = (r.fedTotal || 0) + 1;
    r.lastTick = Date.now();
    resSave(list);
    return { ok: true, resident: r };
  }

  /* ---------------- derived facts ---------------- */
  function resAgeDays(r) { return Math.max(0, Math.floor((Date.now() - (r.bornAt || r.adoptedAt)) / DAY)); }
  function resGrowth(r) {
    var sp = SPECIES[r.species]; if (!sp) return 1;
    return Math.min(1, 0.55 + 0.45 * (resAgeDays(r) / sp.adultDays));
  }
  function resScale(r) {
    var sp = SPECIES[r.species]; if (!sp) return 1;
    return sp.adultSize * resGrowth(r);
  }
  function resIsAdult(r) { var sp = SPECIES[r.species]; return sp ? resAgeDays(r) >= sp.adultDays : true; }
  function resStage(r) {
    var g = resGrowth(r);
    if (g >= 1) return 'grown';
    if (g > 0.78) return 'nearly grown';
    return 'young';
  }
  function resMood(r) {
    if (r.energy <= 1) return 'empty';
    if (r.energy < 34) return 'tired';
    if (r.happiness > 75) return 'happy';
    return 'content';
  }
  function resLevel(r) { return r.energy < 34 ? 1 : r.energy < 67 ? 2 : 3; }

  /* ---------------- what they say ---------------- */
  var LINES = {
    empty: [
      "I'll just sit here a while. I don't mind.",
      'Everything feels heavy today. Sit with me?',
      "I'm not going anywhere. Take your time."
    ],
    tired: [
      'Bit of a slow day. Nothing a snack would not fix.',
      'I watched the water all morning. It was enough.',
      'I could nap in one of those huts, honestly.'
    ],
    content: [
      'The wind came from the blossom isle today.',
      'Focci, you smell like letters again.',
      'Someone left footprints by the pond. Not mine.'
    ],
    happy: [
      'I ran the whole edge of the island and back!',
      'Days like this I forget I was ever anywhere else.',
      'Thank you for the food. And for the company.'
    ]
  };
  function resLine(r) {
    var pool = LINES[resMood(r)] || LINES.content;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ---------------- the info card ---------------- */
  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return ''; }
  }
  function resInfoHtml(r) {
    var sp = SPECIES[r.species] || { label: r.species, adultDays: 365 };
    var age = resAgeDays(r);
    var lvl = resLevel(r);
    var mate = r.mateId ? resLoad().find(function (x) { return x.id === r.mateId; }) : null;
    var h = '';
    h += '<div class="rz-head"><div class="rz-name">' + esc(r.name) + '</div>'
       + '<div class="rz-species">' + esc(sp.label) + ' · ' + resStage(r) + '</div></div>';
    h += '<div class="rz-bar rz-l' + lvl + '"><i style="width:' + Math.round(r.energy) + '%"></i></div>';
    h += '<div class="rz-barlab"><span>Energy</span><b>' + Math.round(r.energy) + '%</b></div>';
    h += '<div class="rz-stats">'
       + '<div><span>Age</span><b>' + age + ' day' + (age === 1 ? '' : 's') + '</b></div>'
       + '<div><span>Grown at</span><b>' + sp.adultDays + ' days</b></div>'
       + '<div><span>Happiness</span><b>' + Math.round(r.happiness) + '%</b></div>'
       + '<div><span>Meals</span><b>' + (r.fedTotal || 0) + '</b></div>'
       + '<div><span>Adopted</span><b>' + fmtDate(r.adoptedAt) + '</b></div>'
       + '<div><span>Size</span><b>' + Math.round(resGrowth(r) * 100) + '%</b></div>'
       + '</div>';
    if (mate) h += '<div class="rz-pair">♥ Paired with ' + esc(mate.name) + '</div>';
    if (r.trait) h += '<div class="rz-trait">' + esc(r.trait) + '</div>';
    if (r.likes) h += '<div class="rz-likes">Loves <b>' + esc(r.likes) + '</b></div>';
    if (r.found) h += '<div class="rz-likes">Found ' + esc(r.found) + '</div>';
    h += '<div class="rz-note">' + esc(resLine(r)) + '</div>';
    h += '<button class="rz-feed" onclick="resFeedFromCard(\'' + r.id + '\')">Feed · ' + FEED_XP + ' XP</button>';
    return h;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  /* ---------------- the rescue board ----------------
     Focci is not shopping. Each of these is someone stranded with nowhere
     to go, and the XP is what it costs him to sail out and bring them
     back — provisions for the trip, not a price on a life. The roster is
     fixed per day so it feels like news from the water rather than a
     slot machine you can reroll. */
  var RESCUE_XP = { rabbit: 60, duck: 80, sheep: 120, cat: 160, wolf: 240 };
  var FOUND = {
    rabbit: 'under an upturned hull, two miles out',
    duck:   'circling the same patch of water at dawn',
    sheep:  'on a sandbar the tide was about to take',
    cat:    'on the end of a fishing jetty, refusing to come in',
    wolf:   'on a rock, watching the shore it could not reach'
  };
  var STORIES = {
    rabbit: 'Found sheltering under a hull, too small to be out there alone.',
    duck:   'Blown off the migration route and paddling in circles since.',
    sheep:  'Left behind when the flock was moved off the far shore.',
    cat:    'Has been living off a fishing jetty and trusts nobody yet.',
    wolf:   'Separated from the pack in a storm. Wary, but not unkind.'
  };
  function resRescueCost(species) { return RESCUE_XP[species] || 100; }

  /* One entry per species, all five, every day. The three-of-five version
     hid the expensive ones entirely, so there was nothing to save towards
     and no reason to come back. Everything you cannot afford yet is still
     on the board, locked, with what it would take.

     Seeded from the date so the same animals are out there all day: a
     board you can reroll by closing it is a slot machine, not news from
     the water. */
  function daySeed(extra) {
    var k = today() + (extra || '');
    var seed = 2166136261;
    for (var i = 0; i < k.length; i++) { seed ^= k.charCodeAt(i); seed = (seed * 16777619) >>> 0; }
    return function () { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  }
  function resRescueRoster() {
    var used = resLoad().map(function (r) { return r.name; });
    return ORDER.map(function (sp) {
      var rnd = daySeed(sp);
      var s2 = SPECIES[sp];
      var pool = NAMES[sp];
      var name = pool[Math.floor(rnd() * pool.length)];
      if (used.indexOf(name) >= 0) name = nameFor(sp, used);
      used.push(name);
      // old enough to have survived out there, young enough to still grow
      var ageDays = Math.floor(s2.adultDays * (0.14 + rnd() * 0.22));
      return {
        species: sp, label: s2.label, born: s2.born, name: name,
        story: STORIES[sp], found: FOUND[sp],
        trait: TRAITS[Math.floor(rnd() * TRAITS.length)],
        likes: LIKES[Math.floor(rnd() * LIKES.length)],
        cost: resRescueCost(sp), ageDays: ageDays, adultDays: s2.adultDays
      };
    });
  }

  /* The one who comes home is the one you were looking at on the board —
     same name, same age, same history. Buying a generic member of the
     species and renaming it afterwards would undo the whole point. */
  function resRescue(species) {
    var card = resRescueRoster().find(function (c) { return c.species === species; });
    if (!card) return { ok: false, reason: 'gone' };
    var xp = (window.getXP && window.getXP()) || 0;
    if (xp < card.cost) return { ok: false, reason: 'no-xp', cost: card.cost, have: xp };
    if (window.addXP) window.addXP(-card.cost);
    var rec = resCreate(species, {
      name: card.name,
      bornAt: Date.now() - card.ageDays * DAY,
      trait: card.trait, likes: card.likes, found: card.found
    });
    resPairUp();
    return { ok: true, resident: rec };
  }

  /* One partner each, for life. Two of a species pair up; a third of the
     same kind stays single rather than breaking a pair, and no pair ever
     takes a second partner. */
  function resPairUp() {
    var list = resLoad(), changed = false;
    var bySpecies = {};
    list.forEach(function (x) { (bySpecies[x.species] = bySpecies[x.species] || []).push(x); });
    Object.keys(bySpecies).forEach(function (sp) {
      var free = bySpecies[sp].filter(function (x) { return !x.mateId; });
      while (free.length >= 2) {
        var a = free.shift(), b = free.shift();
        a.mateId = b.id; b.mateId = a.id; changed = true;
      }
    });
    if (changed) resSave(list);
    return list;
  }

  window.resRescueRoster = resRescueRoster;
  window.resRescueCost = resRescueCost;
  window.resRescue = resRescue;
  window.resPairUp = resPairUp;

  /* ---------------- exports ---------------- */
  window.RES_SPECIES = SPECIES;
  window.resLoad = resLoad;
  window.resSave = resSave;
  window.resCreate = resCreate;
  window.resTick = resTick;
  window.resFeed = resFeed;
  window.resDayBump = resDayBump;
  window.resCheckAdoption = resCheckAdoption;
  window.resRisingStreak = resRisingStreak;
  window.resAgeDays = resAgeDays;
  window.resScale = resScale;
  window.resGrowth = resGrowth;
  window.resIsAdult = resIsAdult;
  window.resLevel = resLevel;
  window.resMood = resMood;
  window.resLine = resLine;
  window.resInfoHtml = resInfoHtml;
  window.resDayCounts = function () { return readJSON(DAYW_LS, {}); };
})();
