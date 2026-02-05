/**
 * Finnhub provider - Free tier with 60 calls/minute
 * https://finnhub.io/
 */

import type {
  FinancialDataProvider,
  DataType,
  RateLimitStatus,
  PriceSnapshot,
  PriceBar,
  PriceHistoryParams,
  KeyRatios,
  CompanyInfo,
  InsiderTrade,
  InsiderTradesParams,
  NewsArticle,
  NewsParams,
} from './types.js';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Rate limiting: 60 calls/minute for free tier
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_CALLS_PER_WINDOW = 60;

let callsInWindow = 0;
let windowStart = Date.now();

function checkRateLimit(): void {
  const now = Date.now();
  if (now - windowStart > RATE_LIMIT_WINDOW) {
    windowStart = now;
    callsInWindow = 0;
  }

  if (callsInWindow >= MAX_CALLS_PER_WINDOW) {
    const waitTime = RATE_LIMIT_WINDOW - (now - windowStart);
    throw new Error(`Finnhub rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)}s`);
  }

  callsInWindow++;
}

async function callFinnhub(endpoint: string, params: Record<string, string | number>): Promise<unknown> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error('FINNHUB_API_KEY not configured');
  }

  checkRateLimit();

  const url = new URL(`${FINNHUB_BASE_URL}${endpoint}`);
  url.searchParams.set('token', apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString());

  if (response.status === 429) {
    throw new Error('Finnhub rate limit exceeded');
  }

  if (!response.ok) {
    throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export class FinnhubProvider implements FinancialDataProvider {
  name = 'finnhub';
  priority = 30; // Medium-high priority (free, reliable)

  private supportedTypes: Set<DataType> = new Set([
    'priceSnapshot',
    'priceHistory',
    'keyRatiosSnapshot',
    'companyInfo',
    'insiderTrades',
    'news',
  ]);

  supports(dataType: DataType): boolean {
    return this.supportedTypes.has(dataType);
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.FINNHUB_API_KEY;
  }

  getRateLimitStatus(): RateLimitStatus {
    const now = Date.now();
    if (now - windowStart > RATE_LIMIT_WINDOW) {
      return { remaining: MAX_CALLS_PER_WINDOW, isLimited: false };
    }

    const remaining = MAX_CALLS_PER_WINDOW - callsInWindow;
    return {
      remaining,
      resetAt: new Date(windowStart + RATE_LIMIT_WINDOW),
      isLimited: remaining <= 0,
    };
  }

  async getPriceSnapshot(ticker: string): Promise<PriceSnapshot> {
    const data = await callFinnhub('/quote', { symbol: ticker }) as {
      c: number;
      o: number;
      h: number;
      l: number;
      pc: number;
      d: number;
      dp: number;
      t: number;
    };

    return {
      ticker,
      price: data.c,
      open: data.o,
      high: data.h,
      low: data.l,
      close: data.c,
      previousClose: data.pc,
      change: data.d,
      changePercent: data.dp,
      timestamp: new Date(data.t * 1000).toISOString(),
    };
  }

  async getPriceHistory(params: PriceHistoryParams): Promise<PriceBar[]> {
    // Convert dates to Unix timestamps
    const from = Math.floor(new Date(params.startDate).getTime() / 1000);
    const to = Math.floor(new Date(params.endDate).getTime() / 1000);

    // Map interval to Finnhub resolution
    const resolutionMap: Record<string, string> = {
      minute: '1',
      day: 'D',
      week: 'W',
      month: 'M',
    };
    const resolution = resolutionMap[params.interval || 'day'] || 'D';

    const data = await callFinnhub('/stock/candle', {
      symbol: params.ticker,
      resolution,
      from,
      to,
    }) as {
      s: string;
      t: number[];
      o: number[];
      h: number[];
      l: number[];
      c: number[];
      v: number[];
    };

    if (data.s !== 'ok' || !data.t) {
      return [];
    }

    return data.t.map((timestamp, i) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    }));
  }

  async getKeyRatiosSnapshot(ticker: string): Promise<KeyRatios> {
    const [metrics, profile] = await Promise.all([
      callFinnhub('/stock/metric', { symbol: ticker, metric: 'all' }) as Promise<{
        metric: Record<string, number>;
      }>,
      callFinnhub('/stock/profile2', { symbol: ticker }) as Promise<{
        marketCapitalization: number;
      }>,
    ]);

    const m = metrics.metric || {};

    return {
      ticker,
      marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1e6 : undefined, // Finnhub returns in millions
      peRatio: m['peBasicExclExtraTTM'] || m['peTTM'],
      pbRatio: m['pbQuarterly'] || m['pbAnnual'],
      psRatio: m['psTTM'],
      dividendYield: m['dividendYieldIndicatedAnnual'],
      eps: m['epsBasicExclExtraItemsTTM'] || m['epsTTM'],
      roe: m['roeTTM'] || m['roeRfy'],
      roa: m['roaTTM'] || m['roaRfy'],
      currentRatio: m['currentRatioQuarterly'] || m['currentRatioAnnual'],
      quickRatio: m['quickRatioQuarterly'] || m['quickRatioAnnual'],
      debtToEquity: m['totalDebt/totalEquityQuarterly'] || m['totalDebt/totalEquityAnnual'],
      grossMargin: m['grossMarginTTM'],
      operatingMargin: m['operatingMarginTTM'],
      netMargin: m['netProfitMarginTTM'],
      beta: m['beta'],
      '52WeekHigh': m['52WeekHigh'],
      '52WeekLow': m['52WeekLow'],
      revenueGrowth: m['revenueGrowthTTMYoy'],
      epsGrowth: m['epsGrowthTTMYoy'],
    };
  }

  async getCompanyInfo(ticker: string): Promise<CompanyInfo> {
    const data = await callFinnhub('/stock/profile2', { symbol: ticker }) as {
      name: string;
      finnhubIndustry: string;
      marketCapitalization: number;
      exchange: string;
      weburl: string;
      logo: string;
      country: string;
      currency: string;
      ipo: string;
      shareOutstanding: number;
    };

    return {
      ticker,
      name: data.name,
      industry: data.finnhubIndustry,
      marketCap: data.marketCapitalization ? data.marketCapitalization * 1e6 : undefined,
      exchange: data.exchange,
      website: data.weburl,
      country: data.country,
      currency: data.currency,
      ipoDate: data.ipo,
      sharesOutstanding: data.shareOutstanding,
    };
  }

  async getInsiderTrades(params: InsiderTradesParams): Promise<InsiderTrade[]> {
    // Finnhub insider transactions endpoint
    const data = await callFinnhub('/stock/insider-transactions', {
      symbol: params.ticker,
    }) as {
      data: Array<{
        name: string;
        share: number;
        change: number;
        filingDate: string;
        transactionDate: string;
        transactionCode: string;
        transactionPrice: number;
      }>;
    };

    if (!data.data) {
      return [];
    }

    return data.data.slice(0, params.limit || 100).map((t) => ({
      ticker: params.ticker,
      filingDate: t.filingDate,
      transactionDate: t.transactionDate,
      insiderName: t.name,
      transactionType: t.transactionCode,
      sharesTraded: Math.abs(t.change),
      pricePerShare: t.transactionPrice,
      sharesOwned: t.share,
    }));
  }

  async getNews(params: NewsParams): Promise<NewsArticle[]> {
    // Calculate date range (default last 7 days)
    const endDate = params.endDate || new Date().toISOString().split('T')[0];
    const startDate = params.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const data = await callFinnhub('/company-news', {
      symbol: params.ticker,
      from: startDate,
      to: endDate,
    }) as Array<{
      headline: string;
      url: string;
      datetime: number;
      source: string;
      summary: string;
    }>;

    if (!Array.isArray(data)) {
      return [];
    }

    return data.slice(0, params.limit || 10).map((n) => ({
      title: n.headline,
      url: n.url,
      publishedAt: new Date(n.datetime * 1000).toISOString(),
      source: n.source,
      summary: n.summary,
      ticker: params.ticker,
    }));
  }
}
