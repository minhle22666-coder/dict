/* ============================================================
   Smart.Dict — offline-first English→Vietnamese semantic dictionary
   Vanilla JS. No build step. All data lives on-device (IndexedDB).
   ============================================================ */

/* ---------- tiny helpers ---------- */
const $ = (s) => document.querySelector(s);
const norm = (w) => w.trim().toLowerCase();
const now = () => Date.now();
const DAY = 864e5;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),1900); }
function dayStart(ts){ const d=new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }

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

/* ---------- behavior log (for the Thống kê tab) ---------- */
function logTx(mode){ return db().then(d=>d.transaction(LOG,mode).objectStore(LOG)); }
function logAdd(rec){ return logTx('readwrite').then(s=>new Promise((res,rej)=>{const r=s.add(rec);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})); }
function logAll(){ return logTx('readonly').then(s=>new Promise((res,rej)=>{const r=s.getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})); }
function logCount(){ return logTx('readonly').then(s=>new Promise((res,rej)=>{const r=s.count();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})); }
function logClearAll(){ return logTx('readwrite').then(s=>new Promise((res,rej)=>{const r=s.clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})); }
function logTrim(){
  return logTx('readwrite').then(s=>new Promise((res)=>{
    const idx=s.index('ts'); const req=idx.openCursor(); let toDelete=[];
    req.onsuccess=(e)=>{ const c=e.target.result; if(c){ toDelete.push(c.primaryKey); c.continue(); } else { res(toDelete); } };
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
const KEY_LS='sd_key', MODEL_LS='sd_model', SEEDFILES_LS='sd_merged_seeds';
const getKey=()=>localStorage.getItem(KEY_LS)||'';
const getModel=()=>localStorage.getItem(MODEL_LS)||'gemini-2.5-flash-lite';

/* ---------- XP / level / daily goal (all local, no server) ---------- */
const XP_LS='sd_xp', XP_DAILY_LS='sd_xp_daily', GOAL_LS='sd_daily_goal', ACH_LS='sd_achievements',
      GOALHIT_LS='sd_goal_hit_date', PERFECT_LS='sd_perfect_session';
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
    celebrate('🎉 Lên cấp '+lvlAfter+'!', 'Tổng cộng '+after+' XP');
  } else if(dailyBefore<goal && dailyAfter>=goal && localStorage.getItem(GOALHIT_LS)!==todayStr()){
    localStorage.setItem(GOALHIT_LS, todayStr());
    celebrate('🎯 Đạt mục tiêu hôm nay!', dailyAfter+' / '+goal+' XP');
  }
  renderHero();
  checkAchievements();
}

/* ---------- lightweight confetti + celebration overlay ---------- */
function confettiBurst(originEl, count){
  count=count||24;
  let cx=window.innerWidth/2, cy=window.innerHeight/3;
  if(originEl){ const rect=originEl.getBoundingClientRect(); cx=rect.left+rect.width/2; cy=rect.top+rect.height/2; }
  const colors=['#6C5CE7','#4F8EF7','#F0A020','#22B57F','#FF6FA5','#FF5C7A'];
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
function celebrate(title, sub){
  const ov=document.createElement('div'); ov.className='celebrate-ov';
  ov.innerHTML='<div class="celebrate-card"><div class="celebrate-title">'+title+'</div>'+(sub?'<div class="celebrate-sub">'+esc(sub)+'</div>':'')+'</div>';
  document.body.appendChild(ov);
  confettiBurst(null,36);
  requestAnimationFrame(()=>ov.classList.add('show'));
  const dismiss=()=>{ ov.classList.remove('show'); setTimeout(()=>ov.remove(),300); };
  setTimeout(dismiss,1800);
  ov.addEventListener('click',dismiss);
}

/* ---------- achievements ---------- */
const ACHIEVEMENTS=[
  {id:'first_word',icon:'📖',title:'Từ đầu tiên',test:s=>s.totalWords>=1},
  {id:'ten_words',icon:'📚',title:'10 từ',test:s=>s.totalWords>=10},
  {id:'hundred_words',icon:'🏛️',title:'100 từ',test:s=>s.totalWords>=100},
  {id:'first_save',icon:'⭐',title:'Lưu đầu tiên',test:s=>s.savedCount>=1},
  {id:'saver_10',icon:'🌟',title:'Lưu 10 từ',test:s=>s.savedCount>=10},
  {id:'streak_3',icon:'🔥',title:'Chuỗi 3 ngày',test:s=>s.streak>=3},
  {id:'streak_7',icon:'🔥',title:'Chuỗi 7 ngày',test:s=>s.streak>=7},
  {id:'streak_30',icon:'🔥',title:'Chuỗi 30 ngày',test:s=>s.streak>=30},
  {id:'accurate',icon:'🎯',title:'Chính xác 80%',test:s=>s.totalReview>=10 && s.accuracy!=null && s.accuracy>=80},
  {id:'perfect',icon:'💯',title:'Ôn hoàn hảo',test:()=>localStorage.getItem(PERFECT_LS)==='1'},
  {id:'level_5',icon:'🏅',title:'Cấp 5',test:()=>levelFromXP(getXP())>=5},
  {id:'level_10',icon:'🏆',title:'Cấp 10',test:()=>levelFromXP(getXP())>=10},
];
async function checkAchievements(){
  try{
    const stats=await computeInsights();
    let unlocked; try{ unlocked=JSON.parse(localStorage.getItem(ACH_LS)||'[]'); }catch(e){ unlocked=[]; }
    const set=new Set(unlocked); const newly=[];
    for(const a of ACHIEVEMENTS){ if(!set.has(a.id) && a.test(stats)){ set.add(a.id); newly.push(a); } }
    if(newly.length){
      localStorage.setItem(ACH_LS, JSON.stringify([...set]));
      newly.forEach((a,i)=>setTimeout(()=>toast('🏅 Mở khoá: '+a.title), i*900));
    }
    return {list:ACHIEVEMENTS, unlocked:set};
  }catch(e){ return {list:ACHIEVEMENTS, unlocked:new Set()}; }
}
function renderBadges(list, unlocked){
  let h='<div class="sec"><div class="sec-h"><span class="tile tile-sm amber">🏅</span>Huy hiệu</div><div class="badge-grid">';
  for(const a of list){
    const on=unlocked.has(a.id);
    h+='<div class="badge-item '+(on?'unlocked':'locked')+'"><div class="ico">'+(on?a.icon:'🔒')+'</div><div class="t">'+a.title+'</div></div>';
  }
  h+='</div></div>';
  return h;
}

/* ---------- one-time seed load ---------- */
/* ---------- seed sync: auto-merges any seed file listed in seed-files.txt ----------
   Add a new line to seed-files.txt whenever you upload another generator export
   (e.g. from a different browser/device) and this runs automatically on next open —
   no manual "Chọn file JSON để nạp" needed. Each file is only ever merged once
   (tracked by filename), and only NEW words are added — nothing already saved or
   edited locally is overwritten. */
async function syncSeedFiles(){
  try{
    const res=await fetch('./seed-files.txt'); if(!res.ok) return;
    const text=await res.text();
    const files=text.split(/\r?\n/).map(x=>x.trim()).filter(x=>x && !x.startsWith('#'));
    let merged; try{ merged=JSON.parse(localStorage.getItem(SEEDFILES_LS)||'[]'); }catch(e){ merged=[]; }
    const mergedSet=new Set(merged);
    let changed=false;
    for(const fname of files){
      if(mergedSet.has(fname)) continue;
      try{
        const r2=await fetch('./'+fname); if(!r2.ok) continue;
        const list=await r2.json();
        for(const data of list){
          if(!data||!data.word) continue;
          const w=norm(data.word);
          const existing=await idbGet(w);
          if(!existing) await idbPut({word:w, data, source:'seed', firstSeen:now(), saved:0, savedAt:0});
        }
        mergedSet.add(fname); changed=true;
      }catch(e){ /* this file failed — leave it untracked so we retry next time */ }
    }
    if(changed){ localStorage.setItem(SEEDFILES_LS, JSON.stringify([...mergedSet])); refreshStats(); }
  }catch(e){ /* seed-files.txt not present — nothing to sync, totally fine */ }
}

/* ============================================================
   GEMINI FALLBACK  (also the extraction prompt = your "step 1")
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
- forms: fill only if it's a single-word verb (put "" for the rest). Omit entirely if not a verb or if multi-word.
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
   FUZZY LOCAL MATCH — offline "did you mean", no AI call needed.
   Catches typos (Levenshtein) AND partial/reordered phrases like
   "rain dogs" -> "it's raining cats and dogs" (token overlap).
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
  const all=await idbAll(); let best=null,bestScore=0.6; // threshold
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
   SEARCH FLOW:  local/seed  →  AI fallback  →  cache back
   ============================================================ */
let currentWord=null;
async function search(rawWord, forceAI){
  const word=norm(rawWord||'');
  if(!word) return;
  $('#search-empty').style.display='none';
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

  // nothing close locally — need AI
  if(!getKey()){ box.innerHTML=needKeyState(word); return; }
  if(!navigator.onLine){ box.innerHTML=offlineState(word); return; }

  box.innerHTML='<div class="spinner"></div><div class="status">AI đang tra “'+esc(word)+'”…</div>';
  try{
    const data=await askGemini(word);
    const canon=norm(data.word||word);
    const rec={word:canon, data, source:'ai', firstSeen:now(), saved:0, savedAt:0};
    await idbPut(rec);
    if(canon!==word){
      // remember this typo/partial phrase — next time it's an instant offline hit
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

/* ---------- toggle save ---------- */
async function toggleSave(word){
  const rec=await idbGet(word); if(!rec) return;
  rec.saved=rec.saved?0:1;
  rec.savedAt=rec.saved?now():0;
  await idbPut(rec);
  if(currentWord===word){ const b=$('#result'); if(b) b.innerHTML=renderEntry(rec); }
  toast(rec.saved?'Đã lưu ⭐':'Đã bỏ lưu');
  logEvent(rec.saved?'save':'unsave', word);
  if(rec.saved) addXP(1);
  refreshStats();
}

/* ============================================================
   RENDER
   ============================================================ */
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function dots(rank){ const n=Math.max(0,Math.min(5,rank|0)); let o=''; for(let i=0;i<5;i++) o+= i<n?'●':'<span class="off">○</span>'; return o; }
const POS_ABBR={noun:'n.',verb:'v.',adjective:'adj.',adverb:'adv.',preposition:'prep.',conjunction:'conj.',pronoun:'pron.',interjection:'interj.',idiom:'idiom',slang:'slang',article:'art.'};
function posLabel(p){ if(!p) return ''; return POS_ABBR[String(p).toLowerCase()]||p; }

function renderEntry(rec, queriedAs){
  const d=rec.data||{}; const w=rec.word;
  const badge = rec.source==='ai'
    ? '<span class="badge ai">✦ AI · đã lưu offline</span>'
    : '<span class="badge off">◆ offline</span>';

  let h='<div class="entry">';
  if(queriedAs){
    h+='<div class="corrected">Đã tự sửa từ “'+esc(queriedAs)+'”'+(d.query_note?' · '+esc(d.query_note):'')+'</div>';
  }
  h+='<div class="head"><div>';
  h+='<div class="headword">'+esc(d.word||w)+'</div>';
  if(d.phonetic) h+='<div class="phon">'+esc(d.phonetic)+'</div>';
  h+=badge;
  h+='</div>';
  h+='<button class="star '+(rec.saved?'on':'')+'" onclick="toggleSave(\''+esc(w)+'\')" aria-label="Lưu">'+(rec.saved?'★':'☆')+'</button>';
  h+='</div>';

  if(d.vi_equivalent){
    h+='<div class="feel"><div class="tile violet">≈</div><div><div class="eq">'+esc(d.word||w)+' ≈ <b>'+esc(d.vi_equivalent)+'</b></div>';
    if(d.vi_note) h+='<div class="note">'+esc(d.vi_note)+'</div>';
    h+='</div></div>';
  }

  // verb forms
  const f=d.forms;
  if(f && (f.v2||f.v3||f.ving)){
    h+='<div class="forms">';
    h+=formCell('V1',f.v1||d.word||w); h+=formCell('V2',f.v2); h+=formCell('V3',f.v3);
    if(f.ving) h+=formCell('V-ing',f.ving);
    h+='</div>';
  }

  // senses
  if(Array.isArray(d.senses)&&d.senses.length){
    const ss=[...d.senses].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm violet">📘</span>Nghĩa · phổ biến nhất trước</div>';
    ss.forEach((s,i)=>{
      h+='<div class="sense"><div class="sense-top"><span class="senseno">'+(i+1)+'</span>';
      if(s.pos) h+='<span class="pos">'+esc(posLabel(s.pos))+'</span>';
      h+='<span class="rank">'+dots(s.rank)+'</span></div>';
      if(s.vi) h+='<div class="vi">'+esc(s.vi)+'</div>';
      if(s.gloss) h+='<div class="gloss">'+esc(s.gloss)+'</div>';
      if(s.example){ h+='<div class="ex">“'+esc(s.example)+'”'; if(s.example_vi) h+='<span class="evi">→ '+esc(s.example_vi)+'</span>'; h+='</div>'; }
      h+='</div>';
    });
    h+='</div>';
  }

  // expressions (legacy field — older cached entries only; new entries use the split fields below)
  if(Array.isArray(d.expressions)&&d.expressions.length){
    const es=[...d.expressions].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm blue">🔗</span>Cách dùng thường gặp</div>';
    for(const e of es){
      h+='<div class="expr"><span class="rank">'+dots(e.rank)+'</span><span class="t">'+esc(e.text)+'</span>';
      if(e.vi) h+='<span class="ev">'+esc(e.vi)+'</span>';
      h+='</div>';
    }
    h+='</div>';
  }

  // collocations
  if(Array.isArray(d.collocations)&&d.collocations.length){
    const cs=[...d.collocations].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm blue">🔗</span>Cụm từ hay đi cùng</div>';
    for(const c of cs){
      h+='<div class="expr"><span class="rank">'+dots(c.rank)+'</span><span class="t">'+esc(c.text)+'</span>';
      if(c.vi) h+='<span class="ev">'+esc(c.vi)+'</span>';
      h+='</div>';
    }
    h+='</div>';
  }

  // phrasal verbs
  if(Array.isArray(d.phrasal_verbs)&&d.phrasal_verbs.length){
    const ps=[...d.phrasal_verbs].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm mint">🧩</span>Cụm động từ (phrasal verb)</div>';
    for(const p of ps){
      h+='<div class="expr"><span class="rank">'+dots(p.rank)+'</span><span class="t">'+esc(p.text)+'</span>';
      if(p.vi) h+='<span class="ev">'+esc(p.vi)+'</span>';
      h+='</div>';
    }
    h+='</div>';
  }

  // idioms
  if(Array.isArray(d.idioms)&&d.idioms.length){
    const is_=[...d.idioms].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm coral">💬</span>Thành ngữ</div>';
    for(const it of is_){
      h+='<div class="expr"><span class="rank">'+dots(it.rank)+'</span><span class="t">'+esc(it.text)+'</span>';
      if(it.vi) h+='<span class="ev">'+esc(it.vi)+'</span>';
      h+='</div>';
    }
    h+='</div>';
  }

  // dependent prepositions
  if(Array.isArray(d.prepositions)&&d.prepositions.length){
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm amber">🧭</span>Giới từ đi kèm</div>';
    for(const p of d.prepositions){
      h+='<div class="prep-item"><div class="prep-w">'+esc(d.word||w)+' <b style="color:var(--amber)">'+esc(p.prep)+'</b></div>';
      if(p.meaning_vi) h+='<div class="prep-m">'+esc(p.meaning_vi)+'</div>';
      if(p.example){ h+='<div class="ex">"'+esc(p.example)+'"'; if(p.example_vi) h+='<span class="evi">→ '+esc(p.example_vi)+'</span>'; h+='</div>'; }
      h+='</div>';
    }
    h+='</div>';
  }

  // family
  if(Array.isArray(d.family)&&d.family.length){
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm pink">🌱</span>Gia đình từ</div><div class="chips">';
    for(const fm of d.family){ const fw=esc(fm.word||''); h+='<button class="chip tap" onclick="jump(\''+fw+'\')">'+fw+(fm.pos?' <span style="color:var(--muted-2)">·'+esc(fm.pos)+'</span>':'')+'</button>'; }
    h+='</div></div>';
  }

  // syn / ant
  if((d.synonyms&&d.synonyms.length)||(d.antonyms&&d.antonyms.length)){
    h+='<div class="sec"><div class="sec-h"><span class="tile tile-sm violet">⇄</span>Đồng nghĩa · trái nghĩa</div><div class="chips">';
    (d.synonyms||[]).forEach(x=>h+='<button class="chip tap" onclick="jump(\''+esc(x)+'\')">'+esc(x)+'</button>');
    (d.antonyms||[]).forEach(x=>h+='<button class="chip ant tap" onclick="jump(\''+esc(x)+'\')">'+esc(x)+'</button>');
    h+='</div></div>';
  }

  h+='</div>';
  return h;
}
function formCell(k,v){ return '<div class="form"><div class="k">'+k+'</div><div class="v">'+esc(v||'—')+'</div></div>'; }

function jump(w){ $('#q').value=w; search(w); window.scrollTo({top:0,behavior:'smooth'}); }

/* ---------- empty / error states ---------- */
function suggestState(query,guess){
  const label=esc(guess.label), target=guess.target, safeT=target.replace(/'/g,"\\'"), safeQ=query.replace(/'/g,"\\'");
  const kind = guess.type==='expr' ? ' <span style="color:var(--muted-2)">(trong “'+esc(target)+'”)</span>' : '';
  let h='<div class="empty"><div class="big">🤔</div><h3>Không có sẵn “'+esc(query)+'”</h3>';
  h+='<p>Có phải ý bạn là <b style="color:var(--text)">“'+label+'”</b>'+kind+'?</p></div>';
  h+='<button class="btn" onclick="jump(\''+safeT+'\')">Xem “'+esc(target)+'”</button>';
  h+='<button class="btn ghost sm" style="margin-top:8px" onclick="forceAI(\''+safeQ+'\')">Không — cứ tra nguyên văn bằng AI</button>';
  return h;
}
function needKeyState(w){ return '<div class="empty"><div class="big">🔑</div><h3>“'+esc(w)+'” chưa có trong máy</h3><p>Vào <b>Cài đặt</b> dán Gemini API key để AI tra giúp em, rồi từ đó lưu lại xài offline.</p></div>'; }
function offlineState(w){ return '<div class="empty"><div class="big">📴</div><h3>“'+esc(w)+'” chưa có sẵn</h3><p>Đang offline nên không nhờ AI được. Có mạng lại thử nhé — mấy từ đã tra rồi vẫn tra được offline.</p></div>'; }
function errorState(w,msg){
  let m='Có lỗi khi gọi AI.';
  if(msg.startsWith('BAD_KEY')) m='API key sai hoặc chưa bật. Kiểm tra lại trong Cài đặt.';
  else if(msg.startsWith('API')) m='Google trả lỗi: '+esc(msg.slice(4,120));
  else if(msg==='PARSE') m='AI trả về không đúng định dạng. Thử lại lần nữa.';
  else if(msg==='OFFLINE') return offlineState(w);
  return '<div class="empty"><div class="big">⚠️</div><h3>Không tra được “'+esc(w)+'”</h3><p>'+m+'</p></div>';
}

/* ============================================================
   SAVED / HISTORY
   ============================================================ */
async function renderSaved(){
  const all=(await idbAll()).filter(r=>r.saved).sort((a,b)=>b.savedAt-a.savedAt);
  const box=$('#saved-list');
  if(!all.length){ box.innerHTML='<div class="empty"><div class="big">⭐</div><h3>Chưa lưu từ nào</h3><p>Bấm ngôi sao ☆ ở một từ để lưu vào đây.</p></div>'; return; }
  const t=dayStart(now()), wk=t-6*DAY, mo=dayStart(now()-29*DAY);
  const groups={'Hôm nay':[],'7 ngày qua':[],'30 ngày qua':[],'Cũ hơn':[]};
  for(const r of all){ const s=dayStart(r.savedAt);
    if(s>=t)groups['Hôm nay'].push(r); else if(s>=wk)groups['7 ngày qua'].push(r);
    else if(s>=mo)groups['30 ngày qua'].push(r); else groups['Cũ hơn'].push(r); }
  let h='';
  for(const g in groups){ if(!groups[g].length) continue;
    h+='<div class="grp-h">'+g+' · '+groups[g].length+'</div>';
    for(const r of groups[g]){ const eq=r.data?.vi_equivalent||''; const w=esc(r.word);
      h+='<div class="row" onclick="jump(\''+w+'\')"><span class="w">'+w+'</span><span class="e">'+esc(eq)+'</span>'
       +'<button class="rm" onclick="event.stopPropagation();toggleSave(\''+w+'\')">★</button></div>'; }
  }
  box.innerHTML=h;
}

/* ============================================================
   REVIEW — type the English word from its Vietnamese meaning.
   ============================================================ */
let revQueue=[], revIdx=0, revState=null, revResults=[], revCorrectCount=0, revSessionAwarded=false;

function reviewPrompt(d){
  if(d.vi_equivalent) return d.vi_equivalent;
  const s0=(d.senses||[])[0];
  if(s0&&s0.vi) return s0.vi;
  if(s0&&s0.gloss) return s0.gloss;
  return '(chưa có nghĩa lưu sẵn)';
}
async function startReview(){
  const saved=(await idbAll()).filter(r=>r.saved);
  const area=$('#review-area');
  if(saved.length<1){ area.innerHTML='<div class="empty"><div class="big">✏️</div><h3>Chưa có gì để ôn</h3><p>Lưu vài từ trước đã, rồi quay lại đây gõ lại bằng tiếng Anh nhé.</p></div>'; return; }
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
    area.innerHTML='<div class="empty"><div class="big">✅</div><h3>Xong '+revQueue.length+' từ!</h3><p>Đúng '+revCorrectCount+'/'+revQueue.length+' · +10 XP hoàn thành lượt. Vào tab Thống kê để xem chi tiết.</p></div>'
      +'<button class="btn" onclick="startReview()">Ôn lượt mới</button>';
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
  h+='<div class="rev-progress">Từ '+(revIdx+1)+' / '+revQueue.length+'</div>';
  h+='<div class="rev-card">';
  h+='<div class="prompt">Từ tiếng Anh nào có nghĩa này?</div>';
  h+='<div class="q">'+esc(prompt)+'</div>';
  if(d.vi_note && !revState) h+='<div class="q-note">'+esc(d.vi_note)+'</div>';

  if(!revState){
    h+='<input id="rev-input" class="type-input" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Gõ từ tiếng Anh…"/>';
  } else {
    const cls = revState.correct ? (revState.close?'fb-close':'fb-correct') : 'fb-wrong';
    const icon = revState.correct ? (revState.close?'〰️':'✓') : '✕';
    const label = revState.correct ? (revState.close?'Gần đúng — chính tả đúng là:':'Chính xác!') : 'Đáp án đúng:';
    h+='<div class="rev-fb '+cls+'"><span class="fb-icon">'+icon+'</span> '+label+(revState.close||!revState.correct?' <b>'+esc(r.word)+'</b>':'')+'</div>';
    const s0=(d.senses||[])[0];
    if(s0&&s0.example) h+='<div class="ex" style="margin-top:10px">“'+esc(s0.example)+'”'+(s0.example_vi?'<span class="evi">→ '+esc(s0.example_vi)+'</span>':'')+'</div>';
  }
  h+='</div>';

  if(!revState){
    h+='<div class="btn-row" style="margin-top:12px"><button class="btn ghost" onclick="skipReview()">Không biết</button><button class="btn" onclick="checkReview()">Kiểm tra</button></div>';
  } else {
    h+='<button class="btn" onclick="nextReview()">Từ tiếp theo →</button>';
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
   THỐNG KÊ — usage patterns & gentle, specific encouragement.
   Everything below is computed from the on-device log; nothing
   is ever sent anywhere.
   ============================================================ */
const TIME_RANGES=[
  {name:'đêm khuya (0h–5h)', from:0, to:5},
  {name:'sáng sớm (5h–8h)', from:5, to:8},
  {name:'buổi sáng (8h–11h)', from:8, to:11},
  {name:'buổi trưa (11h–13h)', from:11, to:13},
  {name:'buổi chiều (13h–18h)', from:13, to:18},
  {name:'buổi tối (18h–22h)', from:18, to:22},
  {name:'đêm khuya (22h–24h)', from:22, to:24},
];
const WD=['CN','T2','T3','T4','T5','T6','T7'];

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

  const week=[]; for(let i=6;i>=0;i--){ const dd=today-i*DAY; const cnt=logs.filter(l=>dayStart(l.ts)===dd).length; week.push({dd,count:cnt}); }
  const maxWeek=Math.max(1,...week.map(w=>w.count));

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

  return {streak, hasToday, week, maxWeek, peakRange, peakPct, totalHourEvents,
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
    area.innerHTML='<div class="empty"><div class="big">📓</div><h3>Chưa đủ dữ liệu</h3><p>Tra và ôn thêm vài từ để em thấy thói quen học của mình ở đây.</p></div>';
    return;
  }

  let h='';
  // hero streak card
  h+='<div class="hero hero-compact">';
  h+='<div class="streak-n">'+s.streak+'</div>';
  h+='<div class="streak-l">ngày liên tiếp có hoạt động</div>';
  if(!s.hasToday && s.streak>0) h+='<div class="streak-warn">Hôm nay chưa có gì — tra hoặc ôn một từ để giữ chuỗi nhé.</div>';
  h+='</div>';

  // stat tiles
  h+='<div class="stat-grid">';
  h+='<div class="stat"><div class="tile violet">📖</div><div><div class="n">'+s.totalWords+'</div><div class="l">từ trong máy</div></div></div>';
  h+='<div class="stat"><div class="tile amber">⭐</div><div><div class="n">'+s.savedCount+'</div><div class="l">đã lưu</div></div></div>';
  h+='<div class="stat"><div class="tile mint">🎯</div><div><div class="n">'+(s.accuracy==null?'—':s.accuracy+'%')+'</div><div class="l">độ chính xác</div></div></div>';
  h+='</div>';

  // 7-day bars
  h+='<div class="sec"><div class="sec-h">7 ngày gần đây</div><div class="bars">';
  s.week.forEach(w=>{ const pct=Math.round(w.count/s.maxWeek*100); const wd=WD[new Date(w.dd).getDay()];
    h+='<div class="bar-col"><div class="bar-track"><div class="bar-fill" style="height:'+Math.max(4,pct)+'%"></div></div><div class="bar-lbl">'+wd+'</div></div>'; });
  h+='</div></div>';

  // insight cards — the "things you didn't know about yourself" section
  h+='<div class="sec"><div class="sec-h">Nhận ra gì về thói quen học</div>';
  if(s.peakRange && s.peakPct>=20){
    h+=insightCard('blue','🕒','Em học nhiều nhất vào '+s.peakRange.name,'Chiếm khoảng '+s.peakPct+'% số lần tra/ôn từ trước giờ.');
  }
  if(s.totalReview>=5 && s.accuracy!=null){
    const tone = s.accuracy>=80 ? 'Rất chắc tay!' : s.accuracy>=50 ? 'Ổn, còn có thể chắc hơn.' : 'Ôn thêm sẽ lên nhanh thôi.';
    h+=insightCard('mint','🎯','Độ chính xác khi ôn tập: '+s.accuracy+'%', tone+' ('+s.totalReview+' lượt trả lời)');
  }
  if(s.forgetful.length){
    const list=s.forgetful.map(f=>'<b>'+esc(f.word)+'</b> (sai '+f.reviewWrong+' lần)').join(', ');
    h+=insightCard('coral','🧠','Từ hay quên nhất', list);
  }
  if(s.lastWeekSearches>0){
    const diff=s.thisWeekSearches-s.lastWeekSearches;
    const pct=Math.round(Math.abs(diff)/s.lastWeekSearches*100);
    if(diff>0) h+=insightCard('amber','📈','Tuần này em tra nhiều hơn '+pct+'%', s.thisWeekSearches+' từ tuần này so với '+s.lastWeekSearches+' tuần trước.');
    else if(diff<0) h+=insightCard('amber','📉','Tuần này em tra ít hơn '+pct+'%', s.thisWeekSearches+' từ tuần này so với '+s.lastWeekSearches+' tuần trước — tra thêm vài từ nhé.');
  }
  if(s.savedNotReviewed>0){
    h+=insightCard('blue','📌','Còn '+s.savedNotReviewed+' từ đã lưu chưa ôn lần nào','Ghé tab Ôn tập để bắt đầu với mấy từ này.');
  }
  h+='</div>';

  const {list, unlocked}=await checkAchievements();
  h+=renderBadges(list, unlocked);

  area.innerHTML=h;
}
/* ---------- greeting hero (Search tab) ---------- */
function greetingText(){
  const h=new Date().getHours();
  if(h<5) return {greet:'Khuya rồi đó 🌙', sub:'Tranh thủ tra vài từ trước khi ngủ nhé.'};
  if(h<11) return {greet:'Chào buổi sáng 👋', sub:'Bắt đầu ngày mới với vài từ tiếng Anh nhé.'};
  if(h<13) return {greet:'Chào buổi trưa 👋', sub:'Giải lao chút, tra vài từ mới nào.'};
  if(h<18) return {greet:'Chào buổi chiều 👋', sub:'Tranh thủ giờ làm việc, học thêm chút vốn từ.'};
  return {greet:'Chào buổi tối 👋', sub:'Cuối ngày, ôn lại vài từ đã lưu nhé.'};
}
async function renderHero(){
  const greetEl=$('#hero-greet'), subEl=$('#hero-sub'), streakEl=$('#hero-streak');
  if(!greetEl) return;
  const g=greetingText();
  greetEl.textContent=g.greet;
  try{
    const logs=await logAll();
    const daySet=new Set(logs.map(l=>dayStart(l.ts)));
    const {streak, hasToday}=computeStreak(daySet);
    if(streak>0){
      streakEl.style.display='inline-flex';
      streakEl.innerHTML='🔥 <b>'+streak+'</b> ngày'+(hasToday?'':' — tra 1 từ để giữ chuỗi!');
      subEl.textContent = hasToday ? g.sub : 'Hôm nay chưa tra từ nào — giữ chuỗi '+streak+' ngày nhé!';
    } else {
      streakEl.style.display='none';
      subEl.textContent=g.sub;
    }
  }catch(e){ subEl.textContent=g.sub; }

  const xp=getXP(), lvl=levelFromXP(xp);
  const lvlEl=$('#hero-level'); if(lvlEl) lvlEl.innerHTML='⚡ Cấp '+lvl;
  const goal=getDailyGoal(), daily=getDailyXP();
  const pct=Math.max(0,Math.min(100, Math.round(daily/goal*100)));
  const bar=$('#hero-goal-bar'); if(bar) bar.style.width=pct+'%';
  const lbl=$('#hero-goal-lbl'); if(lbl) lbl.textContent='🎯 '+Math.min(daily,goal)+(daily>goal?'+':'')+'/'+goal+' XP hôm nay';
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
      const w=norm(data.word); const ex=await idbGet(w);
      await idbPut({word:w, data, source:'seed', firstSeen:ex?ex.firstSeen:now(), saved:ex?ex.saved:0, savedAt:ex?ex.savedAt:0});
      n++;
    }
    toast('Đã nạp '+n+' từ'); refreshStats();
  }catch(e){ toast('File JSON không hợp lệ'); }
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
  if(v==='search') renderHero();
  if(v==='saved') renderSaved();
  if(v==='review') startReview();
  if(v==='insights') renderInsights();
  if(v==='settings') refreshStats();
}

function wire(){
  const q=$('#q'), clearx=$('#clearx');
  q.addEventListener('input',()=>{ clearx.style.display=q.value?'block':'none'; });
  q.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); q.blur(); search(q.value); } });
  q.addEventListener('search',()=>{ if(q.value) search(q.value); });
  clearx.addEventListener('click',()=>{ q.value=''; clearx.style.display='none'; $('#result').innerHTML=''; $('#search-empty').style.display='block'; q.focus(); });

  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showView(t.dataset.view)));

  // settings prefill + save
  $('#key').value=getKey(); $('#model').value=getModel(); $('#goal').value=getDailyGoal();
  $('#save-settings').addEventListener('click',()=>{
    localStorage.setItem(KEY_LS,$('#key').value.trim());
    localStorage.setItem(MODEL_LS,($('#model').value.trim()||'gemini-2.5-flash'));
    setDailyGoal(+$('#goal').value||20);
    renderHero();
    const f=$('#settings-flash'); f.textContent='Đã lưu ✓'; setTimeout(()=>f.textContent='',1800);
  });
  $('#import-btn').addEventListener('click',()=>$('#import-file').click());
  $('#import-file').addEventListener('change',e=>{ if(e.target.files[0]) importSeedFile(e.target.files[0]); e.target.value=''; });
  $('#persist-btn').addEventListener('click',async()=>{
    const f=$('#persist-flash');
    if(navigator.storage&&navigator.storage.persist){ const ok=await navigator.storage.persist(); f.textContent=ok?'Đã bật — dữ liệu được giữ ✓':'iOS chưa cho, nhưng thêm app vào Home Screen sẽ giúp giữ dữ liệu.'; }
    else f.textContent='Trình duyệt không hỗ trợ (vẫn ổn khi thêm vào Home Screen).';
  });
  $('#clear-log-btn').addEventListener('click',async()=>{
    await logClearAll();
    const f=$('#clearlog-flash'); f.textContent='Đã xoá lịch sử hoạt động ✓'; setTimeout(()=>f.textContent='',1800);
    renderHero();
  });
}

/* ---------- service worker (offline) ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

/* ---------- boot ---------- */
(async function init(){
  wire();
  renderHero();
  await syncSeedFiles();
  refreshStats();
  logEvent('open', null);
  if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
  $('#q').focus();
})();
window.toggleSave=toggleSave; window.jump=jump; window.forceAI=forceAI;
window.startReview=startReview; window.checkReview=checkReview; window.skipReview=skipReview; window.nextReview=nextReview;
