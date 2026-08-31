/* ============================================================
   FOCCI STORY ENGINE — Arc 1–4
   Flat file at repo root. Loads after app.js (reuses its idb/log/
   XP/render helpers — see the README-style notes below) and after
   story-content.js (window.STORY_CONTENT).

   Hooks this file relies on from app.js, all already global there:
     $ esc norm now toast idbGet idbPut idbAll logEvent addXP
     getKey getModel fuzzyLocalSearch askGemini normalizeSpelling
     posChip levelTag loadLevels LEVEL_NAMES rankStar showView

   Hooks this file EXPOSES back into app.js (called from app.js):
     window.onWordSearched(word)   — logEvent() calls this for every
                                      'search' event, story or search-bar
     window.renderGameHub()        — showView('review') calls this
     window.renderArcSummaries()   — showView('saved') calls this
     window.renderTargetLevelUI()  — showView('settings') calls this

   PRIVACY OF THE SCORING ENGINE — per the sealed build brief:
   COLOR, GREY, WGT, IQS (IQ_score) and drift are tracked correctly
   below but NEVER rendered, logged to console, or described in any
   user-facing string anywhere in this file. Only COU/CAR/CLA/AGE are
   ever shown, as plain progress bars, and only at an arc's end.
   ============================================================ */
(function(){

const CONTENT = (window.STORY_CONTENT && window.STORY_CONTENT.arcs) || [];

/* ---------- flatten content once for linear + branch navigation ---------- */
const FLAT = [];
for(const arc of CONTENT) for(const ch of arc.chapters) for(const sc of ch.scenes)
  FLAT.push({ scene:sc, chapter:ch, arc:arc });
function idxOf(sceneId){ return FLAT.findIndex(x=>x.scene.id===sceneId); }
function entryOf(sceneId){ const i=idxOf(sceneId); return i<0?null:FLAT[i]; }
function chapterEntries(chapterId){ return FLAT.filter(x=>x.chapter.id===chapterId); }
const ARC_FINAL_CHAPTER = {}; // chapterId -> true if it's the last chapter of its arc
for(const arc of CONTENT){ const last=arc.chapters[arc.chapters.length-1]; if(last) ARC_FINAL_CHAPTER[last.id]=arc.id; }
function chapterById(id){ for(const arc of CONTENT) for(const ch of arc.chapters) if(ch.id===id) return ch; return null; }
function arcOfChapter(id){ for(const arc of CONTENT) for(const ch of arc.chapters) if(ch.id===id) return arc; return null; }

/* A light, human-readable "who you met" index — presentational only,
   used by the Saved-tab arc summary. Not part of the scoring model. */
const CHAPTER_CAST = {
  2:'Sil the cicada', 3:'Owen the crow', 5:'Vask the vulture', 6:'Ghar the crocodile',
  8:'Odd the gecko', 9:'Odd the gecko', 11:'Talla the old bird', 12:'Talla the old bird'
};

/* ---------- condition parsing: "key=value" / "key!=value" ---------- */
function condOk(cond, flags){
  if(!cond) return true;
  const m = String(cond).match(/^(\S+?)(!=|=)(\S+)$/);
  if(!m) return true;
  const key=m[1], op=m[2], raw=m[3];
  const val = raw==='true' ? true : raw==='false' ? false : raw;
  const actual = flags[key];
  return op==='=' ? actual===val : actual!==val;
}

/* ============================================================
   STATE — persisted to localStorage, never to IndexedDB (keeps
   the shared entries/log schema, and its DB_VER contract with
   generate.html, untouched).
   ============================================================ */
const STATE_LS = 'fc_g_state';
function defaultState(){
  return {
    v:1,
    pos: FLAT.length ? FLAT[0].scene.id : null,
    stats: { COU:0, CAR:0, CLA:0, AGE:0, COLOR:0, GREY:0, WGT:0, IQS:0 },
    drift: {},                 // chapterId -> consecutive-ish wrong COMP count
    flags: {},                 // arrow, D-xx, arc1Pivot, items live under `items`
    items: {},                 // cicadaShell, signpostArm, waterskinFull
    storyLog: {},              // sceneId -> { comp, iq, dec, presence:[bool,...] }
    decisions: [],             // [{sceneId, chapterId, arcId, kind, label, ts}] — for the Saved tab
    seenWords: [],             // every distinct word ever searched (story or bar)
    wordBankPending: [],       // newest, not yet banked
    wordBank: [],              // banked in batches of 10, reusable for future passages
    targetLevel: 4,            // 1..6, matches LEVEL_NAMES (A1..C2) — level the user wants to REACH
    currentLevel: 3,           // level the user is confident at RIGHT NOW
    dailyWordTarget: 10,       // new words/day goal — separate from the app's XP goal; drives Bonus Scene + passage-gen
    onboarded: false,          // true once the daily-target/level sliders have been set at least once
    currentLevelTouched: false,// gates the progressive reveal of the target-level slider
    passages: {},              // chapterId -> { sceneTexts:{sceneId:text}, mode:'ai'|'default', ts }
    arcCardShown: {},          // arcId -> true, so a finished arc's card doesn't replay on every reopen
    startedAt: Date.now(), lastPlayedAt: Date.now(),
  };
}
let _state=null;
function getState(){
  if(_state) return _state;
  try{
    const raw = localStorage.getItem(STATE_LS);
    _state = raw ? Object.assign(defaultState(), JSON.parse(raw)) : defaultState();
  }catch(e){ _state = defaultState(); }
  // merge-safety: an old save might predate a field added later
  const d = defaultState();
  for(const k in d) if(_state[k]===undefined) _state[k]=d[k];
  return _state;
}
function saveState(){
  _state.lastPlayedAt = Date.now();
  try{ localStorage.setItem(STATE_LS, JSON.stringify(_state)); }catch(e){}
}

/* ============================================================
   SCORING — D2 general rules + D3 pivot table (numbers live in
   story-content.js, applied verbatim here) + D6 modifiers.
   ============================================================ */
const VISIBLE_KEYS = ['COU','CAR','CLA','AGE'];
function applyDelta(delta){
  if(!delta) return;
  const st=getState();
  for(const k in delta) if(st.stats[k]!==undefined) st.stats[k]+=delta[k];
}
function setFlags(obj){ if(obj) Object.assign(getState().flags, obj); }
function bumpDrift(chapterId){
  const st=getState();
  st.drift[chapterId]=(st.drift[chapterId]||0)+1;
  if(st.drift[chapterId]>=3) st.flags['lost_'+chapterId]=true; // soft cosmetic hook only
}
function logDecision(scene, chapter, arc, kind, label){
  getState().decisions.push({ sceneId:scene.id, chapterId:chapter.id, arcId:arc.id, kind, label, ts:Date.now() });
}

function resolveComp(scene, chapter, arc, idx){
  const st=getState();
  const log = st.storyLog[scene.id] || (st.storyLog[scene.id]={});
  if(log.comp!=null) return log.compCorrect;              // already scored once — never twice
  const correct = idx===scene.comp.correct;
  applyDelta({ CLA: correct?1:-2 });
  if(!correct) bumpDrift(chapter.id);
  log.comp=idx; log.compCorrect=correct;
  saveState();
  return correct;
}
function resolveIq(scene, chapter, arc, idx){
  const st=getState();
  const log = st.storyLog[scene.id] || (st.storyLog[scene.id]={});
  if(log.iq!=null) return scene.iq.options[log.iq];
  const opt = scene.iq.options[idx];
  applyDelta(opt.delta);
  if(opt.flag) setFlags({[opt.flag]:true});
  log.iq=idx;
  saveState();
  return opt;
}
function resolveDec(scene, chapter, arc, idx){
  const st=getState();
  const log = st.storyLog[scene.id] || (st.storyLog[scene.id]={});
  if(log.dec!=null) return scene.dec.options[log.dec];
  const opt = scene.dec.options[idx];
  if(opt.requireItem && !st.items[opt.requireItem]) return null; // guarded in the UI too
  applyDelta(opt.delta);
  if(opt.setFlags) setFlags(opt.setFlags);
  if(opt.item) st.items[opt.item]=true;
  if(opt.consumeItem) st.items[opt.consumeItem]=false;
  if(opt.grey) applyDelta({GREY:1});
  log.dec=idx;
  if(opt.goto) st.pendingGoto=opt.goto;
  logDecision(scene, chapter, arc, scene.dec.pivot?'pivot':'dec', opt.label);
  saveState();
  return opt;
}
function resolvePresence(scene, chapter, arc, i){
  const st=getState();
  const log = st.storyLog[scene.id] || (st.storyLog[scene.id]={});
  if(!log.presence) log.presence=[];
  if(log.presence[i]) return false;                        // idempotent
  log.presence[i]=true;
  const weight = (scene.presence[i]&&scene.presence[i].weight)||1;
  applyDelta({ COLOR: weight });
  saveState();
  return true;
}

/* Dynamic caps, counted from whatever content actually exists — never a
   hardcoded "12 arcs" / "108 ✿". Arc 5–12 simply grow these numbers the
   day their content data lands here; nothing else changes. */
let _caps=null;
function computeCaps(){
  if(_caps) return _caps;
  let maxColor=0, maxStat=0;
  for(const {scene} of FLAT){
    if(scene.presence) for(const p of scene.presence) maxColor += (p.weight||1);
    const nodes=[];
    if(scene.comp) nodes.push([{delta:{CLA:1}}]);                       // best case = correct
    if(scene.iq) nodes.push(scene.iq.options);
    if(scene.dec) nodes.push(scene.dec.options);
    for(const opts of nodes){
      let best=0;
      for(const o of opts){ if(!o.delta) continue;
        for(const k of VISIBLE_KEYS) if(o.delta[k]!==undefined) best=Math.max(best,o.delta[k]); }
      maxStat += best;
    }
  }
  _caps = { maxColor: Math.max(1,maxColor), maxStat: Math.max(1,maxStat) };
  return _caps;
}

/* ============================================================
   SEALED — ending resolution (Part 2 of the brief). Implemented so
   the numbers are provably correct, but gated off entirely: it only
   ever runs once every arc the format defines exists, which isn't
   true yet, and its output is never displayed, logged, or described
   anywhere. Arc 10's library-collapse hard-lock is noted here as a
   TODO for when that content arrives, so it isn't forgotten.
   ============================================================ */
function isFullContentComplete(){ return CONTENT.length >= 12; } // false today, by design
function _sealedResolveEnding(){                                  // never called by any UI path yet
  if(!isFullContentComplete()) return null;
  const st=getState(), caps=computeCaps();
  const s=st.stats;
  const C=(s.COLOR/caps.maxColor)*100, AGE=(s.AGE/caps.maxStat)*100, CLA=(s.CLA/caps.maxStat)*100,
        CAR=(s.CAR/caps.maxStat)*100, COU=(s.COU/caps.maxStat)*100;
  // TODO(Arc 10): a library-ceiling-collapse event forces BROKEN_HOURGLASS
  // regardless of C, once that content exists — not reachable yet.
  if(C>=62) return (AGE>=55||s.IQS>=8) ? 'LETTER_WRITER' : 'SECOND_LAMP';
  if(C>=38){ if(CLA>=60) return 'BROKEN_HOURGLASS'; if(CAR>=60) return 'SECOND_LAMP'; return 'BROKEN_HOURGLASS'; }
  return (COU>=55) ? 'ASH' : 'THE_WAITER';
}

/* ============================================================
   WORD BANK — "every 10 new words" spaced-repetition accumulator.
   Runs completely silently; no toast, no badge, nothing shown.
   ============================================================ */
window.onWordSearched = function(rawWord){
  const w = norm(rawWord||'');
  if(!w) return;
  const st=getState();
  if(st.seenWords.includes(w)) return;                      // not new
  st.seenWords.push(w);
  st.wordBankPending.push(w);
  while(st.wordBankPending.length>=10){
    st.wordBank.push(...st.wordBankPending.splice(0,10));
  }
  saveState();
};

/* ============================================================
   PASSAGE GENERATION — 65% fixed core / 20% word-bank / 15% newest,
   at the Target Level, via Gemini 2.5 Flash Lite ONLY (never the
   model configured for dictionary lookups).
   ============================================================ */
const PASSAGE_MODEL = 'gemini-2.5-flash-lite';
function sampleWords(arr, n){
  if(!arr.length || n<=0) return [];
  const pool = arr.slice();
  const out=[];
  while(out.length<n && pool.length) out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  return out;
}
function levelName(lv){ return (window.LEVEL_NAMES && window.LEVEL_NAMES[lv]) || 'B1'; }

/* Word source for the 20%/30% bands: the app's own CEFR-ish frequency list
   (levels.txt), filtered to the user's current/target level — NOT the
   personal word-bank. A learner's "confident" and "reach-for" vocabulary is
   about proficiency band, not what they happen to have searched before. */
function bandWords(lv, n){
  const pool = (typeof wordsAtLevel==='function') ? wordsAtLevel(lv) : [];
  return sampleWords(pool, n);
}

function buildPassagePrompt(chapter, coreBlocks, currentWords, targetWords, currentLvName, targetLvName){
  const marker = (id)=>'### '+id+' ###';
  const core = coreBlocks.map(b=>marker(b.id)+'\n'+b.text).join('\n\n');
  return `You are lightly enriching an English reading passage for a language learner, WITHOUT changing its plot, meaning, or comprehension-question answers.

RULES (all mandatory):
1. Keep every scene block under its EXACT "### <id> ###" marker line, same ids, same order, same count. Never add, remove, merge, or rename a block.
2. The story content, character names, item names, and factual details in the ORIGINAL text below must all remain intact — a reader must still understand the same story the same way, and every comprehension-question answer must still hold. This core plot vocabulary is about 50% of the passage and is off-limits for substitution.
3. Naturally weave in some of these ${currentLvName}-level words (the reader is already comfortable around here — light review): ${currentWords.join(', ')||'(none available)'}. This band should land around 20% of the passage's vocabulary.
4. Naturally weave in some of these ${targetLvName}-level words (the reader is reaching for this level — a gentle stretch): ${targetWords.join(', ')||'(none available)'}. This band should land around 30% of the passage's vocabulary.
5. Words from both bands (3–4) should mostly describe things, events, actions, or feelings — a texture in the scene, something that happens, something Focci notices or feels — not plot mechanics, names, or facts the COMP/IQ questions depend on.
6. You may add 1–3 short descriptive sentences per block if that's genuinely needed to fit the words above naturally — but never change what happens, never change a character's choice or its outcome, and never touch the core vocabulary from rule 2.
7. Not every word in each list needs to appear — use judgment; a natural passage with 4–6 of them fitted well beats a stuffed one with all of them.
8. Output ONLY the rewritten blocks with their markers, nothing else — no preamble, no commentary, no markdown fences.

ORIGINAL:
${core}`;
}
async function askGeminiFlashLite(prompt){
  const key=getKey(); if(!key) throw new Error('NO_KEY');
  if(!navigator.onLine) throw new Error('OFFLINE');
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${PASSAGE_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.5}})});
  if(!res.ok) throw new Error('API:'+res.status);
  const data=await res.json();
  return (data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
}
function baseTextOf(scene){ return scene.en || ''; } // pre-branch base text; see file header note on variants
function parsePassageBlocks(raw, ids){
  const out={};
  const re=/###\s*([\w.\-]+)\s*###\s*([\s\S]*?)(?=###\s*[\w.\-]+\s*###|$)/g;
  let m;
  while((m=re.exec(raw))) out[m[1].trim()]=m[2].trim();
  for(const id of ids) if(!out[id]) return null;             // parse failed to cover every block — bail to defaults
  return out;
}
async function generateChapterPassage(chapterId){
  const st=getState();
  if(st.passages[chapterId]) return;                        // generate once per chapter arrival
  const ch = chapterById(chapterId); if(!ch) return;
  if(typeof loadLevels==='function'){ try{ await loadLevels(); }catch(e){} }
  const blocks = ch.scenes.filter(s=>s.en).map(s=>({id:s.id, text:baseTextOf(s)}));
  if(!blocks.length) return;
  const cur = bandWords(st.currentLevel, Math.max(2,Math.round(blocks.length*0.7)));   // ~20% band
  const tgt = bandWords(st.targetLevel,  Math.max(3,Math.round(blocks.length*1.0)));   // ~30% band
  try{
    const raw = await askGeminiFlashLite(buildPassagePrompt(ch, blocks, cur, tgt, levelName(st.currentLevel), levelName(st.targetLevel)));
    const parsed = parsePassageBlocks(raw, blocks.map(b=>b.id));
    st.passages[chapterId] = parsed
      ? { sceneTexts:parsed, mode:'ai', ts:Date.now() }
      : { sceneTexts:{}, mode:'default', ts:Date.now() };
  }catch(e){
    st.passages[chapterId] = { sceneTexts:{}, mode:'default', ts:Date.now() }; // graceful degrade
  }
  saveState();
}
function maybeGenerateAhead(justEnteredChapterId){
  const idx = CONTENT_CHAPTER_ORDER().indexOf(justEnteredChapterId);
  if(idx<0) return;
  const target = CONTENT_CHAPTER_ORDER()[idx+1];              // "gối đầu 1 nhịp": prep the one AFTER next
  if(target==null) return;
  if(getState().passages[target]) return;
  // fire-and-forget, silent, never blocks the UI
  generateChapterPassage(target).catch(()=>{});
}
let _chOrder=null;
function CONTENT_CHAPTER_ORDER(){
  if(_chOrder) return _chOrder;
  _chOrder=[]; for(const arc of CONTENT) for(const ch of arc.chapters) _chOrder.push(ch.id);
  return _chOrder;
}
function getSceneText(scene, chapterId){
  const st=getState();
  const p = st.passages[chapterId];
  if(p && p.mode==='ai' && p.sceneTexts[scene.id]) return p.sceneTexts[scene.id];
  // variant / base resolution, always the safe fallback
  if(scene.variant3If && condOk(scene.variant3If, st.flags)) return scene.variant3En;
  if(scene.variant2If && condOk(scene.variant2If, st.flags)) return scene.variant2En;
  if(scene.variantIf && condOk(scene.variantIf, st.flags)) return (scene.en||'') + (scene.variantEn?'\n\n'+scene.variantEn:'');
  return scene.en || '';
}

