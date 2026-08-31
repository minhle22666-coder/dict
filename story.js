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
     window.renderGameHub()        — showView('review') calls this (includes the World Map)
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

/* HOTSPOTS — the world you can poke at.
   Two flavors of tap-target render exactly the same way, on purpose:
   - "lore" props are the real objects already woven into that scene
     (the hourglass, Ghar's rope, the eight symbols) — tapping one gives a
     short in-world detail about THAT thing.
   - "noise" props are ambient clutter with no bearing on anything — tapping
     one just gives a small, unrelated fun fact. There is no visual, textual,
     or timing difference between the two; which is which is never revealed. */
const PROP_LORE = {
  'other-bag':"The strap's gone soft with wear — years of a hand, not weeks.",
  'other-hourglass':"The sand keeps disobeying gravity. Whoever owned this stopped trusting it a while ago.",
  'other-envelope':"No name, no address. Sealed like it was meant for exactly one reader, someday.",
  'other-counter':"A small window, a smaller number. It only counts what gets named out loud.",
  'other-path-map':"Two ruts worn into the dirt, no signs. Someone else already had to guess.",
  'other-cicada-1':"Up close, the wings look like they were cut from a broken bottle.",
  'other-tree-trunk':"Bark this dry has been standing through more than one summer alone.",
  'other-wagon':"Six sets of wheel-ruts, one direction. Someone's making good time.",
  'other-badger':"Doesn't look up from the reins. Been down this road too many times to be curious anymore.",
  'other-beetle':"Six legs, unhurried. It has nowhere in particular to be either.",
  'other-moon-clouds':"The light comes and goes as the clouds decide, not the moon.",
  'other-cicada-2':"Hollow all the way through. Whatever was inside left cleanly.",
  'other-bird-nest':"Lined with something shiny that isn't grass. Somebody's been collecting.",
  'other-bread-bag':"Still warm at the bottom. Fresh enough to feel a little undeserved.",
  'other-signpost':"One arm confident, one arm missing. The stump doesn't explain itself.",
  'other-cactus':"Spines this size aren't for show. Something out here has learned to respect them.",
  'other-red-rocks':"Hot enough at midday to cook on, cold enough at night to hurt bare feet.",
  'other-skeleton':"Ribs in order, skull to the east. Somebody set a table here once.",
  'other-sand-dunes':"The ripples all lean the same way — one wind, blowing a very long time.",
  'other-well':"Worn smooth exactly where forearms rest. A lot of thirsty mornings, one shape.",
  'other-bucket':"A rope-burn on the handle in the same place, over and over.",
  'other-notebook':"The ink's gone patchy where a thumb keeps landing on the same page.",
  'other-rock-formation':"Stacked just a little too neatly to be an accident of weather.",
  'other-rope':"Frayed at one end like something heavy pulled hard, more than once.",
  'other-crocodile-1':"Skin cracked into a map of somewhere that used to be underwater.",
  'other-footprints':"Small, fresh, and already gone — whoever left them wasn't waiting around.",
  'other-smoke':"Steady and thin. Not the kind that means anything's going wrong.",
  'other-vine':"Thick enough to hold weight, if you didn't know better and tried.",
  'other-chameleon':"Doesn't bother changing color for you. You're not the interesting part of its day.",
  'other-parchment':"Corners curled from being rolled and unrolled more than it was ever meant to be.",
  'other-tree':"Old enough that whatever it's seen, it's stopped reacting to.",
  'other-droplet':"Took its time falling. Some kind of drip has a rhythm if you wait for it.",
  'other-fern':"Unfurled just far enough to still look like a question mark.",
  'other-carved-tree-trunk':"The cuts go deep enough that whoever made them wasn't in a hurry.",
  'other-counter-machine':"Brass, dented on one corner, like it's been dropped exactly once, hard.",
  'other-wildflowers':"Grown in clumps, not rows — nobody planted this on purpose.",
  'other-butterflies':"None of them are going anywhere in particular. That seems to be the point.",
  'other-pinecone-branch':"Sap along the edge, half-dried. Not old, not new.",
  'other-potted-flowers':"Root-bound — this pot stopped being big enough a while back.",
  'other-sprout':"Barely up out of the dirt yet, and already leaning hard toward the light.",
  'other-scattered-seeds':"Dropped, not planted — no rows, no pattern, no plan.",
  'other-seed-bag':"Forty little paper packets inside, and most of them still sealed shut.",
  'other-fireflies':"Glowing in broad daylight, for no reason a firefly should have.",
  'other-river-landscape':"The bank's still damp an arm's length back from where the water is now.",
  'other-signpost-arm':"Snapped clean, not rotted. Something hit this, once, hard.",
};

