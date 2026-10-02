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
   - Stories. The Little Prince's pop-up book opens under a night sky, and
     a player sits over it: audiobooks for children from LibriVox (public
     domain, through archive.org's API), FM radio from any country (the
     community Radio Browser directory; Vietnam first), and the user's
     YouTube playlist of audio stories.

   Classic script, one IIFE.
   ============================================================ */
(function () {
  'use strict';
  var PLAYLIST = 'PLICwCUjNIMb1mj6a_r2tztKpmR8PsQ1lo';
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
    clearInterval(jogT);
    barOff();
    D.classList.remove('fa-quiet', 'fa-full', 'fa-relaxing', 'fa-storying');
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

  /* ---------------- guitar: plucked strings ---------------- */
  var AC = null;
  function ac() { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; }
  var pluckCache = {};
  function pluckBuf(midi) {
    if (pluckCache[midi]) return pluckCache[midi];
    var ctx = ac(), sr = ctx.sampleRate, f = 440 * Math.pow(2, (midi - 69) / 12);
    var len = Math.floor(sr * 2.6), buf = ctx.createBuffer(1, len, sr), y = buf.getChannelData(0);
    var N = Math.max(2, Math.round(sr / f)), ring = new Float32Array(N);
    for (var i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    // brighter low strings decay slower; 0.996-0.9985 per pass
    var decay = 0.9955 + Math.min(0.003, 30 / f * 0.01), p = 0, prev = 0;
    for (var n = 0; n < len; n++) {
      var cur = ring[p];
      var nx = decay * 0.5 * (cur + prev);
      prev = cur; ring[p] = nx; y[n] = cur;
      p = (p + 1) % N;
    }
    pluckCache[midi] = buf;
    return buf;
  }
  var CH = {
    G: [43, 47, 50, 55, 59, 67], D: [50, 57, 62, 66], Em: [40, 47, 52, 55, 59, 64], C: [48, 52, 55, 60, 64],
    Am: [45, 52, 57, 60, 64], F: [41, 48, 53, 57, 60, 65], A: [45, 52, 57, 61, 64], Bm: [47, 54, 59, 62, 66], Dm: [50, 57, 62, 65]
  };
  /* pattern: one bar of eighths; D down, U up, P a picked note (arpeggio), - rest */
  var SONGS = [
    { name: 'Campfire', chords: ['G', 'D', 'Em', 'C'], bpm: 92, pat: 'D-DU-UDU' },
    { name: 'Lullaby', chords: ['C', 'Am', 'F', 'G'], bpm: 70, pat: 'PPPPPPPP' },
    { name: 'Sunny road', chords: ['D', 'A', 'Bm', 'G'], bpm: 104, pat: 'D-D-UDU-' },
    { name: 'Rainy night', chords: ['Am', 'F', 'C', 'G'], bpm: 64, pat: 'D---D-U-' }
  ];
  var G = null;
  function pluck(midi, t, vel) {
    var ctx = ac(), src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = pluckBuf(midi);
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    src.connect(g); g.connect(G.out); src.start(t); src.stop(t + 2.5);
  }
  function guitarStart(i) {
    var ctx = ac();
    guitarStop();
    G = { song: i, next: ctx.currentTime + 0.25, step: 0, out: ctx.createGain(), timers: [] };
    G.out.gain.value = 0.55;
    // a little room
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    G.out.connect(lp); lp.connect(ctx.destination);
    G.iv = setInterval(guitarTick, 40);
    guitarBar();
  }
  function guitarTick() {
    if (!G) return;
    var ctx = ac(), S = SONGS[G.song], eighth = 60 / S.bpm / 2;
    while (G.next < ctx.currentTime + 0.18) {
      var bar = Math.floor(G.step / 8) % S.chords.length, k = G.step % 8, sym = S.pat[k];
      var notes = CH[S.chords[bar]], t = G.next;
      if (sym === 'D' || sym === 'U') {
        var seq = sym === 'D' ? notes : notes.slice().reverse();
        seq.forEach(function (m, j) { pluck(m, t + j * 0.012, (sym === 'D' ? 0.32 : 0.22) * (k === 0 ? 1.15 : 1)); });
        cue(t, sym === 'D' ? 1 : -1, bar);
      } else if (sym === 'P') {
        var order = [0, 2, 1, 3, 2, 4, 3, 2], m = notes[order[k] % notes.length];
        if (k === 0) pluck(notes[0], t, 0.3);
        pluck(m + (k === 0 ? 0 : 0), t, 0.26);
        cue(t, k % 2 ? -1 : 1, bar);
      }
      G.step++; G.next += eighth;
    }
  }
  function cue(t, dir, bar) {
    var ms = Math.max(0, (t - ac().currentTime) * 1000);
    G.timers.push(setTimeout(function () { if (W() && W().strum) W().strum(dir, bar); }, ms));
    if (G.timers.length > 60) G.timers.splice(0, 30);
  }
  function guitarStop() {
    if (!G) return;
    clearInterval(G.iv); G.timers.forEach(clearTimeout);
    try { G.out.gain.setTargetAtTime(0, ac().currentTime, 0.15); } catch (e) {}
    G = null;
  }
  function guitarBar() {
    var S = SONGS[G.song];
    bar('<button class="fa-nb" onclick="faSong(-1)" aria-label="Previous">‹</button>'
      + '<div class="fa-bt"><b>♪ ' + esc(S.name) + '</b><span>' + S.chords.join(' · ') + ' · ' + S.bpm + ' bpm</span></div>'
      + '<button class="fa-nb" onclick="faSong(1)" aria-label="Next">›</button>'
      + '<button class="pt-x" onclick="faStop()" aria-label="Stop">×</button>');
  }
  window.faSong = function (d) { if (!G) return; guitarStart((G.song + d + SONGS.length) % SONGS.length); };
  window.faGuitar = async function () {
    ringClose(); faStop(); CUR = 'guitar';
    D.classList.add('fa-quiet');
    if (W() && W().focciDo) await W().focciDo('guitar');
    guitarStart(0);
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
    { k: 'wind', t: 'Gió · Wind' }, { k: 'rain', t: 'Mưa · Rain' }, { k: 'waves', t: 'Sóng · Waves' },
    { k: 'birds', t: 'Chim · Birds' }, { k: 'none', t: 'Yên lặng' }
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
  /* 4 in, 2 hold, 6 out: a slow breath that lengthens the out-breath. */
  function breathLoop() {
    var c = $('fa-circle'), l = $('fa-blabel'), n = $('fa-bcount'); if (!c || CUR !== 'relax') return;
    var steps = [['in', 4000, 'Hít vào', 'Breathe in'], ['hold', 2000, 'Giữ', 'Hold'], ['out', 6000, 'Thở ra', 'Breathe out']];
    var i = 0;
    var go = function () {
      if (CUR !== 'relax') return;
      var s = steps[i];
      c.className = 'fa-circle ' + s[0];
      c.style.transitionDuration = s[1] + 'ms';
      l.innerHTML = s[2] + '<small>' + s[3] + '</small>';
      if (s[0] === 'in') { BR.n++; n.textContent = BR.n + (BR.n === 1 ? ' breath' : ' breaths'); }
      i = (i + 1) % steps.length;
      BR.t = setTimeout(go, s[1]);
    };
    go();
  }
  window.faRelax = async function () {
    ringClose(); faStop(); CUR = 'relax';
    D.classList.add('fa-quiet', 'fa-full', 'fa-relaxing');
    if (W() && W().focciDo) await W().focciDo('relax');
    var el = $('fa-relax');
    el.innerHTML = '<div class="fa-rtop"><span class="cz-cap">Focci is resting</span><b>Thở cùng Focci</b></div>'
      + '<div class="fa-breath"><div class="fa-circle" id="fa-circle"></div><div class="fa-blabel" id="fa-blabel">Hít vào<small>Breathe in</small></div></div>'
      + '<div class="fa-bcount num" id="fa-bcount"></div>'
      + '<div class="fa-snd">' + SOUNDS.map(function (s) { return '<button data-k="' + s.k + '" onclick="faSound(\'' + s.k + '\')">' + s.t + '</button>'; }).join('') + '</div>'
      + '<button class="fa-unlock" id="fa-unlock"><i></i><span>Giữ để mở khoá</span></button>';
    el.classList.add('on');
    BR = { n: 0, t: 0 };
    breathLoop();
    faSound('wind');
    // the lock: only a press held for a second gets you out
    var u = $('fa-unlock'), ut = 0;
    var down = function (e) { e.preventDefault(); u.classList.add('hold'); ut = setTimeout(function () { u.classList.remove('hold'); clearTimeout(BR && BR.t); faStop(); }, 1000); };
    var up = function () { u.classList.remove('hold'); clearTimeout(ut); };
    u.addEventListener('pointerdown', down); u.addEventListener('pointerup', up); u.addEventListener('pointerleave', up); u.addEventListener('pointercancel', up);
  };

  /* ---------------- stories: the book, and something to listen to ---------------- */
  var AU = null;
  function audioEl() { if (!AU) { AU = new Audio(); AU.preload = 'none'; } return AU; }
  function storyAudioStop() { if (AU) { try { AU.pause(); AU.removeAttribute('src'); AU.load(); } catch (e) {} } var y = $('fa-yt'); if (y) y.innerHTML = ''; }
  var COUNTRIES = [['VN', 'Việt Nam'], ['US', 'USA'], ['GB', 'UK'], ['AU', 'Australia'], ['CA', 'Canada'], ['JP', 'Japan'], ['KR', 'Korea'], ['FR', 'France'], ['DE', 'Germany'], ['SG', 'Singapore'], ['TH', 'Thailand']];
  var ST = { tab: 'books', cc: 'VN', books: null, playing: null };
  window.faStories = async function () {
    ringClose(); faStop(); CUR = 'stories';
    D.classList.add('fa-quiet', 'fa-full', 'fa-storying');
    var el = $('fa-story');
    el.innerHTML = '<div class="fa-fade"></div><div class="fa-stop-top"><div><span class="cz-cap">Story time</span><b>The Little Prince’s book</b></div>'
      + '<button class="pt-x" onclick="faStop()" aria-label="Close">×</button></div>'
      + '<div class="fa-sheet"><div class="fa-tabs">'
      + '<button data-t="books" onclick="faTab(\'books\')">Truyện audio</button><button data-t="radio" onclick="faTab(\'radio\')">Radio FM</button><button data-t="yt" onclick="faTab(\'yt\')">YouTube</button></div>'
      + '<div class="fa-now" id="fa-now"></div><div class="fa-list" id="fa-list"></div></div>';
    el.classList.add('on');
    setTimeout(function () { if (W() && W().focciDo) W().focciDo('stories'); }, 500);
    faTab(ST.tab);
  };
  window.faTab = function (t) {
    ST.tab = t;
    document.querySelectorAll('#fa-story .fa-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
    var L = $('fa-list'); if (!L) return;
    if (t === 'yt') {
      L.innerHTML = '<div class="fa-yt" id="fa-yt"><iframe src="https://www.youtube-nocookie.com/embed/videoseries?list=' + PLAYLIST + '&playsinline=1" title="Audio stories" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>'
        + '<p class="fa-note">Danh sách truyện audio trên YouTube của bạn.</p>';
      if (AU) AU.pause();
      return;
    }
    var y = $('fa-yt'); if (y) y.innerHTML = '';
    if (t === 'radio') return radioList();
    return bookList();
  };
  function loading(L) { L.innerHTML = '<div class="fa-load"><span class="pr-dots"><i></i><i></i><i></i></span>Đang tải…</div>'; }
  async function getJSON(u, ms) {
    var c = new AbortController(), tm = setTimeout(function () { c.abort(); }, ms || 15000);
    try { var r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(tm); }
  }
  async function bookList() {
    var L = $('fa-list'); loading(L);
    try {
      if (!ST.books) {
        // measured: the language filter matched nothing (the field is not "English" there); subject alone finds ~1,200
        var q = 'collection:(librivoxaudio) AND subject:(children OR "fairy tales" OR fables)';
        var d = await getJSON('https://archive.org/advancedsearch.php?q=' + encodeURIComponent(q) + '&fl[]=identifier&fl[]=title&fl[]=creator&sort[]=downloads+desc&rows=40&output=json');
        ST.books = (d.response && d.response.docs) || [];
      }
      if (ST.tab !== 'books') return;
      L.innerHTML = '<p class="fa-note">Truyện thiếu nhi tiếng Anh do tình nguyện viên LibriVox đọc (phạm vi công cộng).</p>'
        + ST.books.map(function (b, i) {
          var by = Array.isArray(b.creator) ? b.creator[0] : (b.creator || '');
          return '<button class="fa-item" onclick="faBook(' + i + ')"><b>' + esc(String(b.title).replace(/\s*\(version \d+\)/i, '')) + '</b><span>' + esc(by) + '</span></button>';
        }).join('');
    } catch (e) { L.innerHTML = '<p class="fa-note">Không tải được thư viện (' + esc(e.message) + ').</p>'; }
  }
  window.faBook = async function (i) {
    var b = ST.books && ST.books[i]; if (!b) return;
    var L = $('fa-list'); loading(L);
    try {
      var d = await getJSON('https://archive.org/metadata/' + encodeURIComponent(b.identifier) + '/files');
      var files = (d.result || []).filter(function (f) { return /_64kb\.mp3$/i.test(f.name); });
      if (!files.length) files = (d.result || []).filter(function (f) { return /\.mp3$/i.test(f.name); });
      files.sort(function (x, y) { return x.name.localeCompare(y.name, undefined, { numeric: true }); });
      ST.chapters = files.map(function (f) { return { title: f.title || chName(f.name), url: 'https://archive.org/download/' + b.identifier + '/' + encodeURIComponent(f.name), book: b.title }; });
      L.innerHTML = '<button class="fa-back" onclick="faTab(\'books\')">‹ All books</button><p class="fa-note"><b>' + esc(b.title) + '</b></p>'
        + ST.chapters.map(function (c, k) { return '<button class="fa-item" onclick="faPlayCh(' + k + ')"><b>' + esc(c.title) + '</b></button>'; }).join('');
    } catch (e) { L.innerHTML = '<p class="fa-note">Không mở được truyện (' + esc(e.message) + ').</p>'; }
  };
  // "wonderland_ch_01_64kb.mp3" reads as "Chapter 1"
  function chName(n) {
    var b = n.replace(/_64kb\.mp3$/i, '').replace(/\.mp3$/i, '');
    var m = /(?:^|_)(?:ch|chapter|part|pt)_?0*(\d+)/i.exec(b) || /_0*(\d+)$/.exec(b);
    return m ? 'Chapter ' + m[1] : b.replace(/_/g, ' ');
  }
  window.faPlayCh = function (k) {
    var c = ST.chapters && ST.chapters[k]; if (!c) return;
    play(c.url, c.title, c.book, function () { if (ST.chapters[k + 1]) faPlayCh(k + 1); });
  };
  async function radioList() {
    var L = $('fa-list'); loading(L);
    var chips = '<div class="fa-cc">' + COUNTRIES.map(function (c) { return '<button class="' + (c[0] === ST.cc ? 'on' : '') + '" onclick="faCC(\'' + c[0] + '\')">' + c[1] + '</button>'; }).join('') + '</div>';
    try {
      var d = await getJSON('https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/' + ST.cc + '?limit=60&hidebroken=true&order=clickcount&reverse=true');
      var hls = !!audioEl().canPlayType('application/vnd.apple.mpegurl');
      /* https only (the app is https; an http stream is blocked as mixed
         content), and HLS only where the browser plays it itself (Safari). */
      var st = d.filter(function (s) { var u = s.url_resolved || s.url || ''; return /^https:/i.test(u) && (hls || !/\.m3u8(\?|$)/i.test(u)); }).slice(0, 30);
      ST.stations = st;
      if (ST.tab !== 'radio') return;
      L.innerHTML = chips + (st.length ? st.map(function (s, i) {
        return '<button class="fa-item" onclick="faRadio(' + i + ')"><b>' + esc(s.name.trim()) + '</b><span>' + esc((s.tags || '').split(',').slice(0, 3).join(' · ') || s.codec || '') + '</span></button>';
      }).join('') : '<p class="fa-note">Chưa có đài phát được ở quốc gia này.</p>');
    } catch (e) { L.innerHTML = chips + '<p class="fa-note">Không tải được danh sách đài (' + esc(e.message) + ').</p>'; }
  }
  window.faCC = function (cc) { ST.cc = cc; radioList(); };
  window.faRadio = function (i) { var s = ST.stations && ST.stations[i]; if (s) play(s.url_resolved || s.url, s.name.trim(), 'Radio · ' + ST.cc); };
  function play(url, title, sub, onEnd) {
    var a = audioEl();
    a.onended = onEnd || null;
    a.src = url; a.play().catch(function () {});
    ST.playing = { title: title, sub: sub };
    nowBar();
    a.onplaying = nowBar; a.onpause = nowBar; a.onerror = function () { var n = $('fa-now'); if (n) n.innerHTML = '<div class="fa-err">Không phát được nguồn này — thử nguồn khác nhé.</div>'; };
  }
  function nowBar() {
    var n = $('fa-now'); if (!n || !ST.playing) return;
    var on = AU && !AU.paused;
    n.innerHTML = '<button class="fa-pp" onclick="faPP()" aria-label="Play or pause">' + (on ? '❚❚' : '▶') + '</button>'
      + '<div class="fa-bt"><b>' + esc(ST.playing.title) + '</b><span>' + esc(ST.playing.sub || '') + '</span></div>' + (on ? '<span class="ls-wave"><i></i><i></i><i></i><i></i><i></i></span>' : '');
    n.classList.add('on');
  }
  window.faPP = function () { if (!AU) return; if (AU.paused) AU.play().catch(function () {}); else AU.pause(); };

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

  window.faDebug = function () { return { CUR: CUR, G: G, AMB: AMB && AMB.k, ST: ST }; };
})();
