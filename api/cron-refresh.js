// api/cron-refresh.js — Pré-génération nocturne via Anthropic Batch API
// Tourne toutes les 2 semaines à 2h du matin (configuré dans vercel.json)
// Génère les 80 actions CAC40+Nasdaq100 et les stocke dans Supabase

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

// ── LISTE DES 80 ACTIONS ─────────────────────────────────────────────────────
const ACTIONS = [
  // CAC 40
  {t:'MC.PA',n:'LVMH',e:'paris',s:'Consumer Cyclical'},
  {t:'TTE.PA',n:'TotalEnergies',e:'paris',s:'Energy'},
  {t:'SAN.PA',n:'Sanofi',e:'paris',s:'Healthcare'},
  {t:'AI.PA',n:'Air Liquide',e:'paris',s:'Basic Materials'},
  {t:'AIR.PA',n:'Airbus',e:'paris',s:'Industrials'},
  {t:'BNP.PA',n:'BNP Paribas',e:'paris',s:'Financial Services'},
  {t:'SU.PA',n:'Schneider Electric',e:'paris',s:'Industrials'},
  {t:'OR.PA',n:'L\'Oréal',e:'paris',s:'Consumer Defensive'},
  {t:'RI.PA',n:'Pernod Ricard',e:'paris',s:'Consumer Defensive'},
  {t:'DSY.PA',n:'Dassault Systèmes',e:'paris',s:'Technology'},
  {t:'ACA.PA',n:'Crédit Agricole',e:'paris',s:'Financial Services'},
  {t:'GLE.PA',n:'Société Générale',e:'paris',s:'Financial Services'},
  {t:'KER.PA',n:'Kering',e:'paris',s:'Consumer Cyclical'},
  {t:'HO.PA',n:'Thales',e:'paris',s:'Industrials'},
  {t:'CAP.PA',n:'Capgemini',e:'paris',s:'Technology'},
  {t:'CS.PA',n:'AXA',e:'paris',s:'Financial Services'},
  {t:'ORA.PA',n:'Orange',e:'paris',s:'Communication Services'},
  {t:'VIE.PA',n:'Veolia',e:'paris',s:'Utilities'},
  {t:'DG.PA',n:'Vinci',e:'paris',s:'Industrials'},
  {t:'EN.PA',n:'Bouygues',e:'paris',s:'Industrials'},
  {t:'SGO.PA',n:'Saint-Gobain',e:'paris',s:'Basic Materials'},
  {t:'NG.PA',n:'Safran',e:'paris',s:'Industrials'},
  {t:'VIV.PA',n:'Vivendi',e:'paris',s:'Communication Services'},
  {t:'RMS.PA',n:'Hermès',e:'paris',s:'Consumer Cyclical'},
  {t:'SOP.PA',n:'Sopra Steria',e:'paris',s:'Technology'},
  {t:'EL.PA',n:'EssilorLuxottica',e:'paris',s:'Healthcare'},
  {t:'SW.PA',n:'Sodexo',e:'paris',s:'Industrials'},
  {t:'AKE.PA',n:'Arkema',e:'paris',s:'Basic Materials'},
  {t:'TCH.PA',n:'Teleperformance',e:'paris',s:'Industrials'},
  {t:'URW.PA',n:'Unibail-Rodamco',e:'paris',s:'Real Estate'},
  {t:'ML.PA',n:'Michelin',e:'paris',s:'Consumer Cyclical'},
  {t:'ENGI.PA',n:'Engie',e:'paris',s:'Utilities'},
  {t:'RNO.PA',n:'Renault',e:'paris',s:'Consumer Cyclical'},
  {t:'FR.PA',n:'Valeo',e:'paris',s:'Consumer Cyclical'},
  {t:'WLN.PA',n:'Worldline',e:'paris',s:'Technology'},
  {t:'ERF.PA',n:'Eurofins',e:'paris',s:'Healthcare'},
  {t:'PUB.PA',n:'Publicis',e:'paris',s:'Communication Services'},
  {t:'STM.PA',n:'STMicroelectronics',e:'paris',s:'Technology'},
  {t:'LR.PA',n:'Legrand',e:'paris',s:'Industrials'},
  {t:'EDF.PA',n:'EDF',e:'paris',s:'Utilities'},
  // NASDAQ 100
  {t:'AAPL',n:'Apple',e:'nasdaq',s:'Technology'},
  {t:'MSFT',n:'Microsoft',e:'nasdaq',s:'Technology'},
  {t:'NVDA',n:'Nvidia',e:'nasdaq',s:'Technology'},
  {t:'AMZN',n:'Amazon',e:'nasdaq',s:'Consumer Cyclical'},
  {t:'GOOGL',n:'Alphabet',e:'nasdaq',s:'Communication Services'},
  {t:'META',n:'Meta Platforms',e:'nasdaq',s:'Communication Services'},
  {t:'TSLA',n:'Tesla',e:'nasdaq',s:'Consumer Cyclical'},
  {t:'AVGO',n:'Broadcom',e:'nasdaq',s:'Technology'},
  {t:'COST',n:'Costco',e:'nasdaq',s:'Consumer Defensive'},
  {t:'ASML',n:'ASML',e:'nasdaq',s:'Technology'},
  {t:'NFLX',n:'Netflix',e:'nasdaq',s:'Communication Services'},
  {t:'AZN',n:'AstraZeneca',e:'nasdaq',s:'Healthcare'},
  {t:'AMD',n:'AMD',e:'nasdaq',s:'Technology'},
  {t:'QCOM',n:'Qualcomm',e:'nasdaq',s:'Technology'},
  {t:'INTC',n:'Intel',e:'nasdaq',s:'Technology'},
  {t:'INTU',n:'Intuit',e:'nasdaq',s:'Technology'},
  {t:'AMAT',n:'Applied Materials',e:'nasdaq',s:'Technology'},
  {t:'MU',n:'Micron',e:'nasdaq',s:'Technology'},
  {t:'LRCX',n:'Lam Research',e:'nasdaq',s:'Technology'},
  {t:'ADI',n:'Analog Devices',e:'nasdaq',s:'Technology'},
  {t:'PANW',n:'Palo Alto Networks',e:'nasdaq',s:'Technology'},
  {t:'KLAC',n:'KLA Corp',e:'nasdaq',s:'Technology'},
  {t:'MRVL',n:'Marvell Technology',e:'nasdaq',s:'Technology'},
  {t:'SNPS',n:'Synopsys',e:'nasdaq',s:'Technology'},
  {t:'CDNS',n:'Cadence Design',e:'nasdaq',s:'Technology'},
  {t:'CRWD',n:'CrowdStrike',e:'nasdaq',s:'Technology'},
  {t:'ABNB',n:'Airbnb',e:'nasdaq',s:'Consumer Cyclical'},
  {t:'ZS',n:'Zscaler',e:'nasdaq',s:'Technology'},
  {t:'DDOG',n:'Datadog',e:'nasdaq',s:'Technology'},
  {t:'TTD',n:'The Trade Desk',e:'nasdaq',s:'Technology'},
  {t:'TEAM',n:'Atlassian',e:'nasdaq',s:'Technology'},
  {t:'WDAY',n:'Workday',e:'nasdaq',s:'Technology'},
  {t:'ADSK',n:'Autodesk',e:'nasdaq',s:'Technology'},
  {t:'GILD',n:'Gilead Sciences',e:'nasdaq',s:'Healthcare'},
  {t:'AMGN',n:'Amgen',e:'nasdaq',s:'Healthcare'},
  {t:'VRTX',n:'Vertex Pharma',e:'nasdaq',s:'Healthcare'},
  {t:'REGN',n:'Regeneron',e:'nasdaq',s:'Healthcare'},
  {t:'IDXX',n:'Idexx Laboratories',e:'nasdaq',s:'Healthcare'},
  {t:'ZTS',n:'Zoetis',e:'nasdaq',s:'Healthcare'},
  {t:'ISRG',n:'Intuitive Surgical',e:'nasdaq',s:'Healthcare'},
];

