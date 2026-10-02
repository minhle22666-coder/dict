/* ============================================================
   GEMINI KEYS: Focci's shared keys, or your own

   The user wanted the app to work out of the box with a set of keys they
   own, a choice between them, an automatic switch when one fails, a dot
   that says which ones answer, and a field for a person's own key.

   The repo is public, so the shared keys are NOT here: they are in the
   Vercel project's GEMINI_KEYS and reached through api/gemini.js. A shared
   choice is stored in sd_key as "focci:N", so every call site that builds
   https://generativelanguage.googleapis.com/...?key=<getKey()> keeps
   working: this file wraps fetch, and a Gemini URL whose key is focci:N is
   sent to /api/gemini instead (which tries N first, then the others). A
   person's own key goes straight to Google, as before; it is also kept in
   sd_key_custom so choosing a shared key does not lose it.

   Defaults, once: no key -> Focci key 1; the model -> gemini-3.1-flash-lite
   (measured: answers a word lookup in 1.4s). Both can be changed in
   Settings > Setup. Loaded before app.js.
   ============================================================ */
(function () {
  'use strict';
  var GL = 'https://generativelanguage.googleapis.com/';
  var N = 5, ST_LS = 'fc_key_status';
  try {
    if (!localStorage.getItem('sd_key')) localStorage.setItem('sd_key', 'focci:1');
    if (!localStorage.getItem('fc_model_v31')) { localStorage.setItem('sd_model', 'gemini-3.1-flash-lite'); localStorage.setItem('fc_model_v31', '1'); }
  } catch (e) {}

  var ST = {};
  try { ST = JSON.parse(localStorage.getItem(ST_LS)) || {}; } catch (e) {}
  function keep() { try { localStorage.setItem(ST_LS, JSON.stringify(ST)); } catch (e) {} }
  function cur() { try { return localStorage.getItem('sd_key') || ''; } catch (e) { return ''; } }
  function shared(k) { var m = /^focci:(\d)$/.exec(k || ''); return m ? +m[1] : 0; }
  function mark(id, ok, code) { ST[id] = { ok: !!ok, code: code || 0, at: Date.now() }; keep(); paint(); }

  /* ---- the switch: a Gemini call on a shared key goes to /api/gemini ---- */
  var f0 = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(GL) === 0) {
      var m = /[?&]key=focci(?:%3A|:)(\d)/i.exec(url);
      if (m) {
        var n = +m[1];
        var path = url.split('/v1beta/')[1].split('?')[0];
        var body = {}; try { body = init && init.body ? JSON.parse(init.body) : {}; } catch (e) {}
        return f0('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: path, body: body, key: n }), signal: init && init.signal })
          .then(function (r) {
            var used = +(r.headers.get('x-focci-key') || 0);
            if (!used) {   // no function behind it: a local copy of the app, not the Vercel one
              return new Response(JSON.stringify({ error: { message: 'Focci’s shared keys work on the online app. Here, use your own key in Settings.' } }), { status: 503, headers: { 'Content-Type': 'application/json' } });
            }
            mark(used, r.ok, r.status);
            // the chosen key failed and another answered: carry on with that one
            if (used !== n) { mark(n, false, 429); try { localStorage.setItem('sd_key', 'focci:' + used); } catch (e) {} if (window.toast) toast('Switched to Focci key ' + used); paint(); }
            return r;
          });
      }
      var own = /[?&]key=([^&]+)/.exec(url);
      var p = f0(input, init);
      if (own && !/^focci/.test(decodeURIComponent(own[1]))) p.then(function (r) { if (r.status !== 499) mark('own', r.ok || r.status === 400, r.status); }).catch(function () {});
      return p;
    }
    return f0(input, init);
  };

  /* ---- checking: which keys answer ---- */
  var checking = false;
  window.akCheck = async function (auto) {
    if (checking) return; checking = true; paint();
    try {
      var r = await f0('/api/gemini?status=1', { cache: 'no-store' });
      if (r.headers.get('content-type') && /json/.test(r.headers.get('content-type'))) {
        var j = await r.json();
        (j.keys || []).forEach(function (k) { ST[k.n] = { ok: k.ok, code: k.code, at: Date.now() }; });
        N = (j.keys || []).length || N;
        /* The function is there but has no keys: GEMINI_KEYS missing, or
           added after the last deploy (Vercel only gives a variable to the
           deploys made after it). Measured on focci.vercel.app: 503 with
           "No shared keys set up". Said as such, not "Online app only". */
        if (!j.keys && r.status === 503) for (var q = 1; q <= N; q++) ST[q] = { ok: false, code: -2, at: Date.now() };
      } else { for (var i = 1; i <= N; i++) ST[i] = { ok: false, code: -1, at: Date.now() }; }
    } catch (e) {}
    var own = ownKey();
    if (own) {
      try { var o = await f0(GL + 'v1beta/models?pageSize=1&key=' + encodeURIComponent(own)); ST.own = { ok: o.ok, code: o.status, at: Date.now() }; } catch (e) { ST.own = { ok: false, code: 0, at: Date.now() }; }
    }
    keep(); checking = false;
    // the chosen shared key does not answer and another does: move to it
    var n = shared(cur());
    if (n && ST[n] && !ST[n].ok) {
      for (var k = 1; k <= N; k++) if (ST[k] && ST[k].ok) { try { localStorage.setItem('sd_key', 'focci:' + k); } catch (e) {} if (!auto && window.toast) toast('Focci key ' + n + ' is not answering — switched to key ' + k); break; }
    }
    paint();
  };

  function ownKey() {
    var f = document.getElementById('key');
    var v = f && f.value.trim();
    if (v && !/^focci:/.test(v)) return v;
    try { return localStorage.getItem('sd_key_custom') || (shared(cur()) ? '' : cur()); } catch (e) { return ''; }
  }
  function dot(id) {
    var s = ST[id];
    if (checking && id !== 'own') return '<i class="ak-dot wait"></i>';
    if (!s) return '<i class="ak-dot"></i>';
    return '<i class="ak-dot ' + (s.ok ? 'ok' : 'bad') + '"></i>';
  }
  function word(id) {
    var s = ST[id];
    if (checking && id !== 'own') return 'Checking…';
    if (!s) return id === 'own' ? '' : 'Not checked';
    if (s.ok) return 'Working';
    if (s.code === -1) return 'Online app only';
    if (s.code === -2) return 'Not set up yet';
    if (s.code === 429) return 'Out of quota for now';
    if (s.code === 400 || s.code === 401 || s.code === 403) return 'Not accepted';
    return 'Not answering';
  }
  /* ---- Settings > Setup ---- */
  function paint() {
    var list = document.getElementById('ak-list'); if (!list) return;
    var k = cur(), n = shared(k), h = '';
    for (var i = 1; i <= N; i++) {
      h += '<button type="button" class="ak-row' + (n === i ? ' on' : '') + '" onclick="akPick(\'focci:' + i + '\')">'
        + dot(i) + '<b>Focci key <span class="num">' + i + '</span></b><em>' + word(i) + '</em><u class="ak-tick"></u></button>';
    }
    list.innerHTML = h;
    var ownRow = document.getElementById('ak-own-row');
    if (ownRow) {
      ownRow.classList.toggle('on', !n && !!k);
      ownRow.querySelector('.ak-dot-slot').innerHTML = dot('own');
      ownRow.querySelector('em').textContent = word('own');
    }
  }
  window.akPick = function (k) {
    if (k === 'own') {
      var v = ownKey();
      if (!v) { var f = document.getElementById('key'); if (f) f.focus(); return; }
      k = v;
    }
    try { localStorage.setItem('sd_key', k); } catch (e) {}
    paint();
    if (window.toast) toast(shared(k) ? 'Using Focci key ' + shared(k) : 'Using your own key');
  };
  // what Save setup stores (app.js): a key typed into the field since the
  // last save means "use my own key"; otherwise whichever row is picked
  var ownDirty = false;
  window.akChosen = function () {
    var f = document.getElementById('key'), v = f ? f.value.trim() : '';
    if (ownDirty && v && !/^focci:/.test(v)) {
      ownDirty = false;
      try { localStorage.setItem('sd_key_custom', v); } catch (e) {}
      ST.own = null; setTimeout(function () { akCheck(true); }, 50);
      return v;
    }
    return cur() || 'focci:1';
  };
  window.akOwnValue = function () { try { return localStorage.getItem('sd_key_custom') || (shared(cur()) ? '' : cur()); } catch (e) { return ''; } };
  document.addEventListener('DOMContentLoaded', function () {
    paint();
    var f = document.getElementById('key');
    if (f) f.addEventListener('input', function () { ownDirty = true; });
  });
  // a quiet check when Settings opens, at most every 10 minutes
  window.akMaybeCheck = function () { var last = 0; for (var i = 1; i <= N; i++) if (ST[i] && ST[i].at > last) last = ST[i].at; if (Date.now() - last > 600000) akCheck(true); else paint(); };
})();
