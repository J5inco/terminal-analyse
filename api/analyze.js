// api/analyze.js — Anthropic proxy sécurisé
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ticker, name, exchange, sector, price, high52, low52 } = req.body;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const prompt = `Tu es analyste financier senior sell-side. Génère une analyse complète et chiffrée pour ${name} (${ticker}), cotée ${exchange === 'paris' ? 'Euronext Paris' : 'NYSE/NASDAQ'}, secteur : ${sector || 'non précisé'}. 
Cours actuel : ${price}${high52 ? ` | Plus haut 52s : ${high52}` : ''}${low52 ? ` | Plus bas 52s : ${low52}` : ''}.

Réponds UNIQUEMENT en JSON valide strict, sans backticks ni texte hors JSON :

{
  "reco": "ACHETER"|"ACCUMULER"|"CONSERVER"|"ALLÉGER"|"VENDRE",
  "target": "string ex: 199 € ou $620",
  "upside": "string ex: +49%",
  "nextEvent": {"label":"string","date":"string"},
  "kpis": [
    {"label":"CA annuel","val":"string","sub":"string","color":"teal"},
    {"label":"Marge opér.","val":"string","sub":"string","color":"green"},
    {"label":"P/E Forward","val":"string","sub":"string","color":"amber"},
    {"label":"FCF Yield","val":"string","sub":"string","color":"blue"},
    {"label":"Dette/EBITDA","val":"string","sub":"string","color":"green"}
  ],
  "ca": {"labels":["2020","2021","2022","2023","2024","2025","2026e"],"vals":[0,0,0,0,0,0,0],"unit":"M€ ou Md$"},
  "margin": {"labels":["2021","2022","2023","2024","2025"],"net":[0,0,0,0,0],"pct":[0,0,0,0,0]},
  "sectors": {"labels":["s1","s2","s3"],"vals":[40,35,25]},
  "peComp": {"labels":["${ticker}","Comp1","Comp2","Comp3","Secteur"],"vals":[0,0,0,0,0]},
  "ratios": [
    {"l":"P/E TTM","v":"string","c":"green"},
    {"l":"EV/EBITDA","v":"string","c":"teal"},
    {"l":"P/Book","v":"string","c":"teal"},
    {"l":"ROE","v":"string","c":"green"},
    {"l":"Div. Yield","v":"string","c":"amber"},
    {"l":"Payout","v":"string","c":"teal"},
    {"l":"Marge brute","v":"string","c":"green"},
    {"l":"ROIC","v":"string","c":"teal"}
  ],
  "levels": [
    {"label":"Résistance majeure","price":"string","type":"res"},
    {"label":"Résistance intermédiaire","price":"string","type":"res"},
    {"label":"Cours actuel","price":"${price}","type":"now"},
    {"label":"Support intermédiaire","price":"string","type":"sup"},
    {"label":"Support fort / plus bas 52s","price":"string","type":"sup"},
    {"label":"Stop loss psychologique","price":"string","type":"stop"}
  ],
  "scenarios": [
    {"pct":"Tranche 1 — 60%","entry":"string","target":"string","up":"string"},
    {"pct":"Tranche 2 — 30%","entry":"string","target":"string","up":"string"},
    {"pct":"PRX moyen cible","entry":"string","target":"Consensus","up":"string"}
  ],
  "catalysts": [
    {"icon":"🎯","title":"string","text":"string"},
    {"icon":"📈","title":"string","text":"string"},
    {"icon":"🌐","title":"string","text":"string"}
  ],
  "risks": [
    {"warn":false,"title":"string","text":"string"},
    {"warn":true,"title":"string","text":"string"}
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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' });

    let raw = data.content.map(c => c.text || '').join('');
    raw = raw.replace(/```json|```/g, '').trim();
    return res.status(200).json(JSON.parse(raw));

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
