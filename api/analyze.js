// api/analyze.js — Anthropic proxy sécurisé
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    ticker, name, exchange, sector, price, high52, low52,
    pe, eps, netMargin, beta, divYield,
    forwardPE, evToEbitda, priceToBook, priceFCF, pegRatio,
    roe, operatingMargin, debtToEquity, revenueGrowth, fcfPerShare
  } = req.body;

  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const tickerShort = ticker.replace('.PA','').replace('-','.');
  const isEUR = exchange === 'paris';
  const currSym = isEUR ? '€' : '$';

  // ── Détection automatique du profil d'entreprise ──────────────
  const growthRate = parseFloat(revenueGrowth) || 0;
  const peVal = parseFloat(forwardPE || pe) || 0;
  const sectorLow = (sector || '').toLowerCase();

  const isGrowth = growthRate > 15 || peVal > 35 ||
    ['technology','tech','software','cloud','e-commerce','semiconductor','intelligence artificielle','consumer cyclical'].some(s => sectorLow.includes(s));

  const isPharma = ['pharmaceutical','biotech','healthcare','santé','pharma','biotechnologie'].some(s => sectorLow.includes(s));

  const isCyclical = !isGrowth && ['energy','oil','mining','steel','automotive','construction','matières premières','énergie','automobile','basic materials'].some(s => sectorLow.includes(s));

  const isValue = !isGrowth && !isPharma && !isCyclical &&
    ['bank','insurance','utilities','telecom','real estate','banque','assurance','immobilier','télécommunications','financial'].some(s => sectorLow.includes(s));

  let profileLabel, profileInstructions, primaryMetrics, penalizedMetrics;

  if (isGrowth) {
    profileLabel = 'CROISSANCE';
    primaryMetrics = 'EV/Revenue, EV/EBITDA, croissance CA YoY et CAGR 3 ans, marge brute, Rule of 40, PEG ratio';
    penalizedMetrics = 'NE PAS pénaliser un P/E élevé si croissance CA > 15%/an. Un P/E de 40-80x est normal pour tech en forte croissance. Évaluer via PEG et Rule of 40 (croissance CA% + marge opér.%).';
    profileInstructions = `Entreprise de CROISSANCE : les multiples P/E traditionnels sont peu pertinents.
- Si Rule of 40 > 40 → signal positif fort
- Si EV/Revenue < 5x avec croissance >20% → potentiellement sous-évalué
- Si EV/Revenue > 20x avec ralentissement → alerte surévaluation
- Comparer uniquement à des pairs growth (AWS/Azure pour cloud, etc.)
- Amazon se valorise sur AWS margins + FCF, pas sur P/E groupe`;
  } else if (isPharma) {
    profileLabel = 'PHARMA/BIOTECH';
    primaryMetrics = 'Pipeline produits (phases), P/FCF, marge nette, R&D/CA ratio, exclusivités brevets, revenus récurrents';
    penalizedMetrics = 'NE PAS utiliser P/E comme métrique principale. Les dépenses R&D compriment les bénéfices artificiellement. Utiliser EV/EBITDA ajusté, P/FCF, valeur pipeline.';
    profileInstructions = `Entreprise PHARMA/BIOTECH : valorisation dépend du pipeline.
- Pipeline phase 3 avec catalyseurs proches → prime justifiée
- Brevets expirant < 3 ans → risque concurrence générique à quantifier
- P/FCF < 15x = attractif pour pharma établi
- R&D > 15% CA = normal et positif si pipeline solide`;
  } else if (isCyclical) {
    profileLabel = 'CYCLIQUE';
    primaryMetrics = 'P/B, EV/EBITDA normalisé sur cycle, dette nette, FCF cycle bas, dividende soutenabilité';
    penalizedMetrics = 'NE PAS utiliser P/E au pic de cycle (artificiellement bas). Utiliser P/E normalisé cycle complet (7-10 ans). EV/EBITDA normalisé est la métrique clé.';
    profileInstructions = `Entreprise CYCLIQUE : timing dans le cycle est crucial.
- Si secteur en haut de cycle → pénaliser valorisation
- Si secteur en bas de cycle → prime de redressement justifiée
- P/B < 1 en bas de cycle = opportunité
- Dette nette/EBITDA > 3x en bas de cycle = risque critique`;
  } else if (isValue) {
    profileLabel = 'VALUE/RENDEMENT';
    primaryMetrics = 'P/E vs médiane sectorielle, P/B, dividende yield et croissance, ROE, ROIC, payout soutenabilité, dette/EBITDA';
    penalizedMetrics = 'Pénaliser P/E > 20x sur ce profil. P/B > 3x sans ROE exceptionnel = trop cher. Dividende non couvert par FCF = signal négatif fort.';
    profileInstructions = `Entreprise VALUE/RENDEMENT : valorisation traditionnelle appropriée.
- P/E < médiane sectorielle avec ROE stable = attractif
- Dividende yield > 3% + payout < 60% = rendement soutenable
- ROE > 12% régulier = qualité de business
- P/B < 1.5 sur banque/assurance = sous-évalué`;
  } else {
    profileLabel = 'QUALITÉ';
    primaryMetrics = 'PEG ratio, ROIC, marge nette trend, FCF Yield, croissance dividende CAGR, pricing power';
    penalizedMetrics = 'Un P/E premium (20-30x) est JUSTIFIÉ si ROIC > 15% et croissance régulière. Pénaliser seulement si P/E > 35x sans accélération de croissance.';
    profileInstructions = `Entreprise de QUALITÉ (wide moat) : prime de valorisation justifiée.
- ROIC > 15% régulier = avantage concurrentiel fort → P/E premium justifié
- PEG < 1.5 = attractif même avec P/E élevé
- Marge brute stable/croissante = pricing power défensif
- FCF Yield > 4% = génération de valeur solide`;
  }

  const prompt = `Tu es analyste financier senior sell-side indépendant. Analyse OBJECTIVE et RIGOUREUSE de ${name} (${ticker}), cotée ${isEUR ? 'Euronext Paris' : 'NYSE/NASDAQ'}, secteur : ${sector || 'non précisé'}.

⚠️ PROFIL DÉTECTÉ : ${profileLabel}
${profileInstructions}

MÉTRIQUES PRIORITAIRES POUR CE PROFIL : ${primaryMetrics}
RÈGLE DE VALORISATION SPÉCIFIQUE : ${penalizedMetrics}

DONNÉES DISPONIBLES :
- Cours actuel : ${price}
- Plus haut 52s : ${high52 || 'N/A'} | Plus bas 52s : ${low52 || 'N/A'}
- P/E trailing : ${pe || 'N/A'} | P/E forward : ${forwardPE || 'N/A'}
- BNA : ${eps || 'N/A'} | FCF/action : ${fcfPerShare || 'N/A'}
- EV/EBITDA : ${evToEbitda || 'N/A'} | P/B : ${priceToBook || 'N/A'} | P/FCF : ${priceFCF || 'N/A'}
- PEG : ${pegRatio || 'N/A'} | ROE : ${roe || 'N/A'}
- Marge nette : ${netMargin || 'N/A'} | Marge opér. : ${operatingMargin || 'N/A'}
- Dette/Fonds propres : ${debtToEquity || 'N/A'} | Bêta : ${beta || 'N/A'}
- Croissance CA : ${revenueGrowth || 'N/A'} | Rendement div. : ${divYield || 'N/A'}

RÈGLES IMPÉRATIVES :
1. La recommandation découle des métriques prioritaires du profil ${profileLabel}.
2. SCORE VALORISATION (1-10) : comparaison vs pairs du MÊME profil. 1=très surévalué, 5=juste prix, 10=très sous-évalué.
3. FEUX TRICOLORES : honnêtes, comparés vs pairs du même profil.
4. Distribution cible : ~30% ACHETER, ~40% NEUTRE/ACCUMULER, ~30% ALLÉGER/VENDRE.
5. Le VERDICT mentionne explicitement le profil et justifie via métriques adaptées.

IMPORTANT : JSON valide strict uniquement, sans backticks ni texte avant/après.

{
  "reco": "ACHETER | ACCUMULER | NEUTRE | ALLÉGER | VENDRE",
  "target": "ex: 199 ${currSym}",
  "upside": "ex: +49%",
  "profile": "${profileLabel}",
  "nextEvent": {"label":"ex: Résultats T1 2025","date":"ex: 24 avril 2025"},
  "kpis": [
    {"label":"CA annuel","val":"ex: 5,6 Md${currSym}","sub":"ex: 2024e, +3% vs 2023","color":"teal"},
    {"label":"Marge opér.","val":"ex: 9,5%","sub":"ex: Stable vs 2023","color":"green"},
    {"label":"P/E Forward","val":"ex: 8,8x","sub":"ex: 2025e","color":"amber"},
    {"label":"FCF Yield","val":"ex: 6,2%","sub":"ex: Solide génération","color":"blue"},
    {"label":"Dette/EBITDA","val":"ex: 0,45x","sub":"ex: Structure saine","color":"green"}
  ],
  "ca": {
    "labels": ["2020","2021","2022","2023","2024","2025e","2026e"],
    "data": [1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4],
    "unit": "Md${currSym}"
  },
  "earnings": {
    "labels": ["2021","2022","2023","2024","2025e"],
    "net": [0.1, 0.12, 0.15, 0.18, 0.2],
    "margin": [8.0, 9.0, 10.0, 11.0, 12.0]
  },
  "segments": {
    "labels": ["Segment principal","Segment 2","Segment 3"],
    "data": [50, 30, 20],
    "ca": ["ex: 2,8 Md${currSym}","ex: 1,7 Md${currSym}","ex: 1,1 Md${currSym}"]
  },
  "peers": {
    "labels": ["${tickerShort}","Comparable 1","Comparable 2","Comparable 3","Moy. secteur"],
    "pe": [15.0, 18.0, 22.0, 12.0, 17.0]
  },
  "peersEv": {
    "labels": ["${tickerShort}","Comparable 1","Comparable 2","Comparable 3","Moy. secteur"],
    "data": [8.0, 10.0, 12.0, 7.0, 9.5]
  },
  "perHistory": {
    "labels": ["2020","2021","2022","2023","2024"],
    "data": [18.0, 22.0, 15.0, 14.0, 16.0]
  },
  "fcfYieldHistory": {
    "labels": ["2020","2021","2022","2023","2024"],
    "data": [4.2, 3.8, 5.1, 6.2, 5.8]
  },
  "valScore": 6,
  "valLights": [
    {"label":"P/E vs secteur","val":"ex: 14x vs 18x médiane","signal":"green"},
    {"label":"EV/EBITDA","val":"ex: 8x vs 10x médiane","signal":"green"},
    {"label":"P/FCF","val":"ex: 22x — élevé","signal":"red"},
    {"label":"PEG Ratio","val":"ex: 1.8x","signal":"amber"},
    {"label":"FCF Yield","val":"ex: 5.8%","signal":"green"},
    {"label":"P/B","val":"ex: 3.2x vs 2.5x médiane","signal":"amber"}
  ],
  "valPosition": [
    {"label":"P/E vs médiane sectorielle","pct":-18,"vs":"cheaper"},
    {"label":"EV/EBITDA vs médiane","pct":-12,"vs":"cheaper"},
    {"label":"P/FCF vs médiane","pct":15,"vs":"expensive"}
  ],
  "expectedReturn": 11,
  "expectedReturnDetail": "Croissance BNA +8%/an + Yield div. 3% = ~11%/an estimé",
  "bnaHistory": {
    "labels": ["2019","2020","2021","2022","2023","2024"],
    "data": [5.2, 4.8, 6.1, 7.5, 8.9, 10.2]
  },
  "divHistory": {
    "labels": ["2019","2020","2021","2022","2023","2024"],
    "data": [1.5, 1.2, 1.6, 2.0, 2.4, 2.8]
  },
  "debtHistory": {
    "labels": ["2019","2020","2021","2022","2023","2024"],
    "data": [3.2, 4.1, 3.5, 2.8, 2.2, 1.8]
  },
  "ratios": [
    {"l":"P/E TTM","v":"ex: 8,8x","c":"green"},
    {"l":"EV/EBITDA","v":"ex: 5,2x","c":"teal"},
    {"l":"P/Book","v":"ex: 1,4x","c":"teal"},
    {"l":"ROE","v":"ex: 16,5%","c":"green"},
    {"l":"Div. Yield","v":"ex: 3,9%","c":"amber"},
    {"l":"Payout","v":"ex: 35%","c":"teal"},
    {"l":"Marge EBITDA","v":"ex: 24,5%","c":"green"},
    {"l":"ROIC","v":"ex: 12%","c":"teal"}
  ],
  "levels": [
    {"label":"Résistance majeure","price":"ex: 210 ${currSym}","type":"res"},
    {"label":"Résistance intermédiaire","price":"ex: 195 ${currSym}","type":"res"},
    {"label":"Cours actuel","price":"${price}","type":"now"},
    {"label":"Support intermédiaire","price":"ex: 125 ${currSym}","type":"sup"},
    {"label":"Support fort","price":"ex: 114 ${currSym}","type":"sup"},
    {"label":"Stop loss","price":"ex: 108 ${currSym}","type":"stop"}
  ],
  "scenarios": [
    {"pct":"Tranche 1 — 60%","entry":"ex: 133-136 ${currSym}","target":"ex: 195 ${currSym}","up":"ex: +48%"},
    {"pct":"Tranche 2 — 30%","entry":"ex: 120-126 ${currSym}","target":"ex: 195 ${currSym}","up":"ex: +58%"},
    {"pct":"PRU moyen cible","entry":"ex: 131 ${currSym}","target":"Consensus","up":"ex: +49%"}
  ],
  "catalysts": [
    {"icon":"🎯","title":"Catalyseur 1","text":"Description chiffrée du catalyseur principal."},
    {"icon":"📈","title":"Catalyseur 2","text":"Description chiffrée du deuxième catalyseur."},
    {"icon":"🌐","title":"Catalyseur 3","text":"Description chiffrée du troisième catalyseur."}
  ],
  "risks": [
    {"warn":false,"title":"Risque modéré","text":"Description du risque avec données."},
    {"warn":true,"title":"Point de vigilance","text":"Description du risque majeur."}
  ],
  "verdict": "2-3 phrases mentionnant le profil ${profileLabel}. Justifier la reco par les métriques adaptées (PEG/EV-Revenue pour croissance, P/FCF pour pharma, etc.). HTML <b> autorisé. Sois honnête."
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' });

    let raw = data.content.map(c => c.text || '').join('');
    raw = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Réponse IA invalide' });
    return res.status(200).json(JSON.parse(jsonMatch[0]));

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
