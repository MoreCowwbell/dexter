/**
 * Common types for financial data providers
 */

// Price data types
export interface PriceSnapshot {
  ticker: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  timestamp?: string;
  previousClose?: number;
  change?: number;
  changePercent?: number;
}

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

export interface PriceHistoryParams {
  ticker: string;
  startDate: string;
  endDate: string;
  interval?: 'minute' | 'day' | 'week' | 'month' | 'year';
  intervalMultiplier?: number;
}

// Financial statement types
export interface IncomeStatement {
  ticker: string;
  reportPeriod: string;
  period: 'annual' | 'quarterly' | 'ttm';
  revenue?: number;
  costOfRevenue?: number;
  grossProfit?: number;
  operatingExpenses?: number;
  operatingIncome?: number;
  netIncome?: number;
  eps?: number;
  epsDiluted?: number;
  [key: string]: unknown;
}

export interface BalanceSheet {
  ticker: string;
  reportPeriod: string;
  period: 'annual' | 'quarterly' | 'ttm';
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  cash?: number;
  totalDebt?: number;
  [key: string]: unknown;
}

export interface CashFlowStatement {
  ticker: string;
  reportPeriod: string;
  period: 'annual' | 'quarterly' | 'ttm';
  operatingCashFlow?: number;
  investingCashFlow?: number;
  financingCashFlow?: number;
  freeCashFlow?: number;
  [key: string]: unknown;
}

export interface FinancialStatementsParams {
  ticker: string;
  period: 'annual' | 'quarterly' | 'ttm';
  limit?: number;
  reportPeriodGt?: string;
  reportPeriodGte?: string;
  reportPeriodLt?: string;
  reportPeriodLte?: string;
}

// Key ratios/metrics types
export interface KeyRatios {
  ticker: string;
  reportPeriod?: string;
  marketCap?: number;
  peRatio?: number;
  pbRatio?: number;
  psRatio?: number;
  dividendYield?: number;
  eps?: number;
  roe?: number;
  roa?: number;
  debtToEquity?: number;
  currentRatio?: number;
  quickRatio?: number;
  [key: string]: unknown;
}

// SEC Filing types
export interface FilingMetadata {
  accessionNumber: string;
  filingType: string;
  filingDate: string;
  reportDate?: string;
  companyName?: string;
  cik?: string;
  url?: string;
}

export interface FilingContent {
  accessionNumber: string;
  items: Record<string, string>;
}

export interface FilingsParams {
  ticker: string;
  filingType?: '10-K' | '10-Q' | '8-K';
  limit?: number;
}

// Company info types
export interface CompanyInfo {
  ticker: string;
  name?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  employees?: number;
  exchange?: string;
  website?: string;
  description?: string;
  [key: string]: unknown;
}

// Insider trades types
export interface InsiderTrade {
  ticker: string;
  filingDate: string;
  transactionDate?: string;
  insiderName?: string;
  insiderTitle?: string;
  transactionType?: string;
  sharesTraded?: number;
  pricePerShare?: number;
  totalValue?: number;
  sharesOwned?: number;
  [key: string]: unknown;
}

export interface InsiderTradesParams {
  ticker: string;
  limit?: number;
  filingDateGte?: string;
  filingDateLte?: string;
}

// News types
export interface NewsArticle {
  title: string;
  url: string;
  publishedAt: string;
  source?: string;
  summary?: string;
  ticker?: string;
}

export interface NewsParams {
  ticker: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

// Provider response wrapper
export interface ProviderResponse<T> {
  data: T;
  provider: string;
  cached: boolean;
  sourceUrl?: string;
}

// Provider capabilities
export type DataType =
  | 'priceSnapshot'
  | 'priceHistory'
  | 'incomeStatements'
  | 'balanceSheets'
  | 'cashFlowStatements'
  | 'keyRatios'
  | 'keyRatiosSnapshot'
  | 'filings'
  | 'filingContent'
  | 'companyInfo'
  | 'insiderTrades'
  | 'news'
  | 'analystEstimates'
  | 'segmentedRevenues';

export interface RateLimitStatus {
  remaining: number;
  resetAt?: Date;
  isLimited: boolean;
}

// Base provider interface
export interface FinancialDataProvider {
  name: string;
  priority: number;

  // Capability checking
  supports(dataType: DataType): boolean;
  isAvailable(): Promise<boolean>;
  getRateLimitStatus(): RateLimitStatus;

  // Price data
  getPriceSnapshot?(ticker: string): Promise<PriceSnapshot>;
  getPriceHistory?(params: PriceHistoryParams): Promise<PriceBar[]>;

  // Financial statements
  getIncomeStatements?(params: FinancialStatementsParams): Promise<IncomeStatement[]>;
  getBalanceSheets?(params: FinancialStatementsParams): Promise<BalanceSheet[]>;
  getCashFlowStatements?(params: FinancialStatementsParams): Promise<CashFlowStatement[]>;

  // Metrics
  getKeyRatiosSnapshot?(ticker: string): Promise<KeyRatios>;
  getKeyRatios?(params: FinancialStatementsParams): Promise<KeyRatios[]>;

  // Filings
  getFilings?(params: FilingsParams): Promise<FilingMetadata[]>;
  getFilingContent?(accessionNumber: string, items?: string[]): Promise<FilingContent>;

  // Other
  getCompanyInfo?(ticker: string): Promise<CompanyInfo>;
  getInsiderTrades?(params: InsiderTradesParams): Promise<InsiderTrade[]>;
  getNews?(params: NewsParams): Promise<NewsArticle[]>;
}
