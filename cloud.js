/* ============================================================
   CLOUD SAVE: an account, so a cleared browser loses nothing

   Focci is opened from a bookmark or the home screen (it is not in the App
   Store), and everything it remembers lives in that browser: clear Safari,
   delete the bookmark, add it to the home screen again (a home-screen app
   on iOS has storage of its own, separate from Safari), change phones --
   and the recent searches, saved words, XP, animals and games are gone.
   Signing in keeps a copy in the person's own row in Supabase
   (supabase/setup.sql; row-level security, so a person reaches only their
   own row).

   Sign-in is email + password, with "Confirm email" off in Supabase, so
   no email is ever sent. Both email ways were tried first -- a 6-digit
   code, then a magic link -- and Supabase's free mail service answered
   500 "Error sending confirmation email" for every address. It also works
   inside a home-screen app, which a link (opening Safari) could not reach.
   (The link handling below, fromLink, stays for links sent before.)

   What is saved (one JSON document):
   - localStorage keys starting sd_ or fc_ (XP, streaks, quests, history,
     journal, animals, gifts, game settings, radio favourites...), except
     the Gemini key and per-device bookkeeping (NO_SYNC);
   - the IndexedDB entries that are the person's: words the AI wrote
     (source ai / phrase / explain) and any word saved or reviewed;
   - the event log (searches, answers: what the streaks and Recent read).
   Not the dictionary: every device has that.

   Sync: after sign-in, the cloud copy is compared with this device. One
   side empty -> the other is used; both have progress -> they are put
   together, value by value (mergeJ), and the result saved to the account:
   what was done before signing in is never lost. After that, any
   change marks the copy dirty and it is saved 20s after the last change,
   and when the app goes to the background.
   ============================================================ */
