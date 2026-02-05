/**
 * Polygon.io (Massive) provider - Premium financial data API
 * https://polygon.io/docs/stocks
 *
 * Provides real-time and historical market data from all US exchanges.
 */

import type {
  FinancialDataProvider,
  DataType,
  RateLimitStatus,
  PriceSnapshot,
  PriceBar,
  PriceHistoryParams,
  IncomeStatement,
  BalanceSheet,
  CashFlowStatement,
  FinancialStatementsParams,
  KeyRatios,
  CompanyInfo,
  NewsArticle,
  NewsParams,
} from './types.js';

const POLYGON_BASE_URL = 'https://api.polygon.io';

// Rate limiting tracking
let requestCount = 0;
let windowStart = Date.now();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
// Advanced plan typically allows unlimited requests, but we'll track anyway
const MAX_REQUESTS_PER_MINUTE = 1000;

function checkRateLimit(): void {
  const now = Date.now();
  if (now - windowStart > RATE_LIMIT_WINDOW) {
    windowStart = now;
    requestCount = 0;
  }
  requestCount++;
}

async function callPolygon(endpoint: string, params: Record<string, string | number | undefined> = {}): Promise<unknown> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    throw new Error('POLYGON_API_KEY not configured');
  }

  checkRateLimit();

  const url = new URL(`${POLYGON_BASE_URL}${endpoint}`);
  url.searchParams.set('apiKey', apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString());

  if (response.status === 429) {
    throw new Error('Polygon rate limit exceeded');
  }

  if (response.status === 403) {
    throw new Error('Polygon API key invalid or insufficient permissions');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Polygon API error: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

export class PolygonProvider implements FinancialDataProvider {
  name = 'polygon';
  priority = 15; // High priority (paid, comprehensive, reliable)

  private supportedTypes: Set<DataType> = new Set([
    'priceSnapshot',
    'priceHistory',
    'incomeStatements',
    'balanceSheets',
    'cashFlowStatements',
    'keyRatiosSnapshot',
    'companyInfo',
    'news',
  ]);

  supports(dataType: DataType): boolean {
    return this.supportedTypes.has(dataType);
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.POLYGON_API_KEY;
  }

  getRateLimitStatus(): RateLimitStatus {
    const now = Date.now();
    if (now - windowStart > RATE_LIMIT_WINDOW) {
      return { remaining: MAX_REQUESTS_PER_MINUTE, isLimited: false };
    }

    const remaining = MAX_REQUESTS_PER_MINUTE - requestCount;
    return {
      remaining: Math.max(0, remaining),
      resetAt: new Date(windowStart + RATE_LIMIT_WINDOW),
      isLimited: remaining <= 0,
    };
  }

  async getPriceSnapshot(ticker: string): Promise<PriceSnapshot> {
    // Use the snapshot endpoint for real-time data
    const data = await callPolygon(`/v2/snapshot/locale/us/markets/stocks/tickers/${ticker.toUpperCase()}`) as {
      status: string;
      ticker: {
        ticker: string;
        day: { o: number; h: number; l: number; c: number; v: number };
        prevDay: { c: number };
        todaysChange: number;
        todaysChangePerc: number;
        updated: number;
        min?: { o: number; h: number; l: number; c: number; v: number };
      };
    };

    const t = data.ticker;
    return {
      ticker: t.ticker,
      price: t.day?.c || t.min?.c || 0,
      open: t.day?.o,
      high: t.day?.h,
      low: t.day?.l,
      close: t.day?.c,
      volume: t.day?.v,
      previousClose: t.prevDay?.c,
      change: t.todaysChange,
      changePercent: t.todaysChangePerc,
      timestamp: t.updated ? new Date(t.updated).toISOString() : undefined,
    };
  }

  async getPriceHistory(params: PriceHistoryParams): Promise<PriceBar[]> {
    // Map interval to Polygon timespan
    const timespanMap: Record<string, string> = {
      minute: 'minute',
      day: 'day',
      week: 'week',
      month: 'month',
      year: 'year',
    };
    const timespan = timespanMap[params.interval || 'day'] || 'day';
    const multiplier = params.intervalMultiplier || 1;

    const data = await callPolygon(
      `/v2/aggs/ticker/${params.ticker.toUpperCase()}/range/${multiplier}/${timespan}/${params.startDate}/${params.endDate}`,
      {
        adjusted: 'true',
        sort: 'asc',
        limit: 50000,
      }
    ) as {
      status: string;
      resultsCount: number;
      results?: Array<{
        t: number; // timestamp
        o: number;
        h: number;
        l: number;
        c: number;
        v: number;
      }>;
    };

    if (!data.results) {
      return [];
    }

    return data.results.map((bar) => ({
      date: new Date(bar.t).toISOString().split('T')[0],
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    }));
  }

  async getIncomeStatements(params: FinancialStatementsParams): Promise<IncomeStatement[]> {
    const timeframe = params.period === 'quarterly' ? 'quarterly' : 'annual';

    const data = await callPolygon(`/vX/reference/financials`, {
      ticker: params.ticker.toUpperCase(),
      timeframe,
      limit: params.limit || 10,
      include_sources: 'false',
    }) as {
      status: string;
      results?: Array<{
        fiscal_period: string;
        fiscal_year: number;
        end_date: string;
        financials: {
          income_statement?: Record<string, { value: number; unit: string }>;
        };
      }>;
    };

    if (!data.results) {
      return [];
    }

    return data.results.map((r) => {
      const is = r.financials.income_statement || {};
      return {
        ticker: params.ticker,
        reportPeriod: r.end_date,
        period: params.period,
        fiscalYear: r.fiscal_year,
        fiscalPeriod: r.fiscal_period,
        revenue: is.revenues?.value,
        costOfRevenue: is.cost_of_revenue?.value,
        grossProfit: is.gross_profit?.value,
        operatingExpenses: is.operating_expenses?.value,
        operatingIncome: is.operating_income_loss?.value,
        netIncome: is.net_income_loss?.value,
        eps: is.basic_earnings_per_share?.value,
        epsDiluted: is.diluted_earnings_per_share?.value,
      };
    });
  }

  async getBalanceSheets(params: FinancialStatementsParams): Promise<BalanceSheet[]> {
    const timeframe = params.period === 'quarterly' ? 'quarterly' : 'annual';

    const data = await callPolygon(`/vX/reference/financials`, {
      ticker: params.ticker.toUpperCase(),
      timeframe,
      limit: params.limit || 10,
      include_sources: 'false',
    }) as {
      status: string;
      results?: Array<{
        fiscal_period: string;
        fiscal_year: number;
        end_date: string;
        financials: {
          balance_sheet?: Record<string, { value: number; unit: string }>;
        };
      }>;
    };

    if (!data.results) {
      return [];
    }

    return data.results.map((r) => {
      const bs = r.financials.balance_sheet || {};
      return {
        ticker: params.ticker,
        reportPeriod: r.end_date,
        period: params.period,
        fiscalYear: r.fiscal_year,
        fiscalPeriod: r.fiscal_period,
        totalAssets: bs.assets?.value,
        totalLiabilities: bs.liabilities?.value,
        totalEquity: bs.equity?.value || bs.stockholders_equity?.value,
        cash: bs.cash_and_cash_equivalents?.value,
        totalDebt: bs.long_term_debt?.value,
        currentAssets: bs.current_assets?.value,
        currentLiabilities: bs.current_liabilities?.value,
      };
    });
  }

  async getCashFlowStatements(params: FinancialStatementsParams): Promise<CashFlowStatement[]> {
    const timeframe = params.period === 'quarterly' ? 'quarterly' : 'annual';

    const data = await callPolygon(`/vX/reference/financials`, {
      ticker: params.ticker.toUpperCase(),
      timeframe,
      limit: params.limit || 10,
      include_sources: 'false',
    }) as {
      status: string;
      results?: Array<{
        fiscal_period: string;
        fiscal_year: number;
        end_date: string;
        financials: {
          cash_flow_statement?: Record<string, { value: number; unit: string }>;
        };
      }>;
    };

    if (!data.results) {
      return [];
    }

    return data.results.map((r) => {
      const cf = r.financials.cash_flow_statement || {};
      return {
        ticker: params.ticker,
        reportPeriod: r.end_date,
        period: params.period,
        fiscalYear: r.fiscal_year,
        fiscalPeriod: r.fiscal_period,
        operatingCashFlow: cf.net_cash_flow_from_operating_activities?.value,
        investingCashFlow: cf.net_cash_flow_from_investing_activities?.value,
        financingCashFlow: cf.net_cash_flow_from_financing_activities?.value,
      };
    });
  }

  async getKeyRatiosSnapshot(ticker: string): Promise<KeyRatios> {
    // Get ticker details for market cap and other info
    const details = await callPolygon(`/v3/reference/tickers/${ticker.toUpperCase()}`) as {
      status: string;
      results?: {
        ticker: string;
        market_cap?: number;
        share_class_shares_outstanding?: number;
        weighted_shares_outstanding?: number;
      };
    };

    // Get latest financials to calculate ratios
    const financials = await callPolygon(`/vX/reference/financials`, {
      ticker: ticker.toUpperCase(),
      limit: 1,
      include_sources: 'false',
    }) as {
      status: string;
      results?: Array<{
        financials: {
          income_statement?: Record<string, { value: number }>;
          balance_sheet?: Record<string, { value: number }>;
        };
      }>;
    };

    const d = details.results || {};
    const f = financials.results?.[0]?.financials || {};
    const is = f.income_statement || {};
    const bs = f.balance_sheet || {};

    // Get current price for P/E calculation
    let currentPrice: number | undefined;
    try {
      const snapshot = await this.getPriceSnapshot(ticker);
      currentPrice = snapshot.price;
    } catch {
      // Ignore if snapshot fails
    }

    const eps = is.basic_earnings_per_share?.value;
    const peRatio = currentPrice && eps && eps > 0 ? currentPrice / eps : undefined;

    const totalEquity = bs.equity?.value || bs.stockholders_equity?.value;
    const pbRatio = currentPrice && totalEquity && d.share_class_shares_outstanding
      ? (currentPrice * d.share_class_shares_outstanding) / totalEquity
      : undefined;

    return {
      ticker,
      marketCap: d.market_cap,
      peRatio,
      pbRatio,
      eps,
      sharesOutstanding: d.share_class_shares_outstanding || d.weighted_shares_outstanding,
    };
  }

  async getCompanyInfo(ticker: string): Promise<CompanyInfo> {
    const data = await callPolygon(`/v3/reference/tickers/${ticker.toUpperCase()}`) as {
      status: string;
      results?: {
        ticker: string;
        name: string;
        market_cap?: number;
        sic_code?: string;
        sic_description?: string;
        total_employees?: number;
        primary_exchange?: string;
        homepage_url?: string;
        description?: string;
        locale?: string;
        address?: {
          city?: string;
          state?: string;
        };
        branding?: {
          logo_url?: string;
          icon_url?: string;
        };
        list_date?: string;
      };
    };

    const r = data.results || {};
    return {
      ticker: r.ticker || ticker,
      name: r.name,
      industry: r.sic_description,
      sicCode: r.sic_code,
      marketCap: r.market_cap,
      employees: r.total_employees,
      exchange: r.primary_exchange,
      website: r.homepage_url,
      description: r.description,
      city: r.address?.city,
      state: r.address?.state,
      listDate: r.list_date,
      logoUrl: r.branding?.logo_url,
    };
  }

  async getNews(params: NewsParams): Promise<NewsArticle[]> {
    const queryParams: Record<string, string | number | undefined> = {
      ticker: params.ticker.toUpperCase(),
      limit: params.limit || 10,
      order: 'desc',
      sort: 'published_utc',
    };

    if (params.startDate) {
      queryParams['published_utc.gte'] = params.startDate;
    }
    if (params.endDate) {
      queryParams['published_utc.lte'] = params.endDate;
    }

    const data = await callPolygon('/v2/reference/news', queryParams) as {
      status: string;
      results?: Array<{
        title: string;
        article_url: string;
        published_utc: string;
        publisher: { name: string };
        description?: string;
        tickers?: string[];
      }>;
    };

    if (!data.results) {
      return [];
    }

    return data.results.map((n) => ({
      title: n.title,
      url: n.article_url,
      publishedAt: n.published_utc,
      source: n.publisher?.name,
      summary: n.description,
      ticker: params.ticker,
    }));
  }
}