/* ============================================================
   VOCABULARY GOALS — daily word target + current/target level.
   Three long drag-sliders. The target-level slider only appears
   once the current-level slider has been touched for the first
   time (progressive reveal), per the requested interaction; after
   that first time it just shows normally, in Settings or anywhere
   else this component is rendered.
   ============================================================ */
function levelGoalsHTML(){
  const st=getState();
  const names = window.LEVEL_NAMES || {1:'A1',2:'A2',3:'B1',4:'B2',5:'C1',6:'C2'};
  let h='<div class="lvl-goals">';
  h+='<div class="lvl-row">'
    +'<div class="lvl-row-head"><span class="lvl-row-t">New words per day</span><span class="lvl-row-v" id="lg-daily-val">'+st.dailyWordTarget+'</span></div>'
    +'<input type="range" min="5" max="50" step="5" value="'+st.dailyWordTarget+'" class="lvl-slider" oninput="setDailyWordTarget(this.value)"/>'
    +'</div>';
  h+='<div class="lvl-row">'
    +'<div class="lvl-row-head"><span class="lvl-row-t">Your level right now</span><span class="lvl-row-v" id="lg-current-val">'+names[st.currentLevel]+'</span></div>'
    +'<input type="range" min="1" max="6" step="1" value="'+st.currentLevel+'" class="lvl-slider" oninput="setCurrentLevel(this.value)"/>'
    +'</div>';
  h+='<div class="lvl-row lvl-target-row'+(st.currentLevelTouched?'':' lvl-hidden')+'">'
    +'<div class="lvl-row-head"><span class="lvl-row-t">Level you want to reach</span><span class="lvl-row-v" id="lg-target-val">'+names[st.targetLevel]+'</span></div>'
    +'<input id="lg-target-slider" type="range" min="'+st.currentLevel+'" max="6" step="1" value="'+st.targetLevel+'" class="lvl-slider" oninput="setTargetLevelSlider(this.value)"/>'
    +'</div>';
  h+='</div>';
  return h;
}
window.setDailyWordTarget = function(v){
  getState().dailyWordTarget=+v; saveState();
  const el=document.getElementById('lg-daily-val'); if(el) el.textContent=v;
};
let _goalsContext=null; // 'onboarding' | 'settings' — whichever last rendered the sliders
window.setCurrentLevel = function(v){
  const st=getState(), names=window.LEVEL_NAMES||{1:'A1',2:'A2',3:'B1',4:'B2',5:'C1',6:'C2'};
  st.currentLevel=+v;
  const firstTime=!st.currentLevelTouched;
  st.currentLevelTouched=true;
  if(st.targetLevel<st.currentLevel) st.targetLevel=st.currentLevel;   // target never sits below current
  saveState();
  const lbl=document.getElementById('lg-current-val'); if(lbl) lbl.textContent=names[+v];
  if(firstTime){
    // reveal the target-level row for the first time — re-render wherever
    // this component was last shown (the static #level-goals-field div
    // always exists in the DOM, even off-screen in Settings, so presence
    // alone can't tell us which host is actually live right now)
    if(_goalsContext==='settings') window.renderTargetLevelUI();
    else renderOnboarding();
  } else {
    const tSlider=document.getElementById('lg-target-slider');
    if(tSlider){ tSlider.min=v; if(+tSlider.value<+v){ tSlider.value=v; window.setTargetLevelSlider(v); } }
  }
};
window.setTargetLevelSlider = function(v){
  getState().targetLevel=+v; saveState();
  const names=window.LEVEL_NAMES||{1:'A1',2:'A2',3:'B1',4:'B2',5:'C1',6:'C2'};
  const lbl=document.getElementById('lg-target-val'); if(lbl) lbl.textContent=names[+v];
};
window.renderTargetLevelUI = function(){
  const el=$('#level-goals-field'); if(!el) return;
  _goalsContext='settings';
  el.innerHTML=levelGoalsHTML();
};

