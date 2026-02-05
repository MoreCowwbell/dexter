import { getRouter } from './providers/index.js';

const BASE_URL = 'https://api.financialdatasets.ai';

export interface ApiResponse {
  data: Record<string, unknown>;
  url: string;
  provider?: string;
  cached?: boolean;
}

/**
 * Legacy API function that now routes through the multi-provider system.
 * Falls back to direct FinancialDatasets.ai API call for endpoints not yet migrated.
 */
export async function callApi(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>
): Promise<ApiResponse> {
  const router = getRouter();

  // Route common endpoints through the multi-provider system
  try {
    // Price endpoints
    if (endpoint === '/prices/snapshot/') {
      const result = await router.getPriceSnapshot(params.ticker as string);
      return {
        data: { snapshot: result.data },
        url: `provider://${result.provider}`,
        provider: result.provider,
        cached: result.cached,
      };
    }

    if (endpoint === '/prices/') {
      const result = await router.getPriceHistory({
        ticker: params.ticker as string,
        startDate: params.start_date as string,
        endDate: params.end_date as string,
        interval: params.interval as 'minute' | 'day' | 'week' | 'month' | 'year',
        intervalMultiplier: params.interval_multiplier as number,
      });
      return {
        data: { prices: result.data },
        url: `provider://${result.provider}`,
        provider: result.provider,
        cached: result.cached,
      };
    }

    // Financial statements
    if (endpoint === '/financials/income-statements/') {
      const result = await router.getIncomeStatements({
        ticker: params.ticker as string,
        period: params.period as 'annual' | 'quarterly' | 'ttm',
        limit: params.limit as number,
        reportPeriodGt: params.report_period_gt as string,
        reportPeriodGte: params.report_period_gte as string,
        reportPeriodLt: params.report_period_lt as string,
        reportPeriodLte: params.report_period_lte as string,
      });
      return {
        data: { income_statements: result.data },
        url: `provider://${result.provider}`,
        provider: result.provider,
        cached: result.cached,
      };
    }

    if (endpoint === '/financials/balance-sheets/') {
      const result = await router.getBalanceSheets({
        ticker: params.ticker as string,
        period: params.period as 'annual' | 'quarterly' | 'ttm',
        limit: params.limit as number,
        reportPeriodGt: params.report_period_gt as string,
        reportPeriodGte: params.report_period_gte as string,
        reportPeriodLt: params.report_period_lt as string,
        reportPeriodLte: params.report_period_lte as string,
      });
      return {
        data: { balance_sheets: result.data },
        url: `provider://${result.provider}`,
        provider: result.provider,
        cached: result.cached,
      };
    }

    if (endpoint === '/financials/cash-flow-statements/') {
      const result = await router.getCashFlowStatements({
        ticker: params.ticker as string,
        period: params.period as 'annual' | 'quarterly' | 'ttm',
        limit: params.limit as number,
        reportPeriodGt: params.report_period_gt as string,
        reportPeriodGte: params.report_period_gte as string,
        reportPeriodLt: params.report_period_lt as string,
        reportPeriodLte: params.report_period_lte as string,
      });
      return {
        data: { cash_flow_statements: result.data },
        url: `provider://${result.provider}`,
        provider: result.provider,
        cached: result.cached,
      };
    }

    // Key ratios
    if (endpoint === '/financial-metrics/snapshot/') {
      const result = await router.getKeyRatiosSnapshot(params.ticker as string);
      return {
        data: { snapshot: result.data },
        url: `provider://${result.provider}`,
        provider: result.provider,
        cached: result.cached,
      };
    }

    if (endpoint === '/financial-metrics/') {
      const result = await router.getKeyRatios({
        ticker: params.ticker as string,
        period: params.period as 'annual' | 'quarterly' | 'ttm',
        limit: params.limit as number,
        reportPeriodGt: params.report_period_gt as string,
        reportPeriodGte: params.report_period_gte as string,
        reportPeriodLt: params.report_period_lt as string,
        reportPeriodLte: params.report_period_lte as string,
      });
      return {
        data: { financial_metrics: result.data },
        url: `provider://${result.provider}`,
        provider: result.provider,
        cached: result.cached,
      };
    }

    // Filings
    if (endpoint === '/filings/') {
      const result = await router.getFilings({
        ticker: params.ticker as string,
        filingType: params.filing_type as '10-K' | '10-Q' | '8-K',
        limit: params.limit as number,
      });
      return {
        data: { filings: result.data },
        url: `provider://${result.provider}`,
        provider: result.provider,
        cached: result.cached,
      };
    }

    // Company info
    if (endpoint === '/company/facts') {
      const result = await router.getCompanyInfo(params.ticker as string);
      return {
        data: { company_facts: result.data },
        url: `provider://${result.provider}`,
        provider: result.provider,
        cached: result.cached,
      };
    }

    // Insider trades
    if (endpoint === '/insider-trades/') {
      const result = await router.getInsiderTrades({
        ticker: params.ticker as string,
        limit: params.limit as number,
        filingDateGte: params.filing_date_gte as string,
        filingDateLte: params.filing_date_lte as string,
      });
      return {
        data: { insider_trades: result.data },
        url: `provider://${result.provider}`,
        provider: result.provider,
        cached: result.cached,
      };
    }

    // News
    if (endpoint === '/news/') {
      const result = await router.getNews({
        ticker: params.ticker as string,
        startDate: params.start_date as string,
        endDate: params.end_date as string,
        limit: params.limit as number,
      });
      return {
        data: { news: result.data },
        url: `provider://${result.provider}`,
        provider: result.provider,
        cached: result.cached,
      };
    }
  } catch (error) {
    // If router fails, fall through to direct API call
    console.warn(`Router failed for ${endpoint}, falling back to direct API:`, error);
  }

  // Fallback to direct FinancialDatasets.ai API call for unmigrated endpoints
  return callDirectApi(endpoint, params);
}

/**
 * Direct API call to FinancialDatasets.ai (legacy, used as fallback)
 */
export async function callDirectApi(
  endpoint: string,
  params: Record<string, string | number | string[] | undefined>
): Promise<ApiResponse> {
  const FINANCIAL_DATASETS_API_KEY = process.env.FINANCIAL_DATASETS_API_KEY;
  const url = new URL(`${BASE_URL}${endpoint}`);

  // Add params to URL, handling arrays
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
    headers: {
      'x-api-key': FINANCIAL_DATASETS_API_KEY || '',
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return { data, url: url.toString(), provider: 'financial-datasets' };
}
