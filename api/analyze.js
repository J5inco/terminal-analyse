// api/analyze.js — J5 Investment · Cache 7j + Qualitatif + Juste Prix
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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
    try {
      const { data: cached } = await sb.from('analyses_cache')
        .select('data, updated_at').eq('ticker', ticker.toUpperCase()).single();
      if (cached) {
        const ageDays = (Date.now() - new Date(cached.updated_at).getTime()) / 86400000;
        if (ageDays < 7) {
          return res.status(200).json({ ...cached.data, _cached: true, _cachedAt: cached.updated_at });
        }
      }
    } catch(e) { /* cache miss */ }
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

  // ── WEB SEARCH QUALITATIF ─────────────────────────────────
  let qualitativeContext = 'Données qualitatives non disponibles.';
  try {
    const searchRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: `Recherche les informations qualitatives récentes sur ${name} (${ticker}). Trouve : 1) Actualités importantes 6 derniers mois, 2) Qualité management/gouvernance, 3) Position concurrentielle et moat, 4) Risques réglementaires/juridiques, 5) Rachats d'actions ou événements capitalistiques, 6) Notation ESG. Réponds en 250 mots max en français. Pour chaque élément, indique l'impact estimé sur la valorisation (+X% ou -X%).` }]
      })
    });
    const searchData = await searchRes.json();
    const texts = (searchData.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ');
    if (texts.length > 50) qualitativeContext = texts.slice(0, 1200);
  } catch(e) { /* web search failed */ }

  // ── MAIN PROMPT ───────────────────────────────────────────
  const prompt = `Tu es analyste financier senior sell-side indépendant. Analyse OBJECTIVE de ${name} (${ticker}), ${isEUR ? 'Euronext Paris' : 'NYSE/NASDAQ'}, secteur : ${sector || 'N/A'}.

⚠️ PROFIL : ${profileLabel} — ${profileInstructions}
MÉTRIQUES PRIORITAIRES : ${primaryMetrics}
RÈGLE : ${penalizedMetrics}

DONNÉES QUANTITATIVES :
- Cours : ${price} | Range 52s : ${low52||'N/A'}—${high52||'N/A'} | ${rangeContext}
- P/E trailing : ${pe||'N/A'} | Forward : ${forwardPE||'N/A'} | PEG : ${pegRatio||'N/A'}
- BNA : ${eps||'N/A'} | FCF/action : ${fcfPerShare||'N/A'}
- EV/EBITDA : ${evToEbitda||'N/A'} | P/B : ${priceToBook||'N/A'} | P/FCF : ${priceFCF||'N/A'}
- ROE : ${roe||'N/A'} | Marge nette : ${netMargin||'N/A'} | Marge opér. : ${operatingMargin||'N/A'}
- Dette/FP : ${debtToEquity||'N/A'} | Bêta : ${beta||'N/A'} | Croissance CA : ${revenueGrowth||'N/A'} | Div. yield : ${divYield||'N/A'}

DONNÉES QUALITATIVES (recherche web récente) :
${qualitativeContext}

CALCUL JUSTE PRIX (OBLIGATOIRE) :
1. Prix de base = DCF simplifié OU multiples sectoriels selon profil ${profileLabel} (utilise tes connaissances sur l'entreprise)
2. Ajustements qualitatifs = chaque élément qualitatif modifie le prix de base avec % justifié
3. Prix final = prix base + ajustements
4. Marge de sécurité = prix final × 0.75
5. Calcule les flux DCF sur 5 ans pour le graphique

RÈGLES :
1. Reco découle des métriques du profil ${profileLabel} ET données qualitatives.
2. Score valorisation 1-10 vs pairs du MÊME profil ET historique propre 5 ans.
3. Distribution : ~30% ACHETER, ~40% NEUTRE/ACCUMULER, ~30% ALLÉGER/VENDRE.
4. Correction > 25% depuis plus haut → NE PAS recommander ALLÉGER/VENDRE sauf détérioration structurelle.
5. Le verdict mentionne le profil et les ajustements qualitatifs chiffrés.

JSON STRICT UNIQUEMENT — sans backticks :

{
  "reco": "ACHETER",
  "profile": "${profileLabel}",
  "target": "199 ${currSym}",
  "upside": "+49%",
  "nextEvent": {"label":"Résultats T1 2025","date":"24 avril 2025"},
  "kpis": [
    {"label":"CA annuel","val":"5,6 Md${currSym}","sub":"2024e, +3% vs 2023","color":"teal"},
    {"label":"Marge opér.","val":"9,5%","sub":"Stable vs 2023","color":"green"},
    {"label":"FCF Yield","val":"6,2%","sub":"Solide génération","color":"blue"},
    {"label":"Dette/EBITDA","val":"0,45x","sub":"Structure saine","color":"green"},
    {"label":"Croissance CA","val":"+8%","sub":"2024e","color":"teal"}
  ],
  "ca": {"labels":["2020","2021","2022","2023","2024","2025e","2026e"],"data":[1.2,1.4,1.6,1.8,2.0,2.2,2.4],"unit":"Md${currSym}"},
  "earnings": {
    "labels":["2021","2022","2023","2024","2025e"],
    "net":[100,120,150,180,200],
    "netUnit":"M${currSym}",
    "margin":[8.0,9.0,10.0,11.0,12.0]
  },
  "segments": {
    "labels":["Segment 1","Segment 2","Segment 3"],
    "pct":[50,30,20],
    "ca":["2,8 Md${currSym}","1,7 Md${currSym}","1,1 Md${currSym}"],
    "caRaw":[2800,1700,1100],
    "unit":"M${currSym}"
  },
  "peers": {"labels":["${tickerShort}","Comp1","Comp2","Comp3","Moy.secteur"],"pe":[15.0,18.0,22.0,12.0,17.0]},
  "peersEv": {"labels":["${tickerShort}","Comp1","Comp2","Comp3","Moy.secteur"],"data":[8.0,10.0,12.0,7.0,9.5]},
  "perHistory": {"labels":["2020","2021","2022","2023","2024"],"data":[18.0,22.0,15.0,14.0,16.0],"avg":17.0},
  "fcfYieldHistory": {"labels":["2020","2021","2022","2023","2024"],"data":[4.2,3.8,5.1,6.2,5.8]},
  "valScore": 6,
  "valLights": [
    {"label":"P/E vs secteur","val":"14x vs 18x médiane","signal":"green"},
    {"label":"EV/EBITDA","val":"8x vs 10x médiane","signal":"green"},
    {"label":"P/FCF","val":"22x — élevé","signal":"red"},
    {"label":"PEG Ratio","val":"1.8x","signal":"amber"},
    {"label":"FCF Yield","val":"5.8%","signal":"green"},
    {"label":"P/B","val":"3.2x vs 2.5x médiane","signal":"amber"}
  ],
  "valPosition": [
    {"label":"P/E vs médiane sectorielle","pct":-18,"vs":"cheaper"},
    {"label":"EV/EBITDA vs médiane","pct":-12,"vs":"cheaper"}
  ],
  "justePrice": {
    "base": 750,
    "baseLabel": "DCF 5 ans (WACC 8%, croissance terminale 2%)",
    "adjustments": [
      {"label":"Gouvernance solide, management reconnu","impact":5,"positive":true},
      {"label":"Risque réglementaire Europe","impact":-8,"positive":false}
    ],
    "final": 728,
    "safetyMargin": 546,
    "safetyMarginPct": 25,
    "currentPrice": ${priceNum || 0},
    "vsCurrentPct": 25,
    "dcf": {"labels":["2025e","2026e","2027e","2028e","2029e","Val. term."],"data":[120,135,150,165,180,1200],"unit":"M${currSym}"},
    "qualitativeImpact": "Les données qualitatives appliquent une correction nette de -3% sur le prix de base, reflétant les risques réglementaires supérieurs aux points positifs de gouvernance."
  },
  "expectedReturn": 11,
  "expectedReturnDetail": "Croissance BNA +8%/an + Yield div. 3% = ~11%/an estimé",
  "bnaHistory": {"labels":["2019","2020","2021","2022","2023","2024"],"data":[5.2,4.8,6.1,7.5,8.9,10.2]},
  "divHistory": {"labels":["2019","2020","2021","2022","2023","2024"],"data":[1.5,1.2,1.6,2.0,2.4,2.8]},
  "debtHistory": {"labels":["2019","2020","2021","2022","2023","2024"],"data":[3.2,4.1,3.5,2.8,2.2,1.8]},
  "ratios": [
    {"l":"P/E TTM","v":"8,8x","c":"green"},{"l":"EV/EBITDA","v":"5,2x","c":"teal"},
    {"l":"P/Book","v":"1,4x","c":"teal"},{"l":"ROE","v":"16,5%","c":"green"},
    {"l":"Div. Yield","v":"3,9%","c":"amber"},{"l":"Payout","v":"35%","c":"teal"},
    {"l":"Marge EBITDA","v":"24,5%","c":"green"},{"l":"ROIC","v":"12%","c":"teal"}
  ],
  "qualitative": {
    "positives": ["Point positif 1 chiffré","Point positif 2 chiffré"],
    "negatives": ["Risque 1 chiffré","Risque 2 chiffré"],
    "governance": "Commentaire gouvernance et qualité management",
    "esg": "Notation et commentaire ESG",
    "moat": "Description avantage concurrentiel et durabilité"
  },
  "news": [
    {"title":"Titre actualité 1","summary":"Résumé en 1 phrase","impact":"positive","date":"Mars 2025"},
    {"title":"Titre actualité 2","summary":"Résumé en 1 phrase","impact":"neutral","date":"Fév. 2025"},
    {"title":"Titre actualité 3","summary":"Résumé en 1 phrase","impact":"negative","date":"Jan. 2025"}
  ],
  "calendar": [
    {"label":"Résultats T1 2025","date":"24 avril 2025","type":"results"},
    {"label":"Détachement dividende","date":"15 mai 2025","type":"dividend"},
    {"label":"Assemblée Générale","date":"10 juin 2025","type":"ag"}
  ],
  "catalysts": [
    {"icon":"🎯","title":"Catalyseur 1","text":"Description chiffrée du catalyseur principal."},
    {"icon":"📈","title":"Catalyseur 2","text":"Description chiffrée du deuxième catalyseur."},
    {"icon":"🌐","title":"Catalyseur 3","text":"Description chiffrée du troisième catalyseur."}
  ],
  "risks": [
    {"warn":false,"title":"Risque modéré","text":"Description avec données."},
    {"warn":true,"title":"Point de vigilance","text":"Description risque majeur avec chiffres."}
  ],
  "verdict": "2-3 phrases. Profil ${profileLabel}. Justifier via métriques adaptées ET ajustements qualitatifs chiffrés. HTML <b> autorisé."
}`;

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
    try {
      await sb.from('analyses_cache').upsert({ ticker: ticker.toUpperCase(), data: result, updated_at: new Date().toISOString() });
    } catch(e) { /* not critical */ }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