/* ---------- one-time onboarding, shown the first time the Game tab
   is opened, in place of the hub, until the sliders above are saved ---------- */
function renderOnboarding(){
  const area=$('#review-area'); if(!area) return;
  _goalsContext='onboarding';
  let h='<div class="onboard-card">';
  h+='<img class="onboard-mascot" src="./mascot-headband.webp" alt="" onerror="this.style.display=\'none\'"/>';
  h+='<div class="onboard-t">Before Focci sets off…</div>';
  h+='<div class="onboard-s">A couple of quick settings — you can always change these later in Settings.</div>';
  h+='<div id="onboard-goals">'+levelGoalsHTML()+'</div>';
  h+='<button class="btn" onclick="finishOnboarding()">Let\'s go →</button>';
  h+='</div>';
  area.innerHTML=h;
}
window.finishOnboarding = function(){ getState().onboarded=true; saveState(); renderGameHub(); };

/* ============================================================
   WORD-TAP POPUP — reuses the app's own vocab pipeline. Never
   navigates views; a tap outside the sheet closes it instantly and
   the reader is exactly where they were.
   ============================================================ */
function tokenizeForTap(text){
  return esc(text).replace(/([A-Za-z][A-Za-z']*)/g, (m)=>{
    const clean=m.replace(/^'+|'+$/g,'');
    if(clean.length<2) return m;
    return '<span class="wtap" data-w="'+clean.toLowerCase()+'">'+m+'</span>';
  });
}
function ensureWordSheet(){
  let el=document.getElementById('word-sheet');
  if(el) return el;
  el=document.createElement('div');
  el.id='word-sheet';
  el.className='word-sheet';
  el.innerHTML='<div class="ws-backdrop"></div><div class="ws-card"><div class="ws-body" id="ws-body"></div></div>';
  document.body.appendChild(el);
  el.querySelector('.ws-backdrop').addEventListener('click', closeWordSheet);
  return el;
}
function closeWordSheet(){ const el=document.getElementById('word-sheet'); if(el) el.classList.remove('show'); }
function showWordSheet(html){
  const el=ensureWordSheet();
  el.querySelector('#ws-body').innerHTML=html;
  requestAnimationFrame(()=>el.classList.add('show'));
}
function condensedEntryHTML(rec){
  const d=rec.data||{}; const w=rec.word;
  let h='<div class="ws-head"><div class="ws-word">'+esc(d.word||w)+'</div>';
  if(typeof levelTag==='function') h+=levelTag(d.word||w);
  h+='</div>';
  if(d.phonetic) h+='<div class="ws-phon">'+esc(d.phonetic)+'</div>';
  const pos=[...new Set((d.senses||[]).map(s=>s.pos).filter(Boolean))];
  if(pos.length) h+='<div class="ws-pos">'+pos.map(posChip).join('')+'</div>';
  h+='<div class="ws-vi">'+(d.vi_equivalent?esc(d.vi_equivalent):'<i>không có từ tương đương</i>')+'</div>';
  const s0=(d.senses||[])[0];
  if(s0&&s0.vi && s0.vi!==d.vi_equivalent) h+='<div class="ws-sense">'+esc(s0.vi)+'</div>';
  if(d.collocations&&d.collocations.length) h+='<div class="ws-colloc">'+esc(d.collocations[0].text)+'</div>';
  h+='<button class="ws-full" onclick="closeWordSheet(); showView(\'home\'); search(\''+esc(w).replace(/'/g,"\\'")+'\');">See full entry →</button>';
  return h;
}
function loadingSheetHTML(w){ return '<div class="ws-word">'+esc(w)+'</div><div class="ws-loading">Focci is charting this one…</div>'; }
function needKeySheetHTML(w){ return '<div class="ws-word">'+esc(w)+'</div><div class="ws-loading">Add a Gemini key in Settings to look this up.</div>'; }
function offlineSheetHTML(w){ return '<div class="ws-word">'+esc(w)+'</div><div class="ws-loading">Offline right now — try again once connected.</div>'; }
function errorSheetHTML(w,msg){ return '<div class="ws-word">'+esc(w)+'</div><div class="ws-loading">Couldn\'t look that up ('+esc((msg||'').slice(0,40))+').</div>'; }

async function openWordPopup(rawWord){
  let word = norm(normalizeSpelling(rawWord||''));
  if(!word) return;
  showWordSheet(loadingSheetHTML(word));
  try{
    let rec = await idbGet(word);
    if(rec && rec.alias) rec = await idbGet(rec.alias);
    if(!rec){
      const guess = await fuzzyLocalSearch(word);
      if(guess) rec = await idbGet(guess.target);
    }
    if(!rec){
      if(!getKey()){ showWordSheet(needKeySheetHTML(word)); return; }
      if(!navigator.onLine){ showWordSheet(offlineSheetHTML(word)); return; }
      const data = await askGemini(word);
      const canon = norm(data.word||word);
      rec = { word:canon, data, source:'ai', firstSeen:Date.now(), saved:0, savedAt:0 };
      await idbPut(rec);
      if(canon!==word) await idbPut({ word, alias:canon, firstSeen:Date.now(), saved:0, savedAt:0 });
    }
    await logEvent('search', rec.word);   // same table as the search bar — unifies history + fires word-bank hook
    addXP(1);
    showWordSheet(condensedEntryHTML(rec));
  }catch(err){
    showWordSheet(errorSheetHTML(word, err.message||''));
  }
}
window.openWordPopup = openWordPopup;
window.closeWordSheet = closeWordSheet;

/* ============================================================
   PROP TAPS — decorative environment taps (other-*). Flavour only,
   no scoring; a short caption, dismissed on next tap or timeout.
   ============================================================ */
window.tapProp = function(btn, name){
  const cap = document.createElement('div');
  cap.className='prop-cap';
  cap.textContent = name.replace(/^other-/,'').replace(/-/g,' ');
  btn.appendChild(cap);
  setTimeout(()=>cap.remove(), 1600);
};

/* ============================================================
   NAVIGATION
   ============================================================ */
function currentEntry(){ return entryOf(getState().pos); }
function nextValidIndex(fromIdx){
  const st=getState();
  let i=fromIdx+1;
  while(i<FLAT.length){ if(condOk(FLAT[i].scene.onlyIf, st.flags)) return i; i++; }
  return -1;
}
function onChapterCompleted(prevChapterId, newChapterId){
  maybeGenerateAhead(newChapterId);
}
function advance(){
  const st=getState();
  const cur=currentEntry(); if(!cur) return;
  let targetIdx=-1;
  if(st.pendingGoto){
    const gi=idxOf(st.pendingGoto);
    st.pendingGoto=null;
    if(gi>=0) targetIdx = condOk(FLAT[gi].scene.onlyIf, st.flags) ? gi : nextValidIndex(gi-1);
  } else if(cur.scene.gotoChapter){
    const ch = chapterById(cur.scene.gotoChapter);
    if(ch && ch.scenes[0]) targetIdx = idxOf(ch.scenes[0].id);
  } else {
    targetIdx = nextValidIndex(idxOf(cur.scene.id));
  }
  if(targetIdx<0){
    // Out of built content entirely — but the chapter just finished might
    // still owe its own arc-end card before the To-be-continued screen.
    const finishedArc = ARC_FINAL_CHAPTER[cur.chapter.id];
    if(finishedArc && !st.arcCardShown[finishedArc]){
      st.arcCardShown[finishedArc]=true; saveState();
      renderArcEndCard(finishedArc, true);
      return;
    }
    renderStoryTBC(); saveState(); return;
  }
  const landed = FLAT[targetIdx];
  const prevChapterId = cur.chapter.id, newChapterId = landed.chapter.id;
  st.pos = landed.scene.id;
  if(newChapterId!==prevChapterId){
    onChapterCompleted(prevChapterId, newChapterId);
    if(landed.chapter.onEnterFlags) setFlags(landed.chapter.onEnterFlags);
    if(landed.scene.onEnterFlags) setFlags(landed.scene.onEnterFlags);
    saveState();
    const finishedArc = ARC_FINAL_CHAPTER[prevChapterId];
    if(finishedArc && !st.arcCardShown[finishedArc]){
      st.arcCardShown[finishedArc]=true; saveState();
      renderArcEndCard(finishedArc);
      return;
    }
  } else {
    if(landed.scene.onEnterFlags) setFlags(landed.scene.onEnterFlags);
    saveState();
  }
  renderStory();
}
window.advanceStory = advance;

/* ============================================================
   RENDERING — the scene itself
   ============================================================ */
function assetUrl(name){ return name ? './'+name+'.webp' : ''; }
function isRequiredAnswered(scene){
  const log = getState().storyLog[scene.id] || {};
  if(scene.comp && log.comp==null) return false;
  if(scene.iq && log.iq==null) return false;
  if(scene.dec && log.dec==null) return false;
  return true;
}
function optionDisabled(scene, opt){
  return !!(opt.requireItem && !getState().items[opt.requireItem]);
}

function renderCompBlock(scene, chapter, arc){
  const log=getState().storyLog[scene.id]||{};
  let h='<div class="q-card q-comp"><div class="q-kicker">Check</div><div class="q-text">'+esc(scene.comp.q)+'</div><div class="q-opts">';
  scene.comp.options.forEach((opt,i)=>{
    const answered = log.comp!=null;
    let cls='q-opt';
    if(answered){ if(i===log.comp) cls += log.compCorrect?' right':' wrong'; if(i===scene.comp.correct && !log.compCorrect) cls+=' reveal'; }
    h+='<button class="'+cls+'" '+(answered?'disabled':'')+' onclick="storyAnswerComp(\''+scene.id+'\','+i+')">'+esc(opt)+'</button>';
  });
  h+='</div>';
  if(log.comp!=null) h+='<div class="q-fb '+(log.compCorrect?'ok':'bad')+'">'+(log.compCorrect?'Correct.':'Not quite — the passage says otherwise.')+'</div>';
  return h+'</div>';
}
function renderIqBlock(scene, chapter, arc){
  const log=getState().storyLog[scene.id]||{};
  let h='<div class="q-card q-iq"><div class="q-kicker">🧩 Puzzle</div><div class="q-text">'+esc(scene.iq.q)+'</div><div class="q-opts">';
  scene.iq.options.forEach((opt,i)=>{
    const answered = log.iq!=null;
    let cls='q-opt';
    if(answered && i===log.iq) cls += opt.tag==='ok' ? ' right' : opt.tag==='bad' ? ' wrong' : ' neutral';
    h+='<button class="'+cls+'" '+(answered?'disabled':'')+' onclick="storyAnswerIq(\''+scene.id+'\','+i+')">'+esc(opt.label)+'</button>';
  });
  h+='</div>';
  if(log.iq!=null) h+='<div class="q-fb '+(scene.iq.options[log.iq].tag==='ok'?'ok':scene.iq.options[log.iq].tag==='bad'?'bad':'neutral')+'">'+esc(scene.iq.options[log.iq].note||'')+'</div>';
  return h+'</div>';
}
function renderDecBlock(scene, chapter, arc){
  const log=getState().storyLog[scene.id]||{};
  let h='<div class="q-card q-dec'+(scene.dec.pivot?' q-pivot':'')+'">';
  if(scene.dec.pivot) h+='<div class="q-kicker pivot">⭐ A moment that matters</div>';
  if(scene.dec.q) h+='<div class="q-text">'+esc(scene.dec.q)+'</div>';
  h+='<div class="q-opts vertical">';
  scene.dec.options.forEach((opt,i)=>{
    const answered = log.dec!=null;
    const disabled = optionDisabled(scene, opt);
    let cls='q-opt dec-opt';
    if(answered && i===log.dec) cls+=' chosen';
    let title = disabled && opt.missingNote ? ' title="'+esc(opt.missingNote)+'"' : '';
    h+='<button class="'+cls+'" '+((answered||disabled)?'disabled':'')+title+' onclick="storyAnswerDec(\''+scene.id+'\','+i+')">'+esc(opt.label)+'</button>';
  });
  h+='</div>';
  if(log.dec!=null && scene.dec.options[log.dec].outcome) h+='<div class="q-fb neutral">'+esc(scene.dec.options[log.dec].outcome)+'</div>';
  return h+'</div>';
}
function renderPresenceBlock(scene, chapter, arc){
  const log=getState().storyLog[scene.id]||{};
  let h='<div class="presence-row">';
  scene.presence.forEach((p,i)=>{
    const done = log.presence && log.presence[i];
    h+='<button class="presence-btn'+(done?' done':'')+'" onclick="storyAnswerPresence(\''+scene.id+'\','+i+')">'
      +'<span class="pb-ico">'+(done?'✿':'❁')+'</span><span class="pb-txt">'+esc(p.text)+'</span></button>';
  });
  return h+'</div>';
}

/* Props can be a plain asset-name string (back layer, default) or an
   {name, layer} object — kept flexible so existing scenes never need
   rewriting just to gain a front-layer item somewhere else. */
function normalizeProps(list){
  if(!list) return [];
  return list.map(p => typeof p==='string' ? {name:p} : p).filter(p=>p&&p.name);
}
function propsLayerHTML(list, layer){
  let h='<div class="story-props story-props-'+layer+'">';
  list.forEach(p=>h+='<button class="story-prop" onclick="tapProp(this,\''+esc(p.name)+'\')"><img src="'+assetUrl(p.name)+'" alt="" onerror="this.style.display=\'none\'"/></button>');
  return h+'</div>';
}
/* Pure-CSS ambient texture per chapter mood — no image assets needed, so
   this always renders even before any real art is uploaded. BRIGHT gets
   a few soft floating motes, DARK gets slower, dimmer drifting dust, and
   SHOCK gets a single quick vignette pulse on scene entry. */
function ambientLayerHTML(mood){
  const counts = { bright:7, dark:6, shock:0 };
  const n = counts[mood]!=null ? counts[mood] : 5;
  let h='<div class="story-amb amb-'+mood+'">';
  for(let i=0;i<n;i++){
    const left = Math.round(Math.random()*94)+2;
    const delay = (Math.random()*4).toFixed(2);
    const dur = (5+Math.random()*4).toFixed(2);
    h+='<span class="amb-p" style="left:'+left+'%;animation-delay:-'+delay+'s;animation-duration:'+dur+'s"></span>';
  }
  return h+'</div>';
}

function renderStory(){
  const area=$('#review-area'); if(!area) return;
  const cur=currentEntry();
  if(!cur){ renderStoryTBC(); return; }
  const { scene, chapter, arc } = cur;
  if(scene.endOfBuiltContent){ /* still render it once, then Continue leads to TBC */ }

  let h='<div class="story-view">';
  h+='<div class="story-top"><button class="story-quit" onclick="renderGameHub()">✕</button>'
    +'<div class="story-top-t">Arc '+arc.id+' · '+esc(chapter.title)+'</div></div>';

  const bg = scene.bg || arc.bg;
  const mood = (chapter.mood||'BRIGHT').toLowerCase();
  h+='<div class="story-stage mood-'+mood+'" style="background-image:url(\''+assetUrl(bg)+'\')">';
  h+=ambientLayerHTML(mood);
  // "back" props sit behind Focci (distant scenery/items); a scene can also
  // list propsFront for things that should visually sit IN FRONT of him
  // (tall grass, mist, hanging vines…) — same tap/no-op-if-missing behaviour,
  // just stacked the other side of the mascot layer for a bit of depth.
  const backProps = normalizeProps(scene.props);
  const frontProps = normalizeProps(scene.propsFront);
  if(backProps.length) h+=propsLayerHTML(backProps, 'back');
  if(scene.mascot) h+='<img class="story-mascot" src="'+assetUrl(scene.mascot)+'" alt="" onerror="this.style.display=\'none\'"/>';
  if(frontProps.length) h+=propsLayerHTML(frontProps, 'front');
  h+='</div>';

  h+='<div class="story-page">';
  h+='<div class="story-title">'+esc(scene.title||'')+'</div>';
  h+='<div class="story-passage" id="story-passage-'+scene.id.replace('.','-')+'">'+tokenizeForTap(getSceneText(scene, chapter.id))+'</div>';
  if(scene.comp) h+=renderCompBlock(scene, chapter, arc);
  if(scene.iq) h+=renderIqBlock(scene, chapter, arc);
  if(scene.dec) h+=renderDecBlock(scene, chapter, arc);
  if(scene.presence && scene.presence.length) h+=renderPresenceBlock(scene, chapter, arc);
  const ready=isRequiredAnswered(scene);
  h+='<button class="btn story-continue" '+(ready?'':'disabled')+' onclick="advanceStory()">'
    +(scene.endOfBuiltContent?'Continue':'Continue →')+'</button>';
  h+='</div></div>';

  area.innerHTML=h;
  wireWordTaps();
}
function wireWordTaps(){
  const area=$('#review-area'); if(!area || area._wtapWired) return;
  area._wtapWired=true;
  area.addEventListener('click', (e)=>{
    const t=e.target.closest('.wtap'); if(t) openWordPopup(t.dataset.w);
  });
}

/* answer handlers, called from onclick */
window.storyAnswerComp = function(sceneId, idx){ const e=entryOf(sceneId); if(!e) return; resolveComp(e.scene,e.chapter,e.arc,idx); renderStory(); };
window.storyAnswerIq   = function(sceneId, idx){ const e=entryOf(sceneId); if(!e) return; resolveIq(e.scene,e.chapter,e.arc,idx); renderStory(); };
window.storyAnswerDec  = function(sceneId, idx){ const e=entryOf(sceneId); if(!e) return; resolveDec(e.scene,e.chapter,e.arc,idx); renderStory(); };
window.storyAnswerPresence = function(sceneId, idx){ const e=entryOf(sceneId); if(!e) return; resolvePresence(e.scene,e.chapter,e.arc,idx); renderStory(); };

/* ---------- arc-end card: 4 visible stat bars only ---------- */
function renderArcEndCard(arcId){
  const area=$('#review-area'); if(!area) return;
  const st=getState(), caps=computeCaps();
  const arc = CONTENT.find(a=>a.id===arcId);
  const pivotDecision = st.decisions.slice().reverse().find(d=>d.arcId===arcId && d.kind==='pivot');
  const arcWords = st.seenWords.length; // running total; good enough as "words met" signal without a per-arc log
  let h='<div class="arc-card">';
  h+='<img class="arc-card-mascot" src="./mascot-withflag-1.webp" alt="" onerror="this.style.display=\'none\'"/>';
  h+='<div class="arc-card-t">Arc '+arcId+' complete</div>';
  h+='<div class="arc-card-s">'+esc(arc?arc.title:'')+'</div>';
  h+='<div class="arc-bars">';
  VISIBLE_KEYS.forEach(k=>{
    const pct=Math.max(0,Math.min(100, Math.round((st.stats[k]/caps.maxStat)*100)));
    const names={COU:'Courage',CAR:'Compassion',CLA:'Clarity',AGE:'Autonomy'};
    h+='<div class="arc-bar-row"><span class="abr-l">'+names[k]+'</span><div class="abr-track"><i style="width:'+pct+'%"></i></div></div>';
  });
  h+='</div>';
  if(pivotDecision) h+='<div class="arc-card-pivot"><b>Your call:</b> '+esc(pivotDecision.label)+'</div>';
  h+='<button class="btn" onclick="openStory()">Continue →</button>';
  h+='</div>';
  area.innerHTML=h;
}

/* ---------- "to be continued" ---------- */
function renderStoryTBC(){
  const area=$('#review-area'); if(!area) return;
  const st=getState(), caps=computeCaps();
  let h='<div class="arc-card tbc">';
  h+='<img class="arc-card-mascot" src="./mascot-withflag-2.webp" alt="" onerror="this.style.display=\'none\'"/>';
  h+='<div class="arc-card-t">To be continued…</div>';
  h+='<div class="arc-card-s">Arcs 5–12 aren\'t built yet — but everything you\'ve done so far is saved.</div>';
  h+='<div class="arc-bars">';
  VISIBLE_KEYS.forEach(k=>{
    const pct=Math.max(0,Math.min(100, Math.round((st.stats[k]/caps.maxStat)*100)));
    const names={COU:'Courage',CAR:'Compassion',CLA:'Clarity',AGE:'Autonomy'};
    h+='<div class="arc-bar-row"><span class="abr-l">'+names[k]+'</span><div class="abr-track"><i style="width:'+pct+'%"></i></div></div>';
  });
  h+='</div>';
  h+='<button class="btn ghost" onclick="renderGameHub()">Back to Games</button>';
  h+='</div>';
  area.innerHTML=h;
}

/* ============================================================
   GAME HUB — replaces the old "jump straight into practice" tab
   entry. Three compact cards: the story, and the two mini-games,
   plus a locked Bonus Scene strip below.
   ============================================================ */
function openStory(){ renderStory(); }
window.openStory = openStory;

function storyProgressLabel(){
  const cur=currentEntry();
  if(!cur) return 'Not started';
  return 'Arc '+cur.arc.id+' · '+cur.chapter.title;
}
function isStoryStarted(){ return Object.keys(getState().storyLog).length>0; }

window.renderGameHub = function(){
  const area=$('#review-area'); if(!area) return;
  if(!getState().onboarded){ renderOnboarding(); return; }
  const st=getState(), caps=computeCaps();
  let h='<div class="game-hub">';

  h+='<button class="hub-card hub-story" onclick="openStory()">'
    +'<div class="hub-story-top"><span class="hub-tag">MAIN STORY</span></div>'
    +'<div class="hub-story-t">Focci\'s Journey</div>'
    +'<div class="hub-story-s">'+esc(storyProgressLabel())+'</div>'
    +'<div class="hub-mini-bars">'+VISIBLE_KEYS.map(k=>{
        const pct=Math.max(2,Math.min(100, Math.round((st.stats[k]/caps.maxStat)*100)));
        return '<i style="width:'+pct+'%"></i>';
      }).join('')+'</div>'
    +'<span class="hub-cta">'+(isStoryStarted()?'Continue →':'Play →')+'</span>'
    +'</button>';

  h+='<div class="hub-row">';
  h+='<button class="hub-card hub-mini" onclick="setPracticeMode(\'type\')"><span class="hub-mini-ico">✍️</span><span class="hub-mini-t">Type it</span></button>';
  h+='<button class="hub-card hub-mini" onclick="setPracticeMode(\'match\')"><span class="hub-mini-ico">🎯</span><span class="hub-mini-t">Match it</span></button>';
  h+='</div>';

  h+=renderBonusStrip();
  h+='</div>';
  area.innerHTML=h;
};

/* ---------- Bonus Scene — layout + lock state only, per the brief;
   the actual sequel content isn't written yet. ---------- */
function bonusUnlockedToday(){
  try{
    return (window.__todaysCountCache||0) >= getState().dailyWordTarget;
  }catch(e){ return false; }
}
function renderBonusStrip(){
  const unlocked = bonusUnlockedToday();
  let h='<div class="bonus-strip'+(unlocked?' unlocked':'')+'">';
  h+='<div class="bonus-head"><span class="bonus-ico">'+(unlocked?'🔓':'🔒')+'</span><span class="bonus-t">Bonus Scene</span></div>';
  h+='<div class="bonus-s">'+(unlocked
      ? 'Unlocked for today — a short sequel to an arc you\'ve finished.'
      : 'Hit today\'s word goal to unlock a short sequel scene.')+'</div>';
  h+='<div class="bonus-cards">';
  for(let i=1;i<=3;i++){
    h+='<div class="bonus-card'+(unlocked?'':' locked')+'"><span class="bc-ico">'+(unlocked?'▶':'🔒')+'</span><span class="bc-t">Coming soon</span></div>';
  }
  h+='</div></div>';
  return h;
}
// keep the lock check fresh without forcing every hub render to be async
if(typeof todaysActivityCount==='function'){
  todaysActivityCount().then(n=>{ window.__todaysCountCache=n; }).catch(()=>{});
}

/* ============================================================
   SAVED TAB — personalised arc summaries, above the existing
   saved-words list. Combines the content's own life-lessons/cast
   with the user's actual decision log.
   ============================================================ */
window.renderArcSummaries = function(){
  const host = document.getElementById('arc-summaries');
  if(!host) return;
  const st=getState();
  const touchedArcs = new Set(st.decisions.map(d=>d.arcId));
  const cur=currentEntry(); if(cur) touchedArcs.add(cur.arc.id);
  if(!touchedArcs.size){ host.innerHTML=''; return; }

  let h='<div class="arc-sum-head">Your Journey</div>';
  [...touchedArcs].sort().forEach(arcId=>{
    const arc = CONTENT.find(a=>a.id===arcId); if(!arc) return;
    const decs = st.decisions.filter(d=>d.arcId===arcId);
    const pivot = decs.slice().reverse().find(d=>d.kind==='pivot');
    const cast = [...new Set(arc.chapters.map(c=>CHAPTER_CAST[c.id]).filter(Boolean))];
    h+='<details class="arc-sum-card"><summary><span class="acc-t">Arc '+arcId+' · '+esc(arc.title)+'</span><span class="acc-x">▾</span></summary><div class="acc-body">';
    if(cast.length) h+='<div class="arc-sum-row"><b>Met:</b> '+cast.map(esc).join(', ')+'</div>';
    if(pivot) h+='<div class="arc-sum-row"><b>Your call:</b> '+esc(pivot.label)+'</div>';
    if(decs.length) h+='<div class="arc-sum-row"><b>Decisions:</b> '+decs.length+'</div>';
    h+='</div></details>';
  });
  host.innerHTML=h;
};

/* ============================================================
   INIT — nothing to boot eagerly; the hub/settings hooks above
   are called on-demand by app.js's showView().
   ============================================================ */

})();
