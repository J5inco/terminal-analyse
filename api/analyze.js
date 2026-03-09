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
                            'apikey': SB_KEY,
                            'Authorization': `Bearer ${SB_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'resolution=merge-duplicates'
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
        ticker, name, exchange, sector, price,
        high52, low52, pe, eps, netMargin, beta, divYield,
        forwardPE, evToEbitda, priceToBook, priceFCF, pegRatio, roe,
        operatingMargin, debtToEquity, revenueGrowth, fcfPerShare, forceRefresh
  } = req.body;

  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

              // ── CHECK CACHE 7 JOURS ─────────────────────────────────────
  if (!forceRefresh) {
    const cached = await sbGet(ticker.toUpperCase());
        if (cached) {
                const ageDays = (Date.now() - new Date(cached.updated_at).getTime()) / 86400000;
                if (ageDays < 7) {
                          return res.status(200).json({ ...cached.data, _cached: true, _cachedAt: cached.updated_at });
                }
        }
  }

  // ── PROFIL DETECTION ────────────────────────────────────────
  const tickerShort = ticker.replace('.PA','').replace('-','.');
    const isEUR = exchange === 'paris';
    const currSym = isEUR ? '€' : '$';
    const growthRate = parseFloat(revenueGrowth) || 0;
    const peVal = parseFloat(forwardPE || pe) || 0;
    const sectorLow = (sector || '').toLowerCase();
    const priceNum = parseFloat(price) || 0;
    const high52Num = parseFloat(high52) || 0;
    const low52Num = parseFloat(low52) || 0;

          const isGrowth = growthRate > 15 || peVal > 35 || ['technology','tech','software','cloud','e-commerce','semiconductor','consumer cyclical'].some(s => sectorLow.includes(s));
    const isPharma = ['pharmaceutical','biotech','healthcare','pharma','biotechnologie'].some(s => sectorLow.includes(s));
    const isCyclical = !isGrowth && !isPharma && ['energy','oil','mining','steel','automotive','construction','basic materials'].some(s => sectorLow.includes(s));
    const isValue = !isGrowth && !isPharma && !isCyclical && ['bank','insurance','utilities','telecom','real estate','banque','assurance','financial'].some(s => sectorLow.includes(s));

  let profileLabel, profileInstructions, primaryMetrics, penalizedMetrics;
    if (isGrowth) {
          profileLabel = 'CROISSANCE';
          primaryMetrics = 'EV/Revenue, EV/EBITDA, Rule of 40, PEG, croissance CA';
          penalizedMetrics = 'NE PAS pénaliser P/E élevé si croissance CA > 15%.';
          profileInstructions = 'EV/Revenue < 5x + croissance >20% = attractif. Rule of 40 > 40 = positif.';
    } else if (isPharma) {
          profileLabel = 'PHARMA/BIOTECH';
          primaryMetrics = 'Pipeline phases, P/FCF, marge nette, R&D/CA';
                penalizedMetrics = 'NE PAS utiliser P/E principal. R&D comprime bénéfices.';
          profileInstructions = 'Pipeline phase 3 = prime justifiée. P/FCF < 15x = attractif.';
} else if (isCyclical) {
          profileLabel = 'CYCLIQUE';
          primaryMetrics = 'P/B, EV/EBITDA normalisé, dette nette, FCF bas de cycle';
          penalizedMetrics = 'NE PAS utiliser P/E au pic cycle.';
          profileInstructions = 'Haut cycle → pénaliser. P/B < 1 en bas cycle = opportunité.';
    } else if (isValue) {
          profileLabel = 'VALUE/RENDEMENT';
          primaryMetrics = 'P/E vs médiane, P/B, dividende yield, ROE, ROIC';
          penalizedMetrics = 'Pénaliser P/E > 20x. Dividende non couvert FCF = signal négatif.';
          profileInstructions = 'P/E < médiane + ROE stable = attractif. Dividende > 3% + payout < 60% = soutenable.';
    } else {
          profileLabel = 'QUALITÉ';
          primaryMetrics = 'PEG, ROIC, FCF Yield, croissance dividende';
          penalizedMetrics = 'P/E premium 20-30x JUSTIFIÉ si ROIC > 15%.';
          profileInstructions = 'ROIC > 15% régulier → P/E premium justifié. FCF Yield > 4% = solide.';
    }

  // ── RANGE 52S ───────────────────────────────────────────────
  let rangeContext = '';
    if (priceNum > 0 && high52Num > 0 && low52Num > 0 && high52Num > low52Num) {
          const pos = ((priceNum - low52Num) / (high52Num - low52Num) * 100).toFixed(0);
          const corr = ((high52Num - priceNum) / high52Num * 100).toFixed(0);
          if (pos <= 20) rangeContext = `ZONE BASSE (${pos}% du range, -${corr}% depuis plus haut). Ne pas recommander ALLÉGER/VENDRE sauf détérioration structurelle.`;
          else if (pos <= 35) rangeContext = `Zone basse-médiane (${pos}%, -${corr}% depuis plus haut).`;
          else if (pos >= 85) rangeContext = `ZONE HAUTE (${pos}%). Peu de marge avant les plus hauts.`;
          else rangeContext = `Milieu de range (${pos}%, -${corr}% depuis plus haut).`;
    }

  // ── WEB SEARCH QUALITATIF (modèle léger) ────────────────────
  let qualitativeContext = 'Données qualitatives non disponibles.';
    try {
          const searchRes = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': process.env.ANTHROPIC_API_KEY,
                            'anthropic-version': '2023-06-01',
                            'anthropic-beta': 'web-search-2025-03-05'
                  },
                  body: JSON.stringify({
                            model: 'claude-haiku-4-5',
                            max_tokens: 800,
                            tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
                            messages: [{
                                        role: 'user',
                                        content: `Recherche les infos récentes sur ${name} (${ticker}). Résume en 200 mots max en français : actualités importantes, position concurrentielle, risques majeurs. Impact estimé sur valorisation en %.`
                            }]
                  })
          });
          const searchData = await searchRes.json();
          const texts = (searchData.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ');
          if (texts.length > 50) qualitativeContext = texts.slice(0, 800);
    } catch(e) { /* web search failed */ }

  // ── MAIN PROMPT (compact) ────────────────────────────────────
  const prompt = `Tu es analyste financier senior. Analyse ${name} (${ticker}), secteur: ${sector || 'N/A'}.

  PROFIL: ${profileLabel} — ${profileInstructions}
  MÉTRIQUES: ${primaryMetrics} | RÈGLE: ${penalizedMetrics}

  DONNÉES:
  - Cours: ${price} | Range 52s: ${low52||'N/A'}—${high52||'N/A'} | ${rangeContext}
  - P/E: ${pe||'N/A'} | Forward: ${forwardPE||'N/A'} | PEG: ${pegRatio||'N/A'} | EV/EBITDA: ${evToEbitda||'N/A'}
  - BNA: ${eps||'N/A'} | FCF/action: ${fcfPerShare||'N/A'} | P/B: ${priceToBook||'N/A'} | P/FCF: ${priceFCF||'N/A'}
  - ROE: ${roe||'N/A'} | Marge nette: ${netMargin||'N/A'} | Marge opér.: ${operatingMargin||'N/A'}
  - Dette/FP: ${debtToEquity||'N/A'} | Bêta: ${beta||'N/A'} | Croissance CA: ${revenueGrowth||'N/A'} | Div. yield: ${divYield||'N/A'}

  QUALITATIF: ${qualitativeContext}

  RÈGLES:
  1. Reco: ACHETER/ACCUMULER/NEUTRE/ALLÉGER/VENDRE selon métriques du profil ${profileLabel}
  2. Distribution: ~30% ACHETER, ~40% NEUTRE/ACCUMULER, ~30% ALLÉGER/VENDRE
  3. Correction > 25% depuis plus haut → ne pas recommander ALLÉGER/VENDRE sauf détérioration structurelle
  4. Calcule un juste prix via DCF ou multiples sectoriels + ajustements qualitatifs (% justifié)
  5. Utilise tes connaissances sur l'entreprise pour les données historiques

  Réponds en JSON strict (sans backticks) avec cette structure exacte:
  {"reco":"ACHETER","profile":"${profileLabel}","target":"XXX ${currSym}","upside":"+XX%","nextEvent":{"label":"...","date":"..."},"kpis":[{"label":"...","val":"...","sub":"...","color":"green"}],"ca":{"labels":["2020","2021","2022","2023","2024","2025e","2026e"],"data":[1.2,1.4,1.6,1.8,2.0,2.2,2.4],"unit":"Md${currSym}"},"earnings":{"labels":["2021","2022","2023","2024","2025e"],"net":[100,120,150,180,200],"netUnit":"M${currSym}","margin":[8.0,9.0,10.0,11.0,12.0]},"segments":{"labels":["Seg1","Seg2"],"pct":[60,40],"ca":["X Md${currSym}","Y Md${currSym}"],"caRaw":[1000,600],"unit":"M${currSym}"},"peers":{"labels":["${tickerShort}","Comp1","Comp2","Moy."],"pe":[15.0,18.0,22.0,17.0]},"peersEv":{"labels":["${tickerShort}","Comp1","Comp2","Moy."],"data":[8.0,10.0,12.0,9.5]},"perHistory":{"labels":["2020","2021","2022","2023","2024"],"data":[18.0,22.0,15.0,14.0,16.0],"avg":17.0},"fcfYieldHistory":{"labels":["2020","2021","2022","2023","2024"],"data":[4.2,3.8,5.1,6.2,5.8]},"valScore":6,"valLights":[{"label":"P/E vs secteur","val":"14x vs 18x","signal":"green"}],"justePrice":{"base":${priceNum || 100},"baseLabel":"DCF 5 ans (WACC 8%, g=2%)","adjustments":[{"label":"Point qualitatif","impact":5,"positive":true}],"final":${priceNum || 100},"safetyMargin":${(priceNum || 100) * 0.75},"safetyMarginPct":25,"currentPrice":${priceNum || 0},"vsCurrentPct":0,"dcf":{"labels":["2025e","2026e","2027e","2028e","2029e","Val.term."],"data":[100,110,120,130,140,800],"unit":"M${currSym}"},"qualitativeImpact":"..."},"expectedReturn":8,"expectedReturnDetail":"Croissance BNA + dividende","bnaHistory":{"labels":["2019","2020","2021","2022","2023","2024"],"data":[5.2,4.8,6.1,7.5,8.9,10.2]},"divHistory":{"labels":["2019","2020","2021","2022","2023","2024"],"data":[1.5,1.2,1.6,2.0,2.4,2.8]},"debtHistory":{"labels":["2019","2020","2021","2022","2023","2024"],"data":[3.2,4.1,3.5,2.8,2.2,1.8]},"ratios":[{"l":"P/E TTM","v":"XX","c":"green"}],"qualitative":{"positives":["Point positif chiffré"],"negatives":["Risque chiffré"],"governance":"...","esg":"...","moat":"..."},"news":[{"title":"...","summary":"...","impact":"positive","date":"Mars 2025"}],"calendar":[{"label":"Résultats T1","date":"24 avril 2025","type":"results"}],"catalysts":[{"icon":"🎯","title":"Catalyseur","text":"Description chiffrée"}],"risks":[{"warn":true,"title":"Risque","text":"Description chiffrée"}],"verdict":"2-3 phrases. Profil ${profileLabel}. HTML <b> autorisé."}

  Remplace TOUTES les valeurs par des données réelles et précises sur ${name}. JSON valide uniquement.`;

  try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                          'Content-Type': 'application/json',
                          'x-api-key': process.env.ANTHROPIC_API_KEY,
                          'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                          model: 'claude-sonnet-4-20250514',
                          max_tokens: 4000,
                          messages: [{ role: 'user', content: prompt }]
                }),
        });

      const data = await response.json();
        if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' });

      let raw = data.content.map(c => c.text || '').join('');
        raw = raw.replace(/```json|```/g, '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return res.status(500).json({ error: 'Réponse IA invalide' });

      const result = JSON.parse(jsonMatch[0]);
        await sbUpsert(ticker.toUpperCase(), result);
        return res.status(200).json(result);
  } catch (err) {
        return res.status(500).json({ error: err.message });
  }
}
