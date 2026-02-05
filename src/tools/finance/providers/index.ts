/**
 * Financial Data Providers
 *
 * Multi-provider system with automatic fallback for financial data.
 *
 * Priority order (configurable per data type):
 * 1. SEC EDGAR (Free, official) - Filings, financial statements
 * 2. yfinance (Free) - Prices, fundamentals, company info
 * 3. Finnhub (Free tier: 60/min) - Prices, metrics, news
 * 4. FinancialDatasets.ai (Paid fallback) - All data types
 */

export * from './types.js';
export * from './cache.js';
export * from './router.js';

// Individual providers (for direct use if needed)
export { SecEdgarProvider } from './sec-edgar.js';
export { YfinanceProvider } from './yfinance.js';
export { FinnhubProvider } from './finnhub.js';
export { FinancialDatasetsProvider } from './financial-datasets.js';
