// api/analyze.js — Anthropic proxy sécurisé
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker, name, exchange, sector, price, high52, low52, pe, eps, netMargin, beta, divYield } = req.body;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const tickerShort = ticker.replace('.PA','').replace('-','.');

  const prompt = `Tu es analyste financier senior sell-side. Génère une analyse complète et chiffrée pour ${name} (${ticker}), cotée ${exchange === 'paris' ? 'Euronext Paris' : 'NYSE/NASDAQ'}, secteur : ${sector || 'non précisé'}.
Cours actuel : ${price}${high52 ? ` | Plus haut 52s : ${high52}` : ''}${low52 ? ` | Plus bas 52s : ${low52}` : ''}${pe ? ` | P/E : ${pe}` : ''}${eps ? ` | BNA : ${eps}` : ''}${netMargin ? ` | Marge nette : ${netMargin}` : ''}${beta ? ` | Bêta : ${beta}` : ''}${divYield ? ` | Rendement div. : ${divYield}` : ''}.

IMPORTANT : Réponds UNIQUEMENT en JSON valide strict, sans backticks, sans texte avant ou après.
Toutes les clés et tableaux sont OBLIGATOIRES — utilise tes connaissances pour remplir les données financières historiques réelles.

{
  "reco": "ACHETER",
  "target": "ex: 199 €",
  "upside": "ex: +49%",
  "nextEvent": {"label":"ex: Résultats T1 2025","date":"ex: 24 avril 2025"},
  "kpis": [
    {"label":"CA annuel","val":"ex: 5,6 Md€","sub":"ex: 2024e, +3% vs 2023","color":"teal"},
    {"label":"Marge opér.","val":"ex: 9,5%","sub":"ex: Stable vs 2023","color":"green"},
    {"label":"P/E Forward","val":"ex: 8,8x","sub":"ex: 2025e","color":"amber"},
    {"label":"FCF Yield","val":"ex: 6,2%","sub":"ex: Solide génération","color":"blue"},
    {"label":"Dette/EBITDA","val":"ex: 0,45x","sub":"ex: Structure saine","color":"green"}
  ],
  "ca": {
    "labels": ["2020","2021","2022","2023","2024","2025","2026e"],
    "data": [1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4],
    "unit": "Md€"
  },
  "earnings": {
    "labels": ["2021","2022","2023","2024","2025"],
    "net": [0.1, 0.12, 0.15, 0.18, 0.2],
    "margin": [8.0, 9.0, 10.0, 11.0, 12.0]
  },
  "segments": {
    "labels": ["Segment principal","Segment 2","Segment 3"],
    "data": [50, 30, 20]
  },
  "peers": {
    "labels": ["${tickerShort}","Comparable 1","Comparable 2","Comparable 3","Moy. secteur"],
    "pe": [15.0, 18.0, 22.0, 12.0, 17.0]
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
    {"label":"Résistance majeure","price":"ex: 210 €","type":"res"},
    {"label":"Résistance intermédiaire","price":"ex: 195 €","type":"res"},
    {"label":"Cours actuel","price":"${price}","type":"now"},
    {"label":"Support intermédiaire","price":"ex: 125 €","type":"sup"},
    {"label":"Support fort","price":"ex: 114 €","type":"sup"},
    {"label":"Stop loss","price":"ex: 108 €","type":"stop"}
  ],
  "scenarios": [
    {"pct":"Tranche 1 — 60%","entry":"ex: 133-136 €","target":"ex: 195 €","up":"ex: +48%"},
    {"pct":"Tranche 2 — 30%","entry":"ex: 120-126 €","target":"ex: 195 €","up":"ex: +58%"},
    {"pct":"PRU moyen cible","entry":"ex: 131 €","target":"Consensus","up":"ex: +49%"}
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
  "verdict": "2-3 phrases résumant la thèse avec chiffres clés. HTML <b> autorisé."
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
        max_tokens: 3000,
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
