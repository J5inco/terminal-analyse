// api/quote.js — Yahoo Finance proxy enrichi (cours + fondamentaux + historique + news)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker, mode, range } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json,text/plain,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://finance.yahoo.com',
    'Referer': 'https://finance.yahoo.com/',
  };

  // Helper: get Yahoo crumb + cookie (needed for v11 quoteSummary)
  async function getYahooCrumb() {
    try {
      const cookieRes = await fetch('https://fc.yahoo.com', { headers: HEADERS });
      const cookie = cookieRes.headers.get('set-cookie') || '';
      const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        headers: { ...HEADERS, 'Cookie': cookie }
      });
      const crumb = await crumbRes.text();
      return { crumb: crumb.trim(), cookie };
    } catch(e) {
      return { crumb: '', cookie: '' };
    }
  }

  // MODE: HISTORY
  if (mode === 'history') {
    const r = range || '1y';
    const intervalMap = { '1mo':'1d','6mo':'1wk','1y':'1wk','3y':'1mo','5y':'1mo','10y':'1mo' };
    const interval = intervalMap[r] || '1wk';
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${r}`;
      const response = await fetch(url, { headers: HEADERS });
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (!result) return res.status(200).json({ error: 'No history data' });
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      const points = timestamps.map((t, i) => ({ t: t * 1000, v: closes[i] })).filter(p => p.v != null);
      return res.status(200).json({ points, currency: result.meta?.currency || 'USD' });
    } catch (err) {
      return res.status(200).json({ error: err.message });
    }
  }

  // MODE: FINANCIALS
  if (mode === 'financials') {
    try {
      const isEUR = ticker.includes('.PA') || ticker.includes('.DE') || ticker.includes('.AMS');
      const unit  = isEUR ? 'Md€' : 'Md$';
      const mUnit = isEUR ? 'M€'  : 'M$';

      // Get crumb for v11 access
      const { crumb, cookie } = await getYahooCrumb();
      const authHeaders = { ...HEADERS, ...(cookie ? { 'Cookie': cookie } : {}) };
      const crumbParam  = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';

      // Fetch quoteSummary with crumb
      const summaryUrl = `https://query2.finance.yahoo.com/v11/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=incomeStatementHistory,cashflowStatementHistory,balanceSheetHistory,earningsHistory${crumbParam}`;
      const summaryRes = await fetch(summaryUrl, { headers: authHeaders });
      const summaryData = await summaryRes.json();
      const s = summaryData?.quoteSummary?.result?.[0];

      // Dividend history via v8/chart (works without crumb)
      let divHistory = { labels: [], data: [] };
      try {
        const divUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=5y&events=dividends`;
        const divRes  = await fetch(divUrl, { headers: HEADERS });
        const divData = await divRes.json();
        const divs    = divData?.chart?.result?.[0]?.events?.dividends || {};
        const byYear  = {};
        Object.values(divs).forEach(d => {
          const yr = new Date(d.date * 1000).getFullYear().toString();
          byYear[yr] = (byYear[yr] || 0) + d.amount;
        });
        const divYears = Object.keys(byYear).sort().slice(-4);
        divHistory = {
          labels: divYears,
          data: divYears.map(y => parseFloat(byYear[y].toFixed(2)))
        };
      } catch(e) {}

      // If no summary data, return at least divHistory
      if (!s) {
        return res.status(200).json({
          labels: [],
          ca:            { labels: [], data: [], unit },
          earnings:      { labels: [], net: [], netUnit: mUnit, margin: [] },
          bnaHistory:    { labels: [], data: [] },
          fcfAbsHistory: { labels: [], data: [], unit: mUnit },
          debtHistory:   { labels: [], data: [], unit: mUnit },
          divHistory,
        });
      }

      const incomeStmts = (s.incomeStatementHistory?.incomeStatementHistory || []).slice(0,4).reverse();
      const cashflows   = (s.cashflowStatementHistory?.cashflowStatements   || []).slice(0,4).reverse();
      const balances    = (s.balanceSheetHistory?.balanceSheetStatements    || []).slice(0,4).reverse();

      const labels = incomeStmts.map(i => {
        const d = new Date((i.endDate?.raw || 0) * 1000);
        return d.getFullYear().toString();
      });

      const ca = incomeStmts.map(i => parseFloat(((i.totalRevenue?.raw || 0) / 1e9).toFixed(2)));

      const netIncome = incomeStmts.map(i => parseFloat(((i.netIncome?.raw || 0) / 1e6).toFixed(0)));

      const netMargin = incomeStmts.map(i => {
        const rev = i.totalRevenue?.raw || 0;
        const net = i.netIncome?.raw    || 0;
        return rev > 0 ? parseFloat((net / rev * 100).toFixed(1)) : 0;
      });

      const eps = (s.earningsHistory?.history || []).slice(0,4).reverse().map(e =>
        parseFloat((e.epsActual?.raw || 0).toFixed(2))
      );

      const fcf = cashflows.map(c => {
        const op    = c.totalCashFromOperatingActivities?.raw || 0;
        const capex = c.capitalExpenditures?.raw || 0;
        return parseFloat(((op + capex) / 1e6).toFixed(0));
      });

      const totalDebt = balances.map(b => {
        const ltd = b.longTermDebt?.raw      || 0;
        const std = b.shortLongTermDebt?.raw || 0;
        return parseFloat(((ltd + std) / 1e6).toFixed(0));
      });

      return res.status(200).json({
        labels,
        ca:            { labels, data: ca,        unit },
        earnings:      { labels, net: netIncome,  netUnit: mUnit, margin: netMargin },
        bnaHistory:    { labels, data: eps },
        fcfAbsHistory: { labels, data: fcf,        unit: mUnit },
        debtHistory:   { labels, data: totalDebt,  unit: mUnit },
        divHistory,
      });
    } catch(err) {
      return res.status(200).json({ error: err.message });
    }
  }

  // MODE: NEWS
  if (mode === 'news') {
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=10&quotesCount=0`;
      const response = await fetch(url, { headers: HEADERS });
      const data = await response.json();
      const news = (data?.news || []).slice(0, 8).map(n => ({
        title: n.title,
        url: n.link,
        source: n.publisher,
        time: n.providerPublishTime,
      }));
      return res.status(200).json({ news });
    } catch (err) {
      return res.status(200).json({ news: [] });
    }
  }

  // MODE: DEFAULT (quote + fundamentals)
  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const chartRes = await fetch(chartUrl, { headers: HEADERS });
    if (!chartRes.ok) throw new Error(`Yahoo chart returned ${chartRes.status}`);
    const chartData = await chartRes.json();
    const result = chartData?.chart?.result?.[0];
    if (!result) throw new Error('No data from Yahoo chart');

    const meta = result.meta;
    const current   = meta.regularMarketPrice;
    const prev      = meta.chartPreviousClose || meta.previousClose;
    const change    = current - prev;
    const changePct = (change / prev) * 100;
    const currency  = meta.currency || 'USD';
    const name      = meta.longName || meta.shortName || ticker;
    const exchange  = meta.fullExchangeName || meta.exchangeName || '';
    const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

    const fmtPrice = currency === 'EUR'
      ? `${current.toFixed(2).replace('.', ',')} €`
      : `${sym}${current.toFixed(2)}`;
    const fmtChange = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
    const exch = exchange.toLowerCase().includes('paris') || ticker.includes('.PA') ? 'paris' : 'us';

    let fundamentals = {};
    try {
      const { crumb, cookie } = await getYahooCrumb();
      const authHeaders = { ...HEADERS, ...(cookie ? { 'Cookie': cookie } : {}) };
      const crumbParam  = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
      const modules = 'defaultKeyStatistics,financialData,summaryDetail,assetProfile,calendarEvents';
      const summaryUrl = `https://query2.finance.yahoo.com/v11/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}${crumbParam}`;
      const summaryRes  = await fetch(summaryUrl, { headers: authHeaders });
      const summaryData = await summaryRes.json();
      const s = summaryData?.quoteSummary?.result?.[0];
      if (s) {
        const fd = s.financialData        || {};
        const ks = s.defaultKeyStatistics || {};
        const sd = s.summaryDetail        || {};
        const ap = s.assetProfile         || {};
        const ce = s.calendarEvents       || {};
        const sharesRaw   = ks.sharesOutstanding?.raw || 0;
        const fcfRaw      = fd.freeCashflow?.raw      || 0;
        const fcfPerShare = sharesRaw > 0 ? fcfRaw / sharesRaw : null;
        const trailingEps = ks.trailingEps?.raw || null;
        const divYield    = sd.dividendYield?.raw || sd.trailingAnnualDividendYield?.raw || null;
        const divAnnual   = sd.dividendRate?.raw  || sd.trailingAnnualDividendRate?.raw  || null;
        let earningsDate  = null;
        const earningsArr = ce.earnings?.earningsDate;
        if (Array.isArray(earningsArr) && earningsArr.length > 0) earningsDate = earningsArr[0].raw * 1000;
        fundamentals = {
          trailingPE:        ks.trailingPE?.raw        || sd.trailingPE?.raw || null,
          forwardPE:         ks.forwardPE?.raw         || null,
          priceToBook:       ks.priceToBook?.raw       || null,
          evToEbitda:        ks.enterpriseToEbitda?.raw || null,
          pegRatio:          ks.pegRatio?.raw          || null,
          trailingEps, fcfPerShare,
          bookValuePerShare: ks.bookValue?.raw         || null,
          grossMargin:       fd.grossMargins?.raw      || null,
          operatingMargin:   fd.operatingMargins?.raw  || null,
          netMargin:         fd.profitMargins?.raw     || null,
          roe:               fd.returnOnEquity?.raw    || null,
          roa:               fd.returnOnAssets?.raw    || null,
          currentRatio:      fd.currentRatio?.raw      || null,
          debtToEquity:      fd.debtToEquity?.raw      || null,
          freeCashflow:      fd.freeCashflow?.raw      || null,
          beta:              ks.beta?.raw || sd.beta?.raw || null,
          float:             ks.floatShares?.raw       || null,
          sharesOutstanding: sharesRaw,
          totalDebt:         sd.totalDebt?.raw || ks.totalDebt?.raw || null,
          avgVolume30d:      sd.averageVolume?.raw     || null,
          volume:            meta.regularMarketVolume  || null,
          divYield, divAnnual,
          exDivDate:   sd.exDividendDate?.raw ? sd.exDividendDate.raw * 1000 : null,
          description: ap.longBusinessSummary || null,
          employees:   ap.fullTimeEmployees   || null,
          country:     ap.country             || null,
          website:     ap.website             || null,
          industry:    ap.industry            || null,
          earningsDate,
          priceFCF: fcfPerShare && current ? current / fcfPerShare : null,
        };
      }
    } catch(e) { /* fundamentals not critical */ }

    const cap = meta.marketCap
      || (fundamentals.sharesOutstanding > 0 && current ? fundamentals.sharesOutstanding * current : null);
    const fmtCap = cap
      ? cap >= 1e12 ? `${sym}${(cap/1e12).toFixed(2)} Bn`
        : cap >= 1e9  ? `${sym}${(cap/1e9).toFixed(1)} Md`
        : cap >= 1e6  ? `${sym}${(cap/1e6).toFixed(0)} M`
        : `${sym}${cap.toFixed(0)}`
      : '—';

    return res.status(200).json({
      ticker: ticker.toUpperCase(), name, price: fmtPrice, priceRaw: current,
      change: fmtChange, changeRaw: changePct, pos: changePct >= 0,
      cap: fmtCap, capRaw: cap || 0, currency, exchange: exch, exchangeName: exchange,
      high52: meta.fiftyTwoWeekHigh, low52: meta.fiftyTwoWeekLow,
      updatedAt: new Date().toISOString(), ...fundamentals,
    });
  } catch (err) {
    return res.status(200).json({
      ticker: ticker.toUpperCase(), name: ticker.toUpperCase(),
      price: '—', priceRaw: 0, change: '—', changeRaw: 0,
      pos: true, cap: '—', currency: 'USD', exchange: 'us', exchangeName: '—',
      error: err.message,
    });
  }
}
