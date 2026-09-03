/* ============================================================
   Focci — offline-first English vocabulary explorer
   Vanilla JS. No build step. All data lives on-device (IndexedDB).
   ============================================================ */

/* ---------- tiny helpers ---------- */
const $ = (s) => document.querySelector(s);
const norm = (w) => w.trim().toLowerCase();
const now = () => Date.now();
const DAY = 864e5;
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),1900); }
function dayStart(ts){ const d=new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }

/* ---------- spelling-variant normalization (British -> American canonical) ---------- */
const SPELLING_VARIANTS = {
  colour:'color', colours:'colors', colourful:'colorful', favourite:'favorite', favourites:'favorites',
  honour:'honor', honourable:'honorable', labour:'labor', neighbour:'neighbor', neighbours:'neighbors',
  behaviour:'behavior', flavour:'flavor', flavours:'flavors', humour:'humor', humorous:'humorous',
  rumour:'rumor', armour:'armor', harbour:'harbor', vapour:'vapor', endeavour:'endeavor',
  favourable:'favorable', organise:'organize', organised:'organized', organising:'organizing',
  organisation:'organization', realise:'realize', realised:'realized', realisation:'realization',
  recognise:'recognize', recognised:'recognized', apologise:'apologize', apologised:'apologized',
  analyse:'analyze', analysed:'analyzed', analysing:'analyzing', criticise:'criticize',
  emphasise:'emphasize', specialise:'specialize', categorise:'categorize', summarise:'summarize',
  centre:'center', centres:'centers', theatre:'theater', theatres:'theaters', metre:'meter',
  metres:'meters', litre:'liter', litres:'liters', fibre:'fiber', calibre:'caliber',
  defence:'defense', offence:'offense', licence:'license', pretence:'pretense',
  travelled:'traveled', travelling:'traveling', traveller:'traveler', travellers:'travelers',
  cancelled:'canceled', cancelling:'canceling', modelling:'modeling', labelled:'labeled',
  labelling:'labeling', fuelled:'fueled', signalling:'signaling', grey:'gray', greyish:'grayish',
  programme:'program', programmes:'programs', catalogue:'catalog', dialogue:'dialog',
  analogue:'analog', cheque:'check', cheques:'checks', tyre:'tire', tyres:'tires', kerb:'curb',
  plough:'plow', mould:'mold', moulding:'molding', jewellery:'jewelry', aeroplane:'airplane',
  aluminium:'aluminum', artefact:'artifact', axe:'ax', doughnut:'donut', draught:'draft',
  manoeuvre:'maneuver', mum:'mom', practise:'practice', sceptical:'skeptical', woollen:'woolen',
  enrol:'enroll', fulfil:'fulfill', instalment:'installment', skilful:'skillful', wilful:'willful',
  disc:'disk', mould:'mold', pyjamas:'pajamas', tonne:'ton', vigour:'vigor', valour:'valor',
  savour:'savor', savoury:'savory', odour:'odor', rigour:'rigor', ardour:'ardor'
};
function normalizeSpelling(w){ return SPELLING_VARIANTS[w] || w; }

/* ---------- IndexedDB (one small promise wrapper) ---------- */
const DB_NAME='smartdict', DB_VER=2, STORE='entries', LOG='log';
let _db;
function db(){
  if(_db) return Promise.resolve(_db);
  return new Promise((res,rej)=>{
    const r=indexedDB.open(DB_NAME,DB_VER);
    r.onupgradeneeded=()=>{ const d=r.result;
      if(!d.objectStoreNames.contains(STORE)){
        const s=d.createObjectStore(STORE,{keyPath:'word'});
        s.createIndex('savedAt','savedAt');
        s.createIndex('saved','saved');
      }
      if(!d.objectStoreNames.contains(LOG)){
        const l=d.createObjectStore(LOG,{keyPath:'id',autoIncrement:true});
        l.createIndex('ts','ts');
        l.createIndex('type','type');
      }
    };
    r.onsuccess=()=>{_db=r.result;res(_db)};
    r.onerror=()=>rej(r.error);
  });
}
function tx(mode){ return db().then(d=>d.transaction(STORE,mode).objectStore(STORE)); }
function idbGet(word){ return tx('readonly').then(s=>new Promise((res,rej)=>{const r=s.get(word);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})); }
function idbPut(obj){ return tx('readwrite').then(s=>new Promise((res,rej)=>{const r=s.put(obj);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})); }
function idbAll(){ return tx('readonly').then(s=>new Promise((res,rej)=>{const r=s.getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})); }
let _allRecordsCache=null;
async function idbAllCached(){
  if(_allRecordsCache) return _allRecordsCache;
  _allRecordsCache = await idbAll();
  return _allRecordsCache;
}
function idbCount(){ return tx('readonly').then(s=>new Promise((res,rej)=>{const r=s.count();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})); }
function idbPrefix(prefix){
  return tx('readonly').then(s=>new Promise((res,rej)=>{
    const range=IDBKeyRange.bound(prefix, prefix+'\uffff');
    const r=s.getAll(range,8);
    r.onsuccess=()=>res((r.result||[]).filter(x=>!x.alias));
    r.onerror=()=>rej(r.error);
  }));
}

/* ---------- behavior log ---------- */
function logTx(mode){ return db().then(d=>d.transaction(LOG,mode).objectStore(LOG)); }
function logAdd(rec){ return logTx('readwrite').then(s=>new Promise((res,rej)=>{const r=s.add(rec);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})); }
function logAll(){ return logTx('readonly').then(s=>new Promise((res,rej)=>{const r=s.getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})); }
function logCount(){ return logTx('readonly').then(s=>new Promise((res,rej)=>{const r=s.count();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})); }
function logClearAll(){ return logTx('readwrite').then(s=>new Promise((res,rej)=>{const r=s.clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})); }
/* Removes every 'search' log entry for one word, so it stops showing up
   in Recent Searches / suggestions. Saved-word status is untouched. */
function logDeleteWord(word){
  return logTx('readwrite').then(s=>new Promise((res)=>{
    const req=s.openCursor();
    const ids=[];
    req.onsuccess=(e)=>{
      const c=e.target.result;
      if(c){
        if(c.value.type==='search' && c.value.word===word) ids.push(c.primaryKey);
        c.continue();
      } else {
        Promise.all(ids.map(id=>new Promise(r=>{ const dr=s.delete(id); dr.onsuccess=()=>r(); dr.onerror=()=>r(); }))).then(()=>res());
      }
    };
    req.onerror=()=>res();
  }));
}
function logTrim(){
  return logTx('readwrite').then(s=>new Promise((res)=>{
    const idx=s.index('ts'); const req=idx.openCursor(); let ids=[];
    req.onsuccess=(e)=>{ const c=e.target.result; if(c){ ids.push(c.primaryKey); c.continue(); } else { res(ids); } };
    req.onerror=()=>res([]);
  })).then(ids=>{
    if(ids.length<=2500) return;
    const drop=ids.slice(0, ids.length-2500);
    return logTx('readwrite').then(s=>Promise.all(drop.map(id=>new Promise(res=>{const r=s.delete(id);r.onsuccess=()=>res();r.onerror=()=>res();}))));
  });
}
async function logEvent(type, word){
  try{
    await logAdd({ts:now(), type, word:word||null});
    const c=await logCount(); if(c>3000) logTrim();
    renderHero();
    // Every search — whether typed in the search bar or tapped inside a
    // story passage — lands here, so this is the one place the word-bank's
    // "new word" detector needs to watch.
    if(type==='search' && word && typeof window.onWordSearched==='function'){
      try{ window.onWordSearched(word); }catch(e){}
    }
  }catch(e){ /* logging is best-effort, never blocks the app */ }
}

/* ---------- settings (localStorage) ---------- */
const KEY_LS='sd_key', MODEL_LS='sd_model', NAME_LS='sd_name', THEME_LS='sd_theme';
const getKey=()=>localStorage.getItem(KEY_LS)||'';
const getModel=()=>localStorage.getItem(MODEL_LS)||'gemini-2.5-flash-lite';
const getName=()=>localStorage.getItem(NAME_LS)||'';

/* ---------- XP / level / daily goal ---------- */
const XP_LS='sd_xp', XP_DAILY_LS='sd_xp_daily', GOAL_LS='sd_daily_goal', ACH_LS='sd_achievements',
      GOALHIT_LS='sd_goal_hit_date', PERFECT_LS='sd_perfect_session', TIME_LS='sd_time_ms';
const getXP=()=>(+localStorage.getItem(XP_LS))||0;
const levelFromXP=(xp)=>Math.floor(xp/100)+1;
const getDailyGoal=()=>(+localStorage.getItem(GOAL_LS))||20;
const setDailyGoal=(n)=>localStorage.setItem(GOAL_LS,String(Math.max(5,n||20)));
function todayStr(){ return new Date().toDateString(); }
function getDailyXP(){
  try{ const d=JSON.parse(localStorage.getItem(XP_DAILY_LS)||'null'); if(d&&d.date===todayStr()) return d.xp; }catch(e){}
  return 0;
}
function setDailyXP(v){ localStorage.setItem(XP_DAILY_LS, JSON.stringify({date:todayStr(), xp:v})); }

function addXP(n){
  if(!n) return;
  const before=getXP(), after=before+n;
  localStorage.setItem(XP_LS, String(after));
  const lvlBefore=levelFromXP(before), lvlAfter=levelFromXP(after);
  const dailyBefore=getDailyXP(), dailyAfter=dailyBefore+n; setDailyXP(dailyAfter);
  const goal=getDailyGoal();
  if(lvlAfter>lvlBefore){
    celebrate('./mascot-champion.webp', 'Level '+lvlAfter+'!', 'Total '+after+' XP', 'level');
  } else if(dailyBefore<goal && dailyAfter>=goal && localStorage.getItem(GOALHIT_LS)!==todayStr()){
    localStorage.setItem(GOALHIT_LS, todayStr());
    celebrate('./mascot-jump.webp', 'Daily goal reached!', dailyAfter+' / '+goal+' XP', 'goal');
  }
  renderHero();
  renderGoalCard();
  checkAchievements();
}

/* ---------- session time tracking ---------- */
let _sessionStart = now();
function flushSessionTime(){
  const elapsed = now() - _sessionStart;
  if(elapsed>1000 && elapsed<6*3600*1000){
    const total = (+localStorage.getItem(TIME_LS))||0;
    localStorage.setItem(TIME_LS, String(total+elapsed));
  }
  _sessionStart = now();
}
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') flushSessionTime(); else _sessionStart=now(); });
window.addEventListener('pagehide', flushSessionTime);

/* ---------- confetti + celebration overlay ---------- */
function confettiBurst(originEl, count){
  count=count||24;
  let cx=window.innerWidth/2, cy=window.innerHeight/3;
  if(originEl){ const rect=originEl.getBoundingClientRect(); cx=rect.left+rect.width/2; cy=rect.top+rect.height/2; }
  const colors=['#FF7A33','#FFB238','#3FAE6A','#F0A93C','#EF5B4E','#4FA3E3'];
  for(let i=0;i<count;i++){
    const el=document.createElement('div');
    el.className='confetti-piece';
    const angle=Math.random()*Math.PI*2, dist=60+Math.random()*100;
    const dx=Math.cos(angle)*dist, dy=Math.sin(angle)*dist-30;
    el.style.left=cx+'px'; el.style.top=cy+'px';
    el.style.setProperty('--dx',dx+'px'); el.style.setProperty('--dy',dy+'px');
    el.style.background=colors[i%colors.length];
    el.style.transform='rotate('+Math.round(Math.random()*360)+'deg)';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),900);
  }
}
let _celebrateQueue=[], _celebrating=false;
function celebrate(img, title, sub, kind){
  _celebrateQueue.push({img,title,sub,kind:kind||'gold'});
  if(!_celebrating) processCelebrateQueue();
}
function processCelebrateQueue(){
  if(!_celebrateQueue.length){ _celebrating=false; return; }
  _celebrating=true;
  const {img,title,sub,kind}=_celebrateQueue.shift();
  const ov=document.createElement('div'); ov.className='celebrate-ov';
  ov.innerHTML='<div class="celebrate-card kind-'+kind+'"><div class="celebrate-rays"></div>'
    +'<img class="celebrate-wand" src="./decor-magical-wand.webp" alt=""/>'
    +(img?'<img class="celebrate-img" src="'+img+'" alt=""/>':'')
    +'<div class="celebrate-title">'+esc(title)+'</div>'+(sub?'<div class="celebrate-sub">'+esc(sub)+'</div>':'')
    +'<div class="celebrate-tap">Tap anywhere to continue</div></div>';
  document.body.appendChild(ov);
  confettiBurst(null,42);
  requestAnimationFrame(()=>ov.classList.add('show'));
  const dismiss=()=>{ ov.classList.remove('show'); setTimeout(()=>{ov.remove(); processCelebrateQueue();},280); };
  const t=setTimeout(dismiss,2400);
  ov.addEventListener('click',()=>{ clearTimeout(t); dismiss(); });
}

/* ---------- achievements (rendered with real trophy/medal art) ---------- */
const ACHIEVEMENTS=[
  {id:'first_word',img:'cup1',title:'First Word',test:s=>s.totalWords>=1},
  {id:'ten_words',img:'cup2',title:'10 Words',test:s=>s.totalWords>=10},
  {id:'hundred_words',img:'cup3',title:'100 Words',test:s=>s.totalWords>=100},
  {id:'first_save',img:'cup4',title:'First Save',test:s=>s.savedCount>=1},
  {id:'saver_10',img:'cup5',title:'Collector',test:s=>s.savedCount>=10},
  {id:'streak_3',img:'cup6',title:'3-Day Streak',test:s=>s.streak>=3},
  {id:'streak_7',img:'cup7',title:'7-Day Streak',test:s=>s.streak>=7},
  {id:'streak_30',img:'cup8',title:'30-Day Streak',test:s=>s.streak>=30},
  {id:'accurate',img:'cup9',title:'Sharp Shooter',test:s=>s.totalReview>=10 && s.accuracy!=null && s.accuracy>=80},
  {id:'perfect',img:'cup10',title:'Perfect Round',test:()=>localStorage.getItem(PERFECT_LS)==='1'},
  {id:'level_5',img:'cup11',title:'Level 5',test:()=>levelFromXP(getXP())>=5},
  {id:'level_10',img:'cup12',title:'Level 10',test:()=>levelFromXP(getXP())>=10},
];
async function checkAchievements(){
  try{
    const stats=await computeInsights();
    let unlocked; try{ unlocked=JSON.parse(localStorage.getItem(ACH_LS)||'[]'); }catch(e){ unlocked=[]; }
    const set=new Set(unlocked); const newly=[];
    for(const a of ACHIEVEMENTS){ if(!set.has(a.id) && a.test(stats)){ set.add(a.id); newly.push(a); } }
    if(newly.length){
      localStorage.setItem(ACH_LS, JSON.stringify([...set]));
      newly.forEach(a=>celebrate('./'+a.img+'.webp', a.title, '🏅 Achievement unlocked!', 'gold'));
    }
    return {list:ACHIEVEMENTS, unlocked:set};
  }catch(e){ return {list:ACHIEVEMENTS, unlocked:new Set()}; }
}
function renderBadges(list, unlocked){
  let h='<div class="sec"><div class="sec-h"><span class="tile tile-sm amber">🏅</span>Achievements</div><div class="badge-grid">';
  for(const a of list){
    const on=unlocked.has(a.id);
    h+='<div class="badge-item '+(on?'unlocked':'locked')+'"><img src="./'+a.img+'.webp" alt=""/><div class="t">'+esc(a.title)+'</div></div>';
  }
  h+='</div></div>';
  return h;
}

/* ---------- jar widget (today's accumulated activity) ---------- */
async function todaysActivityCount(){
  const logs=await logAll();
  const t=dayStart(now());
  return logs.filter(l=>dayStart(l.ts)===t && (l.type==='search'||l.type==='review_correct'||l.type==='review_wrong')).length;
}
async function renderJar(){
  const n=await todaysActivityCount();
  const cap=20;
  const pct=Math.max(0,Math.min(100, n/cap*100));
  const fillH=34*(pct/100);
  const fillEl=$('#jar-fill');
  if(fillEl){ fillEl.setAttribute('y', 54-fillH); fillEl.setAttribute('height', fillH); }
  const titleEl=$('#jar-title'); if(titleEl) titleEl.textContent=n+' word'+(n===1?'':'s')+' today';
}
/* Distinct words the user has personally searched, across every day —
   NOT the size of the offline library (which includes ~16k pre-seeded
   words the user never looked up). This is what the jar-reveal and the
   "words explored" stat both mean by "total". */
async function totalWordsLearned(){
  const logs=await logAll();
  const searches=logs.filter(l=>l.type==='search'&&l.word);
  return new Set(searches.map(l=>l.word)).size;
}
function wireJar(){
  const card=$('#jar-card'); if(!card) return;
  card.addEventListener('click', async ()=>{
    card.classList.add('shaking');
    setTimeout(()=>card.classList.remove('shaking'),500);
    const total=await totalWordsLearned();
    setTimeout(()=>{
      const ov=document.createElement('div'); ov.className='jar-reveal';
      ov.innerHTML='<div class="jar-reveal-card"><div class="jar-reveal-n">✨ '+total+' ✨</div><div class="jar-reveal-l">words explored in total, since day one</div></div>';
      document.body.appendChild(ov);
      confettiBurst(card, 20);
      requestAnimationFrame(()=>ov.classList.add('show'));
      const dismiss=()=>{ ov.classList.remove('show'); setTimeout(()=>ov.remove(),300); };
      setTimeout(dismiss,2200);
      ov.addEventListener('click',dismiss);
    }, 350);
  });
}

/* ============================================================
   GEMINI PROMPT (kept in sync with generate.html)
   ============================================================ */
function buildPrompt(word, exact){
return `You are a bilingual English→Vietnamese lexicographer building a rich, practical dictionary entry. For the English word or phrase "${word}", return a single JSON object (no markdown, no commentary) with EXACTLY this shape:

{
  "word": ${exact
      ? '"echo the input EXACTLY as given (only trim whitespace / lowercase) — never a different word"'
      : '"corrected/canonical form — fix typos, complete a partial idiom, or normalize slang spelling"'},
  "query_note": ${exact
      ? '"always an empty string in this mode"'
      : `"if you corrected/completed the input, one short Vietnamese phrase like 'Ý bạn là: rain cats and dogs'; else empty string"`},
  "not_found": ${exact
      ? 'true only if the input is genuinely NOT a real English word/phrase; otherwise false'
      : 'always false'},
  "suggestion": ${exact
      ? '"if the input looks like a misspelling of a common word, the word you think they meant — as a SUGGESTION only, never substituted into \"word\". Else empty string."'
      : '"always an empty string"'},
  "phonetic": "IPA, e.g. /stɛp/ — omit for multi-word phrases/idioms",
  "vi_equivalent": "1–3 từ tiếng Việt gần nhất, cách nhau bằng ', '. Nếu tiếng Việt KHÔNG có từ nào thật sự khớp, để chuỗi rỗng \"\" — tuyệt đối không đưa một từ gần đúng cho có.",
  "vi_note": "1 short Vietnamese sentence explaining the core feeling/usage",
  "vi_feel": "1–2 câu tiếng Việt tả HÌNH ẢNH / TÌNH HUỐNG dùng từ này: người bản xứ nói từ này khi nào, cảnh tượng trông ra sao, cảm giác gì. KHÔNG phải định nghĩa từ điển.",
  "vi_not": "từ tiếng Việt hay bị dịch nhầm cho từ này + tại sao SAI. Để \"\" nếu không có nhầm lẫn phổ biến.",
  "register": "trang trọng|trung tính|thân mật|lóng · khen|trung tính|chê",
  "forms": { "v1":"", "v2":"", "v3":"", "ving":"" },
  "senses": [
    { "pos":"noun|verb|adjective|adverb|idiom|slang|...",
      "vi":"nghĩa tiếng Việt của RIÊNG nghĩa này, ĐÚNG SẮC THÁI. Nếu từ tiếng Việt gần nhất lệch sắc thái (khen↔chê) thì KHÔNG được dùng nó — chọn cách diễn đạt dài hơn nhưng đúng cảm giác, hoặc để \"\" và mô tả trong \"vi_hint\".",
      "vi_hint":"chỉ điền khi \"vi\" không tải hết được nghĩa: 1 câu ngắn tiếng Việt tả cảm giác/tình huống của riêng nghĩa này. Ngược lại để \"\".",
      "gloss":"short English meaning", "rank":5,
      "example":"one natural English sentence", "example_vi":"bản dịch tiếng Việt tự nhiên" }
  ],
  "collocations": [
    { "text":"natural word-partnership using this word, e.g. 'make a decision', 'heavy rain', 'strongly agree'",
      "vi":"nghĩa cụm này", "rank":5, "example":"short natural sentence", "example_vi":"bản dịch" }
  ],
  "phrasal_verbs": [
    { "text":"phrasal verb built on this word, e.g. 'step up', 'step down', 'step in'",
      "vi":"nghĩa", "rank":5, "example":"short sentence", "example_vi":"bản dịch" }
  ],
  "idioms": [
    { "text":"fixed idiom/proverb containing this word, e.g. 'step on someone's toes'",
      "vi":"nghĩa idiom", "rank":4, "example":"short sentence", "example_vi":"bản dịch" }
  ],
  "prepositions": [
    { "prep":"preposition that regularly follows/precedes this word, e.g. 'into', 'of', 'for'",
      "meaning_vi":"nghĩa/sắc thái khi đi kèm giới từ này (khác gì so với nghĩa gốc)",
      "example":"short phrase/sentence showing it, e.g. 'step into a new role'", "example_vi":"bản dịch" }
  ],
  "family": [ { "word":"related form", "pos":"noun|verb|adjective|adverb" } ],
  "synonyms": ["useful common ones, ordered most-to-least interchangeable"],
  "antonyms": ["useful common ones only"]
}

${exact ? `THE INPUT IS EXACT. The user tapped or typed "${word}" deliberately and it is spelled the way they want it. Analyse THAT word or phrase and nothing else. NEVER substitute a similar-looking word ("shone" is NOT "phone", "flour" is NOT "floor"). Echo the input into "word". If — and only if — it is genuinely not a real English word, expression or name, set "not_found": true and put your best guess of the intended word in "suggestion"; the app will offer it as a suggestion the user can decline. Leave "query_note" empty.`
: `INPUT MAY BE MESSY: a typo, a partial/incomplete idiom (e.g. "rain dogs" → "it's raining cats and dogs"), or casual slang spelling. Silently resolve it to the real, common English word/idiom/slang term and put THAT corrected form in "word". Fill "query_note" only when you actually corrected something.`}

GOAL: extract AS MUCH genuinely common, real-world usage as you know for this word — a learner should almost never need to look elsewhere. Prioritize BREADTH across every category below over padding just one of them:
- senses: up to 8. For an idiom/slang entry, pos can be "idiom" or "slang". Four HARD rules:
  (1) NEVER spend two slots on the same core meaning. Merge near-identical shades into ONE sense (e.g. for "fly": flying with wings, flying a plane, an arrow flying, a flag flying are ALL one "move through the air" sense — do NOT list them separately). Wasting slots on shades of one meaning is the single worst failure here.
  (2) EVERY part of speech in common use gets at least one sense. A common NOUN meaning must never be dropped just because a verb meaning is more frequent. Concrete/physical-object meanings especially: fly = the zip on trousers; temple = side of the head; palm = inside of the hand; nail = fingernail AND metal nail. Sweep for these before you finish.
  (3) Include informal, figurative and slang senses a learner actually meets online, even if a formal dictionary ranks them low.
  (4) SẮC THÁI của từng "vi" quan trọng hơn độ ngắn gọn. Trước khi chốt mỗi "vi", tự hỏi: từ tiếng Việt này khen hay chê? Từ tiếng Anh gốc khen hay chê? Lệch nhau là SAI, phải đổi. Thà viết "vui tươi, giàu tưởng tượng theo kiểu ngộ nghĩnh" (dài mà đúng) còn hơn "kỳ quặc" (ngắn mà sai sắc thái).
  (5) rank = how often you meet this sense in real life (5 = very common … 1 = rare), exactly as before. Order the array by rank, highest first, so the everyday meaning stays at the top and a rare-but-real meaning like "fly = the zip on trousers" simply sits at the bottom of the list. Rule (2) is about the sense EXISTING at all — it never promotes a rare sense above a common one.
- collocations: the natural word-partnerships a native speaker reaches for — verb+noun, adjective+noun, adverb+adjective, noun+noun, fixed comparisons, whatever fits this word's part of speech. This is usually the BIGGEST category — up to 10, ranked. Dig for real ones, don't stop at 1–2.
- phrasal_verbs: ONLY if this word is a verb that genuinely forms phrasal verbs. Up to 6, ranked. Leave the array empty if none exist — never invent one.
- idioms: genuine fixed idioms/proverbs containing this word. Up to 6, ranked. Leave empty if none exist.
- prepositions: the specific preposition(s) where the CHOICE of preposition changes or fixes the meaning (e.g. "afraid OF" vs "afraid FOR", "depend ON", "look UP TO" vs "look DOWN ON"). Up to 5. Leave empty if this word has no meaningful fixed-preposition pattern.
- synonyms/antonyms: up to 8 synonyms and 5 antonyms, common & genuinely distinguishable — skip rare/literary words.
- forms: fill only if it's a single-word verb (put "" for the rest). If a past tense/participle genuinely has two accepted spellings (e.g. "burned"/"burnt", "learned"/"learnt", "dreamed"/"dreamt"), put BOTH separated by " / " in that one field. Omit entirely if not a verb or if multi-word.
- Vietnamese must sound natural, not word-by-word translation.
- NUANCE IS THE WHOLE POINT. A confident but wrong Vietnamese equivalent is the worst possible output — worse than admitting none exists. If no Vietnamese word carries the feeling, leave "vi_equivalent" empty and carry the meaning in "vi_feel" instead.

WORKED EXAMPLE of the quality bar (for "assertive") — match this DEPTH and this CARE ABOUT CONNOTATION; do not copy the content:
  "vi_equivalent": "quyết đoán, dám nói thẳng ý mình"
  "vi_feel": "Cảm giác của người biết rõ mình muốn gì và nói ra thẳng thắn, không vòng vo cũng không lấn át ai. Ví dụ trong cuộc họp, người assertive là người dám nêu ý kiến trái chiều một cách bình tĩnh."
  "vi_not": "KHÔNG phải 'hung hăng', 'áp đặt' hay 'lấn lướt' — mấy từ đó mang sắc thái chê và ứng với 'aggressive', còn assertive gần như luôn là lời khen."
  "register": "trung tính · khen"
  senses[0].vi: "quyết đoán, dám bày tỏ chính kiến"   ← chú ý: KHÔNG rút gọn thành "mạnh mẽ" hay "cứng rắn" cho ngắn
- Every "text"/"prep" entry must be something a fluent English speaker would actually say — no filler entries just to fill a slot.
- Return ONLY the JSON object.`;}