(function () {
  'use strict';
  var CFG = window.FC_CLOUD || {};
  var ON = !!(CFG.url && CFG.anonKey);
  /* The library ships with the app (vendor/supabase.js, the same UMD build):
     fetched from a CDN, a home-screen app on a slow line waited seconds for
     it, or never got it, and looked signed out the whole time -- "I signed
     in, and when I came back it said I had not". The service worker keeps
     the local copy for offline. The CDN is only the fallback. */
  var LIB = './vendor/supabase.js', LIB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
  var NO_SYNC = { sd_key: 1, sd_key_custom: 1, fc_key_status: 1, sd_merged_seeds: 1, fc_dict_applied: 1, fc_sleep_at: 1, fc_cloud_meta: 1, fc_freedict: 1, fc_scan: 1, fc_cloud_who: 1 };
  var WHO_LS = 'fc_cloud_who';   // { uid, email }: who is signed in here, to show at once on the next open
  var META_LS = 'fc_cloud_meta';
  var sb = null, user = null, dirty = false, saveT = 0, busy = false, lastSaved = 0, libP = null, saveErr = '', resolving = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function meta() { try { return JSON.parse(localStorage.getItem(META_LS)) || {}; } catch (e) { return {}; } }
  function setMeta(m) { try { localStorage.setItem(META_LS, JSON.stringify(m)); } catch (e) {} }
  function ago(t) {
    if (!t) return 'not yet';
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 50) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return new Date(t).toLocaleDateString();
  }

  /* ---------------- the library, loaded only when it is needed ---------------- */
  function lib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    if (libP) return libP;
    var load = function (src) {
      return new Promise(function (res, rej) {
        var s = document.createElement('script'); s.src = src; s.async = true;
        s.onload = function () { window.supabase && window.supabase.createClient ? res(window.supabase) : rej(new Error('no supabase')); };
        s.onerror = function () { rej(new Error('Could not reach the sign-in service')); };
        document.head.appendChild(s);
      });
    };
    libP = load(LIB).catch(function () { return load(LIB_CDN); }).catch(function (e) { libP = null; throw e; });
    return libP;
  }
  function who() { try { return JSON.parse(localStorage.getItem(WHO_LS)) || null; } catch (e) { return null; } }
  function setWho(u) { try { if (u) localStorage.setItem(WHO_LS, JSON.stringify({ uid: u.id, email: u.email })); else localStorage.removeItem(WHO_LS); } catch (e) {} }
  function client() {
    if (sb) return Promise.resolve(sb);
    return lib().then(function (S) {
      /* lock: supabase-js guards its session with navigator.locks (Web
         Locks). A home-screen app on iOS is frozen in the background and
         thawed later, and a lock held across that can stay held: every
         request after it waits on getSession() for good -- the button sat
         on "Saving..." and the account looked signed out on the next open.
         Focci is one tab, so there is nothing to guard against; the lock
         just runs the job. (gotrue still queues its own nested calls.) */
      sb = S.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'fc-cloud-auth',
        lock: function (name, timeout, fn) { return fn(); } } });
      sb.auth.onAuthStateChange(function (ev, session) {
        // a session that was there and is gone (expired, signed out elsewhere) -- not the first quiet INITIAL_SESSION
        if (session) { user = session.user; setWho(user); }
        else if (ev === 'SIGNED_OUT') { user = null; setWho(null); }
        paintBadge();
      });
      return sb;
    });
  }

  /* ---------------- what is saved ---------------- */
  function isMine(k) { return /^(sd_|fc_)/.test(k) && !NO_SYNC[k]; }
  async function collect() {
    var ls = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (isMine(k)) ls[k] = localStorage.getItem(k); }
    var entries = [];
    try {
      var all = typeof idbAllCached === 'function' ? await idbAllCached() : [];
      // the person's own words; not aliases (spelling pointers the app rebuilds) and not the plain dictionary
      entries = all.filter(function (r) { return r && !r.alias && ((r.source && r.source !== 'seed') || r.saved || r.savedAt || r.lastReviewedAt); });
    } catch (e) {}
    var log = [];
    try { log = typeof logAll === 'function' ? (await logAll()).map(function (e) { return { ts: e.ts, type: e.type, word: e.word || null }; }) : []; } catch (e) {}
    return { v: 1, at: Date.now(), ls: ls, entries: entries, log: log };
  }
  /* How much real progress a copy holds. Not "any key": a brand-new phone
     writes a dozen defaults and an 'open' event at start, and must still
     count as empty so the account's copy simply comes back. */
  function weight(d) {
    if (!d) return 0;
    var acts = (d.log || []).filter(function (e) { return e.type !== 'open'; }).length;
    var xp = +((d.ls || {}).sd_xp) || 0;
    return acts + (d.entries || []).length + (xp > 0 ? 1 : 0);
  }

  /* Two copies of one value put together (the user: what was made on this
     phone before signing in must join the account's, not vanish). Numbers
     keep the bigger (XP, totals, streaks); lists keep every item once (the
     same word, day or id is one item, the newer of the two by t/ts);
     objects are merged key by key, the same rules all the way down; a
     plain string stays as this phone has it. */
  function mergeJ(A, B) {
    if (typeof A === 'number' && typeof B === 'number') return Math.max(A, B);
    if (Array.isArray(A) && Array.isArray(B)) {
      var at = {}, out = [];
      var keyOf = function (x) { return x && typeof x === 'object' ? String(x.w || x.word || x.id || x.date || x.day || JSON.stringify(x)) : JSON.stringify(x); };
      A.concat(B).forEach(function (x) {
        var k = keyOf(x);
        if (at[k] === undefined) { at[k] = out.length; out.push(x); return; }
        var y = out[at[k]];
        if (x && y && typeof x === 'object' && typeof y === 'object') out[at[k]] = ((x.t || x.ts || 0) > (y.t || y.ts || 0)) ? mergeJ(x, y) : mergeJ(y, x);
      });
      return out;
    }
    if (A && B && typeof A === 'object' && typeof B === 'object') {
      var o = {};
      Object.keys(B).forEach(function (k) { o[k] = B[k]; });
      Object.keys(A).forEach(function (k) { o[k] = (k in B) ? mergeJ(A[k], B[k]) : A[k]; });
      return o;
    }
    return A == null ? B : A;
  }
  function mergeVal(a, b) {
    var A, B;
    try { A = JSON.parse(a); B = JSON.parse(b); } catch (e) { return a; }
    var m = mergeJ(A, B);
    return typeof m === 'string' ? m : JSON.stringify(m);
  }
  async function apply(d, mode) {
    // mode: 'cloud' (the account's copy onto an empty phone), 'merge' (both put together)
    var local = mode === 'merge' ? await collect() : null;
    var ls = d.ls || {};
    Object.keys(ls).forEach(function (k) {
      if (!isMine(k)) return;
      var v = (mode === 'merge' && local.ls[k] != null) ? mergeVal(local.ls[k], ls[k]) : ls[k];
      try { localStorage.setItem(k, v); } catch (e) {}
    });
    var have = {};
    if (local) local.entries.forEach(function (r) { have[r.word] = r; });
    for (var i = 0; i < (d.entries || []).length; i++) {
      var r = d.entries[i]; if (!r || r.word == null) continue;
      var mine = have[r.word];
      if (mine && (mine.savedAt || 0) >= (r.savedAt || 0) && (mine.lastReviewedAt || 0) >= (r.lastReviewedAt || 0)) continue;
      try { await idbPut(r); } catch (e) {}
    }
    if (d.log && d.log.length && typeof logAdd === 'function') {
      var seen = {};
      (local ? local.log : (typeof logAll === 'function' ? await logAll() : [])).forEach(function (e) { seen[e.ts + '|' + e.type + '|' + (e.word || '')] = 1; });
      for (var j = 0; j < d.log.length; j++) {
        var e = d.log[j], key = e.ts + '|' + e.type + '|' + (e.word || '');
        if (seen[key]) continue; seen[key] = 1;
        try { await logAdd({ ts: e.ts, type: e.type, word: e.word || null }); } catch (x) {}
      }
    }
  }

  async function save(why) {
    if (!ON || !user || busy) return;
    busy = true; clearTimeout(saveT);
    try {
      var d = await collect();
      var res = await Promise.race([
        sb.from('user_state').upsert({ user_id: user.id, data: d, device: (navigator.userAgent || '').slice(0, 120), updated_at: new Date().toISOString() }),
        new Promise(function (_, rej) { setTimeout(function () { rej(new Error('no answer in 20s')); }, 20000); })
      ]);
      if (res.error) throw res.error;
      dirty = false; lastSaved = Date.now(); saveErr = '';
      var m = meta(); m.savedAt = lastSaved; m.uid = user.id; setMeta(m);
    } catch (e) {
      console.warn('cloud save failed', why, e && e.message);
      dirty = true;
      saveErr = (e && (e.message || e.error_description)) || 'no connection';
      // the session itself is gone: say so instead of failing quietly forever
      if (/jwt|token|auth|session|401/i.test(saveErr)) { try { var g = await sb.auth.getSession(); if (!g.data.session) { user = null; setWho(null); saveErr = ''; } } catch (x) {} }
    } finally { busy = false; paintBadge(); }
  }
  function markDirty() {
    if (!ON || !user) { dirty = true; return; }
    dirty = true; clearTimeout(saveT);
    saveT = setTimeout(function () { save('change'); }, 20000);
  }
  // every change to the person's data marks the copy: localStorage writes, words, the log
  (function hook() {
    var set = Storage.prototype.setItem, rem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k, v) { set.apply(this, arguments); if (this === window.localStorage && isMine(k)) markDirty(); };
    Storage.prototype.removeItem = function (k) { rem.apply(this, arguments); if (this === window.localStorage && isMine(k)) markDirty(); };
    var wrap = function (name) {
      var f = window[name]; if (typeof f !== 'function') return;
      window[name] = function () { var r = f.apply(this, arguments); markDirty(); return r; };
    };
    wrap('idbPut'); wrap('logAdd');
  })();
  document.addEventListener('visibilitychange', function () { if (document.hidden && dirty && user) save('hidden'); });

  /* ---------------- after sign-in: which copy? ---------------- */
  async function reconcile() {
    var r = await sb.from('user_state').select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (r.error) throw r.error;
    var cloud = r.data && r.data.data, local = await collect();
    var m = meta();
    if (!cloud || !weight(cloud)) { await save('first'); return 'saved'; }
    if (!weight(local) || m.uid === user.id && m.savedAt && m.savedAt >= Date.parse(r.data.updated_at) - 1000) {
      if (!weight(local)) { await apply(cloud, 'cloud'); m.uid = user.id; m.savedAt = Date.now(); setMeta(m); return 'restored'; }
      await save('resume'); return 'saved';
    }
    // both have progress: put them together, then save the result to the account
    await apply(cloud, 'merge');
    m.uid = user.id; setMeta(m);
    await save('merged');
    return 'merged';
  }

  /* ---------------- the sheet ---------------- */
  var view = 'start', email = '', pending = null, err = '';
  function dom() {
    if ($('cl-scrim')) return;
    var d = document.createElement('div');
    d.innerHTML = '<div class="cl-scrim" id="cl-scrim" onclick="if(event.target===this)fcCloudClose()"><div class="cl-sheet" id="cl-sheet" data-noswipe="1"></div></div>';
    document.body.appendChild(d.firstChild);
  }
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5H7Z"/><path d="m9.5 13 2 2 3.5-4"/></svg>';
  function paintSheet() {
    var s = $('cl-sheet'); if (!s || !$('cl-scrim').classList.contains('on')) return;
    var h = '<button class="cl-x" onclick="fcCloudClose()" aria-label="Close">×</button><div class="cl-ic">' + ICON + '</div>';
    if (!ON) {
      h += '<h3>Cloud save is not set up yet</h3><p>Add the Supabase project URL and anon key to <b>cloud-config.js</b>.</p>';
    } else if (user && !/^(choose|merged|done|signing)$/.test(view)) {
      h += '<h3 class="cl-hello">' + nameHTML('sheet') + '</h3>'
        + '<p>Your little world is connected to <b>' + esc(user.email || '') + '</b>. Your searches, saved words, XP, animals and games are kept in your account.</p>'
        + '<div class="cl-stat"><span>Last saved</span><b class="num">' + esc(ago(lastSaved || meta().savedAt)) + '</b></div>'
        + (saveErr ? '<div class="cl-err">Could not save just now (' + esc(saveErr) + '). Check the connection and tap Save now.</div>' : '')
        + '<button class="cl-go" onclick="fcCloudSaveNow()"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Saving…' : 'Save now') + '</button>'
        + '<button class="cl-ghost" onclick="fcCloudSignOut()">Sign out</button>'
        + '<small>Signing out keeps everything on this phone. Sign in on another phone or browser with the same email to bring it there.</small>';
    } else if (!user && resolving) {
      h += '<h3>Checking your account…</h3><p>One moment' + (who() ? ', <b>' + esc(who().email) + '</b>' : '') + '.</p>';
    } else if (!user && who()) {
      // still signed in on this phone, but the account service is out of reach (offline)
      h += '<h3>' + nameHTML('sheet') + '</h3><p>You are still signed in as <b>' + esc(who().email) + '</b>, but your account cannot be reached right now. Keep playing — everything stays on this phone and is saved when the connection is back.</p>'
        + '<button class="cl-go" onclick="fcCloudRetry()">Try again</button>';
    } else if (view === 'sent') {
      h += '<h3>Check your email</h3><p>We sent a sign-in link to <b>' + esc(email) + '</b>. Open it on this phone and tap <b>Log in</b> — Focci opens and brings your world with it.</p>'
        + (err ? '<div class="cl-err">' + esc(err) + '</div>' : '')
        + '<div class="cl-stat"><span>No email?</span><b>Look in Spam or Promotions</b></div>'
        + '<div class="cl-row"><button class="cl-link" onclick="fcCloudSend()">Send it again</button><button class="cl-link" onclick="fcCloudView(\'start\')">Use another email</button></div>';
    } else if (view === 'signing') {
      h += '<h3>Signing you in…</h3><p>Fetching your little world from your account.</p>';
    } else if (view === 'choose' && pending) {
      h += '<h3>Two copies of your world</h3><p>This phone and your account both have progress. Which should Focci keep?</p>'
        + '<button class="cl-pick on" onclick="fcCloudPick(\'merge\')"><b>Keep both</b><span>Put this phone’s and the account’s together. Recommended.</span></button>'
        + '<button class="cl-pick" onclick="fcCloudPick(\'cloud\')"><b>Use the account’s</b><span>Saved <span class="num">' + esc(ago(pending.cloudAt)) + '</span> · <span class="num">' + (pending.cloud.log || []).length + '</span> activities</span></button>'
        + '<button class="cl-pick" onclick="fcCloudPick(\'local\')"><b>Use this phone’s</b><span><span class="num">' + (pending.local.log || []).length + '</span> activities · replaces the account’s copy</span></button>';
    } else if (view === 'merged') {
      h += '<h3>All together now</h3><p>What you did on this phone has joined your account’s progress — nothing was lost. Focci is reloading…</p>';
    } else if (view === 'done') {
      h += '<h3>Welcome back</h3><p>Your little world has been brought back. Focci is reloading it…</p>';
    } else {
      h += '<h3>Keep your little world safe</h3>'
        + '<p>Sign in and Focci keeps your <b>recent searches, saved words, XP, animals and games</b> in your account. Clear Safari, lose the bookmark or change phones — sign in again and it all comes back.</p>'
        + '<input id="cl-email" class="cl-in" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" value="' + esc(email) + '"/>'
        + '<div class="cl-pw"><input id="cl-pass" class="cl-in" type="password" autocomplete="current-password" placeholder="Password (6+ characters)" onkeydown="if(event.key===\'Enter\')fcCloudSend()"/>'
        + '<button type="button" class="cl-eye" onclick="var i=document.getElementById(\'cl-pass\');i.type=i.type===\'password\'?\'text\':\'password\'" aria-label="Show password">Show</button></div>'
        + (err ? '<div class="cl-err">' + esc(err) + '</div>' : '')
        + '<button class="cl-go" onclick="fcCloudSend()">' + (busy ? 'Signing in…' : 'Continue') + '</button>'
        + '<small>New here? This makes your account. Everything you have done so far stays and joins it. No email is sent — just remember your password to sign in on another phone.</small>'
        + '<div class="cl-forgot"><b>Forgot your password?</b> Contact mpt ^o^</div>';
    }
    s.innerHTML = h;
    var f = $('cl-email'); if (f && !busy) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  /* "Hello, Minh": once signed in the person sees their own name, so they
     know the account is connected and their world is being kept. The name
     starts as the email's first word (minh.le22@... -> Minh) and the pencil
     beside it changes it, in place. It lives in sd_name -- the app's own
     name key, saved with everything else -- and in the account's metadata. */
  var PEN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>';
  var OK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  function fromEmail(e) {
    var w = String(e || '').split('@')[0].split(/[._\-+\d]+/).filter(Boolean)[0] || '';
    return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : 'friend';
  }
  function myName() {
    var n = ''; try { n = localStorage.getItem('sd_name') || ''; } catch (e) {}
    if (!n && user) n = (user.user_metadata && user.user_metadata.name) || fromEmail(user.email);
    if (!n && !user) { var w = who(); if (w) n = fromEmail(w.email); }
    return n || 'friend';
  }
  function setName(n) {
    n = String(n || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!n) { paintBadge(); return; }   // an emptied field keeps the old name
    try { localStorage.setItem('sd_name', n); } catch (e) {}
    if (sb && user) sb.auth.updateUser({ data: { name: n } }).catch(function () {});
    if (typeof renderHero === 'function') try { renderHero(); } catch (e) {}
    paintBadge();
  }
  function nameHTML(where) {
    return '<span class="cl-hi">Hello, <b class="cl-name" id="cl-name-' + where + '">' + esc(myName()) + '</b></span>'
      + '<span class="cl-pen" role="button" aria-label="Change your name" onclick="event.stopPropagation();fcCloudRename(\'' + where + '\')">' + PEN + '</span>';
  }
  function paintBadge() {
    document.documentElement.classList.toggle('cl-signed', !!user);
    var chip = $('cz-cloud');
    if (chip && !chip.querySelector('input')) {
      chip.innerHTML = user
        ? '<span class="cl-dot">' + OK + '</span>' + nameHTML('chip') + '<span class="cl-saved">Saved</span>'
        : chip.dataset.out || chip.innerHTML;
    }
    if (!user) provisional();
    paintSheet();
  }
  window.fcCloudRename = function (where) {
    var b = $('cl-name-' + where); if (!b) return;
    var inp = document.createElement('input');
    inp.className = 'cl-name-in'; inp.value = myName(); inp.maxLength = 24; inp.setAttribute('aria-label', 'Your name');
    inp.addEventListener('click', function (e) { e.stopPropagation(); });
    // the field goes first: the chip is not repainted while a field is in it
    var done = false, finish = function (keep) { if (done) return; done = true; var v = inp.value; inp.remove(); if (keep) setName(v); else paintBadge(); };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') finish(false); });
    inp.addEventListener('blur', function () { finish(true); });
    b.replaceWith(inp);
    var pen = inp.parentNode && inp.parentNode.parentNode && inp.parentNode.parentNode.querySelector('.cl-pen'); if (pen) pen.style.display = 'none';
    inp.focus(); inp.select();
  };

  window.fcCloudOpen = function () {
    dom(); err = '';
    if (view !== 'sent' && view !== 'choose' && view !== 'signing') view = 'start';
    $('cl-scrim').classList.add('on');
    paintSheet();
    if (ON) resume();
  };
  window.fcCloudClose = function () { var s = $('cl-scrim'); if (s) s.classList.remove('on'); };
  window.fcCloudView = function (v) { view = v; err = ''; paintSheet(); };
  /* Email + password. The magic link could not be used: Supabase's free
     mail service answered 500 "Error sending confirmation email" for every
     address (measured, a throwaway one too). With "Confirm email" turned
     off in Supabase, an account opens at once and no email is ever sent.
     One button: sign in; if no such account, make it. Supabase answers
     "Invalid login credentials" both for a wrong password and for no
     account, so a sign-up decides: an existing email comes back with no
     identities (wrong password), a new one with a session. */
  window.fcCloudSend = async function () {
    var f = $('cl-email'), pw = $('cl-pass'); if (f) email = f.value.trim();
    var pass = pw ? pw.value : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err = 'That email does not look right.'; view = 'start'; paintSheet(); return; }
    if (pass.length < 6) { err = 'The password needs at least 6 characters.'; view = 'start'; paintSheet(); return; }
    busy = true; err = ''; paintSheet();
    try {
      var c = await client();
      var r = await c.auth.signInWithPassword({ email: email, password: pass });
      if (r.error) {
        if (/not confirmed/i.test(r.error.message || '')) throw new Error('This account is waiting for an email that cannot be sent. In Supabase, turn off “Confirm email”, then try again.');
        if (!/invalid login/i.test(r.error.message || '')) throw r.error;
        var u = await c.auth.signUp({ email: email, password: pass });
        if (u.error) throw (/sending|confirm/i.test(u.error.message || '') ? new Error('Almost there: in Supabase, turn off “Confirm email” so accounts open without an email.') : u.error);
        if (!u.data.session) {
          if (u.data.user && u.data.user.identities && u.data.user.identities.length === 0) throw new Error('That password is not right for this email.');
          throw new Error('Almost there: in Supabase, turn off “Confirm email” so accounts open without an email.');
        }
        user = u.data.user;
      } else user = r.data.user;
      setWho(user);
      busy = false; view = 'signing'; paintBadge();
      await finishSignIn();
    } catch (e) { busy = false; err = /rate|limit/i.test(e.message || '') ? 'Too many tries just now — wait a minute and try again.' : (e.message || 'Could not sign in.'); view = 'start'; paintSheet(); }
  };
  /* After the link: the session is there (supabase-js read it from the
     URL); bring the two copies together the same way as before. */
  async function finishSignIn() {
    try {
      var had = ''; try { had = localStorage.getItem('sd_name') || ''; } catch (e) {}
      if (!had && user) setName((user.user_metadata && user.user_metadata.name) || fromEmail(user.email));
      var out = await reconcile();
      if (out && out.choose) { pending = out; view = 'choose'; paintSheet(); return; }
      if (out === 'restored' || out === 'merged') { view = out === 'merged' ? 'merged' : 'done'; paintSheet(); setTimeout(function () { location.reload(); }, 1600); return; }
      view = 'start'; paintBadge();
      if (window.fwToast) fwToast('Hello, ' + myName() + ' — your world is saved');
    } catch (e) { view = 'start'; err = e.message || 'Could not reach your account.'; paintSheet(); }
  }
  window.fcCloudPick = async function (mode) {
    if (!pending) return;
    var p = pending; pending = null;
    if (mode === 'local') { view = 'start'; await save('keep-local'); paintBadge(); return; }
    view = 'done'; paintSheet();
    await apply(p.cloud, mode);
    var m = meta(); m.uid = user.id; setMeta(m);
    await save('after-' + mode);
    setTimeout(function () { location.reload(); }, 900);
  };
  window.fcCloudSaveNow = function () {
    if (busy) return;
    var p = save('button'); paintSheet();
    p.then(function () { if (window.fwToast) fwToast(saveErr ? 'Could not save — try again' : 'Saved to your account'); });
  };
  window.fcCloudSignOut = async function () {
    try { if (dirty) await save('signout'); await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
    user = null; setWho(null); view = 'start'; paintBadge();
  };
  window.fcCloudBack = function () { var s = $('cl-scrim'); if (s && s.classList.contains('on')) { fcCloudClose(); return true; } return false; };
  window.fcCloudCollect = collect;   // for diagnosis: what a save would send
  window.fcCloudState = function () { return { on: ON, user: user && user.email, dirty: dirty, lastSaved: lastSaved || meta().savedAt || 0 }; };

  /* Arriving from the email link: the address carries #access_token=...
     (or #error_description= when the link is old). Load the library at
     once, let it take the session, tidy the address, and finish. */
  (function fromLink() {
    var h = location.hash || '';
    if (!ON || !/access_token=|error_description=/.test(h)) return;
    var bad = /error_description=([^&]+)/.exec(h);
    var start = function () {
      dom(); $('cl-scrim').classList.add('on');
      if (bad) { view = 'start'; err = decodeURIComponent(bad[1].replace(/\+/g, ' ')) + ' — ask for a new link.'; paintSheet(); history.replaceState(null, '', location.pathname + location.search); return; }
      view = 'signing'; paintSheet();
      client().then(function (c) { return c.auth.getSession(); }).then(function (r) {
        history.replaceState(null, '', location.pathname + location.search);
        user = r.data.session ? r.data.session.user : null;
        if (!user) { view = 'start'; err = 'That link did not sign you in. Ask for a new one.'; paintSheet(); return; }
        paintBadge(); finishSignIn();
      }).catch(function (e) { view = 'start'; err = e.message; paintSheet(); });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  })();

  /* Already signed in on this device. The name shows at once from WHO_LS
     (no library needed), and the session is confirmed in the background;
     only if Supabase really has no session any more does it go back to
     "Sign in". Run at start and whenever the app comes back to the front
     (a home-screen app is often resumed, not reloaded). */
  function resume() {
    if (!ON || resolving) return Promise.resolve();
    var has = false; try { has = !!localStorage.getItem('fc-cloud-auth'); } catch (e) {}
    if (!has) { if (who()) setWho(null); paintBadge(); return Promise.resolve(); }
    resolving = true; paintSheet();
    return client().then(function (c) { return c.auth.getSession(); }).then(function (r) {
      resolving = false;
      var was = who();
      user = r.data.session ? r.data.session.user : null;
      if (user) { setWho(user); if (dirty) markDirty(); }
      else if (was) { setWho(null); email = was.email || email; view = 'start'; if (window.fwToast) fwToast('Signed out — sign in again to keep saving'); }
      paintBadge();
    }).catch(function () { resolving = false; paintBadge(); });
  }
  window.fcCloudRetry = function () { resume(); };
  // the name at once, before the library has loaded
  function provisional() {
    var w = who(); if (!ON || !w || user) return;
    var chip = $('cz-cloud'); if (!chip) return;
    if (chip.querySelector('input')) return;
    document.documentElement.classList.add('cl-signed');
    chip.innerHTML = '<span class="cl-dot">' + OK + '</span>' + nameHTML('chip') + '<span class="cl-saved">' + (resolving ? '…' : 'Saved') + '</span>';
  }
  var start = function () { provisional(); setTimeout(resume, 300); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !user) resume(); });
})();
