/* ============================================================
   Smart.Dict — offline-first English→Vietnamese semantic dictionary
   Vanilla JS. No build step. All data lives on-device (IndexedDB).
   ============================================================ */

/* ---------- tiny helpers ---------- */
const $ = (s) => document.querySelector(s);
const norm = (w) => w.trim().toLowerCase();
const now = () => Date.now();
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),1900); }

/* ---------- IndexedDB (one small promise wrapper) ---------- */
const DB_NAME='smartdict', DB_VER=1, STORE='entries';
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

/* ---------- settings (localStorage) ---------- */
const KEY_LS='sd_key', MODEL_LS='sd_model', SEED_FLAG='sd_seed_loaded';
const getKey=()=>localStorage.getItem(KEY_LS)||'';
const getModel=()=>localStorage.getItem(MODEL_LS)||'gemini-2.5-flash-lite';

/* ---------- one-time seed load ---------- */
async function loadSeedOnce(){
  if(localStorage.getItem(SEED_FLAG)) return;
  try{
    const res=await fetch('./seed.json'); if(!res.ok) throw 0;
    const list=await res.json();
    for(const data of list){
      const w=norm(data.word);
      const existing=await idbGet(w);
      if(!existing) await idbPut({word:w, data, source:'seed', firstSeen:now(), saved:0, savedAt:0});
    }
    localStorage.setItem(SEED_FLAG,'1');
  }catch(e){ /* no seed file yet — fine, AI fallback covers everything */ }
}

/* ============================================================
   GEMINI FALLBACK  (also the extraction prompt = your "step 1")
   ============================================================ */
