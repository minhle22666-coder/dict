/* ============================================================
   FOCCI'S JOURNAL

   A day's record of what actually happened: the words looked up, what
   they meant, and the ones a game caught you out on.

   Only misses are kept from the games. A list that also logged every
   right answer would be a scoreboard, and nobody reads their own
   scoreboard twice — what is worth coming back to is the handful you
   did not know yet.

   Everything lives in localStorage under one key, one entry per day,
   and old days are trimmed after a year so it cannot grow forever.
   ============================================================ */
(function () {
  'use strict';

  var JN_LS = 'fc_journal';
  var KEEP_DAYS = 400;
  var view = 0;          // how many weeks back the chart is showing
  var DAY = 86400000;

  function key(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }
  function today() { return key(new Date()); }
  function load() {
    try { return JSON.parse(localStorage.getItem(JN_LS)) || {}; } catch (e) { return {}; }
  }
  function save(j) {
    // drop anything older than KEEP_DAYS so this never becomes a leak
    var cut = key(new Date(Date.now() - KEEP_DAYS * DAY));
    Object.keys(j).forEach(function (k) { if (k < cut) delete j[k]; });
    try { localStorage.setItem(JN_LS, JSON.stringify(j)); } catch (e) {}
  }
  function dayOf(j, k) {
    if (!j[k]) j[k] = { words: [], misses: [] };
    return j[k];
  }

  /* ---------------- recording ---------------- */
  async function meaningOf(word) {
    try {
      if (typeof window.idbGet !== 'function') return '';
      var r = await window.idbGet(window.norm ? window.norm(word) : word);
      var d = r && r.data;
      return (d && (d.vi_equivalent || ((d.senses || [])[0] || {}).vi)) || '';
    } catch (e) { return ''; }
  }

  window.jnLogWord = async function (word) {
    var w = String(word || '').trim().toLowerCase();
    if (!w) return;
    var vi = await meaningOf(w);
    var j = load(), d = dayOf(j, today());
    var hit = d.words.find(function (x) { return x.w === w; });
    if (hit) { if (vi && !hit.vi) hit.vi = vi; }
    else d.words.push({ w: w, vi: vi });
    save(j);
  };

  window.jnLogMiss = async function (word, game) {
    var w = String(word || '').trim().toLowerCase();
    if (!w) return;
    var vi = await meaningOf(w);
    var j = load(), d = dayOf(j, today());
    var hit = d.misses.find(function (x) { return x.w === w; });
    if (hit) { hit.n = (hit.n || 1) + 1; hit.game = game || hit.game; }
    else d.misses.push({ w: w, vi: vi, game: game || '', n: 1 });
    save(j);
  };

  /* ---------------- the chart on the home page ---------------- */
  function weekDays(back) {
    // seven days ending today, shifted back by `back` weeks
    var out = [];
    var end = new Date(Date.now() - back * 7 * DAY);
    for (var i = 6; i >= 0; i--) out.push(new Date(end.getTime() - i * DAY));
    return out;
  }
  var DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  window.jnRenderChart = function () {
    var host = document.getElementById('jn-chart');
    if (!host) return;
    var j = load();
    var days = weekDays(view);
    var counts = days.map(function (d) { return ((j[key(d)] || {}).words || []).length; });
    var top = Math.max(4, Math.max.apply(null, counts));
    var total = counts.reduce(function (a, b) { return a + b; }, 0);

    var label;
    if (view === 0) label = 'This week';
    else if (view === 1) label = 'Last week';
    else label = view + ' weeks ago';
    var range = days[0].getDate() + '/' + (days[0].getMonth() + 1)
      + ' – ' + days[6].getDate() + '/' + (days[6].getMonth() + 1);

    document.getElementById('jn-range').textContent = label;
    document.getElementById('jn-sub').textContent = range + ' · ' + total + ' word' + (total === 1 ? '' : 's');
    document.getElementById('jn-next').disabled = view === 0;

    host.innerHTML = days.map(function (d, i) {
      var h = Math.round((counts[i] / top) * 100);
      var isToday = key(d) === today();
      return '<div class="jn-col' + (isToday ? ' now' : '') + '">'
        + '<div class="jn-bar"><i style="height:' + Math.max(counts[i] ? 8 : 2, h) + '%"></i></div>'
        + '<div class="jn-n num">' + (counts[i] || '') + '</div>'
        + '<div class="jn-d">' + DOW[d.getDay()] + '</div>'
        + '</div>';
    }).join('');
  };
  window.jnStep = function (dir) {
    view = Math.max(0, Math.min(52, view + dir));
    jnRenderChart();
  };

  /* ---------------- the journal itself ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function pretty(k) {
    var p = k.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (k === today()) return 'Today';
    if (k === key(new Date(Date.now() - DAY))) return 'Yesterday';
    try { return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); }
    catch (e) { return k; }
  }

  window.jnOpen = function () {
    var j = load();
    var keys = Object.keys(j).sort().reverse().filter(function (k) {
      return (j[k].words || []).length || (j[k].misses || []).length;
    });
    var host = document.getElementById('jn-body');
    if (!keys.length) {
      host.innerHTML = '<div class="jn-empty">Nothing written down yet. Look a word up, or play a round, '
        + 'and the day starts filling itself in.</div>';
    } else {
      host.innerHTML = keys.map(function (k) {
        var d = j[k];
        var h = '<div class="jn-day"><div class="jn-date">' + esc(pretty(k)) + '</div>';
        if (d.words.length) {
          h += '<div class="jn-sec">Words met <b class="num">' + d.words.length + '</b></div>';
          h += '<div class="jn-list">' + d.words.map(function (w) {
            return '<button class="jn-w" onclick="jnGo(\'' + esc(w.w) + '\')"><b>' + esc(w.w) + '</b>'
              + (w.vi ? '<i>' + esc(w.vi) + '</i>' : '') + '</button>';
          }).join('') + '</div>';
        }
        if (d.misses.length) {
          h += '<div class="jn-sec warn">Worth another look <b class="num">' + d.misses.length + '</b></div>';
          h += '<div class="jn-list">' + d.misses.map(function (w) {
            return '<button class="jn-w miss" onclick="jnGo(\'' + esc(w.w) + '\')"><b>' + esc(w.w) + '</b>'
              + (w.vi ? '<i>' + esc(w.vi) + '</i>' : '')
              + '<span class="jn-tag">' + esc(w.game || 'game') + (w.n > 1 ? ' ×' + w.n : '') + '</span></button>';
          }).join('') + '</div>';
        }
        return h + '</div>';
      }).join('');
    }
    document.documentElement.classList.add('jn-on');
  };
  window.jnClose = function () { document.documentElement.classList.remove('jn-on'); };
  window.jnGo = function (w) { jnClose(); if (window.openDictPage) window.openDictPage(w); };
})();
