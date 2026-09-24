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

  var NAMES = {
    rabbit: ['Pim', 'Clover', 'Muji', 'Nubbin'],
    duck:   ['Pebble', 'Marlow', 'Sprig', 'Quill'],
    cat:    ['Sable', 'Miso', 'Juniper', 'Pockets'],
    sheep:  ['Bramble', 'Tuft', 'Marzi', 'Dandelion'],
    wolf:   ['Ash', 'Corvin', 'Silje', 'Rune']
  };

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
    var pool = NAMES[species] || ['Friend'];
    var used = list.map(function (r) { return r.name; });
    var name = opts.name || pool.find(function (n) { return used.indexOf(n) < 0; }) || pool[0] + (list.length + 1);
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
      mateId: null
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
    h += '<div class="rz-note">' + esc(resLine(r)) + '</div>';
    h += '<button class="rz-feed" onclick="resFeedFromCard(\'' + r.id + '\')">Feed · ' + FEED_XP + ' XP</button>';
    return h;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

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