/* ============================================================
   VIETNAMESE → ENGLISH reverse lookup — fully offline. Built once
   from the vi_equivalent field every entry already has (which can
   list several Vietnamese words per entry, comma-separated), so no
   new data needs to ship — just an index over what's already there.
   ============================================================ */
function looksVietnamese(s){
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(s);
}
let _viIndex=null;
async function buildViIndex(){
  if(_viIndex) return _viIndex;
  const all=await idbAllCached();
  const idx=new Map();                    // term -> [{word, primary}]
  const add=(term, word, primary)=>{
    const t=term.trim().toLowerCase(); if(!t) return;
    if(!idx.has(t)) idx.set(t, []);
    const arr=idx.get(t);
    const existing=arr.find(e=>e.word===word);
    if(existing){ existing.primary = existing.primary || primary; }
    else arr.push({word, primary});
  };
  for(const r of all){
    if(r.alias) continue;
    const d=r.data; if(!d) continue;
    // primary: the word's own top 1-3 closest Vietnamese terms
    if(d.vi_equivalent) for(const raw of d.vi_equivalent.split(',')) add(raw, r.word, true);
    // secondary: every individual sense often carries its OWN Vietnamese
    // phrasing too (a word can mean several different things) — this data
    // was already being generated and stored, just never searched before
    if(Array.isArray(d.senses)) for(const s of d.senses){
      if(s.vi) for(const raw of String(s.vi).split(',')) add(raw, r.word, false);
    }
  }
  _viIndex=idx;
  return idx;
}
async function viReverseLookup(term){
  const idx=await buildViIndex();
  const q=term.trim().toLowerCase();
  const rank=(entries)=>{
    const words = entries.slice().sort((a,b)=>(b.primary?1:0)-(a.primary?1:0)).map(e=>e.word);
    return [...new Set(words)];
  };
  const exact=idx.get(q);
  if(exact && exact.length) return rank(exact).slice(0,14);
  // no exact entry — a loose "contains" pass catches close-enough phrasing
  const out=[]; const seen=new Set();
  for(const [t,entries] of idx){
    if(t.includes(q) || q.includes(t)){
      for(const w of rank(entries)) if(!seen.has(w)){ seen.add(w); out.push(w); }
      if(out.length>=14) break;
    }
  }
  return out;
}
function viResultsState(query, words){
  let h='';
  h+='<div class="vi-results"><div class="vi-results-h">“'+esc(query)+'” in English</div><div class="vi-results-list">';
  for(const w of words){
    h+='<button class="vi-result-chip" onclick="jump(\''+esc(w).replace(/'/g,"\\'")+'\')">'+esc(w)+'</button>';
  }
  h+='</div></div>';
  return h;
}
function viNotFoundState(query){
  const safeQ=esc(query).replace(/'/g,"\\'");
  return '<div class="empty"><img class="ill" src="./mascot-wonder.webp" alt=""/>'
    +'<h3>No match for “'+esc(query)+'” yet</h3><p>This only searches Vietnamese meanings already saved in your library — look up more English words and this gets better over time.</p>'
    +'<button class="btn ghost sm" style="margin:14px auto 0" onclick="forceViTranslate(\''+safeQ+'\')">Translate with AI instead</button></div>';
}
async function forceViTranslate(word){
  if(!getKey()){ $('#result').innerHTML=needKeyState(word); return; }
  if(!navigator.onLine){ $('#result').innerHTML=offlineState(word); return; }
  const box=$('#result');
  box.innerHTML=questScene(word);
  const questStart=now();
  try{
    const result=await translatePhrase(word);
    const elapsed=now()-questStart;
    if(elapsed<1800) await new Promise(r=>setTimeout(r,1800-elapsed));
    currentWord=null;
    box.innerHTML=phraseResultState(word, result);
    logEvent('search', null); addXP(1);
  }catch(err){ box.innerHTML=errorState(word,err.message||''); }
}

/* ============================================================
   PHRASE / SENTENCE TRANSLATION — for anything longer than a single
   word or short collocation. Auto-detects direction (EN↔VI).
   ============================================================ */
async function translatePhrase(text){
  const key=getKey(); if(!key) throw new Error('NO_KEY');
  if(!navigator.onLine) throw new Error('OFFLINE');
  const model=getModel();
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const prompt='You are a bilingual EN↔VI translator. Detect which language the text below is in and translate it into the other one. Give the BEST option first, then genuinely DIFFERENT alternatives — not reworded near-duplicates. Return ONLY this JSON, no commentary, no markdown fences:\n'
    +'{'
    +'"source_lang":"en or vi",'
    +'"primary":{"text":"the most natural, closest translation","register":"neutral | formal | casual | literal | idiomatic","why":"one short Vietnamese clause on why this is the closest fit"},'
    +'"alternatives":[{"text":"a real alternative a native speaker might use instead","register":"formal | casual | literal | idiomatic | regional","why":"one short Vietnamese clause on when to use this one instead"}],'
    +'"literal":"word-for-word rendering, ONLY when it differs usefully from primary; else empty string",'
    +'"gloss":[{"src":"a key word/chunk from the source","dst":"what it maps to in the translation"}],'
    +'"note":"one short Vietnamese sentence on tone, formality or a grammar trap — empty string if nothing useful"'
    +'}\n\n'
    +'RULES: 2 to 3 items in "alternatives" (never 0 unless the text is a fixed proper noun). '
    +'"gloss" up to 6 pairs, covering the words a learner would want to isolate; empty array for very short input. '
    +'Every "why" must be in Vietnamese and under 12 words.\n\n'
    +'TEXT:\n'+text;
  const body={ contents:[{parts:[{text:prompt}]}], generationConfig:{ temperature:0.2, responseMimeType:"application/json" } };
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok){
    let m=res.status; try{const e=await res.json(); m=(e.error&&e.error.message)||m;}catch(_){}
    if(res.status===400||res.status===403) throw new Error('BAD_KEY:'+m);
    throw new Error('API:'+m);
  }
  const data=await res.json();
  let raw=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
  raw=raw.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
  let obj; try{ obj=JSON.parse(raw); }catch(e){ throw new Error('PARSE'); }
  return obj;
}
/* One boxed translation reads like a guess. Several labelled options, with the
   closest one marked and the rest explained, reads like a dictionary — so the
   primary is flagged explicitly and every option carries its register. */
function phraseResultState(original, result){
  const toEN = result.source_lang==='vi';
  const dirLbl = toEN ? 'Tiếng Việt → English' : 'English → Tiếng Việt';
  const primary = result.primary || { text: result.translation || '' };
  const alts = (result.alternatives||[]).filter(a=>a && a.text && a.text!==primary.text).slice(0,3);
  const regLbl = (r)=>({neutral:'trung tính',formal:'trang trọng',casual:'thân mật',
                        literal:'dịch sát chữ',idiomatic:'nói kiểu bản ngữ',regional:'vùng miền'})[r]||r||'';

  const optRow = (o, isPrimary)=>{
    const safe = (o.text||'').replace(/'/g,"\\'");
    let r='<div class="tr-opt'+(isPrimary?' tr-opt-best':'')+'">';
    r+='<div class="tr-opt-top">';
    if(isPrimary) r+='<span class="tr-badge">Sát nhất</span>';
    if(o.register) r+='<span class="tr-reg">'+esc(regLbl(o.register))+'</span>';
    r+='<button class="tr-copy" onclick="trCopy(this,\''+safe+'\')" aria-label="Copy">⧉</button>';
    r+='</div>';
    r+='<div class="tr-opt-text">'+esc(o.text||'')+'</div>';
    if(o.why) r+='<div class="tr-opt-why">'+esc(o.why)+'</div>';
    // Translating INTO English → every option is a lookup target.
    if(toEN && o.text && o.text.split(/\s+/).length<=4)
      r+='<button class="tr-lookup" onclick="jump(\''+safe+'\')">Tra từ này →</button>';
    r+='</div>';
    return r;
  };

  let h='<div class="tr-card">';
  h+='<div class="tr-dir">'+esc(dirLbl)+'</div>';
  h+='<div class="tr-src">'+esc(original)+'</div>';
  h+='<div class="tr-opts">'+optRow(primary,true)+alts.map(a=>optRow(a,false)).join('')+'</div>';

  if(result.literal && result.literal!==primary.text)
    h+='<div class="tr-lit"><span>Dịch sát chữ</span>'+esc(result.literal)+'</div>';

  const gloss=(result.gloss||[]).filter(g=>g&&g.src&&g.dst).slice(0,6);
  if(gloss.length){
    h+='<div class="tr-gloss"><div class="tr-gloss-h">Từng phần</div>';
    for(const g of gloss){
      const safeG=String(toEN?g.dst:g.src).replace(/'/g,"\\'");
      h+='<div class="tr-gloss-row" onclick="jump(\''+safeG+'\')">'
        +'<span class="tg-src">'+esc(g.src)+'</span>'
        +'<span class="tg-arw">→</span>'
        +'<span class="tg-dst">'+esc(g.dst)+'</span></div>';
    }
    h+='</div>';
  }

  if(result.note) h+='<div class="tr-note">'+esc(result.note)+'</div>';
  h+='</div>';
  return h;
}
function trCopy(btn, text){
  const done=()=>{ const o=btn.textContent; btn.textContent='✓'; setTimeout(()=>btn.textContent=o,1100); };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(()=>{});
  else done();
}

/* opts.exact = true  → the input is known-correct (tapped in a passage, or
   typed deliberately in the search bar). The model must analyse exactly that
   word and is forbidden from silently swapping in a similar one; anything it
   suspects goes into data.suggestion for the user to accept or ignore. */
/* A highlighted phrase is saved as a first-class record so it shows up in
   Saved alongside single words, with the translation as its meaning. */
async function savePhraseRecord(text, translation, extra){
  const w = norm(text||''); if(!w) return null;
  const ex = await idbGet(w);
  const data = (ex && ex.data) ? ex.data : {};
  data.word = text;
  data.phrase = true;
  if(translation) data.vi_equivalent = translation;
  if(!Array.isArray(data.senses) || !data.senses.length)
    data.senses = [{ pos:'phrase', vi: translation||'', en: extra&&extra.why ? extra.why : '' }];
  const rec = { word:w, data, source:'phrase',
    firstSeen: ex?ex.firstSeen:now(), saved:1, savedAt:now() };
  await idbPut(rec);
  return rec;
}
window.savePhraseRecord = savePhraseRecord;

async function askGemini(word, opts){
  const exact = !!(opts && opts.exact);
  const key=getKey(); if(!key) throw new Error('NO_KEY');
  if(!navigator.onLine) throw new Error('OFFLINE');
  const model=getModel();
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const body={
    contents:[{parts:[{text:buildPrompt(word, exact)}]}],
    generationConfig:{ temperature:0.3, responseMimeType:"application/json" }
  };
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok){
    let m=res.status; try{const e=await res.json(); m=(e.error&&e.error.message)||m;}catch(_){}
    if(res.status===400||res.status===403) throw new Error('BAD_KEY:'+m);
    throw new Error('API:'+m);
  }
  const data=await res.json();
  let text=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
  text=text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
  let obj; try{ obj=JSON.parse(text); }catch(e){ throw new Error('PARSE'); }
  obj.word=obj.word||word;
  return obj;
}

/* ============================================================
   FUZZY LOCAL MATCH — offline "did you mean"
   ============================================================ */
function lev(a,b){
  const m=a.length,n=b.length; if(!m) return n; if(!n) return m;
  let prev=new Array(n+1); for(let j=0;j<=n;j++) prev[j]=j;
  for(let i=1;i<=m;i++){ let cur=[i];
    for(let j=1;j<=n;j++){ const cost=a[i-1]===b[j-1]?0:1;
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost); }
    prev=cur; }
  return prev[n];
}
function tokenOverlap(q,c){
  const qt=q.split(/\s+/).filter(Boolean), ct=c.split(/\s+/).filter(Boolean);
  if(!qt.length) return 0; let hit=0;
  for(const qw of qt){ if(ct.some(cw=>cw===qw||(qw.length>=3&&cw.length>=3&&(cw.startsWith(qw)||qw.startsWith(cw))))) hit++; }
  return hit/qt.length;
}
function matchScore(query,cand){
  const a=norm(query), b=norm(cand); if(!a||!b) return 0;
  const levSim=1-lev(a,b)/Math.max(a.length,b.length);
  return Math.max(levSim, tokenOverlap(a,b));
}
async function fuzzyLocalSearch(query){
  if(query.length<3) return null;
  const q=norm(query);
  const all=await idbAll();
  // Pass 1: exact phrase — collocations/idioms/phrasal verbs are real,
  // known phrases already in the library; no guessing needed for these.
  for(const r of all){
    if(r.alias) continue;
    const buckets=[r.data&&r.data.expressions, r.data&&r.data.collocations, r.data&&r.data.phrasal_verbs, r.data&&r.data.idioms];
    for(const arr of buckets){
      if(!Array.isArray(arr)) continue;
      for(const e of arr){ if(e.text && norm(e.text)===q) return {type:'expr', target:r.word, label:e.text, exact:true}; }
    }
  }
  // Pass 2: fuzzy fallback, as before
  let best=null,bestScore=0.6;
  for(const r of all){
    if(r.alias) continue;
    const s=matchScore(query,r.word);
    if(s>bestScore){ bestScore=s; best={type:'word',target:r.word,label:r.word}; }
    const exs=(r.data&&r.data.expressions)||[];
    for(const e of exs){ if(!e.text) continue;
      const s2=matchScore(query,e.text);
      if(s2>bestScore){ bestScore=s2; best={type:'expr',target:r.word,label:e.text}; } }
  }
  return best;
}

/* ============================================================
   SEARCH FLOW
   ============================================================ */
let currentWord=null;
function flashPhraseMatch(text){
  const target=norm(text||'');
  setTimeout(()=>{
    const rows=document.querySelectorAll('.expr[data-ph]');
    for(const row of rows){
      if(row.getAttribute('data-ph')===target){
        row.scrollIntoView({behavior:'smooth', block:'center'});
        row.classList.add('expr-hit');
        setTimeout(()=>row.classList.remove('expr-hit'), 2200);
        break;
      }
    }
  }, 60);
}
async function search(rawWord, forceAI){
  let word=norm(rawWord||'');
  if(!word) return;
  const hasSpace = /\s/.test(word.trim());
  const isVN = looksVietnamese(word);
  if(!hasSpace) word=normalizeSpelling(word);
  hideSuggest();
  // A search always takes you to the word page, no matter which tab you were on.
  if(!$('#v-home').classList.contains('active')) showView('home');
  $('#dashboard').style.display='none';
  $('#topbar-back').style.display='flex';
  const box=$('#result');

  // Vietnamese → offline reverse lookup, ALWAYS tried first, regardless of
  // spaces — most Vietnamese words are written with spaces between
  // syllables ("tranh luận"), so space-count can't be used to route this.
  if(!forceAI && isVN){
    currentWord=null;
    const hits=await viReverseLookup(word);
    if(hits.length){ box.innerHTML=viResultsState(word, hits); logEvent('search', null); addXP(1); return; }
    box.innerHTML=viNotFoundState(word);   // opt-in "Translate with AI" button lives in here — never automatic
    return;
  }

  if(!forceAI){
    const local=await idbGet(word);
    if(local && local.alias){
      const canon=await idbGet(local.alias);
      if(canon){ currentWord=canon.word; box.innerHTML=renderEntry(canon, word); maybeLoadYouglish(canon.word); logEvent('search',canon.word); addXP(2); return; }
    }
    if(local){ currentWord=word; box.innerHTML=renderEntry(local); maybeLoadYouglish(word); logEvent('search',word); addXP(2); return; }

    const guess=await fuzzyLocalSearch(word);
    if(guess && guess.exact){
      const rec=await idbGet(guess.target);
      if(rec){
        currentWord=rec.word; box.innerHTML=renderEntry(rec); maybeLoadYouglish(rec.word);
        logEvent('search',rec.word); addXP(2);
        flashPhraseMatch(guess.label);
        return;
      }
    }
    // A near-miss is only ever OFFERED. suggestState's primary button sends
    // the word the user actually typed to the AI — it never rewrites it.
    if(guess && !hasSpace){ box.innerHTML=suggestState(word, guess); return; }
  }

  if(!getKey()){ box.innerHTML=needKeyState(word); return; }
  if(!navigator.onLine){ box.innerHTML=offlineState(word); return; }

  // Multiple English words with no local match — this reads as "translate
  // this for me", not "look this word up", so it gets its own AI call and
  // its own result view instead of forcing it through the dictionary prompt.
  if(hasSpace){
    box.innerHTML=questScene(word);
    const questStart=now();
    try{
      const result=await translatePhrase(word);
      const elapsed=now()-questStart;
      if(elapsed<1800) await new Promise(r=>setTimeout(r,1800-elapsed));
      currentWord=null;
      box.innerHTML=phraseResultState(word, result);
      logEvent('search', null);
      addXP(1);
    }catch(err){ box.innerHTML=errorState(word,err.message||''); }
    return;
  }

  box.innerHTML=questScene(word);
  const questStart=now();
  try{
    const data=await askGemini(word);
    // Keep the expedition scene on screen long enough to actually be seen —
    // the AI often answers faster than the animation can play.
    const elapsed=now()-questStart;
    if(elapsed<2800) await new Promise(r=>setTimeout(r,2800-elapsed));
    const canon=norm(data.word||word);
    const rec={word:canon, data, source:'ai', firstSeen:now(), saved:0, savedAt:0};
    await idbPut(rec);
    if(canon!==word){
      await idbPut({word, alias:canon, firstSeen:now(), saved:0, savedAt:0});
    }
    currentWord=canon;
    box.innerHTML=renderEntry(rec, canon!==word?word:null);
    maybeLoadYouglish(canon);
    logEvent('search',canon);
    addXP(2);
    refreshStats();
  }catch(err){
    box.innerHTML=errorState(word,err.message||'');
  }
}
function forceAI(word){ search(word,true); }
/* Set by story.js before it sends you from a passage to a full word page, so
   the back button returns you to the passage instead of dumping you on home. */
window._returnTo = null;
function backToHome(){
  const r = window._returnTo;
  if(r){
    window._returnTo = null;
    currentWord=null; $('#result').innerHTML=''; $('#q').value='';
    $('#clearx').style.display='none'; $('#topbar-back').style.display='none';
    $('#dashboard').style.display='block';
    showView(r.view||'review');
    if(typeof r.scroll==='number') setTimeout(()=>window.scrollTo(0, r.scroll), 60);
    return;
  }
  return _backToHomePlain();
}
function _backToHomePlain(){ currentWord=null; $('#result').innerHTML=''; $('#dashboard').style.display='block'; $('#topbar-back').style.display='none'; $('#q').value=''; $('#clearx').style.display='none'; renderDashboard(); window.scrollTo(0,0); }

/* ---------- toggle save ---------- */
async function toggleSave(word){
  const rec=await idbGet(word); if(!rec) return;
  rec.saved=rec.saved?0:1;
  rec.savedAt=rec.saved?now():0;
  await idbPut(rec);
  if(currentWord===word){ const b=$('#result'); if(b && b.innerHTML){ b.innerHTML=renderEntry(rec); maybeLoadYouglish(word); } }
  toast(rec.saved?'Saved ⭐':'Removed from saved');
  logEvent(rec.saved?'save':'unsave', word);
  if(rec.saved) addXP(1);
  refreshStats();
}

/* ============================================================
   RENDER — word detail
   ============================================================ */
/* Rank 0–5 as ONE star filled bottom-up in five vertical steps.
   The old five-circle row ate ~60px of every line, which squeezed the
   English column so hard that single words broke mid-word
   ("accentuat / ed"). One 13px star gives that space back. */
function rankStar(rank){
  const n=Math.max(0,Math.min(5,Math.round(+rank||0)));
  return '<span class="rk lv'+n+'" style="--f:'+(n*20)+'%" title="Common in real use: '+n+'/5" aria-label="rank '+n+' of 5"></span>';
}
/* kept so any older call site still works */
function dots(rank){ return rankStar(rank); }
/* Part-of-speech styling. posKey() normalises whatever the AI returns
   ("noun", "n.", "Noun (countable)", "adj", …) down to one known key, so a
   chip never falls back to a mismatched colour. */
const POS_COLOR={noun:'blue',verb:'mint',adjective:'amber',adverb:'pink',preposition:'primary',
  conjunction:'cyan',pronoun:'blue',interjection:'coral',article:'blue',idiom:'coral',
  slang:'pink',phrase:'cyan',determiner:'blue',numeral:'blue',other:'blue'};
const POS_SHORT={noun:'N',verb:'V',adjective:'ADJ',adverb:'ADV',preposition:'PREP',
  conjunction:'CONJ',pronoun:'PRON',interjection:'INTJ',article:'ART',idiom:'IDIOM',
  slang:'SLANG',phrase:'PHR',determiner:'DET',numeral:'NUM',other:'—'};
function posKey(p){
  const s=String(p||'').toLowerCase().trim();
  if(!s) return 'other';
  if(s.startsWith('noun')||s==='n'||s==='n.') return 'noun';
  if(s.startsWith('verb')||s==='v'||s==='v.') return 'verb';
  if(s.startsWith('adj')) return 'adjective';
  if(s.startsWith('adv')) return 'adverb';
  if(s.startsWith('prep')) return 'preposition';
  if(s.startsWith('conj')) return 'conjunction';
  if(s.startsWith('pron')) return 'pronoun';
  if(s.startsWith('interj')||s.startsWith('excl')) return 'interjection';
  if(s.startsWith('art')) return 'article';
  if(s.startsWith('idiom')) return 'idiom';
  if(s.startsWith('slang')) return 'slang';
  if(s.startsWith('phras')) return 'phrase';
  if(s.startsWith('det')) return 'determiner';
  if(s.startsWith('num')) return 'numeral';
  return POS_COLOR[s] ? s : 'other';
}
function posLabel(p){ const k=posKey(p); return k==='other' ? String(p||'') : k; }
function posChip(p){ if(!p) return '';
  const k=posKey(p), c=POS_COLOR[k];
  return '<span class="pos-chip pos-'+c+'">'+esc(posLabel(p))+'</span>'; }

/* ============================================================
   WORD FAMILY — computed locally from the offline library already
   on-device, not the AI. The AI's "family" field was probabilistic
   (it would sometimes list abduction/abductor and just forget
   abductive); this is a plain prefix scan over every headword
   ALREADY in the dictionary, so it's complete and free every time.
   Built once, cached, refreshed in the background right after each
   entry renders so the word page itself never waits on it.
   ============================================================ */
let _wordIndex=null;
async function buildWordIndex(){
  if(_wordIndex) return _wordIndex;
  const all = await idbAllCached();
  const out=[];
  for(const r of all){
    if(r.alias) continue;
    const w=(r.word||'').trim().toLowerCase();
    if(!w || w.includes(' ')) continue;                       // family = single words only
    const pos=(r.data&&r.data.senses&&r.data.senses[0]&&r.data.senses[0].pos)||'';
    out.push({ word:r.word, w, pos });
  }
  out.sort((a,b)=>a.w<b.w?-1:a.w>b.w?1:0);
  _wordIndex=out;
  return out;
}
const _INFLECTIONS=['ing','ies','es','ed','s','d'];
function isJustInflection(root,form){
  if(form===root) return true;
  for(const suf of _INFLECTIONS) if(form===root+suf) return true;
  if(form.endsWith('ing') && (root===form.slice(0,-3) || root===form.slice(0,-3)+'e')) return true; // running/make
  if(form.endsWith('ied') && root===form.slice(0,-3)+'y') return true;                                // tried -> try
  return false;
}
async function familyOf(word, maxN){
  const idx = await buildWordIndex();
  const w=(word||'').trim().toLowerCase();
  if(w.length<4) return [];
  const out=[];
  for(const e of idx){
    if(e.w===w) continue;
    const shorter = e.w.length<w.length ? e.w : w;
    const longer  = e.w.length<w.length ? w : e.w;
    if(shorter.length<4 || !longer.startsWith(shorter)) continue;
    if(isJustInflection(shorter, longer)) continue;
    out.push(e);
    if(out.length>=maxN) break;
  }
  return out;
}
async function renderFamilyChips(word){
  try{
    const fam = await familyOf(word, 8);
    if(currentWord!==word) return;              // navigated away before this resolved — drop it
    const el=document.getElementById('family-scroll'); if(!el) return;
    if(!fam.length){ el.remove(); return; }
    let h='';
    for(const fm of fam){
      const k=posKey(fm.pos), c=POS_COLOR[k];
      const fw=esc(fm.word).replace(/'/g,"\\'");
      h+='<button class="family-chip pos-'+c+'" onclick="jump(\''+fw+'\')">'
        +'<span class="fc-pos" style="background:var(--'+c+')">'+esc(POS_SHORT[k]||'—')+'</span>'
        +'<span class="fc-w">'+esc(fm.word)+'</span></button>';
    }
    el.innerHTML=h;
  }catch(e){}
}
window.renderFamilyChips=renderFamilyChips;
/* ============================================================
   YOUGLISH — bản chốt + tối ưu hiệu năng.

   HIỆU NĂNG: iframe của YouGlish kéo theo YouTube player, quảng
   cáo và reCAPTCHA của họ. Trước đây nó nạp mỗi lần tra từ, làm
   nghẽn main thread cho toàn app. Giờ YG_LAZY=true → chỉ hiện một
   nút gọn, bấm mới nạp. Đổi thành false nếu muốn tự nạp như cũ
   (đánh đổi: app sẽ nặng lại như trước).

   Đã sửa 2 lỗi hiệu năng:
   - Bỏ ResizeObserver (nó sửa height → layout đổi → tự kích hoạt
     lại → vòng lặp reflow). Thay bằng 3 lần đo mốc thời gian.
   - Veil loading giờ bị display:none khi xong, để animation của
     đốm sáng dừng hẳn thay vì chạy vô hạn dưới opacity:0.

   Mọi UI của YouGlish nằm trong một iframe cross-origin, không thể
   style từng phần bên trong, nên giấu phần dưới bằng cách THU GỌN
   chiều cao khung (YG_MASK_TOP_PCT). Nút mũi tên góc phải mở lại
   toàn bộ khung.
   ============================================================ */
const YG_SCRIPT       = 'https://youglish.com/public/emb/widget.js';
const YG_LANG         = 'english';
const YG_COMPONENTS   = 0;        // chọn qua yg-calib.html
const YG_MASK_TOP_PCT = 0.58;     // hiện 58% trên, thu gọn 42% dưới
const YG_LAZY         = true;     // true = bấm mới nạp video
const YG_TIMEOUT      = 12000;
const YG_DEBUG        = false;

let _ygScriptP = null;
let _ygIdx     = 0;
let _ygSeq     = 0;
let _ygDiag    = {};

function ygLoadScript(){
  if(_ygScriptP) return _ygScriptP;
  _ygScriptP = new Promise((resolve, reject)=>{
    if(window.YG && window.YG.Widget){ _ygDiag.script='YG đã có sẵn'; return resolve(); }
    window.onYouglishAPIReady = function(){
      _ygDiag.script = 'onYouglishAPIReady đã chạy';
      resolve();
    };
    const s = document.createElement('script');
    s.src = YG_SCRIPT; s.charset = 'utf-8';
    s.onerror = ()=>{ _ygDiag.script='không tải được widget.js';
                      reject(new Error('widget.js bị chặn')); };
    document.body.appendChild(s);
    let n = 0;
    const poll = setInterval(()=>{
      if(window.YG && window.YG.Widget){
        clearInterval(poll);
        _ygDiag.script = _ygDiag.script || 'thấy window.YG qua polling';
        resolve();
      }else if(++n > 40){
        clearInterval(poll);
        _ygDiag.script = 'hết 12s vẫn không có YG.Widget';
        reject(new Error('không thấy YG.Widget'));
      }
    }, 300);
  });
  return _ygScriptP;
}

function ygFindFrame(wrap){
  const f = wrap.querySelector('iframe');
  if(f) return f;
  const out = document.querySelectorAll('iframe[src*="youtube"],iframe[src*="youglish"]');
  for(const cand of out){
    if(!wrap.contains(cand)){
      const inner = wrap.querySelector('.yg-inner');
      if(inner){ inner.appendChild(cand); _ygDiag.rescue = 'player nằm ngoài khung → đã kéo vào'; }
      return cand;
    }
  }
  return null;
}

function ygWaitForFrame(wrap, timeout){
  return new Promise((resolve)=>{
    const t0 = Date.now();
    const tick = setInterval(()=>{
      const f = ygFindFrame(wrap);
      if(f && f.clientHeight > 40){
        clearInterval(tick);
        _ygDiag.frame = 'thấy player sau ' + (Date.now()-t0) + 'ms';
        resolve(f);
      }else if(Date.now()-t0 > timeout){
        clearInterval(tick);
        _ygDiag.frame = 'KHÔNG có player sau ' + timeout + 'ms';
        resolve(null);
      }
    }, 400);
  });
}

/* gõ ygDiag() trong console Safari nếu cần soi lại lần nạp gần nhất */
function ygDiag(){ console.log(_ygDiag); return _ygDiag; }
window.ygDiag = ygDiag;

const YG_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
  + 'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

function ygLinkBtn(word){
  const url = 'https://youglish.com/pronounce/'+encodeURIComponent(word)+'/english';
  return '<a class="yg-link-btn" href="'+url+'" target="_blank" rel="noopener">'
    + '<span class="yg-link-ico">\u2197</span>'
    + '<span class="yg-link-text"><b>Open With Browser</b></span></a>';
}

/* Nạp widget thật vào khung. Chỉ được gọi khi người dùng chủ động
   yêu cầu (chế độ lazy) hoặc ngay lập tức nếu YG_LAZY=false. */
function ygMount(word, wrap, seq, idx){
  wrap.className = 'yg-wrap yg-loading';
  wrap.innerHTML =
      '<div class="yg-stage" id="yg-stage"><div class="yg-inner"></div><div class="yg-fade"></div></div>'
    + '<button class="yg-peek" type="button" aria-label="Xem to\u00e0n b\u1ed9 khung">'+YG_CHEVRON+'</button>'
    + '<div class="yg-veil"><span class="yg-dot"></span>\u0110ang m\u1edf video\u2026</div>';

  const stage = wrap.querySelector('.yg-stage');
  const inner = wrap.querySelector('.yg-inner');
  const peek  = wrap.querySelector('.yg-peek');
  const veil  = wrap.querySelector('.yg-veil');

  let fullH = 0, peeking = false;
  const applyHeight = ()=>{
    if(!fullH) return;
    stage.style.height = Math.round(fullH * (peeking ? 1 : YG_MASK_TOP_PCT)) + 'px';
  };
  /* Chiều cao khung video do YouGlish đặt sau khi nội dung tải xong, và nó
     còn đổi lại khi phần nghĩa tiếng Việt phía trên xuống dòng làm reflow.
     Đo một lần rồi thôi thì khung bị lẹm mất video và nút. Quan sát trực
     tiếp CHÍNH cái iframe: ta chỉ set height cho .yg-stage (khác phần tử,
     có overflow:hidden) nên không tạo vòng lặp đo ↔ sửa. */
  const remeasure = (frame)=>{
    if(!frame) return;
    const h = frame.getBoundingClientRect().height || frame.clientHeight || 0;
    if(h > 40 && Math.abs(h - fullH) > 4){ fullH = h; applyHeight(); }
  };
  peek.addEventListener('click', ()=>{
    peeking = !peeking;
    wrap.classList.toggle('yg-peeking', peeking);
    applyHeight();
  });

  const finish = (frame)=>{
    if(seq !== _ygSeq || !document.body.contains(wrap)) return;
    if(!frame){
      if(YG_DEBUG){
        let rows = ''; for(const k in _ygDiag) rows += k + ': ' + _ygDiag[k] + '\n';
        wrap.className = 'yg-wrap yg-diag';
        wrap.innerHTML = '<b>YouGlish ch\u01b0a d\u1ee5ng \u0111\u01b0\u1ee3c video</b><pre>'+esc(rows)+'</pre>';
      }else{
        wrap.className = 'yg-wrap yg-failed';
      }
      return;
    }
    wrap.className = 'yg-wrap yg-ready';
    if(veil) veil.remove();     // bỏ hẳn khỏi DOM → animation dừng, hết composite vô ích

    [250, 900, 2200].forEach((ms)=>setTimeout(()=>{
      if(seq !== _ygSeq || !document.body.contains(wrap)) return;
      remeasure(frame);
    }, ms));

    if(window.ResizeObserver){
      const ro = new ResizeObserver(()=>{
        if(seq !== _ygSeq || !document.body.contains(wrap)){ ro.disconnect(); return; }
        remeasure(frame);
      });
      ro.observe(frame);                     // iframe, KHÔNG phải .yg-inner
    }
    const onWinResize = ()=>{
      if(seq !== _ygSeq || !document.body.contains(wrap)){
        window.removeEventListener('resize', onWinResize);
        window.removeEventListener('orientationchange', onWinResize);
        return;
      }
      remeasure(frame);
    };
    window.addEventListener('resize', onWinResize);
    window.addEventListener('orientationchange', onWinResize);
  };

  ygLoadScript().then(()=>{
    if(seq !== _ygSeq) return;
    const id = 'yg-widget-' + idx;
    inner.innerHTML = '<div id="'+id+'"></div>';
    try{
      const w = new YG.Widget(id, {
        width: wrap.clientWidth || 340,
        components: YG_COMPONENTS,
        events: {
          onFetchDone: (e)=>{ _ygDiag.totalResult = e ? e.totalResult : '?'; },
          onError: (e)=>{ try{ _ygDiag.ygError = JSON.stringify(e); }catch(x){} }
        }
      });
      w.fetch(word, YG_LANG);
    }catch(e){
      _ygDiag.ctor = 'THROW: ' + (e && e.message ? e.message : e);
      finish(null);
      return;
    }
    ygWaitForFrame(wrap, YG_TIMEOUT).then(finish);
  }).catch(()=>finish(null));
}

function maybeLoadYouglish(word){
  const box = document.getElementById('youglish-box');
  if(!box) return;
  const seq = ++_ygSeq;
  const idx = _ygIdx++;
  _ygDiag = { word: word, online: navigator.onLine, host: location.host };

  if(!navigator.onLine){ box.innerHTML = ygLinkBtn(word); return; }

  box.innerHTML =
      '<div class="yg-wrap yg-idle" id="yg-wrap">'
    +   '<button class="yg-start" type="button">'
    +     '<span class="yg-start-ico">\u25B6</span>'
    +     '<span class="yg-start-text">Nghe trong c\u00e2u th\u1eadt</span>'
    +   '</button>'
    + '</div>'
    + '<div class="yg-credit">\u{1F3A7} Video t\u1eeb <a href="https://youglish.com" target="_blank" rel="noopener">YouGlish</a></div>'
    + ygLinkBtn(word);

  const wrap = document.getElementById('yg-wrap');
  if(YG_LAZY){
    wrap.querySelector('.yg-start')
        .addEventListener('click', ()=>ygMount(word, wrap, seq, idx), { once: true });
  }else{
    ygMount(word, wrap, seq, idx);
  }
}

function renderEntry(rec, queriedAs){
  const d=rec.data||{}; const w=rec.word;
  const badge = rec.source==='ai' ? '<span class="badge ai">✦ AI · saved offline</span>' : '<span class="badge off">◆ offline</span>';

  // A different Focci pose peeks from the corner of each word — deterministic
  // per word, so the same entry always has the same companion.
  const CORNER=['drink_tea_cup','badass','investigate','wonder','run_and_think','take_note','explore','thumbsup'];
  let seed=0; for(const ch of String(w)) seed=(seed*31+ch.charCodeAt(0))>>>0;
  const corner=CORNER[seed%CORNER.length];

  let h='<div class="entry">';
  h+='<img class="entry-corner" src="./mascot-'+corner+'.webp" alt=""/>';
  h+='';
  if(queriedAs){
    h+='<div class="corrected">Corrected from “'+esc(queriedAs)+'”'+(d.query_note?' · '+esc(d.query_note):'')+'</div>';
  }
  const safeW=esc(w).replace(/'/g,"\\'");
  h+='<div class="head"><div class="head-main">';
  h+='<div class="headword">'+esc(d.word||w)+'</div>';
  h+='<div class="head-meta">';
  if(d.phonetic) h+='<span class="phon">'+esc(d.phonetic)+'</span>';
  h+=(typeof levelTag==='function'?levelTag(d.word||w):'');
  h+='</div>';
  const posSet=[...new Set((d.senses||[]).map(s=>s.pos).filter(Boolean))];
  if(posSet.length){ h+='<div class="pos-row">'+posSet.map(posChip).join('')+'</div>'; }
  h+='<div class="badge-row">'+badge+(d.vi_updated?'<span class="badge upd">↻ refreshed</span>':'')+'</div>';
  h+='</div>';
  // Icon-only actions, no boxes: save, and refresh the Vietnamese meaning.
  h+='<div class="head-acts">';
  h+='<button class="icon-act star '+(rec.saved?'on':'')+'" onclick="toggleSave(\''+safeW+'\')" aria-label="Save word">'+(rec.saved?'★':'☆')+'</button>';
  h+='<button class="icon-act" id="rewrite-btn" onclick="rewriteMeaning(\''+safeW+'\')" title="Refresh the Vietnamese meaning with AI" aria-label="Refresh meaning">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">'
    +'<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></button>';
  h+='</div></div>';

  h+='<div class="family-scroll" id="family-scroll"></div>';
  renderFamilyChips(w);

  if(d.vi_equivalent||d.vi_feel||d.vi_not){
    // The meaning card: one clear Vietnamese answer, then the colour behind it.
    h+='<div class="feel">';
    h+='<div class="feel-top"><span class="feel-lbl">Nghĩa tiếng Việt</span>'
      +(d.register?'<span class="reg">'+esc(d.register)+'</span>':'')+'</div>';
    h+='<div class="feel-eq">'
      +(d.vi_equivalent?esc(d.vi_equivalent)
        :'<i class="no-eq">không có từ tiếng Việt tương đương</i>')+'</div>';
    if(d.vi_note) h+='<div class="feel-note">'+esc(d.vi_note)+'</div>';
    if(d.vi_feel) h+='<div class="feel-scene"><span class="fs-lbl">Hình dung</span>'+esc(d.vi_feel)+'</div>';
    if(d.vi_not)  h+='<div class="feel-warn"><span class="fw-lbl">Đừng nhầm với</span>'+esc(d.vi_not)+'</div>';
    h+='</div>';
  }

  h+='<div id="youglish-box"></div>';

  const f=d.forms;
  if(f && (f.v2||f.v3||f.ving)){
    h+='<div class="forms">';
    h+=formCell('V1',f.v1||d.word||w); h+=formCell('V2',f.v2); h+=formCell('V3',f.v3);
    if(f.ving) h+=formCell('V-ing',f.ving);
    h+='</div>';
  }

  if(Array.isArray(d.senses)&&d.senses.length){
    // group every sense under its part of speech, so all verb meanings sit
    // together, all noun meanings together, etc. — instead of one flat list.
    const groups=new Map();
    for(const s of d.senses){
      const key=String(s.pos||'other').toLowerCase();
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(s);
    }
    // group order: the part of speech holding the strongest meaning comes first
    const order=[...groups.entries()].sort((a,b)=>{
      const ma=Math.max(...a[1].map(x=>x.rank||0)), mb=Math.max(...b[1].map(x=>x.rank||0));
      return mb-ma || b[1].length-a[1].length;
    });
    h+='<div class="sec"><div class="sec-h"><img class="sec-ico" src="./decor-book-open.webp" alt=""/>Meanings</div>';
    for(const [pos,list] of order){
      list.sort((a,b)=>(b.rank||0)-(a.rank||0));
      const c=POS_COLOR[posKey(pos)]||'blue';
      h+='<div class="pos-group" style="border-left-color:var(--'+c+')">';
      h+='<div class="pos-group-h">'+posChip(pos)
        +'<span class="pos-count">'+list.length+(list.length>1?' nghĩa':' nghĩa')+'</span></div>';
      list.forEach((s,i)=>{
        h+='<div class="sense"><div class="sense-top"><span class="senseno">'+(i+1)+'</span>';
        h+='<span class="rank">'+rankStar(s.rank)+'</span></div>';
        if(s.vi) h+='<div class="vi">'+esc(s.vi)+'</div>';
        if(s.vi_hint) h+='<div class="vi-hint">'+esc(s.vi_hint)+'</div>';
        if(s.gloss) h+='<div class="gloss">'+esc(s.gloss)+'</div>';
        if(s.example){ h+='<div class="ex">“'+esc(s.example)+'”'; if(s.example_vi) h+='<span class="evi">→ '+esc(s.example_vi)+'</span>'; h+='</div>'; }
        h+='</div>';
      });
      h+='</div>';
    }
    h+='</div>';
  }

  if(Array.isArray(d.expressions)&&d.expressions.length){
    const es=[...d.expressions].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm blue">🔗</span>Common Usage</div>';
    for(const e of es){ h+='<div class="expr" data-ph="'+esc(norm(e.text||''))+'"><span class="rank">'+rankStar(e.rank)+'</span><span class="t">'+esc(e.text)+'</span>';
      if(e.vi) h+='<span class="ev">'+esc(e.vi)+'</span>'; h+='</div>'; }
    h+='</div>';
  }

  if(Array.isArray(d.collocations)&&d.collocations.length){
    const cs=[...d.collocations].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><img class="sec-ico" src="./decor-note-and-pen.webp" alt=""/>Collocations</div>';
    for(const c of cs){ h+='<div class="expr" data-ph="'+esc(norm(c.text||''))+'"><span class="rank">'+rankStar(c.rank)+'</span><span class="t">'+esc(c.text)+'</span>';
      if(c.vi) h+='<span class="ev">'+esc(c.vi)+'</span>'; h+='</div>'; }
    h+='</div>';
  }

  if(Array.isArray(d.phrasal_verbs)&&d.phrasal_verbs.length){
    const ps=[...d.phrasal_verbs].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm mint">🧩</span>Phrasal Verbs</div>';
    for(const p of ps){ h+='<div class="expr" data-ph="'+esc(norm(p.text||''))+'"><span class="rank">'+rankStar(p.rank)+'</span><span class="t">'+esc(p.text)+'</span>';
      if(p.vi) h+='<span class="ev">'+esc(p.vi)+'</span>'; h+='</div>'; }
    h+='</div>';
  }

  if(Array.isArray(d.idioms)&&d.idioms.length){
    const is_=[...d.idioms].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><img class="sec-ico" src="./decor-magnifying-glass.webp" alt=""/>Idioms</div>';
    for(const it of is_){ h+='<div class="expr" data-ph="'+esc(norm(it.text||''))+'"><span class="rank">'+rankStar(it.rank)+'</span><span class="t">'+esc(it.text)+'</span>';
      if(it.vi) h+='<span class="ev">'+esc(it.vi)+'</span>'; h+='</div>'; }
    h+='</div>';
  }

  if(Array.isArray(d.prepositions)&&d.prepositions.length){
    h+='<div class="sec"><div class="sec-h"><img class="sec-ico" src="./decor-map.webp" alt=""/>Prepositions</div>';
    for(const p of d.prepositions){
      h+='<div class="prep-item"><div class="prep-w">'+esc(d.word||w)+' <b style="color:var(--amber)">'+esc(p.prep)+'</b></div>';
      if(p.meaning_vi) h+='<div class="prep-m">'+esc(p.meaning_vi)+'</div>';
      if(p.example){ h+='<div class="ex">"'+esc(p.example)+'"'; if(p.example_vi) h+='<span class="evi">→ '+esc(p.example_vi)+'</span>'; h+='</div>'; }
      h+='</div>';
    }
    h+='</div>';
  }

  if((d.synonyms&&d.synonyms.length)||(d.antonyms&&d.antonyms.length)){
    h+='<div class="sec"><div class="sec-h"><img class="sec-ico" src="./decor-earth.webp" alt=""/>Synonyms &amp; Antonyms</div><div class="syn-ant">';
    if(d.synonyms&&d.synonyms.length){ h+='<div class="syn-ant-row syn"><div class="lbl">✓ Similar</div><div class="chips">';
      d.synonyms.forEach(x=>h+='<button class="chip syn tap" onclick="jump(\''+esc(x)+'\')">'+esc(x)+'</button>'); h+='</div></div>'; }
    if(d.antonyms&&d.antonyms.length){ h+='<div class="syn-ant-row ant"><div class="lbl">✕ Opposite</div><div class="chips">';
      d.antonyms.forEach(x=>h+='<button class="chip ant tap" onclick="jump(\''+esc(x)+'\')">'+esc(x)+'</button>'); h+='</div></div>'; }
    h+='</div></div>';
  }

  h+='</div>';
  return h;
}
function formCell(k,v){ return '<div class="form"><div class="k">'+k+'</div><div class="v">'+esc(v||'—')+'</div></div>'; }
function jump(w){
  $('#q').value=w;
  hideSuggest();
  const box=$('#result');
  if(box) box.classList.add('leaving');
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(()=>{ if(box) box.classList.remove('leaving'); search(w); }, 130);
}

/* ---------- empty / error / loading states ---------- */
/* The AI reports the input isn't a real word. We show that plainly and offer
   its guess as a tap target — we never silently search the guess instead. */
function notFoundState(word, suggestion){
  const safeS=(suggestion||'').replace(/'/g,"\\'");
  let h='<div class="empty"><img class="ill" src="./mascot-wonder.webp" alt=""/>'
    +'<h3>“'+esc(word)+'” isn\'t an English word Focci knows</h3>'
    +'<p>Spelling checked as-is — nothing was auto-corrected.</p>';
  if(suggestion){
    h+='<button class="btn sm" style="margin:14px auto 0" onclick="jump(\''+safeS+'\')">'
      +'Did you mean “'+esc(suggestion)+'”?</button>';
  }
  h+='<button class="btn ghost sm" style="margin:9px auto 0" onclick="forceAI(\''+word.replace(/'/g,"\\'")+'\')">Look it up anyway</button>';
  h+='</div>';
  return h;
}

function suggestState(query,guess){
  const label=esc(guess.label), target=guess.target, safeT=target.replace(/'/g,"\\'"), safeQ=query.replace(/'/g,"\\'");
  const kind = guess.type==='expr' ? ' <span style="opacity:.72">(inside “'+esc(target)+'”)</span>' : '';
  let h='';
  // Primary action: send Focci off to chart the unknown word.
  h+='<div class="ask-ai-card" onclick="forceAI(\''+safeQ+'\')">'
    +'<img src="./mascot-investigate.webp" alt=""/>'
    +'<div class="ask-ai-txt"><div class="ask-ai-t">Send Focci to explore “'+esc(query)+'”</div>'
    +'<div class="ask-ai-s">AI charts it once, then it\'s yours offline forever</div></div>'
    +'<div class="ask-ai-go">→</div></div>';
  h+='<div class="near-miss"><div class="near-miss-h">Or did you mean…</div>'
    +'<div class="near-miss-row" onclick="jump(\''+safeT+'\')"><span class="nm-w">'+label+'</span>'+kind
    +'<span class="nm-go">→</span></div></div>';
  return h;
}
function needKeyState(w){ return '<div class="empty"><img class="ill" src="./mascot-wonder.webp" alt=""/><h3>“'+esc(w)+'” isn\'t in your library yet</h3><p>Add your Gemini API key in Settings so Focci can chart new words for you.</p></div>'
   +'<button class="btn" onclick="showView(\'settings\')">Open Settings</button>'; }
function offlineState(w){ return '<div class="empty"><img class="ill" src="./mascot-tired.webp" alt=""/><h3>“'+esc(w)+'” isn\'t saved yet</h3><p>You\'re offline right now, so Focci can\'t look it up. Connect and try again — words you\'ve already found still work offline.</p></div>'; }
function errorState(w,msg){
  let m='Something went wrong reaching the AI.';
  if(msg.startsWith('BAD_KEY')) m='Your API key looks wrong or isn\'t enabled. Check it in Settings.';
  else if(msg.startsWith('API')) m='Google returned an error: '+esc(msg.slice(4,120));
  else if(msg==='PARSE') m='The AI reply wasn\'t in the right format. Try again.';
  else if(msg==='OFFLINE') return offlineState(w);
  return '<div class="empty"><img class="ill" src="./mascot-tired.webp" alt=""/><h3>Couldn\'t look up “'+esc(w)+'”</h3><p>'+m+'</p></div>';
}
function questScene(word){
  const cheers=["DON'T GIVE UP…","UNCHARTED TERRITORY!","INTO THE UNKNOWN…","A NEW LAND AWAITS!"];
  return '<div class="quest-scene" style="background-image:url(./bg-desert.webp)">'
    +'<div class="quest-caption"><div class="l1">'+pick(cheers)+'</div>'
    +'<div class="l2">Focci is charting “'+esc(word)+'” for you</div></div>'
    +'<img class="q-map" src="./decor-map.webp" alt=""/>'
    +'<img class="q-rock" src="./decor-rock.webp" alt=""/>'
    +'<img class="q-bush" src="./decor-bush.webp" alt=""/>'
    +'<img class="tumbleweed" src="./decor-tumbleweed.webp" alt=""/>'
    +'<img class="fighter" src="./mascot-fighting.webp" alt=""/>'
    +'<div class="q-dots"><i></i><i></i><i></i></div>'
    +'</div>';
}

/* ============================================================
   AUTOSUGGEST
   ============================================================ */
let suggestTimer=null;
function hideSuggest(){ const el=$('#suggest'); el.classList.remove('show'); el.innerHTML=''; }
async function showRecentSuggest(){
  const logs=await logAll();
  const seen=new Set(); const recent=[];
  for(let i=logs.length-1;i>=0 && recent.length<8;i--){
    const l=logs[i]; if(l.type!=='search'||!l.word||seen.has(l.word)) continue;
    seen.add(l.word); recent.push(l.word);
  }
  if(!recent.length){ hideSuggest(); return; }
  const recs=await Promise.all(recent.map(w=>idbGet(w)));
  renderSuggestList('Recent Searches', recs.filter(Boolean), true);
}
async function showTypedSuggest(q){
  if(q.length<2){ hideSuggest(); return; }
  const results=await idbPrefix(q);
  if(!results.length){ hideSuggest(); return; }
  renderSuggestList('Suggestions', results, false);
}
function renderSuggestList(label, recs, deletable){
  const el=$('#suggest');
  let h='<div class="suggest-lbl">'+label+'</div>';
  for(const r of recs.slice(0,8)){
    const d=r.data||{};
    const safeW=esc(r.word).replace(/'/g,"\\'");
    h+='<div class="suggest-item" onclick="jump(\''+safeW+'\')">'
      +'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'
      +'<span class="suggest-mid"><span class="w">'+esc(r.word)+'</span>'
      +(d.vi_equivalent?'<span class="e">'+esc(d.vi_equivalent)+'</span>':'')+'</span>'
      +(deletable?'<button class="suggest-del" onclick="event.stopPropagation();removeFromSuggest(\''+safeW+'\',this)" aria-label="Remove">✕</button>':'')
      +'</div>';
  }
  el.innerHTML=h; el.classList.add('show');
}
async function removeFromSuggest(word, btn){
  await logDeleteWord(word);
  const item=btn.closest('.suggest-item'); if(item) item.remove();
  const el=$('#suggest');
  if(el && !el.querySelector('.suggest-item')) hideSuggest();
}

/* ============================================================
   HOME DASHBOARD
   ============================================================ */
async function renderHistory(){
  const logs=await logAll();
  const seen=new Set(); const recent=[];
  for(let i=logs.length-1;i>=0 && recent.length<8;i--){
    const l=logs[i]; if(l.type!=='search'||!l.word||seen.has(l.word)) continue;
    seen.add(l.word); recent.push(l.word);
  }
  const box=$('#history-list');
  if(!recent.length){ box.innerHTML='<div class="empty" style="padding:20px 10px"><img class="ill" style="width:110px" src="./mascot-explore.webp" alt=""/><h3>No discoveries yet</h3><p>Search a word above — Focci will chart it on the map.</p></div>'; return; }
  const recs=await Promise.all(recent.map(w=>idbGet(w)));
  let h='';
  for(const r of recs){ if(!r) continue; const d=r.data||{}; const w=esc(r.word);
    const safeW=w.replace(/'/g,"\\'");
    h+='<div class="hist-item" onclick="jump(\''+safeW+'\')">'
      +'<img class="hist-ico" src="./decor-magnifying-glass.webp" alt=""/>'
      +'<div class="hist-mid"><div class="hist-top"><span class="w">'+w+'</span>'
      +(d.phonetic?'<span class="phon">'+esc(d.phonetic)+'</span>':'')+'</div>'
      +(d.vi_equivalent?'<div class="e">'+esc(d.vi_equivalent)+'</div>':'')+'</div>'
      +'<button class="hist-star'+(r.saved?' on':'')+'" onclick="event.stopPropagation();toggleSaveFromList(\''+safeW+'\',this)">'
      +(r.saved?'★':'☆')+'</button>'
      +'<button class="hist-del" onclick="event.stopPropagation();removeFromHistory(\''+safeW+'\')" aria-label="Remove from history">✕</button>'
      +'</div>';
  }
  box.innerHTML=h;
}
const FISH_STORIES=[
['A boy asks his father, "Dad, are bugs good to eat?" "That\'s disgusting. Don\'t talk about things like that over dinner," the dad replies. After','dinner the father asks, "Now, son, what did you want to ask me?" "Oh, nothing," the boy says. "There was a bug in your soup, but now it\'s gone."'],
['A man walks into a bank and asks to rob it. The banker says, "Sir, that\'s illegal." The man responds, "I know, but I\'m tired','of pretending to be employed. You robbed me for 20 years with taxes."'],
['A teacher asks her student, "Why didn\'t you do your homework?" The student says, "My dog ate it." The teacher replies, "That\'s the oldest excuse','in the book." The student says, "Exactly. He has very good taste in literature."'],
['A woman tells her friend, "My husband never listens to me." Her friend asks, "What did he say when you told him?" The woman answers, "I don\'t know—he was asleep."'],
['A job interviewer asks, "What\'s your biggest weakness?" The candidate says, "Honesty." The interviewer responds, "I don\'t think honesty is a weakness." The candidate replies, "I don\'t care what you think."'],
['A doctor tells his patient, "You need to cut back on sugar." The patient asks, "Or what?" The doctor says, "Or you\'ll die." The patient','responds, "I\'m going to die anyway, so at least I\'ll enjoy it."'],
['A child asks his mother, "Why do people lie?" She answers, "To protect people\'s feelings." Later, he asks, "Do you think I\'m smart?" She says, "Of course, honey."'],
['A man tells his friend, "I quit my job to pursue my dreams." His friend asks, "How\'s that going?" He replies, "Terrible. Turns out my dream was just having a salary."'],
['A woman asks her boss, "Can I leave early today?" He says, "Only if you leave better." She responds, "I\'ve been trying for five years."'],
['A student tells his teacher, "This math problem is impossible." The teacher responds, "There\'s always a solution." The student says, "Exactly—it\'s called dropping out."'],
['A man walks into his house and finds his wife with another man. He says calmly, "I\'m leaving you." She responds, "Is it because of','him?" He says, "No, because you\'re still the same person who married me, and clearly your judgment is terrible."'],
['A therapist asks, "How do you feel about your childhood?" His patient responds, "I\'m paying you $150 an hour to talk to me about something I can\'t change."'],
['A politician says, "I\'m here to serve the people." A citizen asks, "How?" The politician responds, "I already am—I\'ve taken their money and their hope."'],
['A woman tells a man at a bar, "I\'m a psychologist." He asks, "Can you read my mind?" She says, "You\'re thinking I\'m interested." He','replies, "Actually I was wondering if you\'d buy me a drink." She says, "My diagnosis was correct."'],
['A boy asks his father, "Why do you work so much?" His father says, "To provide for you." The boy responds, "But you\'re never here. I\'d prefer the opposite."'],
['A customer complains to a restaurant manager, "This food is cold." The manager replies, "That\'s impossible—we just made it." The customer says, "Exactly. You\'ve been talking to me for 15 minutes."'],
['A man tells his friend, "I\'m getting in shape." His friend asks, "For what?" He says, "For my wedding." His friend responds, "Congratulations! Who\'s the lucky woman?" He answers, "Gym."'],
['A lawyer tells his client, "The truth will set you free." His client responds, "That\'s why I hired you—to lie."'],
['A mother asks her son, "Did you finish your vegetables?" He says, "I\'m trying to eat healthy." She responds, "Then why is there pizza in','your room?" He says, "So I don\'t eat it with the vegetables—that would be bad combinations."'],
['A friend asks, "Why don\'t you ever admit you\'re wrong?" Another responds, "I\'m never wrong. Remember when I thought I was wrong? I was wrong about that too."'],
['A man tells a stranger, "I\'m trying to change my life." The stranger asks, "How?" He responds, "I moved to a different apartment." The stranger','says, "That\'s not change." He replies, "Exactly—my problems followed me here too."'],
['A girl tells her boyfriend, "I think we should see other people." He asks, "Why?" She says, "Because you\'re always on your phone." He puts','his phone down and says, "I\'m not anymore." She replies, "Too late—I already called someone else."'],
['A parent asks their child, "Did you learn anything at school today?" The child responds, "Yes—that I should\'ve stayed home."'],
['A man walks into a gym for the first time. The trainer asks, "What\'s your goal?" He says, "To leave and never come back." The','trainer replies, "Honestly, most people\'s goal by month two."'],
['A woman asks her husband, "Do you love me?" He says, "Of course." She asks, "Then why don\'t you show it?" He responds, "Because showing','it would be more expensive than saying it."'],
['A student asks his teacher, "Will this be on the test?" The teacher says, "No." The student then stops paying attention. The teacher adds, "Actually, that question will be."'],
['A man tells his son, "Honesty is the best policy." Later, the son asks, "Do I look fat?" His father says, "Yes." His mother gets','angry. His father whispers, "You said honesty is the best policy."'],
['A wealthy man tells a homeless person, "Have you tried getting a job?" The homeless person responds, "I had three." The man asks, "Then why','are you homeless?" The homeless person says, "Because employers like you keep asking me stupid questions instead of paying me."'],
['A pessimist tells an optimist, "Nothing ever works out." The optimist responds, "That\'s not true! Look, we\'re both still alive." The pessimist says, "Exactly—we haven\'t even accomplished that yet."'],
['A woman tells her therapist, "I have no self-control." Her therapist asks, "How long have you felt this way?" She responds, "Since the moment you','asked—I was supposed to be on a diet."'],
['A man asks a beggar, "Why don\'t you work for your money?" The beggar responds, "I tried that. Now I\'m here. Apparently hard work doesn\'t guarantee success—just guarantees you\'re tired too."'],
['A teenager tells his mom, "I need privacy." She asks, "Why?" He says, "Everyone deserves privacy." She responds, "I know—that\'s why I read your diary in private."'],
['A customer asks a waiter, "Is this fish fresh?" The waiter replies, "It was swimming this morning." The customer says, "Then why does it smell','like it died yesterday?" The waiter responds, "Because you caught it this morning, sir."'],
['A man tells his boss, "I deserve a raise." His boss asks, "Why?" He says, "I\'ve been working here for 10 years." His boss responds, "Exactly—you\'re still learning."'],
['A friend asks, "Why are you so tired?" Another replies, "I\'ve been trying to sleep, but I keep thinking about my problems." His friend says,','"Just don\'t think about them." He responds, "Wow, I never thought of that—but I can\'t stop thinking."'],
['A woman tells her date, "I\'m looking for someone honest." He says, "Great, I\'m very honest." She asks, "So how many people have you dated?"','He responds, "Honestly? I\'ve lost count." She says, "See, honesty works."'],
['A child asks, "Dad, why do you drink so much coffee?" His father replies, "To stay awake at work." The child asks, "Why do you','need to stay awake?" The father says, "To make money." The child asks, "To buy what?" The father responds, "More coffee."'],
['A man tells his doctor, "I snore too much." The doctor asks, "Does it bother you?" He says, "No, it bothers my wife." The doctor responds, "Then she should come see me."'],
['A boss tells his employee, "You\'re fired." The employee asks, "Why?" The boss says, "You\'re not productive." The employee responds, "I know—that\'s why I never','finished anything. If I finished my work, you\'d fire me for being idle."'],
['A woman tells her friend, "I\'m on a diet." Her friend asks, "Does it work?" She responds, "Yes—every diet works when you don\'t follow it."'],
['A teenager tells his mom, "I failed my test." She asks, "How?" He says, "By not studying." She responds, "That\'s not how, that\'s why." He','says, "Exactly—if I knew how, I would\'ve passed."'],
['A man asks a fortune teller, "Can you predict my future?" She says, "Yes, you\'ll be very successful." He asks, "When?" She responds, "When you','stop asking fortune tellers about your future and start working."'],
['A friend asks, "Why did you quit your gym membership?" Another replies, "I was paying for exercise." His friend says, "So you could get healthy."','He responds, "No, so I could feel guilty about not going—which is free."'],
['A customer asks a used car salesman, "Is this car reliable?" The salesman says, "Absolutely." The customer asks, "Then why are you selling it?" The salesman responds, "Because I\'m reliable, not stupid."'],
['A woman tells her therapist, "I have anxiety about the future." The therapist asks, "What worries you most?" She responds, "That I\'ll still be anxious','about the future." The therapist says, "That\'s actually a sign of progress."'],
['A man tells his friend, "I\'m finally debt-free." His friend asks, "How?" He says, "I stopped counting." His friend responds, "That\'s not how debt works."','He says, "I know—that\'s why it\'s working so well."'],
['A parent asks their child, "Why did you hit your brother?" The child responds, "He hit me first." The parent says, "That doesn\'t make it','okay." The child replies, "Exactly—so we\'re both not okay now. It\'s fair."'],
['A musician tells someone, "I haven\'t made any money from my music." The person asks, "Why do you keep doing it?" The musician responds, "Because','if I stop, it means my hobby was a waste of time. If I keep going, there\'s still hope."'],
['A man tells his wife, "I bought us a surprise vacation." She asks, "Where?" He says, "You\'ll see when we get there." She responds, "I','hate surprises." He says, "Good, because we\'re going to my mother\'s house." She replies, "Perfect—I already knew."'],
['A student asks his professor, "Will you teach us how to be successful?" The professor responds, "No, I\'m a teacher—if I knew how to be successful, I wouldn\'t be teaching."'],
];

/* ============================================================
   FOCCI FISHING — the Home footer easter egg. The 4-pose cycle runs
   on its own via CSS now; tapping only advances the story text, ~1
   chunk per tap with a trailing "…" when there's more, until the
   story ends and a new random one is queued up. Progress is
   persisted so backgrounding/reloading the app mid-story doesn't
   lose the spot (the most likely cause of it seeming to "skip" to a
   new story before the current one finished).
   ============================================================ */
let _fishStoryIdx=-1, _fishChunkIdx=0;
(function loadFishState(){
  try{
    const raw=localStorage.getItem('fc_fish_state');
    if(raw){ const s=JSON.parse(raw); _fishStoryIdx=s.storyIdx; _fishChunkIdx=s.chunkIdx; }
  }catch(e){}
})();
function saveFishState(){
  try{ localStorage.setItem('fc_fish_state', JSON.stringify({storyIdx:_fishStoryIdx, chunkIdx:_fishChunkIdx})); }catch(e){}
}
function pickNewFishStory(){
  _fishStoryIdx = Math.floor(Math.random()*FISH_STORIES.length);
  _fishChunkIdx = 0;
}
function tapFishMascot(){
  const bubble=$('#fish-footer-bubble'), tag=$('#fish-footer-tag'); if(!bubble) return;
  if(_fishStoryIdx<0 || _fishStoryIdx>=FISH_STORIES.length) pickNewFishStory();
  const isNewStoryStart = (_fishChunkIdx===0);
  const story=FISH_STORIES[_fishStoryIdx];
  let text=story[_fishChunkIdx];
  const hasMore = _fishChunkIdx < story.length-1;
  bubble.textContent = hasMore ? text+' …' : text;
  if(tag) tag.classList.toggle('show', isNewStoryStart);
  if(hasMore) _fishChunkIdx++;
  else pickNewFishStory();          // story finished — a new random one is queued up for next time
  saveFishState();
}

let _statCache={learned:0,avg:0,mins:0,activeDays:0,todayNew:0,bestDay:0};

async function removeFromHistory(word){
  await logDeleteWord(word);
  renderHistory();
}
/* Star a word straight from a list without leaving the page. */
async function toggleSaveFromList(word, btn){
  const rec=await idbGet(word); if(!rec) return;
  rec.saved=rec.saved?0:1; rec.savedAt=rec.saved?now():0;
  await idbPut(rec);
  if(btn){ btn.textContent=rec.saved?'★':'☆'; btn.classList.toggle('on',!!rec.saved); }
  toast(rec.saved?'Saved ⭐':'Removed from saved');
  logEvent(rec.saved?'save':'unsave', word);
  if(rec.saved) addXP(1);
  refreshStats();
}
window.toggleSaveFromList=toggleSaveFromList;

let _weekLogsCache=[], _weekEarliestDay=0, weekOffset=0;
const WD=['S','M','T','W','T','F','S'];
function renderWeekBars(offset){
  weekOffset=Math.max(0,offset);
  const today=dayStart(now());
  const anchorEnd=today-weekOffset*7*DAY;
  const week=[]; for(let i=6;i>=0;i--){ const dd=anchorEnd-i*DAY;
    const cnt=_weekLogsCache.filter(l=>dayStart(l.ts)===dd && l.type==='search').length; week.push({dd,count:cnt}); }
  const maxWeek=Math.max(1,...week.map(w=>w.count));
  let h='';
  week.forEach(w=>{ const pct=Math.round(w.count/maxWeek*100); const wd=WD[new Date(w.dd).getDay()]; const isToday=(w.dd===today);
    h+='<div class="bar-col'+(isToday?' today':'')+'"><div class="bar-n">'+w.count+'</div><div class="bar-track"><div class="bar-fill" style="height:'+Math.max(4,pct)+'%"></div></div><div class="bar-lbl">'+wd+'</div></div>'; });
  const bars=$('#week-bars'); if(bars) bars.innerHTML=h;

  const lbl=$('#week-range-label');
  if(lbl){
    if(weekOffset===0) lbl.textContent='This week';
    else if(weekOffset===1) lbl.textContent='Last week';
    else{
      const start=new Date(anchorEnd-6*DAY), end=new Date(anchorEnd);
      const fmt=(d)=>d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
      lbl.textContent=fmt(start)+' – '+fmt(end);
    }
  }
  const nextBtn=$('#week-next'); if(nextBtn) nextBtn.disabled = weekOffset===0;
  const prevBtn=$('#week-prev'); if(prevBtn) prevBtn.disabled = (anchorEnd-7*DAY) < _weekEarliestDay;
}
function wireWeekNav(){
  const prevBtn=$('#week-prev'), nextBtn=$('#week-next');
  if(prevBtn && !prevBtn._wired){ prevBtn._wired=true; prevBtn.addEventListener('click',()=>renderWeekBars(weekOffset+1)); }
  if(nextBtn && !nextBtn._wired){ nextBtn._wired=true; nextBtn.addEventListener('click',()=>renderWeekBars(weekOffset-1)); }
}
async function renderDashboardStats(){
  const [entries, logs] = await Promise.all([idbAll(), logAll()]);
  // "Words learned" = words YOU actually looked up, not the pre-seeded library.
  const searches=logs.filter(l=>l.type==='search'&&l.word);
  const learnedSet=new Set(searches.map(l=>l.word));
  const learned=learnedSet.size;
  // Active days = days with at least one search (not merely opening the app).
  const searchDays=new Set(searches.map(l=>dayStart(l.ts)));
  const activeDays=Math.max(1,searchDays.size);
  // Average NEW words per active day: each word counts only on the day first seen.
  const firstSeenDay=new Map();
  for(const l of searches){ const d=dayStart(l.ts);
    if(!firstSeenDay.has(l.word)||d<firstSeenDay.get(l.word)) firstSeenDay.set(l.word,d); }
  const perDay=new Map();
  for(const [,d] of firstSeenDay) perDay.set(d,(perDay.get(d)||0)+1);
  const avg=Math.round(learned/activeDays);
  const today=dayStart(now());
  const todayNew=perDay.get(today)||0;
  const bestDay=Math.max(0,...perDay.values());

  const ms=(+localStorage.getItem(TIME_LS))||0;
  const mins=Math.round(ms/60000);
  _statCache={learned,avg,mins,activeDays,todayNew,bestDay,library:entries.length};

  $('#d-total').textContent=learned.toLocaleString();
  $('#d-avg').textContent=avg;
  $('#d-time').textContent = mins<60 ? mins+'m' : Math.floor(mins/60)+'h '+(mins%60)+'m';

  // the chart can page back through every logged day on this device (the
  // activity log itself is the only limit — see the Settings hint about it)
  _weekLogsCache=logs;
  _weekEarliestDay = logs.length ? dayStart(Math.min(...logs.map(l=>l.ts))) : today;
  wireWeekNav();
  renderWeekBars(0);
}

/* Tap a stat tile → Focci explains what the number actually means. */
function statInsight(which){
  const s=_statCache;
  let img='mascot-read_map', title='', body='';
  if(which==='learned'){
    img='mascot-take_note'; title=s.learned.toLocaleString()+' words explored';
    body = s.learned===0 ? "Search your first word and Focci will start the map."
      : "That's how many different words you've personally looked up. Your offline library holds "
        +(s.library||0).toLocaleString()+" ready for you.";
  } else if(which==='avg'){
    img='mascot-run'; title=s.avg+' new words per active day';
    body = s.activeDays<=1 ? "Come back tomorrow and this becomes a real trend."
      : "Averaged over "+s.activeDays+" active days. Your best day was "+s.bestDay
        +" new words — today you're at "+s.todayNew+".";
  } else {
    img='mascot-drink_tea_cup'; title=(s.mins<60? s.mins+' minutes':(Math.floor(s.mins/60)+'h '+(s.mins%60)+'m'))+' with Focci';
    body = s.mins<5 ? "Barely a tea break so far — plenty of trail left!"
      : "Total time the app has been open. Roughly "+Math.max(1,Math.round(s.mins/Math.max(1,s.activeDays)))
        +" minutes per active day.";
  }
  showInfoCard(img,title,body);
}
function showInfoCard(img,title,body,actionLabel,actionOnclick){
  const ov=document.createElement('div'); ov.className='info-ov';
  const action = actionLabel ? '<button class="info-action" onclick="this.closest(\'.info-ov\').remove();'+actionOnclick+'">'+esc(actionLabel)+'</button>' : '';
  ov.innerHTML='<div class="info-card"><img src="./'+img+'.webp" alt=""/>'
    +'<div class="info-t">'+esc(title)+'</div><div class="info-b">'+esc(body)+'</div>'
    +action+'</div>';
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add('show'));
  ov.addEventListener('click',()=>{ ov.classList.remove('show'); setTimeout(()=>ov.remove(),260); });
}
window.statInsight=statInsight;

async function renderDashboard(){
  renderJar();
  renderGoalCard();
  renderDashboardStats();
  renderHistory();
}
function renderGoalCard(){
  const goal=getDailyGoal(), daily=getDailyXP();
  const pct=Math.max(0,Math.min(100, daily/goal*100));
  const bar=$('#goal-bar'); if(bar) bar.style.width=pct+'%';
  const lbl=$('#goal-title'); if(lbl) lbl.textContent=Math.min(daily,goal)+(daily>goal?'+':'')+' / '+goal+' XP today';
}


/* ============================================================
   THE ORCHARD — a small interactive corner on the Home tab.
   Tap the tree: it shakes, fruit drops, and the tree complains.
   Each shake reveals a saved word, so poking around actually
   builds a memory hook instead of being pure decoration.
   ============================================================ */
const TREE_LINES=[
  "Ouch! Careful with the branches…",
  "Hey! Something fell out.",
  "That tickles. Take a word, then.",
  "Alright, alright — here's another one!",
  "You again? Fine. Last one… probably.",
  "I'm a tree, not a vending machine!",
  "Two hundred years I stood here. Then you arrived.",
  "Shake harder, why don't you. I've only got roots.",
  "In my day, learners waited for fruit to fall.",
  "Oh good, the woodpecker's back. With hands.",
  "I photosynthesise for a living. What's your excuse?"
];
let _lastTreeLine=-1;
function nextTreeLine(){
  if(TREE_LINES.length<2) return TREE_LINES[0]||'';
  let i; do{ i=Math.floor(Math.random()*TREE_LINES.length); }while(i===_lastTreeLine);
  _lastTreeLine=i;
  return TREE_LINES[i];
}
let treeShakes=0;
async function shakeTree(){
  const wrap=$('#tree-widget'); if(!wrap) return;
  const tree=$('#tree-img'), bubble=$('#tree-bubble');
  treeShakes++;
  tree.classList.remove('shaking'); void tree.offsetWidth; tree.classList.add('shaking');

  // drop 1–2 pieces of fruit, clearly staggered so they read as separate drops
  const n=1+Math.floor(Math.random()*2);
  for(let i=0;i<n;i++){
    const f=document.createElement('img');
    f.className='fruit';
    f.src = Math.random()<0.6 ? './fruit-apple.png' : './fruit-orange.png';
    f.style.left=(24+Math.random()*52)+'%';
    const delay=i*0.28 + Math.random()*0.08;
    f.style.animationDelay=delay+'s';
    wrap.appendChild(f);
    setTimeout(()=>f.remove(),1500+delay*1000);
  }
  bubble.textContent=nextTreeLine();
  bubble.classList.add('show');
  clearTimeout(bubble._t); bubble._t=setTimeout(()=>bubble.classList.remove('show'),2600);

  // every 2nd shake, a saved word falls out too — a free micro-review
  if(treeShakes%2===0){
    try{
      const saved=(await idbAll()).filter(r=>r.saved);
      const pool=saved.length?saved:(await idbAll());
      if(pool.length){
        const r=pool[Math.floor(Math.random()*pool.length)];
        const eq=r.data?.vi_equivalent||'';
        const card=$('#tree-word');
        card.innerHTML='<span class="tw-w">'+esc(r.word)+'</span>'+(eq?'<span class="tw-e">'+esc(eq)+'</span>':'');
        card.onclick=(ev)=>{ ev.stopPropagation(); jump(r.word); };
        card.classList.add('show');
        clearTimeout(card._t); card._t=setTimeout(()=>card.classList.remove('show'),4200);
      }
    }catch(e){}
  }
}

/* Tap Focci on the hero banner and he says something back. */
const FOCCI_TAPS=[
  "Ready when you are, explorer!",
  "Psst… try searching a word you heard today.",
  "My notebook has room for one more word.",
  "The best maps are drawn one step at a time.",
  "I once got lost looking for 'serendipity'. Worth it.",
  "Streaks are just tiny adventures in a row."
];
function tapFocci(){
  const b=$('#hero-bubble'); if(!b) return;
  b.textContent=pick(FOCCI_TAPS);
  b.classList.add('show');
  const c=$('#hero-char');
  c.classList.remove('hop'); void c.offsetWidth; c.classList.add('hop');
  clearTimeout(b._t); b._t=setTimeout(()=>b.classList.remove('show'),2800);
}
window.shakeTree=shakeTree; window.tapFocci=tapFocci;

/* ============================================================
   SAVED
   ============================================================ */
let savedSort='newest';
const SORT_CYCLE=['newest','oldest','az','za'];
const SORT_LABEL={newest:'Newest',oldest:'Oldest',az:'A–Z',za:'Z–A'};
const BOOKMARK_COLORS=['yellow','orange','red','blue','green'];
async function renderSaved(){
  let all=(await idbAll()).filter(r=>r.saved);
  const box=$('#saved-list');
  $('#saved-count').innerHTML='<img class="hdr-ico" src="./decor-earth.webp" alt=""/>'
    +all.length+' word'+(all.length===1?'':'s')+' collected';
  if(!all.length){ box.innerHTML='<div class="empty"><img class="ill" src="./mascot-explore.webp" alt=""/><h3>No saved words yet</h3><p>Tap the star ☆ on any word to save it here.</p></div>'; return; }
  if(savedSort==='az') all.sort((a,b)=>a.word.localeCompare(b.word));
  else if(savedSort==='za') all.sort((a,b)=>b.word.localeCompare(a.word));
  else if(savedSort==='oldest') all.sort((a,b)=>a.savedAt-b.savedAt);
  else all.sort((a,b)=>b.savedAt-a.savedAt);
  let h='';
  all.forEach((r,i)=>{ const eq=r.data?.vi_equivalent||''; const w=esc(r.word); const bm=BOOKMARK_COLORS[i%BOOKMARK_COLORS.length];
    h+='<div class="row" onclick="jump(\''+w+'\')"><img class="bookmark-tag" src="./decor-bookmark-'+bm+'.webp" alt=""/>'
     +'<div class="mid"><span class="w">'+w+'</span>'
     +(eq?'<div class="e">'+esc(eq)+'</div>':'')+'</div>'
     +'<button class="rm" onclick="event.stopPropagation();toggleSave(\''+w+'\')">★</button></div>';
  });
  box.innerHTML=h;
}

/* ============================================================
   PRACTICE — two games, one setup screen
   The old build hid its settings behind a pill you had to tap
   repeatedly to discover. Now every round starts on a setup card
   where the choices are visible and labelled, and the game screen
   itself carries nothing but the question.
   ============================================================ */
let revQueue=[], revIdx=0, revState=null, revResults=[], revCorrectCount=0, revSessionAwarded=false;
function reviewPrompt(d){
  if(d.vi_equivalent) return d.vi_equivalent;
  const s0=(d.senses||[])[0];
  if(s0&&s0.vi) return s0.vi;
  if(s0&&s0.gloss) return s0.gloss;
  return '(no meaning saved yet)';
}

/* ---------- CEFR-ish levels, read from levels.txt ----------
   levels.txt is `word<TAB>1..6`, banded by word frequency with the
   Python wordfreq library — an approximation of CEFR, not the
   official thing, so the UI says "level", never "official CEFR". */
const LEVEL_NAMES={1:'A1',2:'A2',3:'B1',4:'B2',5:'C1',6:'C2'};
let _levels=null, _levelsPromise=null;
function loadLevels(){
  if(_levels) return Promise.resolve(_levels);
  if(_levelsPromise) return _levelsPromise;
  _levelsPromise=fetch('./levels.txt')
    .then(r=>r.ok?r.text():'')
    .then(txt=>{
      const m=new Map();
      for(const line of txt.split(/\r?\n/)){
        if(!line) continue;
        const parts=line.split(/[\t,;]+/);
        if(parts.length<2) continue;
        const w=parts[0].trim().toLowerCase(), lv=parseInt(parts[1],10);
        if(w && lv>=1 && lv<=6) m.set(w,lv);
      }
      _levels=m; return m;
    })
    .catch(()=>{ _levels=new Map(); return _levels; });
  return _levelsPromise;
}
function levelOf(word){
  if(!_levels) return 0;
  return _levels.get(String(word||'').toLowerCase())||0;
}
function levelTag(word){
  const lv=levelOf(word);
  return lv?'<span class="lv-tag lv'+lv+'">'+LEVEL_NAMES[lv]+'</span>':'';
}
window.levelOf=levelOf; window.levelTag=levelTag;
let _wordsAtLevelCache=null;
function wordsAtLevel(lv){
  if(!_levels) return [];
  if(!_wordsAtLevelCache){
    _wordsAtLevelCache=new Map();
    for(const [w,l] of _levels.entries()){
      if(!_wordsAtLevelCache.has(l)) _wordsAtLevelCache.set(l,[]);
      _wordsAtLevelCache.get(l).push(w);
    }
  }
  return _wordsAtLevelCache.get(lv)||[];
}
window.wordsAtLevel=wordsAtLevel;

/* ---------- round settings ---------- */
const QCOUNT_LS='fc_qcount', POOL_LS='fc_match_pool', LEVEL_LS='fc_level';
const QCOUNTS=[5,10,20,30,50];
function getQCount(){ const n=+localStorage.getItem(QCOUNT_LS); return QCOUNTS.indexOf(n)>=0?n:5; }
function setQCount(n){ localStorage.setItem(QCOUNT_LS,String(n)); renderPracticeSetup(); }
const POOLS=[['all','Whole library'],['searched','Words I searched'],['saved','My saved words']];
function getPool(){ const p=localStorage.getItem(POOL_LS); return POOLS.some(x=>x[0]===p)?p:'all'; }
function setPool(p){ localStorage.setItem(POOL_LS,p); renderPracticeSetup(); }
function getLevel(){ const l=localStorage.getItem(LEVEL_LS); return (l&&LEVEL_NAMES[+l])?+l:0; }   // 0 = every level
function setLevel(l){ localStorage.setItem(LEVEL_LS,String(l)); renderPracticeSetup(); }
window.setQCount=setQCount; window.setPool=setPool; window.setLevel=setLevel;

let practiceMode='type';     // 'type' | 'match'
let practiceStage='setup';   // 'setup' | 'playing'
function setPracticeMode(m){ practiceMode=m; practiceStage='setup'; renderPracticeSetup(); }
window.setPracticeMode=setPracticeMode;

/* the two games, presented as cards you switch between */
function gameSwitch(){
  const g=(id,icon,name,tag)=>'<button class="game-tab'+(practiceMode===id?' on':'')+'" onclick="setPracticeMode(\''+id+'\')">'
    +'<span class="gt-ico">'+icon+'</span><span class="gt-name">'+name+'</span><span class="gt-tag">'+tag+'</span></button>';
  // Hub back-link: only shows once the story engine has actually taken over
  // this tab (renderGameHub defined) — the mini-games still work standalone
  // if story.js ever fails to load.
  const back=(typeof renderGameHub==='function')
    ? '<button class="hub-back" onclick="renderGameHub()">← Games</button>' : '';
  return back+'<div class="game-switch">'
    +g('type','✍️','Type it','spell from memory')
    +g('match','🎯','Match it','pick the right word')
    +'</div>';
}
function chipRow(label, note, opts){
  let h='<div class="setup-row"><div class="setup-l">'+esc(label)
    +(note?'<span class="setup-note">'+esc(note)+'</span>':'')+'</div><div class="chip-row">';
  for(const o of opts){
    h+='<button class="set-chip'+(o.on?' on':'')+'" onclick="'+o.act+'">'+o.label+'</button>';
  }
  return h+'</div></div>';
}
function dropdownRow(label, note, opts, onChange){
  let h='<div class="setup-row"><div class="setup-l">'+esc(label)
    +(note?'<span class="setup-note">'+esc(note)+'</span>':'')+'</div>';
  h+='<select class="setup-select" onchange="'+onChange+'(this.value)">';
  for(const o of opts) h+='<option value="'+esc(o.value)+'"'+(o.on?' selected':'')+'>'+esc(o.label)+'</option>';
  h+='</select></div>';
  return h;
}
async function renderPracticeSetup(){
  practiceStage='setup';
  const area=$('#review-area'); if(!area) return;
  await loadLevels();
  const n=getQCount(), pool=getPool(), lv=getLevel();

  let h=gameSwitch();
  h+='<div class="setup-card">';
  h+='<div class="setup-head"><img src="./mascot-'+(practiceMode==='type'?'take_note':'investigate')+'.webp" alt=""/>'
    +'<div><div class="setup-t">'+(practiceMode==='type'?'Type it':'Match it')+'</div>'
    +'<div class="setup-s">'+(practiceMode==='type'
        ? 'Focci shows the Vietnamese meaning — you spell the English word. Uses your saved ⭐ words.'
        : 'Focci shows the Vietnamese meaning — you pick the right word out of six.')
    +'</div></div></div>';

  h+=chipRow('How many questions','one round',
    QCOUNTS.map(c=>({label:String(c), on:c===n, act:'setQCount('+c+')'})));

  const levelOpts=[{label:'Any', on:lv===0, act:'setLevel(0)'}]
    .concat([1,2,3,4,5,6].map(l=>({label:LEVEL_NAMES[l], on:lv===l, act:'setLevel('+l+')'})));
  h+=chipRow('Difficulty','by word frequency, not official CEFR', levelOpts);

  if(practiceMode==='match'){
    h+=dropdownRow('Which words','answers come from here',
      POOLS.map(p=>({value:p[0], label:p[1], on:p[0]===pool})), 'setPool');
  }

  // tell them up front how many words actually qualify — no dead-end rounds
  const avail=await availableWords();
  h+='<div class="setup-avail">'+(avail.length
      ? '<b>'+avail.length.toLocaleString()+'</b> word'+(avail.length===1?'':'s')+' match these settings'
        +(avail.length<n?' — this round will be '+avail.length+' question'+(avail.length===1?'':'s')+'.':'.')
      : 'No words match these settings yet.')+'</div>';
  h+='<button class="btn'+(avail.length?'':' disabled')+'" onclick="startPractice()">'
    +(avail.length?'Start round →':'Nothing to practise')+'</button>';
  h+='</div>';

  if(!avail.length) h+=setupEmptyHelp();
  area.innerHTML=h;
}
window.renderPracticeSetup=renderPracticeSetup;

function setupEmptyHelp(){
  const why = practiceMode==='type'
    ? 'Type it quizzes the words you saved with the ☆. Save a few from any word page, or switch to <b>Match it</b> — that one works with your whole library.'
    : (getPool()==='saved' ? 'You haven\'t saved any words yet — tap the ☆ on a word page.'
      : getPool()==='searched' ? 'You haven\'t searched any words yet. Look a few up and they\'ll land in this pool.'
      : 'Try setting difficulty back to <b>Any</b> — that level may have no words yet.');
  return '<div class="empty"><img class="ill" src="./mascot-wonder.webp" alt=""/><h3>Nothing to practise here</h3><p>'+why+'</p></div>';
}

/* Which words qualify right now, for both the count preview and the round. */
async function availableWords(){
  const lv=getLevel();
  const hasMeaning=(r)=>r.data && (r.data.vi_equivalent || ((r.data.senses||[])[0]||{}).vi);
  let list=(await idbAll()).filter(r=>!r.alias && hasMeaning(r));
  if(practiceMode==='type'){
    list=list.filter(r=>r.saved);
  } else {
    const pool=getPool();
    if(pool==='saved') list=list.filter(r=>r.saved);
    else if(pool==='searched'){
      let seen=new Set();
      try{ seen=new Set((await logAll()).filter(l=>l.type==='search'&&l.word).map(l=>l.word)); }catch(e){}
      list=list.filter(r=>seen.has(r.word));
    }
  }
  if(lv) list=list.filter(r=>levelOf(r.word)===lv);
  return list;
}

async function startPractice(){
  const avail=await availableWords();
  if(!avail.length) return;
  wirePracticeSwipe();
  practiceStage='playing';
  if(practiceMode==='match') return startMatch(avail);
  revQueue=avail.sort(()=>Math.random()-0.5).slice(0,getQCount());
  revIdx=0; revState=null;
  revResults=new Array(revQueue.length).fill(null); revCorrectCount=0; revSessionAwarded=false;
  renderReview();
}
window.startPractice=startPractice;

/* Entry point used by the tab bar and by "play again". */
async function startReview(){
  await loadLevels();
  if(practiceStage==='playing' && (revQueue.length||matchRounds.length)) return; // don't wipe a live round
  return renderPracticeSetup();
}

/* A thin bar at the top of a live round: quit back to setup + progress. */
function roundBar(idx,total,states){
  return '<div class="round-bar">'
    +'<button class="rb-quit" onclick="quitRound()" aria-label="Back to setup">✕</button>'
    +'<div class="rb-mid">'+practiceProgress(states)+'</div>'
    +'<div class="rb-count">'+(idx+1)+'<span>/'+total+'</span></div></div>';
}
function quitRound(){
  revQueue=[]; matchRounds=[]; revState=null; matchPicked=null;
  practiceStage='setup'; renderPracticeSetup();
}
window.quitRound=quitRound;

/* ---------- swipe to move on ----------
   The listener lives on #review-area, which survives every innerHTML
   rewrite, so it is wired exactly once. */
function practiceAnswered(){ return practiceMode==='match' ? !!matchPicked : !!revState; }
function practiceAdvance(dir){
  if(practiceStage!=='playing') return;
  if(!practiceAnswered()){ toast('Answer first — then swipe to continue'); return; }
  const area=$('#review-area'); if(!area) return;
  const cls = dir==='right' ? 'swipe-out-r' : 'swipe-out-l';
  area.classList.add(cls);
  setTimeout(()=>{
    area.classList.remove('swipe-out-l','swipe-out-r');
    if(practiceMode==='match') nextMatch(); else nextReview();
  },170);
}
window.practiceAdvance=practiceAdvance;
function wirePracticeSwipe(){
  const el=$('#review-area');
  if(!el || el._swipeWired) return;
  el._swipeWired=1;
  let sx=0, sy=0, st=0, live=false;
  el.addEventListener('touchstart',(e)=>{
    if(e.touches.length!==1){ live=false; return; }
    const t=e.touches[0]; sx=t.clientX; sy=t.clientY; st=Date.now(); live=true;
  },{passive:true});
  el.addEventListener('touchend',(e)=>{
    if(!live) return; live=false;
    const t=e.changedTouches[0];
    const dx=t.clientX-sx, dy=t.clientY-sy, dt=Date.now()-st;
    if(dt>900) return;                                              // a slow drag isn't a swipe
    if(Math.abs(dx)<55 || Math.abs(dy)>Math.abs(dx)*0.8) return;    // must be clearly horizontal
    const ae=document.activeElement;
    if(ae && (ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')) ae.blur();
    practiceAdvance(dx<0?'left':'right');
  },{passive:true});
  document.addEventListener('keydown',(e)=>{
    const v=$('#v-review'); if(!v || !v.classList.contains('active')) return;
    if(practiceStage!=='playing' || !practiceAnswered()) return;
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'||e.key==='Enter'){
      e.preventDefault();
      practiceAdvance(e.key==='ArrowLeft'?'right':'left');
    }
  });
}

/* Dots for a short round, a slim bar once there are too many to see. */
function practiceProgress(states){
  const total=states.length;
  if(total<=14){
    return '<div class="rev-dots">'+states.map(c=>'<div class="rev-dot '+c+'"></div>').join('')+'</div>';
  }
  const okPct=Math.round(states.filter(c=>c==='done').length/total*100);
  const badPct=Math.round(states.filter(c=>c==='wrong').length/total*100);
  return '<div class="rev-slim"><i class="ok" style="width:'+okPct+'%"></i><i class="bad" style="width:'+badPct+'%"></i></div>';
}

/* One shared "you answered — now move on" affordance. */
function swipeOn(){
  return '<div class="swipe-cue" onclick="practiceAdvance(\'left\')">'
    +'<span class="sc-txt">Swipe or tap to continue</span><span class="sc-arrow">›</span></div>';
}

/* The mascot + speech line shared by both games. */
function gameHero(pose,bubble){
  return '<div class="rev-hero"><img class="rev-mascot" src="./mascot-'+pose+'.webp" alt=""/>'
    +'<div class="speech">'+esc(bubble)+'</div></div>';
}
function roundDone(score,total,againFn){
  const perfect=score===total;
  const pose=perfect?'champion':(score>=total/2?'jump':'run_and_think');
  const say=perfect?'A flawless expedition! Every single one.'
    :(score>=total/2?'Good haul! The map is filling in.':'Every explorer stumbles. Tomorrow we go again.');
  const pct=total?Math.round(score/total*100):0;
  return '<div class="round-done"><img class="ill" src="./mascot-'+pose+'.webp" alt=""/>'
    +'<div class="speech big">'+esc(say)+'</div>'
    +'<div class="rd-score">'+score+' <span>/ '+total+'</span></div>'
    +'<div class="rd-ring"><i style="width:'+pct+'%"></i></div>'
    +'<div class="rd-sub">'+pct+'% correct</div></div>'
    +'<button class="btn" onclick="'+againFn+'">Play again</button>'
    +'<button class="btn ghost" onclick="quitRound()">Change settings</button>';
}

/* ============================================================
   MATCH IT — six candidate words, one Vietnamese meaning
   ============================================================ */
let matchRounds=[], matchIdx=0, matchHits=0, matchPicked=null, matchAwarded=false;
async function startMatch(preAvail){
  wirePracticeSwipe();
  const area=$('#review-area');
  const answers=preAvail||await availableWords();
  // Decoys always come from the whole library, so a small pool still gets
  // six believable options.
  const all=(await idbAll()).filter(r=>!r.alias && r.data && (r.data.vi_equivalent || ((r.data.senses||[])[0]||{}).vi));
  if(!answers.length || all.length<6){ return renderPracticeSetup(); }
  practiceStage='playing';
  const meaningOf=(r)=>r.data.vi_equivalent || ((r.data.senses||[])[0]||{}).vi || '';
  matchRounds=[]; matchIdx=0; matchHits=0; matchPicked=null; matchAwarded=false;
  const total=Math.min(getQCount(), answers.length);
  const deck=answers.slice().sort(()=>Math.random()-0.5).slice(0,total);
  for(const answer of deck){
    const opts=[answer];
    let g2=0;
    while(opts.length<6 && g2++<200){
      const c=all[Math.floor(Math.random()*all.length)];
      if(c.word!==answer.word && !opts.some(o=>o.word===c.word)) opts.push(c);
    }
    matchRounds.push({answer, meaning:meaningOf(answer), opts:opts.sort(()=>Math.random()-0.5)});
  }
  renderMatch();
}
function renderMatch(){
  const area=$('#review-area');
  if(matchIdx>=matchRounds.length){
    if(!matchAwarded && matchRounds.length){
      matchAwarded=true; addXP(8);
      if(matchHits===matchRounds.length) localStorage.setItem(PERFECT_LS,'1');
      checkAchievements();
    }
    area.innerHTML=roundDone(matchHits, matchRounds.length, 'startMatch()');
    confettiBurst(area);
    return;
  }
  const r=matchRounds[matchIdx];
  const states=matchRounds.map((x,i)=> i<matchIdx ? (x._ok?'done':'wrong') : (i===matchIdx?'current':'todo'));
  let h=roundBar(matchIdx, matchRounds.length, states);

  let pose='investigate', bubble="Which word means this?";
  if(matchPicked){
    if(matchPicked.ok){ pose='thumbsup'; bubble=pick(["Spot on!","That's the one!","Sharp eye!"]); }
    else { pose='tired'; bubble="Not quite — here's the right one."; }
  }
  h+=gameHero(pose,bubble);

  h+='<div class="match-meaning">'+esc(r.meaning)+levelTag(r.answer.word)+'</div>';
  h+='<div class="match-grid">';
  r.opts.forEach((o,i)=>{
    let cls='match-opt';
    let action='onclick="pickMatch('+i+')"';
    if(matchPicked){
      if(o.word===r.answer.word) cls+=' right';
      else if(o.word===matchPicked.word) cls+=' wrong';
      else cls+=' dim';
      const safeWord=esc(o.word).replace(/'/g,"\\'");
      action='onclick="matchWordPeek(\''+safeWord+'\')"';
    }
    h+='<button class="'+cls+'" '+action+'>'+esc(o.word)+'</button>';
  });
  h+='</div>';
  if(matchPicked) h+=swipeOn();
  area.innerHTML=h;
}
async function pickMatch(i){
  if(matchPicked) return;
  const r=matchRounds[matchIdx], choice=r.opts[i];
  const ok=choice.word===r.answer.word;
  r._ok=ok;
  matchPicked={word:choice.word, ok};
  if(ok){ matchHits++; addXP(3); }
  await logEvent(ok?'review_correct':'review_wrong', r.answer.word);
  try{ const rec=await idbGet(r.answer.word);
    if(rec){ rec.reviewCorrect=(rec.reviewCorrect||0)+(ok?1:0); rec.reviewWrong=(rec.reviewWrong||0)+(ok?0:1);
      rec.lastReviewedAt=now(); await idbPut(rec); } }catch(e){}
  renderMatch();
}
window.matchWordPeek = async function(word){
  try{
    const rec = await idbGet(word);
    if(!rec) return;
    const ov=document.createElement('div'); ov.className='peek-full-ov';
    ov.innerHTML='<div class="peek-full-card">'+renderEntry(rec)+'</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(()=>ov.classList.add('show'));
    ov.addEventListener('click',(e)=>{
      if(e.target!==ov) return;                    // only the backdrop dismisses — the entry itself is meant to be read
      ov.classList.remove('show'); setTimeout(()=>ov.remove(),260);
    });
  }catch(e){}
};
function nextMatch(){ matchIdx++; matchPicked=null; renderMatch(); }
window.startMatch=startMatch; window.pickMatch=pickMatch; window.nextMatch=nextMatch;

/* ============================================================
   TYPE IT
   ============================================================ */
/* The shape of the answer: first letter shown, every other letter an
   underscore, real gaps between words. */
function maskHint(word){
  const w=String(word||'').trim();
  if(!w) return '';
  let out='', first=true, letters=0;
  for(const ch of w){
    if(/\s/.test(ch)){ out+='<span class="mh-gap"></span>'; continue; }
    if(!/[a-zA-Z\u00C0-\u024F]/.test(ch)){ out+='<span class="mh-ch punct">'+esc(ch)+'</span>'; continue; }
    letters++;
    if(first){ out+='<span class="mh-ch first">'+esc(ch)+'</span>'; first=false; }
    else out+='<span class="mh-ch blank">_</span>';
  }
  return '<div class="mask-hint">'+out+'<span class="mh-count">'+letters+' letters</span></div>';
}

function renderReview(){
  const area=$('#review-area');
  if(revIdx>=revQueue.length){
    if(!revSessionAwarded && revQueue.length){
      revSessionAwarded=true; addXP(10);
      if(revCorrectCount===revQueue.length) localStorage.setItem(PERFECT_LS,'1');
      checkAchievements();
    }
    area.innerHTML=roundDone(revCorrectCount, revQueue.length, 'startPractice()');
    confettiBurst(area);
    return;
  }
  const r=revQueue[revIdx], d=r.data||{};
  const prompt=reviewPrompt(d);
  const states=revQueue.map((x,i)=> revResults[i]==='correct' ? 'done'
    : revResults[i]==='wrong' ? 'wrong' : (i===revIdx?'current':'todo'));
  let h=roundBar(revIdx, revQueue.length, states);

  let pose='run_and_think', bubble="Hmm… which word was it?";
  if(revState){
    if(revState.correct && !revState.close){ pose='thumbsup'; bubble=pick(["Nailed it!","That's the one!","Exactly right!"]); }
    else if(revState.correct){ pose='wonder'; bubble="So close — just the spelling!"; }
    else { pose='tired'; bubble=pick(["We'll get it next time.","Tricky one. Keep going!"]); }
  }
  h+=gameHero(pose,bubble);

  h+='<div class="rev-card">';
  h+='<div class="prompt">What\'s the English word for…</div>';
  h+='<div class="q">'+esc(prompt)+levelTag(r.word)+'</div>';
  if(d.vi_note && !revState) h+='<div class="q-note">'+esc(d.vi_note)+'</div>';

  if(!revState){
    h+=maskHint(r.word);
    h+='<input id="rev-input" class="type-input" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Type the English word…"/>';
  } else {
    const cls = revState.correct ? (revState.close?'fb-close':'fb-correct') : 'fb-wrong';
    const icon = revState.correct ? (revState.close?'〰︎':'✓') : '✕';
    const label = revState.correct ? (revState.close?'Close — the correct spelling is:':'Correct!') : 'Correct answer:';
    h+='<div class="rev-fb '+cls+'"><span class="fb-icon">'+icon+'</span> '+label+(revState.close||!revState.correct?' <b>'+esc(r.word)+'</b>':'')+'</div>';
    const s0=(d.senses||[])[0];
    if(s0&&s0.example) h+='<div class="ex" style="margin-top:10px">“'+esc(s0.example)+'”'+(s0.example_vi?'<span class="evi">→ '+esc(s0.example_vi)+'</span>':'')+'</div>';
  }
  h+='</div>';

  if(!revState){
    h+='<button class="btn" style="margin-top:14px" onclick="checkReview()">Check</button>';
    h+='<button class="link-skip" onclick="skipReview()">I don\'t know — show me</button>';
  } else {
    h+=swipeOn();
  }
  area.innerHTML=h;
  const inp=$('#rev-input'); if(inp){ inp.focus(); inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); checkReview(); } }); }
}
async function gradeAndLog(r, correct){
  r.reviewCorrect=(r.reviewCorrect||0)+(correct?1:0);
  r.reviewWrong=(r.reviewWrong||0)+(correct?0:1);
  r.lastReviewedAt=now();
  await idbPut(r);
  await logEvent(correct?'review_correct':'review_wrong', r.word);
}
async function checkReview(){
  const inp=$('#rev-input'); if(!inp) return;
  const guess=norm(inp.value||'');
  if(!guess){ inp.classList.add('shake'); setTimeout(()=>inp.classList.remove('shake'),400); return; }
  const r=revQueue[revIdx], target=norm(r.word);
  const exact=guess===target;
  const dist=lev(guess,target);
  const close=!exact && target.length>=4 && dist<=1;
  const correct=exact||close;
  await gradeAndLog(r, correct);
  revResults[revIdx]=correct?'correct':'wrong';
  if(correct) revCorrectCount++;
  addXP(correct?(close?2:3):0);
  revState={correct, close}; renderReview();
}
async function skipReview(){
  const r=revQueue[revIdx];
  await gradeAndLog(r, false);
  revResults[revIdx]='wrong';
  revState={correct:false, close:false}; renderReview();
}
function nextReview(){ revIdx++; revState=null; renderReview(); }

/* ============================================================
   PROGRESS (insights + achievements)
   ============================================================ */
const TIME_RANGES=[
  {name:'late night (12am–5am)', from:0, to:5},{name:'early morning (5am–8am)', from:5, to:8},
  {name:'morning (8am–11am)', from:8, to:11},{name:'midday (11am–1pm)', from:11, to:13},
  {name:'afternoon (1pm–6pm)', from:13, to:18},{name:'evening (6pm–10pm)', from:18, to:22},
  {name:'late night (10pm–12am)', from:22, to:24},
];
function computeStreak(daySet){
  const today=dayStart(now());
  const hasToday=daySet.has(today);
  let d=hasToday?today:today-DAY, streak=0;
  while(daySet.has(d)){ streak++; d-=DAY; }
  return {streak, hasToday};
}
async function computeInsights(){
  const [logs, entries] = await Promise.all([logAll(), idbAll()]);
  const today=dayStart(now());
  const daySet=new Set(logs.map(l=>dayStart(l.ts)));
  const {streak, hasToday}=computeStreak(daySet);

  const hourBuckets=new Array(24).fill(0);
  logs.forEach(l=>hourBuckets[new Date(l.ts).getHours()]++);
  const totalHourEvents=hourBuckets.reduce((a,b)=>a+b,0);
  let peakRange=null, peakCount=-1;
  for(const rg of TIME_RANGES){ let c=0; for(let h=rg.from;h<rg.to;h++) c+=hourBuckets[h]; if(c>peakCount){peakCount=c;peakRange=rg;} }
  const peakPct = totalHourEvents ? Math.round(peakCount/totalHourEvents*100) : 0;

  const correct=logs.filter(l=>l.type==='review_correct').length;
  const wrong=logs.filter(l=>l.type==='review_wrong').length;
  const totalReview=correct+wrong;
  const accuracy = totalReview ? Math.round(correct/totalReview*100) : null;

  const forgetful=entries.filter(e=>(e.reviewWrong||0)>=2).sort((a,b)=>(b.reviewWrong||0)-(a.reviewWrong||0)).slice(0,3);

  const weekAgo=today-6*DAY, twoWeeksAgo=today-13*DAY;
  const thisWeekSearches=logs.filter(l=>l.type==='search'&&dayStart(l.ts)>=weekAgo).length;
  const lastWeekSearches=logs.filter(l=>l.type==='search'&&dayStart(l.ts)>=twoWeeksAgo&&dayStart(l.ts)<weekAgo).length;

  const savedCount=entries.filter(e=>e.saved).length;
  const savedNotReviewed=entries.filter(e=>e.saved&&!e.lastReviewedAt).length;

  return {streak, hasToday, peakRange, peakPct, totalHourEvents,
    accuracy, totalReview, forgetful, thisWeekSearches, lastWeekSearches,
    totalWords:entries.length, savedCount, savedNotReviewed};
}
function insightCard(color, icon, title, body){
  return '<div class="ins-card"><div class="tile '+color+'">'+icon+'</div><div><div class="ins-title">'+title+'</div><div class="ins-body">'+body+'</div></div></div>';
}
async function renderInsights(){
  const area=$('#insights-area');
  const s=await computeInsights();
  if(!s.totalHourEvents){
    area.innerHTML='<div class="empty"><img class="ill" src="./mascot-read_map.webp" alt=""/><h3>Not enough data yet</h3><p>Search and practice a few more words to see your habits here.</p></div>';
    return;
  }
  const lvl=levelFromXP(getXP()), xp=getXP();
  const xpInLvl=xp%100;
  // Focci's rank grows with your level — the explorer levels up with you
  const RANKS=[[1,'run','Rookie Explorer'],[3,'explore','Scout'],[5,'read_map','Pathfinder'],
               [8,'badass','Veteran Explorer'],[12,'champion','Legend of the Map']];
  let rank=RANKS[0];
  for(const r of RANKS) if(lvl>=r[0]) rank=r;

  let h='';
  h+='<div class="prog-hero">';
  h+='<div class="prog-rays"></div>';
  h+='<img class="prog-char" src="./mascot-'+rank[1]+'.webp" alt=""/>';
  h+='<div class="prog-info">';
  h+='<div class="prog-rank">'+esc(rank[2])+'</div>';
  h+='<div class="prog-lvl">Level '+lvl+'</div>';
  h+='<div class="prog-xpbar"><i style="width:'+xpInLvl+'%"></i></div>';
  h+='<div class="prog-xptxt">'+xpInLvl+' / 100 XP to level '+(lvl+1)+'</div>';
  h+='</div></div>';

  h+='<div class="streak-card'+(s.hasToday?' lit':'')+'">';
  h+='<div class="streak-flame">🔥</div>';
  h+='<div><div class="streak-n">'+s.streak+'<span> day'+(s.streak===1?'':'s')+'</span></div>';
  h+='<div class="streak-l">'+(s.hasToday?'Streak alive — nice work today!':'Explore one word to keep it going')+'</div></div>';
  h+='<img class="streak-deco" src="./decor-alarm.webp" alt=""/>';
  h+='</div>';

  h+='<div class="stat-grid">';
  h+='<div class="stat"><div class="n">'+s.totalWords+'</div><div class="l">WORDS</div><img class="stat-deco" src="./other-puzzle.webp" alt=""/></div>';
  h+='<div class="stat"><div class="n">'+s.savedCount+'</div><div class="l">SAVED</div><img class="stat-deco" src="./other-pencil.webp" alt=""/></div>';
  h+='<div class="stat"><div class="n">'+(s.accuracy==null?'—':s.accuracy+'%')+'</div><div class="l">ACCURACY</div><img class="stat-deco" src="./other-shuttle.webp" alt=""/></div>';
  h+='</div>';

  h+='<div class="library-card"><img src="./decor-load-of-book.webp" alt=""/>'
    +'<div><div class="lib-n">'+s.totalWords.toLocaleString()+'</div>'
    +'<div class="lib-l">words charted in Focci\'s library</div></div></div>';
  h+='<div class="sec"><div class="sec-h">What Focci noticed</div>';
  if(s.peakRange && s.peakPct>=20) h+=insightCard('blue','🕒','You\'re most active in the '+s.peakRange.name, 'About '+s.peakPct+'% of your activity happens then.');
  if(s.totalReview>=5 && s.accuracy!=null){
    const tone = s.accuracy>=80 ? 'Really solid!' : s.accuracy>=50 ? 'Good, and still room to grow.' : 'A bit more practice will help fast.';
    h+=insightCard('mint','🎯','Practice accuracy: '+s.accuracy+'%', tone+' ('+s.totalReview+' answers)');
  }
  if(s.forgetful.length){
    const list=s.forgetful.map(f=>'<b>'+esc(f.word)+'</b> ('+f.reviewWrong+' misses)').join(', ');
    h+=insightCard('coral','🧠','Words you keep missing', list);
  }
  if(s.lastWeekSearches>0){
    const diff=s.thisWeekSearches-s.lastWeekSearches;
    const pct=Math.round(Math.abs(diff)/s.lastWeekSearches*100);
    if(diff>0) h+=insightCard('amber','📈','Up '+pct+'% from last week', s.thisWeekSearches+' words this week vs '+s.lastWeekSearches+' last week.');
    else if(diff<0) h+=insightCard('amber','📉','Down '+pct+'% from last week', s.thisWeekSearches+' words this week vs '+s.lastWeekSearches+' last week — explore a bit more!');
  }
  if(s.savedNotReviewed>0) h+=insightCard('blue','📌', s.savedNotReviewed+' saved words never practiced', 'Head to Practice to start with these.');
  h+='</div>';

  const {list, unlocked}=await checkAchievements();
  h+=renderBadges(list, unlocked);
  area.innerHTML=h;
}

/* ---------- greeting hero ---------- */
function timeOfDay(){
  const hr=new Date().getHours();
  if(hr>=1  && hr<12) return 'morning';    // 1:00 AM – 11:59 AM
  if(hr>=12 && hr<18) return 'afternoon';  // 12:00 PM – 5:59 PM
  return 'night';                          // 6:00 PM – 12:59 AM
}
/* In October, Focci dresses up — a small seasonal surprise. */
function isSpookySeason(){ const d=new Date(); return d.getMonth()===9; }
const TIME_CONTENT={
  morning:{bg:'morning', char:'avatar', sky:'decor-shiny-sun', greet:'Good morning',
    lines:["A brand new map is waiting. Where shall we go?",
           "The sun is up — perfect weather for word-hunting!",
           "Focci packed the bag. Ready when you are!"]},
  afternoon:{bg:'afternoon', char:'read_map', sky:'decor-shiny-sun', greet:'Good afternoon',
    lines:["I spotted a new land on the map. Come see!",
           "Halfway through the day — a few more words?",
           "This trail looks promising. Follow me!"]},
  night:{bg:'night', char:'night', sky:'decor-moon', greet:'Good night',
    lines:["The stars are out. One last word before bed?",
           "Focci is sleepy… but never too sleepy to learn.",
           "Rest well — new lands await tomorrow."]},
};
/* Focci reacts to how you're doing, not just the clock. */
function heroLine(t, streak, hasToday, dailyXP, goal){
  if(streak>0 && !hasToday) return "Our "+streak+"-day streak needs you! One word keeps it alive.";
  if(dailyXP>=goal) return "Today's goal is done — you're on fire! 🔥";
  if(streak>=7) return streak+" days in a row. You're a real explorer now!";
  const arr=t.lines;
  return arr[Math.floor(Date.now()/3600000) % arr.length];
}
async function renderHero(){
  const heroEl=$('#hero'); if(!heroEl) return;
  const t=TIME_CONTENT[timeOfDay()];
  const name=getName();
  heroEl.classList.remove('hero-morning','hero-afternoon','hero-night');
  heroEl.classList.add('hero-'+t.bg);
  heroEl.classList.toggle('is-night', t.bg==='night');
  const spooky = isSpookySeason() && timeOfDay()==='night';
  $('#hero-char').src='./mascot-'+(spooky?'halloween':t.char)+'.webp';
  // Sun and moon each get their own size, place and animation, and both sit
  // BEHIND the greeting now (z-index below the scrim), so nothing is covered.
  const isNight=(t.bg==='night');
  const sky=$('#hero-sky'), glow=$('#hero-glow');
  if(sky){
    sky.src='./'+t.sky+'.webp';
    sky.classList.toggle('is-sun', !isNight);
    sky.classList.toggle('is-moon', isNight);
  }
  if(glow){
    glow.classList.toggle('is-sun', !isNight);
    glow.classList.toggle('is-moon', isNight);
  }
  $('#hero-greet').textContent=t.greet+(name?', '+name:'')+'!';
  const dEl=$('#home-date');
  if(dEl){
    const now2=new Date();
    dEl.textContent=now2.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
  }

  const streakEl=$('#hero-streak'), subEl=$('#hero-sub'), levelEl=$('#hero-level');
  let streak=0, hasToday=false;
  try{
    const logs=await logAll();
    const daySet=new Set(logs.map(l=>dayStart(l.ts)));
    ({streak, hasToday}=computeStreak(daySet));
  }catch(e){}
  if(streak>0){
    streakEl.style.display='inline-flex';
    streakEl.innerHTML='🔥 '+streak+' day'+(streak===1?'':'s');
  } else streakEl.style.display='none';
  subEl.textContent=heroLine(t, streak, hasToday, getDailyXP(), getDailyGoal());
  const lvl=levelFromXP(getXP());
  if(levelEl) levelEl.innerHTML='⚡ Level '+lvl;
}

/* ============================================================
   SETTINGS actions
   ============================================================ */
async function refreshStats(){
  try{ const total=await idbCount(); const saved=(await idbAll()).filter(r=>r.saved).length;
    $('#st-total').textContent=total; $('#st-saved').textContent=saved; }catch(e){}
}
async function importSeedFile(file){
  try{
    const text=await file.text();
    let list=JSON.parse(text); if(!Array.isArray(list)) list=[list];
    let n=0;
    for(const data of list){ if(!data||!data.word) continue;
      const w=norm(normalizeSpelling(data.word)); const ex=await idbGet(w);
      await idbPut({word:w, data, source:'seed', firstSeen:ex?ex.firstSeen:now(), saved:ex?ex.saved:0, savedAt:ex?ex.savedAt:0});
      n++;
    }
    toast('Loaded '+n+' words'); refreshStats();
  }catch(e){ toast('That file isn\'t valid JSON'); }
}

/* ---------- in-app bulk generator (small batches) ---------- */
let genRunning=false;
async function runGenerate(words){
  if(genRunning) return;
  if(!getKey()){ toast('Add your API key first'); return; }
  genRunning=true;
  const prog=$('#gen-progress');
  let ok=0, bad=0;
  for(let i=0;i<words.length;i++){
    const word=norm(normalizeSpelling(words[i]));
    if(!word) continue;
    prog.textContent='Looking up "'+word+'"… ('+(i+1)+'/'+words.length+')';
    try{
      const data=await askGemini(word);
      const canon=norm(data.word||word);
      const ex=await idbGet(canon);
      await idbPut({word:canon, data, source:'ai', firstSeen:ex?ex.firstSeen:now(), saved:ex?ex.saved:0, savedAt:ex?ex.savedAt:0});
      ok++;
    }catch(e){ bad++; }
    await new Promise(r=>setTimeout(r,250));
  }
  prog.textContent='Done — '+ok+' added, '+bad+' failed.';
  genRunning=false;
  refreshStats();
  checkAchievements();
}
function parseWordList(text){
  return text.split(/[\n,]/).map(w=>w.trim()).filter(Boolean);
}

/* ---------- theme ---------- */
function applyTheme(theme){
  if(theme==='auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('#theme-seg button').forEach(b=>b.classList.toggle('active', b.dataset.theme===theme));
}


/* ============================================================
   DICTIONARY MAINTENANCE
   Quality scan · meaning refresh · export · missing-word top-up
   All state lives on this device; every step is resumable.
   ============================================================ */
const SCAN_LS='fc_scan';      // { word: {r:"reason"|""} }  "" = judged fine
const MISS_LS='fc_missing';   // { list:[...], at:timestamp }
let maintBusy=false;

function scanLoad(){ try{ return JSON.parse(localStorage.getItem(SCAN_LS)||'{}'); }catch(_){ return {}; } }
function scanSave(m){ try{ localStorage.setItem(SCAN_LS,JSON.stringify(m)); return true; }
  catch(e){ toast('Device storage is full — export your dictionary'); return false; } }
function missLoad(){ try{ return JSON.parse(localStorage.getItem(MISS_LS)||'{"list":[]}'); }catch(_){ return {list:[]}; } }
function missSave(o){ try{ localStorage.setItem(MISS_LS,JSON.stringify(o)); }catch(e){} }
const flaggedWords=()=>Object.entries(scanLoad()).filter(([w,v])=>v&&v.r).map(([w])=>w).sort();

function mLog(id,msg,cls){
  const el=$(id); if(!el) return;
  const d=document.createElement('div'); if(cls) d.className=cls; d.textContent=msg;
  el.appendChild(d); el.scrollTop=el.scrollHeight;
  while(el.children.length>120) el.removeChild(el.firstChild);
}

/* ---------- generic batched Gemini call returning JSON ---------- */
async function askJSON(prompt,attempt){
  const key=getKey(); if(!key) throw new Error('NO_KEY');
  if(!navigator.onLine) throw new Error('OFFLINE');
  const model=getModel();
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const body={contents:[{parts:[{text:prompt}]}],
    generationConfig:{temperature:0.1,responseMimeType:"application/json",thinkingConfig:{thinkingBudget:0}}};
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if((res.status===429||res.status>=500)&&attempt<4){
    await new Promise(r=>setTimeout(r,900*Math.pow(2,attempt)));
    return askJSON(prompt,attempt+1);
  }
  if(!res.ok){ let m=res.status; try{const e=await res.json();m=(e.error&&e.error.message)||m;}catch(_){}
    throw new Error(String(m).slice(0,90)); }
  const data=await res.json();
  let t=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
  t=t.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
  return JSON.parse(t);
}

/* ============================================================
   1 · QUALITY SCAN — flag entries whose Vietnamese is weak
   Sends only word + Vietnamese meanings (~35 tokens/word),
   40 per call, and only bad ones come back. Resumable.
   ============================================================ */
async function scanRefreshState(){
  const m=scanLoad(); const all=await idbAll();
  const done=all.filter(r=>m[r.word]).length;
  const bad=flaggedWords().length;
  const el=$('#scan-state');
  if(el) el.innerHTML='Scanned <b>'+done.toLocaleString()+'</b> of '+all.length.toLocaleString()
    +' · <b style="color:var(--amber)">'+bad.toLocaleString()+'</b> flagged as weak · '
    +(all.length-done).toLocaleString()+' left to scan.';
  const rb=$('#refresh-state');
  if(rb) rb.innerHTML='<b style="color:var(--amber)">'+bad.toLocaleString()+'</b> words are waiting to have their meanings rewritten.';
  return {all,m,done,bad};
}

function scanPrompt(lines){
  return `You are an expert English–Vietnamese lexicographer reviewing entries in a Vietnamese learner's dictionary.
Each line is: ENGLISH WORD | main Vietnamese meaning | sub-meanings.

Flag ONLY entries whose Vietnamese is genuinely poor, for one of these reasons:
- wrong connotation (e.g. "whimsical" rendered as "kỳ quặc" — wrong, because "kỳ quặc" is derogatory while "whimsical" is a compliment)
- literal word-by-word translation a Vietnamese reader cannot picture
- a common meaning of the word is missing entirely
- so vague it does not distinguish the word from its near-synonyms

If an entry is fine, SAY NOTHING about it. Be strict: most entries are fine.
Return JSON only:
{"bad":[{"w":"word","r":"reason, max 8 Vietnamese words"}]}
If all are fine: {"bad":[]}

${lines.join('\n')}`;
}

function scanLine(rec){
  const d=rec.data||{};
  const subs=(d.senses||[]).map(s=>String(s.vi||'').trim()).filter(Boolean).slice(0,6).join('; ');
  return rec.word+' | '+(d.vi_equivalent||'∅')+' | '+(subs||'∅');
}

async function runScan(){
  if(maintBusy){ maintBusy=false; return; }
  if(!getKey()){ toast('Add your API key first'); return; }
  maintBusy=true; $('#scan-btn').textContent='Stop scanning';
  $('#scan-log').style.display='block';

  const {all,m}=await scanRefreshState();
  const todo=all.filter(r=>!m[r.word]).slice(0,Math.max(1,+$('#scan-count').value||500));
  if(!todo.length){ mLog('#scan-log','Everything has been scanned already.','ok'); maintBusy=false; $('#scan-btn').textContent='Scan for weak meanings'; return; }

  const B=40, batches=[];
  for(let i=0;i<todo.length;i+=B) batches.push(todo.slice(i,i+B));
  mLog('#scan-log','Scanning '+todo.length+' words in '+batches.length+' calls…');

  let n=0,flagged=0;
  for(const b of batches){
    if(!maintBusy){ mLog('#scan-log','Stopped. Progress is saved.','warn'); break; }
    try{
      const r=await askJSON(scanPrompt(b.map(scanLine)),0);
      const bad=new Map((r.bad||[]).map(x=>[String(x.w||'').trim().toLowerCase(),String(x.r||'weak').slice(0,48)]));
      for(const rec of b){
        const hit=bad.get(rec.word.toLowerCase());
        m[rec.word]=hit?{r:hit}:{r:''};
        if(hit){ flagged++; mLog('#scan-log','⚑ '+rec.word+' — '+hit,'warn'); }
      }
      if(!scanSave(m)) break;
    }catch(e){ mLog('#scan-log','✕ batch failed: '+(e.message||e)+' — will retry next time','bad'); }
    n+=b.length;
    $('#scan-bar').style.width=Math.round(n/todo.length*100)+'%';
    await new Promise(r=>setTimeout(r,150));
  }
  mLog('#scan-log','Done: '+n+' scanned, '+flagged+' flagged.','ok');
  await scanRefreshState();
  maintBusy=false; $('#scan-btn').textContent='Scan for weak meanings';
}

/* ---------- import a rewrite queue from a file ----------
   Accepts suspects.txt / ai-suspects.txt (one word per line),
   audit.csv / ai-audit.csv (word,reason,…) or a JSON array.
   Matched words are marked flagged so "Rewrite meanings" picks
   them up — no scanning needed. -------------------------------- */
function parseQueueFile(name,text){
  const out=[];
  if(/\.json$/i.test(name)){
    let j; try{ j=JSON.parse(text); }catch(e){ throw new Error('That file is not valid JSON'); }
    if(!Array.isArray(j)) j=[j];
    for(const x of j){
      if(typeof x==='string') out.push({w:x,r:'imported'});
      else if(x&&x.word) out.push({w:x.word,r:String(x.reason||x.r||'imported')});
      else if(x&&x.w) out.push({w:x.w,r:String(x.r||'imported')});
    }
    return out;
  }
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  // detect a CSV header like: word,reason
  let start=0;
  if(lines.length&&/^"?word"?\s*,/i.test(lines[0])) start=1;
  for(let i=start;i<lines.length;i++){
    const l=lines[i];
    let w,r='imported';
    if(l.indexOf(',')>-1){
      const m=l.match(/^\s*"((?:[^"]|"")*)"\s*,\s*"?((?:[^"]|"")*)"?/);
      if(m){ w=m[1].replace(/""/g,'"'); r=(m[2]||'imported').replace(/""/g,'"'); }
      else { const p=l.split(','); w=p[0]; r=p.slice(1).join(',')||'imported'; }
      // audit.csv is word,score,senses,reasons — the reason is the LAST column
      if(/^[\d,\s]*$/.test(r)){ const p=l.split(','); r=p[p.length-1]||'imported'; }
    } else w=l;
    w=String(w||'').trim().replace(/^"|"$/g,'');
    r=String(r).trim().replace(/^"|"$/g,'').replace(/""/g,'"');
    if(w) out.push({w,r:r.slice(0,48)||'imported'});
  }
  return out;
}

async function importQueueFile(file){
  return ingestQueueRows(parseQueueFile(file.name, await file.text()), file.name);
}
/* Paste-a-list counterpart of the file upload — same parsing, same queue. */
async function importQueuePaste(){
  const ta=$('#queue-text'); if(!ta) return;
  const text=(ta.value||'').trim();
  if(!text){ toast('Paste some words first'); return; }
  const rows=parseQueueFile('pasted.txt', text);
  const ok=await ingestQueueRows(rows,'your pasted list');
  if(ok) ta.value='';
}
async function ingestQueueRows(rows, sourceName){
  try{
    if(!rows.length){ toast('No words found in that list'); return false; }
    $('#refresh-log').style.display='block'; $('#refresh-log').innerHTML='';
    mLog('#refresh-log','Read '+rows.length.toLocaleString()+' words from '+sourceName);

    const all=await idbAll();
    const index=new Map(all.map(r=>[r.word.toLowerCase(),r.word]));
    const m=scanLoad();
    let hit=0,missing=0,dupe=0; const notFound=[];
    for(const {w,r} of rows){
      const real=index.get(String(w).toLowerCase());
      if(!real){ missing++; if(notFound.length<12) notFound.push(w); continue; }
      if(m[real]&&m[real].r){ dupe++; continue; }
      m[real]={r:r||'imported'}; hit++;
    }
    if(!scanSave(m)) return false;
    mLog('#refresh-log','✓ queued '+hit.toLocaleString()+' words for rewriting','ok');
    if(dupe) mLog('#refresh-log','· '+dupe.toLocaleString()+' were already queued');
    if(missing){
      mLog('#refresh-log','· '+missing.toLocaleString()+' are not in your library — skipped','warn');
      if(notFound.length) mLog('#refresh-log','   e.g. '+notFound.join(', '),'warn');
    }
    await scanRefreshState();
    toast('Queued '+hit.toLocaleString()+' words');
    return true;
  }catch(e){ toast('Import failed: '+(e.message||e)); return false; }
}

async function clearQueue(){
  const n=flaggedWords().length;
  if(!n){ toast('The queue is already empty'); return; }
  if(!confirm('Clear the rewrite queue of '+n.toLocaleString()+' words? Scan results for the rest are kept.')) return;
  const m=scanLoad();
  for(const w of Object.keys(m)) if(m[w]&&m[w].r) m[w]={r:''};
  scanSave(m); await scanRefreshState(); toast('Queue cleared');
}

/* ============================================================
   2 · REFRESH MEANINGS — rewrite ONLY the Vietnamese fields
   Collocations, idioms, phonetics etc. are kept untouched, so
   output is ~400 tokens per word instead of ~1800.
   Writes straight back into the library — no download needed.
   ============================================================ */
function refreshPrompt(word,d){
  const cur=(d.senses||[]).map((s,i)=>(i+1)+'. ['+(s.pos||'?')+'] '+(s.vi||'∅')+' — '+(s.gloss||'')).join('\n');
  return `You are an expert English–Vietnamese lexicographer. Rewrite ONLY the Vietnamese side of this dictionary entry for "${word}".

Its current Vietnamese is weak. Existing senses (keep the same senses and the same order, just fix the Vietnamese):
${cur||'(none — supply the senses yourself, most common first)'}

RULES:
- Connotation matters more than brevity. Before finalising each Vietnamese meaning, ask: is the English word praising or criticising? Is the Vietnamese word praising or criticising? If they differ, it is WRONG — pick a longer phrasing that carries the right feeling instead. "vui tươi, giàu tưởng tượng theo kiểu ngộ nghĩnh" (long but right) beats "kỳ quặc" (short but wrong).
- If NO Vietnamese word truly matches, leave "vi_equivalent" as "" and carry the meaning in "vi_feel". A confident but wrong equivalent is the worst possible answer.
- rank = how often this sense appears in real life (5 very common … 1 rare). Keep the common meaning on top; a rare-but-real sense simply sits at the bottom.
- "vi_not" is ONE commonly-confused Vietnamese word that is WRONG for "${word}" — never a word that means the same as any of the senses you just wrote above. Before writing it, check it against every "vi" you produced in "senses": if it overlaps or is a near-synonym of any of them, that is a contradiction — leave "vi_not" as "" instead of forcing one. One short clause on why it's wrong ("hay lẫn với X vì Y" style) — no more.

Return ONLY this JSON:
{
  "vi_equivalent": "1–3 từ tiếng Việt gần nhất, cách nhau bằng ', '. Rỗng nếu không có từ nào khớp.",
  "vi_note": "1 câu ngắn tiếng Việt về cảm giác/cách dùng cốt lõi",
  "vi_feel": "1–2 câu tiếng Việt tả HÌNH ẢNH / TÌNH HUỐNG dùng từ này, không phải định nghĩa từ điển",
  "vi_not": "một từ tiếng Việt hay bị lẫn + lý do ngắn. PHẢI khác nghĩa với mọi 'vi' trong senses ở trên. Rỗng nếu không có từ nào thật sự hay bị lẫn.",
  "register": "trang trọng|trung tính|thân mật|lóng · khen|trung tính|chê",
  "senses": [ { "pos":"...", "vi":"nghĩa tiếng Việt đúng sắc thái", "vi_hint":"1 câu tả cảm giác nếu 'vi' chưa đủ, ngược lại rỗng", "gloss":"short English meaning", "rank":5, "example":"natural English sentence", "example_vi":"bản dịch tự nhiên" } ]
}`;
}

async function runRefresh(){
  if(maintBusy){ maintBusy=false; return; }
  if(!getKey()){ toast('Add your API key first'); return; }
  const queue=flaggedWords().slice(0,Math.max(1,+$('#refresh-count').value||50));
  if(!queue.length){ toast('Nothing is flagged — run the scan first'); return; }

  maintBusy=true; $('#refresh-btn').textContent='Stop';
  $('#refresh-log').style.display='block';
  mLog('#refresh-log','Rewriting meanings for '+queue.length+' words…');

  const m=scanLoad(); let ok=0,bad=0;
  for(let i=0;i<queue.length;i++){
    if(!maintBusy){ mLog('#refresh-log','Stopped. Finished words are already saved.','warn'); break; }
    const w=queue[i];
    try{
      const rec=await idbGet(w);
      if(!rec||!rec.data){ delete m[w]; continue; }
      const fresh=await askJSON(refreshPrompt(w,rec.data),0);
      // MERGE: replace only the Vietnamese side, keep everything else
      const d=rec.data;
      ['vi_equivalent','vi_note','vi_feel','vi_not','register'].forEach(k=>{ if(fresh[k]!==undefined) d[k]=fresh[k]; });
      if(Array.isArray(fresh.senses)&&fresh.senses.length) d.senses=fresh.senses;
      d.vi_updated=Date.now();
      await idbPut(Object.assign({},rec,{data:d}));
      m[w]={r:''};                       // cleared — no longer flagged
      ok++;
      mLog('#refresh-log','✓ '+w+' → '+(d.vi_equivalent||'(no direct equivalent)'),'ok');
    }catch(e){ bad++; mLog('#refresh-log','✕ '+w+' — '+(e.message||e),'bad'); }
    scanSave(m);
    $('#refresh-bar').style.width=Math.round((i+1)/queue.length*100)+'%';
    await new Promise(r=>setTimeout(r,200));
  }
  mLog('#refresh-log','Done: '+ok+' rewritten, '+bad+' failed. '+flaggedWords().length+' still flagged.','ok');
  await scanRefreshState(); refreshStats();
  maintBusy=false; $('#refresh-btn').textContent='Rewrite meanings';
  if(currentWord) jump(currentWord);
}

/* ---------- rewrite ONE word, straight from its own page ----------
   Same prompt and same merge rules as the bulk rewrite above, so a word
   fixed here is identical in shape to one fixed from Settings. The result
   is written back into the library (data.vi_updated marks it), which is
   also what makes it show up in the JSON export. */
async function rewriteMeaning(word){
  const w=norm(word||currentWord||'');
  if(!w) return;
  if(!getKey()){ toast('Add your Gemini API key in Settings first'); showView('settings'); return; }
  if(!navigator.onLine){ toast('You\'re offline — Focci needs the network for this'); return; }
  const rec=await idbGet(w);
  if(!rec||!rec.data){ toast('That word isn\'t in your library yet'); return; }

  const btn=$('#rewrite-btn');
  if(btn){
    if(btn.dataset.busy) return;               // no double-taps
    btn.dataset.busy='1'; btn.classList.add('busy');   // the icon spins, no text swap
  }
  try{
    const fresh=await askJSON(refreshPrompt(w, rec.data), 0);
    const d=rec.data;
    // MERGE: only the Vietnamese side is replaced — collocations, idioms,
    // phonetics, family, synonyms all survive untouched.
    ['vi_equivalent','vi_note','vi_feel','vi_not','register'].forEach(k=>{
      if(fresh[k]!==undefined && fresh[k]!==null) d[k]=fresh[k];
    });
    if(Array.isArray(fresh.senses)&&fresh.senses.length){
      const old=d.senses||[];
      d.senses=fresh.senses.map((s,i)=>Object.assign({}, old[i]||{}, s));
    }
    d.vi_updated=Date.now();
    const saved=Object.assign({},rec,{data:d});
    await idbPut(saved);
    // this word is no longer "weak" — drop it from the maintenance queue
    try{ const m=scanLoad(); if(m[w]&&m[w].r){ m[w]={r:''}; scanSave(m); } }catch(e){}
    currentWord=w;
    const box=$('#result');
    if(box){ box.innerHTML=renderEntry(saved); maybeLoadYouglish(w); window.scrollTo({top:0,behavior:'smooth'}); }
    toast('Meaning refreshed ✓');
  }catch(e){
    const msg=String(e.message||e);
    toast(msg==='OFFLINE'?'You\'re offline right now'
        : msg==='NO_KEY'?'Add your API key in Settings'
        : 'Rewrite failed: '+msg.slice(0,60));
    const b=$('#rewrite-btn');
    if(b){ b.dataset.busy=''; b.classList.remove('busy'); }
  }
}
window.rewriteMeaning=rewriteMeaning;

/* ============================================================
   3 · EXPORT — full backup of the library + activity history
   ============================================================ */
function downloadBlob(text, filename, mime){
  const blob=new Blob([text],{type:mime});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },2000);
}

async function exportDictionary(){
  try{
    const all=await idbAll();
    const list=all
      .filter(r=>!r.alias && r.data)             // aliases have no data, everything else ships
      .map(r=>{
        const d=Object.assign({}, r.data);       // a copy, so the export can't touch the library
        if(!d.word) d.word=r.word;               // never drop an entry over a missing word field
        return d;                                // rewritten meanings ride along via vi_updated
      })
      .sort((a,b)=>String(a.word).localeCompare(String(b.word)));
    const rewritten=list.filter(d=>d.vi_updated).length;
    downloadBlob(JSON.stringify(list,null,1),
      'focci-dictionary-'+new Date().toISOString().slice(0,10)+'.json','application/json');
    toast('Exported '+list.length.toLocaleString()+' words'
      +(rewritten?' · '+rewritten.toLocaleString()+' rewritten':''));
  }catch(e){ toast('Export failed: '+(e.message||e)); }
}

/* Search / activity history — JSON keeps every event, CSV opens in Excel. */
async function exportHistory(kind){
  try{
    const logs=(await logAll()).sort((a,b)=>a.ts-b.ts);
    if(!logs.length){ toast('No activity recorded yet'); return; }
    const stamp=new Date().toISOString().slice(0,10);
    const searches=logs.filter(l=>l.type==='search'&&l.word);
    if(kind==='csv'){
      const q=(s)=>'"'+String(s==null?'':s).replace(/"/g,'""')+'"';
      const rows=[['datetime_iso','date','time','type','word'].join(',')];
      for(const l of logs){
        const dt=new Date(l.ts);
        rows.push([q(dt.toISOString()),q(dt.toLocaleDateString()),q(dt.toLocaleTimeString()),
                   q(l.type||''),q(l.word||'')].join(','));
      }
      downloadBlob('\ufeff'+rows.join('\n'),'focci-history-'+stamp+'.csv','text/csv;charset=utf-8');
    } else {
      const counts={};
      for(const l of searches) counts[l.word]=(counts[l.word]||0)+1;
      const wordCounts=Object.entries(counts)
        .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
        .map(([word,times])=>({word,times}));
      const payload={
        app:'Focci', exportedAt:new Date().toISOString(),
        totalEvents:logs.length, searchEvents:searches.length, uniqueWordsSearched:wordCounts.length,
        firstEventAt: new Date(logs[0].ts).toISOString(),
        lastEventAt: new Date(logs[logs.length-1].ts).toISOString(),
        wordCounts,
        events: logs.map(l=>({at:new Date(l.ts).toISOString(), ts:l.ts, type:l.type||'', word:l.word||null}))
      };
      downloadBlob(JSON.stringify(payload,null,1),'focci-history-'+stamp+'.json','application/json');
    }
    toast('Exported '+logs.length.toLocaleString()+' events · '+searches.length.toLocaleString()+' searches');
  }catch(e){ toast('Export failed: '+(e.message||e)); }
}

/* ============================================================
   4 · TOP UP — find common words the library is missing
   Frequency lists are noisy (proper names, subtitle artefacts,
   inflected forms), so candidates pass three local filters and
   then a cheap AI screen before they are ever generated.
   ============================================================ */
const SRC_FREQ='https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt';
const SRC_DICT='https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt';
const SRC_NAME='https://raw.githubusercontent.com/dominictarr/random-name/master/first-names.txt';
const SUFFIX=[['ies','y'],['es',''],['s',''],['ed',''],['ed','e'],['ied','y'],['ing',''],['ing','e'],['er',''],['est',''],['ly',''],['ers','']];

async function findMissing(){
  if(maintBusy) return;
  maintBusy=true; $('#miss-btn').textContent='Searching…';
  $('#miss-log').style.display='block'; $('#miss-log').innerHTML='';
  try{
    mLog('#miss-log','Downloading word lists…');
    const [fq,dc,nm]=await Promise.all([fetch(SRC_FREQ),fetch(SRC_DICT),fetch(SRC_NAME)].map(p=>p.then(r=>{
      if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); })));

    const valid=new Set(dc.split(/\r?\n/).map(x=>x.trim().toLowerCase()).filter(Boolean));
    const names=new Set(nm.split(/\r?\n/).map(x=>x.trim().toLowerCase()).filter(Boolean));

    mLog('#miss-log','Reading your library…');
    const all=await idbAll();
    const have=new Set();
    for(const r of all){
      have.add(r.word.toLowerCase());
      const d=r.data||{}, f=d.forms||{};
      ['v1','v2','v3','ving'].forEach(k=>String(f[k]||'').split('/').forEach(p=>{ p=p.trim().toLowerCase(); if(p) have.add(p); }));
      (d.family||[]).forEach(x=>{ const p=String(x.word||'').trim().toLowerCase(); if(p) have.add(p); });
    }
    const isInflection=w=>SUFFIX.some(([suf,rep])=>{
      if(!w.endsWith(suf)||w.length-suf.length<3) return false;
      const b=w.slice(0,w.length-suf.length)+rep;
      return have.has(b)||(b.length>3&&b[b.length-1]===b[b.length-2]&&have.has(b.slice(0,-1)));
    });

    const seen=new Set(); const cand=[];
    for(const ln of fq.split(/\r?\n/)){
      const w=ln.split(/\s+/)[0].trim().toLowerCase();
      if(!/^[a-z]{3,}$/.test(w)||seen.has(w)) continue; seen.add(w);
      if(!valid.has(w)||names.has(w)||have.has(w)||isInflection(w)) continue;
      cand.push(w);
    }
    mLog('#miss-log',cand.length+' candidates left after filtering against your '+all.length.toLocaleString()+' words.');

    if(!getKey()){ mLog('#miss-log','No API key — skipping the quality screen. Expect junk in this list.','warn'); missSave({list:cand,at:Date.now()}); }
    else {
      mLog('#miss-log','Screening them with AI (cheap — a few cents)…');
      const keep=[];
      for(let i=0;i<cand.length;i+=120){
        if(!maintBusy){ mLog('#miss-log','Stopped early — keeping what was screened.','warn'); break; }
        const chunk=cand.slice(i,i+120);
        try{
          const r=await askJSON(`From this list, keep ONLY words worth an entry in a Vietnamese learner's English dictionary.
DROP: proper nouns, brand names, place names, abbreviations, internet/spam junk, crude sexual slang, technical filler.
KEEP: ordinary words a learner would meet in reading, conversation, work or study.
Return JSON only: {"keep":["word", ...]}

${chunk.join(', ')}`,0);
          (r.keep||[]).forEach(w=>{ w=String(w).trim().toLowerCase(); if(chunk.includes(w)) keep.push(w); });
        }catch(e){ mLog('#miss-log','✕ screen batch failed, keeping it unscreened','warn'); keep.push(...chunk); }
        mLog('#miss-log','  screened '+Math.min(i+120,cand.length)+'/'+cand.length+' → keeping '+keep.length);
      }
      missSave({list:keep,at:Date.now()});
    }
  }catch(e){ mLog('#miss-log','Failed: '+(e.message||e),'bad'); }
  maintBusy=false; $('#miss-btn').textContent='Find missing words';
  missRefreshState();
}

function missRefreshState(){
  const o=missLoad(); const el=$('#miss-state');
  if(!el) return;
  el.innerHTML = o.list.length
    ? '<b style="color:var(--amber)">'+o.list.length.toLocaleString()+'</b> missing words are queued, ready to add whenever you like.'
    : 'No queue yet — run the search to see what your library is missing.';
}

async function runTopUp(){
  if(maintBusy){ maintBusy=false; return; }
  if(!getKey()){ toast('Add your API key first'); return; }
  const o=missLoad();
  if(!o.list.length){ toast('Find missing words first'); return; }
  const n=Math.max(1,+$('#miss-count').value||25);
  const batch=o.list.slice(0,n);

  maintBusy=true; $('#topup-btn').textContent='Stop';
  $('#miss-log').style.display='block';
  mLog('#miss-log','Adding '+batch.length+' new words…');

  let ok=0,bad=0,i=0;
  for(const w of batch){
    if(!maintBusy){ mLog('#miss-log','Stopped. Added words are saved; the rest stay queued.','warn'); break; }
    try{
      const data=await askGemini(w);
      const canon=norm(data.word||w);
      const ex=await idbGet(canon);
      await idbPut({word:canon,data,source:'ai',firstSeen:ex?ex.firstSeen:now(),saved:ex?ex.saved:0,savedAt:ex?ex.savedAt:0});
      ok++; mLog('#miss-log','✓ '+w,'ok');
    }catch(e){ bad++; mLog('#miss-log','✕ '+w+' — '+(e.message||e),'bad'); }
    i++;
    o.list=o.list.filter(x=>x!==w); missSave(o);   // dequeue as we go, so a crash loses nothing
    $('#miss-bar').style.width=Math.round(i/batch.length*100)+'%';
    await new Promise(r=>setTimeout(r,250));
  }
  mLog('#miss-log','Done: '+ok+' added, '+bad+' failed. '+o.list.length.toLocaleString()+' still queued.','ok');
  maintBusy=false; $('#topup-btn').textContent='Add words';
  missRefreshState(); refreshStats(); checkAchievements();
}

function wireMaintenance(){
  const on=(id,fn)=>{ const el=$(id); if(el) el.addEventListener('click',fn); };
  on('#scan-btn',()=>runScan().catch(e=>{maintBusy=false;$('#scan-btn').textContent='Scan for weak meanings';mLog('#scan-log','Error: '+(e.message||e),'bad');}));
  on('#refresh-btn',()=>runRefresh().catch(e=>{maintBusy=false;$('#refresh-btn').textContent='Rewrite meanings';mLog('#refresh-log','Error: '+(e.message||e),'bad');}));
  on('#export-btn',exportDictionary);
  on('#export-hist-json',()=>exportHistory('json'));
  on('#export-hist-csv',()=>exportHistory('csv'));
  on('#queue-upload-btn',()=>$('#queue-file').click());
  on('#queue-clear-btn',clearQueue);
  on('#queue-paste-btn',importQueuePaste);
  const qf=$('#queue-file');
  if(qf) qf.addEventListener('change',e=>{ if(e.target.files[0]) importQueueFile(e.target.files[0]); e.target.value=''; });
  on('#miss-btn',()=>findMissing());
  on('#topup-btn',()=>runTopUp().catch(e=>{maintBusy=false;$('#topup-btn').textContent='Add words';mLog('#miss-log','Error: '+(e.message||e),'bad');}));
  on('#scan-reset',()=>{ if(confirm('Clear all scan results? You would have to scan again, which costs tokens.')){ localStorage.removeItem(SCAN_LS); scanRefreshState(); } });
  scanRefreshState().catch(()=>{}); missRefreshState();
}

/* ============================================================
   NAV + wiring
   ============================================================ */
function showView(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  $('#v-'+v).classList.add('active');
  document.querySelector('.tab[data-view="'+v+'"]').classList.add('active');
  window.scrollTo(0,0);
  if(v==='home'){
    renderHero();
    // keep an open word visible; only rebuild the dashboard when none is open
    if(currentWord && $('#result').innerHTML.trim()){ $('#dashboard').style.display='none'; $('#topbar-back').style.display='flex'; }
    else { $('#dashboard').style.display='block'; $('#topbar-back').style.display='none'; renderDashboard(); }
  }
  if(v==='saved') renderSaved();
  if(v==='review'){ if(typeof renderGameHub==='function') renderGameHub(); else startReview(); }
  if(v==='stats') renderInsights();
  if(v==='settings'){ refreshStats(); if(typeof scanRefreshState==='function'){ scanRefreshState().catch(()=>{}); missRefreshState(); } if(typeof renderTargetLevelUI==='function') renderTargetLevelUI(); }
}

function wire(){
  const q=$('#q'), clearx=$('#clearx');
  q.addEventListener('input',()=>{
    clearx.style.display=q.value?'block':'none';
    clearTimeout(suggestTimer);
    const val=q.value.trim();
    suggestTimer=setTimeout(()=>{ val ? showTypedSuggest(norm(val)) : showRecentSuggest(); }, 150);
  });
  q.addEventListener('focus',()=>{ if(!q.value.trim()) showRecentSuggest(); else showTypedSuggest(norm(q.value)); });
  q.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); q.blur(); search(q.value); } });
  document.addEventListener('click',(e)=>{ if(!e.target.closest('.searchwrap')) hideSuggest(); });
  clearx.addEventListener('click',()=>{ q.value=''; clearx.style.display='none'; hideSuggest(); backToHome(); });

  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showView(t.dataset.view)));
  $('#sort-cycle').addEventListener('click',()=>{
    const idx=SORT_CYCLE.indexOf(savedSort);
    savedSort=SORT_CYCLE[(idx+1)%SORT_CYCLE.length];
    $('#sort-label').textContent=SORT_LABEL[savedSort];
    renderSaved();
  });
  document.querySelectorAll('#theme-seg button').forEach(b=>b.addEventListener('click',()=>{
    localStorage.setItem(THEME_LS, b.dataset.theme); applyTheme(b.dataset.theme);
  }));
  wireJar();

  $('#key').value=getKey(); $('#model').value=getModel(); $('#goal').value=getDailyGoal();
  $('#save-settings').addEventListener('click',()=>{
    localStorage.setItem(KEY_LS,$('#key').value.trim());
    localStorage.setItem(MODEL_LS,($('#model').value.trim()||'gemini-2.5-flash-lite'));
    setDailyGoal(+$('#goal').value||20);
    renderHero();
    const f=$('#settings-flash'); f.textContent='Saved ✓'; setTimeout(()=>f.textContent='',1800);
  });
  $('#import-btn').addEventListener('click',()=>$('#import-file').click());
  wireMaintenance();
  $('#import-file').addEventListener('change',e=>{ if(e.target.files[0]) importSeedFile(e.target.files[0]); e.target.value=''; });
  $('#gen-upload-btn').addEventListener('click',()=>$('#gen-file').click());
  $('#gen-file').addEventListener('change', async e=>{
    const f=e.target.files[0]; if(!f) return;
    const text=await f.text(); $('#gen-text').value=text; e.target.value='';
  });
  $('#gen-run-btn').addEventListener('click',()=>{
    const words=parseWordList($('#gen-text').value);
    if(!words.length){ toast('Paste some words first'); return; }
    if(words.length>60){ toast('For 60+ words, use the separate generator tool'); return; }
    runGenerate(words);
  });
  $('#persist-btn').addEventListener('click',async()=>{
    const f=$('#persist-flash');
    if(navigator.storage&&navigator.storage.persist){ const ok=await navigator.storage.persist(); f.textContent=ok?'Enabled — your data will be kept ✓':'iOS declined, but adding to Home Screen helps too.'; }
    else f.textContent='Not supported by this browser (Home Screen install still helps).';
  });
  $('#clear-log-btn').addEventListener('click',async()=>{
    await logClearAll();
    const f=$('#clearlog-flash'); f.textContent='Activity log cleared ✓'; setTimeout(()=>f.textContent='',1800);
    renderHero();
  });
  const updBtn=$('#update-btn'); if(updBtn) updBtn.addEventListener('click', forceUpdateApp);
  const restartBtn=$('#restart-story-btn');
  if(restartBtn) restartBtn.addEventListener('click', ()=>{
    if(!confirm('Restart the story from Arc 1? This wipes Focci\'s journey — decisions, stats, chapters. Your dictionary and saved words are not touched.')) return;
    if(typeof resetStoryProgress==='function') resetStoryProgress();
    const f=$('#restart-story-flash'); if(f){ f.textContent='Story restarted ✓'; setTimeout(()=>f.textContent='',1800); }
  });
}

