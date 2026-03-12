// api/analyze.js — J5 Investment · Cache only (analyses via cron-refresh)
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

async function sbGet(ticker) {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/analyses_cache?ticker=eq.${encodeURIComponent(ticker)}&limit=1`, {
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
    });
    const arr = await r.json();
    return arr?.[0] || null;
  } catch(e) { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker } = req.body;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  // Retourne uniquement le cache Supabase
  const cached = await sbGet(ticker.toUpperCase());

  if (cached) {
    return res.status(200).json({
      ...cached.data,
      _cached: true,
      _cachedAt: cached.updated_at
    });
  }

  // Pas de cache — retourne un objet vide structuré
  // Le frontend affichera "Analyse en cours de génération"
  return res.status(200).json({
    _cached: false,
    _pending: true,
    reco: 'NEUTRE',
    verdict: 'Analyse en cours de génération. Revenez dans quelques minutes.',
    valScore: 0,
    kpis: [],
    valLights: [],
    catalysts: [],
    risks: [],
    news: [],
    calendar: [],
    ca: { labels: [], data: [], unit: '' },
    earnings: { labels: [], net: [], margin: [] },
    segments: { labels: [], pct: [], caRaw: [] },
    peers: { labels: [], pe: [], ev: [] },
    justePrice: { base: 0, final: 0, currentPrice: 0, vsCurrentPct: 0, adjustments: [], dcf: { labels: [], data: [] } },
    bnaHistory: { labels: [], data: [] },
    divHistory: { labels: [], data: [] },
    debtHistory: { labels: [], data: [] },
    roicHistory: { labels: [], data: [] },
    fcfAbsHistory: { labels: [], data: [] },
    perHistory: { labels: [], data: [], avg: 0 },
    fcfYieldHistory: { labels: [], data: [] },
    ratios: [],
    qualitative: { positives: [], negatives: [], governance: '', moat: '' }
  });
}
