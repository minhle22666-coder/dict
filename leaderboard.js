/* Focci's Little World: the leaderboard.

   A small card that drops out of the island's XP pill -- not a screen of
   its own -- listing everyone signed in, ranked by XP, each with the
   companion they picked in "Companion" (sd_mascot_pick) as their avatar,
   their time in the app, and a green dot if they are on the island now.
   It depends on cloud.js (the signed-in client) and on app.js's
   getXP()/mascotPick()/sd_time_ms, so it loads after both.

   It is a SEPARATE table from user_state (supabase/leaderboard.sql), not a
   new column on it. user_state's row-level security only ever let someone
   read their OWN row -- that is what makes the public anon key safe, since
   a row there is everything the app keeps about a person. A leaderboard
   needs every signed-in person to read every row, so it has to be a table
   that was designed to be public from the start, carrying only what is
   meant to be seen: a name, an avatar's file name, a score, a time total,
   a heartbeat. Nothing from user_state's JSON blob is ever in it.

   "Online" is not presence sockets -- Supabase Realtime would be another
   connection kept open on a phone for a feature this small. It is a
   heartbeat: every 25s while the tab is visible and someone is signed in,
   this device writes its own row. A row counts as online if last_seen is
   under 40s old -- one missed heartbeat still reads as online, two does
   not. */
