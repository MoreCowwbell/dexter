/**
 * In-memory cache with TTL support for financial data
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  provider: string;
}

interface CacheConfig {
  // TTL in milliseconds for different data types
  priceSnapshot: number;
  priceHistory: number;
  financials: number;
  filings: number;
  companyInfo: number;
  news: number;
  default: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  priceSnapshot: 60 * 1000, // 1 minute for real-time prices
  priceHistory: 5 * 60 * 1000, // 5 minutes for historical prices
  financials: 24 * 60 * 60 * 1000, // 24 hours for financial statements
  filings: 7 * 24 * 60 * 60 * 1000, // 7 days for SEC filings
  companyInfo: 24 * 60 * 60 * 1000, // 24 hours for company info
  news: 15 * 60 * 1000, // 15 minutes for news
  default: 5 * 60 * 1000, // 5 minutes default
};

export class FinancialDataCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  private startCleanup(): void {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  private getTTL(dataType: keyof CacheConfig): number {
    return this.config[dataType] || this.config.default;
  }

  private generateKey(dataType: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}:${JSON.stringify(params[k])}`)
      .join('|');
    return `${dataType}::${sortedParams}`;
  }

  get<T>(dataType: string, params: Record<string, unknown>): { data: T; provider: string } | null {
    const key = this.generateKey(dataType, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return { data: entry.data as T, provider: entry.provider };
  }

  set<T>(
    dataType: string,
    params: Record<string, unknown>,
    data: T,
    provider: string,
    ttlOverride?: number
  ): void {
    const key = this.generateKey(dataType, params);
    const ttl = ttlOverride ?? this.getTTL(dataType as keyof CacheConfig);

    this.cache.set(key, {
      data,
      provider,
      expiresAt: Date.now() + ttl,
    });
  }

  invalidate(dataType: string, params: Record<string, unknown>): void {
    const key = this.generateKey(dataType, params);
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; dataTypes: Record<string, number> } {
    const dataTypes: Record<string, number> = {};

    for (const key of this.cache.keys()) {
      const [dataType] = key.split('::');
      dataTypes[dataType] = (dataTypes[dataType] || 0) + 1;
    }

    return {
      size: this.cache.size,
      dataTypes,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton instance for global cache
let globalCache: FinancialDataCache | null = null;

export function getCache(): FinancialDataCache {
  if (!globalCache) {
    globalCache = new FinancialDataCache();
  }
  return globalCache;
}

export function resetCache(): void {
  if (globalCache) {
    globalCache.destroy();
    globalCache = null;
  }
}