/* Reused across many scenes, generic on purpose. Some are MPT's own
   unused list items; a few (decoy-*) are new suggested filler assets —
   optional, and gracefully invisible until uploaded. */
const DECOY_POOL = [
  { name:'other-blank-paper',       fact:"A blank page always looks more patient than it is." },
  { name:'other-desert-path',       fact:"Every desert path looks like the right one from far enough away." },
  { name:'other-forest-landscape',  fact:"Forests are quietest exactly where you'd expect the most noise." },
  { name:'other-blue-flower',       fact:"Blue is the rarest color in flowers — most 'blue' petals are cheating with light." },
  { name:'other-flying-bird',       fact:"Some birds sleep for seconds at a time, mid-flight, without falling." },
  { name:'other-standing-bird',     fact:"Standing still for an hour burns almost nothing, if you're built for it." },
  { name:'other-cottage',           fact:"Smoke from a chimney means someone decided today was worth the firewood." },
  { name:'other-hibiscus-patch',    fact:"A hibiscus flower usually lasts exactly one day before it's done." },
  { name:'other-bird-bowl',         fact:"A shallow bowl of water gets visited more than a deep one, apparently." },
  { name:'other-firefly',           fact:"The blinking isn't random — each species has its own rhythm, like a signature." },
  { name:'other-sunset',            fact:"The sky turns orange for the same reason the daytime sky is blue, just backwards." },
  { name:'other-neon-text-card',    fact:"Some inks were never meant to be read in daylight." },
  { name:'other-crocodile-2',       fact:"A crocodile can go a very long time between meals if it has to." },
  { name:'decoy-pebble',            fact:"Every pebble used to be part of something much bigger." },
  { name:'decoy-shiny-stone',       fact:"Shiny rocks are rarely valuable. They're just good at reflecting light." },
  { name:'decoy-feather',           fact:"A feather this size fell off something that's doing just fine." },
  { name:'decoy-snail-shell',       fact:"Empty shells outlast the thing that built them by years." },
  { name:'decoy-curled-leaf',       fact:"A leaf curls up like that mostly to save water, not to look interesting." },
  { name:'decoy-broken-twig',       fact:"Snapped, not cut — something walked through here, not around it." },
];
function pickDecoys(sceneId, n){
  // deterministic-but-scattered: same scene always gets the same decoys
  let seed = 0; for(let i=0;i<sceneId.length;i++) seed = (seed*31 + sceneId.charCodeAt(i)) % 99991;
  const out = [];
  for(let i=0;i<n;i++){ seed = (seed*1103515245 + 12345) % 2147483648; out.push(DECOY_POOL[seed % DECOY_POOL.length]); }
  return out;
}

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
  h+='<div class="lvl-row" id="lg-target-row">'
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
function bumpRow(id){
  const el=document.getElementById(id); if(!el) return;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  setTimeout(()=>el.classList.remove('bump'), 420);
}
window.setCurrentLevel = function(v){
  const st=getState(), names=window.LEVEL_NAMES||{1:'A1',2:'A2',3:'B1',4:'B2',5:'C1',6:'C2'};
  st.currentLevel=+v;
  if(st.targetLevel<st.currentLevel) st.targetLevel=st.currentLevel;   // target never sits below current
  saveState();
  const lbl=document.getElementById('lg-current-val'); if(lbl) lbl.textContent=names[+v];
  const tSlider=document.getElementById('lg-target-slider');
  if(tSlider){
    tSlider.min=v;
    if(+tSlider.value<+v){ tSlider.value=v; window.setTargetLevelSlider(v); }
  }
  bumpRow('lg-target-row');
};
window.setTargetLevelSlider = function(v){
  getState().targetLevel=+v; saveState();
  const names=window.LEVEL_NAMES||{1:'A1',2:'A2',3:'B1',4:'B2',5:'C1',6:'C2'};
  const lbl=document.getElementById('lg-target-val'); if(lbl) lbl.textContent=names[+v];
};
window.renderTargetLevelUI = function(){
  const el=$('#level-goals-field'); if(!el) return;
  el.innerHTML=levelGoalsHTML();
};

/* ---------- Home-tab profile panel: name + vocabulary goals, opened by
   tapping the "Good morning" greeting. Same sliders as Settings. ---------- */
