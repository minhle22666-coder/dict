/* ============================================================
   THE ANIMALS AS COMPANIONS

   residents.js owns the animals' bodies: species, names, energy, growth,
   pairing. This file gives each one a mind and a reason to visit:

   - a VOICE (how it talks) and a MASTERY (the corner of English it is an
     expert in). A mastery is never shared: two rabbits are two different
     teachers. Assigned the first time an animal is met, kept on its record.
   - PET, FEED and TALK. Talking is a Gemini call in the animal's own voice,
     about its own subject.
   - BOND. Care adds to it; at each threshold, if the animal is happy, it has
     a GIFT: a small set of real expressions from its mastery (things a
     textbook rarely gets to -- "if not better than", a softener for a formal
     email, a casual reply), each with meaning, an example, when to use it.
     Gifts land in Saved (the Gifts tab) and in the day's Journal.
   - LISTEN. A gift's phrases play as real clips from YouGlish, one short
     clip after another, in a small player with the transcript, over the
     island or any page. Back only goes back when you press back.

   Classic script, one IIFE, exports at the bottom (see CLAUDE.md on why
   nothing here reaches window by itself).
   ============================================================ */
(function () {
  'use strict';

  var CHAT_LS = 'fc_pet_chat', GIFT_LS = 'fc_gifts';
  var DAY = 86400000;
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function readJSON(k, f) { try { var v = JSON.parse(localStorage.getItem(k)); return v || f; } catch (e) { return f; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function $(id) { return document.getElementById(id); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------------- who they are ---------------- */
  var VOICES = [
    { id: 'deadpan',   label: 'Dry and deadpan',        vi: 'Hài khô, mặt lạnh',          how: 'dry, deadpan humour and understatement; never uses exclamation marks' },
    { id: 'bubbly',    label: 'Bubbly and excitable',   vi: 'Sôi nổi, hay phấn khích',    how: 'bubbly, easily excited, warm, a little breathless' },
    { id: 'poet',      label: 'Gentle and poetic',      vi: 'Dịu dàng, thơ thẩn',         how: 'gentle, slow, notices small beautiful things, speaks in soft images' },
    { id: 'grump',     label: 'Grumpy but kind',        vi: 'Cằn nhằn nhưng tốt bụng',     how: 'grumbles and complains, but is clearly kind and always helps' },
    { id: 'showoff',   label: 'A proud show-off',       vi: 'Thích khoe chữ',             how: 'proud, loves showing off a good phrase, playful bragging' },
    { id: 'shy',       label: 'Shy and soft-spoken',    vi: 'Nhút nhát, nói nhỏ nhẹ',     how: 'shy, short sentences, a little hesitant, very sweet' },
    { id: 'storyteller', label: 'A dramatic storyteller', vi: 'Kể chuyện đầy kịch tính', how: 'dramatic, tells tiny stories, builds suspense' },
    { id: 'sage',      label: 'A calm philosopher',     vi: 'Triết gia điềm tĩnh',        how: 'calm, thoughtful, asks one good question back' },
    { id: 'prankster', label: 'A cheeky prankster',     vi: 'Tinh nghịch, hay trêu',      how: 'cheeky, teasing, jokes, but never mean' },
    { id: 'butler',    label: 'Old-fashioned and polite', vi: 'Lịch thiệp kiểu cổ điển',  how: 'very polite, slightly old-fashioned, formal but warm' },
    { id: 'coach',     label: 'An upbeat coach',        vi: 'Huấn luyện viên nhiệt huyết', how: 'upbeat coach, short punchy encouragement, gives tiny challenges' },
    { id: 'dreamer',   label: 'A sleepy dreamer',       vi: 'Mơ màng, buồn ngủ',          how: 'sleepy, dreamy, drifts off topic and comes back' }
  ];
  /* What each one is an expert in. "brief" goes into the prompts. */
  var MASTERIES = [
    { id: 'casual',     label: 'Casual expressions',      vi: 'Cách nói đời thường',            brief: 'everyday casual expressions natives actually use with friends' },
    { id: 'email',      label: 'Formal emails',           vi: 'Email trang trọng',              brief: 'formal and professional emails: openings, softeners, polite requests, closings' },
    { id: 'phrasal',    label: 'Phrasal verbs',           vi: 'Cụm động từ',                   brief: 'phrasal verbs in real conversation and their hidden meanings' },
    { id: 'idioms',     label: 'Idioms',                  vi: 'Thành ngữ',                     brief: 'idioms that are still alive in modern speech, not old-fashioned ones' },
    { id: 'grammar',    label: 'Uncommon grammar',        vi: 'Ngữ pháp ít gặp',               brief: 'grammar patterns textbooks rarely teach: "if not better than", inversion, cleft sentences, "no sooner... than", "as it were"' },
    { id: 'colloc',     label: 'Collocations',            vi: 'Kết hợp từ',                     brief: 'natural word partnerships (collocations) that make English sound native' },
    { id: 'smalltalk',  label: 'Small talk',              vi: 'Chuyện xã giao',                brief: 'small talk: openers, keeping a chat going, leaving a conversation politely' },
    { id: 'softening',  label: 'Polite softening',        vi: 'Nói giảm nói tránh lịch sự',    brief: 'softening and hedging language for polite disagreement and requests' },
    { id: 'story',      label: 'Telling stories',         vi: 'Kể chuyện',                     brief: 'telling stories out loud: narrative tenses, suspense phrases, reactions' },
    { id: 'linking',    label: 'Linking ideas',           vi: 'Từ nối ý',                      brief: 'linking words and discourse markers for clear writing and speaking' },
    { id: 'stress',     label: 'Pronunciation & stress',  vi: 'Phát âm và trọng âm',           brief: 'word stress, linking sounds and reduced forms in fast speech' },
    { id: 'preps',      label: 'Prepositions',            vi: 'Giới từ',                       brief: 'tricky prepositions after verbs, adjectives and nouns' },
    { id: 'travel',     label: 'Travel English',          vi: 'Tiếng Anh du lịch',             brief: 'English for travel: airports, hotels, asking for help, small problems' },
    { id: 'work',       label: 'Work & interviews',       vi: 'Công việc và phỏng vấn',        brief: 'workplace English and job interviews: meetings, updates, talking about yourself' },
    { id: 'opinions',   label: 'Giving opinions',         vi: 'Đưa ra quan điểm',              brief: 'giving opinions, agreeing, disagreeing and debating politely' },
    { id: 'feelings',   label: 'Feelings & emotions',     vi: 'Cảm xúc',                       brief: 'precise words and phrases for feelings and emotions beyond happy and sad' },
    { id: 'food',       label: 'Food & cooking',          vi: 'Ẩm thực',                       brief: 'food, taste, cooking and ordering English' },
    { id: 'online',     label: 'Texting & online',        vi: 'Nhắn tin và mạng',              brief: 'texting, online slang and abbreviations people really use' },
    { id: 'nuance',     label: 'Word nuance',             vi: 'Sắc thái từ',                   brief: 'near-synonyms and their nuance: say/tell, look/see/watch, fun/funny' },
    { id: 'reactions',  label: 'Quick reactions',         vi: 'Phản ứng nhanh',                brief: 'short natural reactions and replies: "No way!", "Fair enough", "That tracks"' }
  ];
  function voiceOf(r) { return VOICES.find(function (v) { return v.id === (r.persona || {}).voice; }) || VOICES[0]; }
  function masteryOf(r) { return MASTERIES.find(function (m) { return m.id === (r.persona || {}).mastery; }) || MASTERIES[0]; }

  /* Every animal gets a voice and a mastery the first time it is met. A
     mastery is never taken twice while there are free ones; voices are
     spread so that two of a species do not sound alike. */
  function ensurePersonas() {
    if (!window.resLoad) return [];
    var list = window.resLoad(), changed = false;
    var takenM = {}, voicesBySp = {};
    list.forEach(function (r) {
      if (r.persona && r.persona.mastery) takenM[r.persona.mastery] = (takenM[r.persona.mastery] || 0) + 1;
      if (r.persona && r.persona.voice) (voicesBySp[r.species] = voicesBySp[r.species] || []).push(r.persona.voice);
    });
    list.forEach(function (r) {
      if (r.persona && r.persona.mastery && r.persona.voice) return;
      var h = hash(r.id || r.name || 'x');
      var order = MASTERIES.map(function (m, i) { return MASTERIES[(i + h) % MASTERIES.length]; });
      var m = order.find(function (x) { return !takenM[x.id]; })
        || order.slice().sort(function (a, b) { return (takenM[a.id] || 0) - (takenM[b.id] || 0); })[0];
      takenM[m.id] = (takenM[m.id] || 0) + 1;
      var used = voicesBySp[r.species] || [];
      var vo = VOICES.map(function (v, i) { return VOICES[(i + (h >>> 5)) % VOICES.length]; });
      var v = vo.find(function (x) { return used.indexOf(x.id) < 0; }) || vo[0];
      (voicesBySp[r.species] = used).push(v.id);
      r.persona = { voice: v.id, mastery: m.id };
      if (r.bond == null) r.bond = 0;
      changed = true;
    });
    if (changed) window.resSave(list);
    return list;
  }

  /* ---------------- care ---------------- */
  var GIFT_AT = [5, 14, 26, 42, 62, 86, 115, 150];
  function nextGiftAt(r) {
    var n = r.giftsGiven || 0;
    return n < GIFT_AT.length ? GIFT_AT[n] : GIFT_AT[GIFT_AT.length - 1] + 40 * (n - GIFT_AT.length + 1);
  }
  function prevGiftAt(r) { var n = r.giftsGiven || 0; return n === 0 ? 0 : (n - 1 < GIFT_AT.length ? GIFT_AT[n - 1] : nextGiftAt({ giftsGiven: n - 1 })); }
  function giftReady(r) { return (r.bond || 0) >= nextGiftAt(r) && (r.happiness || 0) >= 45; }
  function dayCount(r, key) { var c = r[key]; return (c && c.d === today()) ? c.n : 0; }
  function bump(r, key) { var n = dayCount(r, key) + 1; r[key] = { d: today(), n: n }; return n; }
  function withRecord(id, fn) {
    var list = window.resTick ? window.resTick() : window.resLoad();
    var r = list.find(function (x) { return x.id === id; });
    if (!r) return null;
    var out = fn(r);
    window.resSave(list);
    return out === undefined ? r : out;
  }
  var CAP = { pet: 8, feed: 6, talk: 10 };
  function care(id, kind) {
    return withRecord(id, function (r) {
      var n = bump(r, kind + 'Day');
      var counted = n <= CAP[kind];
      if (counted) r.bond = (r.bond || 0) + (kind === 'talk' ? 2 : 1);
      if (kind === 'pet') r.happiness = Math.min(100, (r.happiness || 0) + (counted ? 4 : 1));
      if (kind === 'talk') r.happiness = Math.min(100, (r.happiness || 0) + 2);
      return { r: r, counted: counted };
    });
  }
  function mealsToFull(r) { return Math.max(0, Math.ceil((100 - (r.energy || 0)) / 10)); }

  /* ---------------- talking (Gemini, in character) ---------------- */
  function chatLoad(id) { return (readJSON(CHAT_LS, {})[id] || []); }
  function chatSave(id, msgs) { var all = readJSON(CHAT_LS, {}); all[id] = msgs.slice(-30); writeJSON(CHAT_LS, all); }
  function speciesLabel(r) { var sp = (window.RES_SPECIES || {})[r.species]; return sp ? sp.label : r.species; }
  function systemFor(r) {
    var v = voiceOf(r), m = masteryOf(r);
    return 'You are ' + r.name + ', a ' + speciesLabel(r).toLowerCase() + ' who lives on Fox Island with Focci the fox. '
      + 'Personality: ' + v.how + '. ' + (r.trait ? 'Quirk: ' + r.trait + '. ' : '') + (r.likes ? 'You love ' + r.likes + '. ' : '')
      + 'You are a true master of ' + m.brief + '. '
      + 'You are chatting with a Vietnamese learner of English (about B1). Stay fully in character and never say you are an AI. '
      + 'Reply in natural, simple English: 1-3 short sentences, at most 60 words. '
      + 'In most replies, naturally use or teach ONE expression from your mastery and wrap it in **double asterisks**. '
      + 'If the learner makes an English mistake, recast it correctly once, lightly, inside your reply. '
      + 'If they write in Vietnamese, answer in simple English and add the Vietnamese meaning of your key phrase in brackets. '
      + 'Mood right now: ' + (window.resMood ? window.resMood(r) : 'content') + '.';
  }
  async function askPet(r, history, userText) {
    var key = window.getKey && window.getKey();
    if (!key) throw new Error('NO_KEY');
    if (!navigator.onLine) throw new Error('OFFLINE');
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + window.getModel() + ':generateContent?key=' + encodeURIComponent(key);
    var contents = history.slice(-12).map(function (m) { return { role: m.who === 'me' ? 'user' : 'model', parts: [{ text: m.t }] }; });
    contents.push({ role: 'user', parts: [{ text: userText }] });
    var body = { systemInstruction: { parts: [{ text: systemFor(r) }] }, contents: contents,
      generationConfig: { temperature: 0.9, maxOutputTokens: 400 } };
    var res = await window.geminiPost(url, body);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var t = window.geminiText(await res.json()).txt.trim();
    if (!t) throw new Error('EMPTY');
    return t;
  }

  /* ---------------- gifts (Gemini, from the animal's mastery) ---------------- */
  function giftLoad() { return readJSON(GIFT_LS, []); }
  function giftSave(list) { writeJSON(GIFT_LS, list); }
  async function makeGift(r) {
    var key = window.getKey && window.getKey();
    if (!key) throw new Error('NO_KEY');
    var m = masteryOf(r), v = voiceOf(r);
    var before = giftLoad().filter(function (g) { return g.rid === r.id; }).map(function (g) { return g.title; });
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + window.getModel() + ':generateContent?key=' + encodeURIComponent(key);
    var prompt = 'You are ' + r.name + ', a ' + speciesLabel(r).toLowerCase() + ' (' + v.how + '), a master of ' + m.brief + '. '
      + 'You are giving a GIFT to a Vietnamese learner of English (about B1) who has looked after you. '
      + 'Choose ONE specific, practical theme inside your mastery' + (before.length ? ', different from these earlier gifts: ' + before.join('; ') : '') + '. '
      + 'Give five expressions or patterns that textbooks rarely teach but natives really use, things the learner can use this week. '
      + 'Each "phrase" is 1-5 words exactly as said (no slashes, no brackets, no "sb/sth"), so it can be searched in real videos. '
      + 'Return ONLY this JSON:\n'
      + '{"title":"at most 6 words","intro":"1-2 sentences in your own voice, English",'
      + '"items":[{"phrase":"...","register":"casual|neutral|formal","vi":"Vietnamese meaning","example":"one natural English sentence using it",'
      + '"example_vi":"Vietnamese translation of the example","note":"one short Vietnamese sentence: when and how to use it, or the trap"}],'
      + '"tip_vi":"one Vietnamese sentence: how to start using these today","try":"one short English task for the learner"}';
    var body = { contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 2400, responseMimeType: 'application/json' } };
    var res = await window.geminiPost(url, body);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var g = JSON.parse(window.geminiText(await res.json()).txt);
    if (!g || !g.items || !g.items.length) throw new Error('EMPTY');
    var gift = { id: 'g' + Date.now().toString(36), rid: r.id, name: r.name, species: r.species, mastery: m.id,
      masteryLabel: m.label, title: g.title, intro: g.intro, items: g.items.slice(0, 6), tip: g.tip_vi || '', task: g.try || '', at: Date.now() };
    var list = giftLoad(); list.unshift(gift); giftSave(list);
    withRecord(r.id, function (x) { x.giftsGiven = (x.giftsGiven || 0) + 1; });
    if (window.jnLogGift) window.jnLogGift(gift);
    return gift;
  }

  /* ---------------- the action bubble (a tap on an animal) ---------------- */
  var cur = null;
  function pips(r) {
    var n = Math.round((r.energy || 0) / 10), lvl = (r.energy || 0) < 34 ? 'l1' : (r.energy || 0) < 67 ? 'l2' : 'l3';
    var h = '<span class="pt-pips ' + lvl + '">';
    for (var i = 0; i < 10; i++) h += '<i' + (i < n ? ' class="on"' : '') + '></i>';
    return h + '</span>';
  }
  function bondBar(r) {
    var lo = prevGiftAt(r), hi = nextGiftAt(r), b = r.bond || 0;
    var pct = Math.max(0, Math.min(100, Math.round((b - lo) / Math.max(1, hi - lo) * 100)));
    return '<div class="pt-bond"><span>Bond</span><div class="pt-bond-bar"><i style="width:' + pct + '%"></i></div>'
      + '<b class="num">' + Math.min(b, hi) + ' / ' + hi + '</b></div>';
  }
  function ensureDom() {
    if ($('pt-act')) return;
    var d = document.createElement('div');
    d.innerHTML =
      '<div class="pt-act" id="pt-act"></div>'
      + '<div class="pt-sheet" id="pt-chat"><div class="pt-sheet-in" id="pt-chat-in"></div></div>'
      + '<div class="pt-sheet" id="pt-gift"><div class="pt-sheet-in" id="pt-gift-in"></div></div>'
      + '<div class="ygm" id="ygm"></div>';
    while (d.firstChild) document.body.appendChild(d.firstChild);
    $('pt-chat').addEventListener('click', function (e) { if (e.target.id === 'pt-chat') petCloseChat(); });
    $('pt-gift').addEventListener('click', function (e) { if (e.target.id === 'pt-gift') petCloseGift(); });
  }
  function find(id) { return (window.resTick ? window.resTick() : window.resLoad()).find(function (x) { return x.id === id; }); }
  function moodLine(r, said) { return said || (window.resLine ? window.resLine(r) : ''); }

  function renderAct(r, said) {
    var el = $('pt-act'), m = masteryOf(r);
    var meals = mealsToFull(r);
    var ready = giftReady(r);
    el.innerHTML =
      '<div class="pt-act-h"><div class="pt-act-ttl"><b>' + esc(r.name) + '</b><span>' + esc(speciesLabel(r)) + ' · master of ' + esc(m.label.toLowerCase()) + '</span></div>'
      + '<button class="pt-x" aria-label="Close" onclick="petHide()">×</button></div>'
      + '<div class="pt-say">' + esc(moodLine(r, said)) + '</div>'
      + '<div class="pt-energy">' + pips(r) + '<span class="pt-meals">' + (meals ? '<b class="num">' + meals + '</b> meal' + (meals === 1 ? '' : 's') + ' to full' : 'Full') + '</span></div>'
      + bondBar(r)
      + (ready ? '<button class="pt-giftbtn" onclick="petOpenGift(\'' + r.id + '\')"><span>\u{1F381}</span>' + esc(r.name) + ' has a gift for you</button>' : '')
      + '<div class="pt-btns">'
      + '<button onclick="petFeed(\'' + r.id + '\')"><i>\u{1F34E}</i>Feed<small class="num">2 XP</small></button>'
      + '<button onclick="petPet(\'' + r.id + '\')"><i>\u{1F43E}</i>Pet</button>'
      + '<button onclick="petTalk(\'' + r.id + '\')"><i>\u{1F4AC}</i>Talk</button>'
      + '<button onclick="petInfo(\'' + r.id + '\')"><i>ℹ️</i>About</button>'
      + '</div>';
  }
  var hideT = 0;
  function showAct(id, said) {
    ensurePersonas(); ensureDom();
    var r = find(id); if (!r) return;
    cur = id;
    renderAct(r, said);
    $('pt-act').classList.add('show');
    clearTimeout(hideT);
    hideT = setTimeout(petHide, 15000);
  }
  window.petTap = function (id) { showAct(id); };
  window.petHide = function () { var el = $('pt-act'); if (el) el.classList.remove('show'); clearTimeout(hideT); };
  function fx(id, kind) { try { if (window.fwResidentFx) window.fwResidentFx(id, kind); } catch (e) {} }

  window.petFeed = function (id) {
    var res = window.resFeed ? window.resFeed(id) : null;
    var r = find(id); if (!r) return;
    var said;
    if (res && res.ok) { care(id, 'feed'); fx(id, 'feed'); said = 'Mm. Thank you.'; }
    else if (res && res.reason === 'full') said = 'I could not eat another thing. Thank you though.';
    else if (res && res.reason === 'no-xp') said = 'You have nothing spare today. Sit with me instead?';
    showAct(id, said);
  };
  window.petPet = function (id) {
    var out = care(id, 'pet'); if (!out) return;
    fx(id, 'pet');
    var lines = ['*leans into your hand*', '*happy little wiggle*', '*closes its eyes and hums*', '*nudges you for more*'];
    showAct(id, out.counted ? lines[Math.floor(Math.random() * lines.length)] : '*content* That was plenty for today.');
  };
  window.petInfo = function (id) { petHide(); if (window.rzOpen) window.rzOpen(id); };

  /* ---------------- the chat ---------------- */
  var chatBusy = false;
  function fmtMsg(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b class="pt-hl" onclick="petPhrase(this)">$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>'); }
  function renderChat(r) {
    var m = masteryOf(r), v = voiceOf(r), msgs = chatLoad(r.id);
    var h = '<div class="pt-ch-h"><div class="pt-ava" data-species="' + esc(r.species) + '"></div>'
      + '<div class="pt-ch-t"><b>' + esc(r.name) + '</b><span>' + esc(v.label) + '</span><em>Master of ' + esc(m.label) + '</em></div>'
      + '<button class="pt-x" aria-label="Close" onclick="petCloseChat()">×</button></div>';
    h += '<div class="pt-msgs" id="pt-msgs">';
    if (!msgs.length) h += '<div class="pt-m pet">' + fmtMsg('Oh, hello. I am ' + r.name + '. Ask me anything about **' + m.label.toLowerCase() + '** — or just tell me about your day.') + '</div>';
    msgs.forEach(function (x) { h += '<div class="pt-m ' + (x.who === 'me' ? 'me' : 'pet') + '">' + fmtMsg(x.t) + '</div>'; });
    if (chatBusy) h += '<div class="pt-m pet typing"><i></i><i></i><i></i></div>';
    h += '</div>';
    var sugg = ['Teach me one ' + m.label.toLowerCase().replace(/s$/, '') + ' thing', 'How are you today?', 'Give me an example', 'Check my sentence: '];
    h += '<div class="pt-sugg">' + sugg.map(function (s) { return '<button onclick="petSuggest(this)">' + esc(s) + '</button>'; }).join('') + '</div>';
    h += '<form class="pt-in" onsubmit="event.preventDefault();petSend()"><input id="pt-input" type="text" autocomplete="off" placeholder="Say something to ' + esc(r.name) + '…" enterkeyhint="send"/>'
      + '<button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg></button></form>';
    $('pt-chat-in').innerHTML = h;
    var box = $('pt-msgs'); if (box) box.scrollTop = box.scrollHeight;
    var ava = document.querySelector('#pt-chat .pt-ava');
    if (ava && window.fwPortrait) Promise.resolve(window.fwPortrait(r.species)).then(function (u) { if (u) ava.style.backgroundImage = 'url(' + u + ')'; }).catch(function () {});
  }
  window.petTalk = function (id) {
    ensurePersonas(); ensureDom(); petHide();
    var r = find(id); if (!r) return;
    cur = id; renderChat(r);
    document.documentElement.classList.add('pt-chat-on');
  };
  window.petCloseChat = function () { document.documentElement.classList.remove('pt-chat-on'); };
  window.petSuggest = function (b) {
    var i = $('pt-input'); if (!i) return;
    var t = b.textContent;
    if (/:\s*$/.test(t)) { i.value = t; i.focus(); return; }
    i.value = t; petSend();
  };
  window.petSend = async function () {
    var i = $('pt-input'); if (!i || chatBusy) return;
    var t = i.value.trim(); if (!t) return;
    var r = find(cur); if (!r) return;
    var msgs = chatLoad(r.id); msgs.push({ who: 'me', t: t }); chatSave(r.id, msgs);
    chatBusy = true; renderChat(r);
    var reply;
    try { reply = await askPet(r, msgs.slice(0, -1), t); care(r.id, 'talk'); }
    catch (e) {
      reply = e.message === 'NO_KEY' ? '*tilts head* I can only talk once a Gemini key is set in Settings.'
        : e.message === 'OFFLINE' ? '*yawns* The wind is too quiet today — you seem to be offline.'
        : '*looks puzzled* Say that again? Something got lost on the way.';
    }
    chatBusy = false;
    msgs = chatLoad(r.id); msgs.push({ who: 'pet', t: reply }); chatSave(r.id, msgs);
    var fresh = find(r.id); renderChat(fresh || r);
    if (fresh && giftReady(fresh)) showGiftNudge(fresh);
  };
  function showGiftNudge(r) {
    var box = $('pt-msgs'); if (!box) return;
    var b = document.createElement('button'); b.className = 'pt-giftbtn in-chat';
    b.innerHTML = '<span>\u{1F381}</span>' + esc(r.name) + ' has a gift for you';
    b.onclick = function () { petOpenGift(r.id); };
    box.appendChild(b); box.scrollTop = box.scrollHeight;
  }
  window.petPhrase = function (el) { ygmPlay([el.textContent], 'From ' + (find(cur) || {}).name); };

  /* ---------------- the gift reader ---------------- */
  function regChip(x) { return x ? '<span class="pt-reg ' + esc(x) + '">' + esc(x) + '</span>' : ''; }
  function giftHtml(g) {
    var h = '<div class="pt-g-h"><div><span class="cz-cap">A gift from ' + esc(g.name) + ' · ' + esc(g.masteryLabel || '') + '</span>'
      + '<b class="pt-g-title">' + esc(g.title) + '</b></div><button class="pt-x" aria-label="Close" onclick="petCloseGift()">×</button></div>';
    if (g.intro) h += '<p class="pt-g-intro">' + esc(g.intro) + '</p>';
    h += '<button class="pt-listen" onclick="petListenGift(\'' + g.id + '\')"><span>▶</span>Listen to all of them in real clips</button>';
    h += '<ol class="pt-items">' + (g.items || []).map(function (it, i) {
      return '<li><div class="pt-it-h"><b>' + esc(it.phrase) + '</b>' + regChip(it.register)
        + '<button class="pt-play" aria-label="Listen" onclick="petListenGift(\'' + g.id + '\',' + i + ')">▶</button></div>'
        + (it.vi ? '<div class="pt-it-vi">' + esc(it.vi) + '</div>' : '')
        + (it.example ? '<div class="pt-it-ex">“' + esc(it.example) + '”' + (it.example_vi ? '<span>' + esc(it.example_vi) + '</span>' : '') + '</div>' : '')
        + (it.note ? '<div class="pt-it-note">' + esc(it.note) + '</div>' : '') + '</li>';
    }).join('') + '</ol>';
    if (g.tip) h += '<div class="pt-g-tip"><b>Use it today</b>' + esc(g.tip) + '</div>';
    if (g.task) h += '<div class="pt-g-task"><b>Try this</b>' + esc(g.task) + '</div>';
    h += '<div class="pt-g-foot">Kept in Saved › Gifts and in today’s Journal</div>';
    return h;
  }
  function openGiftSheet(html) {
    ensureDom();
    $('pt-gift-in').innerHTML = html;
    document.documentElement.classList.add('pt-gift-on');
  }
  window.petCloseGift = function () { document.documentElement.classList.remove('pt-gift-on'); };
  window.petOpenGift = async function (id) {
    petHide();
    var r = find(id); if (!r) return;
    if (!giftReady(r)) { var last = giftLoad().find(function (g) { return g.rid === id; }); if (last) openGiftSheet(giftHtml(last)); return; }
    openGiftSheet('<div class="pt-g-wait"><div class="pt-box">\u{1F381}</div><b>' + esc(r.name) + ' is wrapping something…</b><span>A little lesson in ' + esc(masteryOf(r).label.toLowerCase()) + '</span></div>');
    fx(id, 'gift');
    try {
      var g = await makeGift(r);
      openGiftSheet(giftHtml(g));
      if (window.fwToast) window.fwToast('New gift from ' + r.name + ' — kept in Saved');
    } catch (e) {
      openGiftSheet('<div class="pt-g-wait"><div class="pt-box">\u{1F381}</div><b>The gift is still wrapped</b><span>'
        + (e.message === 'NO_KEY' ? 'Add a Gemini key in Settings and it opens.' : 'It could not be opened just now.') + '</span>'
        + '<button class="btn" onclick="petOpenGift(\'' + id + '\')">Try again</button></div>');
    }
  };
  window.petShowGift = function (gid) { var g = giftLoad().find(function (x) { return x.id === gid; }); if (g) openGiftSheet(giftHtml(g)); };
  window.petListenGift = function (gid, idx) {
    var g = giftLoad().find(function (x) { return x.id === gid; }); if (!g) return;
    var ph = (g.items || []).map(function (it) { return it.phrase; }).filter(Boolean);
    ygmPlay(ph, g.title, idx || 0);
  };

  /* ---------------- the small player: real clips from YouGlish ----------------
     One widget, reused. Each phrase plays CLIPS clips: when the caption
     that holds the phrase has been heard, the next clip starts; after the
     last clip of a phrase, the next phrase. Nothing goes backwards unless
     the back button is pressed. The widget's own page is cropped to its
     video (components=2 puts the video at the top), and our transcript
     line sits beside it. */
  var CLIPS = 2;
  var Y = { w: null, q: [], qi: 0, clips: 0, track: 0, target: null, adv: false, paused: false, title: '', total: 0 };
  window.__ygm = Y;   // dev: read the player's state from the console
  function ygmDom() {
    var el = $('ygm');
    el.innerHTML = '<div class="ygm-v"><div class="ygm-vin"><div id="ygm-w"></div></div></div>'
      + '<div class="ygm-r"><div class="ygm-h"><b id="ygm-ph"></b><span id="ygm-n" class="num"></span></div>'
      + '<div class="ygm-cap" id="ygm-cap">Finding a real clip…</div>'
      + '<div class="ygm-c"><button onclick="ygmBack()" aria-label="Back">⏮</button>'
      + '<button id="ygm-pp" onclick="ygmToggle()" aria-label="Pause">⏸</button>'
      + '<button onclick="ygmNext()" aria-label="Next">⏭</button>'
      + '<span class="ygm-src">YouGlish</span>'
      + '<button class="ygm-x" onclick="ygmClose()" aria-label="Close">×</button></div></div>';
  }
  function ygmLabel() {
    var ph = $('ygm-ph'), n = $('ygm-n');
    if (ph) ph.textContent = Y.q[Y.qi] || '';
    if (n) n.textContent = (Y.qi + 1) + '/' + Y.q.length + (Y.track ? ' · clip ' + Y.track : '');
  }
  function ygmFetch() {
    Y.clips = 0; Y.track = 0; Y.target = null; Y.adv = false; ygmLabel();
    var cap = $('ygm-cap'); if (cap) cap.textContent = 'Finding a real clip…';
    Y.w.fetch(Y.q[Y.qi], 'english');
  }
  function clipDone() {
    if (Y.adv) return;
    Y.adv = true; Y.clips++;
    setTimeout(advance, 250);
  }
  function advance() {
    if (Y.paused || !Y.w) return;
    if (Y.clips < CLIPS && Y.track < Y.total) { Y.w.next(); return; }
    if (Y.qi < Y.q.length - 1) { Y.qi++; ygmFetch(); return; }
    Y.paused = true; var pp = $('ygm-pp'); if (pp) pp.textContent = '▶';
    try { Y.w.pause(); } catch (e) {}
    var cap = $('ygm-cap'); if (cap) cap.innerHTML = 'That was all of them. Press ⏮ to hear one again.';
  }
  window.ygmPlay = function (phrases, title, start) {
    ensureDom();
    Y.q = phrases.slice(); Y.qi = Math.max(0, Math.min(Y.q.length - 1, start || 0)); Y.title = title || '';
    Y.paused = false;
    var el = $('ygm');
    if (!Y.w) ygmDom();
    el.classList.add('show');
    document.documentElement.classList.add('ygm-on');
    var go = function () {
      if (!Y.w) {
        Y.w = new window.YG.Widget('ygm-w', { width: 240, components: 2, events: {
          onFetchDone: function (e) { Y.total = e.totalResult || 0; if (!Y.total) setTimeout(function () { Y.clips = CLIPS; Y.track = 0; advance(); }, 300); },
          onVideoChange: function (e) { Y.track = e.trackNumber || (Y.track + 1); Y.target = null; Y.adv = false; ygmLabel(); },
          onCaptionChange: function (e) {
            var raw = ''; try { raw = decodeURIComponent(e.caption || ''); } catch (x) { raw = e.caption || ''; }
            var hit = /\[\[\[/.test(raw);
            /* The widget does not report the clip's own caption as played --
               measured: the consumed event came for the captions after it,
               never for it, so a clip ran on for twenty seconds. The phrase
               has been said the moment the NEXT caption starts. */
            if (hit) { if (!Y.target) Y.target = e.id; }
            else if (Y.target && e.id !== Y.target) clipDone();
            var c = $('ygm-cap'); if (c) c.innerHTML = esc(raw).replace(/\[\[\[(.+?)\]\]\]/g, '<b>$1</b>');
          },
          onCaptionConsumed: function (e) { if (Y.target && e.id === Y.target) clipDone(); },
          onError: function () { var c = $('ygm-cap'); if (c) c.textContent = 'YouGlish could not play this one.'; }
        } });
      }
      ygmFetch();
      var pp = $('ygm-pp'); if (pp) pp.textContent = '⏸';
    };
    if (window.YG && window.YG.Widget) go();
    else if (window.ygLoadScript) window.ygLoadScript().then(go).catch(function () { var c = $('ygm-cap'); if (c) c.textContent = 'Could not reach YouGlish.'; });
  };
  window.ygmToggle = function () {
    if (!Y.w) return;
    Y.paused = !Y.paused;
    try { if (Y.paused) Y.w.pause(); else Y.w.play(); } catch (e) {}
    var pp = $('ygm-pp'); if (pp) pp.textContent = Y.paused ? '▶' : '⏸';
  };
  window.ygmNext = function () { if (!Y.w) return; Y.paused = false; Y.clips = CLIPS; advance(); };
  window.ygmBack = function () {
    if (!Y.w) return;
    Y.paused = false; var pp = $('ygm-pp'); if (pp) pp.textContent = '⏸';
    if (Y.track > 1) { Y.clips = Math.max(0, Y.clips - 1); Y.w.previous(); }
    else if (Y.qi > 0) { Y.qi--; ygmFetch(); }
    else { try { Y.w.replay(); } catch (e) {} }
  };
  window.ygmClose = function () {
    try { if (Y.w) Y.w.close(); } catch (e) {}
    Y.w = null; var el = $('ygm'); if (el) { el.classList.remove('show'); el.innerHTML = ''; }
    document.documentElement.classList.remove('ygm-on');
  };

  /* ---------------- the animal's card ---------------- */
  var baseInfo = window.resInfoHtml;
  window.resInfoHtml = function (r) {
    ensurePersonas();
    r = find(r.id) || r;
    var sp = (window.RES_SPECIES || {})[r.species] || { label: r.species };
    var v = voiceOf(r), m = masteryOf(r), meals = mealsToFull(r);
    var age = window.resAgeDays ? window.resAgeDays(r) : 0;
    var gifts = giftLoad().filter(function (g) { return g.rid === r.id; });
    var h = '<button class="pt-x rz-x" aria-label="Close" onclick="rzClose()">×</button>';
    h += '<div class="rz-pic" data-species="' + esc(r.species) + '"></div>';
    h += '<div class="rz-head"><div class="rz-name">' + esc(r.name) + '</div>'
      + '<div class="rz-species">' + esc(sp.label) + ' · ' + (window.resStage ? window.resStage(r) : '') + ' · <span class="num">' + age + '</span> day' + (age === 1 ? '' : 's') + ' old</div></div>';
    h += '<div class="pt-persona"><div><span>Master of</span><b>' + esc(m.label) + '</b><i>' + esc(m.vi) + '</i></div>'
      + '<div><span>Personality</span><b>' + esc(v.label) + '</b><i>' + esc(v.vi) + '</i></div></div>';
    h += '<div class="pt-energy big">' + pips(r) + '<span class="pt-meals">' + (meals ? '<b class="num">' + meals + '</b> meal' + (meals === 1 ? '' : 's') + ' to full · each meal one bar' : 'Full of energy') + '</span></div>';
    h += bondBar(r);
    h += '<div class="pt-bond-why">Petting, feeding and talking grow the bond. At each mark, a happy ' + esc(sp.label.toLowerCase()) + ' gives you a lesson from its mastery.</div>';
    if (giftReady(r)) h += '<button class="pt-giftbtn" onclick="rzClose();petOpenGift(\'' + r.id + '\')"><span>\u{1F381}</span>A gift is ready</button>';
    if (gifts.length) h += '<div class="pt-gifts"><span class="cz-cap">Gifts from ' + esc(r.name) + '</span>' + gifts.map(function (g) {
      return '<button onclick="rzClose();petShowGift(\'' + g.id + '\')">\u{1F381} ' + esc(g.title) + '</button>'; }).join('') + '</div>';
    if (r.trait) h += '<div class="rz-trait">' + esc(r.trait) + '</div>';
    if (r.likes) h += '<div class="rz-likes">Loves <b>' + esc(r.likes) + '</b>' + (r.found ? ' · found ' + esc(r.found) : '') + '</div>';
    h += '<div class="pt-btns in-card">'
      + '<button onclick="rzClose();petFeed(\'' + r.id + '\')"><i>\u{1F34E}</i>Feed<small class="num">2 XP</small></button>'
      + '<button onclick="rzClose();petPet(\'' + r.id + '\')"><i>\u{1F43E}</i>Pet</button>'
      + '<button onclick="rzClose();petTalk(\'' + r.id + '\')"><i>\u{1F4AC}</i>Talk</button></div>';
    return h;
  };

  /* ---------------- back ---------------- */
  window.petBack = function () {
    var H = document.documentElement;
    if (H.classList.contains('pt-gift-on')) { petCloseGift(); return true; }
    if (H.classList.contains('pt-chat-on')) { petCloseChat(); return true; }
    var a = $('pt-act'); if (a && a.classList.contains('show')) { petHide(); return true; }
    return false;
  };

  window.petEnsure = ensurePersonas;
  window.giftLoad = giftLoad;
  window.petMasteries = MASTERIES;
  setTimeout(ensurePersonas, 0);
})();
