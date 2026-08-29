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
    celebrate('./assets/mascot/champion.webp', 'Level '+lvlAfter+'!', 'Total '+after+' XP');
  } else if(dailyBefore<goal && dailyAfter>=goal && localStorage.getItem(GOALHIT_LS)!==todayStr()){
    localStorage.setItem(GOALHIT_LS, todayStr());
    celebrate('./assets/mascot/good.webp', 'Daily goal reached!', dailyAfter+' / '+goal+' XP');
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
function celebrate(img, title, sub){
  const ov=document.createElement('div'); ov.className='celebrate-ov';
  ov.innerHTML='<div class="celebrate-card">'+(img?'<img src="'+img+'" alt=""/>':'')+
    '<div class="celebrate-title">'+esc(title)+'</div>'+(sub?'<div class="celebrate-sub">'+esc(sub)+'</div>':'')+'</div>';
  document.body.appendChild(ov);
  confettiBurst(null,36);
  requestAnimationFrame(()=>ov.classList.add('show'));
  const dismiss=()=>{ ov.classList.remove('show'); setTimeout(()=>ov.remove(),300); };
  setTimeout(dismiss,2000);
  ov.addEventListener('click',dismiss);
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
      newly.forEach((a,i)=>setTimeout(()=>toast('🏅 Unlocked: '+a.title), i*900));
    }
    return {list:ACHIEVEMENTS, unlocked:set};
  }catch(e){ return {list:ACHIEVEMENTS, unlocked:new Set()}; }
}
function renderBadges(list, unlocked){
  let h='<div class="sec"><div class="sec-h"><span class="tile tile-sm amber">🏅</span>Achievements</div><div class="badge-grid">';
  for(const a of list){
    const on=unlocked.has(a.id);
    h+='<div class="badge-item '+(on?'unlocked':'locked')+'"><img src="./assets/rewards/'+a.img+'.webp" alt=""/><div class="t">'+esc(a.title)+'</div></div>';
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
function wireJar(){
  const card=$('#jar-card'); if(!card) return;
  card.addEventListener('click', async ()=>{
    card.classList.add('shaking');
    setTimeout(()=>card.classList.remove('shaking'),500);
    const n=await todaysActivityCount();
    setTimeout(()=>{
      const ov=document.createElement('div'); ov.className='jar-reveal';
      ov.innerHTML='<div class="jar-reveal-card"><div class="jar-reveal-n">✨ '+n+' ✨</div><div class="jar-reveal-l">words explored today — searches &amp; practice combined</div></div>';
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
function buildPrompt(word){
  return `You are a bilingual English→Vietnamese lexicographer building a rich, practical dictionary entry. For the English word or phrase "${word}", return a single JSON object (no markdown, no commentary) with EXACTLY this shape:

{
  "word": "corrected/canonical form — fix typos, complete a partial idiom, or normalize slang spelling",
  "query_note": "if you corrected/completed the input, one short Vietnamese phrase like 'Ý bạn là: rain cats and dogs'; else empty string",
  "phonetic": "IPA, e.g. /stɛp/ — omit for multi-word phrases/idioms",
  "vi_equivalent": "the ONE closest natural Vietnamese word/feeling",
  "vi_note": "1 short Vietnamese sentence explaining the core feeling/usage",
  "forms": { "v1":"", "v2":"", "v3":"", "ving":"" },
  "senses": [
    { "pos":"noun|verb|adjective|adverb|idiom|slang|...", "vi":"Vietnamese equivalent for THIS sense",
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

INPUT MAY BE MESSY: a typo, a partial/incomplete idiom (e.g. "rain dogs" → "it's raining cats and dogs"), or casual slang spelling. Silently resolve it to the real, common English word/idiom/slang term and put THAT corrected form in "word". Fill "query_note" only when you actually corrected something.

GOAL: extract AS MUCH genuinely common, real-world usage as you know for this word — a learner should almost never need to look elsewhere. Prioritize BREADTH across every category below over padding just one of them:
- senses: MOST COMMON meaning first. rank = how often you meet it in real life (5=very common … 1=rare). Up to 5 senses. For an idiom/slang entry, pos can be "idiom" or "slang".
- collocations: the natural word-partnerships a native speaker reaches for — verb+noun, adjective+noun, adverb+adjective, noun+noun, fixed comparisons, whatever fits this word's part of speech. This is usually the BIGGEST category — up to 10, ranked. Dig for real ones, don't stop at 1–2.
- phrasal_verbs: ONLY if this word is a verb that genuinely forms phrasal verbs. Up to 6, ranked. Leave the array empty if none exist — never invent one.
- idioms: genuine fixed idioms/proverbs containing this word. Up to 6, ranked. Leave empty if none exist.
- prepositions: the specific preposition(s) where the CHOICE of preposition changes or fixes the meaning (e.g. "afraid OF" vs "afraid FOR", "depend ON", "look UP TO" vs "look DOWN ON"). Up to 5. Leave empty if this word has no meaningful fixed-preposition pattern.
- synonyms/antonyms: up to 8 synonyms and 5 antonyms, common & genuinely distinguishable — skip rare/literary words.
- forms: fill only if it's a single-word verb (put "" for the rest). If a past tense/participle genuinely has two accepted spellings (e.g. "burned"/"burnt", "learned"/"learnt", "dreamed"/"dreamt"), put BOTH separated by " / " in that one field. Omit the whole forms object if not a verb or if multi-word.
- Vietnamese must sound natural, not word-by-word translation.
- Every "text"/"prep" entry must be something a fluent English speaker would actually say — no filler entries just to fill a slot.
- Return ONLY the JSON object.`;
}

async function askGemini(word){
  const key=getKey(); if(!key) throw new Error('NO_KEY');
  if(!navigator.onLine) throw new Error('OFFLINE');
  const model=getModel();
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const body={
    contents:[{parts:[{text:buildPrompt(word)}]}],
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
  const all=await idbAll(); let best=null,bestScore=0.6;
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
async function search(rawWord, forceAI){
  let word=norm(rawWord||'');
  if(!word) return;
  word=normalizeSpelling(word);
  hideSuggest();
  $('#dashboard').style.display='none';
  const box=$('#result');

  if(!forceAI){
    const local=await idbGet(word);
    if(local && local.alias){
      const canon=await idbGet(local.alias);
      if(canon){ currentWord=canon.word; box.innerHTML=renderEntry(canon, word); logEvent('search',canon.word); addXP(2); return; }
    }
    if(local){ currentWord=word; box.innerHTML=renderEntry(local); logEvent('search',word); addXP(2); return; }

    const guess=await fuzzyLocalSearch(word);
    if(guess){ box.innerHTML=suggestState(word, guess); return; }
  }

  if(!getKey()){ box.innerHTML=needKeyState(word); return; }
  if(!navigator.onLine){ box.innerHTML=offlineState(word); return; }

  box.innerHTML=questScene(word);
  try{
    const data=await askGemini(word);
    const canon=norm(data.word||word);
    const rec={word:canon, data, source:'ai', firstSeen:now(), saved:0, savedAt:0};
    await idbPut(rec);
    if(canon!==word){
      await idbPut({word, alias:canon, firstSeen:now(), saved:0, savedAt:0});
    }
    currentWord=canon;
    box.innerHTML=renderEntry(rec, canon!==word?word:null);
    logEvent('search',canon);
    addXP(2);
    refreshStats();
  }catch(err){
    box.innerHTML=errorState(word,err.message||'');
  }
}
function forceAI(word){ search(word,true); }
function backToHome(){ currentWord=null; $('#result').innerHTML=''; $('#dashboard').style.display='block'; $('#q').value=''; $('#clearx').style.display='none'; renderDashboard(); window.scrollTo(0,0); }

/* ---------- toggle save ---------- */
async function toggleSave(word){
  const rec=await idbGet(word); if(!rec) return;
  rec.saved=rec.saved?0:1;
  rec.savedAt=rec.saved?now():0;
  await idbPut(rec);
  if(currentWord===word){ const b=$('#result'); if(b && b.innerHTML) b.innerHTML=renderEntry(rec); }
  toast(rec.saved?'Saved ⭐':'Removed from saved');
  logEvent(rec.saved?'save':'unsave', word);
  if(rec.saved) addXP(1);
  refreshStats();
}

/* ============================================================
   RENDER — word detail
   ============================================================ */
function dots(rank){ const n=Math.max(0,Math.min(5,rank|0)); let o=''; for(let i=0;i<5;i++) o+= i<n?'●':'<span class="off">○</span>'; return o; }
const POS_COLOR={noun:'blue',verb:'mint',adjective:'amber',adverb:'pink',preposition:'primary',
  conjunction:'blue',pronoun:'blue',interjection:'coral',article:'blue',idiom:'coral',slang:'pink'};
function posChip(p){ if(!p) return ''; const c=POS_COLOR[String(p).toLowerCase()]||'blue';
  return '<span class="pos-chip tile-sm '+c+'" style="background:var(--'+c+'-bg);color:var(--'+c+')">'+esc(p)+'</span>'; }

function renderEntry(rec, queriedAs){
  const d=rec.data||{}; const w=rec.word;
  const badge = rec.source==='ai' ? '<span class="badge ai">✦ AI · saved offline</span>' : '<span class="badge off">◆ offline</span>';

  let h='<div class="entry">';
  h+='<div class="back-row" onclick="backToHome()">← Home</div>';
  if(queriedAs){
    h+='<div class="corrected">Corrected from “'+esc(queriedAs)+'”'+(d.query_note?' · '+esc(d.query_note):'')+'</div>';
  }
  h+='<div class="head"><div>';
  h+='<div class="headword">'+esc(d.word||w)+'</div>';
  if(d.phonetic) h+='<div class="phon">'+esc(d.phonetic)+'</div>';
  const posSet=[...new Set((d.senses||[]).map(s=>s.pos).filter(Boolean))];
  if(posSet.length){ h+='<div class="pos-row">'+posSet.map(posChip).join('')+'</div>'; }
  h+=badge;
  h+='</div>';
  h+='<button class="star '+(rec.saved?'on':'')+'" onclick="toggleSave(\''+esc(w)+'\')" aria-label="Save">'+(rec.saved?'★':'☆')+'</button>';
  h+='</div>';

  if(d.vi_equivalent){
    h+='<div class="feel"><div class="tile primary">≈</div><div><div class="eq">'+esc(d.word||w)+' ≈ <b>'+esc(d.vi_equivalent)+'</b></div>';
    if(d.vi_note) h+='<div class="note">'+esc(d.vi_note)+'</div>';
    h+='</div></div>';
  }

  const f=d.forms;
  if(f && (f.v2||f.v3||f.ving)){
    h+='<div class="forms">';
    h+=formCell('V1',f.v1||d.word||w); h+=formCell('V2',f.v2); h+=formCell('V3',f.v3);
    if(f.ving) h+=formCell('V-ing',f.ving);
    h+='</div>';
  }

  if(Array.isArray(d.senses)&&d.senses.length){
    const ss=[...d.senses].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm primary">📘</span>Meanings</div>';
    ss.forEach((s,i)=>{
      h+='<div class="sense"><div class="sense-top"><span class="senseno">'+(i+1)+'</span>';
      if(s.pos) h+=posChip(s.pos);
      h+='<span class="rank">'+dots(s.rank)+'</span></div>';
      if(s.vi) h+='<div class="vi">'+esc(s.vi)+'</div>';
      if(s.gloss) h+='<div class="gloss">'+esc(s.gloss)+'</div>';
      if(s.example){ h+='<div class="ex">“'+esc(s.example)+'”'; if(s.example_vi) h+='<span class="evi">→ '+esc(s.example_vi)+'</span>'; h+='</div>'; }
      h+='</div>';
    });
    h+='</div>';
  }

  if(Array.isArray(d.expressions)&&d.expressions.length){
    const es=[...d.expressions].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm blue">🔗</span>Common Usage</div>';
    for(const e of es){ h+='<div class="expr"><span class="rank">'+dots(e.rank)+'</span><span class="t">'+esc(e.text)+'</span>';
      if(e.vi) h+='<span class="ev">'+esc(e.vi)+'</span>'; h+='</div>'; }
    h+='</div>';
  }

  if(Array.isArray(d.collocations)&&d.collocations.length){
    const cs=[...d.collocations].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm blue">🔗</span>Collocations</div>';
    for(const c of cs){ h+='<div class="expr"><span class="rank">'+dots(c.rank)+'</span><span class="t">'+esc(c.text)+'</span>';
      if(c.vi) h+='<span class="ev">'+esc(c.vi)+'</span>'; h+='</div>'; }
    h+='</div>';
  }

  if(Array.isArray(d.phrasal_verbs)&&d.phrasal_verbs.length){
    const ps=[...d.phrasal_verbs].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm mint">🧩</span>Phrasal Verbs</div>';
    for(const p of ps){ h+='<div class="expr"><span class="rank">'+dots(p.rank)+'</span><span class="t">'+esc(p.text)+'</span>';
      if(p.vi) h+='<span class="ev">'+esc(p.vi)+'</span>'; h+='</div>'; }
    h+='</div>';
  }

  if(Array.isArray(d.idioms)&&d.idioms.length){
    const is_=[...d.idioms].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm coral">💬</span>Idioms</div>';
    for(const it of is_){ h+='<div class="expr"><span class="rank">'+dots(it.rank)+'</span><span class="t">'+esc(it.text)+'</span>';
      if(it.vi) h+='<span class="ev">'+esc(it.vi)+'</span>'; h+='</div>'; }
    h+='</div>';
  }

  if(Array.isArray(d.prepositions)&&d.prepositions.length){
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm amber">🧭</span>Prepositions</div>';
    for(const p of d.prepositions){
      h+='<div class="prep-item"><div class="prep-w">'+esc(d.word||w)+' <b style="color:var(--amber)">'+esc(p.prep)+'</b></div>';
      if(p.meaning_vi) h+='<div class="prep-m">'+esc(p.meaning_vi)+'</div>';
      if(p.example){ h+='<div class="ex">"'+esc(p.example)+'"'; if(p.example_vi) h+='<span class="evi">→ '+esc(p.example_vi)+'</span>'; h+='</div>'; }
      h+='</div>';
    }
    h+='</div>';
  }

  if(Array.isArray(d.family)&&d.family.length){
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm pink">🌱</span>Word Family</div><div class="chips">';
    for(const fm of d.family){ const fw=esc(fm.word||''); h+='<button class="chip tap" onclick="jump(\''+fw+'\')">'+fw+(fm.pos?' <span style="color:var(--muted-2)">·'+esc(fm.pos)+'</span>':'')+'</button>'; }
    h+='</div></div>';
  }

  if((d.synonyms&&d.synonyms.length)||(d.antonyms&&d.antonyms.length)){
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm mint">⇄</span>Synonyms &amp; Antonyms</div><div class="syn-ant">';
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
function jump(w){ $('#q').value=w; search(w); window.scrollTo({top:0,behavior:'smooth'}); }

/* ---------- empty / error / loading states ---------- */
function suggestState(query,guess){
  const label=esc(guess.label), target=guess.target, safeT=target.replace(/'/g,"\\'"), safeQ=query.replace(/'/g,"\\'");
  const kind = guess.type==='expr' ? ' <span style="color:var(--muted-2)">(inside “'+esc(target)+'”)</span>' : '';
  let h='<div class="back-row" onclick="backToHome()">← Home</div>';
  h+='<div class="empty"><img class="ill" src="./assets/mascot/wonder.webp" alt=""/><h3>We don\'t have “'+esc(query)+'” yet</h3>';
  h+='<p>Did you mean <b style="color:var(--text)">“'+label+'”</b>'+kind+'?</p></div>';
  h+='<button class="btn" onclick="jump(\''+safeT+'\')">Show “'+esc(target)+'”</button>';
  h+='<button class="btn ghost sm" style="margin-top:8px" onclick="forceAI(\''+safeQ+'\')">No — look it up as typed</button>';
  return h;
}
function needKeyState(w){ return '<div class="back-row" onclick="backToHome()">← Home</div><div class="empty"><img class="ill" src="./assets/mascot/think.webp" alt=""/><h3>“'+esc(w)+'” isn\'t in your library yet</h3><p>Add your Gemini API key in Settings so Focci can look up new words for you.</p></div>'; }
function offlineState(w){ return '<div class="back-row" onclick="backToHome()">← Home</div><div class="empty"><img class="ill" src="./assets/mascot/think.webp" alt=""/><h3>“'+esc(w)+'” isn\'t saved yet</h3><p>You\'re offline right now, so Focci can\'t look it up. Connect and try again — words you\'ve already found still work offline.</p></div>'; }
function errorState(w,msg){
  let m='Something went wrong reaching the AI.';
  if(msg.startsWith('BAD_KEY')) m='Your API key looks wrong or isn\'t enabled. Check it in Settings.';
  else if(msg.startsWith('API')) m='Google returned an error: '+esc(msg.slice(4,120));
  else if(msg==='PARSE') m='The AI reply wasn\'t in the right format. Try again.';
  else if(msg==='OFFLINE') return offlineState(w);
  return '<div class="back-row" onclick="backToHome()">← Home</div><div class="empty"><img class="ill" src="./assets/mascot/think.webp" alt=""/><h3>Couldn\'t look up “'+esc(w)+'”</h3><p>'+m+'</p></div>';
}
function questScene(word){
  return '<div class="quest-scene" style="background-image:url(./assets/backgrounds/desert.webp)">'
    +'<div class="quest-caption"><div class="l1">DON\'T GIVE UP…</div><div class="l2">Focci is looking up “'+esc(word)+'” for you</div></div>'
    +'<img class="tumbleweed" src="./assets/decor/tumbleweed.webp" alt=""/>'
    +'<img class="fighter" src="./assets/mascot/fighting.webp" alt=""/>'
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
  renderSuggestList('Recent Searches', recs.filter(Boolean));
}
async function showTypedSuggest(q){
  if(q.length<2){ hideSuggest(); return; }
  const results=await idbPrefix(q);
  if(!results.length){ hideSuggest(); return; }
  renderSuggestList('Suggestions', results);
}
function renderSuggestList(label, recs){
  const el=$('#suggest');
  let h='<div class="suggest-lbl">'+label+'</div>';
  for(const r of recs.slice(0,8)){
    const d=r.data||{};
    h+='<div class="suggest-item" onclick="jump(\''+esc(r.word).replace(/'/g,"\\'")+'\')">'
      +'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'
      +'<span class="w">'+esc(r.word)+'</span>'
      +(d.vi_equivalent?'<span class="e">'+esc(d.vi_equivalent)+'</span>':'')
      +'</div>';
  }
  el.innerHTML=h; el.classList.add('show');
}

/* ============================================================
   HOME DASHBOARD
   ============================================================ */
async function renderHistory(){
  const logs=await logAll();
  const seen=new Set(); const recent=[];
  for(let i=logs.length-1;i>=0 && recent.length<12;i--){
    const l=logs[i]; if(l.type!=='search'||!l.word||seen.has(l.word)) continue;
    seen.add(l.word); recent.push(l.word);
  }
  const box=$('#history-list');
  if(!recent.length){ box.innerHTML='<div class="empty" style="padding:24px 10px"><p>No searches yet — try looking up a word above!</p></div>'; return; }
  const recs=await Promise.all(recent.map(w=>idbGet(w)));
  let h='';
  for(const r of recs){ if(!r) continue; const d=r.data||{};
    h+='<div class="row" onclick="jump(\''+esc(r.word).replace(/'/g,"\\'")+'\')">'
      +'<div class="mid"><span class="w">'+esc(r.word)+'</span> <span class="phon">'+esc(d.phonetic||'')+'</span>'
      +(d.vi_equivalent?'<div class="e">'+esc(d.vi_equivalent)+'</div>':'')+'</div>'
      +'</div>';
  }
  box.innerHTML=h;
}
async function renderDashboardStats(){
  const [entries, logs] = await Promise.all([idbAll(), logAll()]);
  const total=entries.length;
  const daySet=new Set(logs.map(l=>dayStart(l.ts)));
  const days=Math.max(1,daySet.size);
  $('#d-total').textContent=total;
  $('#d-avg').textContent=Math.round(total/days);
  const ms=(+localStorage.getItem(TIME_LS))||0;
  const mins=Math.round(ms/60000);
  $('#d-time').textContent = mins<60 ? mins+'m' : Math.floor(mins/60)+'h'+(mins%60)+'m';

  const today=dayStart(now());
  const week=[]; for(let i=6;i>=0;i--){ const dd=today-i*DAY; const cnt=logs.filter(l=>dayStart(l.ts)===dd && l.type==='search').length; week.push({dd,count:cnt}); }
  const maxWeek=Math.max(1,...week.map(w=>w.count));
  const WD=['S','M','T','W','T','F','S'];
  let h='';
  week.forEach(w=>{ const pct=Math.round(w.count/maxWeek*100); const wd=WD[new Date(w.dd).getDay()];
    h+='<div class="bar-col"><div class="bar-track"><div class="bar-fill" style="height:'+Math.max(4,pct)+'%"></div></div><div class="bar-lbl">'+wd+'</div></div>'; });
  $('#week-bars').innerHTML=h;
}
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
   SAVED
   ============================================================ */
let savedSort='newest';
async function renderSaved(){
  let all=(await idbAll()).filter(r=>r.saved);
  const box=$('#saved-list');
  if(!all.length){ box.innerHTML='<div class="empty"><img class="ill" src="./assets/mascot/wonder.webp" alt=""/><h3>No saved words yet</h3><p>Tap the star ☆ on any word to save it here.</p></div>'; return; }
  if(savedSort==='az') all.sort((a,b)=>a.word.localeCompare(b.word));
  else if(savedSort==='oldest') all.sort((a,b)=>a.savedAt-b.savedAt);
  else all.sort((a,b)=>b.savedAt-a.savedAt);
  let h='';
  for(const r of all){ const eq=r.data?.vi_equivalent||''; const w=esc(r.word);
    h+='<div class="row" onclick="jump(\''+w+'\')"><div class="mid"><span class="w">'+w+'</span>'
     +(eq?'<div class="e">'+esc(eq)+'</div>':'')+'</div>'
     +'<button class="rm" onclick="event.stopPropagation();toggleSave(\''+w+'\')">★</button></div>';
  }
  box.innerHTML=h;
}

/* ============================================================
   PRACTICE (typing review)
   ============================================================ */
let revQueue=[], revIdx=0, revState=null, revResults=[], revCorrectCount=0, revSessionAwarded=false;
function reviewPrompt(d){
  if(d.vi_equivalent) return d.vi_equivalent;
  const s0=(d.senses||[])[0];
  if(s0&&s0.vi) return s0.vi;
  if(s0&&s0.gloss) return s0.gloss;
  return '(no meaning saved yet)';
}
async function startReview(){
  const saved=(await idbAll()).filter(r=>r.saved);
  const area=$('#review-area');
  if(saved.length<1){ area.innerHTML='<div class="empty"><img class="ill" src="./assets/mascot/think.webp" alt=""/><h3>Nothing to practice yet</h3><p>Save a few words first, then come back here to type them out from memory.</p></div>'; return; }
  revQueue=saved.sort(()=>Math.random()-0.5).slice(0,10); revIdx=0; revState=null;
  revResults=new Array(revQueue.length).fill(null); revCorrectCount=0; revSessionAwarded=false;
  renderReview();
}
function renderReview(){
  const area=$('#review-area');
  if(revIdx>=revQueue.length){
    if(!revSessionAwarded && revQueue.length){
      revSessionAwarded=true;
      addXP(10);
      if(revCorrectCount===revQueue.length) localStorage.setItem(PERFECT_LS,'1');
      checkAchievements();
    }
    area.innerHTML='<div class="empty"><img class="ill" src="./assets/mascot/champion.webp" alt=""/><h3>Round complete!</h3><p>'+revCorrectCount+' / '+revQueue.length+' correct · +10 XP for finishing. Check Progress for details.</p></div>'
      +'<button class="btn" onclick="startReview()">Practice Again</button>';
    confettiBurst(area);
    return;
  }
  const r=revQueue[revIdx], d=r.data||{};
  const prompt=reviewPrompt(d);
  let h='<div class="rev-dots">';
  for(let i=0;i<revQueue.length;i++){
    let cls='todo'; if(revResults[i]==='correct') cls='done'; else if(revResults[i]==='wrong') cls='wrong'; else if(i===revIdx) cls='current';
    h+='<div class="rev-dot '+cls+'"></div>';
  }
  h+='</div>';
  h+='<div class="rev-progress">Word '+(revIdx+1)+' / '+revQueue.length+'</div>';
  h+='<img class="rev-mascot" src="./assets/mascot/think.webp" alt=""/>';
  h+='<div class="rev-card">';
  h+='<div class="prompt">What\'s the English word for…</div>';
  h+='<div class="q">'+esc(prompt)+'</div>';
  if(d.vi_note && !revState) h+='<div class="q-note">'+esc(d.vi_note)+'</div>';

  if(!revState){
    h+='<input id="rev-input" class="type-input" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Type the English word…"/>';
  } else {
    const cls = revState.correct ? (revState.close?'fb-close':'fb-correct') : 'fb-wrong';
    const icon = revState.correct ? (revState.close?'〰️':'✓') : '✕';
    const label = revState.correct ? (revState.close?'Close — the correct spelling is:':'Correct!') : 'Correct answer:';
    h+='<div class="rev-fb '+cls+'"><span class="fb-icon">'+icon+'</span> '+label+(revState.close||!revState.correct?' <b>'+esc(r.word)+'</b>':'')+'</div>';
    const s0=(d.senses||[])[0];
    if(s0&&s0.example) h+='<div class="ex" style="margin-top:10px">“'+esc(s0.example)+'”'+(s0.example_vi?'<span class="evi">→ '+esc(s0.example_vi)+'</span>':'')+'</div>';
  }
  h+='</div>';

  if(!revState){
    h+='<div class="btn-row" style="margin-top:12px"><button class="btn ghost" onclick="skipReview()">I don\'t know</button><button class="btn" onclick="checkReview()">Check</button></div>';
  } else {
    h+='<button class="btn" onclick="nextReview()">Next word →</button>';
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
    area.innerHTML='<div class="empty"><img class="ill" src="./assets/mascot/wonder.webp" alt=""/><h3>Not enough data yet</h3><p>Search and practice a few more words to see your habits here.</p></div>';
    return;
  }
  let h='';
  h+='<div class="hero-compact">';
  h+='<div class="streak-n">'+s.streak+'</div><div class="streak-l">day streak</div>';
  if(!s.hasToday && s.streak>0) h+='<div class="streak-warn">No activity yet today — explore a word to keep it going!</div>';
  h+='</div>';

  h+='<div class="stat-grid">';
  h+='<div class="stat"><div class="tile primary">📖</div><div class="n">'+s.totalWords+'</div><div class="l">WORDS</div></div>';
  h+='<div class="stat"><div class="tile amber">⭐</div><div class="n">'+s.savedCount+'</div><div class="l">SAVED</div></div>';
  h+='<div class="stat"><div class="tile mint">🎯</div><div class="n">'+(s.accuracy==null?'—':s.accuracy+'%')+'</div><div class="l">ACCURACY</div></div>';
  h+='</div>';

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
  if(hr>=5 && hr<11) return 'morning';
  if(hr>=11 && hr<17) return 'afternoon';
  if(hr>=17 && hr<21) return 'evening';
  return 'night';
}
const TIME_CONTENT={
  morning:{bg:'morning', char:'avatar', greet:'Good morning', sub:'Ready to discover new words today?'},
  afternoon:{bg:'afternoon', char:'map', greet:'Good afternoon', sub:'Focci found a new land to explore.'},
  evening:{bg:'evening', char:'note', greet:'Good evening', sub:"Let's note down what you learned today."},
  night:{bg:'night', char:'night', greet:'Good night', sub:'Rest up — more words await tomorrow.'},
};
async function renderHero(){
  const heroEl=$('#hero'); if(!heroEl) return;
  const t=TIME_CONTENT[timeOfDay()];
  const name=getName();
  heroEl.style.backgroundImage="url('./assets/backgrounds/"+t.bg+".webp')";
  $('#hero-char').src='./assets/mascot/'+t.char+'.webp';
  $('#hero-greet').textContent=t.greet+(name?', '+name:'')+'!';

  const streakEl=$('#hero-streak'), subEl=$('#hero-sub'), levelEl=$('#hero-level');
  try{
    const logs=await logAll();
    const daySet=new Set(logs.map(l=>dayStart(l.ts)));
    const {streak, hasToday}=computeStreak(daySet);
    if(streak>0){
      streakEl.style.display='inline-flex';
      streakEl.innerHTML='🔥 '+streak+' day'+(streak===1?'':'s');
      subEl.textContent = hasToday ? t.sub : "You haven't explored today — keep your "+streak+'-day streak alive!';
    } else { streakEl.style.display='none'; subEl.textContent=t.sub; }
  }catch(e){ subEl.textContent=t.sub; }
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
   NAV + wiring
   ============================================================ */
function showView(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  $('#v-'+v).classList.add('active');
  document.querySelector('.tab[data-view="'+v+'"]').classList.add('active');
  window.scrollTo(0,0);
  if(v==='home'){ renderHero(); if(!currentWord) renderDashboard(); }
  if(v==='saved') renderSaved();
  if(v==='review') startReview();
  if(v==='stats') renderInsights();
  if(v==='settings') refreshStats();
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
  document.querySelectorAll('.sort-btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.sort-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    savedSort=b.dataset.sort; renderSaved();
  }));
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
}

/* ---------- service worker ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

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
  await syncSeedFiles();
  refreshStats();
  renderDashboard();
  logEvent('open', null);
  if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
})();
window.toggleSave=toggleSave; window.jump=jump; window.forceAI=forceAI; window.backToHome=backToHome;
window.startReview=startReview; window.checkReview=checkReview; window.skipReview=skipReview; window.nextReview=nextReview;
