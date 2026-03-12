// api/quote.js — Yahoo Finance proxy via yahoo-finance2 (cours + fondamentaux + historique + news)
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticker, mode, range } = req.query;
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  // Suppress yahoo-finance2 validation warnings
  yahooFinance.setGlobalConfig({ validation: { logErrors: false } });

  // MODE: HISTORY
  if (mode === 'history') {
    const r = range || '1y';
    const intervalMap = { '1mo':'1d','6mo':'1wk','1y':'1wk','3y':'1mo','5y':'1mo','10y':'1mo' };
    const interval = intervalMap[r] || '1wk';
    try {
      const rangeMap = { '1mo':30,'6mo':180,'1y':365,'3y':1095,'5y':1825,'10y':3650 };
      const days = rangeMap[r] || 365;
      const period1 = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const result = await yahooFinance.chart(ticker, { interval, period1 });
      if (!result?.quotes?.length) return res.status(200).json({ error: 'No history data' });
      const points = result.quotes.map(q => ({ t: new Date(q.date).getTime(), v: q.close })).filter(p => p.v != null);
      return res.status(200).json({ points, currency: result.meta?.currency || 'USD' });
    } catch (err) {
      return res.status(200).json({ error: err.message });
    }
  }

  // MODE: FINANCIALS (historical data - CA, résultat net, BNA, FCF, dette, dividendes)
  if (mode === 'financials') {
    try {
      const isEUR = ticker.includes('.PA') || ticker.includes('.DE') || ticker.includes('.AMS');
      const divisor = 1e9;
      const unit    = isEUR ? 'Md€' : 'Md$';
      const mUnit   = isEUR ? 'M€'  : 'M$';

      // Fetch quoteSummary with all needed modules
      const summary = await yahooFinance.quoteSummary(ticker, {
        modules: ['incomeStatementHistory', 'cashflowStatementHistory', 'balanceSheetHistory', 'earningsHistory'],
      }).catch(() => null);

      // Fetch dividend history separately via chart
      let divHistory = { labels: [], data: [] };
      try {
        const period1 = new Date(Date.now() - 5 * 365 * 86400000).toISOString().split('T')[0];
        const divChart = await yahooFinance.chart(ticker, {
          interval: '1mo',
          period1,
          events: 'dividends',
        });
        const divs = divChart?.events?.dividends || [];
        const byYear = {};
        divs.forEach(d => {
          const yr = new Date(d.date).getFullYear().toString();
          byYear[yr] = (byYear[yr] || 0) + (d.amount || 0);
        });
        const divYears = Object.keys(byYear).sort().slice(-4);
        divHistory = {
          labels: divYears,
          data: divYears.map(y => parseFloat(byYear[y].toFixed(2))),
        };
      } catch(e) {}

      // If quoteSummary failed, still return div history
      if (!summary) {
        return res.status(200).json({
          labels: [], ca: { labels:[], data:[], unit }, 
          earnings: { labels:[], net:[], netUnit:mUnit, margin:[] },
          bnaHistory: { labels:[], data:[] },
          fcfAbsHistory: { labels:[], data:[], unit:mUnit },
          debtHistory: { labels:[], data:[], unit:mUnit },
          divHistory,
        });
      }

      const incomeStmts = (summary.incomeStatementHistory?.incomeStatementHistory || []).slice(0,4).reverse();
      const cashflows   = (summary.cashflowStatementHistory?.cashflowStatements   || []).slice(0,4).reverse();
      const balances    = (summary.balanceSheetHistory?.balanceSheetStatements    || []).slice(0,4).reverse();
      const earnings    = (summary.earningsHistory?.history || []).slice(0,4).reverse();

      const labels = incomeStmts.map(i => {
        const d = i.endDate instanceof Date ? i.endDate : new Date((i.endDate?.raw || 0) * 1000);
        return d.getFullYear().toString();
      });

      const ca = incomeStmts.map(i => {
        const v = i.totalRevenue || i.totalRevenue?.raw || 0;
        return parseFloat((v / divisor).toFixed(2));
      });

      const netIncome = incomeStmts.map(i => {
        const v = i.netIncome || i.netIncome?.raw || 0;
        return parseFloat((v / 1e6).toFixed(0));
      });

      const netMargin = incomeStmts.map(i => {
        const rev = i.totalRevenue || i.totalRevenue?.raw || 0;
        const net = i.netIncome    || i.netIncome?.raw    || 0;
        return rev > 0 ? parseFloat((net / rev * 100).toFixed(1)) : 0;
      });

      const eps = earnings.map(e => {
        const v = e.epsActual || e.epsActual?.raw || 0;
        return parseFloat(v.toFixed(2));
      });

      const fcf = cashflows.map(c => {
        const op    = c.totalCashFromOperatingActivities || c.totalCashFromOperatingActivities?.raw || 0;
        const capex = c.capitalExpenditures || c.capitalExpenditures?.raw || 0;
        return parseFloat(((op + capex) / 1e6).toFixed(0));
      });

      const totalDebt = balances.map(b => {
        const ltd = b.longTermDebt        || b.longTermDebt?.raw        || 0;
        const std = b.shortLongTermDebt   || b.shortLongTermDebt?.raw   || 0;
        return parseFloat(((ltd + std) / 1e6).toFixed(0));
      });

      return res.status(200).json({
        labels,
        ca:            { labels, data: ca,        unit   },
        earnings:      { labels, net: netIncome,  netUnit: mUnit, margin: netMargin },
        bnaHistory:    { labels, data: eps },
        fcfAbsHistory: { labels, data: fcf,       unit: mUnit },
        debtHistory:   { labels, data: totalDebt, unit: mUnit },
        divHistory,
      });
    } catch(err) {
      return res.status(200).json({ error: err.message });
    }
  }

  // MODE: NEWS
  if (mode === 'news') {
    try {
      const results = await yahooFinance.search(ticker, { newsCount: 8, quotesCount: 0 });
      const news = (results?.news || []).map(n => ({
        title: n.title,
        url: n.link,
        source: n.publisher,
        time: n.providerPublishTime instanceof Date
          ? n.providerPublishTime.getTime() / 1000
          : n.providerPublishTime,
      }));
      return res.status(200).json({ news });
    } catch (err) {
      return res.status(200).json({ news: [] });
    }
  }

  // MODE: DEFAULT (quote + fundamentals)
  try {
    const quote = await yahooFinance.quote(ticker);
    if (!quote) throw new Error('No data');

    const current    = quote.regularMarketPrice;
    const prev       = quote.regularMarketPreviousClose || quote.chartPreviousClose;
    const change     = current - prev;
    const changePct  = (change / prev) * 100;
    const currency   = quote.currency || 'USD';
    const name       = quote.longName || quote.shortName || ticker;
    const exchange   = quote.fullExchangeName || quote.exchange || '';
    const sym        = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
    const isEUR      = currency === 'EUR';

    const fmtPrice = isEUR
      ? `${current.toFixed(2).replace('.', ',')} €`
      : `${sym}${current.toFixed(2)}`;
    const fmtChange  = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
    const exch       = exchange.toLowerCase().includes('paris') || ticker.includes('.PA') ? 'paris' : 'us';

    let fundamentals = {};
    try {
      const summary = await yahooFinance.quoteSummary(ticker, {
        modules: ['defaultKeyStatistics','financialData','summaryDetail','assetProfile','calendarEvents'],
      });
      if (summary) {
        const fd  = summary.financialData       || {};
        const ks  = summary.defaultKeyStatistics || {};
        const sd  = summary.summaryDetail        || {};
        const ap  = summary.assetProfile         || {};
        const ce  = summary.calendarEvents       || {};

        const sharesRaw    = ks.sharesOutstanding || 0;
        const fcfRaw       = fd.freeCashflow      || 0;
        const fcfPerShare  = sharesRaw > 0 ? fcfRaw / sharesRaw : null;
        const trailingEps  = ks.trailingEps       || null;
        const divYield     = sd.dividendYield     || sd.trailingAnnualDividendYield || null;
        const divAnnual    = sd.dividendRate      || sd.trailingAnnualDividendRate  || null;

        let earningsDate = null;
        const earningsArr = ce.earnings?.earningsDate;
        if (Array.isArray(earningsArr) && earningsArr.length > 0) {
          const d = earningsArr[0];
          earningsDate = d instanceof Date ? d.getTime() : (d?.raw || 0) * 1000;
        }

        const exDivRaw = sd.exDividendDate;
        const exDivDate = exDivRaw instanceof Date ? exDivRaw.getTime() : exDivRaw ? exDivRaw * 1000 : null;

        fundamentals = {
          trailingPE:        ks.trailingPE         || sd.trailingPE || null,
          forwardPE:         ks.forwardPE          || null,
          priceToBook:       ks.priceToBook        || null,
          evToEbitda:        ks.enterpriseToEbitda || null,
          pegRatio:          ks.pegRatio           || null,
          trailingEps, fcfPerShare,
          bookValuePerShare: ks.bookValue          || null,
          grossMargin:       fd.grossMargins       || null,
          operatingMargin:   fd.operatingMargins   || null,
          netMargin:         fd.profitMargins      || null,
          roe:               fd.returnOnEquity     || null,
          roa:               fd.returnOnAssets     || null,
          currentRatio:      fd.currentRatio       || null,
          debtToEquity:      fd.debtToEquity       || null,
          freeCashflow:      fd.freeCashflow       || null,
          beta:              ks.beta               || sd.beta || null,
          float:             ks.floatShares        || null,
          sharesOutstanding: sharesRaw,
          totalDebt:         sd.totalDebt          || ks.totalDebt || null,
          avgVolume30d:      sd.averageVolume       || null,
          volume:            quote.regularMarketVolume || null,
          divYield, divAnnual, exDivDate,
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

    const cap = quote.marketCap
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
      high52: quote.fiftyTwoWeekHigh, low52: quote.fiftyTwoWeekLow,
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
