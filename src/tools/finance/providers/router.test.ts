import { describe, test, expect, beforeEach } from 'bun:test';
import { FinancialDataRouter, resetRouter, getRouter } from './router.js';
import { resetCache } from './cache.js';

describe('FinancialDataRouter', () => {
  beforeEach(() => {
    resetRouter();
    resetCache();
  });

  test('initializes with all providers', () => {
    const router = getRouter();
    const status = router.getProviderStatus();

    expect(status).toHaveProperty('yfinance');
    expect(status).toHaveProperty('sec-edgar');
    expect(status).toHaveProperty('finnhub');
    expect(status).toHaveProperty('financial-datasets');
  });

  test('can disable FinancialDatasets fallback', () => {
    const router = new FinancialDataRouter({
      fallbackToFinancialDatasets: false,
    });
    const status = router.getProviderStatus();

    expect(status).toHaveProperty('yfinance');
    expect(status).toHaveProperty('sec-edgar');
    expect(status).toHaveProperty('finnhub');
    expect(status).not.toHaveProperty('financial-datasets');
  });

  test('can specify custom providers', () => {
    const router = new FinancialDataRouter({
      providers: ['sec-edgar'],
    });
    const status = router.getProviderStatus();

    expect(status).toHaveProperty('sec-edgar');
    expect(status).not.toHaveProperty('yfinance');
    expect(status).not.toHaveProperty('finnhub');
  });

  test('cache starts empty', () => {
    const router = getRouter();
    const stats = router.getCacheStats();

    expect(stats.size).toBe(0);
    expect(Object.keys(stats.dataTypes)).toHaveLength(0);
  });
});

describe('FinancialDataRouter - Integration', () => {
  beforeEach(() => {
    resetRouter();
    resetCache();
  });

  // These tests require network access, Python + yfinance, and may be slow
  // Skip by default - run manually with INTEGRATION_TESTS=true
  const skipIntegration = process.env.INTEGRATION_TESTS !== 'true';

  test.skipIf(skipIntegration)('fetches price snapshot from yfinance', async () => {
    const router = new FinancialDataRouter({
      fallbackToFinancialDatasets: false,
    });

    const result = await router.getPriceSnapshot('AAPL');

    expect(result.data).toBeDefined();
    expect(result.data.ticker).toBe('AAPL');
    expect(typeof result.data.price).toBe('number');
    expect(result.provider).toBe('yfinance');
    expect(result.cached).toBe(false);
  });

  test.skipIf(skipIntegration)('caches results on second call', async () => {
    const router = new FinancialDataRouter({
      fallbackToFinancialDatasets: false,
      enableCache: true,
    });

    // First call - should not be cached
    const result1 = await router.getPriceSnapshot('AAPL');
    expect(result1.cached).toBe(false);

    // Second call - should be cached
    const result2 = await router.getPriceSnapshot('AAPL');
    expect(result2.cached).toBe(true);
    expect(result2.data.price).toBe(result1.data.price);
  });

  test.skipIf(skipIntegration)('fetches income statements from SEC EDGAR', async () => {
    const router = new FinancialDataRouter({
      fallbackToFinancialDatasets: false,
    });

    const result = await router.getIncomeStatements({
      ticker: 'AAPL',
      period: 'annual',
      limit: 3,
    });

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.provider).toBe('sec-edgar');
  });

  test.skipIf(skipIntegration)('fetches company info', async () => {
    const router = new FinancialDataRouter({
      fallbackToFinancialDatasets: false,
    });

    const result = await router.getCompanyInfo('AAPL');

    expect(result.data).toBeDefined();
    expect(result.data.ticker).toBe('AAPL');
    expect(result.data.name).toBeDefined();
  });

  test.skipIf(skipIntegration)('fetches SEC filings', async () => {
    const router = new FinancialDataRouter({
      fallbackToFinancialDatasets: false,
    });

    const result = await router.getFilings({
      ticker: 'AAPL',
      filingType: '10-K',
      limit: 3,
    });

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.provider).toBe('sec-edgar');
  });
});
