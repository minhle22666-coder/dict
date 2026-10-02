/* Focci's shared Gemini keys, kept on the server.

   The repo is public, so the keys cannot be in the app's code: bots scan
   GitHub for Google keys within minutes and Google disables keys it finds
   there. They live in the Vercel project's environment variable
   GEMINI_KEYS (one per line, or comma-separated) and the app calls this
   function instead of Google when it is using "Focci key N".

   POST { path: "models/<model>:generateContent", body: {...}, key: N }
     -> Google's own response. Key N is tried first; if it answers 429
        (quota), 401/403 (refused) or 5xx, the next key is tried, and the
        response says which one answered in the x-focci-key header.
   GET ?status=1
     -> { keys: [{ n, ok, code }] } -- each key checked with a models list
        (costs no generation quota), remembered for two minutes. */
const BASE = 'https://generativelanguage.googleapis.com/v1beta/';
const PATH_OK = /^models\/[A-Za-z0-9._-]+:(generateContent|countTokens)$/;
let statusCache = null;

function keys() {
  return String(process.env.GEMINI_KEYS || '').split(/[\s,]+/).map((k) => k.trim()).filter(Boolean);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const K = keys();
  if (!K.length) { res.status(503).json({ error: { message: 'No shared keys set up (GEMINI_KEYS).' } }); return; }

  if (req.method === 'GET') {
    if (statusCache && Date.now() - statusCache.at < 120000) { res.status(200).json(statusCache.data); return; }
    const out = await Promise.all(K.map(async (k, i) => {
      try {
        const r = await fetch(BASE + 'models?pageSize=1&key=' + encodeURIComponent(k));
        return { n: i + 1, ok: r.ok, code: r.status };
      } catch (e) { return { n: i + 1, ok: false, code: 0 }; }
    }));
    statusCache = { at: Date.now(), data: { keys: out } };
    res.status(200).json(statusCache.data);
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: { message: 'POST or GET only' } }); return; }
  let p = req.body;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } }
  if (!p || !PATH_OK.test(String(p.path || ''))) { res.status(400).json({ error: { message: 'Bad request' } }); return; }
  const first = Math.max(0, Math.min(K.length - 1, (parseInt(p.key, 10) || 1) - 1));
  const order = K.map((_, i) => (first + i) % K.length);
  let last = null;
  for (let j = 0; j < order.length; j++) {
    const i = order[j];
    try {
      const r = await fetch(BASE + p.path + '?key=' + encodeURIComponent(K[i]), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p.body || {})
      });
      const text = await r.text();
      last = { status: r.status, text, n: i + 1 };
      // a key Google no longer accepts comes back as 400 API_KEY_INVALID, not 401: move on from that too
      const badKey = r.status === 400 && /API_KEY_INVALID|API key not valid|API_KEY_/.test(text);
      const retry = badKey || r.status === 429 || r.status === 401 || r.status === 403 || r.status >= 500;
      if (!retry || j === order.length - 1) break;
    } catch (e) {
      last = { status: 502, text: JSON.stringify({ error: { message: 'Could not reach Gemini' } }), n: i + 1 };
    }
  }
  res.setHeader('x-focci-key', String(last.n));
  res.setHeader('Content-Type', 'application/json');
  res.status(last.status).send(last.text);
};