(function () {
  var HEARTBEAT_MS = 25000, ONLINE_WITHIN_MS = 40000, TOP_N = 50;
  var rows = null, rowsAt = 0, hbTimer = 0, pillTimer = 0, loading = false, loadErr = '';
  var H = document.documentElement;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function fmtTime(ms) {
    var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return h >= 1 ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm';
  }
  function lvlOf(xp) { return Math.floor((xp || 0) / 100) + 1; }
  function myXp() { return (window.getXP && getXP()) || 0; }
  /* _sessionStart is app.js's -- a top-level `let`, not `var`/function, so
     (per the classic-script note in CLAUDE.md) it never lands on `window`;
     it IS reachable as a bare identifier here, because every classic
     <script> tag shares one realm-global lexical scope. window._sessionStart
     would just read undefined and silently under-count every open session. */
  function myTime() {
    var ms = (+localStorage.getItem('sd_time_ms')) || 0;
    try { if (typeof _sessionStart !== 'undefined' && _sessionStart) ms += Math.max(0, Date.now() - _sessionStart); } catch (e) {}
    return ms;
  }
  function myNameSafe() {
    var n = ''; try { n = localStorage.getItem('sd_name') || ''; } catch (e) {}
    if (n) return n;
    var u = window.fcCloudUser && fcCloudUser();
    var email = (u && u.email) || (window.fcCloudState && fcCloudState().user) || '';
    return email ? email.split('@')[0] : 'Explorer';
  }
  /* The companion's picture file, without ".webp": the one picked by hand,
     else the one for this time of day (the app's own default), else Focci. */
  function myAvatar() {
    var f = '';
    try { f = (typeof mascotPick === 'function' && mascotPick()) || ''; } catch (e) {}
    if (!f) { try { f = 'mascot-' + TIME_CONTENT[timeOfDay()].char; } catch (e) {} }
    return /^mascot-[\w-]+$/.test(f) ? f : 'mascot-avatar';
  }
  window.lbMyAvatar = myAvatar;
  function avSrc(f) { return './' + (/^mascot-[\w-]+$/.test(f || '') ? f : 'mascot-avatar') + '.webp'; }

  /* One upsert of this device's own row. Failures are swallowed on purpose
     -- a missed heartbeat just means this row goes stale and later reads
     as offline, which is the correct outcome, not an error to surface. */
  function heartbeat() {
    var u = window.fcCloudUser && fcCloudUser();
    if (!u || !window.fcCloudClient) return;
    fcCloudClient().then(function (c) {
      return c.from('leaderboard').upsert({ user_id: u.id, name: myNameSafe().slice(0, 40), xp: myXp(), time_ms: myTime(), avatar: myAvatar(), last_seen: new Date().toISOString() });
    }).catch(function () {});
  }
  function startHeartbeat() {
    clearInterval(hbTimer);
    heartbeat();
    // the session usually resolves a second or two after load, so the first beat finds nobody signed in
    setTimeout(heartbeat, 3500); setTimeout(tickPill, 3500);
    hbTimer = setInterval(function () { if (!document.hidden && window.fcCloudUser && fcCloudUser()) heartbeat(); }, HEARTBEAT_MS);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && window.fcCloudUser && fcCloudUser()) { heartbeat(); tickPill(); } });

  async function fetchRows() {
    var c = await fcCloudClient();
    var r = await c.from('leaderboard').select('user_id,name,xp,time_ms,avatar,last_seen').order('xp', { ascending: false }).limit(TOP_N);
    if (r.error) throw r.error;
    return r.data || [];
  }
  function isOnline(r) { return Date.now() - Date.parse(r.last_seen) < ONLINE_WITHIN_MS; }

  function rowHTML(r, i, selfId) {
    var mine = r.user_id === selfId, on = isOnline(r);
    return '<div class="lb-row' + (mine ? ' mine' : '') + (on ? ' on' : '') + '">'
      + '<span class="lb-rank num">' + (i + 1) + '</span>'
      + '<span class="lb-av"><img src="' + avSrc(r.avatar) + '" alt="" onerror="this.src=\'./mascot-avatar.webp\'"/>' + (on ? '<i></i>' : '') + '</span>'
      + '<span class="lb-who"><b class="lb-name">' + esc(r.name || 'Explorer') + (mine ? ' <em>you</em>' : '') + '</b>'
      + '<small class="lb-sub"><span class="num">Lv ' + lvlOf(r.xp) + '</span> · <span class="num">' + fmtTime(r.time_ms || 0) + '</span>' + (on ? ' · <span class="lb-here">online</span>' : '') + '</small></span>'
      + '<span class="lb-xp"><b class="num">' + (r.xp || 0).toLocaleString() + '</b><small>XP</small></span>'
      + '</div>';
  }

  function paint() {
    var box = document.getElementById('lb-list'); if (!box) return;
    var u = window.fcCloudUser && fcCloudUser();
    var cnt = document.getElementById('lb-online');
    if (!u) {
      if (cnt) cnt.textContent = '';
      box.innerHTML = '<div class="lb-note">Sign in to join the board and see who else is exploring with Focci.'
        + '<button class="lb-go" onclick="lbClose();fcCloudOpen()">Sign in</button></div>';
      return;
    }
    if (loading && !rows) { box.innerHTML = '<div class="lb-note">Loading the board…</div>'; return; }
    if (loadErr && !rows) { box.innerHTML = '<div class="lb-note">Could not load the board.<small>' + esc(loadErr) + '</small></div>'; return; }
    if (!rows || !rows.length) { box.innerHTML = '<div class="lb-note">No one on the board yet — be the first.</div>'; return; }
    var n = rows.filter(function (r) { return r.user_id !== u.id && isOnline(r); }).length;
    if (cnt) cnt.textContent = n ? n + ' online now' : '';
    var html = rows.map(function (r, idx) { return rowHTML(r, idx, u.id); }).join('');
    if (rows.findIndex(function (r) { return r.user_id === u.id; }) === -1) {
      // not in the top N: the person still wants to see where they stand
      html += '<div class="lb-sep">You</div>' + rowHTML({ user_id: u.id, name: myNameSafe(), xp: myXp(), time_ms: myTime(), avatar: myAvatar(), last_seen: new Date().toISOString() }, rows.length, u.id);
    }
    box.innerHTML = html;
  }

  async function load(force) {
    if (loading) return;
    if (!force && rows && Date.now() - rowsAt < 15000) { paint(); return; }
    loading = true; loadErr = ''; paint();
    try { rows = await fetchRows(); rowsAt = Date.now(); }
    catch (e) { loadErr = (e && e.message) || 'no connection'; }
    loading = false; paint();
  }

  /* The card. Tapping the XP pill toggles it; a tap anywhere else, or the
     back gesture (fwBack -> lbBack), closes it. It is NOT a .fw-panel, so
     the island stays on screen behind it and nothing about panel-open
     (which hides the pill itself) applies. */
  window.lbOpen = function () {
    H.classList.add('lb-on');
    heartbeat(); paint(); load(true);
    var l = document.getElementById('lb-list'); if (l) l.scrollTop = 0;
  };
  window.lbClose = function () { H.classList.remove('lb-on'); };
  window.lbToggle = function () { H.classList.contains('lb-on') ? window.lbClose() : window.lbOpen(); };
  window.lbBack = function () { if (H.classList.contains('lb-on')) { window.lbClose(); return true; } return false; };
  window.lbRefresh = function () { load(true); };

  /* "Someone else is here" on the XP pill (a green dot on the avatar) and
     under it (the green pill with their face and name). One small query,
     only while the island is on screen -- nothing to poll behind a panel. */
  function tickPill() {
    var u = window.fcCloudUser && fcCloudUser();
    var pill = document.getElementById('fw-online');
    var off = function () { if (pill) pill.classList.remove('on'); H.classList.remove('lb-others'); };
    if (!pill) return;
    if (!u || document.hidden || H.classList.contains('panel-open') || H.classList.contains('dict-open')) { off(); return; }
    fcCloudClient().then(function (c) {
      return c.from('leaderboard').select('name,avatar,last_seen').neq('user_id', u.id).gte('last_seen', new Date(Date.now() - ONLINE_WITHIN_MS).toISOString()).order('last_seen', { ascending: false }).limit(6);
    }).then(function (r) {
      var others = r.data || [];
      if (!others.length) { off(); return; }
      pill.innerHTML = '<img src="' + avSrc(others[0].avatar) + '" alt="" onerror="this.src=\'./mascot-avatar.webp\'"/><b>' + esc(others[0].name || 'Someone') + '</b>'
        + (others.length > 1 ? '<span class="num">+' + (others.length - 1) + '</span>' : '') + '<em>is here</em><i class="lb-pulse"></i>';
      pill.classList.add('on'); H.classList.add('lb-others');
    }).catch(off);
  }
  function startPillTicker() {
    clearInterval(pillTimer);
    tickPill();
    pillTimer = setInterval(tickPill, 20000);
  }

  // A tap outside the card closes it (the card itself stops the tap).
  document.addEventListener('pointerdown', function (e) {
    if (!H.classList.contains('lb-on')) return;
    if (e.target.closest && e.target.closest('#lb-card, #fw-exp')) return;
    window.lbClose();
  }, true);

  // Pick the heartbeat and the pill up as soon as a session resolves, not
  // only when the card is opened -- otherwise your own row would not exist
  // until you tapped in, and others would see you offline.
  var tries = 0;
  (function waitForCloud() {
    if (window.fcCloudUser && window.fcCloudClient) { startHeartbeat(); startPillTicker(); return; }
    if (++tries > 100) return; // cloud.js didn't load; nothing to wire up
    setTimeout(waitForCloud, 200);
  })();
})();
