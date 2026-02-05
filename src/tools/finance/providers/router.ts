/**
 * Financial Data Router - Routes requests to providers with automatic fallback
 */

import type {
  FinancialDataProvider,
  DataType,
  ProviderResponse,
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
import { getCache } from './cache.js';
import { YfinanceProvider } from './yfinance.js';
import { SecEdgarProvider } from './sec-edgar.js';
import { FinnhubProvider } from './finnhub.js';
import { FinancialDatasetsProvider } from './financial-datasets.js';

// Provider priority order for each data type
const DATA_TYPE_PROVIDERS: Record<DataType, string[]> = {
  priceSnapshot: ['yfinance', 'finnhub', 'financial-datasets'],
  priceHistory: ['yfinance', 'finnhub', 'financial-datasets'],
  incomeStatements: ['sec-edgar', 'yfinance', 'financial-datasets'],
  balanceSheets: ['sec-edgar', 'yfinance', 'financial-datasets'],
  cashFlowStatements: ['sec-edgar', 'yfinance', 'financial-datasets'],
  keyRatios: ['yfinance', 'finnhub', 'financial-datasets'],
  keyRatiosSnapshot: ['yfinance', 'finnhub', 'financial-datasets'],
  filings: ['sec-edgar', 'financial-datasets'],
  filingContent: ['sec-edgar', 'financial-datasets'],
  companyInfo: ['yfinance', 'finnhub', 'sec-edgar', 'financial-datasets'],
  insiderTrades: ['finnhub', 'financial-datasets'],
  news: ['finnhub', 'yfinance', 'financial-datasets'],
  analystEstimates: ['financial-datasets'],
  segmentedRevenues: ['financial-datasets'],
};

export interface RouterConfig {
  enableCache?: boolean;
  providers?: string[];
  fallbackToFinancialDatasets?: boolean;
}

export class FinancialDataRouter {
  private providers: Map<string, FinancialDataProvider> = new Map();
  private config: RouterConfig;
  private cache = getCache();

  constructor(config: RouterConfig = {}) {
    this.config = {
      enableCache: true,
      fallbackToFinancialDatasets: true,
      ...config,
    };

    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize all providers
    const allProviders: FinancialDataProvider[] = [
      new YfinanceProvider(),
      new SecEdgarProvider(),
      new FinnhubProvider(),
      new FinancialDatasetsProvider(),
    ];

    for (const provider of allProviders) {
      // Skip if specific providers are configured and this one isn't included
      if (this.config.providers && !this.config.providers.includes(provider.name)) {
        continue;
      }

      // Skip FinancialDatasets if fallback is disabled
      if (!this.config.fallbackToFinancialDatasets && provider.name === 'financial-datasets') {
        continue;
      }

      this.providers.set(provider.name, provider);
    }
  }

  private getProvidersForDataType(dataType: DataType): FinancialDataProvider[] {
    const providerOrder = DATA_TYPE_PROVIDERS[dataType] || [];
    const providers: FinancialDataProvider[] = [];

    for (const name of providerOrder) {
      const provider = this.providers.get(name);
      if (provider && provider.supports(dataType)) {
        providers.push(provider);
      }
    }

    return providers;
  }

  private async tryProviders<T>(
    dataType: DataType,
    cacheKey: Record<string, unknown>,
    fetcher: (provider: FinancialDataProvider) => Promise<T>
  ): Promise<ProviderResponse<T>> {
    // Check cache first
    if (this.config.enableCache) {
      const cached = this.cache.get<T>(dataType, cacheKey);
      if (cached) {
        return {
          data: cached.data,
          provider: cached.provider,
          cached: true,
        };
      }
    }

    const providers = this.getProvidersForDataType(dataType);
    const errors: string[] = [];

    for (const provider of providers) {
      // Check if provider is available and not rate limited
      const rateLimitStatus = provider.getRateLimitStatus();
      if (rateLimitStatus.isLimited) {
        errors.push(`${provider.name}: Rate limited until ${rateLimitStatus.resetAt?.toISOString()}`);
        continue;
      }

      try {
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          errors.push(`${provider.name}: Not available (missing API key or configuration)`);
          continue;
        }

        const data = await fetcher(provider);

        // Cache the result
        if (this.config.enableCache && data !== null && data !== undefined) {
          this.cache.set(dataType, cacheKey, data, provider.name);
        }

        return {
          data,
          provider: provider.name,
          cached: false,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${provider.name}: ${message}`);
        continue;
      }
    }

    throw new Error(
      `All providers failed for ${dataType}:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }

  // Price methods
  async getPriceSnapshot(ticker: string): Promise<ProviderResponse<PriceSnapshot>> {
    return this.tryProviders('priceSnapshot', { ticker }, async (provider) => {
      if (!provider.getPriceSnapshot) {
        throw new Error('Provider does not support getPriceSnapshot');
      }
      return provider.getPriceSnapshot(ticker);
    });
  }

  async getPriceHistory(params: PriceHistoryParams): Promise<ProviderResponse<PriceBar[]>> {
    return this.tryProviders('priceHistory', params as Record<string, unknown>, async (provider) => {
      if (!provider.getPriceHistory) {
        throw new Error('Provider does not support getPriceHistory');
      }
      return provider.getPriceHistory(params);
    });
  }

  // Financial statement methods
  async getIncomeStatements(params: FinancialStatementsParams): Promise<ProviderResponse<IncomeStatement[]>> {
    return this.tryProviders('incomeStatements', params as Record<string, unknown>, async (provider) => {
      if (!provider.getIncomeStatements) {
        throw new Error('Provider does not support getIncomeStatements');
      }
      return provider.getIncomeStatements(params);
    });
  }

  async getBalanceSheets(params: FinancialStatementsParams): Promise<ProviderResponse<BalanceSheet[]>> {
    return this.tryProviders('balanceSheets', params as Record<string, unknown>, async (provider) => {
      if (!provider.getBalanceSheets) {
        throw new Error('Provider does not support getBalanceSheets');
      }
      return provider.getBalanceSheets(params);
    });
  }

  async getCashFlowStatements(params: FinancialStatementsParams): Promise<ProviderResponse<CashFlowStatement[]>> {
    return this.tryProviders('cashFlowStatements', params as Record<string, unknown>, async (provider) => {
      if (!provider.getCashFlowStatements) {
        throw new Error('Provider does not support getCashFlowStatements');
      }
      return provider.getCashFlowStatements(params);
    });
  }

  // Key ratios methods
  async getKeyRatiosSnapshot(ticker: string): Promise<ProviderResponse<KeyRatios>> {
    return this.tryProviders('keyRatiosSnapshot', { ticker }, async (provider) => {
      if (!provider.getKeyRatiosSnapshot) {
        throw new Error('Provider does not support getKeyRatiosSnapshot');
      }
      return provider.getKeyRatiosSnapshot(ticker);
    });
  }

  async getKeyRatios(params: FinancialStatementsParams): Promise<ProviderResponse<KeyRatios[]>> {
    return this.tryProviders('keyRatios', params as Record<string, unknown>, async (provider) => {
      if (!provider.getKeyRatios) {
        throw new Error('Provider does not support getKeyRatios');
      }
      return provider.getKeyRatios(params);
    });
  }

  // Filing methods
  async getFilings(params: FilingsParams): Promise<ProviderResponse<FilingMetadata[]>> {
    return this.tryProviders('filings', params as Record<string, unknown>, async (provider) => {
      if (!provider.getFilings) {
        throw new Error('Provider does not support getFilings');
      }
      return provider.getFilings(params);
    });
  }

  async getFilingContent(accessionNumber: string, items?: string[]): Promise<ProviderResponse<FilingContent>> {
    return this.tryProviders('filingContent', { accessionNumber, items }, async (provider) => {
      if (!provider.getFilingContent) {
        throw new Error('Provider does not support getFilingContent');
      }
      return provider.getFilingContent(accessionNumber, items);
    });
  }

  // Company info methods
  async getCompanyInfo(ticker: string): Promise<ProviderResponse<CompanyInfo>> {
    return this.tryProviders('companyInfo', { ticker }, async (provider) => {
      if (!provider.getCompanyInfo) {
        throw new Error('Provider does not support getCompanyInfo');
      }
      return provider.getCompanyInfo(ticker);
    });
  }

  // Insider trades methods
  async getInsiderTrades(params: InsiderTradesParams): Promise<ProviderResponse<InsiderTrade[]>> {
    return this.tryProviders('insiderTrades', params as Record<string, unknown>, async (provider) => {
      if (!provider.getInsiderTrades) {
        throw new Error('Provider does not support getInsiderTrades');
      }
      return provider.getInsiderTrades(params);
    });
  }

  // News methods
  async getNews(params: NewsParams): Promise<ProviderResponse<NewsArticle[]>> {
    return this.tryProviders('news', params as Record<string, unknown>, async (provider) => {
      if (!provider.getNews) {
        throw new Error('Provider does not support getNews');
      }
      return provider.getNews(params);
    });
  }

  // Utility methods
  getProviderStatus(): Record<string, { available: boolean; rateLimitStatus: ReturnType<FinancialDataProvider['getRateLimitStatus']> }> {
    const status: Record<string, { available: boolean; rateLimitStatus: ReturnType<FinancialDataProvider['getRateLimitStatus']> }> = {};

    for (const [name, provider] of this.providers) {
      status[name] = {
        available: true, // Will be updated async
        rateLimitStatus: provider.getRateLimitStatus(),
      };
    }

    return status;
  }

  getCacheStats(): ReturnType<typeof getCache>['getStats'] extends () => infer R ? R : never {
    return this.cache.getStats();
  }

  invalidateCache(dataType?: DataType): void {
    if (dataType) {
      this.cache.invalidateByPrefix(dataType);
    } else {
      this.cache.invalidateAll();
    }
  }
}

// Singleton instance
let globalRouter: FinancialDataRouter | null = null;

export function getRouter(config?: RouterConfig): FinancialDataRouter {
  if (!globalRouter) {
    globalRouter = new FinancialDataRouter(config);
  }
  return globalRouter;
}

export function resetRouter(): void {
  globalRouter = null;
}
