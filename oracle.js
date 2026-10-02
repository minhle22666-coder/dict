/* ============================================================
   THE WISDOM TREE: an I Ching reading with three coins

   Tapping the red gate or the great tree on Zen Island opens this (the
   sword under the gate is the way home).

   The method, as it is traditionally done:
   - Three coins, the inscribed side 正 worth 3 (yang) and the reverse 反
     worth 2 (yin). Their sum is a line: 6 old yin (changing), 7 young
     yang, 8 young yin, 9 old yang (changing) -- odds 1:3:3:1 as with real
     coins (crypto random).
   - Six throws, the first is the bottom line.
   - Changing lines turn into their opposite: the relating hexagram (the
     outcome). The nuclear hexagram (hỗ quái) is lines 2-4 under 3-5: what
     is moving inside the situation.
   - Which text to read follows Zhu Xi's rules (Yixue Qimeng) for 0-6
     changing lines.

   The look follows the reference the user sent: a dark, warm room, the
   hexagram's character large in gold, the lines drawn with their numbers
   and the changing ones in red with 動, each throw's coins, the journey
   from now to the outcome, the judgment and image, then the reading in
   tiers. Casting is the whole screen -- three big coins tossed in the
   dark with gold dust in the air -- not a box. The reading opens with the
   AI's straight answer to the question; the tiers come after, folded, so
   it is not a wall of text (the user crossed that out on the reference).

   Text: hexagrams.json (built offline): the Zhouyi original from
   Wikisource, Legge 1882 where Wikisource has it (1-31, 32's judgment),
   and the app's own layer. With a Gemini key the prompt keeps the user's
   structure: USER QUESTION / DIVINATION / SOURCE TEXT / TRADITIONAL
   COMMENTARY, then "explain how this symbolism can be reflected on the
   user's question; do not invent or alter the traditional meaning; do not
   claim certainty about the future". Vietnamese and English mix here by
   the user's choice -- the one screen outside vocabulary that does.

   Classic script, one IIFE; exports at the bottom.
   ============================================================ */
