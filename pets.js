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
  /* What each one is an expert in -- a corner of LIFE, not of grammar.
     The user's call: a healer, a love expert, a tarot reader, a survival
     expert, an office insider... The English comes from talking to them
     about it. "brief" goes into the prompts. */
  var MASTERIES = [
    { id: 'healer',   label: 'Healing psychologist',     vi: 'Chuyên gia tâm lý chữa lành',  brief: 'a warm, practical healing psychologist: stress, anxiety, burnout, self-kindness, small daily ways to feel better' },
    { id: 'love',     label: 'Love & relationships',     vi: 'Chuyên gia tình cảm',          brief: 'a relationship expert: crushes, dating, breakups, jealousy, how couples talk through problems' },
    { id: 'stars',    label: 'Astrology & tarot',        vi: 'Bói toán, chiêm tinh, tarot',  brief: 'an astrologer and tarot reader: zodiac signs, horoscopes, constellations, tarot cards -- playful and kind, never fatalistic' },
    { id: 'survival', label: 'Survival expert',          vi: 'Chuyên gia sinh tồn',          brief: 'a survival expert: the outdoors, storms and floods, first aid basics, staying calm in an emergency' },
    { id: 'office',   label: 'Office life insider',      vi: 'Chuyên gia công sở',           brief: 'an office insider: work emails, meetings, office politics and unwritten rules (never share your salary with colleagues, cc carefully...)' },
    { id: 'career',   label: 'Career strategist',        vi: 'Định hướng sự nghiệp',         brief: 'a career strategist: CVs, interviews, asking for a raise, changing careers, building a reputation' },
    { id: 'money',    label: 'Money coach',              vi: 'Quản lý tài chính cá nhân',    brief: 'a money coach: budgeting, saving, debt, spotting scams -- general habits, never specific investment picks' },
    { id: 'family',   label: 'Family counsellor',        vi: 'Tư vấn gia đình',              brief: 'a family counsellor: parents, siblings, in-laws, generation gaps, family arguments and making peace' },
    { id: 'parent',   label: 'Parenting guide',          vi: 'Nuôi dạy con',                 brief: 'a parenting guide: little kids, teenagers, screen time, tantrums, raising kind children' },
    { id: 'growth',   label: 'Self-growth coach',        vi: 'Phát triển bản thân',          brief: 'a self-growth coach: habits, discipline, procrastination, confidence, setting goals that stick' },
    { id: 'chem',     label: 'Everyday chemist',         vi: 'Hóa học đời thường',           brief: 'an everyday chemist who explains the chemistry around you and the environment with facts people can see: why onions sting, why bleach and vinegar must never mix, why the sea is turning acidic, what really happens to plastic' },
    { id: 'body',     label: 'Body & health nerd',       vi: 'Sức khỏe và cơ thể',           brief: 'a body and health nerd: sleep, food, exercise, how the body works -- general wellbeing, and a doctor for anything serious' },
    { id: 'kitchen',  label: 'Kitchen wizard',           vi: 'Bếp núc',                      brief: 'a kitchen wizard: cooking tricks, the science of food, rescuing leftovers, eating well on little money' },
    { id: 'hacks',    label: 'Life-hack master',         vi: 'Mẹo sống thường ngày',         brief: 'a life-hack master: renting a flat, small repairs, cleaning, travel packing, everyday common sense' },
    { id: 'social',   label: 'Social skills coach',      vi: 'Kỹ năng giao tiếp',            brief: 'a social skills coach: making friends as an adult, small talk, saying no, handling awkward moments and conflict' },
    { id: 'mind',     label: 'Mindfulness guide',        vi: 'Thiền và tâm linh',            brief: 'a mindfulness and spirituality guide: meditation, Buddhist and Zen ideas, gratitude, rituals, finding calm' },
    { id: 'dreams',   label: 'Dream interpreter',        vi: 'Giải mã giấc mơ',              brief: 'a dream interpreter: common dream symbols and what different cultures believe they mean -- curious, never alarming' },
    { id: 'history',  label: 'History storyteller',      vi: 'Người kể chuyện lịch sử',      brief: 'a history storyteller: surprising true stories from the past and what they say about today' },
    { id: 'nature',   label: 'Sky & nature explorer',    vi: 'Khám phá vũ trụ và tự nhiên',  brief: 'a sky and nature explorer: stars, planets, weather, animals, how the natural world works' },
    { id: 'brain',    label: 'Behaviour scientist',      vi: 'Khoa học hành vi',             brief: 'a behaviour scientist: why people do what they do -- biases, habits, motivation, persuasion' },
    { id: 'tech',     label: 'Tech & online safety',     vi: 'Công nghệ và an toàn mạng',    brief: 'a tech helper: phones, privacy, passwords, AI tools, online scams and how to stay safe' },
    { id: 'travel',   label: 'Travel & culture insider', vi: 'Du lịch và văn hóa',           brief: 'a travel and culture insider: customs and manners around the world, travel tricks, culture shock' },
    { id: 'green',    label: 'Green living expert',      vi: 'Sống xanh',                    brief: 'a green living expert: recycling properly, low-waste habits, saving energy and water at home' },
    { id: 'muse',     label: 'Creativity muse',          vi: 'Nàng thơ sáng tạo',            brief: 'a creativity muse: writing, drawing, music, getting unstuck, making small things every day' }
  ];
  var MASTERY_IDS = MASTERIES.map(function (m) { return m.id; });
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
      if (r.persona && MASTERY_IDS.indexOf(r.persona.mastery) >= 0) takenM[r.persona.mastery] = (takenM[r.persona.mastery] || 0) + 1;
      if (r.persona && r.persona.voice) (voicesBySp[r.species] = voicesBySp[r.species] || []).push(r.persona.voice);
    });
    list.forEach(function (r) {
      // an animal from before the experts (grammar masteries) is reassigned
      if (r.persona && MASTERY_IDS.indexOf(r.persona.mastery) >= 0 && r.persona.voice) return;
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

  /* ---------------- care ----------------
     The balance (see XP-RULES.md for the whole table). Bond per action and
     a daily cap on how much of it counts, so a gift is earned over days of
     looking after an animal rather than in one sitting of tapping:
       pet +1 (5 a day)  feed +1 (4)  talk +1 a message (6)  bath +2 (1)
       sleep +1 (2)      paragraph hunt +3 each animal (2)   Word Pairs round +2 (2)
     That is at most 26 a day; gifts come at 6, 16, 30, 48, 70, 96, 126,
     160 -- the first on day one, then every one to three days of care. */
  var GIFT_AT = [6, 16, 30, 48, 70, 96, 126, 160];
  function nextGiftAt(r) {
    var n = r.giftsGiven || 0;
    return n < GIFT_AT.length ? GIFT_AT[n] : GIFT_AT[GIFT_AT.length - 1] + 40 * (n - GIFT_AT.length + 1);
  }
  function prevGiftAt(r) { var n = r.giftsGiven || 0; return n === 0 ? 0 : (n - 1 < GIFT_AT.length ? GIFT_AT[n - 1] : nextGiftAt({ giftsGiven: n - 1 })); }
  /* A gift is brought back from a long sleep. Reaching the bond mark is not
     enough on its own any more -- the user found that tapping pet and feed
     a few dozen times produced a gift on the spot, and a reward that comes
     on demand is no reward. Now: reach the mark, keep the animal happy,
     send it to sleep, and it wakes three hours later with something for you.
     At most one gift a day per animal. */
  function bondReached(r) { return (r.bond || 0) >= nextGiftAt(r); }
  function giftReady(r) { return !!r.giftWaiting; }
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
  var CAP = { pet: 5, feed: 4, talk: 6, bath: 1, sleep: 2, play: 2, quiz: 2 };
  var BOND = { pet: 1, feed: 1, talk: 1, bath: 2, sleep: 1, play: 3, quiz: 2 };
  var JOY = { pet: 4, feed: 0, talk: 2, bath: 6, sleep: 8, play: 5, quiz: 5 };
  function care(id, kind) {
    return withRecord(id, function (r) {
      var n = bump(r, kind + 'Day');
      var counted = n <= CAP[kind];
      if (counted) r.bond = (r.bond || 0) + BOND[kind];
      r.happiness = Math.min(100, (r.happiness || 0) + (counted ? JOY[kind] : 1));
      return { r: r, counted: counted };
    });
  }
  function mealsToFull(r) { return Math.max(0, Math.ceil((100 - (r.energy || 0)) / 10)); }

  /* Clean: full after a bath, a quarter lost a day. */
  var HOUR = 3600000;
  function cleanOf(r) { var t = r.lastBath || r.adoptedAt || Date.now(); return Math.max(0, Math.round(100 - (Date.now() - t) / DAY * 25)); }
  function cleanWord(c) { return c >= 85 ? 'fresh' : c >= 55 ? 'a bit dusty' : c >= 25 ? 'grubby' : 'muddy'; }
  /* Sleep: fifteen minutes in a house restores three bars and a good mood,
     free -- the other way to keep an animal going besides spending XP on
     food. Once every six hours. */
  var SLEEP_MS = 3 * HOUR, SLEEP_GAP = 4 * HOUR;
  function settleSleep(r) {
    if (!r.sleepUntil || Date.now() < r.sleepUntil) return false;
    var gift = false;
    withRecord(r.id, function (x) {
      if (!x.sleepUntil || Date.now() < x.sleepUntil) return;
      x.energy = Math.min(100, (x.energy || 0) + 50);
      x.sleepUntil = 0; x.wokeAt = Date.now();
      if (!x.giftWaiting && bondReached(x) && (x.happiness || 0) >= 50 && x.lastGiftDay !== today()) { x.giftWaiting = true; gift = true; }
    });
    care(r.id, 'sleep');
    return gift ? 'gift' : true;
  }
  function asleep(r) { return !!(r.sleepUntil && Date.now() < r.sleepUntil); }
  function settleAll() { (window.resLoad ? window.resLoad() : []).forEach(settleSleep); }
  document.addEventListener('focci-resident-woke', function (e) {
    var id = (e.detail || {}).id, r = id && find(id);
    if (r) {
      var got = settleSleep(r);
      if (window.fwToast) window.fwToast(got === 'gift' ? r.name + ' woke up with a gift for you \u{1F381}' : r.name + ' woke up rested \u2014 +5 energy bars');
    }
  });
  setInterval(settleAll, 60000);

  /* ---------------- talking (Gemini, in character) ---------------- */
  function chatLoad(id) { return (readJSON(CHAT_LS, {})[id] || []); }
  function chatSave(id, msgs) { var all = readJSON(CHAT_LS, {}); all[id] = msgs.slice(-30); writeJSON(CHAT_LS, all); }
  function speciesLabel(r) { var sp = (window.RES_SPECIES || {})[r.species]; return sp ? sp.label : r.species; }
  function systemFor(r) {
    var v = voiceOf(r), m = masteryOf(r);
    return 'You are ' + r.name + ', a ' + speciesLabel(r).toLowerCase() + ' who lives on Fox Island with Focci the fox. '
      + 'You talk like a real friend, not an assistant. Your manner: ' + v.how + '. '
      + (r.trait ? 'Your quirk: ' + r.trait + '. ' : '') + (r.likes ? 'You love ' + r.likes + '. ' : '')
      + 'On the island you are known as ' + m.brief + '. '
      + 'You are chatting with a Vietnamese person who is practising English (around B1). '
      + 'How you talk: sound human -- contractions, little reactions ("oh", "hmm", "honestly"), your own opinions and tiny stories from island life. '
      + 'No lists, no headings, never "As an AI". Never open by praising the question ("smart question", "great question", "good one") -- just answer. '
      + 'Answer EXACTLY what they asked, with concrete, specific help a real expert would give: actual steps, the real names of tools, places or signs to look for. '
      + 'Example: asked "how can I know if my photo is used in a deepfake?", say to run a reverse image search (Google Lens, TinEye, PimEyes), set alerts for their name, and what to do if they find one -- not how to spot fakes in general. '
      + 'Your words appear in speech bubbles over your head, so: two to six short sentences in total, split into one to three bubble-sized parts, '
      + 'each part under 35 words, with " || " between parts (no "||" if one part is enough). '
      + 'Answer from your expertise when you can; if they ask about something else, still help properly, from your own angle. '
      + 'When it fits naturally (not every time), use one useful English expression and wrap it in **double asterisks**. '
      + 'If their English has a mistake, echo the right version once, casually, the way a friend would. '
      + 'If they write in Vietnamese, reply in simple English and put the Vietnamese of your key phrase in brackets. '
      + 'For health, money or legal worries give caring, general guidance and suggest a professional for anything serious. '
      + 'Mood right now: ' + (window.resMood ? window.resMood(r) : 'content') + '.';
  }
  async function askPet(r, history, userText) {
    var key = window.getKey && window.getKey();
    if (!key) throw new Error('NO_KEY');
    if (!navigator.onLine) throw new Error('OFFLINE');
    var model = window.getModel();
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key);
    var contents = history.slice(-14).map(function (m) { return { role: m.who === 'me' ? 'user' : 'model', parts: [{ text: m.t }] }; });
    contents.push({ role: 'user', parts: [{ text: userText }] });
    /* 2.5 models think before they answer, and the thinking counts against
       maxOutputTokens: at 400 a considered question could come back empty,
       or after ten seconds. A chat bubble needs no thinking. */
    var gen = { temperature: 0.85, maxOutputTokens: 800 };
    if (/2\.5/.test(model)) gen.thinkingConfig = { thinkingBudget: 0 };
    var body = { systemInstruction: { parts: [{ text: systemFor(r) }] }, contents: contents, generationConfig: gen };
    var res = await Promise.race([window.geminiPost(url, body),
      new Promise(function (_, rej) { setTimeout(function () { rej(new Error('SLOW')); }, 25000); })]);
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
    var prompt = 'You are ' + r.name + ', a ' + speciesLabel(r).toLowerCase() + ' (' + v.how + '), known on Fox Island as ' + m.brief + '. '
      + 'You are giving a GIFT to a Vietnamese learner of English (about B1) who has looked after you. '
      + 'Pick ONE specific, practical theme from your field' + (before.length ? ', different from these earlier gifts: ' + before.join('; ') : '') + '. '
      + 'Give five English expressions people really use when talking about that theme -- the kind a textbook rarely teaches -- '
      + 'each paired with something genuinely useful to know about the theme itself. '
      + 'Each "phrase" is 1-5 words exactly as said (no slashes, no brackets, no "sb/sth"), so it can be found in real videos. '
      + 'Return ONLY this JSON:\n'
      + '{"title":"at most 6 words","intro":"1-2 sentences in your own voice, English",'
      + '"items":[{"phrase":"...","register":"casual|neutral|formal","vi":"Vietnamese meaning","example":"one natural English sentence using it",'
      + '"example_vi":"Vietnamese translation of the example","note":"one short Vietnamese sentence: a real tip or fact about the theme that goes with this phrase"}],'
      + '"tip_vi":"one Vietnamese sentence: how to use this in real life this week","try":"one short English task for the learner"}';
    var body = { contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 2400, responseMimeType: 'application/json' } };
    var res = await window.geminiPost(url, body);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var g = JSON.parse(window.geminiText(await res.json()).txt);
    if (!g || !g.items || !g.items.length) throw new Error('EMPTY');
    var gift = { id: 'g' + Date.now().toString(36), rid: r.id, name: r.name, species: r.species, mastery: m.id,
      masteryLabel: m.label, title: g.title, intro: g.intro, items: g.items.slice(0, 6), tip: g.tip_vi || '', task: g.try || '', at: Date.now() };
    var list = giftLoad(); list.unshift(gift); giftSave(list);
    withRecord(r.id, function (x) { x.giftsGiven = (x.giftsGiven || 0) + 1; x.giftWaiting = false; x.lastGiftDay = today(); });
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
    var note = r.giftWaiting ? '' : bondReached(r)
      ? '<div class="pt-bond-note">\u{1F319} Bond is high enough \u2014 after a long sleep, ' + esc(r.name) + ' will bring you a gift' + ((r.happiness || 0) < 50 ? ' (cheer them up first)' : '') + '</div>'
      : '';
    return '<div class="pt-bond"><span>Bond</span><div class="pt-bond-bar"><i style="width:' + pct + '%"></i></div>'
      + '<b class="num">' + Math.min(b, hi) + ' / ' + hi + '</b></div>' + note;
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

  function W() { return window.fwWorld || null; }
  /* ---------------- a tap on an animal: the ring ----------------
     The camera eases in and turns toward the animal (world.js focusStart),
     a small status card sits over its head, and its actions open around it
     as round buttons with a caption under each -- the user's design. The
     old card at the bottom of the screen read as a menu bolted onto the
     island; the ring belongs to the animal it is around. The whole story
     of the animal is behind the "?" on the card. Everything follows the
     animal on screen every frame (focusAnchor). */
  var SVG = {
    feed: '<path d="M12 7c-1.2-2.6-4.6-2.4-5.8.2-1.4 3.1.4 8.3 2.8 9.8 1.2.8 2 .3 3 .3s1.8.5 3-.3c2.4-1.5 4.2-6.7 2.8-9.8C16.6 4.6 13.2 4.4 12 7z"/><path d="M12 7c0-1.6.6-3 2-4"/>',
    pet: '<circle cx="7" cy="10" r="1.7"/><circle cx="10.5" cy="6.5" r="1.7"/><circle cx="14.5" cy="6.5" r="1.7"/><circle cx="18" cy="10" r="1.7"/><path d="M8.5 16.5c0-2.4 1.6-4.5 4-4.5s4 2.1 4 4.5c0 1.7-1.3 2.6-2.6 2.2-.9-.3-1.9-.3-2.8 0-1.3.4-2.6-.5-2.6-2.2z"/>',
    talk: '<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V15h0A2 2 0 0 1 5 13z"/><path d="M9 9.5h6M9 12h3.5"/>',
    quiz: '<rect x="3.5" y="6" width="8" height="12" rx="2"/><rect x="12.5" y="6" width="8" height="12" rx="2"/><path d="M6 10h3M15 10h3M6 13h2M15 13h2"/>',
    bath: '<path d="M12 4c2.6 3.4 5 6.4 5 9a5 5 0 0 1-10 0c0-2.6 2.4-5.6 5-9z"/><path d="M10 13.5a2 2 0 0 0 2 2"/>',
    sleep: '<path d="M18.5 14.5A7 7 0 0 1 9.5 5.5a7 7 0 1 0 9 9z"/><path d="M15 5h3l-3 3h3"/>',
    play: '<path d="M10 4.5h4V7a1.6 1.6 0 1 0 3 0V4.5h2.5V9H17a1.6 1.6 0 1 0 0 3h2.5v7.5H15V17a1.6 1.6 0 1 0-3 0v2.5H4.5V12H7a1.6 1.6 0 1 0 0-3H4.5V4.5H10z"/>',
    energy: '<path d="M13 3 6 13.5h5L10 21l7-10.5h-5z"/>',
    heart: '<path d="M12 19.5s-7-4.3-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.1c0 5.1-7 9.4-7 9.4z"/>',
    drop: '<path d="M12 4c2.6 3.4 5 6.4 5 9a5 5 0 0 1-10 0c0-2.6 2.4-5.6 5-9z"/>'
  };
  function ic(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + SVG[k] + '</svg>'; }
  // the user's own icons for the actions (assets/icons); the line icons stay for the meters
  var PNG = { feed: 'feed', pet: 'pet', talk: 'talk', quiz: 'puzzle', play: 'ball', bath: 'bath', sleep: 'sleep' };
  function png(k) { return '<img src="./assets/icons/' + PNG[k] + '.png" alt="" draggable="false"/>'; }
  var ACTS = [
    { k: 'feed', t: 'Feed', fn: 'petFeed', sub: '2 XP' },
    { k: 'pet', t: 'Pet', fn: 'petPet' },
    { k: 'talk', t: 'Talk', fn: 'petTalk' },
    { k: 'quiz', t: 'Word Pairs', fn: 'petQuiz' },
    { k: 'play', t: 'Play', fn: 'petPlay' },
    { k: 'bath', t: 'Bath', fn: 'petBath' },
    { k: 'sleep', t: 'Sleep', fn: 'petSleep' }
  ];
  var RG = { id: null, raf: 0, quiz: false };
  function ringDom() {
    if ($('pr')) return;
    var d = document.createElement('div');
    d.innerHTML = '<div class="pr" id="pr"><div class="pr-stat" id="pr-stat"></div><div class="pr-ring" id="pr-ring"></div></div>'
      + '<div class="pq2" id="pq2"></div>';
    while (d.firstChild) document.body.appendChild(d.firstChild);
    ringPress($('pr-ring'), function (fn, id) { if (typeof window[fn] === 'function') window[fn](id || undefined); });
  }
  function meter(k, pct, txt, cls) {
    return '<div class="pr-m ' + (cls || '') + '"><i>' + ic(k) + '</i><div class="pr-bar"><b style="width:' + Math.max(0, Math.min(100, pct)) + '%"></b></div>'
      + '<span class="num">' + txt + '</span></div>';
  }
  function timeLeft(ms) { var m = Math.max(1, Math.round(ms / 60000)); return m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + ' min'; }
  function renderAct(r, said) {
    var m = masteryOf(r), c = cleanOf(r), e = r.energy || 0, hp = r.happiness || 0;
    var lo = prevGiftAt(r), hi = nextGiftAt(r), b = r.bond || 0;
    var sleeping = asleep(r);
    var h = '<div class="pr-h"><div class="pr-ttl"><b>' + esc(r.name) + '</b><span>' + esc(speciesLabel(r)) + ' · ' + esc(m.label) + '</span></div>'
      + '<button class="pr-i" aria-label="About ' + esc(r.name) + '" onclick="petInfo(\'' + r.id + '\')">?</button></div>';
    if (sleeping) {
      h += '<div class="pr-sleep"><span class="pr-dots"><i></i><i></i><i></i></span>Asleep · wakes in <b class="num">' + timeLeft(r.sleepUntil - Date.now()) + '</b></div>';
    } else {
      h += '<div class="pr-ms">'
        + meter('energy', e, Math.round(e / 10) + '/10', e < 34 ? 'lo' : e < 67 ? 'mid' : 'hi')
        + meter('heart', hp, Math.round(hp) + '%', 'joy')
        + meter('drop', c, cleanWord(c), 'wet') + '</div>';
      h += '<div class="pr-bond"><span>Bond</span><div class="pr-bar"><b style="width:' + Math.max(0, Math.min(100, Math.round((b - lo) / Math.max(1, hi - lo) * 100))) + '%"></b></div>'
        + '<span class="num">' + Math.min(b, hi) + '/' + hi + '</span></div>';
      if (bondReached(r) && !r.giftWaiting) h += '<div class="pr-note">\u{1F319} After a long sleep, ' + esc(r.name) + ' will bring you a gift' + (hp < 50 ? ' (cheer them up first)' : '') + '</div>';
    }
    if (giftReady(r)) h += '<button class="pt-giftbtn pr-gift" onclick="petOpenGift(\'' + r.id + '\')"><span>\u{1F381}</span>A gift for you</button>';
    var line = moodLine(r, said);
    if (line) h += '<div class="pr-say">' + esc(line) + '</div>';
    $('pr-stat').innerHTML = h;
    var ring = $('pr-ring');
    ring.innerHTML = sleeping ? '' : ACTS.map(function (a, i) {
      return '<button class="pr-b pr-' + a.k + '" style="--i:' + i + '" data-act="' + a.fn + '" data-id="' + (a.k === 'play' ? '' : r.id) + '">'
        + '<span class="pr-c">' + png(a.k) + '</span><span class="pr-t">' + a.t + (a.sub ? '<small class="num">' + a.sub + '</small>' : '') + '</span></button>';
    }).join('');
  }
  var _place = { w: 0 };
  function placeRing() {
    var el = $('pr'); if (!el || !RG.id) return;
    /* While a finger is down on the ring nothing moves under it. The
       ring follows the animal every frame and the camera is still easing
       in for the first half second, so a button could slide out from
       under a tap before it lifted -- the "Bath does nothing, the buttons
       feel offset" report. */
    if (RG.press) return;
    var a = W() && W().focusAnchor ? W().focusAnchor() : null;
    if (!a || !a.c.on || a.id !== RG.id) { el.classList.add('off'); return; }
    el.classList.remove('off');
    var VW = window.innerWidth, VH = window.innerHeight;
    var st = $('pr-stat'), sw = st.offsetWidth, sh = st.offsetHeight;
    var sx = Math.max(10, Math.min(VW - sw - 10, a.top.x - sw / 2));
    var sy = Math.max(70, a.top.y - sh - 16);
    st.style.transform = 'translate(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px)';
    var bs = $('pr-ring').children, n = bs.length;
    if (!n) return;
    /* An arc under and around the animal, from just above its left side,
       through below it, to just above its right: the card has the top. */
    // 72px buttons: under 126 the top pairs (Feed/Pet, Sleep/Bath) overlapped
    var R = Math.max(126, Math.min(165, a.r + 70));
    // the highest buttons sit level with the middle, so the middle goes below the card
    var cy = Math.max(a.c.y, sy + sh + 44 + R * 0.17);
    for (var i = 0; i < n; i++) {
      var th = (190 - (200 * i) / (n - 1)) * Math.PI / 180;
      var x = a.c.x + Math.cos(th) * R, y = cy + Math.sin(th) * R;
      x = Math.max(34, Math.min(VW - 34, x));
      y = Math.max(sy + sh + 30, Math.min(VH - 58, y));
      var tx = 'translate(' + Math.round(x - 32) + 'px,' + Math.round(y - 27) + 'px)';
      if (bs[i]._tx !== tx) { bs[i].style.transform = tx; bs[i]._tx = tx; }
    }
  }
  /* One handler for the whole ring, on the finger lifting over the same
     button it went down on -- not onclick, which WebKit drops when the
     element moved between touchstart and touchend. */
  function ringPress(root, onAct) {
    var down = null;
    root.addEventListener('pointerdown', function (e) {
      var b = e.target.closest && e.target.closest('[data-act]'); if (!b) return;
      down = b; RG.press = true; b.classList.add('down');
    });
    var end = function (e) {
      var b = down; down = null; RG.press = false;
      if (!b) return;
      b.classList.remove('down');
      if (e.type !== 'pointerup') return;
      var r = b.getBoundingClientRect();
      // lifted anywhere over that button (with a little slack) counts
      if (e.clientX < r.left - 14 || e.clientX > r.right + 14 || e.clientY < r.top - 14 || e.clientY > r.bottom + 14) return;
      onAct(b.dataset.act, b.dataset.id);
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
  }
  function ringLoop() {
    cancelAnimationFrame(RG.raf);
    var step = function () { if (!RG.id) return; placeRing(); RG.raf = requestAnimationFrame(step); };
    step();
  }
  function showAct(id, said) {
    ensurePersonas(); ensureDom(); ringDom();
    var r = find(id); if (!r) return;
    var fresh = RG.id !== id;
    cur = id; RG.id = id;
    renderAct(r, said);
    /* An answer has to be seen: Bath on a clean animal only swapped one
       line of small italic text, and it read as "the button does
       nothing". The line pops and the phone ticks. */
    if (said) {
      var sl = document.querySelector('#pr-stat .pr-say');
      if (sl) { sl.classList.remove('pop'); void sl.offsetWidth; sl.classList.add('pop'); }
      if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
    }
    var el = $('pr');
    if (fresh) {
      el.classList.remove('on'); void el.offsetWidth;
      if (W() && W().focusStart) W().focusStart(id);
    }
    el.classList.add('on');
    document.documentElement.classList.add('pr-open');
    ringLoop();
  }
  /* A tap anywhere on the island that is not an animal puts the ring
     away and lets the camera go back. */
  document.addEventListener('pointerdown', function (e) {
    if (e.target && e.target.id === 'fw-canvas' && RG.id) petHide();
  }, true);
  window.petTap = function (id) {
    var r = find(id); if (r) settleSleep(r);
    if (H) { huntTap(id); return; }
    showAct(id);
  };
  window.petHide = function (keepCam) {
    var el = $('pr'); if (el) el.classList.remove('on');
    cancelAnimationFrame(RG.raf);
    RG.id = null;
    document.documentElement.classList.remove('pr-open');
    quizClose(true);
    if (!keepCam && W() && W().focusEnd) W().focusEnd();
  };

  /* ---------------- Word Pairs, asked by an animal ----------------
     The game moved here from the games page: five questions in a small
     card at the bottom while the animal stands over it, four choices
     each. Words you looked up or saved first, decoys from the whole
     library (buildMatchRounds in app.js). +1 XP a right answer, and each
     answer goes into the word's review record like the old game did. */
  var Q = null;
  async function quizDeck() {
    var all = (await idbAllCached()).filter(function (r) { return !r.alias && r.data && !r.data.explain && !r.data.phrase && meaningOf(r); });
    var seen = {};
    try { (await logAll()).forEach(function (l) { if (l.type === 'search' && l.word) seen[l.word] = 1; }); } catch (e) {}
    var mine = all.filter(function (r) { return r.saved || seen[r.word]; });
    var shuffle = function (a) { return a.sort(function () { return Math.random() - 0.5; }); };
    var deck = shuffle(mine.slice()).slice(0, 5);
    if (deck.length < 5) deck = deck.concat(shuffle(all.filter(function (r) { return deck.indexOf(r) < 0; })).slice(0, 5 - deck.length));
    return { deck: deck, all: all };
  }
  window.petQuiz = async function (id) {
    var r = find(id); if (!r) return;
    if (asleep(r)) return;
    ringDom();
    var got = await quizDeck();
    if (got.deck.length < 4 || got.all.length < 6) { showAct(id, 'Look up a few words first — then I will quiz you on them!'); return; }
    var rounds = buildMatchRounds(got.deck, got.all).map(function (x) {
      var o = x.opts.filter(function (w) { return w !== x.answer; }).slice(0, 3).concat([x.answer]);
      x.opts = o.sort(function () { return Math.random() - 0.5; });
      return x;
    });
    Q = { id: id, name: r.name, rounds: rounds, i: 0, hits: 0, lock: false };
    RG.quiz = true; $('pr').classList.add('quiz');
    renderQuiz();
    $('pq2').classList.add('on');
  };
  function renderQuiz() {
    var el = $('pq2'); if (!Q || !el) return;
    var dots = Q.rounds.map(function (x, i) { return '<i class="' + (x._ok === true ? 'ok' : x._ok === false ? 'no' : i === Q.i ? 'now' : '') + '"></i>'; }).join('');
    var h = '<div class="pq2-h"><span class="pq2-who"><b>' + esc(Q.name) + '</b> asks</span><span class="pq2-dots">' + dots + '</span>'
      + '<button class="pt-x" aria-label="Stop" onclick="petQuizClose()">×</button></div>';
    if (Q.i >= Q.rounds.length) {
      var n = Q.rounds.length, k = Q.hits;
      var say = k === n ? 'Every single one! ' + Q.name + ' is very impressed.' : k >= n - 1 ? 'So close to perfect. Nicely done.' : k >= 2 ? 'Not bad at all — those were tricky.' : 'We will get them next time. Again?';
      h += '<div class="pq2-end"><b class="num">' + k + ' / ' + n + '</b><span>' + esc(say) + '</span></div>'
        + '<div class="pq2-acts"><button class="btn" onclick="petQuiz(\'' + Q.id + '\')">Again</button><button class="btn ghost" onclick="petQuizClose()">Done</button></div>';
    } else {
      var x = Q.rounds[Q.i];
      h += '<div class="pq2-q">What is the English for <b>“' + esc(x.meaning) + '”</b>?</div><div class="pq2-o">'
        + x.opts.map(function (o, j) { return '<button data-j="' + j + '" onclick="petQuizPick(' + j + ')">' + esc(o.word) + '</button>'; }).join('') + '</div>';
    }
    el.innerHTML = h;
  }
  window.petQuizPick = function (j) {
    if (!Q || Q.lock) return;
    var x = Q.rounds[Q.i]; if (!x) return;
    Q.lock = true;
    var pick = x.opts[j], ok = pick === x.answer;
    x._ok = ok;
    var bs = $('pq2').querySelectorAll('.pq2-o button');
    bs.forEach(function (b, k) { if (x.opts[k] === x.answer) b.classList.add('ok'); else if (k === j) b.classList.add('no'); });
    if (ok) {
      Q.hits++;
      if (window.addXP) window.addXP(1);
      fx(Q.id, 'say');
      var pop = document.createElement('span'); pop.className = 'pq2-xp num'; pop.textContent = '+1 XP'; bs[j].appendChild(pop);
    } else fx(Q.id, 'nod');
    try { if (window.gradeAndLog) window.gradeAndLog(x.answer, ok); } catch (e) {}
    setTimeout(function () {
      if (!Q) return;
      Q.i++; Q.lock = false;
      if (Q.i >= Q.rounds.length) {
        var out = care(Q.id, 'quiz');
        if (window.questBump) window.questBump('game');
        if (Q.hits >= Q.rounds.length - 1) fx(Q.id, 'pet');
        var rr = find(Q.id); if (rr && RG.id === Q.id) renderAct(rr, Q.hits >= 4 ? '*proud little hop*' : 'Thanks for playing with me.');
      }
      renderQuiz();
    }, ok ? 750 : 1300);
  };
  function quizClose(silent) {
    var el = $('pq2'); if (el) el.classList.remove('on');
    var pr = $('pr'); if (pr) pr.classList.remove('quiz');
    RG.quiz = false; Q = null;
  }
  window.petQuizClose = function () { quizClose(); };

  function fx(id, kind) { try { if (window.fwResidentFx) window.fwResidentFx(id, kind); } catch (e) {} }

  window.petFeed = function (id) {
    var res = window.resFeed ? window.resFeed(id) : null;
    var r = find(id); if (!r) return;
    var said;
    if (res && res.ok) { care(id, 'feed'); fx(id, 'feed'); said = 'Mm. Thank you.'; if (window.renderQuests) try { window.renderQuests(); } catch (e) {} }
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
  window.petBath = function (id) {
    var r = find(id); if (!r) return;
    if (cleanOf(r) >= 85) { showAct(id, 'I am already squeaky clean, thank you!'); return; }
    withRecord(id, function (x) { x.lastBath = Date.now(); });
    care(id, 'bath');
    if (W() && W().residentBath) W().residentBath(id);
    showAct(id, '*splash* Ahh. Much, much better.');
  };
  window.petSleep = function (id) {
    var r = find(id); if (!r) return;
    if (asleep(r)) { showAct(id, 'Zzz…'); return; }
    if ((r.energy || 0) >= 90) { showAct(id, 'Sleep? Now? I have far too much energy.'); return; }
    if (r.wokeAt && Date.now() - r.wokeAt < SLEEP_GAP) {
      var h = Math.ceil((SLEEP_GAP - (Date.now() - r.wokeAt)) / HOUR);
      showAct(id, 'I only just woke up! Ask me again in ' + h + ' hour' + (h === 1 ? '' : 's') + '.'); return;
    }
    withRecord(id, function (x) { x.sleepUntil = Date.now() + SLEEP_MS; });
    var walked = W() && W().residentSleep ? W().residentSleep(id) : false;
    petHide();
    if (window.fwToast) window.fwToast(r.name + (walked ? ' is off to bed in the nearest house' : ' curls up to sleep') + ' \u2014 back in 3 hours with +5 energy' + (bondReached(r) ? ', and maybe a gift' : ''));
  };

  /* ---------------- talking: bubbles over their heads ----------------
     The user did not want a chat window over the island: it pulled them
     out of the world. What you type appears over Focci's head, the answer
     over the animal's; the two face each other and the camera swings round
     to see them side by side (world.js talkStart). Only a slim input line
     sits at the bottom. The bubbles follow the two heads every frame. */
  var chatBusy = false, T = { id: null, raf: 0, fadeT: 0 };
  function fmtMsg(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b class="pt-hl" onclick="petPhrase(this)">$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>'); }
  function talkDom() {
    if ($('pt-talk')) return;
    var d = document.createElement('div');
    d.innerHTML = '<div class="pt-talk" id="pt-talk"><div class="pt-talk-sugg" id="pt-talk-sugg"></div>'
      + '<form class="pt-talk-in" onsubmit="event.preventDefault();petSend()">'
      + '<span class="pt-talk-who" id="pt-talk-who"></span>'
      + '<input id="pt-input" type="text" autocomplete="off" enterkeyhint="send"/>'
      + '<button type="submit" class="pt-send" aria-label="Send"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg></button>'
      + '<button type="button" class="pt-x" aria-label="Stop talking" onclick="petCloseChat()">×</button></form></div>'
      + '<div class="pt-bub me" id="pt-bme"></div><div class="pt-bub pet" id="pt-bpet"></div><div class="pt-bub pet hunt" id="pt-hb"></div>';
    while (d.firstChild) document.body.appendChild(d.firstChild);
  }
  /* Two bubbles side by side would overlap on a phone; each is pushed to its
     own side of the pair, its tail toward the head it belongs to. */
  function placeBubble(el, an, side, fallback) {
    if (!el || !el.classList.contains('show')) return;
    var w = el.offsetWidth, h = el.offsetHeight, x, y;
    if (an && an.on) { x = an.x; y = an.y; } else { x = fallback.x; y = fallback.y; }
    var left = side === 'left' ? x - w + 30 : side === 'right' ? x - 30 : x - w / 2;
    left = Math.max(10, Math.min(window.innerWidth - w - 10, left));
    var top = Math.max(76, y - h - 8);
    el.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
    el.style.setProperty('--tail', Math.max(16, Math.min(w - 16, x - left)) + 'px');
  }
  function talkLoop() {
    cancelAnimationFrame(T.raf);
    var step = function () {
      if (!T.id && !(H && H.open)) return;
      var a = T.id && W() && W().talkAnchors ? W().talkAnchors() : null;
      if (T.id) {
        var meLeft = !(a && a.me && a.pet) || a.me.x <= a.pet.x;
        placeBubble($('pt-bme'), a && a.me, meLeft ? 'left' : 'right', { x: window.innerWidth * 0.7, y: window.innerHeight * 0.6 });
        placeBubble($('pt-bpet'), a && a.pet, meLeft ? 'right' : 'left', { x: window.innerWidth * 0.32, y: window.innerHeight * 0.42 });
      }
      if (H && H.open) {
        var an = W() && W().anchorOf ? W().anchorOf(H.open) : null;
        placeBubble($('pt-hb'), an, 'mid', { x: window.innerWidth / 2, y: window.innerHeight * 0.45 });
      }
      T.raf = requestAnimationFrame(step);
    };
    step();
  }
  function say(el, html) { el.innerHTML = html; el.classList.add('show'); }
  window.petTalk = function (id) {
    ensurePersonas(); ensureDom(); talkDom(); petHide(true);
    var r = find(id); if (!r) return;
    if (asleep(r)) { if (window.fwToast) window.fwToast(r.name + ' is asleep — let them rest'); return; }
    cur = id; T.id = id;
    if (W() && W().talkStart) W().talkStart(id);
    var m = masteryOf(r);
    $('pt-talk-who').textContent = r.name;
    $('pt-input').placeholder = 'Talk to ' + r.name + '…';
    var sugg = ['What would you advise me?', 'Tell me something surprising', 'How do I say this in English: ', 'How was your day?'];
    $('pt-talk-sugg').innerHTML = '<span class="pt-talk-tag">' + esc(m.label) + '</span>'
      + sugg.map(function (x) { return '<button onclick="petSuggest(this)">' + esc(x) + '</button>'; }).join('');
    $('pt-bme').classList.remove('show');
    var msgs = chatLoad(r.id), last = msgs.length ? msgs[msgs.length - 1] : null;
    say($('pt-bpet'), fmtMsg(last && last.who === 'pet' ? last.t
      : 'Oh, hi! I am ' + r.name + ' — people here call me the island’s **' + m.label.toLowerCase() + '**. What is on your mind?'));
    document.documentElement.classList.add('pt-talk-on');
    talkLoop();
  };
  window.petCloseChat = function () {
    T.id = null; cancelAnimationFrame(T.raf);
    if (W() && W().talkEnd) W().talkEnd();
    ['pt-bme', 'pt-bpet'].forEach(function (i) { var e = $(i); if (e) e.classList.remove('show'); });
    document.documentElement.classList.remove('pt-talk-on');
    if (H && H.open) talkLoop();
  };
  // walking away from an animal ends the talk, or puts its ring away
  document.addEventListener('focci-talk-end', function () { if (T.id) petCloseChat(); else if (RG.id) petHide(true); });
  window.petSuggest = function (b) {
    var i = $('pt-input'); if (!i) return;
    var t = b.textContent;
    if (/:\s*$/.test(t)) { i.value = t; i.focus(); try { i.setSelectionRange(t.length, t.length); } catch (e) {} return; }
    i.value = t; petSend();
    // the field is free again straight away for something of your own
    setTimeout(function () { try { i.focus(); } catch (e) {} }, 0);
  };
  /* A long answer is shown a bubble at a time: ‹ 1/3 › inside the bubble. */
  function showReply(text) {
    var parts = String(text).split(/\s*\|\|\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!parts.length) parts = [String(text)];
    T.parts = parts; T.page = 0;
    renderPage();
  }
  function renderPage() {
    var el = $('pt-bpet'); if (!el || !T.parts) return;
    var n = T.parts.length, i = T.page;
    say(el, fmtMsg(T.parts[i]) + (n > 1
      ? '<div class="pt-pg"><button aria-label="Back" onclick="petPage(-1)"' + (i === 0 ? ' disabled' : '') + '>‹</button>'
        + '<span class="num">' + (i + 1) + ' / ' + n + '</span>'
        + '<button aria-label="More" onclick="petPage(1)"' + (i === n - 1 ? ' disabled' : '') + '>›</button></div>' : ''));
  }
  window.petPage = function (d) {
    if (!T.parts) return;
    T.page = Math.max(0, Math.min(T.parts.length - 1, T.page + d));
    renderPage();
  };
  /* Sending while an answer is still on its way used to be dropped without
     a word -- which is the "stuck after a suggestion" report: a suggestion
     sends at once, and anything typed before its answer came back went
     nowhere. Now it waits its turn and goes the moment the answer lands. */
  window.petSend = async function () {
    var i = $('pt-input'); if (!i || !T.id) return;
    var t = i.value.trim(); if (!t) return;
    i.value = '';
    if (chatBusy) { T.queue = t; say($('pt-bme'), esc(t) + ' <span class="pt-wait">…</span>'); return; }
    var r = find(T.id); if (!r) return;
    var msgs = chatLoad(r.id); msgs.push({ who: 'me', t: t }); chatSave(r.id, msgs);
    clearTimeout(T.fadeT);
    say($('pt-bme'), esc(t));
    fx(r.id, 'nod');
    T.parts = null;
    say($('pt-bpet'), '<span class="pt-dots"><i></i><i></i><i></i></span>');
    chatBusy = true;
    var reply;
    try { reply = await askPet(r, msgs.slice(0, -1), t); care(r.id, 'talk'); }
    catch (e) {
      reply = e.message === 'NO_KEY' ? '*tilts head* I can only really talk once a Gemini key is set in Settings.'
        : e.message === 'OFFLINE' ? '*yawns* The wind is too quiet today — you seem to be offline.'
        : e.message === 'SLOW' ? '*scratches ear* That took too long to think through. Ask me again?'
        : '*looks puzzled* Sorry, say that again? Something got lost on the way.';
    }
    chatBusy = false;
    if (!T.id) return;
    msgs = chatLoad(r.id); msgs.push({ who: 'pet', t: reply.replace(/\s*\|\|\s*/g, ' ') }); chatSave(r.id, msgs);
    showReply(reply);
    fx(r.id, 'say');
    var fresh = find(r.id);
    if (fresh && giftReady(fresh)) {
      $('pt-bpet').insertAdjacentHTML('beforeend', '<button class="pt-giftbtn in-bub" onclick="petCloseChat();petOpenGift(\'' + r.id + '\')"><span>\u{1F381}</span>I have something for you</button>');
    }
    if (T.queue) { var q = T.queue; T.queue = null; i.value = q; setTimeout(window.petSend, 400); return; }
    T.fadeT = setTimeout(function () { var e = $('pt-bme'); if (e) e.classList.remove('show'); }, 3500);
  };
  window.petPhrase = function (el) { ygmPlay([el.textContent], 'From ' + ((find(cur) || {}).name || '')); };

  /* ---------------- playing together: the paragraph hunt ----------------
     Every animal on the island carries one paragraph. Some of them are the
     parts of one short text; the rest are from other texts entirely. Tap an
     animal to read its part, bring the ones that belong together along with
     Focci (they follow him), then check. It practises exactly what reading
     tests ask for -- seeing what connects one paragraph to the next: the
     same people, the same subject, the linking words. Rewards fall with each
     wrong check and after the second hunt of the day (XP-RULES.md). */
  var HUNT_LS = 'fc_hunt';
  var HUNT_SETS = [
    { topic: 'The lighthouse keeper’s cat', parts: [
      'Every evening, old Mara climbed the hundred steps of the lighthouse to light the lamp. Her cat, Biscuit, always followed her, stopping on every tenth step to rest.',
      'One stormy night, the wind blew the door shut behind them. Mara could not open it from the inside, and the lamp was already burning low.',
      'Biscuit squeezed through a tiny window, ran down the outside stairs and meowed at the fisherman’s house until the fisherman came out with a torch.',
      'He opened the door, and Mara relit the lamp just in time for the boats. Since then, Biscuit has had his own chair in the fisherman’s kitchen.'] },
    { topic: 'How tea reached England', parts: [
      'Tea was drunk in China for thousands of years before most Europeans had heard of it. Traders from Portugal and the Netherlands first brought it west in the 1600s.',
      'At first it was so expensive that only rich families could afford it. Some even kept their tea in small wooden boxes with a lock and key.',
      'That changed when a Portuguese princess, Catherine of Braganza, married the English king and made drinking tea fashionable at court.',
      'Within a century prices fell, and tea became the everyday drink of ordinary people. Today the British drink around a hundred million cups a day.'] },
    { topic: 'Learning to swim at thirty', parts: [
      'Linh never learned to swim as a child, and by thirty she felt too embarrassed to start. She avoided beach trips and always had an excuse ready.',
      'Last spring, a friend found a class for adult beginners at the local pool. Linh signed up, but she almost turned around at the door on the first day.',
      'The teacher started with breathing, not swimming. For two weeks they only practised floating and blowing bubbles, and slowly her fear began to fade.',
      'By the end of summer, Linh swam her first full length. She says the hardest part was not the water, but deciding to walk in.'] },
    { topic: 'Why leaves change colour', parts: [
      'In summer, leaves are green because they are full of chlorophyll, the substance plants use to turn sunlight into food.',
      'As autumn days get shorter and colder, trees stop making chlorophyll, and the green slowly disappears from the leaves.',
      'This reveals the yellow and orange that were hiding underneath all along. Some trees also make new reds from the sugar left in their leaves.',
      'Finally, the tree seals off each leaf and lets it fall. It rests through the winter and grows fresh green leaves in spring.'] },
    { topic: 'A first day at a new job', parts: [
      'On his first day at the design studio, Minh arrived twenty minutes early and waited outside, practising how he would introduce himself.',
      'His manager gave him a desk by the window, a laptop and a long list of passwords. Nobody seemed to have time to talk to him.',
      'At lunch, a colleague noticed he was eating alone and invited him to join the team at a noodle shop around the corner.',
      'By the end of the week, Minh knew everyone’s name and had already shared an idea in a meeting. The first day, he decided, is always the strangest.'] }
  ];
  var HUNT_OTHERS = [
    'Honey never really goes bad. Archaeologists have found pots of it in ancient Egyptian tombs that were still safe to eat after three thousand years.',
    'The city council says the main bridge will close for repairs next month. Buses will take a longer route while the work goes on.',
    'To clean a burnt pan, cover the bottom with water and baking soda, boil it for a few minutes, and the black marks come off far more easily.',
    'Octopuses have three hearts and blue blood. Two of the hearts move blood to the gills, while the third pumps it around the rest of the body.',
    'Our hotel was small but spotless, and the owner gave us a map with all her favourite cafés marked in red pen.',
    'A short walk after dinner can help the body manage blood sugar better than an evening on the sofa, according to several studies.',
    'The football match was cancelled because of heavy rain, and fans were told their tickets would still be valid for the new date.',
    'Bamboo is one of the fastest-growing plants on Earth. Some kinds can grow almost a metre in a single day.',
    'If you forget someone’s name, it is fine to say, “Sorry, remind me of your name?” Almost everyone has done the same.',
    'The museum’s new exhibition shows toys from the last hundred years, from wooden horses to the very first video games.'
  ];
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  async function huntContent(k, d) {
    var key = window.getKey && window.getKey();
    if (key && navigator.onLine) {
      try {
        var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + window.getModel() + ':generateContent?key=' + encodeURIComponent(key);
        var prompt = 'Write one short connected text about a single everyday topic in exactly ' + k + ' paragraphs, in order. '
          + 'Each paragraph 25-40 words, B1 English; they must clearly belong together (same people or subject, linking words, a beginning and an end). '
          + 'Then write ' + d + ' paragraphs on completely different topics, same length and style, with no link to the first text or to each other. '
          + 'Return ONLY JSON: {"topic":"a short title","parts":["..."],"others":["..."]}';
        var res = await window.geminiPost(url, { contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1800, responseMimeType: 'application/json' } });
        if (res.ok) {
          var j = JSON.parse(window.geminiText(await res.json()).txt);
          if (j && j.parts && j.parts.length === k && j.others && j.others.length >= d) return { topic: j.topic, parts: j.parts, others: j.others.slice(0, d) };
        }
      } catch (e) {}
    }
    var set = HUNT_SETS[Math.floor(Math.random() * HUNT_SETS.length)];
    return { topic: set.topic, parts: set.parts.slice(0, k), others: shuffle(HUNT_OTHERS.slice()).slice(0, d) };
  }
  var H = null;
  function huntHud() {
    var el = $('pt-hunt');
    if (!el) { el = document.createElement('div'); el.className = 'pt-hunt'; el.id = 'pt-hunt'; document.body.appendChild(el); }
    if (!H) { el.classList.remove('show'); return; }
    el.innerHTML = '<div class="pt-hunt-t"><b>\u{1F9E9} Paragraph hunt</b><span>Find the <b class="num">' + H.k + '</b> parts of one story. Tap an animal to read its part.</span></div>'
      + '<div class="pt-hunt-a"><span class="num">' + H.gathered.length + ' / ' + H.k + '</span>'
      + '<button class="pt-hunt-go"' + (H.gathered.length === H.k ? '' : ' disabled') + ' onclick="huntCheck()">Check</button>'
      + '<button class="pt-hunt-leave" onclick="huntQuit()">Leave game</button></div>';
    el.classList.add('show');
  }
  window.petPlay = async function () {
    petHide();
    var ids = W() && W().residentsHere ? W().residentsHere() : [];
    if (ids.length < 3) { if (window.fwToast) window.fwToast('Rescue at least 3 animals to play together — there are ' + ids.length + ' awake here'); return; }
    if (H) { huntHud(); return; }
    var n = ids.length, k = n <= 4 ? 2 : n <= 6 ? 3 : 4, d = n - k;
    if (window.fwToast) window.fwToast('The animals are hiding a story…');
    var c = await huntContent(k, d);
    var pieces = c.parts.map(function (t, i) { return { t: t, rel: true, order: i }; })
      .concat(c.others.map(function (t) { return { t: t, rel: false }; }));
    shuffle(pieces);
    H = { topic: c.topic, parts: c.parts, k: k, map: {}, gathered: [], tries: 0, open: null };
    shuffle(ids.slice()).forEach(function (id, i) { H.map[id] = pieces[i]; });
    huntHud();
    document.documentElement.classList.add('pt-hunt-on');
  };
  function huntTap(id) {
    talkDom();
    var piece = H.map[id]; if (!piece) return;
    var r = find(id);
    H.open = id;
    var on = H.gathered.indexOf(id) >= 0;
    say($('pt-hb'), '<div class="pt-hb-who">' + esc(r ? r.name : '') + '’s part</div><p>' + esc(piece.t) + '</p>'
      + '<div class="pt-hb-acts"><button class="' + (on ? 'ghost' : '') + '" onclick="huntToggle(\'' + id + '\')">' + (on ? 'Leave here' : 'Bring along') + '</button>'
      + '<button class="ghost" onclick="huntClose()">Close</button></div>');
    talkLoop();
  }
  window.huntClose = function () { if (!H) return; H.open = null; var e = $('pt-hb'); if (e) e.classList.remove('show'); };
  window.huntToggle = function (id) {
    if (!H) return;
    var i = H.gathered.indexOf(id);
    if (i >= 0) { H.gathered.splice(i, 1); if (W()) W().residentFollow(id, false); }
    else {
      if (H.gathered.length >= H.k) { if (window.fwToast) window.fwToast('You can bring ' + H.k + ' — leave one behind first'); return; }
      H.gathered.push(id); if (W()) W().residentFollow(id, true, H.gathered.length - 1);
      fx(id, 'say');
    }
    H.gathered.forEach(function (g, n) { if (W()) W().residentFollow(g, true, n); });
    huntClose(); huntHud();
  };
  function huntRelease() { if (!H) return; Object.keys(H.map).forEach(function (id) { if (W()) W().residentFollow(id, false); }); }
  window.huntQuit = function () { huntRelease(); huntClose(); H = null; huntHud(); document.documentElement.classList.remove('pt-hunt-on'); };
  window.huntCheck = function () {
    if (!H || H.gathered.length !== H.k) return;
    var right = H.gathered.filter(function (id) { return H.map[id] && H.map[id].rel; }).length;
    if (right < H.k) {
      H.tries++;
      if (window.fwToast) window.fwToast('Not quite — ' + right + ' of your ' + H.k + ' belong together. Keep going, you are close!');
      return;
    }
    var st = readJSON(HUNT_LS, {}), t = today(), done = st.d === t ? (st.n || 0) : 0;
    var xp = done >= 2 ? 3 : (H.tries === 0 ? 12 : H.tries === 1 ? 9 : 6);
    writeJSON(HUNT_LS, { d: t, n: done + 1 });
    if (window.addXP) window.addXP(xp);
    var ids = H.gathered.slice();
    ids.forEach(function (id) { care(id, 'play'); });
    if (W() && W().celebrateAt) W().celebrateAt(ids);
    if (window.confettiBurst) window.confettiBurst(null, 36);
    var story = H.parts, topic = H.topic, tries = H.tries;
    huntQuit();
    ensureDom();
    $('pt-gift-in').innerHTML = '<div class="pt-g-h"><div><span class="cz-cap">You found the story' + (tries === 0 ? ' · first try' : '') + '</span>'
      + '<b class="pt-g-title">' + esc(topic) + '</b></div><button class="pt-x" aria-label="Close" onclick="petCloseGift()">×</button></div>'
      + '<div class="hunt-xp num">+' + xp + ' XP</div>'
      + '<ol class="hunt-story">' + story.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol>'
      + '<div class="pt-g-foot">Look at what joins them: the same people, the same subject, and words like <i>then</i>, <i>since</i>, <i>finally</i>.</div>';
    document.documentElement.classList.add('pt-gift-on');
  };

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
    h += '<div class="pt-persona"><div><span>Master of</span><b>' + esc(m.label) + '</b></div>'
      + '<div><span>Personality</span><b>' + esc(v.label) + '</b></div></div>';
    h += '<div class="pt-energy big">' + pips(r) + '<span class="pt-meals">' + (meals ? '<b class="num">' + meals + '</b> meal' + (meals === 1 ? '' : 's') + ' to full · each meal one bar' : 'Full of energy') + '</span></div>';
    h += bondBar(r);
    h += '<div class="pt-bond-why">Petting, feeding, talking, baths and playing together grow the bond. Once it reaches the mark, a happy animal brings a gift back from a long sleep (three hours) \u2014 one a day. At each mark, a happy ' + esc(sp.label.toLowerCase()) + ' gives you a lesson from its mastery.</div>';
    if (giftReady(r)) h += '<button class="pt-giftbtn" onclick="rzClose();petOpenGift(\'' + r.id + '\')"><span>\u{1F381}</span>A gift is ready</button>';
    if (gifts.length) h += '<div class="pt-gifts"><span class="cz-cap">Gifts from ' + esc(r.name) + '</span>' + gifts.map(function (g) {
      return '<button onclick="rzClose();petShowGift(\'' + g.id + '\')">\u{1F381} ' + esc(g.title) + '</button>'; }).join('') + '</div>';
    if (r.trait) h += '<div class="rz-trait">' + esc(r.trait) + '</div>';
    if (r.likes) h += '<div class="rz-likes">Loves <b>' + esc(r.likes) + '</b>' + (r.found ? ' · found ' + esc(r.found) : '') + '</div>';
    var cl = cleanOf(r);
    h += '<div class="pt-status"><span>\u{1FAE7} ' + cleanWord(cl) + '</span><span>' + (asleep(r) ? '\u{1F4A4} asleep' : (r.wokeAt && Date.now() - r.wokeAt < SLEEP_GAP ? '\u{1F319} rested' : '\u{1F319} could nap')) + '</span></div>';
    // only the animal's story here: the actions live in the ring round it on the island
    return h;
  };


  /* ---------------- the daily nudge ----------------
     The user asked for the app to bring people back: a reminder of the
     day's target. It is the island asking, not a banner: if an animal is
     hungry, it is that animal; otherwise Focci. At most twice a day -- once
     whenever the app is opened short of the goal, and once more after 6pm
     if the first was earlier -- and never once the goal is met.

     A system notification is offered too ("Remind me at 8pm"). There is no
     push server, so it can only fire while the app is still alive in the
     background; the in-app nudge on the next open covers the rest. */
  var NUDGE_LS = 'fc_nudge', REMIND_LS = 'fc_remind';
  function dxp() { return typeof getDailyXP === 'function' ? getDailyXP() : 0; }
  function dgoal() { return typeof getDailyGoal === 'function' ? getDailyGoal() : 20; }
  function nudgeDue() {
    if (dxp() >= dgoal()) return false;
    var st = readJSON(NUDGE_LS, {}), t = today(), h = new Date().getHours();
    var shown = st.d === t ? (st.n || 0) : 0;
    if (shown >= 2) return false;
    if (shown === 1 && (h < 18 || (st.h || 0) >= 18)) return false;
    return true;
  }
  function hungry() {
    var list = window.resTick ? window.resTick() : [];
    return list.filter(function (r) { return (r.energy || 0) < 34; }).sort(function (a, b) { return a.energy - b.energy; })[0] || null;
  }
  window.petNudge = async function (force) {
    if (!force && !nudgeDue()) return;
    var H = document.documentElement;
    var ob = document.getElementById('onboarding');
    if (ob && getComputedStyle(ob).display !== 'none') return;
    if (!force && (!H.classList.contains('home-on') || H.classList.contains('panel-open') || H.classList.contains('menu-on'))) return;
    ensureDom();
    var st = readJSON(NUDGE_LS, {}), t = today();
    writeJSON(NUDGE_LS, { d: t, n: (st.d === t ? (st.n || 0) : 0) + 1, h: new Date().getHours() });
    var x = dxp(), g = dgoal(), left = Math.max(0, g - x), pct = Math.min(100, Math.round(x / g * 100));
    var who = hungry();
    var prog = {}; try { prog = window.questProgress ? await window.questProgress() : {}; } catch (e) {}
    var qs = (typeof QUESTS !== 'undefined' ? QUESTS : []).filter(function (q) { return (prog[q.id] || 0) < q.target; }).slice(0, 3);
    var remind = readJSON(REMIND_LS, null);
    var h = '<div class="pt-g-h"><div><span class="cz-cap">Today’s target</span>'
      + '<b class="pt-g-title">' + (who ? esc(who.name) + ' is hungry and missing you' : (x ? 'You are on your way' : 'Your island is waiting')) + '</b></div>'
      + '<button class="pt-x" aria-label="Close" onclick="petCloseNudge()">×</button></div>'
      + '<div class="nd-art"><img src="./' + (who ? 'mascot-wonder.webp' : (x ? 'mascot-jump.webp' : 'mascot-avatar.webp')) + '" alt=""/></div>'
      + '<div class="nd-prog"><div class="nd-bar"><i style="width:' + pct + '%"></i></div><b class="num">' + x + ' / ' + g + ' XP</b></div>'
      + '<p class="nd-line">' + (left <= 5 ? 'Only <b class="num">' + left + '</b> XP to go — one Letter Trail board does it.'
          : '<b class="num">' + left + '</b> XP to today’s goal. Ten minutes is enough.') + '</p>';
    if (qs.length) h += '<ul class="nd-qs">' + qs.map(function (q) { return '<li>' + esc(q.t) + '<span class="num">' + (prog[q.id] || 0) + '/' + q.target + '</span></li>'; }).join('') + '</ul>';
    h += '<div class="nd-acts">'
      + '<button class="btn" onclick="petCloseNudge();fhGame(null,\'type\')">Play Letter Trail</button>'
      + '<button class="btn ghost" onclick="petCloseNudge();' + (who ? 'fhEnterIsland()' : 'czOpen(\'stats\')') + '">' + (who ? 'Feed ' + esc(who.name) : 'See today’s plan') + '</button></div>';
    h += '<label class="nd-remind"><input type="checkbox" ' + (remind && remind.on ? 'checked' : '') + ' onchange="petRemind(this.checked)"/>'
      + '<span>Remind me at 8pm if I have not reached it</span></label>';
    $('pt-gift-in').innerHTML = h;
    document.documentElement.classList.add('pt-gift-on');
  };
  window.petCloseNudge = function () { petCloseGift(); };
  window.petRemind = async function (on) {
    if (on && 'Notification' in window && Notification.permission !== 'granted') {
      try { await Notification.requestPermission(); } catch (e) {}
    }
    var ok = on && 'Notification' in window && Notification.permission === 'granted';
    writeJSON(REMIND_LS, { on: !!ok, hour: 20 });
    if (on && !ok && window.fwToast) window.fwToast('Notifications are blocked — the reminder will show when you open the app');
    scheduleRemind();
  };
  var remindT = 0;
  function scheduleRemind() {
    clearTimeout(remindT);
    var r = readJSON(REMIND_LS, null);
    if (!r || !r.on) return;
    var now = new Date(), at = new Date(now); at.setHours(r.hour || 20, 0, 0, 0);
    if (at <= now) at.setDate(at.getDate() + 1);
    remindT = setTimeout(function () {
      var sent = readJSON(REMIND_LS, {});
      if (dxp() < dgoal() && sent.sent !== today()) {
        sent.sent = today(); writeJSON(REMIND_LS, sent);
        var who = hungry();
        var body = who ? who.name + ' is hungry. ' + Math.max(0, dgoal() - dxp()) + ' XP to today’s goal.'
          : Math.max(0, dgoal() - dxp()) + ' XP to today’s goal — a quick round keeps your streak.';
        try {
          navigator.serviceWorker.ready.then(function (reg) { reg.showNotification('Focci’s island', { body: body, icon: './icon-192.png', tag: 'daily-target' }); });
        } catch (e) {}
      }
      scheduleRemind();
    }, Math.min(at - now, 2147483000));
  }
  /* How many animals were looked after today -- the fourth daily quest. */
  window.petCareToday = function () {
    var list = window.resLoad ? window.resLoad() : [];
    return list.filter(function (r) { return dayCount(r, 'petDay') || dayCount(r, 'feedDay') || dayCount(r, 'talkDay'); }).length;
  };
  setTimeout(scheduleRemind, 1500);
  setTimeout(function () { window.petNudge(); }, 4500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(function () { window.petNudge(); }, 1200); });


  /* ---------------- how XP works (the in-app copy of XP-RULES.md) ---------------- */
  function rows(list) { return list.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td></tr>'; }).join(''); }
  window.openXpRules = function () {
    ensureDom();
    var h = '<div class="pt-g-h"><div><span class="cz-cap">Rules of the island</span><b class="pt-g-title">How XP and rewards work</b></div>'
      + '<button class="pt-x" aria-label="Close" onclick="petCloseGift()">\u00d7</button></div>'
      + '<p class="pt-g-intro">A good day is ten to fifteen minutes: one game round, a few lookups and one quest clear the daily goal. The animals never have to cost you XP \u2014 two naps a day keep them going; food is the fast way and builds the bond.</p>'
      + '<div class="xr-h">Earn</div><table class="xr">' + rows([
          ['Look up or save a word', '+1'], ['A word found \u00b7 Letter Trail', '+1'], ['Echo Catch \u00b7 80% / 50%+', '+2 / +1'], ['Word Pairs with an animal \u00b7 right answer', '+1'], ['Speak Up answer', '+2'],
          ['Finish a Hot Take article', '+5'], ['Island letter \u00b7 mushroom', '+1'], ['Complete the hidden word', '+3'], ['Open the treasure', '+6'],
          ['Paragraph hunt \u00b7 1st / 2nd / later check', '+12 / +9 / +6'], ['3rd hunt of the day and after', '+3'],
          ['Quests \u00b7 5 lookups, a save, an animal', '+10 each'], ['Quest \u00b7 play a game', '+15']]) + '</table>'
      + '<div class="xr-h">Spend</div><table class="xr">' + rows([
          ['Feed one energy bar', '\u22122'], ['Rescue rabbit \u00b7 duck \u00b7 sheep', '60 \u00b7 80 \u00b7 120'], ['Rescue cat \u00b7 wolf', '160 \u00b7 240']]) + '</table>'
      + '<div class="xr-h">Caring for an animal \u00b7 bond (counted per day)</div><table class="xr">' + rows([
          ['Feed \u00b7 +1 bar', '+1 \u00b7 4'], ['Pet \u00b7 +4 happiness', '+1 \u00b7 5'], ['Talk \u00b7 per message', '+1 \u00b7 6'],
          ['Bath \u00b7 when not fresh', '+2 \u00b7 1'], ['Sleep \u00b7 3 h in a house, +5 bars, 4 h apart', '+1 \u00b7 2'], ['Play together \u00b7 each animal brought', '+3 \u00b7 2'], ['Word Pairs \u00b7 a round of five', '+2 \u00b7 2']]) + '</table>'
      + '<p class="pt-g-intro">Gifts: reach bond 6, 16, 30, 48, 70, 96, 126, 160, keep the animal happy (50%+), and send it to sleep \u2014 it wakes three hours later with a gift. One a day per animal. Energy drops about 3.4 bars a day, cleanliness a quarter a day. A level is 100 XP.</p>';
    $('pt-gift-in').innerHTML = h;
    document.documentElement.classList.add('pt-gift-on');
  };

  /* ---------------- back ---------------- */
  window.petBack = function () {
    var D = document.documentElement;
    if (D.classList.contains('pt-gift-on')) { petCloseGift(); return true; }
    if (T.id) { petCloseChat(); return true; }
    if (Q) { quizClose(); return true; }
    if (RG.id) { petHide(); return true; }
    if (H && H.open) { huntClose(); return true; }
    if (H) { huntQuit(); return true; }
    return false;
  };

  window.petEnsure = ensurePersonas;
  window.ringPress = ringPress;
  window.giftLoad = giftLoad;
  window.petMasteries = MASTERIES;
  setTimeout(ensurePersonas, 0);
})();
