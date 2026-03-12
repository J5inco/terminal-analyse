const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const ACTIONS = [
  { t: 'MC.PA', n: 'LVMH', e: 'paris', s: 'Consumer Cyclical' },
  { t: 'TTE.PA', n: 'TotalEnergies', e: 'paris', s: 'Energy' },
  { t: 'SAN.PA', n: 'Sanofi', e: 'paris', s: 'Healthcare' },
  { t: 'AI.PA', n: 'Air Liquide', e: 'paris', s: 'Basic Materials' },
  { t: 'AIR.PA', n: 'Airbus', e: 'paris', s: 'Industrials' },
  { t: 'BNP.PA', n: 'BNP Paribas', e: 'paris', s: 'Financial Services' },
  { t: 'SU.PA', n: 'Schneider Electric', e: 'paris', s: 'Industrials' },
  { t: 'OR.PA', n: "L'Oreal", e: 'paris', s: 'Consumer Defensive' },
  { t: 'RI.PA', n: 'Pernod Ricard', e: 'paris', s: 'Consumer Defensive' },
  { t: 'DSY.PA', n: 'Dassault Systemes', e: 'paris', s: 'Technology' },
  { t: 'ACA.PA', n: 'Credit Agricole', e: 'paris', s: 'Financial Services' },
  { t: 'GLE.PA', n: 'Societe Generale', e: 'paris', s: 'Financial Services' },
  { t: 'KER.PA', n: 'Kering', e: 'paris', s: 'Consumer Cyclical' },
  { t: 'HO.PA', n: 'Thales', e: 'paris', s: 'Industrials' },
  { t: 'CAP.PA', n: 'Capgemini', e: 'paris', s: 'Technology' },
  { t: 'CS.PA', n: 'AXA', e: 'paris', s: 'Financial Services' },
  { t: 'ORA.PA', n: 'Orange', e: 'paris', s: 'Communication Services' },
  { t: 'VIE.PA', n: 'Veolia', e: 'paris', s: 'Utilities' },
  { t: 'DG.PA', n: 'Vinci', e: 'paris', s: 'Industrials' },
  { t: 'EN.PA', n: 'Bouygues', e: 'paris', s: 'Industrials' },
  { t: 'SGO.PA', n: 'Saint-Gobain', e: 'paris', s: 'Basic Materials' },
  { t: 'NG.PA', n: 'Safran', e: 'paris', s: 'Industrials' },
  { t: 'VIV.PA', n: 'Vivendi', e: 'paris', s: 'Communication Services' },
  { t: 'RMS.PA', n: 'Hermes', e: 'paris', s: 'Consumer Cyclical' },
  { t: 'SOP.PA', n: 'Sopra Steria', e: 'paris', s: 'Technology' },
  { t: 'EL.PA', n: 'EssilorLuxottica', e: 'paris', s: 'Healthcare' },
  { t: 'SW.PA', n: 'Sodexo', e: 'paris', s: 'Industrials' },
  { t: 'AKE.PA', n: 'Arkema', e: 'paris', s: 'Basic Materials' },
  { t: 'TCH.PA', n: 'Teleperformance', e: 'paris', s: 'Industrials' },
  { t: 'URW.PA', n: 'Unibail-Rodamco', e: 'paris', s: 'Real Estate' },
  { t: 'ML.PA', n: 'Michelin', e: 'paris', s: 'Consumer Cyclical' },
  { t: 'ENGI.PA', n: 'Engie', e: 'paris', s: 'Utilities' },
  { t: 'RNO.PA', n: 'Renault', e: 'paris', s: 'Consumer Cyclical' },
  { t: 'FR.PA', n: 'Valeo', e: 'paris', s: 'Consumer Cyclical' },
  { t: 'WLN.PA', n: 'Worldline', e: 'paris', s: 'Technology' },
  { t: 'ERF.PA', n: 'Eurofins', e: 'paris', s: 'Healthcare' },
  { t: 'PUB.PA', n: 'Publicis', e: 'paris', s: 'Communication Services' },
  { t: 'STM.PA', n: 'STMicroelectronics', e: 'paris', s: 'Technology' },
  { t: 'LR.PA', n: 'Legrand', e: 'paris', s: 'Industrials' },
  { t: 'EDF.PA', n: 'EDF', e: 'paris', s: 'Utilities' },
  { t: 'AAPL', n: 'Apple', e: 'nasdaq', s: 'Technology' },
  { t: 'MSFT', n: 'Microsoft', e: 'nasdaq', s: 'Technology' },
  { t: 'NVDA', n: 'Nvidia', e: 'nasdaq', s: 'Technology' },
  { t: 'AMZN', n: 'Amazon', e: 'nasdaq', s: 'Consumer Cyclical' },
  { t: 'GOOGL', n: 'Alphabet', e: 'nasdaq', s: 'Communication Services' },
  { t: 'META', n: 'Meta Platforms', e: 'nasdaq', s: 'Communication Services' },
  { t: 'TSLA', n: 'Tesla', e: 'nasdaq', s: 'Consumer Cyclical' },
  { t: 'AVGO', n: 'Broadcom', e: 'nasdaq', s: 'Technology' },
  { t: 'COST', n: 'Costco', e: 'nasdaq', s: 'Consumer Defensive' },
  { t: 'ASML', n: 'ASML', e: 'nasdaq', s: 'Technology' },
  { t: 'NFLX', n: 'Netflix', e: 'nasdaq', s: 'Communication Services' },
  { t: 'AZN', n: 'AstraZeneca', e: 'nasdaq', s: 'Healthcare' },
  { t: 'AMD', n: 'AMD', e: 'nasdaq', s: 'Technology' },
  { t: 'QCOM', n: 'Qualcomm', e: 'nasdaq', s: 'Technology' },
  { t: 'INTC', n: 'Intel', e: 'nasdaq', s: 'Technology' },
  { t: 'INTU', n: 'Intuit', e: 'nasdaq', s: 'Technology' },
  { t: 'AMAT', n: 'Applied Materials', e: 'nasdaq', s: 'Technology' },
  { t: 'MU', n: 'Micron', e: 'nasdaq', s: 'Technology' },
  { t: 'LRCX', n: 'Lam Research', e: 'nasdaq', s: 'Technology' },
  { t: 'ADI', n: 'Analog Devices', e: 'nasdaq', s: 'Technology' },
  { t: 'PANW', n: 'Palo Alto Networks', e: 'nasdaq', s: 'Technology' },
  { t: 'KLAC', n: 'KLA Corp', e: 'nasdaq', s: 'Technology' },
  { t: 'MRVL', n: 'Marvell Technology', e: 'nasdaq', s: 'Technology' },
  { t: 'SNPS', n: 'Synopsys', e: 'nasdaq', s: 'Technology' },
  { t: 'CDNS', n: 'Cadence Design', e: 'nasdaq', s: 'Technology' },
  { t: 'CRWD', n: 'CrowdStrike', e: 'nasdaq', s: 'Technology' },
  { t: 'ABNB', n: 'Airbnb', e: 'nasdaq', s: 'Consumer Cyclical' },
  { t: 'ZS', n: 'Zscaler', e: 'nasdaq', s: 'Technology' },
  { t: 'DDOG', n: 'Datadog', e: 'nasdaq', s: 'Technology' },
  { t: 'TTD', n: 'The Trade Desk', e: 'nasdaq', s: 'Technology' },
  { t: 'TEAM', n: 'Atlassian', e: 'nasdaq', s: 'Technology' },
  { t: 'WDAY', n: 'Workday', e: 'nasdaq', s: 'Technology' },
  { t: 'ADSK', n: 'Autodesk', e: 'nasdaq', s: 'Technology' },
  { t: 'GILD', n: 'Gilead Sciences', e: 'nasdaq', s: 'Healthcare' },
  { t: 'AMGN', n: 'Amgen', e: 'nasdaq', s: 'Healthcare' },
  { t: 'VRTX', n: 'Vertex Pharma', e: 'nasdaq', s: 'Healthcare' },
  { t: 'REGN', n: 'Regeneron', e: 'nasdaq', s: 'Healthcare' },
  { t: 'IDXX', n: 'Idexx Laboratories', e: 'nasdaq', s: 'Healthcare' },
  { t: 'ZTS', n: 'Zoetis', e: 'nasdaq', s: 'Healthcare' },
  { t: 'ISRG', n: 'Intuitive Surgical', e: 'nasdaq', s: 'Healthcare' }
];