function buildPrompt(word){
  return `You are a bilingual English→Vietnamese lexicographer. For the English word "${word}", return a single JSON object (no markdown, no commentary) with EXACTLY this shape:

{
  "word": "${word}",
  "phonetic": "IPA, e.g. /stɛp/",
  "vi_equivalent": "the ONE closest natural Vietnamese word/feeling",
  "vi_note": "1 short Vietnamese sentence explaining the core feeling/usage",
  "forms": { "v1":"", "v2":"", "v3":"", "ving":"" },
  "senses": [
    { "pos":"noun|verb|adjective|adverb|...", "vi":"Vietnamese equivalent for THIS sense",
      "gloss":"short English meaning", "rank":5,
      "example":"one natural English sentence", "example_vi":"bản dịch tiếng Việt tự nhiên" }
  ],
  "expressions": [
    { "text":"phrasal verb / collocation", "vi":"nghĩa tiếng Việt", "rank":5, "example":"short sentence" }
  ],
  "family": [ { "word":"related form", "pos":"noun|verb|adjective|adverb" } ],
  "synonyms": ["useful common ones only"],
  "antonyms": ["useful common ones only"]
}

RULES — prioritize USEFULNESS over completeness:
- senses: MOST COMMON meaning first. rank = how often you meet it in real life (5=very common … 1=rare). Max 5 senses.
- expressions: only genuinely common spoken/written ones, ranked. Max 6. Skip if none.
- synonyms/antonyms: max 5 each, common & distinguishable. Skip rare/literary words.
- forms: fill only if it's a verb (put "" for the rest). Omit forms object entirely if not a verb.
- Vietnamese must sound natural, not word-by-word translation.
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
   SEARCH FLOW:  local/seed  →  AI fallback  →  cache back
   ============================================================ */
let currentWord=null;
async function search(rawWord){
  const word=norm(rawWord||'');
  if(!word) return;
  $('#search-empty').style.display='none';
  const box=$('#result');

  const local=await idbGet(word);
  if(local){ currentWord=word; box.innerHTML=renderEntry(local); return; }

  // not in device — need AI
  if(!getKey()){ box.innerHTML=needKeyState(word); return; }
  if(!navigator.onLine){ box.innerHTML=offlineState(word); return; }

  box.innerHTML='<div class="spinner"></div><div class="status">AI đang tra “'+esc(word)+'”…</div>';
  try{
    const data=await askGemini(word);
    const rec={word, data, source:'ai', firstSeen:now(), saved:0, savedAt:0};
    await idbPut(rec);
    currentWord=word;
    box.innerHTML=renderEntry(rec);
    refreshStats();
  }catch(err){
    box.innerHTML=errorState(word,err.message||'');
  }
}

/* ---------- toggle save ---------- */
async function toggleSave(word){
  const rec=await idbGet(word); if(!rec) return;
  rec.saved=rec.saved?0:1;
  rec.savedAt=rec.saved?now():0;
  await idbPut(rec);
  if(currentWord===word){ const b=$('#result'); if(b) b.innerHTML=renderEntry(rec); }
  toast(rec.saved?'Đã lưu ⭐':'Đã bỏ lưu');
  refreshStats();
}

/* ============================================================
   RENDER
   ============================================================ */
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function dots(rank){ const n=Math.max(0,Math.min(5,rank|0)); let o=''; for(let i=0;i<5;i++) o+= i<n?'●':'<span class="off">○</span>'; return o; }

function renderEntry(rec){
  const d=rec.data||{}; const w=rec.word;
  const badge = rec.source==='ai'
    ? '<span class="badge ai">✦ AI · đã lưu offline</span>'
    : '<span class="badge off">◆ offline</span>';

  let h='<div class="entry">';
  h+='<div class="head"><div>';
  h+='<div class="headword">'+esc(d.word||w)+'</div>';
  if(d.phonetic) h+='<div class="phon">'+esc(d.phonetic)+'</div>';
  h+=badge;
  h+='</div>';
  h+='<button class="star '+(rec.saved?'on':'')+'" onclick="toggleSave(\''+esc(w)+'\')" aria-label="Lưu">'+(rec.saved?'★':'☆')+'</button>';
  h+='</div>';

  if(d.vi_equivalent){
    h+='<div class="feel"><div class="eq">'+esc(d.word||w)+' ≈ <b>'+esc(d.vi_equivalent)+'</b></div>';
    if(d.vi_note) h+='<div class="note">'+esc(d.vi_note)+'</div>';
    h+='</div>';
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
    h+='<div class="sec"><div class="sec-h">Nghĩa · phổ biến nhất trước</div>';
    for(const s of ss){
      h+='<div class="sense"><div class="sense-top">';
      if(s.pos) h+='<span class="pos">'+esc(s.pos)+'</span>';
      h+='<span class="rank">'+dots(s.rank)+'</span></div>';
      if(s.vi) h+='<div class="vi">'+esc(s.vi)+'</div>';
      if(s.gloss) h+='<div class="gloss">'+esc(s.gloss)+'</div>';
      if(s.example){ h+='<div class="ex">“'+esc(s.example)+'”'; if(s.example_vi) h+='<span class="evi">→ '+esc(s.example_vi)+'</span>'; h+='</div>'; }
      h+='</div>';
    }
    h+='</div>';
  }

  // expressions
  if(Array.isArray(d.expressions)&&d.expressions.length){
    const es=[...d.expressions].sort((a,b)=>(b.rank||0)-(a.rank||0));
    h+='<div class="sec"><div class="sec-h">Cách dùng thường gặp</div>';
    for(const e of es){
      h+='<div class="expr"><span class="rank">'+dots(e.rank)+'</span><span class="t">'+esc(e.text)+'</span>';
      if(e.vi) h+='<span class="ev">'+esc(e.vi)+'</span>';
      h+='</div>';
    }
    h+='</div>';
  }

  // family
  if(Array.isArray(d.family)&&d.family.length){
    h+='<div class="sec"><div class="sec-h">Gia đình từ</div><div class="chips">';
    for(const fm of d.family){ const fw=esc(fm.word||''); h+='<button class="chip tap" onclick="jump(\''+fw+'\')">'+fw+(fm.pos?' <span style="color:var(--muted-2)">·'+esc(fm.pos)+'</span>':'')+'</button>'; }
    h+='</div></div>';
  }

  // syn / ant
  if((d.synonyms&&d.synonyms.length)||(d.antonyms&&d.antonyms.length)){
    h+='<div class="sec"><div class="sec-h">Đồng nghĩa · trái nghĩa</div><div class="chips">';
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
function dayStart(ts){ const d=new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }
async function renderSaved(){
  const all=(await idbAll()).filter(r=>r.saved).sort((a,b)=>b.savedAt-a.savedAt);
  const box=$('#saved-list');
  if(!all.length){ box.innerHTML='<div class="empty"><div class="big">⭐</div><h3>Chưa lưu từ nào</h3><p>Bấm ngôi sao ☆ ở một từ để lưu vào đây.</p></div>'; return; }
  const t=dayStart(now()), wk=t-6*864e5, mo=dayStart(now()-29*864e5);
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
   REVIEW  (random from saved; reveal answer; self-grade)
   ============================================================ */
let revQueue=[], revIdx=0, revShown=false;
async function startReview(){
  const saved=(await idbAll()).filter(r=>r.saved);
  const area=$('#review-area');
  if(saved.length<1){ area.innerHTML='<div class="empty"><div class="big">🔁</div><h3>Chưa có gì để ôn</h3><p>Lưu vài từ trước đã, rồi quay lại đây random cho em nhớ.</p></div>'; return; }
  revQueue=saved.sort(()=>Math.random()-0.5).slice(0,10); revIdx=0; revShown=false;
  renderReview();
}
function renderReview(){
  const area=$('#review-area');
  if(revIdx>=revQueue.length){
    area.innerHTML='<div class="empty"><div class="big">✅</div><h3>Xong '+revQueue.length+' từ!</h3></div>'
      +'<button class="btn" onclick="startReview()">Ôn lượt mới</button>'; return;
  }
  const r=revQueue[revIdx], d=r.data||{};
  let ans='';
  if(revShown){
    ans='<div class="rev-ans show">';
    if(d.vi_equivalent) ans+='<div class="eq" style="font-size:20px;font-weight:700;margin-bottom:6px">≈ <b style="color:var(--accent)">'+esc(d.vi_equivalent)+'</b></div>';
    if(d.vi_note) ans+='<div class="gloss" style="color:var(--muted);font-size:14px">'+esc(d.vi_note)+'</div>';
    const s0=(d.senses||[])[0];
    if(s0&&s0.example) ans+='<div class="ex" style="margin-top:10px;font-size:14px">“'+esc(s0.example)+'”'+(s0.example_vi?'<span class="evi" style="color:var(--muted);display:block">→ '+esc(s0.example_vi)+'</span>':'')+'</div>';
    ans+='</div>';
  }
  let h='<div class="rev-progress">'+(revIdx+1)+' / '+revQueue.length+'</div>';
  h+='<div class="rev-card"><div class="prompt">Nghĩa của từ này?</div><div class="q">'+esc(r.word)+'</div>'+ans+'</div>';
  if(!revShown){ h+='<button class="btn" onclick="revealReview()">Xem nghĩa</button>'; }
  else{ h+='<div class="btn-row" style="margin-top:12px"><button class="btn ghost" onclick="nextReview()">😐 Chưa chắc</button><button class="btn" onclick="nextReview()">👍 Nhớ rồi</button></div>'; }
  area.innerHTML=h;
}
function revealReview(){ revShown=true; renderReview(); }
function nextReview(){ revIdx++; revShown=false; renderReview(); }

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
  if(v==='saved') renderSaved();
  if(v==='review') startReview();
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
  $('#key').value=getKey(); $('#model').value=getModel();
  $('#save-settings').addEventListener('click',()=>{
    localStorage.setItem(KEY_LS,$('#key').value.trim());
    localStorage.setItem(MODEL_LS,($('#model').value.trim()||'gemini-2.5-flash'));
    const f=$('#settings-flash'); f.textContent='Đã lưu ✓'; setTimeout(()=>f.textContent='',1800);
  });
  $('#import-btn').addEventListener('click',()=>$('#import-file').click());
  $('#import-file').addEventListener('change',e=>{ if(e.target.files[0]) importSeedFile(e.target.files[0]); e.target.value=''; });
  $('#persist-btn').addEventListener('click',async()=>{
    const f=$('#persist-flash');
    if(navigator.storage&&navigator.storage.persist){ const ok=await navigator.storage.persist(); f.textContent=ok?'Đã bật — dữ liệu được giữ ✓':'iOS chưa cho, nhưng thêm app vào Home Screen sẽ giúp giữ dữ liệu.'; }
    else f.textContent='Trình duyệt không hỗ trợ (vẫn ổn khi thêm vào Home Screen).';
  });
}

/* ---------- service worker (offline) ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

/* ---------- boot ---------- */
(async function init(){
  wire();
  await loadSeedOnce();
  refreshStats();
  if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
  $('#q').focus();
})();
window.toggleSave=toggleSave; window.jump=jump;
window.revealReview=revealReview; window.nextReview=nextReview; window.startReview=startReview;
