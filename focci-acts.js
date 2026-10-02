/* ============================================================
   FOCCI'S OWN THINGS TO DO -- the controls (world.js has the body)

   Hold Focci for a second and a half: a ring fills under the finger, then
   four round buttons open around him.

   - Guitar. The music is made here, not downloaded: each string is a
     Karplus-Strong pluck (a burst of noise fed back through a short delay
     and a gentle low-pass -- how a plucked string actually decays),
     rendered once per note and cached. A song is a chord progression and
     a strum pattern; every strum is scheduled on the audio clock and the
     same moment is sent to fwWorld.strum() so his arm moves with it.
     Four songs, switched with < and >.
   - Jog. He runs a lap by himself; the chip counts time and distance;
     a touch on the island takes over again.
   - Relax. He lies down in the grass with his eyes closed. The screen
     locks (a press-and-hold unlocks it) and a breathing guide runs:
     in for four, hold for two, out for six. The island's music stops and
     an ambient sound plays instead -- wind by default, or rain, waves,
     birds, or nothing -- all synthesised from noise and a few oscillators.
   - Stories. The Little Prince's pop-up book opens under a night sky with
     a clock radio beside it: FM from any country (the community Radio
     Browser directory; Vietnam first) and bedtime stories from LibriVox
     (public domain, through archive.org's API), tuned on the radio itself.
     See the stories section below.

   Classic script, one IIFE.
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function W() { return window.fwWorld || null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  var D = document.documentElement;
  var SVG = {
    guitar: '<path d="M14.5 9.5 20 4"/><path d="m18.5 3 2.5 2.5"/><path d="M13.6 10.4a3.3 3.3 0 0 0-4.5-.6 3 3 0 0 1-2.9 1.6C4 11.6 2.8 14.4 4.2 17.3a5 5 0 0 0 2.5 2.5c2.9 1.4 5.7.2 5.9-2 .1-1 .6-2.1 1.6-2.9a3.3 3.3 0 0 0-.6-4.5z"/><circle cx="9.3" cy="14.7" r="1.3"/>',
    jog: '<circle cx="14" cy="4.5" r="1.8"/><path d="m8 21 3-6 3 2v4"/><path d="M6 12.5 9 9l4 1.5 2.5 3H19"/><path d="M11 15 9.5 9.5"/>',
    relax: '<path d="M3 17c3-1 4.5-4.5 9-4.5S18 16 21 17"/><path d="M8 12.6c0-2 1.8-3.6 4-3.6s4 1.6 4 3.6"/><path d="M12 5v1M6.2 7.2l.7.7M17.8 7.2l-.7.7"/>',
    stories: '<path d="M12 6c-1.5-1.3-3.5-2-6-2v13c2.5 0 4.5.7 6 2 1.5-1.3 3.5-2 6-2V4c-2.5 0-4.5.7-6 2Z"/><path d="M12 6v13"/><path d="m18.5 1.5.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z"/>'
  };
  function ic(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + SVG[k] + '</svg>'; }
  var ACTS = [
    { k: 'guitar', t: 'Guitar', fn: 'faGuitar' },
    { k: 'jog', t: 'Jog', fn: 'faJog' },
    { k: 'relax', t: 'Relax', fn: 'faRelax' },
    { k: 'stories', t: 'Stories', fn: 'faStories' }
  ];
  var ICON = { guitar: 'guitar', jog: 'jog', relax: 'relax', stories: 'castle' };
  function dom() {
    if ($('fa-hold')) return;
    var d = document.createElement('div');
    d.innerHTML = '<div class="fa-hold" id="fa-hold"><i></i></div>'
      + '<div class="pr fa-ring" id="fa-ring"><div class="pr-ring" id="fa-btns"></div></div>'
      + '<div class="fa-bar" id="fa-bar"></div>'
      + '<div class="fa-relax" id="fa-relax"></div>'
      + '<div class="fa-story" id="fa-story"></div>';
    while (d.firstChild) document.body.appendChild(d.firstChild);
    // the same press-and-lift handling as the animals' ring (pets.js)
    if (window.ringPress) window.ringPress($('fa-btns'), function (fn) { if (typeof window[fn] === 'function') window[fn](); });
    else $('fa-btns').addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (b && window[b.dataset.act]) window[b.dataset.act](); });
  }

  /* ---------------- the hold, and the ring ---------------- */
  var holdShowT = 0;
  document.addEventListener('focci-hold-start', function (e) {
    dom();
    var h = $('fa-hold'), p = e.detail || {};
    h.style.left = p.x + 'px'; h.style.top = p.y + 'px';
    clearTimeout(holdShowT);
    // a quick tap on him is still a tap: the ring only appears for a real hold
    holdShowT = setTimeout(function () { h.classList.remove('on'); void h.offsetWidth; h.classList.add('on'); }, 150);
  });
  document.addEventListener('focci-hold-cancel', function () { clearTimeout(holdShowT); var h = $('fa-hold'); if (h) h.classList.remove('on'); });
  var R = { raf: 0, open: false };
  document.addEventListener('focci-hold', function () {
    clearTimeout(holdShowT);
    var h = $('fa-hold'); if (h) h.classList.remove('on');
    if (navigator.vibrate) try { navigator.vibrate(18); } catch (e) {}
    ringOpen();
  });
  function ringOpen() {
    dom();
    if (window.petHide) try { window.petHide(); } catch (e) {}
    $('fa-btns').innerHTML = ACTS.map(function (a, i) {
      return '<button class="pr-b fa-k-' + a.k + '" style="--i:' + i + '" data-act="' + a.fn + '"><span class="pr-c"><img src="./assets/icons/' + ICON[a.k] + '.png" alt="" draggable="false"/></span><span class="pr-t">' + a.t + '</span></button>';
    }).join('');
    var el = $('fa-ring'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    R.open = true;
    cancelAnimationFrame(R.raf);
    var step = function () { if (!R.open) return; ringPlace(); R.raf = requestAnimationFrame(step); };
    step();
  }
  function ringPlace() {
    var a = W() && W().focciAnchor ? W().focciAnchor() : null, el = $('fa-ring');
    if (!a || !a.c.on) { el.classList.add('off'); return; }
    el.classList.remove('off');
    var bs = $('fa-btns').children, n = bs.length, rr = Math.max(104, Math.min(150, a.r + 60));
    for (var i = 0; i < n; i++) {
      // an arc over his head, left to right
      var th = (200 + (140 * i) / (n - 1)) * Math.PI / 180;
      var x = Math.max(36, Math.min(window.innerWidth - 36, a.c.x + Math.cos(th) * rr));
      var y = Math.max(80, Math.min(window.innerHeight - 70, a.c.y + Math.sin(th) * rr));
      bs[i].style.transform = 'translate(' + Math.round(x - 32) + 'px,' + Math.round(y - 27) + 'px)';
    }
  }
  function ringClose() { R.open = false; cancelAnimationFrame(R.raf); var el = $('fa-ring'); if (el) el.classList.remove('on'); }
  document.addEventListener('pointerdown', function (e) { if (R.open && e.target && e.target.id === 'fw-canvas') ringClose(); }, true);

  /* ---------------- a bar at the bottom for whatever he is doing ---------------- */
  var CUR = null;   // 'guitar' | 'jog' | 'relax' | 'stories'
  function bar(html) { var b = $('fa-bar'); b.innerHTML = html; b.classList.add('on'); D.classList.add('fa-on'); }
  function barOff() { var b = $('fa-bar'); if (b) b.classList.remove('on'); D.classList.remove('fa-on'); }
  window.faStop = function () {
    dom();
    var was = CUR; CUR = null;
    guitarStop(); ambientStop(); storyAudioStop();
    if (RS) { clearInterval(RS.clock); clearTimeout(RS.tuneT); cancelAnimationFrame(RS.raf); if (RS.mode === 'story') savePos(); RS = null; }
    clearInterval(jogT);
    barOff();
    D.classList.remove('fa-quiet', 'fa-full', 'fa-relaxing', 'fa-storying', 'fa-night');
    var rl = $('fa-relax'); if (rl) rl.classList.remove('on');
    var st = $('fa-story'); if (st) { st.classList.remove('on'); st.innerHTML = ''; }
    if (W() && W().focciStop) W().focciStop(true);
    return was;
  };
  document.addEventListener('focci-act-end', function (e) {
    var d = e.detail || {};
    if (d.kind === 'jog' && CUR === 'jog') {
      CUR = null; clearInterval(jogT); barOff();
      if (window.fwToast && d.t > 5) window.fwToast('Nice run — ' + mmss(d.t) + ' · ' + Math.round(d.dist) + ' m');
    }
  });
  window.faBack = function () {
    if (R.open) { ringClose(); return true; }
    if (CUR) { faStop(); return true; }
    return false;
  };

  /* ---------------- guitar: the user's recordings ----------------
     The first version synthesised plucked strings; the user found it
     poor and sent real guitar recordings (assets/audio/guitar-*.mp3).
     They play through an AnalyserNode so his arm can follow the music:
     each frame the energy of the low-mid band (roughly 90-1,700 Hz, where
     a strum lands) is compared with its own running average, and a jump
     well above it -- at least 170ms after the last -- is a strum. A
     missing file is skipped. */
  var AC = null;
  function ac() { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; }
  var SONGS = [
    { name: 'A Gentle Touching Song', file: 'guitar-gentle-touch.mp3' },
    { name: 'Lowden', file: 'guitar-lowden.mp3' },
    { name: 'Sunset Strings', file: 'guitar-sunset-strings.mp3' },
    { name: 'Star', file: 'guitar-star.mp3' }
  ];
  var G = null;
  function guitarStart(i, tries) {
    guitarStop();
    tries = tries || 0;
    if (tries >= SONGS.length) { bar('<div class="fa-bt"><b>No guitar music found</b><span>Add the tracks to assets/audio</span></div><button class="pt-x" onclick="faStop()" aria-label="Stop">×</button>'); return; }
    var ctx = ac();
    var el = new Audio('./assets/audio/' + SONGS[i].file);
    el.preload = 'auto'; el.crossOrigin = 'anonymous';
    var src = ctx.createMediaElementSource(el), an = ctx.createAnalyser();
    an.fftSize = 1024; an.smoothingTimeConstant = 0.35;
    src.connect(an); an.connect(ctx.destination);
    G = { song: i, el: el, an: an, buf: new Uint8Array(an.frequencyBinCount), avg: 0, last: 0, dir: 1, raf: 0, bar: 0 };
    el.onended = function () { faSong(1); };
    el.onerror = function () { if (G && G.el === el) guitarStart((i + 1) % SONGS.length, tries + 1); };
    el.play().catch(function () {});
    var sr = ctx.sampleRate, lo = Math.max(1, Math.round(90 / (sr / an.fftSize))), hi = Math.round(1700 / (sr / an.fftSize));
    var tick = function () {
      if (!G || G.el !== el) return;
      an.getByteFrequencyData(G.buf);
      var e = 0; for (var k = lo; k < hi; k++) e += G.buf[k]; e /= (hi - lo);
      var now = performance.now();
      if (e > G.avg * 1.22 + 6 && e > 40 && now - G.last > 170) {
        G.last = now; G.dir = -G.dir; G.bar = (G.bar + (Math.random() < 0.25 ? 1 : 0)) % 4;
        if (W() && W().strum) W().strum(G.dir, G.bar);
      }
      G.avg += (e - G.avg) * 0.08;
      G.raf = requestAnimationFrame(tick);
    };
    tick();
    guitarBar();
  }
  function guitarStop() {
    if (!G) return;
    cancelAnimationFrame(G.raf);
    try { G.el.pause(); G.el.removeAttribute('src'); G.el.load(); } catch (e) {}
    G = null;
  }
  function guitarBar() {
    var S = SONGS[G.song];
    bar('<button class="fa-nb" onclick="faSong(-1)" aria-label="Previous">‹</button>'
      + '<div class="fa-bt"><b>♪ ' + esc(S.name) + '</b><span>Focci on guitar</span></div>'
      + '<button class="fa-nb" onclick="faSong(1)" aria-label="Next">›</button>'
      + '<button class="pt-x" onclick="faStop()" aria-label="Stop">×</button>');
  }
  window.faSong = function (d) { if (!G) return; guitarStart((G.song + d + SONGS.length) % SONGS.length); };
  window.faGuitar = async function () {
    ringClose(); faStop(); CUR = 'guitar';
    D.classList.add('fa-quiet');
    guitarStart(0);   // inside the tap: iOS only lets audio start from the gesture itself
    if (W() && W().focciDo) await W().focciDo('guitar');
  };

  /* ---------------- jog ---------------- */
  var jogT = 0;
  function mmss(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  window.faJog = async function () {
    ringClose(); faStop();
    var ok = W() && W().focciDo ? await W().focciDo('jog') : false;
    if (!ok) { if (window.fwToast) window.fwToast('No room to run here'); return; }
    CUR = 'jog';
    var upd = function () {
      var s = W() && W().jogStats ? W().jogStats() : null;
      if (!s) return;
      bar('<span class="fa-run">' + ic('jog') + '</span><div class="fa-bt"><b>Jogging round the island</b><span class="num">' + mmss(s.t) + ' · ' + Math.round(s.dist) + ' m</span></div>'
        + '<button class="fa-stop" onclick="faStop()">Stop</button>');
    };
    upd(); jogT = setInterval(upd, 500);
  };

  /* ---------------- relax: breathing, the lock, the wind ---------------- */
  var AMB = null, BR = null;
  function noiseBuf(ctx, brown) {
    var len = ctx.sampleRate * 3, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w; }
    return b;
  }
  var SOUNDS = [
    { k: 'wind', t: 'Wind' }, { k: 'rain', t: 'Rain' }, { k: 'waves', t: 'Waves' },
    { k: 'birds', t: 'Birds' }, { k: 'none', t: 'Silence' }
  ];
  function ambientStart(k) {
    ambientStop();
    if (k === 'none') { AMB = { k: k }; return; }
    var ctx = ac(), out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
    out.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    var A = { k: k, out: out, nodes: [], iv: 0 };
    var src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx, k !== 'rain'); src.loop = true;
    var f = ctx.createBiquadFilter(), g = ctx.createGain();
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    if (k === 'wind' || k === 'birds') {
      f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.6; g.gain.value = k === 'birds' ? 0.18 : 0.5;
      lfo.frequency.value = 0.09; lg.gain.value = 260; lfo.connect(lg); lg.connect(f.frequency);
    } else if (k === 'rain') {
      f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.5; g.gain.value = 0.16;
      lfo.frequency.value = 0.3; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain);
    } else if (k === 'waves') {
      f.type = 'lowpass'; f.frequency.value = 620; g.gain.value = 0.32;
      lfo.frequency.value = 0.12; lg.gain.value = 0.28; lfo.connect(lg); lg.connect(g.gain);
    }
    src.connect(f); f.connect(g); g.connect(out); src.start(); lfo.start();
    A.nodes.push(src, lfo);
    if (k === 'birds') {
      var chirp = function () {
        if (!AMB || AMB !== A) return;
        var t = ctx.currentTime, o = ctx.createOscillator(), e = ctx.createGain(), base = 2600 + Math.random() * 1400, n = 2 + Math.floor(Math.random() * 4);
        o.type = 'sine'; e.gain.value = 0;
        for (var i = 0; i < n; i++) {
          var s = t + i * 0.13;
          o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * 1.5, s + 0.08);
          e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(0.05, s + 0.02); e.gain.linearRampToValueAtTime(0, s + 0.1);
        }
        o.connect(e); e.connect(out); o.start(t); o.stop(t + n * 0.13 + 0.1);
        A.iv = setTimeout(chirp, 900 + Math.random() * 3200);
      };
      A.iv = setTimeout(chirp, 800);
    }
    AMB = A;
  }
  function ambientStop() {
    if (!AMB) return;
    var A = AMB; AMB = null;
    clearTimeout(A.iv);
    if (A.out) { try { A.out.gain.setTargetAtTime(0, ac().currentTime, 0.4); } catch (e) {} setTimeout(function () { A.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); }, 1500); }
  }
  window.faSound = function (k) {
    ambientStart(k);
    document.querySelectorAll('#fa-relax .fa-snd button').forEach(function (b) { b.classList.toggle('on', b.dataset.k === k); });
  };
  /* 4 in, 2 hold, 6 out: a slow breath that lengthens the out-breath. Each
     phase is sent to the island too, so Focci's belly rises and falls
     with the circle (fwWorld.breath). */
  function breathLoop() {
    var c = $('fa-circle'), l = $('fa-blabel'), n = $('fa-bcount'); if (!c || CUR !== 'relax') return;
    var steps = [['in', 4000, 'Breathe in'], ['hold', 2000, 'Hold'], ['out', 6000, 'Breathe out']];
    var i = 0;
    var go = function () {
      if (CUR !== 'relax') return;
      var s = steps[i];
      c.className = 'fa-circle ' + s[0];
      c.style.transitionDuration = s[1] + 'ms';
      l.textContent = s[2];
      if (W() && W().breath) W().breath(s[0], s[1]);
      if (s[0] === 'in') { BR.n++; n.textContent = BR.n + (BR.n === 1 ? ' breath' : ' breaths'); }
      i = (i + 1) % steps.length;
      BR.t = setTimeout(go, s[1]);
    };
    go();
  }
  window.faRelax = async function () {
    ringClose(); faStop(); CUR = 'relax';
    var night = W() && W().day !== undefined ? W().day < 0.5 : false;
    D.classList.add('fa-quiet', 'fa-full', 'fa-relaxing');
    D.classList.toggle('fa-night', night);
    faSoundStartPending = night ? 'waves' : 'wind';
    ambientStart(faSoundStartPending);       // inside the tap, so the browser lets it play
    if (W() && W().focciDo) await W().focciDo('relax');
    var el = $('fa-relax');
    /* Readable on a bright island: dark ink on frosted chips by day, warm
       light on a deep scrim at night -- white text on white sand was
       "burnt out". Sunlight by day: soft rays turning slowly; at night, a
       moon glow and the fireflies on the island itself. */
    el.innerHTML = '<div class="fa-sky"><i></i></div>'
      + '<div class="fa-rtop"><span>' + (night ? 'A quiet night in the grass' : 'Sun, wind and grass') + '</span><b>Breathe with Focci</b></div>'
      + '<div class="fa-breath"><div class="fa-circle" id="fa-circle"></div><div class="fa-blabel" id="fa-blabel">Breathe in</div></div>'
      + '<div class="fa-bcount num" id="fa-bcount"></div>'
      + '<div class="fa-snd">' + SOUNDS.map(function (s) { return '<button data-k="' + s.k + '" onclick="faSound(\'' + s.k + '\')">' + s.t + '</button>'; }).join('') + '</div>'
      + '<button class="fa-unlock" id="fa-unlock"><i></i><span>Hold to unlock</span></button>';
    el.classList.add('on');
    BR = { n: 0, t: 0 };
    breathLoop();
    faSound(faSoundStartPending);
    // the lock: only a press held for a second gets you out
    var u = $('fa-unlock'), ut = 0;
    var down = function (e) { e.preventDefault(); u.classList.add('hold'); ut = setTimeout(function () { u.classList.remove('hold'); clearTimeout(BR && BR.t); faStop(); }, 1000); };
    var up = function () { u.classList.remove('hold'); clearTimeout(ut); };
    u.addEventListener('pointerdown', down); u.addEventListener('pointerup', up); u.addEventListener('pointerleave', up); u.addEventListener('pointercancel', up);
  };
  var faSoundStartPending = 'wind';

  /* ---------------- stories: the radio by the Little Prince's book ----------------
     The first version was a flat sheet of lists over the book; the user
     wanted it inside the little world. Now the scene stays clear and a
     clock radio stands by the book (world.js buildRadio), hopping with a
     "Tap the radio" chip until it is touched. A tap flies the camera to it:
     - the keys on top choose the mode -- the blue one FM, the red one
       Stories -- and the chosen key glows, with a label over each key;
       the second blue key saves the station (saved stations come first,
       and "Saved" is the first stop on the band knob);
     - the big wheel on the side tunes: drag it and the needle slides,
       the LED shows the station or the book; let go and it plays;
     - the small knob on top turns the country (FM) or the chapter
       (Stories), with a little card and a flag for the country;
     - a glass strip at the bottom plays and pauses, swipes to the next or
       last station or chapter, and for a story scrubs to any minute; a
       story you started asks whether to carry on where you left off.
     FM comes from the community Radio Browser directory (https streams
     only; HLS only where the browser plays it itself), stories from
     LibriVox's children's shelf on archive.org. The YouTube tab is gone. */
  var AU = null;
  function audioEl() { if (!AU) { AU = new Audio(); AU.preload = 'none'; } return AU; }
  function storyAudioStop() { if (AU) { try { AU.pause(); AU.removeAttribute('src'); AU.load(); } catch (e) {} } cancelAnimationFrame(RS && RS.raf); }
  var COUNTRIES = [['VN', 'Vietnam'], ['US', 'United States'], ['GB', 'United Kingdom'], ['AU', 'Australia'], ['CA', 'Canada'], ['JP', 'Japan'], ['KR', 'South Korea'], ['FR', 'France'], ['DE', 'Germany'], ['SG', 'Singapore'], ['TH', 'Thailand']];
  function flag(cc) { return cc === '*' ? '★' : String.fromCodePoint.apply(null, cc.split('').map(function (c) { return 0x1F1E6 + c.charCodeAt(0) - 65; })); }
  var FAV_LS = 'fc_fm_favs', POS_LS = 'fc_story_pos', LAST_LS = 'fc_story_last';
  function rj(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function wj(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var RS = null;
  function bands() { var f = rj(FAV_LS, []); return (f.length ? [['*', 'Saved stations']] : []).concat(COUNTRIES); }
  async function getJSON(u, ms) {
    var c = new AbortController(), tm = setTimeout(function () { c.abort(); }, ms || 15000);
    try { var r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(tm); }
  }
  async function stationsFor(cc) {
    RS.st = RS.st || {};
    var favs = rj(FAV_LS, []);
    if (cc === '*') return favs.map(function (f) { return { id: f.id, name: f.name, url: f.url, cc: f.cc, tags: '' }; });
    if (!RS.st[cc]) {
      var d = await getJSON('https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/' + cc + '?limit=60&hidebroken=true&order=clickcount&reverse=true');
      var hls = !!audioEl().canPlayType('application/vnd.apple.mpegurl');
      RS.st[cc] = d.filter(function (s) { var u = s.url_resolved || s.url || ''; return /^https:/i.test(u) && (hls || !/\.m3u8(\?|$)/i.test(u)); })
        .slice(0, 40).map(function (s) { return { id: s.stationuuid, name: s.name.trim(), url: s.url_resolved || s.url, cc: cc, tags: (s.tags || '').split(',').slice(0, 2).join(' · ') }; });
    }
    // saved stations float to the top of their country
    var ids = favs.map(function (f) { return f.id; });
    return RS.st[cc].slice().sort(function (a, b) { return (ids.indexOf(b.id) >= 0) - (ids.indexOf(a.id) >= 0); });
  }
  async function booksList() {
    if (RS.books) return RS.books;
    // measured: a language filter matched nothing there; subject alone finds ~1,200
    var q = 'collection:(librivoxaudio) AND subject:(children OR "fairy tales" OR fables)';
    var d = await getJSON('https://archive.org/advancedsearch.php?q=' + encodeURIComponent(q) + '&fl[]=identifier&fl[]=title&fl[]=creator&sort[]=downloads+desc&rows=40&output=json');
    RS.books = ((d.response && d.response.docs) || []).map(function (b) { return { id: b.identifier, title: String(b.title).replace(/\s*\(version \d+\)/i, ''), by: Array.isArray(b.creator) ? b.creator[0] : (b.creator || '') }; });
    return RS.books;
  }
  // "wonderland_ch_01_64kb.mp3" reads as "Chapter 1"
  function chName(n) {
    var b = n.replace(/_64kb\.mp3$/i, '').replace(/\.mp3$/i, '');
    var m = /(?:^|_)(?:ch|chapter|part|pt)_?0*(\d+)/i.exec(b) || /_0*(\d+)$/.exec(b);
    return m ? 'Chapter ' + m[1] : b.replace(/_/g, ' ');
  }
  async function chaptersOf(book) {
    if (book.ch) return book.ch;
    var d = await getJSON('https://archive.org/metadata/' + encodeURIComponent(book.id) + '/files');
    var files = (d.result || []).filter(function (f) { return /_64kb\.mp3$/i.test(f.name); });
    if (!files.length) files = (d.result || []).filter(function (f) { return /\.mp3$/i.test(f.name); });
    files.sort(function (x, y) { return x.name.localeCompare(y.name, undefined, { numeric: true }); });
    book.ch = files.map(function (f) { return { title: f.title || chName(f.name), url: 'https://archive.org/download/' + book.id + '/' + encodeURIComponent(f.name) }; });
    return book.ch;
  }
  function hhmm() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function mm(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  window.faStories = async function () {
    ringClose(); faStop(); CUR = 'stories';
    D.classList.add('fa-quiet', 'fa-full', 'fa-storying');
    RS = { mode: 'fm', band: 0, stIdx: 0, list: [], bookIdx: 0, chIdx: 0, focus: false, raf: 0, wheel: 0, knob: 0, cur: null, tuneT: 0 };
    var el = $('fa-story');
    el.innerHTML = '<div class="fa-fade"></div>'
      + '<div class="rs-stage" id="rs-stage"></div>'
      + '<div class="rs-top"><div><span>Story night</span><b>The Little Prince’s world</b></div><button class="pt-x" onclick="faStop()" aria-label="Close">×</button></div>'
      + '<div class="rs-hint" id="rs-hint"><i></i>Tap the radio</div>'
      // one row of labels over the three keys -- each over its own key they overlapped -- and they work as the keys do
      + '<div class="rs-keys" id="rs-keys"><button class="rs-key fm" data-k="fm">FM radio</button><button class="rs-key fav" data-k="fav">★ Save</button><button class="rs-key story" data-k="story">Stories</button></div>'
      + '<div class="rs-tag" id="rs-t-tune">Turn to tune</div><div class="rs-tag" id="rs-t-band">Country</div>'
      + '<div class="rs-pop" id="rs-pop"></div>'
      + '<div class="rs-player" id="rs-player"></div>';
    el.classList.add('on');
    stageWire();
    $('rs-keys').addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (!b || !RS) return;
      if (!RS.focus) { focusRadio(); }
      if (b.dataset.k === 'fav') toggleFav(); else setMode(b.dataset.k);
    });
    setTimeout(function () { if (W() && W().focciDo) W().focciDo('stories').then(function () { if (W().storyRadio) W().storyRadio({ hint: true, focus: false, mode: 'fm', led: [hhmm(), 'TAP TO TUNE IN', false] }); }); }, 450);
    anchorLoop();
    stationsFor(COUNTRIES[0][0]).then(function (l) { if (RS && RS.mode === 'fm' && !RS.list.length) { RS.list = l; } }).catch(function () {});
  };
  function radio(o) { if (W() && W().storyRadio) W().storyRadio(o); }
  function place(id, part, dy) {
    var e = $(id); if (!e) return;
    var a = W() && W().storyAnchor ? W().storyAnchor(part) : null;
    if (!a || !a.on) { e.style.opacity = 0; return; }
    e.style.opacity = '';
    e.style.transform = 'translate(' + Math.round(a.x - e.offsetWidth / 2) + 'px,' + Math.round(a.y - e.offsetHeight - (dy || 0)) + 'px)';
  }
  function anchorLoop() {
    var st = $('fa-story');
    var step = function () {
      if (!RS || CUR !== 'stories') return;
      st.classList.toggle('focused', RS.focus); st.classList.toggle('m-fm', RS.mode === 'fm'); st.classList.toggle('m-story', RS.mode === 'story');
      if (!RS.focus) place('rs-hint', 'radio', 6);
      else { place('rs-keys', 'fav', 10); place('rs-t-tune', 'tune', -46); place('rs-t-band', 'band', 48); place('rs-pop', 'band', 84); }
      RS.raf = requestAnimationFrame(step);
    };
    step();
    clearInterval(RS.clock);
    RS.clock = setInterval(function () { if (!RS || CUR !== 'stories') return; led(); if (RS.mode === 'story' && AU && !AU.paused) { savePos(); needle(); scrubSync(); } }, 1000);
  }
  function led() {
    if (!RS.focus) { radio({ led: [hhmm(), 'TAP TO TUNE IN', false] }); return; }
    var live = AU && !AU.paused && !!AU.src;
    if (RS.mode === 'fm') { var s = RS.list[RS.stIdx]; radio({ led: [hhmm(), s ? s.name.toUpperCase() : 'TUNING…', live] }); }
    else { var b = RS.books && RS.books[RS.bookIdx], c = b && b.ch && b.ch[RS.chIdx]; radio({ led: [live ? mm(AU.currentTime) : hhmm(), b ? (b.title + (c ? ' · ' + c.title : '')).toUpperCase() : 'LOADING BOOKS…', live] }); }
  }
  function needle() {
    if (RS.mode === 'fm') radio({ needle: RS.list.length > 1 ? RS.stIdx / (RS.list.length - 1) : 0.5 });
    else radio({ needle: AU && AU.duration ? AU.currentTime / AU.duration : 0 });
  }
  /* ---- touching the radio ---- */
  function stageWire() {
    var stg = $('rs-stage'), drag = null;
    stg.addEventListener('pointerdown', function (e) {
      var part = W() && W().storyPick ? W().storyPick(e.clientX, e.clientY) : null;
      if (!RS.focus) {
        if (part) focusRadio();
        return;
      }
      if (part === 'fm' || part === 'story') { setMode(part); return; }
      if (part === 'fav') { toggleFav(); return; }
      if (part === 'tune' || part === 'band') {
        drag = { part: part, x: e.clientX, y: e.clientY, moved: 0, acc: 0 };
        try { stg.setPointerCapture(e.pointerId); } catch (x) {}
      }
    });
    stg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var d = (e.clientX - drag.x) - (e.clientY - drag.y);
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(d);
      var rot = d * 0.012;
      if (drag.part === 'tune') { RS.wheel += rot; radio({ wheel: RS.wheel }); }
      else { RS.knob += rot; radio({ band: RS.knob }); }
      drag.acc += rot;
      // one step a notch (about 0.45 of a turn of the wheel)
      while (Math.abs(drag.acc) >= 0.45) { var dir = drag.acc > 0 ? 1 : -1; drag.acc -= dir * 0.45; stepPart(drag.part, dir, true); }
    });
    var up = function () {
      if (!drag) return;
      var d = drag; drag = null;
      if (d.moved < 8) stepPart(d.part, 1, true);   // a tap is one step
      settle(d.part);
    };
    stg.addEventListener('pointerup', up); stg.addEventListener('pointercancel', up);
  }
  function focusRadio() {
    RS.focus = true;
    radio({ hint: false, focus: true, mode: RS.mode });
    if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
    // the tap is the gesture that lets audio start
    if (RS.mode === 'fm') { if (RS.list.length) tune(); else stationsFor(bands()[RS.band][0]).then(function (l) { RS.list = l; tune(); }); }
    playerDraw();
  }
  async function setMode(m) {
    if (RS.mode === m) return;
    RS.mode = m; RS.stIdx = 0;
    radio({ mode: m });
    if (AU) AU.pause();
    if (m === 'story') {
      led();
      await booksList().catch(function () {});
      var last = rj(LAST_LS, null);
      if (last && RS.books) { var bi = RS.books.findIndex(function (b) { return b.id === last.id; }); if (bi >= 0) { RS.bookIdx = bi; RS.chIdx = last.ch || 0; await chaptersOf(RS.books[bi]).catch(function () {}); RS.resume = last; } }
      if (!RS.resume && RS.books && RS.books[RS.bookIdx]) await chaptersOf(RS.books[RS.bookIdx]).catch(function () {});
    } else {
      RS.list = await stationsFor(bands()[RS.band][0]).catch(function () { return []; });
      tune();
    }
    led(); needle(); playerDraw();
  }
  function stepPart(part, dir, preview) {
    if (RS.mode === 'fm') {
      if (part === 'tune') { if (!RS.list.length) return; RS.stIdx = (RS.stIdx + dir + RS.list.length) % RS.list.length; needle(); led(); }
      else { var B = bands(); RS.band = (RS.band + dir + B.length) % B.length; showCountry(B[RS.band]); }
    } else {
      if (!RS.books) return;
      if (part === 'tune') { RS.bookIdx = (RS.bookIdx + dir + RS.books.length) % RS.books.length; RS.chIdx = 0; RS.resume = null; led(); }
      else { var b = RS.books[RS.bookIdx]; if (b && b.ch && b.ch.length) { RS.chIdx = (RS.chIdx + dir + b.ch.length) % b.ch.length; RS.resume = null; led(); } }
    }
    if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {}
  }
  function settle(part) {
    clearTimeout(RS.tuneT);
    RS.tuneT = setTimeout(async function () {
      if (!RS) return;
      if (RS.mode === 'fm') {
        if (part === 'band') { RS.list = await stationsFor(bands()[RS.band][0]).catch(function () { return []; }); RS.stIdx = 0; setTimeout(hideCountry, 1600); }
        tune();
      } else {
        var b = RS.books && RS.books[RS.bookIdx]; if (!b) return;
        await chaptersOf(b).catch(function () {});
        playChapter(0);
      }
    }, part === 'band' ? 700 : 450);
  }
  function showCountry(B) {
    var p = $('rs-pop'), n = RS.st && RS.st[B[0]] ? RS.st[B[0]].length : null;
    p.innerHTML = '<span class="rs-flag">' + flag(B[0]) + '</span><div><b>' + esc(B[1]) + '</b><small>' + (B[0] === '*' ? rj(FAV_LS, []).length + ' saved' : n !== null ? n + ' stations' : 'Tuning in…') + '</small></div>';
    p.classList.remove('on'); void p.offsetWidth; p.classList.add('on');
  }
  function hideCountry() { var p = $('rs-pop'); if (p) p.classList.remove('on'); }
  function tune() {
    var s = RS.list[RS.stIdx]; if (!s) { led(); playerDraw(); return; }
    play(s.url, function () { led(); playerDraw(); });
    led(); needle(); playerDraw();
  }
  function play(url, onState, startAt) {
    var a = audioEl();
    a.onended = null;
    if (a.src !== url) { a.src = url; }
    if (startAt) { var seek = function () { try { a.currentTime = startAt; } catch (e) {} a.removeEventListener('loadedmetadata', seek); }; a.addEventListener('loadedmetadata', seek); }
    a.play().catch(function () {});
    a.onplaying = onState; a.onpause = onState;
    a.onerror = function () { var n = $('rs-player'); if (n && RS) { n.classList.add('err'); setTimeout(function () { n.classList.remove('err'); }, 2400); } };
  }
  function playChapter(at) {
    var b = RS.books[RS.bookIdx], c = b && b.ch && b.ch[RS.chIdx]; if (!c) return;
    play(c.url, function () { led(); playerDraw(); }, at || 0);
    AU.onended = function () { if (b.ch[RS.chIdx + 1]) { RS.chIdx++; savePos(0); playChapter(0); } };
    wj(LAST_LS, { id: b.id, ch: RS.chIdx, t: at || 0, title: b.title });
    RS.resume = null;
    led(); playerDraw();
  }
  function savePos(force) {
    if (!AU || RS.mode !== 'story') return;
    var b = RS.books && RS.books[RS.bookIdx]; if (!b) return;
    var t = force !== undefined ? force : AU.currentTime;
    wj(LAST_LS, { id: b.id, ch: RS.chIdx, t: t, title: b.title });
  }
  function toggleFav() {
    if (RS.mode !== 'fm') return;
    var s = RS.list[RS.stIdx]; if (!s) return;
    var f = rj(FAV_LS, []), i = f.findIndex(function (x) { return x.id === s.id; });
    if (i >= 0) f.splice(i, 1); else f.unshift({ id: s.id, name: s.name, url: s.url, cc: s.cc });
    wj(FAV_LS, f);
    radio({ fav: i < 0 });
    if (window.fwToast) window.fwToast(i < 0 ? '★ Saved ' + s.name : 'Removed from saved stations');
    playerDraw();
  }
  /* ---- the strip at the bottom ---- */
  function playerDraw() {
    var p = $('rs-player'); if (!p || !RS) return;
    p.classList.toggle('on', RS.focus);
    var on = AU && !AU.paused && !!AU.src;
    var h = '';
    if (RS.mode === 'fm') {
      var s = RS.list[RS.stIdx], fav = s && rj(FAV_LS, []).some(function (x) { return x.id === s.id; });
      radio({ fav: !!fav });
      h = '<button class="rs-b star' + (fav ? ' on' : '') + '" data-a="fav" aria-label="Save station">★</button>'
        + '<button class="rs-b" data-a="prev" aria-label="Previous">‹</button>'
        + '<button class="rs-b pp" data-a="pp" aria-label="Play or pause">' + (on ? '❚❚' : '▶') + '</button>'
        + '<button class="rs-b" data-a="next" aria-label="Next">›</button>'
        + '<div class="rs-tt"><b>' + esc(s ? s.name : 'Tuning…') + '</b><span>' + flag(bands()[RS.band][0]) + ' ' + esc(bands()[RS.band][1]) + (s && s.tags ? ' · ' + esc(s.tags) : '') + (on ? ' · live ' + hhmm() : '') + '</span></div>';
    } else {
      var b = RS.books && RS.books[RS.bookIdx], c = b && b.ch && b.ch[RS.chIdx];
      if (RS.resume && b && RS.resume.id === b.id && RS.resume.t > 20) {
        h = '<div class="rs-resume"><b>Where you left off</b><span>' + esc(b.title) + ' · ' + esc((b.ch && b.ch[RS.resume.ch] || {}).title || '') + ' · ' + mm(RS.resume.t) + '</span>'
          + '<div><button data-a="resume">Continue from ' + mm(RS.resume.t) + '</button><button data-a="restart" class="ghost">Start over</button></div></div>';
      } else {
        var dur = AU && AU.duration && isFinite(AU.duration) ? AU.duration : 0;
        h = '<button class="rs-b" data-a="prev" aria-label="Previous chapter">‹</button>'
          + '<button class="rs-b pp" data-a="pp" aria-label="Play or pause">' + (on ? '❚❚' : '▶') + '</button>'
          + '<button class="rs-b" data-a="next" aria-label="Next chapter">›</button>'
          + '<div class="rs-tt"><b>' + esc(b ? b.title : 'Finding stories…') + '</b><span>' + esc(c ? c.title : (b ? 'Turn the wheel for a book, the knob for a chapter' : '')) + (b && b.by ? ' · ' + esc(b.by) : '') + '</span>'
          + '<div class="rs-scrub"><i class="num" id="rs-cur">' + mm(AU && AU.src ? AU.currentTime : 0) + '</i><input type="range" id="rs-range" min="0" max="' + Math.round(dur || 1) + '" value="' + Math.round(AU && AU.src ? AU.currentTime : 0) + '" step="1" data-noswipe="1"/><i class="num">' + mm(dur) + '</i></div></div>';
      }
    }
    p.innerHTML = h;
    var rg = $('rs-range');
    if (rg) {
      rg.addEventListener('input', function () { var c = $('rs-cur'); if (c) c.textContent = mm(+rg.value); RS.scrubbing = true; });
      rg.addEventListener('change', function () { RS.scrubbing = false; if (AU && AU.src) { try { AU.currentTime = +rg.value; } catch (e) {} if (AU.paused) AU.play().catch(function () {}); } else playChapter(+rg.value); });
    }
    if (!p._wired) { p._wired = true; wirePlayer(p); }
  }
  function scrubSync() {
    if (RS.scrubbing) return;
    var rg = $('rs-range'), c = $('rs-cur'); if (!rg || !AU) return;
    if (AU.duration && isFinite(AU.duration) && +rg.max !== Math.round(AU.duration)) rg.max = Math.round(AU.duration);
    rg.value = Math.round(AU.currentTime); if (c) c.textContent = mm(AU.currentTime);
  }
  function wirePlayer(p) {
    p.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b || !RS) return;
      var a = b.dataset.a;
      if (a === 'fav') return toggleFav();
      if (a === 'pp') { if (!AU || !AU.src) { RS.mode === 'fm' ? tune() : playChapter(0); return; } if (AU.paused) AU.play().catch(function () {}); else AU.pause(); return; }
      if (a === 'next' || a === 'prev') { var d = a === 'next' ? 1 : -1; stepPart(RS.mode === 'fm' ? 'tune' : 'band', d); settleNow(); return; }
      if (a === 'resume') { var r = RS.resume; RS.chIdx = r.ch || 0; playChapter(r.t); return; }
      if (a === 'restart') { RS.resume = null; playChapter(0); return; }
    });
    // a swipe along the strip is the next or the last one
    var sx = null;
    p.addEventListener('pointerdown', function (e) { if (e.target.closest('input')) return; sx = { x: e.clientX, y: e.clientY }; });
    p.addEventListener('pointerup', function (e) {
      if (!sx) return; var dx = e.clientX - sx.x, dy = e.clientY - sx.y; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { stepPart(RS.mode === 'fm' ? 'tune' : 'band', dx < 0 ? 1 : -1); settleNow(); }
    });
  }
  function settleNow() {
    if (RS.mode === 'fm') tune();
    else playChapter(0);
  }

  /* ---------------- telling people the hold exists ----------------
     Nothing on screen said Focci could be held, so nobody found it. Until
     the first real hold, a small "Hold me" chip with a pulsing ring sits
     over his head now and then: when the island is on screen, nothing is
     open, and he has been standing still for a few seconds. Twice a
     session at most, five seconds each. */
  var TIP = { shown: 0, until: 0, still: 0, last: null, raf: 0 };
  function tipEl() {
    var t = $('fa-tip');
    if (!t) { t = document.createElement('div'); t.className = 'fa-tip'; t.id = 'fa-tip'; t.innerHTML = '<i></i>Hold me'; document.body.appendChild(t); }
    return t;
  }
  function held() { try { return localStorage.getItem('fc_held') === '1'; } catch (e) { return false; } }
  document.addEventListener('focci-hold', function () { try { localStorage.setItem('fc_held', '1'); } catch (e) {} var t = $('fa-tip'); if (t) t.classList.remove('on'); });
  setInterval(function () {
    if (held() || TIP.shown >= 2 || CUR || R.open) return;
    var w = W(); if (!w || !w.focciAnchor) return;
    var ov = document.getElementById('fw-overlay');
    if (!ov || ov.style.display === 'none' || D.classList.contains('panel-open') || D.classList.contains('home-on') || D.classList.contains('pr-open')) { TIP.still = 0; return; }
    var a = w.focciAnchor(); if (!a || !a.top.on) return;
    var k = Math.round(a.c.x) + ',' + Math.round(a.c.y);
    TIP.still = (k === TIP.last) ? TIP.still + 1 : 0; TIP.last = k;
    if (TIP.still < 3 || Date.now() < TIP.until) return;   // three still seconds
    TIP.shown++; TIP.until = Date.now() + 60000;
    var t = tipEl(); t.classList.add('on');
    var end = Date.now() + 5000;
    var step = function () {
      var b = w.focciAnchor();
      if (!b || Date.now() > end || CUR || R.open) { t.classList.remove('on'); return; }
      t.style.transform = 'translate(' + Math.round(b.top.x - t.offsetWidth / 2) + 'px,' + Math.round(b.top.y - 44) + 'px)';
      TIP.raf = requestAnimationFrame(step);
    };
    step();
  }, 1000);

  window.faDebug = function () { return { CUR: CUR, G: G, AMB: AMB && AMB.k, RS: RS, AU: AU }; };
})();