// ── SUPABASE HELPERS ─────────────────────────────────────────────────────────
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
  } catch(e) {}
}

// ── BUILD PROMPT ─────────────────────────────────────────────────────────────
function buildPrompt(action) {
  const isEUR = action.e === 'paris';
  const currSym = isEUR ? '€' : '$';
  const sectorLow = (action.s || '').toLowerCase();
  const isGrowth = ['technology','tech','software','cloud','semiconductor','consumer cyclical'].some(s => sectorLow.includes(s));
  const isPharma = ['pharmaceutical','biotech','healthcare','pharma'].some(s => sectorLow.includes(s));
  const isCyclical = !isGrowth && ['energy','oil','mining','steel','automotive','construction','basic materials'].some(s => sectorLow.includes(s));
  const isValue = !isGrowth && !isPharma && !isCyclical;

  let profileLabel, profileInstructions, primaryMetrics, penalizedMetrics;
  if (isGrowth) {
    profileLabel = 'CROISSANCE'; primaryMetrics = 'EV/Revenue, PEG, croissance CA';
    penalizedMetrics = 'NE PAS pénaliser P/E élevé si croissance >15%';
    profileInstructions = 'EV/Revenue<5x+croissance>20%=attractif';
  } else if (isPharma) {
    profileLabel = 'PHARMA'; primaryMetrics = 'Pipeline, P/FCF, R&D/CA';
    penalizedMetrics = 'NE PAS utiliser P/E principal';
    profileInstructions = 'Pipeline phase3=prime. P/FCF<15x=attractif';
  } else if (isCyclical) {
    profileLabel = 'CYCLIQUE'; primaryMetrics = 'P/B, EV/EBITDA normalisé, FCF';
    penalizedMetrics = 'NE PAS utiliser P/E au pic cycle';
    profileInstructions = 'Bas cycle→prime redressement. P/B<1=opportunité';
  } else {
    profileLabel = 'VALUE'; primaryMetrics = 'P/E, P/B, dividende, ROE, ROIC';
    penalizedMetrics = 'Pénaliser P/E>20x';
    profileInstructions = 'P/E<médiane+ROE stable=attractif. Div>3%+payout<60%=soutenable';
  }

  return `Analyste financier senior. Analyse ${action.n} (${action.t}), ${isEUR?'Euronext Paris':'NYSE/NASDAQ'}, secteur: ${action.s}.
PROFIL: ${profileLabel} — ${profileInstructions}
MÉTRIQUES: ${primaryMetrics} | RÈGLE: ${penalizedMetrics}
Utilise tes connaissances sur cette entreprise pour les données financières.
DONNÉES HISTORIQUES (4 ans 2021-2024): bnaHistory, divHistory, debtHistory, roicHistory(%), fcfAbsHistory(M+unit), ca, earnings, perHistory, fcfYieldHistory
CALCUL JUSTE PRIX: base DCF/multiples → ajustements qualitatifs % → final → sécurité=final×0.95
RÈGLES: reco selon profil. Score 1-10 vs pairs. ~30%ACHETER/40%NEUTRE/30%VENDRE.
JSON STRICT sans backticks:
{"reco":"ACHETER|ACCUMULER|NEUTRE|ALLÉGER|VENDRE","profile":"${profileLabel}","target":"X ${currSym}","upside":"+X%","nextEvent":{"label":"","date":""},"kpis":[{"label":"","val":"","sub":"","color":"teal"},{"label":"","val":"","sub":"","color":"green"},{"label":"","val":"","sub":"","color":"blue"}],"ca":{"labels":["2021","2022","2023","2024"],"data":[],"unit":"Md${currSym}"},"earnings":{"labels":["2021","2022","2023","2024"],"net":[],"netUnit":"M${currSym}","margin":[]},"segments":{"labels":[],"pct":[],"caRaw":[],"unit":"M${currSym}"},"peers":{"labels":[],"pe":[],"ev":[]},"perHistory":{"labels":["2021","2022","2023","2024"],"data":[],"avg":0},"fcfYieldHistory":{"labels":["2021","2022","2023","2024"],"data":[]},"valScore":5,"valLights":[{"label":"","val":"","signal":"green"},{"label":"","val":"","signal":"amber"},{"label":"","val":"","signal":"green"},{"label":"","val":"","signal":"red"}],"justePrice":{"base":0,"baseLabel":"","adjustments":[{"label":"","impact":0,"positive":true}],"final":0,"safetyMarginPct":5,"currentPrice":0,"vsCurrentPct":0,"dcf":{"labels":["2025e","2026e","2027e","2028e","Val.term."],"data":[],"unit":"M${currSym}"},"qualitativeImpact":""},"expectedReturn":0,"expectedReturnDetail":"","bnaHistory":{"labels":["2021","2022","2023","2024"],"data":[]},"divHistory":{"labels":["2021","2022","2023","2024"],"data":[]},"debtHistory":{"labels":["2021","2022","2023","2024"],"data":[]},"roicHistory":{"labels":["2021","2022","2023","2024"],"data":[]},"fcfAbsHistory":{"labels":["2021","2022","2023","2024"],"data":[],"unit":"M"},"ratios":[{"l":"","v":"","c":"green"}],"qualitative":{"positives":[],"negatives":[],"governance":"","moat":""},"news":[{"title":"","summary":"","impact":"positive","date":""},{"title":"","summary":"","impact":"neutral","date":""}],"calendar":[{"label":"","date":"","type":"results"}],"catalysts":[{"icon":"🎯","title":"","text":""},{"icon":"📈","title":"","text":""}],"risks":[{"warn":false,"title":"","text":""},{"warn":true,"title":"","text":""}],"verdict":""}`;
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Sécurité : vérifier le token cron Vercel
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const CACHE_DAYS = 14;
  const now = Date.now();
  const toRefresh = [];

  // Identifier les actions qui ont besoin d'être rafraîchies
  for (const action of ACTIONS) {
    const cached = await sbGet(action.t);
    if (!cached) {
      toRefresh.push(action);
    } else {
      const ageDays = (now - new Date(cached.updated_at).getTime()) / 86400000;
      if (ageDays >= CACHE_DAYS) toRefresh.push(action);
    }
  }

  if (toRefresh.length === 0) {
    return res.status(200).json({ message: 'Tout est à jour', refreshed: 0 });
  }

  // Construire les requêtes Batch
  const batchRequests = toRefresh.map(action => ({
    custom_id: action.t,
    params: {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3500,
      messages: [{ role: 'user', content: buildPrompt(action) }]
    }
  }));

  // Envoyer le Batch à Anthropic
  const batchRes = await fetch('https://api.anthropic.com/v1/messages/batches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'message-batches-2024-09-24'
    },
    body: JSON.stringify({ requests: batchRequests })
  });

  const batchData = await batchRes.json();
  if (!batchRes.ok) {
    return res.status(500).json({ error: batchData.error?.message || 'Batch API error', detail: batchData });
  }

  const batchId = batchData.id;

  // Polling : attendre que le batch soit terminé (max 10 min)
  let attempts = 0;
  let results = null;
  while (attempts < 60) {
    await new Promise(r => setTimeout(r, 10000)); // attendre 10s
    const statusRes = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'message-batches-2024-09-24'
      }
    });
    const statusData = await statusRes.json();
    if (statusData.processing_status === 'ended') {
      // Récupérer les résultats
      const resultsRes = await fetch(statusData.results_url, {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'message-batches-2024-09-24'
        }
      });
      const text = await resultsRes.text();
      // Résultats en JSONL (une ligne par résultat)
      results = text.trim().split('\n').map(line => JSON.parse(line));
      break;
    }
    attempts++;
  }

  if (!results) {
    return res.status(202).json({ message: 'Batch lancé mais timeout polling', batchId, queued: toRefresh.length });
  }

  // Stocker chaque résultat dans Supabase
  let saved = 0;
  for (const result of results) {
    if (result.result?.type === 'succeeded') {
      try {
        const raw = result.result.message.content.map(c => c.text || '').join('');
        const clean = raw.replace(/```json|```/g, '').trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          await sbUpsert(result.custom_id, parsed);
          saved++;
        }
      } catch(e) { /* continuer */ }
    }
  }

  return res.status(200).json({
    message: `Batch terminé`,
    batchId,
    queued: toRefresh.length,
    saved,
    failed: results.length - saved
  });
}
