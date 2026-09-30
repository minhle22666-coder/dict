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

  /* A comparison is logged under its storage key, "why:general, generic".
     That key went into the journal as if it were a word -- shown with the
     "why:" in front, and tapping it opened the word page on the key
     itself, which search() read as a comparison of "why:general" with
     "generic", found nothing saved for that, and asked the AI. So the
     journal keeps the comparison as what was typed and remembers that it
     is one; days written before this are cleaned the same way on show. */
  var WHY = /^(why:)+/;
  window.jnLogWord = async function (word) {
    var raw = String(word || '').trim().toLowerCase();
    if (!raw) return;
    var w = raw.replace(WHY, '');
    var vi = await meaningOf(raw);
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
  /* A fortnight at a time. Seven days is too short a run to see whether
     anything is actually becoming a habit, and the arrows step by a week
     so consecutive views overlap rather than jumping past a stretch. */
  var SPAN = 14;
  function weekDays(back) {
    var out = [];
    var end = new Date(Date.now() - back * 7 * DAY);
    for (var i = SPAN - 1; i >= 0; i--) out.push(new Date(end.getTime() - i * DAY));
    return out;
  }
  /* The axis used to read S M T W T F S S M T W T F S. Over a fortnight
     that is the same seven letters twice, two of them ("T", "S") already
     ambiguous on their own, and nothing anywhere saying WHICH Tuesday.
     The day number says it in the same width and needs no legend -- the
     month is already spelled out in the range line above the chart. */

  window.jnRenderChart = function () {
    var host = document.getElementById('jn-chart');
    if (!host) return;
    var j = load();
    var days = weekDays(view);
    var counts = days.map(function (d) { return ((j[key(d)] || {}).words || []).length; });
    var top = Math.max(4, Math.max.apply(null, counts));
    var total = counts.reduce(function (a, b) { return a + b; }, 0);

    var label;
    if (view === 0) label = 'The last fortnight';
    else if (view === 1) label = 'A week earlier';
    else label = view + ' weeks earlier';
    var last = days[days.length - 1];
    var range = days[0].getDate() + '/' + (days[0].getMonth() + 1)
      + ' – ' + last.getDate() + '/' + (last.getMonth() + 1);

    document.getElementById('jn-range').textContent = label;
    document.getElementById('jn-sub').textContent = range + ' · ' + total + ' word' + (total === 1 ? '' : 's');
    document.getElementById('jn-next').disabled = view === 0;

    host.innerHTML = days.map(function (d, i) {
      var h = Math.round((counts[i] / top) * 100);
      var isToday = key(d) === today();
      return '<div class="jn-col' + (isToday ? ' now' : '') + '">'
        + '<div class="jn-bar"><i style="height:' + Math.max(counts[i] ? 8 : 2, h) + '%"></i></div>'
        + '<div class="jn-n num">' + (counts[i] || '') + '</div>'
        + '<div class="jn-d num">' + d.getDate() + '</div>'
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

  /* The journal screen, rebuilt light and short.
     It opens on what is worth doing -- the words a game caught you out on
     in the last fortnight, gathered in one place, where they used to be
     buried inside whichever day they happened on -- then one line of
     figures, then the days: each a single ruled list, the word and what it
     means on one line, a small x to forget it. Days that were only
     misses still show, marked. */
  var VISIBLE_DAYS = 60;
  function row(w, vi, extra, miss) {
    return '<div class="jn-r' + (miss ? ' miss' : '') + '">'
      + '<button class="jn-go" data-w="' + esc(w) + '" onclick="jnGo(this.dataset.w)"><b>' + esc(w) + '</b>'
      + (vi ? '<i>' + esc(vi) + '</i>' : '') + (extra || '') + '</button>'
      + '<button class="jn-del" aria-label="Forget" data-w="' + esc(w) + '" onclick="jnDel(this,this.dataset.w)">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg>'
      + '</button></div>';
  }
  function render() {
    var j = load();
    var keys = Object.keys(j).sort().reverse().filter(function (k) {
      return (j[k].words || []).length || (j[k].misses || []).length;
    }).slice(0, VISIBLE_DAYS);
    var host = document.getElementById('jn-body');
    if (!host) return;
    if (!keys.length) {
      host.innerHTML = '<div class="jn-empty">Nothing written down yet. Look a word up, or play a round, '
        + 'and the day starts filling itself in.</div>';
      return;
    }
    // the fortnight's figures, and its misses in one place
    var cut = key(new Date(Date.now() - 13 * DAY)), week = key(new Date(Date.now() - 6 * DAY));
    var nWeek = 0, nDays = 0, revisit = {};
    keys.forEach(function (k) {
      var d = j[k];
      if (k >= week) nWeek += (d.words || []).length;
      if (k >= cut) {
        nDays++;
        (d.misses || []).forEach(function (m) {
          var r = revisit[m.w] || (revisit[m.w] = { w: m.w, vi: m.vi, n: 0 });
          r.n += (m.n || 1); if (!r.vi && m.vi) r.vi = m.vi;
        });
      }
    });
    var list = Object.keys(revisit).map(function (w) { return revisit[w]; })
      .sort(function (a, b) { return b.n - a.n; });

    var h = '<div class="jn-figs">'
      + '<div><b class="num">' + nWeek + '</b><span>words this week</span></div>'
      + '<div><b class="num">' + nDays + '</b><span>active days</span></div>'
      + '<div><b class="num">' + list.length + '</b><span>to revisit</span></div>'
      + '</div>';
    if (list.length) {
      h += '<section class="jn-rev"><div class="jn-cap"><span>Worth another look</span><i>from your games</i></div>'
        + '<div class="jn-chips">' + list.slice(0, 12).map(function (m) {
          return '<button class="jn-chip" data-w="' + esc(m.w) + '" onclick="jnGo(this.dataset.w)">' + esc(m.w)
            + (m.n > 1 ? ' <span class="num">×' + m.n + '</span>' : '') + '</button>';
        }).join('') + '</div></section>';
    }
    h += keys.map(function (k) {
      var d = j[k];
      var words = (d.words || []).map(function (w) { return String(w.w || '').replace(WHY, ''); });
      var body = (d.words || []).map(function (w, i) { return row(words[i], w.vi, '', false); }).join('')
        + (d.misses || []).map(function (m) {
          return row(m.w, m.vi, '<span class="jn-tag">' + esc(m.game || 'game') + (m.n > 1 ? ' <span class="num">×' + m.n + '</span>' : '') + '</span>', true);
        }).join('');
      var n = (d.words || []).length;
      return '<section class="jn-day"><div class="jn-cap"><span>' + esc(pretty(k)) + '</span>'
        + '<i>' + (n ? '<span class="num">' + n + '</span> word' + (n === 1 ? '' : 's') : 'games only') + '</i></div>'
        + '<div class="jn-list">' + body + '</div></section>';
    }).join('');
    host.innerHTML = h;
  }
  window.jnOpen = function () {
    render();
    var b = document.getElementById('jn-body'); if (b) b.scrollTop = 0;
    document.documentElement.classList.add('jn-on');
  };
  /* Out of every day, words and misses alike. forgetSearch (app.js) calls
     this too, so the search box's x reaches the journal as well. */
  window.jnForget = function (word) {
    var w = String(word || '').trim().toLowerCase().replace(WHY, '');
    if (!w) return;
    var j = load();
    Object.keys(j).forEach(function (k) {
      j[k].words = (j[k].words || []).filter(function (x) { return String(x.w || '').replace(WHY, '') !== w; });
      j[k].misses = (j[k].misses || []).filter(function (x) { return x.w !== w; });
      if (!j[k].words.length && !j[k].misses.length) delete j[k];
    });
    save(j);
    if (window.jnRenderChart) try { jnRenderChart(); } catch (e) {}
  };
  window.jnDel = async function (btn, word) {
    var r = btn.closest('.jn-r');
    if (r) r.classList.add('gone');
    if (window.forgetSearch) await window.forgetSearch(word); else window.jnForget(word);
    setTimeout(function () { if (document.documentElement.classList.contains('jn-on')) render(); }, 180);
  };
  window.jnClose = function () { document.documentElement.classList.remove('jn-on'); };
  window.jnGo = function (w) { jnClose(); if (window.openDictPage) window.openDictPage(String(w || '').replace(WHY, '')); };
})();
