/* ============================================================
   THE WISDOM TREE: an I Ching reading with three coins

   Tapping the red gate or the great tree on Zen Island opens this (the
   sword under the gate is the way home). It used to show a random quote;
   the user asked for a real divination instead: shake three coins six
   times, build the hexagram from the bottom line up, and read it.

   The method, as it is traditionally done:
   - Three coins, one side worth 3 (yang) and the other 2 (yin). Their sum
     is a line: 6 old yin (changing), 7 young yang, 8 young yin, 9 old yang
     (changing). The odds come out 1:3:3:1, as with real coins.
   - Six throws, the first is the bottom line.
   - Changing lines turn into their opposite, giving the relating
     hexagram (zhi gua).
   - Which text to read follows Zhu Xi's rules (Yixue Qimeng): none
     changing, the judgment; one, that line; two, both lines, the upper
     leading; three, both hexagrams' judgments; four, the two unchanged
     lines of the relating hexagram, the lower leading; five, its one
     unchanged line; six, the relating judgment (use-nine / use-six for
     Qian and Kun).

   Text: hexagrams.json (built offline): the original Zhouyi from
   Wikisource, James Legge's 1882 translation where Wikisource has it
   (hexagrams 1-32; 32 has its judgment only), and the app's own layer --
   core theme, traditional meaning, modern summary. ctext.org is the
   reference the user named; its robots.txt turns away AI crawlers, so it
   was not scraped.

   With a Gemini key, the reading of the user's question is asked in the
   structure the user wrote: USER QUESTION / DIVINATION / SOURCE TEXT /
   TRADITIONAL COMMENTARY, then "explain how this symbolism can be
   reflected on the user's question; do not invent or alter the
   traditional meaning; do not claim certainty about the future".

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

  var S = null;   // { q, throws:[{coins:[..], v}], busy }
  function dom() {
    if ($('oc')) return;
    var d = document.createElement('div');
    d.innerHTML = '<div class="oc" id="oc"><div class="oc-in" id="oc-in"></div></div>';
    document.body.appendChild(d.firstChild);
    $('oc').addEventListener('click', function (e) { if (e.target.id === 'oc' && (!S || !S.busy)) ocClose(); });
  }
  function head(cap) {
    return '<div class="oc-h"><div><span class="cz-cap">' + cap + '</span><b class="oc-title">Gieo quẻ Kinh Dịch</b></div>'
      + '<button class="pt-x" aria-label="Close" onclick="ocClose()">×</button></div>';
  }
  window.ocOpen = function () {
    dom();
    S = { q: '', throws: [], busy: false };
    load().catch(function () {});
    var h = head('The wisdom tree')
      + '<p class="oc-intro">Lặng lại một chút, thở chậm, và nghĩ về điều bạn đang băn khoăn. Ba đồng xu được gieo sáu lần — mỗi lần là một hào, từ dưới lên.</p>'
      + '<textarea id="oc-q" class="oc-q" rows="2" placeholder="Điều bạn muốn hỏi (không bắt buộc)…"></textarea>'
      + '<button class="oc-btn" onclick="ocStart()">Bắt đầu gieo</button>'
      + histLine();
    $('oc-in').innerHTML = h;
    document.documentElement.classList.add('oc-on');
  };
  function histLine() {
    var hs = []; try { hs = JSON.parse(localStorage.getItem(HIST_LS) || '[]'); } catch (e) {}
    if (!hs.length) return '';
    var x = hs[0];
    return '<div class="oc-last">Lần trước: <b>' + esc(x.glyph) + ' ' + esc(x.name) + '</b>' + (x.to ? ' → ' + esc(x.to) : '') + ' · ' + esc(new Date(x.at).toLocaleDateString('vi-VN')) + '</div>';
  }
  window.ocStart = function () {
    var q = $('oc-q'); S.q = q ? q.value.trim() : '';
    renderCast();
    motionOn();
  };
  function coinHTML(i) {
    return '<div class="oc-coin" id="oc-c' + i + '"><b><i class="f"><s>通</s><s>寶</s><s>太</s><s>平</s></i><i class="r"></i></b><em class="num"></em></div>';
  }
  function stackHTML(big) {
    var h = '<div class="oc-stack' + (big ? ' big' : '') + '">';
    for (var k = 5; k >= 0; k--) {
      var t = S.throws[k];
      if (!t) { h += '<div class="oc-l oc-e"><i></i><i></i></div>'; continue; }
      var yang = t.v % 2 === 1, ch = t.v === 6 || t.v === 9;
      h += '<div class="oc-l ' + (yang ? 'yang' : 'yin') + (ch ? ' ch' : '') + (k === S.throws.length - 1 && !big ? ' new' : '') + '"><i></i><i></i>'
        + (ch ? '<u>' + (t.v === 9 ? '○' : '×') + '</u>' : '') + '</div>';
    }
    return h + '</div>';
  }
  function renderCast() {
    var n = S.throws.length;
    var last = S.throws[n - 1];
    var h = head('Lần gieo ' + Math.min(6, n + 1) + ' / 6')
      + '<div class="oc-cast"><div class="oc-coins">' + coinHTML(0) + coinHTML(1) + coinHTML(2) + '</div>' + stackHTML(false) + '</div>'
      + '<div class="oc-status" id="oc-status">' + (last ? 'Hào ' + POS_ZH[n - 1] + ': <b class="num">' + last.v + '</b> · ' + LINE_VI[last.v] : (S.q ? '“' + esc(S.q) + '”' : 'Giữ câu hỏi trong lòng, rồi lắc.')) + '</div>'
      + '<button class="oc-btn" id="oc-shake" onclick="ocThrow()">' + (n ? 'Lắc tiếp' : 'Lắc đồng xu') + '</button>'
      + '<div class="oc-hint">Chạm nút, hoặc lắc nhẹ điện thoại.</div>';
    $('oc-in').innerHTML = h;
    if (last) last.coins.forEach(function (c, i) { setCoin(i, c, false); });
  }
  var coinDeg = [0, 0, 0];
  function setCoin(i, v, spin) {
    var el = $('oc-c' + i); if (!el) return;
    var b = el.querySelector('b');
    // 3 shows the plain side (yang), 2 the inscribed side (yin)
    var face = v === 2 ? 0 : 180;
    var base = Math.ceil(coinDeg[i] / 360) * 360 + (spin ? 1080 + i * 360 : 0);
    coinDeg[i] = base + face;
    b.style.transition = spin ? 'transform ' + (0.95 + i * 0.12) + 's cubic-bezier(.2,.75,.25,1)' : 'none';
    b.style.transform = 'rotateX(' + coinDeg[i] + 'deg)';
    if (spin) { el.classList.remove('toss'); void el.offsetWidth; el.classList.add('toss'); }
    el.querySelector('em').textContent = spin ? '' : v;
  }
  window.ocThrow = function () {
    if (!S || S.busy || S.throws.length >= 6) return;
    S.busy = true;
    var cs = [coin(), coin(), coin()], v = cs[0] + cs[1] + cs[2];
    var btn = $('oc-shake'); if (btn) btn.disabled = true;
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
    cs.forEach(function (c, i) { setCoin(i, c, true); });
    setTimeout(function () { clink(); cs.forEach(function (c, i) { var el = $('oc-c' + i); if (el) el.querySelector('em').textContent = c; }); }, 1150);
    setTimeout(function () {
      S.throws.push({ coins: cs, v: v });
      S.busy = false;
      if (S.throws.length < 6) renderCast();
      else { renderCast(); motionOff(); setTimeout(result, 900); }
    }, 1500);
  };
  /* A soft clink from two short sine partials -- no file to download. */
  var AC = null;
  function clink() {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var t = AC.currentTime;
      [2400, 3170].forEach(function (f, k) {
        var o = AC.createOscillator(), g = AC.createGain();
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 / (k + 1), t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.55);
      });
    } catch (e) {}
  }
  // shaking the phone throws the coins (where the browser lets a page read motion without asking)
  var motionFn = null, lastShake = 0;
  function motionOn() {
    if (motionFn || !window.DeviceMotionEvent || typeof DeviceMotionEvent.requestPermission === 'function') return;
    motionFn = function (e) {
      var a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
      var m = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0);
      if (m > 32 && Date.now() - lastShake > 1700) { lastShake = Date.now(); ocThrow(); }
    };
    window.addEventListener('devicemotion', motionFn);
  }
  function motionOff() { if (motionFn) window.removeEventListener('devicemotion', motionFn); motionFn = null; }

  /* ---------------- the reading ---------------- */
  function reading() {
    var vs = S.throws.map(function (t) { return t.v; });
    var prim = BYPAT[vs.map(function (v) { return v % 2; }).join('')];
    var chg = [];
    vs.forEach(function (v, i) { if (v === 6 || v === 9) chg.push(i + 1); });
    var rel = chg.length ? BYPAT[vs.map(function (v) { return v === 6 ? 1 : v === 9 ? 0 : v % 2; }).join('')] : null;
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
    return { vs: vs, prim: prim, rel: rel, chg: chg, focus: focus };
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
    var nm = it.h.chinese + ' ' + it.h.name.vi;
    if (it.kind === 'judgment') return 'Lời quẻ · ' + nm;
    if (it.kind === 'useall') return (it.h.number === 1 ? '用九' : '用六') + ' · ' + nm;
    return 'Hào ' + lineLabel(it.h, it.k) + ' · ' + nm;
  }
  function hexCard(h, sub) {
    // no Unicode hexagram glyph: system fonts draw it a few pixels tall; the lines are drawn beside it
    var up = DATA.trigrams[h.structure.upper], lo = DATA.trigrams[h.structure.lower];
    return '<div class="oc-name"><div><b>' + esc(h.chinese) + ' <span class="oc-py">' + esc(h.pinyin) + '</span></b>'
      + '<span>' + esc(h.name.vi) + ' · ' + esc(h.name.en) + '</span>'
      + '<small>' + (sub || '') + 'Quẻ ' + h.number + ' · ' + esc(up.vi) + ' (' + esc(up.en) + ') trên ' + esc(lo.vi) + ' (' + esc(lo.en) + ')</small></div></div>';
  }
  function result() {
    load().then(function () {
      var R = reading(); S.R = R;
      var p = R.prim, ip = p.interpretation;
      var h = head(S.q ? 'Quẻ cho câu hỏi của bạn' : 'Quẻ của bạn hôm nay')
        + (S.q ? '<p class="oc-qline">\u201c' + esc(S.q) + '\u201d</p>' : '')
        + '<div class="oc-res">' + stackHTML(true) + '<div class="oc-res-r">' + hexCard(p, '')
        + (R.rel ? '<div class="oc-to"><span>→ quẻ biến</span>' + hexCard(R.rel, '') + '</div>' : '') + '</div></div>'
        + '<div class="oc-theme">' + esc(ip.core_theme) + '</div>'
        // the two or three wise lines: the image, the judgment, today
        + '<div class="oc-wise">'
        + '<div class="oc-w"><i>象</i><div><p class="zh">' + esc(p.original_text.image) + '</p><p>' + esc(ip.traditional_meaning) + '</p></div></div>'
        + '<div class="oc-w"><i>卦</i><div><p class="zh">' + esc(p.original_text.judgment) + '</p>' + (p.legge && p.legge.judgment ? '<p class="en">' + esc(p.legge.judgment) + '</p>' : '') + '</div></div>'
        + '<div class="oc-w"><i>今</i><div><p>' + esc(ip.modern_summary) + '</p></div></div>'
        + '</div>'
        + '<div class="oc-focus"><span class="cz-cap">Lời cần đọc kỹ</span><p class="oc-rule">' + esc(R.focus.rule) + '</p>'
        + R.focus.items.map(function (it) {
            var en = itemEn(it);
            return '<div class="oc-fi' + (it.lead ? ' lead' : '') + '"><b>' + esc(itemTitle(it)) + '</b><p class="zh">' + esc(itemZh(it)) + '</p>'
              + (en ? '<p class="en">' + esc(en) + '</p>' : '') + '</div>';
          }).join('') + '</div>'
        + '<div class="oc-ai" id="oc-ai">' + aiButton() + '</div>'
        + '<p class="oc-remind">' + esc(REMIND) + '</p>'
        + '<div class="oc-acts"><button class="oc-btn ghost" onclick="ocOpen()">Gieo quẻ khác</button><button class="oc-btn" onclick="ocClose()">Xong</button></div>'
        + '<div class="oc-src">Nguyên văn: Chu Dịch (Wikisource) · Bản dịch: James Legge, 1882' + (p.legge ? '' : ' (quẻ này chưa có bản Legge trong nguồn mở)') + '</div>';
      $('oc-in').innerHTML = h;
      $('oc-in').scrollTop = 0;
      save(R);
      if (S.q && window.getKey && window.getKey()) ocAsk();
    });
  }
  function aiButton() {
    if (!(window.getKey && window.getKey())) return '<div class="oc-nokey">Thêm Gemini key trong Settings để cây thông thái giải quẻ theo câu hỏi của bạn.</div>';
    return '<button class="oc-btn soft" onclick="ocAsk()">' + (S.q ? 'Giải quẻ cho câu hỏi của bạn' : 'Giải quẻ cho hôm nay') + '</button>';
  }
  function save(R) {
    var hs = []; try { hs = JSON.parse(localStorage.getItem(HIST_LS) || '[]'); } catch (e) {}
    hs.unshift({ at: Date.now(), q: S.q, n: R.prim.number, glyph: R.prim.symbol, name: R.prim.chinese + ' ' + R.prim.name.vi,
      to: R.rel ? R.rel.symbol + ' ' + R.rel.chinese : '', lines: R.vs.join('') });
    try { localStorage.setItem(HIST_LS, JSON.stringify(hs.slice(0, 30))); } catch (e) {}
  }
  /* The prompt, in the structure the user gave. */
  function promptFor(R) {
    var p = R.prim;
    var div = 'Hexagram ' + p.number + ' ' + p.chinese + ' (' + p.pinyin + ', "' + p.name.en + '")'
      + (R.chg.length ? ', changing line' + (R.chg.length > 1 ? 's ' : ' ') + R.chg.join(', ') + ' → relating hexagram ' + R.rel.number + ' ' + R.rel.chinese + ' ("' + R.rel.name.en + '")' : ', no changing lines')
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
    return 'USER QUESTION:\n' + (S.q || '(No specific question: a general reading for today.)')
      + '\n\nDIVINATION:\n' + div
      + '\n\nSOURCE TEXT:\n' + src.join('\n')
      + '\n\nTRADITIONAL COMMENTARY:\n' + (com.length ? 'James Legge (1882):\n' + com.join('\n') : 'Legge\'s translation of these passages is not in our source; rely on the original text above and its traditional reading.')
      + '\nApp notes on the traditional meaning: ' + p.interpretation.traditional_meaning
      + '\n\nExplain how this symbolism can be reflected on the user\'s question. Do not invent or alter the traditional meaning. Do not claim certainty about the future.'
      + '\nWrite in Vietnamese, calm and warm, in three short paragraphs (about 150 words in all): what the image and the lines say, how they may mirror the question, and one gentle thing to notice or try. No headings, no lists, no fortune-telling.';
  }
  window.ocAsk = async function () {
    var box = $('oc-ai'); if (!box || !S || !S.R) return;
    var key = window.getKey && window.getKey(); if (!key) return;
    box.innerHTML = '<div class="oc-think"><span class="pr-dots"><i></i><i></i><i></i></span>Cây thông thái đang lắng nghe…</div>';
    try {
      var model = window.getModel();
      var gen = { temperature: 0.6, maxOutputTokens: 900 };
      if (/2\.5/.test(model)) gen.thinkingConfig = { thinkingBudget: 0 };
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key);
      var res = await window.geminiPost(url, { contents: [{ parts: [{ text: promptFor(S.R) }] }], generationConfig: gen });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var t = window.geminiText(await res.json()).txt.trim();
      if (!t) throw new Error('EMPTY');
      box.innerHTML = '<div class="oc-read">' + t.split(/\n\s*\n/).map(function (x) { return '<p>' + esc(x.trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>'; }).join('') + '</div>';
    } catch (e) {
      box.innerHTML = '<div class="oc-nokey">Chưa giải được lúc này (' + esc(e.message) + ').</div>' + aiButton();
    }
  };
  window.ocClose = function () {
    motionOff();
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
