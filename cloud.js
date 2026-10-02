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

   Sign-in is a link sent by email (the user could not get the 6-digit
   code template working). signInWithOtp sends it with emailRedirectTo =
   this page's own address; the link comes back here with the session in
   the URL's #fragment (implicit flow, so it also works when the email is
   opened in another browser than the one that asked), supabase-js reads
   it, and the sheet opens to finish. The catch on iPhone: the link opens
   Safari, and iOS keeps a home-screen copy's storage apart from Safari's,
   so the account lands in Safari's copy.

   What is saved (one JSON document):
   - localStorage keys starting sd_ or fc_ (XP, streaks, quests, history,
     journal, animals, gifts, game settings, radio favourites...), except
     the Gemini key and per-device bookkeeping (NO_SYNC);
   - the IndexedDB entries that are the person's: words the AI wrote
     (source ai / phrase / explain) and any word saved or reviewed;
   - the event log (searches, answers: what the streaks and Recent read).
   Not the dictionary: every device has that.

   Sync: after sign-in, the cloud copy is compared with this device. One
   side empty -> the other is used; both have data -> the person chooses
   (merge both, the default; the cloud's; this device's). After that, any
   change marks the copy dirty and it is saved 20s after the last change,
   and when the app goes to the background.
   ============================================================ */