async function sbRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    throw new Error(`Supabase error ${r.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function sbGetCache(ticker) {
  const rows = await sbRequest(
    `analyses_cache?ticker=eq.${encodeURIComponent(ticker)}&select=ticker,updated_at&limit=1`
  );
  return rows?.[0] || null;
}

async function sbInsertBatch({ batchId, tickers, meta }) {
  await sbRequest('analysis_batches', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: {
      batch_id: batchId,
      status: 'queued',
      tickers,
      source: 'cron-refresh',
      requested_at: new Date().toISOString(),
      meta: meta || {}
    }
  });
}

function buildPrompt(action) {
  const isEUR = action.e === 'paris';
  const currSym = isEUR ? 'EUR' : 'USD';
  const sectorLow = (action.s || '').toLowerCase();
  const isGrowth = ['technology', 'tech', 'software', 'cloud', 'semiconductor', 'consumer cyclical']
    .some(s => sectorLow.includes(s));
  const isPharma = ['pharmaceutical', 'biotech', 'healthcare', 'pharma']
    .some(s => sectorLow.includes(s));
  const isCyclical = !isGrowth && ['energy', 'oil', 'mining', 'steel', 'automotive', 'construction', 'basic materials']
    .some(s => sectorLow.includes(s));

  let profileLabel, profileInstructions, primaryMetrics, penalizedMetrics;
  if (isGrowth) {
    profileLabel = 'CROISSANCE';
    primaryMetrics = 'EV/Revenue, PEG, croissance CA';
    penalizedMetrics = 'NE PAS penaliser P/E eleve si croissance >15%';
    profileInstructions = 'EV/Revenue<5x+croissance>20%=attractif';
  } else if (isPharma) {
    profileLabel = 'PHARMA';
    primaryMetrics = 'Pipeline, P/FCF, R&D/CA';
    penalizedMetrics = 'NE PAS utiliser P/E principal';
    profileInstructions = 'Pipeline phase3=prime. P/FCF<15x=attractif';
  } else if (isCyclical) {
    profileLabel = 'CYCLIQUE';
    primaryMetrics = 'P/B, EV/EBITDA normalise, FCF';
    penalizedMetrics = 'NE PAS utiliser P/E au pic cycle';
    profileInstructions = 'Bas cycle=>prime redressement. P/B<1=opportunite';
  } else {
    profileLabel = 'VALUE';
    primaryMetrics = 'P/E, P/B, dividende, ROE, ROIC';
    penalizedMetrics = 'Penaliser P/E>20x';
    profileInstructions = 'P/E<mediane+ROE stable=attractif. Div>3%+payout<60%=soutenable';
  }

  return `Analyste financier senior. Analyse ${action.n} (${action.t}), ${isEUR ? 'Euronext Paris' : 'NYSE/NASDAQ'}, secteur: ${action.s}. PROFIL: ${profileLabel} - ${profileInstructions} METRIQUES: ${primaryMetrics} | REGLE: ${penalizedMetrics} Utilise tes connaissances sur cette entreprise pour les donnees financieres. DONNEES HISTORIQUES (4 ans 2021-2024): bnaHistory, divHistory, debtHistory, roicHistory(%), fcfAbsHistory(M+unit), ca, earnings, perHistory, fcfYieldHistory CALCUL JUSTE PRIX: base DCF/multiples -> ajustements qualitatifs % -> final -> securite=final*0.95 REGLES: reco selon profil. Score 1-10 vs pairs. ~30%ACHETER/40%NEUTRE/30%VENDRE. JSON STRICT sans backticks: {"reco":"ACHETER|ACCUMULER|NEUTRE|ALLEGER|VENDRE","profile":"${profileLabel}","target":"X ${currSym}","upside":"+X%","nextEvent":{"label":"","date":""},"kpis":[{"label":"","val":"","sub":"","color":"teal"},{"label":"","val":"","sub":"","color":"green"},{"label":"","val":"","sub":"","color":"blue"}],"ca":{"labels":["2021","2022","2023","2024"],"data":[],"unit":"Md${currSym}"},"earnings":{"labels":["2021","2022","2023","2024"],"net":[],"netUnit":"M${currSym}","margin":[]},"segments":{"labels":[],"pct":[],"caRaw":[],"unit":"M${currSym}"},"peers":{"labels":[],"pe":[],"ev":[]},"perHistory":{"labels":["2021","2022","2023","2024"],"data":[],"avg":0},"fcfYieldHistory":{"labels":["2021","2022","2023","2024"],"data":[]},"valScore":5,"valLights":[{"label":"","val":"","signal":"green"},{"label":"","val":"","signal":"amber"},{"label":"","val":"","signal":"green"},{"label":"","val":"","signal":"red"}],"justePrice":{"base":0,"baseLabel":"","adjustments":[{"label":"","impact":0,"positive":true}],"final":0,"safetyMarginPct":5,"currentPrice":0,"vsCurrentPct":0,"dcf":{"labels":["2025e","2026e","2027e","2028e","Val.term."],"data":[],"unit":"M${currSym}"},"qualitativeImpact":""},"expectedReturn":0,"expectedReturnDetail":"","bnaHistory":{"labels":["2021","2022","2023","2024"],"data":[]},"divHistory":{"labels":["2021","2022","2023","2024"],"data":[]},"debtHistory":{"labels":["2021","2022","2023","2024"],"data":[]},"roicHistory":{"labels":["2021","2022","2023","2024"],"data":[]},"fcfAbsHistory":{"labels":["2021","2022","2023","2024"],"data":[],"unit":"M"},"ratios":[{"l":"","v":"","c":"green"}],"qualitative":{"positives":[],"negatives":[],"governance":"","moat":""},"news":[{"title":"","summary":"","impact":"positive","date":""},{"title":"","summary":"","impact":"neutral","date":""}],"calendar":[{"label":"","date":"","type":"results"}],"catalysts":[{"icon":"","title":"","text":""},{"icon":"","title":"","text":""}],"risks":[{"warn":false,"title":"","text":""},{"warn":true,"title":"","text":""}],"verdict":""}`;
}

function isTrue(v) {
  return ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());
}

function parsePositiveInt(v, fallback = null) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function getAuthToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

// UNE SEULE definition, retourne une string valide ^[a-zA-Z0-9_-]{1,64}$
function toAnthropicCustomId(ticker) {
  return String(ticker)
    .toUpperCase()
    .replace(/\./g, '_')
    .replace(/[^A-Z0-9_-]/g, '_')
    .slice(0, 64);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!SB_URL || !SB_KEY || !ANTHROPIC_API_KEY || !CRON_SECRET) {
      return res.status(500).json({
        error: 'Variables manquantes',
        missing: {
          SUPABASE_URL: !SB_URL,
          SUPABASE_SERVICE_KEY_OR_ANON: !SB_KEY,
          ANTHROPIC_API_KEY: !ANTHROPIC_API_KEY,
          CRON_SECRET: !CRON_SECRET
        }
      });
    }

    const token = getAuthToken(req) || String(req.query?.secret || '').trim();
    const q = req.query || {};
    const isPublicSingleTicker = q.ticker && !q.force && token !== CRON_SECRET;
    if (token !== CRON_SECRET && !isPublicSingleTicker) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Public calls: force=false, limit=1, single ticker only
    if (isPublicSingleTicker) {
      req.query.limit = '1';
      req.query.force = 'false';
    }
    const tickerParam = q.ticker ? String(q.ticker).trim().toUpperCase() : '';
    const force = isTrue(q.force);
    const dryRun = isTrue(q.dryRun);
    const limit = parsePositiveInt(q.limit, null);

    const CACHE_DAYS = 14;
    const now = Date.now();

    let selected = ACTIONS;
    if (tickerParam) {
      selected = ACTIONS.filter(a => a.t.toUpperCase() === tickerParam);
      if (selected.length === 0) {
        return res.status(404).json({ error: `Ticker introuvable: ${tickerParam}` });
      }
    }
    if (limit) {
      selected = selected.slice(0, limit);
    }

    const cacheRows = await Promise.all(
      selected.map(async action => {
        const cached = await sbGetCache(action.t);
        return { action, cached };
      })
    );

    const toRefresh = cacheRows
      .filter(({ cached }) => {
        if (force) return true;
        if (!cached?.updated_at) return true;
        const ageDays = (now - new Date(cached.updated_at).getTime()) / 86400000;
        return ageDays >= CACHE_DAYS;
      })
      .map(({ action }) => action);

    if (dryRun) {
      return res.status(200).json({
        mode: 'dryRun',
        selected: selected.length,
        queued: toRefresh.length,
        force,
        tickers: toRefresh.map(a => a.t),
        debugCustomIds: toRefresh.map(a => ({
          ticker: a.t,
          customId: toAnthropicCustomId(a.t)
        }))
      });
    }

    if (toRefresh.length === 0) {
      return res.status(200).json({ message: 'Tout est deja a jour', queued: 0, force });
    }

    const customIdMap = {};
    const batchRequests = toRefresh.map(action => {
      const customId = toAnthropicCustomId(action.t);
      customIdMap[customId] = action.t;
      return {
        custom_id: customId,
        params: {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3500,
          messages: [
            { role: 'user', content: buildPrompt(action) }
          ]
        }
      };
    });

    const batchRes = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'message-batches-2024-09-24'
      },
      body: JSON.stringify({ requests: batchRequests })
    });

    const batchText = await batchRes.text();
    let batchData = null;
    try { batchData = batchText ? JSON.parse(batchText) : null; } catch { batchData = batchText; }

    if (!batchRes.ok) {
      return res.status(500).json({
        error: 'Anthropic batch creation failed',
        status: batchRes.status,
        detail: batchData
      });
    }

    const batchId = batchData?.id;
    if (!batchId) {
      return res.status(500).json({ error: 'Anthropic: pas de batch_id recu', detail: batchData });
    }

    await sbInsertBatch({
      batchId,
      tickers: toRefresh.map(a => a.t),
      meta: { count: toRefresh.length, force, ticker: tickerParam || null, customIdMap }
    });

    return res.status(202).json({
      message: 'Batch lance avec succes',
      batchId,
      queued: toRefresh.length,
      tickers: toRefresh.map(a => a.t)
    });

  } catch (err) {
    console.error('cron-refresh error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
