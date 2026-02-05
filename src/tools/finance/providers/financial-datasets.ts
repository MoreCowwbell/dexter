/**
 * FinancialDatasets.ai provider (existing API, now as fallback)
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
  FilingMetadata,
  FilingContent,
  FilingsParams,
  CompanyInfo,
  InsiderTrade,
  InsiderTradesParams,
  NewsArticle,
  NewsParams,
} from './types.js';

const BASE_URL = 'https://api.financialdatasets.ai';

async function callApi(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>
): Promise<{ data: Record<string, unknown>; url: string }> {
  const apiKey = process.env.FINANCIAL_DATASETS_API_KEY;
  if (!apiKey) {
    throw new Error('FINANCIAL_DATASETS_API_KEY not configured');
  }

  const url = new URL(`${BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: { 'x-api-key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`FinancialDatasets API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return { data, url: url.toString() };
}

export class FinancialDatasetsProvider implements FinancialDataProvider {
  name = 'financial-datasets';
  priority = 100; // Lowest priority (fallback)

  private supportedTypes: Set<DataType> = new Set([
    'priceSnapshot',
    'priceHistory',
    'incomeStatements',
    'balanceSheets',
    'cashFlowStatements',
    'keyRatios',
    'keyRatiosSnapshot',
    'filings',
    'filingContent',
    'companyInfo',
    'insiderTrades',
    'news',
    'analystEstimates',
    'segmentedRevenues',
  ]);

  supports(dataType: DataType): boolean {
    return this.supportedTypes.has(dataType);
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.FINANCIAL_DATASETS_API_KEY;
  }

  getRateLimitStatus(): RateLimitStatus {
    return { remaining: Infinity, isLimited: false };
  }

  async getPriceSnapshot(ticker: string): Promise<PriceSnapshot> {
    const { data } = await callApi('/prices/snapshot/', { ticker });
    const snapshot = data.snapshot as Record<string, unknown>;
    return {
      ticker,
      price: (snapshot.close || snapshot.price) as number,
      open: snapshot.open as number | undefined,
      high: snapshot.high as number | undefined,
      low: snapshot.low as number | undefined,
      close: snapshot.close as number | undefined,
      volume: snapshot.volume as number | undefined,
    };
  }

  async getPriceHistory(params: PriceHistoryParams): Promise<PriceBar[]> {
    const { data } = await callApi('/prices/', {
      ticker: params.ticker,
      start_date: params.startDate,
      end_date: params.endDate,
      interval: params.interval || 'day',
      interval_multiplier: params.intervalMultiplier || 1,
    });

    const prices = (data.prices || []) as Record<string, unknown>[];
    return prices.map((p) => ({
      date: p.date as string,
      open: p.open as number,
      high: p.high as number,
      low: p.low as number,
      close: p.close as number,
      volume: p.volume as number,
    }));
  }

  async getIncomeStatements(params: FinancialStatementsParams): Promise<IncomeStatement[]> {
    const { data } = await callApi('/financials/income-statements/', {
      ticker: params.ticker,
      period: params.period,
      limit: params.limit || 10,
      report_period_gt: params.reportPeriodGt,
      report_period_gte: params.reportPeriodGte,
      report_period_lt: params.reportPeriodLt,
      report_period_lte: params.reportPeriodLte,
    });

    const statements = (data.income_statements || []) as Record<string, unknown>[];
    return statements.map((s) => ({
      ticker: params.ticker,
      reportPeriod: s.report_period as string,
      period: params.period,
      revenue: s.revenue as number | undefined,
      costOfRevenue: s.cost_of_revenue as number | undefined,
      grossProfit: s.gross_profit as number | undefined,
      operatingExpenses: s.operating_expenses as number | undefined,
      operatingIncome: s.operating_income as number | undefined,
      netIncome: s.net_income as number | undefined,
      eps: s.eps as number | undefined,
      epsDiluted: s.eps_diluted as number | undefined,
      ...s,
    }));
  }

  async getBalanceSheets(params: FinancialStatementsParams): Promise<BalanceSheet[]> {
    const { data } = await callApi('/financials/balance-sheets/', {
      ticker: params.ticker,
      period: params.period,
      limit: params.limit || 10,
      report_period_gt: params.reportPeriodGt,
      report_period_gte: params.reportPeriodGte,
      report_period_lt: params.reportPeriodLt,
      report_period_lte: params.reportPeriodLte,
    });

    const statements = (data.balance_sheets || []) as Record<string, unknown>[];
    return statements.map((s) => ({
      ticker: params.ticker,
      reportPeriod: s.report_period as string,
      period: params.period,
      totalAssets: s.total_assets as number | undefined,
      totalLiabilities: s.total_liabilities as number | undefined,
      totalEquity: s.total_equity as number | undefined,
      cash: s.cash as number | undefined,
      totalDebt: s.total_debt as number | undefined,
      ...s,
    }));
  }

  async getCashFlowStatements(params: FinancialStatementsParams): Promise<CashFlowStatement[]> {
    const { data } = await callApi('/financials/cash-flow-statements/', {
      ticker: params.ticker,
      period: params.period,
      limit: params.limit || 10,
      report_period_gt: params.reportPeriodGt,
      report_period_gte: params.reportPeriodGte,
      report_period_lt: params.reportPeriodLt,
      report_period_lte: params.reportPeriodLte,
    });

    const statements = (data.cash_flow_statements || []) as Record<string, unknown>[];
    return statements.map((s) => ({
      ticker: params.ticker,
      reportPeriod: s.report_period as string,
      period: params.period,
      operatingCashFlow: s.operating_cash_flow as number | undefined,
      investingCashFlow: s.investing_cash_flow as number | undefined,
      financingCashFlow: s.financing_cash_flow as number | undefined,
      freeCashFlow: s.free_cash_flow as number | undefined,
      ...s,
    }));
  }

  async getKeyRatiosSnapshot(ticker: string): Promise<KeyRatios> {
    const { data } = await callApi('/financial-metrics/snapshot/', { ticker });
    const snapshot = data.snapshot as Record<string, unknown>;
    return {
      ticker,
      marketCap: snapshot.market_cap as number | undefined,
      peRatio: snapshot.pe_ratio as number | undefined,
      pbRatio: snapshot.pb_ratio as number | undefined,
      psRatio: snapshot.ps_ratio as number | undefined,
      dividendYield: snapshot.dividend_yield as number | undefined,
      eps: snapshot.eps as number | undefined,
      ...snapshot,
    };
  }

  async getKeyRatios(params: FinancialStatementsParams): Promise<KeyRatios[]> {
    const { data } = await callApi('/financial-metrics/', {
      ticker: params.ticker,
      period: params.period,
      limit: params.limit || 4,
      report_period_gt: params.reportPeriodGt,
      report_period_gte: params.reportPeriodGte,
      report_period_lt: params.reportPeriodLt,
      report_period_lte: params.reportPeriodLte,
    });

    const metrics = (data.financial_metrics || []) as Record<string, unknown>[];
    return metrics.map((m) => ({
      ticker: params.ticker,
      reportPeriod: m.report_period as string,
      marketCap: m.market_cap as number | undefined,
      peRatio: m.pe_ratio as number | undefined,
      pbRatio: m.pb_ratio as number | undefined,
      psRatio: m.ps_ratio as number | undefined,
      dividendYield: m.dividend_yield as number | undefined,
      eps: m.eps as number | undefined,
      ...m,
    }));
  }

  async getFilings(params: FilingsParams): Promise<FilingMetadata[]> {
    const { data } = await callApi('/filings/', {
      ticker: params.ticker.toUpperCase(),
      filing_type: params.filingType,
      limit: params.limit || 10,
    });

    const filings = (data.filings || []) as Record<string, unknown>[];
    return filings.map((f) => ({
      accessionNumber: f.accession_number as string,
      filingType: f.filing_type as string,
      filingDate: f.filing_date as string,
      reportDate: f.report_date as string | undefined,
      companyName: f.company_name as string | undefined,
      cik: f.cik as string | undefined,
      url: f.url as string | undefined,
    }));
  }

  async getFilingContent(accessionNumber: string, items?: string[]): Promise<FilingContent> {
    const { data } = await callApi('/filings/items/', {
      accession_number: accessionNumber,
      items: items,
    });

    return {
      accessionNumber,
      items: data as Record<string, string>,
    };
  }

  async getCompanyInfo(ticker: string): Promise<CompanyInfo> {
    const { data } = await callApi('/company/facts', { ticker });
    const facts = data.company_facts as Record<string, unknown>;
    return {
      ticker,
      name: facts.name as string | undefined,
      sector: facts.sector as string | undefined,
      industry: facts.industry as string | undefined,
      marketCap: facts.market_cap as number | undefined,
      employees: facts.employees as number | undefined,
      exchange: facts.exchange as string | undefined,
      website: facts.website as string | undefined,
      ...facts,
    };
  }

  async getInsiderTrades(params: InsiderTradesParams): Promise<InsiderTrade[]> {
    const { data } = await callApi('/insider-trades/', {
      ticker: params.ticker.toUpperCase(),
      limit: params.limit || 100,
      filing_date_gte: params.filingDateGte,
      filing_date_lte: params.filingDateLte,
    });

    const trades = (data.insider_trades || []) as Record<string, unknown>[];
    return trades.map((t) => ({
      ticker: params.ticker,
      filingDate: t.filing_date as string,
      transactionDate: t.transaction_date as string | undefined,
      insiderName: t.insider_name as string | undefined,
      insiderTitle: t.insider_title as string | undefined,
      transactionType: t.transaction_type as string | undefined,
      sharesTraded: t.shares_traded as number | undefined,
      pricePerShare: t.price_per_share as number | undefined,
      totalValue: t.total_value as number | undefined,
      sharesOwned: t.shares_owned as number | undefined,
      ...t,
    }));
  }

  async getNews(params: NewsParams): Promise<NewsArticle[]> {
    const { data } = await callApi('/news/', {
      ticker: params.ticker,
      start_date: params.startDate,
      end_date: params.endDate,
      limit: params.limit || 10,
    });

    const news = (data.news || []) as Record<string, unknown>[];
    return news.map((n) => ({
      title: n.title as string,
      url: n.url as string,
      publishedAt: n.published_at as string,
      source: n.source as string | undefined,
      summary: n.summary as string | undefined,
      ticker: params.ticker,
    }));
  }
}
