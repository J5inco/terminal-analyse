// api/analyze.js — J5 Investment · Cache 7j + Qualitatif + Juste Prix
// Supabase via REST API directe — aucun import npm requis
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

async function sbUpsert(ticker, data) {
  if (!SB_URL || !SB_KEY) return;
  try {
    await fetch(`${SB_URL}/rest/v1/analyses_cache`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ ticker: ticker.toUpperCase(), data, updated_at: new Date().toISOString() })
    });
  } catch(e) { /* non critique */ }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    ticker, name, exchange, sector, price, high52, low52,
    pe, eps, netMargin, beta, divYield, forwardPE, evToEbitda,
    priceToBook, priceFCF, pegRatio, roe, operatingMargin,
    debtToEquity, revenueGrowth, fcfPerShare, forceRefresh
  } = req.body;

  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  // ── CHECK CACHE 7 JOURS ───────────────────────────────────
  if (!forceRefresh) {
    const cached = await sbGet(ticker.toUpperCase());
    if (cached) {
      const ageDays = (Date.now() - new Date(cached.updated_at).getTime()) / 86400000;
      if (ageDays < 7) {
        return res.status(200).json({ ...cached.data, _cached: true, _cachedAt: cached.updated_at });
      }
    }
  }

  // ── PROFIL DETECTION ─────────────────────────────────────
  const tickerShort = ticker.replace('.PA','').replace('-','.');
  const isEUR = exchange === 'paris';
  const currSym = isEUR ? '€' : '$';
  const growthRate = parseFloat(revenueGrowth) || 0;
  const peVal = parseFloat(forwardPE || pe) || 0;
  const sectorLow = (sector || '').toLowerCase();
  const priceNum = parseFloat(price) || 0;
  const high52Num = parseFloat(high52) || 0;
  const low52Num = parseFloat(low52) || 0;

  const isGrowth = growthRate > 15 || peVal > 35 ||
    ['technology','tech','software','cloud','e-commerce','semiconductor','consumer cyclical'].some(s => sectorLow.includes(s));
  const isPharma = ['pharmaceutical','biotech','healthcare','pharma','biotechnologie'].some(s => sectorLow.includes(s));
  const isCyclical = !isGrowth && ['energy','oil','mining','steel','automotive','construction','basic materials'].some(s => sectorLow.includes(s));
  const isValue = !isGrowth && !isPharma && !isCyclical &&
    ['bank','insurance','utilities','telecom','real estate','banque','assurance','financial'].some(s => sectorLow.includes(s));

  let profileLabel, profileInstructions, primaryMetrics, penalizedMetrics;
  if (isGrowth) {
    profileLabel = 'CROISSANCE'; primaryMetrics = 'EV/Revenue, EV/EBITDA, Rule of 40, PEG, croissance CA';
    penalizedMetrics = 'NE PAS pénaliser P/E élevé si croissance CA > 15%. P/E 40-80x normal pour tech.';
    profileInstructions = 'CROISSANCE : EV/Revenue < 5x + croissance >20% = attractif. EV/Revenue > 20x + ralentissement = surévalué. Rule of 40 > 40 = positif.';
  } else if (isPharma) {
    profileLabel = 'PHARMA/BIOTECH'; primaryMetrics = 'Pipeline phases, P/FCF, marge nette, R&D/CA, brevets';
    penalizedMetrics = 'NE PAS utiliser P/E principal. R&D comprime bénéfices artificiellement.';
    profileInstructions = 'PHARMA : pipeline phase 3 = prime justifiée. Brevets < 3 ans = risque générique. P/FCF < 15x = attractif.';
  } else if (isCyclical) {
    profileLabel = 'CYCLIQUE'; primaryMetrics = 'P/B, EV/EBITDA normalisé cycle, dette nette, FCF bas de cycle';
    penalizedMetrics = 'NE PAS utiliser P/E au pic cycle. EV/EBITDA normalisé sur 7-10 ans.';
    profileInstructions = 'CYCLIQUE : haut cycle → pénaliser. Bas cycle → prime redressement. P/B < 1 en bas cycle = opportunité.';
  } else if (isValue) {
    profileLabel = 'VALUE/RENDEMENT'; primaryMetrics = 'P/E vs médiane, P/B, dividende yield+croissance, ROE, ROIC';
    penalizedMetrics = 'Pénaliser P/E > 20x. Dividende non couvert FCF = signal négatif fort.';
    profileInstructions = 'VALUE : P/E < médiane + ROE stable = attractif. Dividende > 3% + payout < 60% = soutenable.';
  } else {
    profileLabel = 'QUALITÉ'; primaryMetrics = 'PEG, ROIC, FCF Yield, croissance dividende, pricing power';
    penalizedMetrics = 'P/E premium 20-30x JUSTIFIÉ si ROIC > 15%. Pénaliser seulement P/E > 35x sans accélération.';
    profileInstructions = 'QUALITÉ : ROIC > 15% régulier → P/E premium justifié. PEG < 1.5 = attractif. FCF Yield > 4% = solide.';
  }

  // ── RANGE 52S ─────────────────────────────────────────────
  let rangeContext = '';
  if (priceNum > 0 && high52Num > 0 && low52Num > 0 && high52Num > low52Num) {
    const pos = ((priceNum - low52Num) / (high52Num - low52Num) * 100).toFixed(0);
    const corr = ((high52Num - priceNum) / high52Num * 100).toFixed(0);
    if (pos <= 20) rangeContext = `⚠️ ZONE BASSE (${pos}% du range, -${corr}% depuis plus haut). NE PAS recommander ALLÉGER/VENDRE sauf détérioration structurelle.`;
    else if (pos <= 35) rangeContext = `Zone basse-médiane (${pos}%, -${corr}% depuis plus haut). Pessimisme déjà pricé.`;
    else if (pos >= 85) rangeContext = `⚠️ ZONE HAUTE (${pos}%). Peu de marge avant les plus hauts — prudence.`;
    else rangeContext = `Milieu de range (${pos}%, -${corr}% depuis plus haut).`;
  }

  // Qualitatif intégré dans le prompt principal (web search désactivé — limite tokens)
  const qualitativeContext = 'Utilise tes connaissances sur cette entreprise pour les données qualitatives.';

  // ── MAIN PROMPT ───────────────────────────────────────────
  const prompt = `Analyste financier senior. Analyse ${name} (${ticker}), ${isEUR?'Euronext Paris':'NYSE/NASDAQ'}, secteur: ${sector||'N/A'}.

PROFIL: ${profileLabel} — ${profileInstructions}
MÉTRIQUES: ${primaryMetrics} | RÈGLE: ${penalizedMetrics}

DATA: cours ${price} | range 52s ${low52||'N/A'}-${high52||'N/A'} | ${rangeContext}
PE=${pe||'N/A'} fwdPE=${forwardPE||'N/A'} PEG=${pegRatio||'N/A'} EV/EBITDA=${evToEbitda||'N/A'} PB=${priceToBook||'N/A'} PFCF=${priceFCF||'N/A'}
BNA=${eps||'N/A'} FCF/act=${fcfPerShare||'N/A'} ROE=${roe||'N/A'} mgNette=${netMargin||'N/A'} mgOper=${operatingMargin||'N/A'}
dette/FP=${debtToEquity||'N/A'} beta=${beta||'N/A'} caCroiss=${revenueGrowth||'N/A'} divYield=${divYield||'N/A'}

QUALITATIF: ${qualitativeContext.slice(0,400)}

CALCUL JUSTE PRIX: 1) base DCF/multiples 2) ajustements qualitatifs en % 3) final=base+ajust 4) sécurité=final×0.95 (marge 5%)

RÈGLES: reco selon profil ${profileLabel}+qualitatif. Score 1-10 vs pairs. ~30%ACHETER/40%NEUTRE/30%VENDRE. Si correction>25% depuis plus haut: pas ALLÉGER/VENDRE.

Réponds UNIQUEMENT en JSON valide, sans backticks:
{"reco":"ACHETER|ACCUMULER|NEUTRE|ALLÉGER|VENDRE","profile":"${profileLabel}","target":"X ${currSym}","upside":"+X%","nextEvent":{"label":"","date":""},"kpis":[{"label":"","val":"","sub":"","color":"teal"}],"ca":{"labels":[],"data":[],"unit":"Md${currSym}"},"earnings":{"labels":[],"net":[],"netUnit":"M${currSym}","margin":[]},"segments":{"labels":[],"pct":[],"ca":[],"caRaw":[],"unit":"M${currSym}"},"peers":{"labels":[],"pe":[]},"peersEv":{"labels":[],"data":[]},"perHistory":{"labels":[],"data":[],"avg":0},"fcfYieldHistory":{"labels":[],"data":[]},"valScore":5,"valLights":[{"label":"","val":"","signal":"green|amber|red"}],"valPosition":[{"label":"","pct":0,"vs":"cheaper|expensive"}],"justePrice":{"base":0,"baseLabel":"","adjustments":[{"label":"","impact":0,"positive":true}],"final":0,"safetyMargin":0,"safetyMarginPct":5,"currentPrice":${priceNum||0},"vsCurrentPct":0,"dcf":{"labels":["2025e","2026e","2027e","2028e","2029e","Val.term."],"data":[],"unit":"M${currSym}"},"qualitativeImpact":""},"expectedReturn":0,"expectedReturnDetail":"","bnaHistory":{"labels":[],"data":[]},"divHistory":{"labels":[],"data":[]},"debtHistory":{"labels":[],"data":[]},"roicHistory":{"labels":["2019","2020","2021","2022","2023","2024"],"data":[]},"fcfAbsHistory":{"labels":["2019","2020","2021","2022","2023","2024"],"data":[],"unit":"M"},"ratios":[{"l":"","v":"","c":"green"}],"qualitative":{"positives":[],"negatives":[],"governance":"","esg":"","moat":""},"news":[{"title":"","summary":"","impact":"positive|neutral|negative","date":""}],"calendar":[{"label":"","date":"","type":"results|dividend|ag"}],"catalysts":[{"icon":"🎯","title":"","text":""}],"risks":[{"warn":false,"title":"","text":""}],"verdict":""}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 5000, messages: [{ role: 'user', content: prompt }] }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' });

    let raw = data.content.map(c => c.text || '').join('');
    raw = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Réponse IA invalide' });

    const result = JSON.parse(jsonMatch[0]);

    // Store in cache
    await sbUpsert(ticker.toUpperCase(), result);

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