(function () {
  'use strict';
  var HIST_LS = 'fc_oracle';
  var REMIND = 'Dù quẻ ra thế nào, hãy chọn sống thiện và lặng lẽ quan sát những cảm xúc đang khởi lên trong tâm. Khi tâm thanh thoát, tịch tĩnh và sáng suốt, bạn sẽ luôn có lựa chọn tốt nhất. Quẻ chỉ là phụ cho cách bạn chọn phản ứng diễn ra trong tâm.';
  var LINE_VI = { 6: 'Lão âm — hào động', 7: 'Thiếu dương', 8: 'Thiếu âm', 9: 'Lão dương — hào động' };
  var POS_ZH = ['初', '二', '三', '四', '五', '上'];
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
  var DATA = null, BYPAT = {};
  function load() {
    if (DATA) return Promise.resolve(DATA);
    return fetch('./hexagrams.json').then(function (r) { return r.json(); }).then(function (d) {
      DATA = d;
      d.hexagrams.forEach(function (h) { BYPAT[h.structure.lines.join('')] = h; });
      return d;
    });
  }
  function coin() { var a = new Uint8Array(1); (window.crypto || window.msCrypto).getRandomValues(a); return a[0] & 1 ? 3 : 2; }

  var S = null;   // { q, throws:[{coins:[..], v}], busy, R, ai }
  function dom() {
    if ($('oc')) return;
    var d = document.createElement('div');
    var dust = '';
    for (var i = 0; i < 26; i++) dust += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 100).toFixed(1) + '%;animation-delay:-' + (Math.random() * 14).toFixed(1) + 's;animation-duration:' + (10 + Math.random() * 10).toFixed(1) + 's"></i>';
    d.innerHTML = '<div class="oc" id="oc"><div class="oc-dust">' + dust + '</div><div class="oc-in" id="oc-in"></div></div>';
    document.body.appendChild(d.firstChild);
  }
  function topbar(cap) {
    return '<div class="oc-top"><span class="oc-cap">' + cap + '</span><button class="oc-x" aria-label="Close" onclick="ocClose()">×</button></div>';
  }
  /* The three scenes as one journey ("the scenes are cut, nothing joins
     them, nothing tells me what is happening"): a steps bar on each, and
     each scene rises in rather than replacing the last in a blink. */
  function steps(n) {
    return '<div class="oc-steps">' + ['Hỏi', 'Gieo quẻ', 'Thông điệp'].map(function (t, i) {
      return '<i class="' + (i + 1 < n ? 'done' : i + 1 === n ? 'on' : '') + '"><b>' + (i + 1) + '</b>' + t + '</i>';
    }).join('<u></u>') + '</div>';
  }
  // shaking works only where a page may read motion without asking (not iOS, where a shake is "Undo Typing")
  function canShake() { return !!window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission !== 'function' && ('ontouchstart' in window); }
  window.ocOpen = function () {
    dom();
    S = { q: '', throws: [], busy: false };
    load().catch(function () {});
    var h = topbar('The wisdom tree') + steps(1)
      + '<div class="oc-ask oc-enter">'
      + '<div class="oc-mark">易</div>'
      + '<h2 class="oc-h2">Wisdom Tree</h2>'
      + '<p class="oc-lead">Wisdom Tree trả lời bằng Kinh Dịch — một cuốn sách ba nghìn năm tuổi đọc tình thế qua sáu nét quẻ.</p>'
      + '<ol class="oc-how">'
      +   '<li><b>Hỏi</b>Nghĩ về điều bạn đang băn khoăn. Viết ra nếu muốn.</li>'
      +   '<li><b>Gieo</b>Tung ba đồng xu sáu lần. Mỗi lần thành một hào, xếp từ dưới lên — sáu hào là một quẻ.</li>'
      +   '<li><b>Nghe</b>Wisdom Tree đọc quẻ và gửi bạn thông điệp cho câu hỏi.</li>'
      + '</ol>'
      + '<textarea id="oc-q" class="oc-q" rows="2" placeholder="Điều bạn muốn hỏi (không bắt buộc)…"></textarea>'
      + '<button class="oc-go" onclick="ocStart()">Bắt đầu gieo</button>'
      + histLine() + '</div>';
    $('oc-in').innerHTML = h;
    $('oc').className = 'oc ask';
    document.documentElement.classList.add('oc-on');
  };
  function histLine() {
    var hs = []; try { hs = JSON.parse(localStorage.getItem(HIST_LS) || '[]'); } catch (e) {}
    if (!hs.length) return '';
    var x = hs[0];
    return '<div class="oc-last">Lần trước: <b>' + esc(x.name) + '</b>' + (x.to ? ' → ' + esc(x.to) : '') + ' · ' + esc(new Date(x.at).toLocaleDateString('vi-VN')) + '</div>';
  }
  window.ocStart = function () {
    var q = $('oc-q'); S.q = q ? q.value.trim() : '';
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    renderCast();
    if (canShake()) motionOn();
  };

  /* ---------------- casting: the whole screen ---------------- */
  function coinHTML(i) {
    return '<div class="oc-coin" id="oc-c' + i + '"><div class="oc-cf"><b class="f"><s>正</s></b><b class="r"><s>反</s></b></div><div class="oc-cs"></div></div>';
  }
  function linesHTML(throws, big, reveal) {
    // drawn top (6) to bottom (1), numbered, the changing ones red with 動
    var h = '<div class="oc-lines' + (big ? ' big' : '') + '">';
    for (var k = 5; k >= 0; k--) {
      var t = throws[k];
      if (!t) { h += '<div class="oc-ln none"><em>' + (k + 1) + '</em><i></i><u></u></div>'; continue; }
      var yang = t.v % 2 === 1, ch = t.v === 6 || t.v === 9;
      h += '<div class="oc-ln ' + (yang ? 'yang' : 'yin') + (ch ? ' ch' : '') + (reveal && k === throws.length - 1 ? ' new' : '') + '"><em class="num">' + (k + 1) + '</em><i></i><u>' + (ch ? '動' : '') + '</u></div>';
    }
    return h + '</div>';
  }
  function renderCast() {
    var n = S.throws.length, last = S.throws[n - 1], full = n >= 6;
    var tip = canShake() ? 'Chạm vào đồng xu, hoặc lắc nhẹ điện thoại' : 'Chạm vào đồng xu để tung';
    var h = topbar(full ? 'Quẻ đã thành' : 'Lần gieo <b class="num">' + (n + 1) + '</b> / 6') + steps(2)
      + '<div class="oc-stage' + (n ? '' : ' oc-enter') + '"' + (full ? '' : ' onclick="ocThrow()"') + '>'
      + (S.q ? '<p class="oc-qq">“' + esc(S.q) + '”</p>' : '<p class="oc-qq">Giữ câu hỏi trong lòng…</p>')
      + '<div class="oc-coins3" id="oc-c3"></div>'
      /* Both faces of the user's coin are the same gold -- measured, the
         texture under the +z and -z faces averages (227,194,75) and
         (226,193,75) -- so which side landed up is written under each coin. */
      + '<div class="oc-faces">' + (last ? last.coins.map(function (c) { return '<i class="' + (c === 3 ? 'z' : 'f') + '"><b>' + (c === 3 ? '正' : '反') + '</b>' + c + '</i>'; }).join('') : '') + '</div>'
      + '<div class="oc-say" id="oc-say">' + (last ? 'Hào ' + POS_ZH[n - 1] + ' · <b class="num">' + last.v + '</b> · ' + LINE_VI[last.v] : tip) + '</div>'
      + '<p class="oc-why">' + (full ? 'Sáu hào đã đủ — đây là quẻ của bạn.' : 'Ba mặt <b>正</b> và <b>反</b> cộng lại thành một hào: 6, 7, 8 hoặc 9. Hào xếp từ dưới lên.') + '</p>'
      + linesHTML(S.throws, false, true)
      + '</div>'
      + (full ? '<div class="oc-made" id="oc-made"></div>'
              : '<button class="oc-go" id="oc-shake" onclick="ocThrow()">' + (n ? 'Gieo hào ' + (n + 1) : 'Tung đồng xu') + '</button>');
    $('oc-in').innerHTML = h;
    $('oc').className = 'oc cast';
    var host = $('oc-c3');
    if (coins3d(host)) { if (last) c3face(last.coins); }
    else {
      host.className = 'oc-coins'; host.innerHTML = coinHTML(0) + coinHTML(1) + coinHTML(2);
      if (last) last.coins.forEach(function (c, i) { setCoin(i, c, false); });
    }
    if (full) made();
  }
  /* The hexagram whole, before the reading: its character, its name, and
     one step on -- the tree's message is a choice, not a cut. */
  function made() {
    load().then(function () {
      var R = reading(), p = R.prim, box = $('oc-made'); if (!box) return;
      box.innerHTML = '<b class="oc-mglyph">' + esc(p.chinese) + '</b><span>' + esc(p.name.vi) + ' · ' + esc(p.name.en) + '</span>'
        + (R.rel ? '<small>' + R.chg.length + ' hào động — quẻ sẽ chuyển sang ' + esc(R.rel.name.vi) + '</small>' : '<small>Không hào nào động — quẻ đứng yên</small>')
        + '<button class="oc-go" onclick="ocReveal()">Nghe Wisdom Tree nói</button>';
      box.classList.add('on');
    });
  }
  window.ocReveal = function () { c3stop(); result(); };
  var coinDeg = [0, 0, 0];
  function setCoin(i, v, spin) {
    var el = $('oc-c' + i); if (!el) return;
    var b = el.querySelector('.oc-cf');
    var face = v === 3 ? 0 : 180;          // 正 up is 3, 反 up is 2
    var base = Math.ceil(coinDeg[i] / 360) * 360 + (spin ? 1440 + i * 360 : 0);
    coinDeg[i] = base + face;
    b.style.transition = spin ? 'transform ' + (1.05 + i * 0.12) + 's cubic-bezier(.2,.7,.25,1)' : 'none';
    b.style.transform = 'rotateX(' + coinDeg[i] + 'deg)';
    if (spin) { el.classList.remove('toss', 'land'); void el.offsetWidth; el.classList.add('toss'); }
  }
  window.ocThrow = function () {
    if (!S || S.busy || S.throws.length >= 6) return;
    S.busy = true;
    var cs = [coin(), coin(), coin()], v = cs[0] + cs[1] + cs[2];
    var btn = $('oc-shake'); if (btn) btn.disabled = true;
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
    if (!c3toss(cs)) cs.forEach(function (c, i) { setCoin(i, c, true); });
    $('oc').classList.add('tossing');
    setTimeout(function () {
      clink();
      cs.forEach(function (c, i) { var el = $('oc-c' + i); if (el) el.classList.add('land'); });
    }, 1200);
    setTimeout(function () {
      S.throws.push({ coins: cs, v: v });
      S.busy = false;
      if (S.throws.length >= 6) motionOff();
      renderCast();
    }, 1650);
  };
  /* A soft clink from two short sine partials -- no file to download. */
  var AC = null;
  function clink() {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var t = AC.currentTime;
      [2400, 3170, 4100].forEach(function (f, k) {
        var o = AC.createOscillator(), g = AC.createGain();
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t + k * 0.04); g.gain.exponentialRampToValueAtTime(0.05 / (k + 1), t + k * 0.04 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + k * 0.04 + 0.6);
        o.connect(g); g.connect(AC.destination); o.start(t + k * 0.04); o.stop(t + k * 0.04 + 0.65);
      });
    } catch (e) {}
  }
  /* ---------------- the coins in 3D ----------------
     The user's coin (assets/glb/coin.glb: one mesh, one texture atlas, its
     two faces on the model's +z and -z) tossed on a small stage of its own:
     a second, small WebGL canvas, made once and kept, only drawing while the
     casting screen is up. The island under the oracle is parked meanwhile
     (overlayOpen() sees oc-on), so the GPU is free. +z up is 正 (3), -z up
     is 反 (2): each toss spins a coin end over end a few whole turns and
     lands it on the face the throw came out as -- the coins show the line
     they make. Without the world's three.js (fwWorld.kit) the flat CSS
     coins are still there. */
  var C3 = null;
  function coins3d(host) {
    var K = window.fwWorld && window.fwWorld.kit ? window.fwWorld.kit() : null;
    if (!K || !host) return null;
    var T = K.THREE;
    if (!C3) {
      var cv = document.createElement('canvas'); cv.className = 'oc-gl';
      var r;
      try { r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { return null; }
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      if ('outputEncoding' in r) r.outputEncoding = T.sRGBEncoding;
      var sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xFFF1D6, 0x3A2412, 1.0));
      var dl = new T.DirectionalLight(0xFFE6B8, 1.5); dl.position.set(2.5, 6, 3.5); sc.add(dl);
      // a soft pool of warm light on the dark table the coins fall on
      var pc = document.createElement('canvas'); pc.width = pc.height = 128;
      var pg = pc.getContext('2d'), grd = pg.createRadialGradient(64, 64, 4, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,214,140,.38)'); grd.addColorStop(1, 'rgba(255,214,140,0)');
      pg.fillStyle = grd; pg.fillRect(0, 0, 128, 128);
      var pool = new T.Mesh(new T.PlaneGeometry(7, 4.2), new T.MeshBasicMaterial({ map: new T.CanvasTexture(pc), transparent: true, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; sc.add(pool);
      var cam = new T.PerspectiveCamera(34, 2, 0.1, 50); cam.position.set(0, 5.4, 4.2); cam.lookAt(0, 0.2, 0.15);
      C3 = { T: T, r: r, sc: sc, cam: cam, cv: cv, coins: [], raf: 0, toss: null, ready: false, want: null };
      K.loadProp('coin.glb').then(function (g) {
        var src = g.scene, box = new T.Box3().setFromObject(src), s = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
        var d = Math.max(s.x, s.y, s.z) || 1;
        for (var i = 0; i < 3; i++) {
          var inner = src.clone(true); inner.position.set(-c.x, -c.y, -c.z);
          var flip = new T.Group(); flip.add(inner); flip.scale.setScalar(1.18 / d);
          flip.rotation.x = -Math.PI / 2;   // +z up: 正
          var hold = new T.Group(); hold.add(flip); hold.position.set((i - 1) * 1.5, 0.07, 0);
          sc.add(hold);
          C3.coins.push({ hold: hold, flip: flip, x0: (i - 1) * 1.5 });
        }
        C3.ready = true;
        if (C3.want) { var w = C3.want; C3.want = null; c3face(w); }
      }).catch(function () {});
    }
    host.appendChild(C3.cv);
    c3size(host);
    c3loop();
    return C3;
  }
  function c3size(host) {
    var w = host.clientWidth || 320, h = host.clientHeight || 220;
    C3.r.setSize(w, h, false); C3.cv.style.width = w + 'px'; C3.cv.style.height = h + 'px';
    C3.cam.aspect = w / h; C3.cam.fov = w / h < 1.3 ? 44 : 34; C3.cam.updateProjectionMatrix();
  }
  function c3loop() {
    cancelAnimationFrame(C3.raf);
    var last = performance.now();
    var step = function (now) {
      if (!C3 || !C3.cv.isConnected) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      var tz = C3.toss;
      if (tz) {
        tz.t += dt;
        var done = true;
        C3.coins.forEach(function (c, i) {
          var D = tz.dur + i * 0.12, k = Math.min(1, tz.t / D);
          if (k < 1) done = false;
          var e = 1 - Math.pow(1 - k, 3);
          c.flip.rotation.x = tz.from[i] + (tz.to[i] - tz.from[i]) * e;
          // high enough to read as a toss, low enough to stay in the frame
          var y = Math.sin(Math.PI * Math.min(1, k * 1.08)) * (1.25 + i * 0.15);
          // a small bounce once it is down
          if (k >= 1) { var b = tz.t - D; y = b < 0.3 ? Math.sin(b / 0.3 * Math.PI) * 0.12 * (1 - b / 0.3) : 0; if (b < 0.3) done = false; }
          c.hold.position.y = 0.07 + Math.max(0, y);
          c.hold.position.x = c.x0 + Math.sin(Math.PI * k) * tz.dx[i];
          c.hold.rotation.y = tz.ry[i] * e;
        });
        if (done) { C3.toss = null; C3.coins.forEach(function (c) { c.flip.rotation.x = ((c.flip.rotation.x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); }); }
      }
      C3.r.render(C3.sc, C3.cam);
      C3.raf = requestAnimationFrame(step);
    };
    C3.raf = requestAnimationFrame(step);
  }
  function faceAngle(v) { return v === 3 ? 3 * Math.PI / 2 : Math.PI / 2; }   // -pi/2 (= 3pi/2) is +z up
  function c3face(vals) {
    if (!C3) return;
    if (!C3.ready) { C3.want = vals; return; }
    C3.coins.forEach(function (c, i) { c.flip.rotation.x = faceAngle(vals[i]); });
  }
  function c3toss(vals) {
    if (!C3 || !C3.ready) return false;
    var from = [], to = [], dx = [], ry = [];
    C3.coins.forEach(function (c, i) {
      var a = c.flip.rotation.x;
      from.push(a);
      // whole turns on top of the face it must land on
      var base = faceAngle(vals[i]), turns = 3 + i;
      var t = base + Math.ceil((a - base) / (2 * Math.PI) + 0.01) * 2 * Math.PI + turns * 2 * Math.PI;
      to.push(t);
      dx.push((Math.random() - 0.5) * 0.5);
      ry.push((Math.random() - 0.5) * 1.2);
    });
    C3.toss = { t: 0, dur: 1.05, from: from, to: to, dx: dx, ry: ry };
    return true;
  }
  function c3stop() { if (C3) cancelAnimationFrame(C3.raf); }
  // shaking the phone throws the coins (where the browser lets a page read motion without asking)
  var motionFn = null, lastShake = 0;
  function motionOn() {
    if (motionFn || !window.DeviceMotionEvent || typeof DeviceMotionEvent.requestPermission === 'function') return;
    motionFn = function (e) {
      var a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
      var m = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0);
      if (m > 32 && Date.now() - lastShake > 1900) { lastShake = Date.now(); ocThrow(); }
    };
    window.addEventListener('devicemotion', motionFn);
  }
  function motionOff() { if (motionFn) window.removeEventListener('devicemotion', motionFn); motionFn = null; }

  /* ---------------- the reading ---------------- */
  function reading() {
    var vs = S.throws.map(function (t) { return t.v; });
    var bits = vs.map(function (v) { return v % 2; });
    var prim = BYPAT[bits.join('')];
    var chg = [];
    vs.forEach(function (v, i) { if (v === 6 || v === 9) chg.push(i + 1); });
    var rel = chg.length ? BYPAT[vs.map(function (v) { return v === 6 ? 1 : v === 9 ? 0 : v % 2; }).join('')] : null;
    // the nuclear hexagram: lines 2-4 below, 3-5 above
    var hu = BYPAT[[bits[1], bits[2], bits[3], bits[2], bits[3], bits[4]].join('')];
    var unchanged = [1, 2, 3, 4, 5, 6].filter(function (k) { return chg.indexOf(k) < 0; });
    var focus = { rule: '', items: [] };
    var line = function (h, k, lead) { return { kind: 'line', h: h, k: k, lead: !!lead }; };
    var n = chg.length;
    if (n === 0) { focus.rule = 'Không có hào động: đọc lời quẻ (卦辭) của quẻ chính.'; focus.items = [{ kind: 'judgment', h: prim, lead: true }]; }
    else if (n === 1) { focus.rule = 'Một hào động: đọc lời của hào ấy.'; focus.items = [line(prim, chg[0], true)]; }
    else if (n === 2) { focus.rule = 'Hai hào động: đọc cả hai, hào trên là chính.'; focus.items = [line(prim, chg[1], true), line(prim, chg[0])]; }
    else if (n === 3) { focus.rule = 'Ba hào động: đọc lời quẻ của quẻ chính và quẻ biến.'; focus.items = [{ kind: 'judgment', h: prim, lead: true }, { kind: 'judgment', h: rel }]; }
    else if (n === 4) { focus.rule = 'Bốn hào động: đọc hai hào không động của quẻ biến, hào dưới là chính.'; focus.items = [line(rel, unchanged[0], true), line(rel, unchanged[1])]; }
    else if (n === 5) { focus.rule = 'Năm hào động: đọc hào không động duy nhất của quẻ biến.'; focus.items = [line(rel, unchanged[0], true)]; }
    else if (prim.number <= 2) { focus.rule = prim.number === 1 ? 'Sáu hào đều động ở quẻ Càn: đọc lời 用九.' : 'Sáu hào đều động ở quẻ Khôn: đọc lời 用六.'; focus.items = [{ kind: 'useall', h: prim, lead: true }]; }
    else { focus.rule = 'Sáu hào đều động: đọc lời quẻ của quẻ biến.'; focus.items = [{ kind: 'judgment', h: rel, lead: true }]; }
    return { vs: vs, prim: prim, rel: rel, hu: hu, chg: chg, focus: focus };
  }
  function lineLabel(h, k) {
    var yang = h.structure.lines[k - 1] === 1;
    return k === 1 ? (yang ? '初九' : '初六') : k === 6 ? (yang ? '上九' : '上六') : (yang ? '九' : '六') + POS_ZH[k - 1];
  }
  function itemZh(it) {
    var o = it.h.original_text;
    if (it.kind === 'judgment') return o.judgment;
    if (it.kind === 'useall') return o.use_all || '';
    return o.lines[String(it.k)];
  }
  function itemEn(it) {
    var lg = it.h.legge; if (!lg) return '';
    if (it.kind === 'judgment') return lg.judgment || '';
    if (it.kind === 'useall') return lg.use_all || '';
    return (lg.lines || {})[String(it.k)] || '';
  }
  function itemTitle(it) {
    if (it.kind === 'judgment') return 'Lời quẻ ' + it.h.name.vi;
    if (it.kind === 'useall') return (it.h.number === 1 ? '用九' : '用六') + ' · ' + it.h.name.vi;
    return 'Hào ' + lineLabel(it.h, it.k) + ' · ' + it.h.name.vi;
  }
  function triVi(h) { var up = DATA.trigrams[h.structure.upper], lo = DATA.trigrams[h.structure.lower]; return up.vi + ' trên ' + lo.vi; }
  function miniHex(h, chg) {
    var r = '<div class="oc-mini">';
    for (var k = 5; k >= 0; k--) r += '<i class="' + (h.structure.lines[k] ? 'y' : 'n') + (chg && chg.indexOf(k + 1) >= 0 ? ' c' : '') + '"></i>';
    return r + '</div>';
  }
  function result() {
    load().then(function () {
      var R = reading(); S.R = R;
      var p = R.prim, ip = p.interpretation;
      var key = window.getKey && window.getKey();
      var h = topbar('Kết quả gieo quẻ') + steps(3)
        + (S.q ? '<p class="oc-qline">“' + esc(S.q) + '”</p>' : '')
        // the answer first: the AI's, or the app's own line until it comes
        + '<div class="oc-answer" id="oc-answer">' + (key ? '<div class="oc-think"><span class="oc-dots"><i></i><i></i><i></i></span>Wisdom Tree đang luận quẻ…</div>'
            : '<p>' + esc(ip.modern_summary) + '</p><small>Thêm Gemini key trong Settings để được luận giải theo câu hỏi của bạn.</small>') + '</div>'
        + '<div class="oc-grid">'
        + '<div class="oc-left">'
        + '<div class="oc-glyph">' + esc(p.chinese) + '</div>'
        + linesHTML(S.throws, true, false)
        + '<div class="oc-name"><b>' + esc(p.name.vi) + '</b><span>Quẻ số ' + p.number + ' · ' + esc(p.pinyin) + ' · ' + esc(p.name.en) + '</span>'
        + '<em>' + esc(triVi(p)) + ' — ' + esc(ip.core_theme) + '</em></div>'
        + '<div class="oc-box"><span class="oc-k">Chi tiết gieo</span><div class="oc-throws">'
        + S.throws.map(function (t, i) {
            return '<div class="oc-th"><span>Hào ' + (i + 1) + '</span><div>' + t.coins.map(function (c) { return '<i class="' + (c === 3 ? 'z' : 'f') + '">' + (c === 3 ? '正' : '反') + '</i>'; }).join('') + '</div><b class="num' + (t.v === 6 || t.v === 9 ? ' c' : '') + '">' + t.v + '</b></div>';
          }).join('') + '</div></div>'
        + '<div class="oc-box oc-journey"><span class="oc-k red">Hành trình của quẻ</span><div class="oc-jr">'
        + '<div class="oc-j"><small>Hiện tại</small><b>' + esc(p.chinese) + '</b><span>' + esc(p.name.vi) + '</span></div>'
        + (R.rel ? '<div class="oc-arrow">→<small>' + (R.chg.length ? 'hào ' + R.chg.join(', ') + ' động' : '') + '</small></div>'
            + '<div class="oc-j out"><small>Kết cục</small><b>' + esc(R.rel.chinese) + '</b><span>' + esc(R.rel.name.vi) + '</span><em>' + esc(triVi(R.rel)) + '</em></div>'
          : '<div class="oc-arrow still">○<small>không hào động</small></div><div class="oc-j out still"><small>Kết cục</small><span>Quẻ đứng yên: lời quẻ chính là tất cả</span></div>')
        + '</div>' + (R.hu ? '<div class="oc-hu">Hỗ quái (diễn biến bên trong): <b>' + esc(R.hu.chinese) + ' ' + esc(R.hu.name.vi) + '</b></div>' : '') + '</div>'
        + '</div>'
        + '<div class="oc-right">'
        + '<section class="oc-sec"><span class="oc-k">Quái từ</span><p class="zh">' + esc(p.original_text.judgment) + '</p>'
        + (p.legge && p.legge.judgment ? '<p class="en">' + esc(p.legge.judgment) + '</p>' : '') + '</section>'
        + '<section class="oc-sec"><span class="oc-k">Tượng</span><p class="zh">' + esc(p.original_text.image) + '</p><p>' + esc(ip.traditional_meaning) + '</p></section>'
        + '<section class="oc-sec"><span class="oc-k">Lời cần đọc kỹ</span><p class="oc-rule">' + esc(R.focus.rule) + '</p>'
        + R.focus.items.map(function (it) {
            var en = itemEn(it);
            return '<div class="oc-fi' + (it.lead ? ' lead' : '') + '"><b>' + esc(itemTitle(it)) + '</b><p class="zh">' + esc(itemZh(it)) + '</p>' + (en ? '<p class="en">' + esc(en) + '</p>' : '') + '</div>';
          }).join('') + '</section>'
        + '<section class="oc-sec"><span class="oc-k">Giải quẻ</span><div id="oc-tiers">' + staticTiers(R) + '</div></section>'
        + '</div></div>'
        + '<p class="oc-remind">' + esc(REMIND) + '</p>'
        + '<div class="oc-acts"><button class="oc-go ghost" onclick="ocOpen()">Gieo quẻ khác</button><button class="oc-go" onclick="ocClose()">Xong</button></div>'
        + '<div class="oc-src">Nguyên văn: Chu Dịch (Wikisource) · Bản dịch: James Legge, 1882' + (p.legge ? '' : ' (quẻ này chưa có bản Legge trong nguồn mở)') + '</div>';
      $('oc-in').innerHTML = h;
      $('oc').className = 'oc done';
      var gr = $('oc-in').querySelector('.oc-answer'); if (gr) gr.classList.add('oc-enter');
      $('oc-in').scrollTop = 0;
      save(R);
      if (key) ocAsk();
    });
  }
  /* Without the AI, the tiers come from the book itself. */
  function staticTiers(R) {
    var p = R.prim, t = [];
    t.push({ title: 'Tầng 1 — Quẻ chính', text: '**' + p.name.vi + '** (' + p.name.en + '): ' + p.interpretation.traditional_meaning + ' ' + p.interpretation.modern_summary });
    if (R.hu) t.push({ title: 'Tầng 2 — Hỗ quái', text: 'Bên trong là **' + R.hu.name.vi + '**: ' + R.hu.interpretation.modern_summary });
    if (R.chg.length) t.push({ title: 'Tầng 3 — Hào động', text: R.focus.rule });
    if (R.rel) t.push({ title: 'Tầng 4 — Quẻ biến', text: 'Việc đi về **' + R.rel.name.vi + '**: ' + R.rel.interpretation.modern_summary });
    return tiersHTML(t);
  }
  function tiersHTML(t) {
    return t.map(function (x, i) {
      return '<details class="oc-tier"' + (i === 0 ? ' open' : '') + '><summary>' + esc(x.title) + '</summary><p>' + rich(x.text) + '</p></details>';
    }).join('');
  }
  function save(R) {
    var hs = []; try { hs = JSON.parse(localStorage.getItem(HIST_LS) || '[]'); } catch (e) {}
    hs.unshift({ at: Date.now(), q: S.q, n: R.prim.number, glyph: R.prim.symbol, name: R.prim.chinese + ' ' + R.prim.name.vi,
      to: R.rel ? R.rel.chinese + ' ' + R.rel.name.vi : '', lines: R.vs.join('') });
    try { localStorage.setItem(HIST_LS, JSON.stringify(hs.slice(0, 30))); } catch (e) {}
  }
  /* The prompt, in the structure the user gave. */
  function promptFor(R) {
    var p = R.prim;
    var div = 'Hexagram ' + p.number + ' ' + p.chinese + ' (' + p.pinyin + ', "' + p.name.en + '", ' + p.name.vi + ')'
      + (R.chg.length ? ', changing line' + (R.chg.length > 1 ? 's ' : ' ') + R.chg.join(', ') + ' → relating hexagram ' + R.rel.number + ' ' + R.rel.chinese + ' ("' + R.rel.name.en + '", ' + R.rel.name.vi + ')' : ', no changing lines')
      + (R.hu ? '. Nuclear hexagram: ' + R.hu.number + ' ' + R.hu.chinese + ' (' + R.hu.name.vi + ')' : '')
      + '. Thrown with three coins; line values bottom to top: ' + R.vs.join(' ') + '.\nWhat to read (Zhu Xi\'s rule): ' + R.focus.rule;
    var src = ['Judgment of ' + p.chinese + ': ' + p.original_text.judgment, 'Image of ' + p.chinese + ': ' + p.original_text.image];
    var com = [];
    if (p.legge && p.legge.judgment) com.push('Judgment of ' + p.chinese + ': ' + p.legge.judgment);
    var lab = function (it) { return it.kind === 'judgment' ? 'Judgment' : it.kind === 'useall' ? (it.h.number === 1 ? 'Use of nines (用九)' : 'Use of sixes (用六)') : 'Line ' + it.k + ' (' + lineLabel(it.h, it.k) + ')'; };
    R.focus.items.forEach(function (it) {
      if (it.kind === 'judgment' && it.h === p) return;
      src.push(lab(it) + ' of ' + it.h.chinese + ': ' + itemZh(it));
      var en = itemEn(it); if (en) com.push(lab(it) + ' of ' + it.h.chinese + ': ' + en);
    });
    if (R.rel) src.push('Judgment of the relating hexagram ' + R.rel.chinese + ': ' + R.rel.original_text.judgment);
    if (R.hu) src.push('Judgment of the nuclear hexagram ' + R.hu.chinese + ': ' + R.hu.original_text.judgment);
    return 'USER QUESTION:\n' + (S.q || '(No specific question: a general reading for today.)')
      + '\n\nDIVINATION:\n' + div
      + '\n\nSOURCE TEXT:\n' + src.join('\n')
      + '\n\nTRADITIONAL COMMENTARY:\n' + (com.length ? 'James Legge (1882):\n' + com.join('\n') : 'Legge\'s translation of these passages is not in our source; rely on the original text above and its traditional reading.')
      + '\nApp notes on the traditional meaning: ' + p.interpretation.traditional_meaning
      + '\n\nExplain how this symbolism can be reflected on the user\'s question. Do not invent or alter the traditional meaning. Do not claim certainty about the future.'
      + '\nWrite in Vietnamese. Return JSON only:\n{"answer":"one or two sentences that answer the question directly first (or, with no question, the message for today) -- plain, warm, no hedging words like có thể ở đầu câu",'
      + '"tiers":[{"title":"Tầng 1 — Quẻ chính","text":"..."},{"title":"Tầng 2 — Hỗ quái","text":"..."},{"title":"Tầng 3 — Hào động","text":"..."},{"title":"Tầng 4 — Quẻ biến","text":"..."}],'
      + '"advice":"one gentle thing to notice or try"}\n'
      + 'Each tier 2-4 sentences, tied to the question; leave out Tầng 3 when no line changes and Tầng 4 when there is no relating hexagram. Mark the few key phrases with **double asterisks**.';
  }
  window.ocAsk = async function () {
    var box = $('oc-answer'); if (!box || !S || !S.R) return;
    var key = window.getKey && window.getKey(); if (!key) return;
    var R = S.R;
    try {
      var model = window.getModel();
      var gen = { temperature: 0.6, maxOutputTokens: 1400, responseMimeType: 'application/json' };
      if (/2\.5/.test(model)) gen.thinkingConfig = { thinkingBudget: 0 };
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key);
      var res = await window.geminiPost(url, { contents: [{ parts: [{ text: promptFor(R) }] }], generationConfig: gen });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var t = window.geminiText(await res.json()).txt.trim().replace(/```json|```/g, '');
      var j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      if (!j.answer) throw new Error('EMPTY');
      if (!S || S.R !== R) return;
      box.innerHTML = '<span class="oc-k">Lời đáp</span><p>' + rich(j.answer) + '</p>' + (j.advice ? '<small>' + rich(j.advice) + '</small>' : '');
      box.classList.add('in');
      var tiers = (j.tiers || []).filter(function (x) { return x && x.text; });
      if (tiers.length && $('oc-tiers')) $('oc-tiers').innerHTML = tiersHTML(tiers);
    } catch (e) {
      box.innerHTML = '<p>' + esc(R.prim.interpretation.modern_summary) + '</p><small>Chưa luận giải được lúc này (' + esc(e.message) + '). <button class="oc-retry" onclick="ocAsk()">Thử lại</button></small>';
    }
  };
  window.ocClose = function () {
    motionOff(); c3stop();
    document.documentElement.classList.remove('oc-on');
    S = null;
  };
  window.oracleBack = function () {
    if (!document.documentElement.classList.contains('oc-on')) return false;
    if (S && S.busy) return true;
    ocClose(); return true;
  };
  window.ocPromptFor = function () { return S && S.R ? promptFor(S.R) : ''; };
  window.ocDebug = function () { return S; };
  document.addEventListener('focci-oracle', function () { ocOpen(); });
})();