function ensureProfilePanel(){
  let el=document.getElementById('profile-panel');
  if(el) return el;
  el=document.createElement('div');
  el.id='profile-panel';
  el.className='word-sheet'; // reuse the same bottom-sheet mechanics/backdrop
  el.innerHTML='<div class="ws-backdrop"></div><div class="ws-card"><div class="ws-body" id="pp-body"></div></div>';
  document.body.appendChild(el);
  el.querySelector('.ws-backdrop').addEventListener('click', closeProfilePanel);
  return el;
}
window.closeProfilePanel = function(){ const el=document.getElementById('profile-panel'); if(el) el.classList.remove('show'); };
window.openProfilePanel = function(){
  const el=ensureProfilePanel();
  const name = (typeof getName==='function') ? getName() : '';
  let h='<div class="pp-t">Your profile</div>';
  h+='<input id="pp-name" class="pp-name-input" type="text" maxlength="24" placeholder="What should Focci call you?" value="'+esc(name)+'"/>';
  h+='<div id="profile-goals">'+levelGoalsHTML()+'</div>';
  h+='<button class="btn" onclick="saveProfilePanel()">Done</button>';
  el.querySelector('#pp-body').innerHTML=h;
  requestAnimationFrame(()=>el.classList.add('show'));
};
window.saveProfilePanel = function(){
  const input=document.getElementById('pp-name');
  if(input && typeof localStorage!=='undefined'){
    const v=input.value.trim().slice(0,24);
    localStorage.setItem('sd_name', v);
  }
  if(typeof renderHero==='function') renderHero();
  closeProfilePanel();
};

/* ============================================================
   WORD-TAP POPUP — reuses the app's own vocab pipeline. Never
   navigates views; a tap outside the sheet closes it instantly and
   the reader is exactly where they were.
   ============================================================ */