(function () {
  'use strict';
  var CFG = window.FC_CLOUD || {};
  var ON = !!(CFG.url && CFG.anonKey);
  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
  var NO_SYNC = { sd_key: 1, sd_merged_seeds: 1, fc_dict_applied: 1, fc_sleep_at: 1, fc_cloud_meta: 1, fc_freedict: 1, fc_scan: 1 };
  var META_LS = 'fc_cloud_meta';
  var sb = null, user = null, dirty = false, saveT = 0, busy = false, lastSaved = 0, libP = null;

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
    libP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = LIB; s.async = true;
      s.onload = function () { window.supabase ? res(window.supabase) : rej(new Error('no supabase')); };
      s.onerror = function () { libP = null; rej(new Error('Could not reach the sign-in service')); };
      document.head.appendChild(s);
    });
    return libP;
  }
  function client() {
    if (sb) return Promise.resolve(sb);
    return lib().then(function (S) {
      sb = S.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'fc-cloud-auth' } });
      sb.auth.onAuthStateChange(function (ev, session) { user = session ? session.user : null; paintBadge(); });
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

  async function apply(d, mode) {
    // mode: 'cloud' (the cloud's wins), 'merge' (both, newest wins per word)
    var local = mode === 'merge' ? await collect() : null;
    var ls = d.ls || {};
    Object.keys(ls).forEach(function (k) {
      if (!isMine(k)) return;
      if (mode === 'merge' && local.ls[k] != null) {
        // a number keeps the bigger (XP, totals); anything else stays as this device has it
        var a = +local.ls[k], b = +ls[k];
        if (!isNaN(a) && !isNaN(b) && String(a) === local.ls[k] && String(b) === ls[k]) { if (b > a) localStorage.setItem(k, ls[k]); }
        return;
      }
      try { localStorage.setItem(k, ls[k]); } catch (e) {}
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
      var res = await sb.from('user_state').upsert({ user_id: user.id, data: d, device: (navigator.userAgent || '').slice(0, 120), updated_at: new Date().toISOString() });
      if (res.error) throw res.error;
      dirty = false; lastSaved = Date.now();
      var m = meta(); m.savedAt = lastSaved; m.uid = user.id; setMeta(m);
      paintSheet();
    } catch (e) {
      console.warn('cloud save failed', why, e && e.message);
      dirty = true;
    } finally { busy = false; }
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
    return { choose: true, cloud: cloud, cloudAt: Date.parse(r.data.updated_at), local: local };
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
    } else if (user && view !== 'choose') {
      h += '<h3>Your little world is safe</h3>'
        + '<p>Signed in as <b>' + esc(user.email || '') + '</b>. Your searches, saved words, XP, animals and games are kept in your account.</p>'
        + '<div class="cl-stat"><span>Last saved</span><b class="num">' + esc(ago(lastSaved || meta().savedAt)) + '</b></div>'
        + '<button class="cl-go" onclick="fcCloudSaveNow()"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Saving…' : 'Save now') + '</button>'
        + '<button class="cl-ghost" onclick="fcCloudSignOut()">Sign out</button>'
        + '<small>Signing out keeps everything on this phone. Sign in on another phone or browser with the same email to bring it there.</small>';
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
    } else if (view === 'done') {
      h += '<h3>Welcome back</h3><p>Your little world has been brought back. Focci is reloading it…</p>';
    } else {
      h += '<h3>Keep your little world safe</h3>'
        + '<p>Sign in with your email and Focci keeps your <b>recent searches, saved words, XP, animals and games</b> in your account. Clear Safari, lose the bookmark or change phones — sign in again and it all comes back.</p>'
        + '<input id="cl-email" class="cl-in" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" value="' + esc(email) + '"/>'
        + (err ? '<div class="cl-err">' + esc(err) + '</div>' : '')
        + '<button class="cl-go" onclick="fcCloudSend()">' + (busy ? 'Sending…' : 'Email me a sign-in link') + '</button>'
        + '<small>No password. Your email is used only to sign you in.</small>';
    }
    s.innerHTML = h;
    var f = $('cl-email'); if (f && !busy) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  function paintBadge() {
    document.documentElement.classList.toggle('cl-signed', !!user);
    var b = document.querySelectorAll('.cl-who'); b.forEach(function (x) { x.textContent = user ? 'Saved to ' + (user.email || 'your account') : 'Not signed in'; });
    paintSheet();
  }

  window.fcCloudOpen = function () {
    dom(); err = '';
    if (view !== 'sent' && view !== 'choose' && view !== 'signing') view = 'start';
    $('cl-scrim').classList.add('on');
    paintSheet();
    if (ON) client().then(function (c) { return c.auth.getSession(); }).then(function (r) { user = r.data.session ? r.data.session.user : null; paintSheet(); }).catch(function (e) { err = e.message; paintSheet(); });
  };
  window.fcCloudClose = function () { var s = $('cl-scrim'); if (s) s.classList.remove('on'); };
  window.fcCloudView = function (v) { view = v; err = ''; paintSheet(); };
  window.fcCloudSend = async function () {
    var f = $('cl-email'); if (f) email = f.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err = 'That email does not look right.'; view = 'start'; paintSheet(); return; }
    busy = true; err = ''; paintSheet();
    try {
      var c = await client();
      // the link comes back to exactly this page (the Vercel address once deployed)
      var back = location.origin + location.pathname;
      var r = await c.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true, emailRedirectTo: back } });
      if (r.error) throw r.error;
      view = 'sent';
    } catch (e) { err = /rate|limit/i.test(e.message || '') ? 'Too many emails asked for just now — wait a little and try again.' : (e.message || 'Could not send the email.'); }
    busy = false; paintSheet();
  };
  /* After the link: the session is there (supabase-js read it from the
     URL); bring the two copies together the same way as before. */
  async function finishSignIn() {
    try {
      var out = await reconcile();
      if (out && out.choose) { pending = out; view = 'choose'; paintSheet(); return; }
      if (out === 'restored') { view = 'done'; paintSheet(); setTimeout(function () { location.reload(); }, 1200); return; }
      view = 'start'; paintBadge();
      if (window.fwToast) fwToast('Signed in — your progress is saved');
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
  window.fcCloudSaveNow = function () { busy = false; save('button').then(function () { if (window.fwToast) fwToast('Saved to your account'); }); paintSheet(); };
  window.fcCloudSignOut = async function () {
    try { if (dirty) await save('signout'); await sb.auth.signOut(); } catch (e) {}
    user = null; view = 'start'; paintBadge();
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

  /* Already signed in on this device: pick the session up quietly a little
     after start (the library is only fetched if there is a session to
     resume), and save once a session if anything changed. */
  setTimeout(function () {
    if (!ON) return;
    var has = false; try { has = !!localStorage.getItem('fc-cloud-auth'); } catch (e) {}
    if (!has) return;
    client().then(function (c) { return c.auth.getSession(); }).then(function (r) {
      user = r.data.session ? r.data.session.user : null; paintBadge();
      if (user && dirty) markDirty();
    }).catch(function () {});
  }, 2500);
})();
