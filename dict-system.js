/* ============================================================
   dict-system.js — hệ thống dữ liệu từ điển cho Focci.
   Nạp SAU app.js (dùng lại db, STORE, norm, missLoad… của app.js).

   BA VIỆC:
   1. dsSync()   — nguồn chân lý DUY NHẤT là repo: dict-manifest.json
                   liệt kê các shard + version + tổng số từ. App chỉ
                   tải shard chưa áp dụng, gộp bằng MỘT transaction
                   cho mỗi shard (không phải 1 transaction/từ như
                   syncSeedFiles cũ — đó là chỗ làm app ì).
   2. dsScreen() — sàng lọc hàng đợi từ thiếu bằng từ điển miễn phí
                   (dictionaryapi.dev), KHÔNG tốn token AI. Nó chỉ
                   trả lời "từ này có thật trong tiếng Anh không",
                   không cho nghĩa tiếng Việt — nghĩa vẫn cần AI.
   3. dsExport/dsImport — xuất/nhập danh sách từ còn thiếu ra .txt
                   có số index, để chạy tay nhiều đợt.

   Toàn bộ dữ liệu làm việc vẫn nằm trong IndexedDB trên máy →
   tra từ offline không phụ thuộc mạng.
   ============================================================ */
(function(){
  'use strict';

  const MANIFEST   = './dict-manifest.json';
  const LS_APPLIED = 'fc_dict_applied';   // { version, files:[ "ver::file" ] }
  const LS_FREE    = 'fc_freedict';       // { word: 1 (có thật) | 0 (không có) }
  const FREE_API   = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
  const FREE_CONC  = 3;                   // số request song song — giữ thấp cho lịch sự
  const FREE_GAP   = 130;                 // ms nghỉ giữa các request của cùng worker

  /* ---------- log ra UI, có fallback ra console ---------- */
  function dsLog(msg, cls){
    const el = document.querySelector('#ds-log');
    if(!el){ console.log('[dict-system]', msg); return; }
    el.style.display = 'block';
    const d = document.createElement('div');
    if(cls) d.className = cls;
    d.textContent = msg;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
    while(el.children.length > 200) el.removeChild(el.firstChild);
  }

  function lsGet(k, dflt){
    try{ return JSON.parse(localStorage.getItem(k) || JSON.stringify(dflt)); }
    catch(_){ return dflt; }
  }
  function lsSet(k, v){
    try{ localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch(e){ dsLog('⚠ không lưu được ' + k + ': ' + e.message, 'warn'); return false; }
  }

  /* ---------- đếm từ mà KHÔNG nạp toàn bộ dữ liệu vào RAM ----------
     idbAll() của app.js kéo cả 16.000 bản ghi kèm nghĩa; chỉ để đếm
     thì dùng getAllKeys nhẹ hơn nhiều. */
  function dsCount(){
    return db().then(d => new Promise((res, rej) => {
      const r = d.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
      r.onsuccess = () => res(r.result ? r.result.length : 0);
      r.onerror   = () => rej(r.error);
    }));
  }

  function dsAllWords(){
    return db().then(d => new Promise((res, rej) => {
      const r = d.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => rej(r.error);
    }));
  }

  /* ---------- gộp một mẻ bản ghi trong MỘT transaction ----------
     policy 'fill-gaps' (mặc định): từ đã có nghĩa thì giữ nguyên,
     không ghi đè — bảo vệ những entry bạn đã Rewrite bằng AI.
     policy 'replace': ghi đè hết (dùng khi muốn nâng cấp toàn bộ). */
  function dsMerge(list, policy){
    const replace = policy === 'replace';
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(STORE, 'readwrite');
      const s = t.objectStore(STORE);
      let added = 0, kept = 0, skipped = 0;

      for(const data of list){
        if(!data || !data.word){ skipped++; continue; }
        const w = norm(typeof normalizeSpelling === 'function'
                        ? normalizeSpelling(data.word) : data.word);
        if(!w){ skipped++; continue; }

        const g = s.get(w);
        g.onsuccess = () => {
          const ex = g.result;
          if(ex && ex.data && !replace){ kept++; return; }
          s.put({
            word: w,
            data: data,
            source: 'seed',
            firstSeen: ex ? ex.firstSeen : Date.now(),
            saved:     ex ? ex.saved     : 0,
            savedAt:   ex ? ex.savedAt   : 0
          });
          added++;
        };
      }
      t.oncomplete = () => res({ added, kept, skipped });
      t.onerror    = () => rej(t.error);
      t.onabort    = () => rej(t.error || new Error('transaction aborted'));
    }));
  }

  /* ---------- tải file bỏ qua cache của service worker ----------
     SW của app là cache-first cho mọi file same-origin, nên manifest
     sẽ đứng yên mãi nếu không phá cache. Shard thì cache bình thường
     vì tên file gắn với version, không bao giờ đổi nội dung. */
  async function fetchFresh(url){
    const r = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* ============================================================
     1 · ĐỒNG BỘ TỪ REPO
     ============================================================ */
  let dsBusy = false;

  async function dsSync(force){
    if(dsBusy){ dsLog('Đang chạy rồi…', 'warn'); return; }
    dsBusy = true;
    const btn = document.querySelector('#ds-sync-btn');
    if(btn) btn.textContent = 'Đang đồng bộ…';

    try{
      let man;
      try{
        man = await fetchFresh(MANIFEST);
      }catch(e){
        dsLog('Không đọc được dict-manifest.json (' + e.message + ').', 'bad');
        dsLog('Chạy shard-tool.html để tạo manifest + shard trước, rồi upload lên repo.', 'warn');
        return;
      }

      const shards = Array.isArray(man.shards) ? man.shards : [];
      if(!shards.length){ dsLog('Manifest không có shard nào.', 'warn'); return; }

      const policy  = man.policy === 'replace' ? 'replace' : 'fill-gaps';
      const applied = lsGet(LS_APPLIED, { version: null, files: [] });
      const doneSet = new Set(force ? [] : (applied.files || []));

      dsLog('Manifest version ' + man.version + ' · ' + shards.length + ' shard · '
            + (man.words || '?') + ' từ · chế độ ' + policy);

      let totalAdded = 0, totalKept = 0, done = 0;

      for(const sh of shards){
        const file = typeof sh === 'string' ? sh : sh.file;
        const tag  = man.version + '::' + file;
        if(doneSet.has(tag)){ done++; dsLog('· ' + file + ' — đã áp dụng, bỏ qua'); continue; }

        try{
          const r = await fetch('./' + file);
          if(!r.ok) throw new Error('HTTP ' + r.status);
          const list = await r.json();
          const arr  = Array.isArray(list) ? list : [list];

          const out = await dsMerge(arr, policy);
          totalAdded += out.added; totalKept += out.kept;
          doneSet.add(tag);
          lsSet(LS_APPLIED, { version: man.version, files: [...doneSet], at: Date.now() });
          done++;
          dsLog('✓ ' + file + ' — thêm ' + out.added + ', giữ nguyên ' + out.kept
                + (out.skipped ? ', bỏ ' + out.skipped : ''), 'ok');
        }catch(e){
          dsLog('✕ ' + file + ' — ' + (e.message || e), 'bad');
        }

        const bar = document.querySelector('#ds-bar');
        if(bar) bar.style.width = Math.round(done / shards.length * 100) + '%';
        await new Promise(r => setTimeout(r, 0));   // nhả main thread giữa các shard
      }

      const n = await dsCount();
      dsLog('Xong: thêm ' + totalAdded + ' từ mới, giữ nguyên ' + totalKept
            + '. Thư viện hiện có ' + n.toLocaleString() + ' từ.', 'ok');
      if(typeof refreshStats === 'function') refreshStats();
      dsState();
    }finally{
      dsBusy = false;
      if(btn) btn.textContent = 'Đồng bộ từ repo';
    }
  }

  /* ============================================================
     2 · SÀNG LỌC BẰNG TỪ ĐIỂN MIỄN PHÍ (không tốn token)
     ============================================================ */
  async function freeCheck(word){
    const r = await fetch(FREE_API + encodeURIComponent(word));
    if(r.status === 200) return 1;
    if(r.status === 404) return 0;
    if(r.status === 429) throw new Error('RATE_LIMIT');
    throw new Error('HTTP ' + r.status);
  }

  async function dsScreen(){
    if(dsBusy){ dsBusy = false; return; }               // bấm lần 2 = dừng
    const q = (typeof missLoad === 'function') ? missLoad() : { list: [] };
    const list = q.list || [];
    if(!list.length){ dsLog('Hàng đợi trống — chạy "Find words" trước.', 'warn'); return; }

    const limit = Math.max(1, +(document.querySelector('#ds-screen-count') || {}).value || 300);
    const cache = lsGet(LS_FREE, {});
    const todo  = list.filter(w => cache[w] === undefined).slice(0, limit);

    if(!todo.length){
      dsLog('Cả ' + list.length + ' từ trong hàng đợi đều đã được kiểm tra trước đó.', 'ok');
      applyScreen(cache);
      return;
    }

    dsBusy = true;
    const btn = document.querySelector('#ds-screen-btn');
    if(btn) btn.textContent = 'Dừng';
    dsLog('Kiểm tra ' + todo.length + ' từ với từ điển miễn phí (không tốn token)…');

    let i = 0, real = 0, fake = 0, err = 0, stopped = false;
    const next = () => (i < todo.length && dsBusy) ? todo[i++] : null;

    const worker = async () => {
      let w;
      while((w = next())){
        try{
          cache[w] = await freeCheck(w);
          if(cache[w]) real++; else fake++;
        }catch(e){
          err++;
          if(e.message === 'RATE_LIMIT'){
            dsLog('⚠ bị giới hạn tốc độ — dừng lại, chạy tiếp sau vài phút', 'warn');
            dsBusy = false; stopped = true; break;
          }
        }
        if((real + fake + err) % 25 === 0){
          lsSet(LS_FREE, cache);
          dsLog('  ' + (real + fake + err) + '/' + todo.length
                + ' → thật ' + real + ', không có ' + fake + (err ? ', lỗi ' + err : ''));
          const bar = document.querySelector('#ds-bar');
          if(bar) bar.style.width = Math.round((real + fake + err) / todo.length * 100) + '%';
        }
        await new Promise(r => setTimeout(r, FREE_GAP));
      }
    };

    await Promise.all(Array.from({ length: FREE_CONC }, worker));
    lsSet(LS_FREE, cache);

    dsLog('Kiểm tra xong: ' + real + ' từ có thật, ' + fake + ' từ không tồn tại'
          + (err ? ', ' + err + ' lỗi mạng (giữ lại, kiểm tra sau)' : '')
          + (stopped ? ' — đã dừng sớm' : ''), 'ok');
    applyScreen(cache);

    dsBusy = false;
    if(btn) btn.textContent = 'Sàng lọc miễn phí';
  }

  /* Chỉ BỎ những từ đã xác nhận không tồn tại. Lỗi mạng và từ chưa
     kiểm tra đều được giữ lại — thà để lại rác hơn là mất từ thật. */
  function applyScreen(cache){
    const q = missLoad();
    const before = (q.list || []).length;
    q.list = (q.list || []).filter(w => cache[w] !== 0);
    missSave(q);
    const unchecked = q.list.filter(w => cache[w] === undefined).length;
    dsLog('Hàng đợi: ' + before + ' → ' + q.list.length + ' từ'
          + (unchecked ? ' (còn ' + unchecked + ' từ chưa kiểm tra)' : ' (đã kiểm tra hết)'), 'ok');
    if(typeof missRefreshState === 'function') missRefreshState();
    dsState();
  }

  /* ============================================================
     3 · XUẤT / NHẬP DANH SÁCH TỪ CÒN THIẾU (.txt có index)
     ============================================================ */
  function dsExport(){
    const q = missLoad();
    const list = q.list || [];
    if(!list.length){ if(typeof toast === 'function') toast('Hàng đợi trống'); return; }

    const cache = lsGet(LS_FREE, {});
    const stamp = new Date().toISOString().slice(0, 10);
    const head = [
      '# Focci — từ còn thiếu',
      '# ' + list.length + ' từ · xuất ngày ' + stamp,
      '# Đã kiểm tra bằng từ điển miễn phí: '
        + list.filter(w => cache[w] === 1).length + ' xác nhận có thật, '
        + list.filter(w => cache[w] === undefined).length + ' chưa kiểm tra',
      '# Giữ nguyên định dạng "số. từ" để import lại được.',
      ''
    ];
    const body = list.map((w, i) => (i + 1) + '. ' + w);
    const blob = new Blob([head.concat(body).join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'focci-missing-' + stamp + '.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    dsLog('Đã xuất ' + list.length + ' từ ra file .txt', 'ok');
  }

  async function dsImport(file){
    try{
      const text = await file.text();
      const words = [];
      for(const raw of text.split(/\r?\n/)){
        const ln = raw.trim();
        if(!ln || ln.startsWith('#')) continue;
        const m = ln.match(/^\d+\s*[.)\-:]\s*(.+)$/);   // "12. word" hoặc "12) word"
        const w = norm((m ? m[1] : ln).trim().toLowerCase());
        if(w) words.push(w);
      }
      if(!words.length){ dsLog('File không có từ nào đọc được.', 'warn'); return; }

      const have = new Set(await dsAllWords());
      const q = missLoad();
      const set = new Set(q.list || []);
      let addedNew = 0, hadAlready = 0, inLib = 0;
      for(const w of words){
        if(have.has(w)){ inLib++; continue; }           // đã có nghĩa rồi, không cần queue
        if(set.has(w)){ hadAlready++; continue; }
        set.add(w); addedNew++;
      }
      q.list = [...set];
      missSave(q);
      dsLog('Nhập xong: thêm ' + addedNew + ' từ vào hàng đợi, '
            + hadAlready + ' đã có trong đợi, ' + inLib + ' đã có nghĩa trong thư viện.', 'ok');
      if(typeof missRefreshState === 'function') missRefreshState();
      dsState();
    }catch(e){
      dsLog('Không đọc được file: ' + (e.message || e), 'bad');
    }
  }

  /* ============================================================
     TRẠNG THÁI
     ============================================================ */
  async function dsState(){
    const el = document.querySelector('#ds-state');
    if(!el) return;
    try{
      const n = await dsCount();
      const applied = lsGet(LS_APPLIED, { version: null, files: [] });
      const q = missLoad();
      const cache = lsGet(LS_FREE, {});
      const checked = Object.keys(cache).length;
      el.innerHTML =
          'Thư viện: <b style="color:var(--primary)">' + n.toLocaleString() + '</b> từ'
        + ' · bản dữ liệu đã áp dụng: <b>' + (applied.version || 'chưa có') + '</b>'
        + '<br/>Hàng đợi từ thiếu: <b>' + ((q.list || []).length).toLocaleString() + '</b>'
        + ' · đã kiểm tra miễn phí: <b>' + checked.toLocaleString() + '</b> từ';
    }catch(e){
      el.textContent = 'Không đọc được trạng thái: ' + (e.message || e);
    }
  }

  /* ============================================================
     NỐI VÀO UI + PHƠI RA WINDOW ĐỂ GỌI TAY TRONG CONSOLE
     ============================================================ */
  function wire(){
    const on = (sel, fn) => { const el = document.querySelector(sel); if(el) el.addEventListener('click', fn); };
    on('#ds-sync-btn',   () => dsSync(false));
    on('#ds-resync-btn', () => { if(confirm('Áp dụng lại TẤT CẢ shard từ đầu?')) dsSync(true); });
    on('#ds-screen-btn', () => dsScreen());
    on('#ds-export-btn', () => dsExport());
    on('#ds-import-btn', () => { const f = document.querySelector('#ds-import-file'); if(f) f.click(); });
    const f = document.querySelector('#ds-import-file');
    if(f) f.addEventListener('change', e => { if(e.target.files[0]) dsImport(e.target.files[0]); e.target.value = ''; });
    dsState();
  }

  window.dsSync   = dsSync;
  window.dsScreen = dsScreen;
  window.dsExport = dsExport;
  window.dsImport = dsImport;
  window.dsCount  = dsCount;
  window.dsState  = dsState;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
