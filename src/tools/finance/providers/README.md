# Financial Data Providers

Multi-provider system with automatic fallback for financial data, reducing costs from $200/month to potentially $0.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Financial Data Router                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Request → Cache Check → Provider 1 → Provider 2 → ... → N │
│                    ↓                                        │
│              Cache Hit?                                     │
│                 Yes → Return cached data                    │
│                 No  → Try providers in priority order       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Providers

| Provider | Priority | Cost | Best For |
|----------|----------|------|----------|
| SEC EDGAR | 10 | Free | Filings, Financial Statements |
| yfinance | 20 | Free | Prices, Fundamentals, Company Info |
| Finnhub | 30 | Free (60/min) | Real-time Prices, News, Metrics |
| FinancialDatasets.ai | 100 | $200/mo | All data (fallback) |

## Data Type Priority Mapping

| Data Type | Provider Order |
|-----------|----------------|
| Price Snapshot | yfinance → Finnhub → FinancialDatasets |
| Price History | yfinance → Finnhub → FinancialDatasets |
| Income Statements | SEC EDGAR → yfinance → FinancialDatasets |
| Balance Sheets | SEC EDGAR → yfinance → FinancialDatasets |
| Cash Flow Statements | SEC EDGAR → yfinance → FinancialDatasets |
| Key Ratios | yfinance → Finnhub → FinancialDatasets |
| SEC Filings | SEC EDGAR → FinancialDatasets |
| Company Info | yfinance → Finnhub → SEC EDGAR → FinancialDatasets |
| Insider Trades | Finnhub → FinancialDatasets |
| News | Finnhub → yfinance → FinancialDatasets |

## Usage

### Basic Usage

```typescript
import { getRouter } from './providers/index.js';

const router = getRouter();

// Get price snapshot (tries yfinance first, then Finnhub, then FinancialDatasets)
const priceResult = await router.getPriceSnapshot('AAPL');
console.log(`Price: ${priceResult.data.price}, Provider: ${priceResult.provider}`);

// Get financial statements (tries SEC EDGAR first)
const statements = await router.getIncomeStatements({
  ticker: 'AAPL',
  period: 'annual',
  limit: 5,
});
console.log(`Provider: ${statements.provider}, Cached: ${statements.cached}`);
```

### Configuration

```typescript
import { FinancialDataRouter } from './providers/index.js';

// Disable FinancialDatasets fallback (free providers only)
const router = new FinancialDataRouter({
  fallbackToFinancialDatasets: false,
  enableCache: true,
});

// Use specific providers only
const customRouter = new FinancialDataRouter({
  providers: ['sec-edgar', 'yfinance'],
});
```

### Cache Management

```typescript
import { getRouter, getCache } from './providers/index.js';

const router = getRouter();

// Get cache statistics
console.log(router.getCacheStats());
// { size: 42, dataTypes: { priceSnapshot: 10, incomeStatements: 5, ... } }

// Invalidate specific data type
router.invalidateCache('priceSnapshot');

// Clear all cache
router.invalidateCache();
```

## Environment Variables

```bash
# Required for yfinance (Python must be installed)
PYTHON_PATH=python3  # Optional, defaults to 'python3'

# Optional: Finnhub (free tier: 60 calls/min)
FINNHUB_API_KEY=your_key_here

# Optional: SEC EDGAR user agent (required by SEC)
SEC_USER_AGENT="YourApp/1.0 (your@email.com)"

# Optional: FinancialDatasets.ai (paid fallback)
FINANCIAL_DATASETS_API_KEY=your_key_here
```

## Adding New Providers

1. Create a new file in `providers/`:

```typescript
// providers/my-provider.ts
import type { FinancialDataProvider, DataType, ... } from './types.js';

export class MyProvider implements FinancialDataProvider {
  name = 'my-provider';
  priority = 25; // Lower = higher priority

  supports(dataType: DataType): boolean {
    // Return true for supported data types
  }

  async isAvailable(): Promise<boolean> {
    // Check if API key is configured, etc.
  }

  getRateLimitStatus(): RateLimitStatus {
    // Return current rate limit status
  }

  // Implement data fetching methods
  async getPriceSnapshot(ticker: string): Promise<PriceSnapshot> {
    // ...
  }
}
```

2. Register in `router.ts`:

```typescript
// In initializeProviders()
const allProviders: FinancialDataProvider[] = [
  new MyProvider(),
  // ...existing providers
];
```

3. Update priority mapping in `DATA_TYPE_PROVIDERS`.

## Cache TTLs

| Data Type | TTL |
|-----------|-----|
| Price Snapshot | 1 minute |
| Price History | 5 minutes |
| Financial Statements | 24 hours |
| SEC Filings | 7 days |
| Company Info | 24 hours |
| News | 15 minutes |

## Error Handling

The router automatically retries with fallback providers:

```typescript
try {
  const result = await router.getPriceSnapshot('AAPL');
} catch (error) {
  // Error includes details from all failed providers:
  // "All providers failed for priceSnapshot:
  //   - yfinance: Rate limited
  //   - finnhub: API key not configured
  //   - financial-datasets: Network error"
}
```

## Testing

```bash
# Install yfinance (required for Python provider)
pip install yfinance

# Run provider tests
bun test providers
```
