// api/quote.js — Yahoo Finance proxy (cours différé 15min, gratuit)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);
    const data = await response.json();

    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('No data from Yahoo');

    const meta = result.meta;
    const current = meta.regularMarketPrice;
    const prev    = meta.chartPreviousClose || meta.previousClose;
    const change  = current - prev;
    const changePct = (change / prev) * 100;
    const currency = meta.currency || 'USD';
    const name     = meta.longName || meta.shortName || ticker;
    const exchange = meta.fullExchangeName || meta.exchangeName || '';
    const cap      = meta.marketCap;

    // Format price with currency
    const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
    const fmtPrice = currency === 'EUR'
      ? `${current.toFixed(2).replace('.', ',')} €`
      : `${sym}${current.toFixed(2)}`;
    const fmtChange = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
    const fmtCap = cap
      ? cap >= 1e12 ? `${sym}${(cap/1e12).toFixed(2)}T`
        : cap >= 1e9 ? `${sym}${(cap/1e9).toFixed(1)}B`
        : `${sym}${(cap/1e6).toFixed(0)}M`
      : '—';

    // Detect exchange
    const exch = exchange.toLowerCase().includes('paris') || currency === 'EUR'
      ? 'paris' : 'us';

    return res.status(200).json({
      ticker: ticker.toUpperCase(),
      name,
      price: fmtPrice,
      priceRaw: current,
      change: fmtChange,
      changeRaw: changePct,
      pos: changePct >= 0,
      cap: fmtCap,
      currency,
      exchange: exch,
      exchangeName: exchange,
      high52: meta.fiftyTwoWeekHigh,
      low52:  meta.fiftyTwoWeekLow,
      updatedAt: new Date().toISOString(),
    });

  } catch (err) {
    // Fallback: return minimal info so UI can still show the ticker
    return res.status(200).json({
      ticker: ticker.toUpperCase(),
      name: ticker.toUpperCase(),
      price: '—',
      priceRaw: 0,
      change: '—',
      changeRaw: 0,
      pos: true,
      cap: '—',
      currency: 'USD',
      exchange: 'us',
      exchangeName: '—',
      error: err.message,
    });
  }
}
