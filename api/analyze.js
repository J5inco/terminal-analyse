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

  const prompt = `Tu es analyste financier senior sell-side indépendant. Tu dois produire une analyse OBJECTIVE et RIGOUREUSE de ${name} (${ticker}), cotée ${isEUR ? 'Euronext Paris' : 'NYSE/NASDAQ'}, secteur : ${sector || 'non précisé'}.

DONNÉES RÉELLES DISPONIBLES (utilise-les comme base principale) :
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
1. La RECOMMANDATION doit découler logiquement des données ci-dessus. Si le P/E est supérieur à la médiane sectorielle ET la croissance est faible → ALLÉGER ou VENDRE. Ne pas donner systématiquement ACHETER.
2. Le SCORE DE VALORISATION (1-10) doit refléter la cherté relative : 1=très surévalué, 5=juste prix, 10=très sous-évalué.
3. Les FEUX TRICOLORES (valLights) doivent être honnêtes : signal RED si le multiple est élevé vs secteur.
4. Utilise tes connaissances financières réelles sur cette entreprise pour les données historiques.
5. Distribution attendue sur l'ensemble de tes analyses : ~30% ACHETER, ~40% NEUTRE/ACCUMULER, ~30% ALLÉGER/VENDRE.

IMPORTANT : Réponds UNIQUEMENT en JSON valide strict, sans backticks, sans texte avant ou après.

{
  "reco": "ACHETER | ACCUMULER | NEUTRE | ALLÉGER | VENDRE",
  "target": "ex: 199 ${currSym}",
  "upside": "ex: +49%",
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
    {"l":"Marge brute","v":"ex: 28%","c":"green"},
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
  "verdict": "2-3 phrases résumant la thèse avec chiffres clés. HTML <b> autorisé. Sois honnête sur la valorisation."
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
