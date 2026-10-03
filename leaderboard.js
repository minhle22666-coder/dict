/* Focci's Little World: the leaderboard.

   A ranked list of every signed-in person -- XP and time in the app --
   plus who else is on the island right now. It depends on cloud.js (the
   signed-in client and who()) and on app.js's getXP()/sd_time_ms, so it
   loads after both.

   It is a SEPARATE table from user_state (supabase/leaderboard.sql), not a
   new column on it. user_state's row-level security only ever let someone
   read their OWN row -- that is what makes the public anon key safe, since
   a row there is everything the app keeps about a person. A leaderboard
   needs every signed-in person to read every row, so it has to be a table
   that was designed to be public from the start, carrying only what is
   meant to be seen: a name, a score, a time total, a heartbeat. Nothing
   from user_state's JSON blob (search history, saved words, the journal...)
   is ever in it.

   "Online" is not presence sockets -- Supabase Realtime would be another
   library and another connection kept open on a phone for a feature this
   small. It is a heartbeat: every 25s while the tab is visible and someone
   is signed in, this device writes its own row (name, xp, time, now()).
   Reading the board, a row counts as online if last_seen is under 40s old
   -- one missed heartbeat still reads as online, two does not. */
(function () {
  var HEARTBEAT_MS = 25000, ONLINE_WITHIN_MS = 40000, TOP_N = 50;
  var rows = null, rowsAt = 0, hbTimer = 0, pillTimer = 0, loading = false, loadErr = '';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function fmtTime(ms) {
    var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    if (h >= 1) return h + 'h' + (m ? ' ' + m + 'm' : '');
    return m + 'm';
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

  /* One upsert of this device's own row. Failures are swallowed on purpose
     -- a missed heartbeat just means this row goes stale and later reads
     as offline, which is the correct outcome, not an error to surface. */
  function heartbeat() {
    var u = window.fcCloudUser && fcCloudUser();
    if (!u || !window.fcCloudClient) return;
    fcCloudClient().then(function (c) {
      return c.from('leaderboard').upsert({ user_id: u.id, name: myNameSafe().slice(0, 40), xp: myXp(), time_ms: myTime(), last_seen: new Date().toISOString() });
    }).catch(function () {});
  }

  function startHeartbeat() {
    clearInterval(hbTimer);
    heartbeat();
    hbTimer = setInterval(function () { if (!document.hidden && window.fcCloudUser && fcCloudUser()) heartbeat(); }, HEARTBEAT_MS);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && window.fcCloudUser && fcCloudUser()) heartbeat(); });

  async function fetchRows() {
    var c = await fcCloudClient();
    var r = await c.from('leaderboard').select('user_id,name,xp,time_ms,last_seen').order('xp', { ascending: false }).limit(TOP_N);
    if (r.error) throw r.error;
    return r.data || [];
  }

  function isOnline(r) { return Date.now() - Date.parse(r.last_seen) < ONLINE_WITHIN_MS; }

  function rowHTML(r, i, selfId) {
    var mine = r.user_id === selfId;
    return '<div class="lb-row' + (mine ? ' mine' : '') + '">'
      + '<span class="lb-rank num">' + (i + 1) + '</span>'
      + '<span class="lb-who"><span class="lb-dot' + (isOnline(r) ? ' on' : '') + '"></span>'
      + '<b class="lb-name">' + esc(r.name || 'Explorer') + (mine ? ' <i>(you)</i>' : '') + '</b>'
      + '<span class="lb-lvl">Lv ' + lvlOf(r.xp) + '</span></span>'
      + '<span class="lb-xp num">' + (r.xp || 0).toLocaleString() + '</span>'
      + '<span class="lb-time num">' + fmtTime(r.time_ms || 0) + '</span>'
      + '</div>';
  }

  function paint() {
    var box = document.getElementById('lb-list'); if (!box) return;
    var u = window.fcCloudUser && fcCloudUser();
    if (!u) {
      box.innerHTML = '<div class="lb-signin"><p>Sign in to join the leaderboard and see who else is exploring with Focci.</p>'
        + '<button class="lb-go" onclick="fcCloudOpen()">Sign in</button></div>';
      return;
    }
    if (loading && !rows) { box.innerHTML = '<div class="lb-note">Loading the board…</div>'; return; }
    if (loadErr && !rows) { box.innerHTML = '<div class="lb-note">Could not load the board (' + esc(loadErr) + ').</div>'; return; }
    if (!rows || !rows.length) { box.innerHTML = '<div class="lb-note">No one on the board yet — be the first.</div>'; return; }
    var i = rows.findIndex(function (r) { return r.user_id === u.id; });
    var html = rows.map(function (r, idx) { return rowHTML(r, idx, u.id); }).join('');
    if (i === -1) {
      // not in the top N: the person still wants to see where they stand
      html += '<div class="lb-sep">You</div>' + rowHTML({ user_id: u.id, name: myNameSafe(), xp: myXp(), time_ms: myTime(), last_seen: new Date().toISOString() }, rows.length, u.id);
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

  window.lbOpen = function () {
    heartbeat();
    paint();
    load(true);
  };
  window.lbRefresh = function () { load(true); };

  /* The green "someone's here too" pill under the XP badge. Lighter than
     opening the whole board: one small query, only while the island is on
     screen (paintBadge-style -- no point polling behind a panel). */
  function tickPill() {
    var u = window.fcCloudUser && fcCloudUser();
    var pill = document.getElementById('fw-online');
    if (!pill) return;
    if (!u || document.hidden || document.documentElement.classList.contains('panel-open') || document.documentElement.classList.contains('dict-open')) { pill.classList.remove('on'); return; }
    fcCloudClient().then(function (c) {
      return c.from('leaderboard').select('name,last_seen').neq('user_id', u.id).gte('last_seen', new Date(Date.now() - ONLINE_WITHIN_MS).toISOString()).order('last_seen', { ascending: false }).limit(6);
    }).then(function (r) {
      var others = (r.data || []);
      if (!others.length) { pill.classList.remove('on'); return; }
      pill.innerHTML = '<i class="lb-pulse"></i><b>' + esc(others[0].name || 'Someone') + '</b>' + (others.length > 1 ? ' <span>+' + (others.length - 1) + '</span>' : '') + ' online';
      pill.classList.add('on');
    }).catch(function () { pill.classList.remove('on'); });
  }
  function startPillTicker() {
    clearInterval(pillTimer);
    tickPill();
    pillTimer = setInterval(tickPill, 20000);
  }

  // Pick the heartbeat and the pill up as soon as a session resolves, not
  // only when the board is opened -- otherwise the first person to open
  // the board after you sign in sees you as offline for up to 25s longer
  // than necessary, and your own row never appears until you tap in.
  var tries = 0;
  (function waitForCloud() {
    if (window.fcCloudUser && window.fcCloudClient) { startHeartbeat(); startPillTicker(); return; }
    if (++tries > 100) return; // cloud.js didn't load; nothing to wire up
    setTimeout(waitForCloud, 200);
  })();
})();