/* ---------- service worker + updates ----------
   iOS "Add to Home Screen" apps sometimes never ask the browser to check
   sw.js again once installed, so they can keep running an old build
   indefinitely. Three layers deal with that:
   1. Ask for an update check on load AND every time the app is
      foregrounded (visibilitychange) — cheap, and catches most cases.
   2. When a new service worker takes control, reload automatically so
      the new files are actually used, not just cached.
   3. A manual "Update" button in Settings for the rare case even that
      doesn't fire — it wipes the SW + caches and hard-reloads. */
let _swReg=null, _swReloading=false;
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if(_swReloading) return; _swReloading=true;
    location.reload();
  });
  window.addEventListener('load', async ()=>{
    try{
      _swReg = await navigator.serviceWorker.register('./sw.js');
      _swReg.update().catch(()=>{});
    }catch(e){}
  });
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='visible' && _swReg) _swReg.update().catch(()=>{});
  });
}
async function forceUpdateApp(){
  const btn=$('#update-btn'), flash=$('#update-flash');
  if(btn) btn.textContent='Updating…';
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      for(const r of regs){ try{ await r.unregister(); }catch(e){} }
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k).catch(()=>{})));
    }
  }catch(e){}
  if(flash) flash.textContent='Reloading with the latest version…';
  setTimeout(()=>location.reload(true), 300);
}
window.forceUpdateApp=forceUpdateApp;

