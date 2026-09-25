/* ============================================================
   HOT TAKE — the reading room.

   Ninety pieces: news from the Guardian and AP, and TED talks. They
   live in hottake.json, generated from the spreadsheet that feeds this
   feature, so the text is data the app reads rather than anything baked
   into the code.

   Two rules give it a shape:
     - you start with four open, and finishing one opens two more, so
       there is always somewhere to go next and never ninety things
       shouting at once;
     - everything still locked is shown blacked out rather than hidden,
       because a wall you can see over is an invitation and an empty
       page is not.

   A TED item is a player plus its transcript. Tapping a line with a
   timestamp on it jumps the video there. The transcript column is not
   in the sheet yet — when it is, this reads it without changes.
   ============================================================ */
(function () {
  'use strict';

  var HT_LS = 'fc_hottake';
  var START_OPEN = 4;        // how many are unlocked on day one
  var UNLOCK_PER_FINISH = 2; // and how many each finished piece opens
  var FINISH_XP = 6;

  var DATA = null;           // { version, items:[...] }
  var byId = {};
  var filterSrc = 'all';
  var filterLevel = 'all';
  var current = null;        // the item being read

  /* ---------------- state ---------------- */
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(HT_LS));
      if (s && s.unlocked) return s;
    } catch (e) {}
    return { unlocked: [], done: [] };
  }
  function save(s) { try { localStorage.setItem(HT_LS, JSON.stringify(s)); } catch (e) {} }

  /* The opening four are picked to be a spread — one per source, easiest
     level first — rather than whatever happens to be at the top of the
     sheet, which would be four near-identical business stories. */
  function seedUnlocked(state) {
    if (state.unlocked.length) return state;
    var order = ['A2', 'B1', 'B2', 'C1'];
    var picked = [];
    ['ted', 'guardian', 'ap'].forEach(function (src) {
      for (var i = 0; i < order.length && picked.length < 3; i++) {
        var hit = DATA.items.find(function (it) {
          return it.src === src && it.level === order[i] && picked.indexOf(it.id) < 0;
        });
        if (hit) { picked.push(hit.id); break; }
      }
    });
    for (var j = 0; j < DATA.items.length && picked.length < START_OPEN; j++) {
      if (picked.indexOf(DATA.items[j].id) < 0) picked.push(DATA.items[j].id);
    }
    state.unlocked = picked;
    save(state);
    return state;
  }

  function unlockMore(state, n) {
    var locked = DATA.items.filter(function (it) { return state.unlocked.indexOf(it.id) < 0; });
    var opened = [];
    for (var i = 0; i < n && locked.length; i++) {
      var k = Math.floor(Math.random() * locked.length);
      opened.push(locked[k].id);
      state.unlocked.push(locked[k].id);
      locked.splice(k, 1);
    }
    return opened;
  }

  /* ---------------- data ---------------- */
  function ensureData() {
    if (DATA) return Promise.resolve(DATA);
    return fetch('./hottake.json').then(function (r) { return r.json(); }).then(function (j) {
      DATA = j;
      byId = {};
      j.items.forEach(function (it) { byId[it.id] = it; });
      return DATA;
    });
  }

  /* ---------------- the shelf ---------------- */
  var SRC_LABEL = { ted: 'TED', guardian: 'The Guardian', ap: 'AP News' };

  function sortedItems(state) {
    var open = {}, done = {};
    state.unlocked.forEach(function (id) { open[id] = 1; });
    state.done.forEach(function (id) { done[id] = 1; });
    // open and unread first, then finished, then everything still shut
    return DATA.items.slice().sort(function (a, b) {
      var ra = done[a.id] ? 1 : open[a.id] ? 0 : 2;
      var rb = done[b.id] ? 1 : open[b.id] ? 0 : 2;
      return ra - rb;
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function renderShelf() {
    var state = load();
    var openSet = {}, doneSet = {};
    state.unlocked.forEach(function (id) { openSet[id] = 1; });
    state.done.forEach(function (id) { doneSet[id] = 1; });

    var list = sortedItems(state).filter(function (it) {
      if (filterSrc !== 'all' && it.src !== filterSrc) return false;
      if (filterLevel !== 'all' && it.level !== filterLevel) return false;
      return true;
    });

    document.getElementById('ht-count').textContent =
      state.done.length + ' read · ' + state.unlocked.length + ' of ' + DATA.items.length + ' open';

    document.getElementById('ht-grid').innerHTML = list.map(function (it) {
      var open = !!openSet[it.id], done = !!doneSet[it.id];
      if (!open) {
        return '<div class="ht-card locked" aria-label="Locked">'
          + '<div class="ht-lockface"><span>✕</span><b>Locked</b>'
          + '<i>Finish one to open two more</i></div></div>';
      }
      return '<button class="ht-card' + (done ? ' done' : '') + '" onclick="htRead(\'' + it.id + '\')">'
        + '<img src="' + esc(it.img) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"/>'
        + '<span class="ht-lv">' + esc(it.level) + '</span>'
        + (it.src === 'ted' ? '<span class="ht-play">▶</span>' : '')
        + (done ? '<span class="ht-tick">✓</span>' : '')
        + '<span class="ht-cap"><b>' + esc(it.title) + '</b>'
        + '<i>' + esc(SRC_LABEL[it.src]) + ' · ' + it.mins + ' min</i></span>'
        + '</button>';
    }).join('') || '<div class="ht-empty">Nothing at that level from that source yet.</div>';
  }

  function chips() {
    document.querySelectorAll('#ht-src .ht-chip').forEach(function (c) {
      c.classList.toggle('on', c.dataset.v === filterSrc);
    });
    document.querySelectorAll('#ht-lvl .ht-chip').forEach(function (c) {
      c.classList.toggle('on', c.dataset.v === filterLevel);
    });
  }

  window.htSetSrc = function (v) { filterSrc = v; chips(); renderShelf(); };
  window.htSetLevel = function (v) { filterLevel = v; chips(); renderShelf(); };

  window.htOpen = function () {
    document.documentElement.classList.add('ht-on');
    document.getElementById('ht-grid').innerHTML = '<div class="ht-empty">Opening the newsstand…</div>';
    ensureData().then(function () {
      seedUnlocked(load());
      chips();
      renderShelf();
    }).catch(function () {
      document.getElementById('ht-grid').innerHTML =
        '<div class="ht-empty">The newsstand could not be reached. Try again in a moment.</div>';
    });
  };
  window.htClose = function () {
    document.documentElement.classList.remove('ht-on', 'ht-read');
    window.getSelection && window.getSelection().removeAllRanges();
  };
  window.htBackToShelf = function () {
    document.documentElement.classList.remove('ht-read');
    current = null;
    renderShelf();
  };

  /* ---------------- reading ----------------

     A transcript line may carry a timestamp — "1:24 some words" or
     "[1:24] some words". When it does it becomes a seek button. When it
     does not it is just a paragraph, which is what every line in the
     current sheet is. */
  var TS = /^\s*\[?(\d{1,2}):(\d{2})\]?\s*/;

  /* Only call it a transcript when it is one. The sheet's TED rows carry
     a short editorial summary, not the talk's words, and labelling that
     "Transcript" would be a lie the reader notices in one sentence. */
  function hasTranscript(it) {
    var text = it.body || it.summary || '';
    return text.split(/\n+/).some(function (l) { return TS.test(l); });
  }
  function bodyHtml(it) {
    var text = it.body || it.summary || '';
    var lines = text.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length < 2) {
      // one block of prose: break it into readable paragraphs on sentence runs
      lines = text.split(/(?<=[.!?])\s+(?=[A-Z"“])/);
      var out = [], buf = '';
      lines.forEach(function (sn) {
        buf += (buf ? ' ' : '') + sn;
        if (buf.length > 380) { out.push(buf); buf = ''; }
      });
      if (buf.trim()) out.push(buf.trim());
      lines = out;
    }
    return lines.map(function (l) {
      var m = l.match(TS);
      if (m) {
        var sec = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        return '<p class="ht-line"><button class="ht-ts" onclick="htSeek(' + sec + ')">'
          + m[1] + ':' + m[2] + '</button>' + esc(l.replace(TS, '')) + '</p>';
      }
      return '<p class="ht-line">' + esc(l) + '</p>';
    }).join('');
  }

  window.htRead = function (id) {
    var it = byId[id];
    if (!it) return;
    current = it;
    var host = document.getElementById('ht-reader');
    var media = it.src === 'ted'
      ? '<div class="ht-embed"><iframe id="ht-frame" src="' + esc(it.embed) + '" allow="autoplay; fullscreen; encrypted-media" allowfullscreen referrerpolicy="no-referrer-when-downgrade" title="' + esc(it.title) + '"></iframe></div>'
      : (it.img ? '<div class="ht-hero"><img src="' + esc(it.img) + '" alt="" onerror="this.parentElement.style.display=\'none\'"/></div>' : '');

    var done = load().done.indexOf(it.id) >= 0;
    host.innerHTML =
      '<div class="ht-rtop">'
      + '<button class="ht-back" onclick="htBackToShelf()">← All stories</button>'
      + '<button class="ht-back" onclick="htClose()">✕</button>'
      + '</div>'
      + media
      + '<div class="ht-rbody">'
      +   '<div class="ht-rmeta"><span class="ht-rsrc">' + esc(SRC_LABEL[it.src]) + '</span>'
      +     '<span class="ht-rlv">' + esc(it.levelText || it.level) + '</span></div>'
      +   '<h1 class="ht-rtitle">' + esc(it.title) + '</h1>'
      +   '<div class="ht-rsub">' + esc(it.topic || '') + (it.date ? ' · ' + esc(it.date) : '') + ' · ' + it.mins + ' min read</div>'
      +   (it.src === 'ted' ? '<div class="ht-tnote">' + (hasTranscript(it) ? 'Transcript · tap a time to jump there' : 'About this talk') + '</div>' : '')
      +   '<div class="ht-text" id="ht-text">' + bodyHtml(it) + '</div>'
      +   (it.link && it.src !== 'ted' ? '<a class="ht-srclink" href="' + esc(it.link) + '" target="_blank" rel="noopener">Read it at the source ↗</a>' : '')
      +   '<div class="ht-finish">'
      +     '<div class="ht-fh">' + (done ? 'You have read this one' : 'What do you make of it?') + '</div>'
      +     '<textarea id="ht-take" rows="3" placeholder="Say what you think, in English. A sentence is plenty."></textarea>'
      +     '<div id="ht-reply" class="ht-reply"></div>'
      +     '<button class="ht-done" onclick="htFinish()">' + (done ? 'Read again — done' : 'I have read this') + '</button>'
      +   '</div>'
      + '</div>';
    host.scrollTop = 0;
    document.documentElement.classList.add('ht-read');
    wireSelection();
  };

  /* TED's embed takes a start time in the fragment. Reloading the frame
     with a new one is the only seek the embed offers without its own
     player API, and it is enough for "take me to that sentence". */
  window.htSeek = function (sec) {
    var f = document.getElementById('ht-frame');
    if (!f || !current || !current.embed) return;
    f.src = current.embed.split('#')[0] + '#t=' + sec;
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /* ---------------- select to look up or ask ---------------- */
  function wireSelection() {
    var text = document.getElementById('ht-text');
    if (!text) return;
    var pop = document.getElementById('ht-sel');
    var hide = function () { pop.classList.remove('show'); };
    var show = function () {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) return hide();
      var s = sel.toString().trim();
      if (!s || s.length > 400) return hide();
      if (!text.contains(sel.anchorNode)) return hide();
      var r = sel.getRangeAt(0).getBoundingClientRect();
      pop.dataset.sel = s;
      pop.querySelector('.ht-sel-word').textContent = s.split(/\s+/).length === 1 ? 'Look up' : 'Look up first word';
      pop.classList.add('show');
      var top = Math.max(60, r.top - 52);
      pop.style.top = top + 'px';
      pop.style.left = Math.min(window.innerWidth - 12, Math.max(12, r.left + r.width / 2)) + 'px';
    };
    text.addEventListener('mouseup', function () { setTimeout(show, 10); });
    text.addEventListener('touchend', function () { setTimeout(show, 10); });
    document.getElementById('ht-reader').addEventListener('scroll', hide, { passive: true });
  }

  window.htSelLookup = function () {
    var pop = document.getElementById('ht-sel');
    var s = (pop.dataset.sel || '').trim();
    if (!s) return;
    var word = s.split(/\s+/)[0].replace(/[^A-Za-z'-]/g, '');
    pop.classList.remove('show');
    if (word && window.openDictPage) window.openDictPage(word.toLowerCase());
  };

  window.htSelAsk = function () {
    var pop = document.getElementById('ht-sel');
    var s = (pop.dataset.sel || '').trim();
    pop.classList.remove('show');
    if (!s) return;
    askFocci('Explain this, simply, for a Vietnamese learner of English:\n\n"' + s + '"');
  };

  /* ---------------- Focci answering ---------------- */
  function aiKey() { return (window.getKey && window.getKey()) || ''; }
  function aiModel() { return (window.getModel && window.getModel()) || 'gemini-2.0-flash'; }

  function askFocci(prompt) {
    var box = document.getElementById('ht-reply');
    if (!box) return;
    box.style.display = 'block';
    if (!aiKey() || !navigator.onLine) {
      box.innerHTML = '<b>Focci</b>Focci needs the AI key and a connection for this one. Settings has the key.';
      return;
    }
    box.innerHTML = '<b>Focci</b><i>thinking…</i>';
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + aiModel()
      + ':generateContent?key=' + encodeURIComponent(aiKey());
    fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt + '\n\nAnswer in under 70 words. Warm, plain English. No markdown.' }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 220 }
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var t = (j.candidates && j.candidates[0] && j.candidates[0].content
        && j.candidates[0].content.parts && j.candidates[0].content.parts[0].text) || '';
      box.innerHTML = '<b>Focci</b>' + esc(t.trim() || 'No answer came back. Try again?');
    }).catch(function () {
      box.innerHTML = '<b>Focci</b>That did not go through. Try again in a moment.';
    });
  }

  /* ---------------- finishing ---------------- */
  window.htFinish = function () {
    if (!current) return;
    var state = load();
    var first = state.done.indexOf(current.id) < 0;
    if (first) {
      state.done.push(current.id);
      var opened = unlockMore(state, UNLOCK_PER_FINISH);
      save(state);
      if (window.addXP) window.addXP(FINISH_XP);
      if (window.fwToast) {
        window.fwToast(opened.length
          ? 'Read. ' + opened.length + ' more stories opened up'
          : 'Read. That is every story on the stand');
      }
    }
    var take = (document.getElementById('ht-take') || {}).value || '';
    if (take.trim()) {
      askFocci('A learner read a story called "' + current.title + '" and wrote their opinion:\n\n"'
        + take.trim() + '"\n\nReply as Focci: react to what they actually said in one or two sentences, '
        + 'then gently fix the single most useful thing about their English if there is one.');
      var btn = document.querySelector('.ht-done');
      if (btn) btn.textContent = 'Saved — back to the stand when you like';
    } else {
      htBackToShelf();
    }
  };

  window.htState = load;   // for diagnosis
})();