function tokenizeForTap(text){
  const src = String(text||'');
  let out='', last=0, m;
  const re=/[A-Za-z][A-Za-z']*/g;
  while((m=re.exec(src))){
    out += esc(src.slice(last, m.index));           // punctuation/quotes/spaces — escaped, never re-scanned
    const word = m[0];
    const clean = word.replace(/^'+|'+$/g,'');
    out += clean.length<2 ? esc(word) : '<span class="wtap" data-w="'+clean.toLowerCase()+'">'+esc(word)+'</span>';
    last = re.lastIndex;
  }
  out += esc(src.slice(last));
  return out;
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
  const safeW = esc(w).replace(/'/g,"\\'");
  let h='<div class="ws-head"><div class="ws-word">'+esc(d.word||w)+'</div>';
  if(typeof levelTag==='function') h+=levelTag(d.word||w);
  h+='<button class="ws-star'+(rec.saved?' on':'')+'" onclick="wordPopupToggleSave(\''+safeW+'\')" aria-label="Save word">'+(rec.saved?'★':'☆')+'</button>';
  h+='</div>';
  if(d.phonetic) h+='<div class="ws-phon">'+esc(d.phonetic)+'</div>';
  const pos=[...new Set((d.senses||[]).map(s=>s.pos).filter(Boolean))];
  if(pos.length) h+='<div class="ws-pos">'+pos.map(posChip).join('')+'</div>';
  h+='<div class="ws-vi">'+(d.vi_equivalent?esc(d.vi_equivalent):'<i>no direct equivalent yet</i>')+'</div>';
  const s0=(d.senses||[])[0];
  if(s0&&s0.vi && s0.vi!==d.vi_equivalent) h+='<div class="ws-sense">'+esc(s0.vi)+'</div>';
  if(d.collocations&&d.collocations.length) h+='<div class="ws-colloc">'+esc(d.collocations[0].text)+'</div>';
  h+='<div class="ws-actions">';
  h+='<button class="ws-full" onclick="closeWordSheet(); showView(\'home\'); search(\''+safeW+'\');">See full entry →</button>';
  h+='<button class="ws-ai-retry" onclick="wordPopupForceAI(\''+safeW+'\')">Not quite right? Ask AI</button>';
  h+='</div>';
  return h;
}
function loadingSheetHTML(w){ return '<div class="ws-word">'+esc(w)+'</div><div class="ws-loading">Focci is charting this one…</div>'; }
function needKeySheetHTML(w){
  const safeW=esc(w).replace(/'/g,"\\'");
  return '<div class="ws-word">'+esc(w)+'</div><div class="ws-loading">Not in your library yet.</div>'
    +'<button class="ws-full" onclick="closeWordSheet(); showView(\'settings\');">Add a Gemini key to look it up →</button>';
}
function offlineSheetHTML(w){
  const safeW=esc(w).replace(/'/g,"\\'");
  return '<div class="ws-word">'+esc(w)+'</div><div class="ws-loading">Offline right now.</div>'
    +'<button class="ws-full" onclick="wordPopupForceAI(\''+safeW+'\')">Try again</button>';
}
function errorSheetHTML(w,msg){
  const safeW=esc(w).replace(/'/g,"\\'");
  return '<div class="ws-word">'+esc(w)+'</div><div class="ws-loading">Couldn\'t look that up ('+esc((msg||'').slice(0,40))+').</div>'
    +'<button class="ws-full" onclick="wordPopupForceAI(\''+safeW+'\')">Ask AI</button>';
}
window.wordPopupToggleSave = async function(word){
  await toggleSave(word);
  const rec = await idbGet(word);
  if(rec) showWordSheet(condensedEntryHTML(rec));
};
window.wordPopupForceAI = async function(rawWord){
  const word = norm(normalizeSpelling(rawWord||''));
  if(!word) return;
  showWordSheet(loadingSheetHTML(word));
  try{
    if(!getKey()){ showWordSheet(needKeySheetHTML(word)); return; }
    if(!navigator.onLine){ showWordSheet(offlineSheetHTML(word)); return; }
    const data = await askGemini(word);
    const canon = norm(data.word||word);
    const existing = await idbGet(canon);
    const rec = { word:canon, data, source:'ai', firstSeen:Date.now(),
      saved:existing?existing.saved:0, savedAt:existing?existing.savedAt:0 };
    await idbPut(rec);
    if(canon!==word) await idbPut({ word, alias:canon, firstSeen:Date.now(), saved:0, savedAt:0 });
    await logEvent('search', rec.word);
    addXP(1);
    showWordSheet(condensedEntryHTML(rec));
  }catch(err){
    showWordSheet(errorSheetHTML(word, err.message||''));
  }
};

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

/* (on-image scattered hotspot tapping removed — see renderExploreBlock:
   discoverable details now surface as a post-answer Yes/No prompt instead,
   which is far easier to find and tap than a tiny icon on the scene art) */


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
  resetPending();
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
/* Selection vs. submission: tapping an option only PICKS it — freely
   changeable, not scored, not disabled — until the player is happy and
   presses the action button, which submits every pending pick at once
   (scoring + locking them) and only then turns into "Continue". This is
   reset whenever the displayed scene changes. */
let _pending = {};
function resetPending(){ _pending = {}; }
function isSubmitted(scene){
  const log = getState().storyLog[scene.id] || {};
  if(scene.comp && log.comp==null) return false;
  if(scene.iq && log.iq==null) return false;
  if(scene.dec && log.dec==null) return false;
  return true;
}
function isRequiredAnswered(scene){ return isSubmitted(scene); }
function canSubmit(scene){
  if(scene.comp && _pending.comp==null) return false;
  if(scene.iq && _pending.iq==null) return false;
  if(scene.dec && _pending.dec==null) return false;
  return true;
}
function optionDisabled(scene, opt){
  return !!(opt.requireItem && !getState().items[opt.requireItem]);
}
window.storyPick = function(sceneId, kind, idx){
  const e=entryOf(sceneId); if(!e) return;
  const log = getState().storyLog[sceneId] || {};
  if(log[kind]!=null) return;                     // already submitted — no more changes
  if(kind==='dec' && optionDisabled(e.scene, e.scene.dec.options[idx])) return;
  _pending[kind]=idx;
  renderStory();
};
window.storySubmit = function(){
  const cur=currentEntry(); if(!cur) return;
  const { scene, chapter, arc } = cur;
  if(scene.comp && _pending.comp!=null) resolveComp(scene, chapter, arc, _pending.comp);
  if(scene.iq && _pending.iq!=null) resolveIq(scene, chapter, arc, _pending.iq);
  if(scene.dec && _pending.dec!=null) resolveDec(scene, chapter, arc, _pending.dec);
  renderStory();
};

function renderCompBlock(scene, chapter, arc){
  const log=getState().storyLog[scene.id]||{};
  const submitted = log.comp!=null;
  let h='<div class="q-card q-comp"><div class="q-kicker">Check</div><div class="q-text">'+esc(scene.comp.q)+'</div><div class="q-opts">';
  scene.comp.options.forEach((opt,i)=>{
    let cls='q-opt';
    if(submitted){ if(i===log.comp) cls += log.compCorrect?' right':' wrong'; if(i===scene.comp.correct && !log.compCorrect) cls+=' reveal'; }
    else if(_pending.comp===i) cls+=' picked';
    h+='<button class="'+cls+'" '+(submitted?'disabled':'')+' onclick="storyPick(\''+scene.id+'\',\'comp\','+i+')">'+esc(opt)+'</button>';
  });
  h+='</div>';
  if(submitted) h+='<div class="q-fb '+(log.compCorrect?'ok':'bad')+'">'+(log.compCorrect?'Correct.':'Not quite — the passage says otherwise.')+'</div>';
  return h+'</div>';
}
function renderIqBlock(scene, chapter, arc){
  const log=getState().storyLog[scene.id]||{};
  const submitted = log.iq!=null;
  let h='<div class="q-card q-iq"><div class="q-kicker">🧩 Puzzle</div><div class="q-text">'+esc(scene.iq.q)+'</div><div class="q-opts">';
  scene.iq.options.forEach((opt,i)=>{
    let cls='q-opt';
    if(submitted && i===log.iq) cls += opt.tag==='ok' ? ' right' : opt.tag==='bad' ? ' wrong' : ' neutral';
    else if(!submitted && _pending.iq===i) cls+=' picked';
    h+='<button class="'+cls+'" '+(submitted?'disabled':'')+' onclick="storyPick(\''+scene.id+'\',\'iq\','+i+')">'+esc(opt.label)+'</button>';
  });
  h+='</div>';
  if(submitted) h+='<div class="q-fb '+(scene.iq.options[log.iq].tag==='ok'?'ok':scene.iq.options[log.iq].tag==='bad'?'bad':'neutral')+'">'+esc(scene.iq.options[log.iq].note||'')+'</div>';
  return h+'</div>';
}
function renderDecBlock(scene, chapter, arc){
  const log=getState().storyLog[scene.id]||{};
  const submitted = log.dec!=null;
  let h='<div class="q-card q-dec">';
  if(scene.dec.q) h+='<div class="q-text">'+esc(scene.dec.q)+'</div>';
  h+='<div class="q-opts vertical">';
  scene.dec.options.forEach((opt,i)=>{
    const disabled = optionDisabled(scene, opt);
    let cls='q-opt dec-opt';
    if(submitted && i===log.dec) cls+=' chosen';
    else if(!submitted && _pending.dec===i) cls+=' picked';
    let title = disabled && opt.missingNote ? ' title="'+esc(opt.missingNote)+'"' : '';
    h+='<button class="'+cls+'" '+((submitted||disabled)?'disabled':'')+title+' onclick="storyPick(\''+scene.id+'\',\'dec\','+i+')">'+esc(opt.label)+'</button>';
  });
  h+='</div>';
  if(submitted && scene.dec.options[log.dec].outcome) h+='<div class="q-fb neutral">'+esc(scene.dec.options[log.dec].outcome)+'</div>';
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
   {name, layer} object — kept flexible; renderExploreBlock reads these
   for the post-answer Yes/No prompts instead of placing them on-image. */
function normalizeProps(list){
  if(!list) return [];
  return list.map(p => typeof p==='string' ? {name:p} : p).filter(p=>p&&p.name);
}

/* Item mentions INSIDE the passage itself — a curated set of scenes
   where a real story object is named plainly enough in the prose that
   a small companion tap-target next to that exact word makes sense
   (verified against the actual text, not guessed). Anything not listed
   here still surfaces through the post-answer explore prompt instead —
   nothing is ever lost, just placed wherever it reads most naturally. */
const ITEM_MENTIONS = {
  '1.2|other-counter':'machine',
  '2.1|other-tree-trunk':'stalk',
  '2.4|other-wagon':'carts',
  '2.7|other-cicada-2':'shell',
  '3.3|other-notebook':'letters',
  '5.2|other-notebook':'ledger', '5.3|other-notebook':'ledger',
  '7.6|other-carved-tree-trunk':'bark',
  '8.4|other-parchment':'cloth',
  '9.1|other-carved-tree-trunk':'bark',
  '9.3|other-tree':'log',
  '11.4|other-seed-bag':'envelopes',
  '12.3|other-seed-bag':'envelope',
  '12.6|other-scattered-seeds':'seed',
};
function deriveKeywordCandidates(assetName){
  const base = assetName.replace(/^(other|fg|decoy)-/,'').replace(/-\d+$/,'');
  const words = base.split('-');
  const out = [];
  if(words.length>1) out.push(words.join(' '));
  out.push(words[words.length-1]);
  if(words.length>1) out.push(words[0]);
  return [...new Set(out)];
}
function keywordInText(sceneId, assetName, text){
  const override = ITEM_MENTIONS[sceneId+'|'+assetName];
  const candidates = override ? [override] : deriveKeywordCandidates(assetName);
  for(const kw of candidates){
    const re = new RegExp('\\b'+kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
    if(re.test(text)) return kw.toLowerCase();
  }
  return null;
}
/* Which single real prop (if any) gets its inline sparkle for this scene —
   computed the same, deterministic way wherever it's needed, so the stage
   render and the explore block always agree on which one was already shown. */
function inlineItemFor(scene, text){
  const real = normalizeProps(scene.props).concat(normalizeProps(scene.propsFront));
  for(const p of real){
    const kw = keywordInText(scene.id, p.name, text||'');
    if(kw) return { name:p.name, keyword:kw };
  }
  return null;
}
/* Inserts a small sparkle tap-target right after the matched word's own
   .wtap span — dictionary lookup on that word still works exactly as
   before; the sparkle is a separate, clearly-visible companion target. */
function injectItemSparkle(html, item){
  if(!item) return html;
  const re = new RegExp('(<span class="wtap" data-w="'+item.keyword+'">[^<]+</span>)');
  return html.replace(re, (m)=>m+'<button class="item-spark" onclick="itemSparkTap(\''+esc(item.name)+'\')">✦</button>');
}
window.itemSparkTap = function(assetName){
  const fact = PROP_LORE[assetName] || "Just something lying around.";
  showWordSheet('<div class="ws-word" style="font-size:15px">A closer look</div><div class="ws-loading" style="padding-top:6px;color:var(--text)">'+esc(fact)+'</div>');
};

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

  let h='<div class="story-view">';
  h+='<div class="story-top"><button class="story-quit" onclick="renderGameHub()">✕</button>'
    +'<div class="story-top-t">Arc '+arc.id+' · '+esc(chapter.title)+'</div></div>';

  const bg = scene.bg || arc.bg;
  const mood = (chapter.mood||'BRIGHT').toLowerCase();
  h+='<div class="story-stage mood-'+mood+'" style="background-image:url(\''+assetUrl(bg)+'\')">';
  h+=ambientLayerHTML(mood);
  if(scene.mascot) h+='<img class="story-mascot" src="'+assetUrl(scene.mascot)+'" alt="" onerror="this.style.display=\'none\'"/>';
  h+='</div>';

  h+='<div class="story-page paper-bg">';
  h+='<div class="story-title">'+esc(scene.title||'')+'</div>';
  const passageText = getSceneText(scene, chapter.id);
  let passageHTML = tokenizeForTap(passageText);
  passageHTML = injectItemSparkle(passageHTML, inlineItemFor(scene, passageText));
  h+='<div class="story-passage" id="story-passage-'+scene.id.replace('.','-')+'">'+passageHTML+'</div>';
  if(scene.comp) h+=renderCompBlock(scene, chapter, arc);
  if(scene.iq) h+=renderIqBlock(scene, chapter, arc);
  if(scene.dec) h+=renderDecBlock(scene, chapter, arc);
  const submitted = isSubmitted(scene);
  if(submitted){
    h += renderExploreBlock(scene);
    h+='<button class="btn story-continue" onclick="advanceStory()">'+(scene.endOfBuiltContent?'Continue':'Continue →')+'</button>';
  } else {
    h+='<button class="btn story-continue" '+(canSubmit(scene)?'':'disabled')+' onclick="storySubmit()">Choose an answer</button>';
  }
  h+='</div></div>';

  area.innerHTML=h;
  wireWordTaps();
}

/* ============================================================
   EXPLORE — shown only once every question in the scene has been
   answered. Combines the scripted ✿ presence actions with a couple
   of world-detail prompts (mixing a real object's lore with pure
   decoy fun-facts, worded and offered identically either way).
   Each is a plain Yes/No: Yes reveals a line, No just moves on.
   ============================================================ */
function renderExploreBlock(scene){
  const st=getState();
  const log = st.storyLog[scene.id] || {};
  const hasPresence = scene.presence && scene.presence.length;
  const entry = entryOf(scene.id);
  const inlined = inlineItemFor(scene, entry ? getSceneText(scene, entry.chapter.id) : (scene.en||''));
  const real = normalizeProps(scene.props).concat(normalizeProps(scene.propsFront))
    .filter(p => !inlined || p.name!==inlined.name); // already offered inline — don't repeat it here
  const decoys = pickDecoys(scene.id+'x', real.length?1:2);
  const loreItems = real.slice(0,1).map(p=>({ name:p.name, fact: PROP_LORE[p.name]||"Just something lying around." }));
  const hotspotItems = loreItems.concat(decoys.map(d=>({ name:d.name, fact:d.fact })));
  if(!hasPresence && !hotspotItems.length) return '';
  let h='<div class="explore-block">';
  if(hasPresence) h += renderPresenceBlock(scene, null, null);
  hotspotItems.forEach((it,i)=>{
    const key='hs'+i;
    const done = log.explore && log.explore[key];
    if(done){
      h += '<div class="explore-item done"><span class="ei-txt">'+esc(done.said==='yes'?done.fact:"Focci decides to leave it be.")+'</span></div>';
    } else {
      const safeFact = esc(it.fact).replace(/'/g,"\\'");
      h += '<div class="explore-item">'
        +'<span class="ei-prompt">Something catches Focci\'s eye. Take a look?</span>'
        +'<div class="ei-btns">'
        +'<button class="ei-btn yes" onclick="exploreAnswer(\''+scene.id+'\',\''+key+'\',\'yes\',\''+safeFact+'\')">Yes</button>'
        +'<button class="ei-btn no" onclick="exploreAnswer(\''+scene.id+'\',\''+key+'\',\'no\',\'\')">No</button>'
        +'</div></div>';
    }
  });
  h+='</div>';
  return h;
}
window.exploreAnswer = function(sceneId, key, said, fact){
  const st=getState();
  const log = st.storyLog[sceneId] || (st.storyLog[sceneId]={});
  if(!log.explore) log.explore={};
  if(log.explore[key]) return;
  log.explore[key] = { said, fact };
  saveState();
  renderStory();
};
function wireWordTaps(){
  const area=$('#review-area'); if(!area || area._wtapWired) return;
  area._wtapWired=true;
  area.addEventListener('click', (e)=>{
    const t=e.target.closest('.wtap'); if(!t) return;
    t.classList.remove('tap-flash'); void t.offsetWidth; t.classList.add('tap-flash');
    openWordPopup(t.dataset.w);
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
function openStory(){ resetPending(); renderStory(); }
window.openStory = openStory;

function storyProgressLabel(){
  const cur=currentEntry();
  if(!cur) return 'Not started';
  return 'Arc '+cur.arc.id+' · '+cur.chapter.title;
}
function isStoryStarted(){ return Object.keys(getState().storyLog).length>0; }

window.renderGameHub = function(){
  const area=$('#review-area'); if(!area) return;
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

  h+=renderWorldMap();

  h+='<div class="hub-row">';
  h+='<button class="hub-card hub-mini" onclick="setPracticeMode(\'type\')"><span class="hub-mini-ico">✍️</span><span class="hub-mini-t">Type it</span></button>';
  h+='<button class="hub-card hub-mini" onclick="setPracticeMode(\'match\')"><span class="hub-mini-ico">🎯</span><span class="hub-mini-t">Match it</span></button>';
  h+='</div>';

  h+=renderBonusStrip();
  h+='</div>';
  area.innerHTML=h;
};

/* ============================================================
   THE MAP — reuses the app's existing "Territory" banner+strip
   pattern (the one already shown after saving words) so the two
   feel identical, just pointed at story progress instead of word
   count. Names are deliberately vague — tied to Focci's amnesia,
   never to plot — so a locked land's name is never a spoiler.
   ============================================================ */
const ARC_LANDS = [
  { id:1,  name:"The Nameless Field",   tagline:"Where Focci woke up owning nothing but a bag and a bandana." },
  { id:2,  name:"The Unspoken Sands",   tagline:"Thirst, a ledger that doesn't lie, and a promise made to a crocodile." },
  { id:3,  name:"The Unmarked Woods",   tagline:"Getting lost, and finally saying so out loud." },
  { id:4,  name:"The Unchanging Garden",tagline:"A place that stopped changing eleven years ago." },
  { id:5,  name:"The Waiting Sky",      tagline:"A night under a falling sky, and a fire that won't go out." },
  { id:6,  name:"The Edge of Water",    tagline:"Somewhere the ground finally runs out." },
  { id:7,  name:"The Underglow",        tagline:"Heat that comes up through the soles of your feet." },
  { id:8,  name:"The Deep Unknown",     tagline:"Warm water, and something worth diving for." },
  { id:9,  name:"The First Frost",      tagline:"The first cold that actually means something." },
  { id:10, name:"The Kept Pages",       tagline:"Rows and rows of what other people decided to keep." },
  { id:11, name:"The Blank White",      tagline:"White in every direction, and no footprints but your own — yet." },
  { id:12, name:"The Blinking Dark",    tagline:"Light that keeps its own schedule, not yours." },
];
function arcUnlocked(arcId){
  const cur=currentEntry();
  const reached = cur ? cur.arc.id : 0;
  return arcId<=reached && !!CONTENT.find(a=>a.id===arcId);
}
function renderWorldMap(){
  const cur = currentEntry();
  const curArcId = cur ? cur.arc.id : 1;
  const curMeta = ARC_LANDS.find(a=>a.id===curArcId) || ARC_LANDS[0];
  const nextMeta = ARC_LANDS.find(a=>a.id===curArcId+1);
  const curArcContent = CONTENT.find(a=>a.id===curArcId);

  let pct=0;
  if(curArcContent && cur){
    const arcScenes = FLAT.filter(x=>x.arc.id===curArcId);
    const idx = arcScenes.findIndex(x=>x.scene.id===cur.scene.id);
    pct = arcScenes.length ? Math.round(((idx+1)/arcScenes.length)*100) : 0;
  }
  const charImg = (curArcContent && curArcContent.chapters[0] && curArcContent.chapters[0].scenes[0].mascot) || 'mascot-wander';

  let h='<div class="saved-banner" style="background-image:url(\''+assetUrl('bg-arc'+curArcId)+'\')">';
  h+='<div class="sb-scrim"></div>';
  h+='<img class="sb-char" src="'+assetUrl(charImg)+'" alt="" onerror="this.style.display=\'none\'"/>';
  h+='<div class="sb-txt"><div class="sb-t">'+esc(curMeta.name)+'</div>';
  h+='<div class="sb-s">'+esc(curMeta.tagline)+'</div>';
  if(nextMeta && CONTENT.find(a=>a.id===nextMeta.id)){
    h+='<div class="sb-next">🔒 Finish this land to reach <b>'+esc(nextMeta.name)+'</b></div>';
    h+='<div class="sb-bar"><i style="width:'+pct+'%"></i></div>';
  } else if(nextMeta){
    h+='<div class="sb-next">🛠️ More lands are still being drawn.</div>';
  } else {
    h+='<div class="sb-next">🏆 Every built land explored.</div>';
  }
  h+='</div></div>';

  h+='<div class="region-strip">';
  ARC_LANDS.forEach(meta=>{
    const unlocked = arcUnlocked(meta.id);
    h+='<div class="region'+(unlocked?' on':'')+(meta.id===curArcId?' cur':'')+'" onclick="worldMapInfo('+meta.id+')">'
      +'<div class="region-img" style="background-image:url(\''+assetUrl('bg-arc'+meta.id)+'\')"></div>'
      +'<div class="region-lock">'+(unlocked?'✓':'🔒')+'</div>'
      +'<div class="region-n">'+esc(meta.name)+'</div>'
      +'<div class="region-a">'+(unlocked?'unlocked':'locked')+'</div>'
      +'</div>';
  });
  h+='</div>';
  return h;
}
window.worldMapInfo = function(arcId){
  const meta = ARC_LANDS.find(a=>a.id===arcId); if(!meta) return;
  const unlocked = arcUnlocked(arcId);
  if(!unlocked){
    showInfoCard('mascot-wonder', '🔒 '+meta.name, meta.tagline);
    return;
  }
  const st=getState();
  const arc = CONTENT.find(a=>a.id===arcId);
  const decs = st.decisions.filter(d=>d.arcId===arcId);
  const pivot = decs.slice().reverse().find(d=>d.kind==='pivot');
  const cast = [...new Set(arc.chapters.map(c=>CHAPTER_CAST[c.id]).filter(Boolean))];
  let body = meta.tagline;
  if(cast.length) body += ' Met: '+cast.join(', ')+'.';
  if(pivot) body += ' Your call: '+pivot.label;
  showInfoCard('mascot-withflag-1', meta.name, body);
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
   INIT — nothing to boot eagerly; the hub/settings hooks above
   are called on-demand by app.js's showView().
   ============================================================ */

})();