/* ---------- seed sync (auto-merges files listed in seed-files.txt) ---------- */
async function syncSeedFiles(){
  try{
    const res=await fetch('./seed-files.txt'); if(!res.ok) return;
    const text=await res.text();
    const files=text.split(/\r?\n/).map(x=>x.trim()).filter(x=>x && !x.startsWith('#'));
    let merged; try{ merged=JSON.parse(localStorage.getItem('sd_merged_seeds')||'[]'); }catch(e){ merged=[]; }
    const mergedSet=new Set(merged);
    let changed=false;
    for(const fname of files){
      if(mergedSet.has(fname)) continue;
      try{
        const r2=await fetch('./'+fname); if(!r2.ok) continue;
        const list=await r2.json();
        for(const data of list){
          if(!data||!data.word) continue;
          const w=norm(normalizeSpelling(data.word));
          const existing=await idbGet(w);
          if(!existing) await idbPut({word:w, data, source:'seed', firstSeen:now(), saved:0, savedAt:0});
        }
        mergedSet.add(fname); changed=true;
      }catch(e){}
    }
    if(changed){ localStorage.setItem('sd_merged_seeds', JSON.stringify([...mergedSet])); refreshStats(); }
  }catch(e){}
}

/* ---------- onboarding ---------- */
function wireOnboarding(){
  if(getName()){ return; }
  $('#onboarding').style.display='flex';
  $('#ob-start').addEventListener('click',()=>{
    const name=$('#ob-name').value.trim();
    if(name) localStorage.setItem(NAME_LS, name);
    $('#onboarding').style.display='none';
    renderHero();
  });
}

/* ---------- boot ---------- */
(async function init(){
  applyTheme(localStorage.getItem(THEME_LS)||'auto');
  wire();
  wireOnboarding();
  renderHero();
  refreshStats();
  renderDashboard();                    // paint the real screen immediately — never wait on background sync
  logEvent('open', null);
  if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
  buildWordIndex().catch(()=>{});
  buildViIndex().catch(()=>{});
  syncSeedFiles().catch(()=>{});        // fire-and-forget — re-renders itself if it actually merged anything new
})();
window.toggleSave=toggleSave; window.jump=jump; window.forceAI=forceAI; window.backToHome=backToHome;
window.startReview=startReview; window.checkReview=checkReview; window.skipReview=skipReview; window.nextReview=nextReview;
