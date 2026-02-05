# Financial Data Sources: Feasibility Plan & Recommendations

## Executive Summary

**Current Cost:** FinancialDatasets.ai @ $200/month for publicly available data

**Recommendation:** Implement a multi-tier fallback system using free/cheaper alternatives, potentially reducing costs to **$0-50/month** while maintaining full functionality.

**Priority Order:**
1. SEC EDGAR API (Free) - Filings, financial statements via XBRL
2. yfinance (Free) - Price data, basic fundamentals
3. Polygon.io/Massive (Free tier + paid) - Real-time prices, historical data
4. Alpha Vantage (Free tier) - Backup for prices and fundamentals
5. Financial Modeling Prep (Free tier) - Financial statements fallback

---

## Current Data Requirements Analysis

| Data Type | Current Source | Usage Frequency | Criticality |
|-----------|---------------|-----------------|-------------|
| Stock Prices (snapshot) | FinancialDatasets.ai | High | Critical |
| Stock Prices (historical) | FinancialDatasets.ai | High | Critical |
| Income Statements | FinancialDatasets.ai | Medium | High |
| Balance Sheets | FinancialDatasets.ai | Medium | High |
| Cash Flow Statements | FinancialDatasets.ai | Medium | High |
| Key Ratios/Metrics | FinancialDatasets.ai | Medium | Medium |
| SEC Filings (10-K, 10-Q, 8-K) | FinancialDatasets.ai | Medium | High |
| Insider Trades | FinancialDatasets.ai | Low | Low |
| Segmented Revenues | FinancialDatasets.ai | Low | Low |
| Analyst Estimates | FinancialDatasets.ai | Low | Medium |
| Company Facts | FinancialDatasets.ai | Low | Medium |
| Crypto Prices | FinancialDatasets.ai | Low | Low |
| Company News | FinancialDatasets.ai | Low | Low |

---

## Alternative Data Sources Evaluation

### 1. SEC EDGAR API (Official) ⭐ HIGHLY RECOMMENDED

**Cost:** FREE (No API key required)

**Website:** https://www.sec.gov/search-filings/edgar-application-programming-interfaces

**Coverage:**
- ✅ SEC Filings (10-K, 10-Q, 8-K, all forms)
- ✅ Financial Statements via XBRL (Income, Balance Sheet, Cash Flow)
- ✅ Company submissions history
- ✅ Bulk data downloads available

**Rate Limits:**
- 10 requests/second
- No authentication required
- Bulk ZIP files available for efficient data retrieval

**Pros:**
- Completely free, official government source
- Authoritative data directly from SEC
- XBRL data is standardized and reliable
- No API key management
- Bulk downloads for historical data

**Cons:**
- Requires parsing XBRL/JSON (more complex)
- No real-time price data
- No analyst estimates
- No insider trade summaries (raw Form 4 only)

**Implementation Effort:** Medium (XBRL parsing required)

**Python Libraries:**
- `edgartools` - Modern, well-maintained library
- `sec-api` - Third-party wrapper (has free tier)

---

### 2. yfinance ⭐ RECOMMENDED FOR PRICES

**Cost:** FREE (Unofficial Yahoo Finance scraper)

**Website:** https://github.com/ranaroussi/yfinance

**Coverage:**
- ✅ Real-time stock prices
- ✅ Historical prices (daily, weekly, monthly)
- ✅ Intraday data (1m for 7 days, up to 60 days for other intervals)
- ✅ Basic financials (income, balance, cash flow)
- ✅ Key ratios and metrics
- ✅ Company info
- ✅ Institutional holders
- ✅ Analyst recommendations
- ✅ Options chains

**Rate Limits:**
- Unofficial, subject to blocking
- Use caching to minimize requests
- Can get 429 errors with heavy usage

**Pros:**
- Completely free
- Very easy to use (`pip install yfinance`)
- Comprehensive data coverage
- Active development (latest release Jan 2026)
- Good for research and prototyping

**Cons:**
- Not an official API (web scraping)
- Can be blocked/rate-limited
- Not recommended for production trading
- Data quality not guaranteed
- Terms of service concerns for commercial use

**Implementation Effort:** Low

**Best Practice:**
```python
# Use caching to reduce requests
import yfinance as yf
yf.set_tz_cache_location("/path/to/cache")

# Batch requests
tickers = yf.Tickers("AAPL MSFT GOOGL")
```

---

### 3. Polygon.io (Now Massive) ⭐ RECOMMENDED FOR REAL-TIME

**Cost:**
- Free tier: End-of-day data, 5 API calls/minute
- Paid: Starts ~$29/month for real-time

**Website:** https://polygon.io (redirects to massive.com)

**Coverage:**
- ✅ Real-time stock prices
- ✅ Historical prices (20+ years)
- ✅ WebSocket streaming
- ✅ Options data
- ✅ Forex and crypto
- ✅ Financial ratios (paid)
- ✅ News

**Rate Limits:**
- Free: 5 calls/minute
- Paid: Varies by plan

**Pros:**
- Professional-grade data
- Real-time WebSocket support
- Well-documented API
- Strong SDK support
- 50% startup discount available

**Cons:**
- Free tier is very limited
- Paid plans needed for serious usage
- Financials require paid subscription

**Implementation Effort:** Low (good SDKs)

---

### 4. Alpha Vantage

**Cost:**
- Free: 25 requests/day
- Paid: $49.99-$249.99/month

**Website:** https://www.alphavantage.co/

**Coverage:**
- ✅ Stock prices (daily, intraday)
- ✅ 50+ technical indicators
- ✅ Fundamental data
- ✅ Forex and crypto
- ✅ Economic indicators

**Rate Limits:**
- Free: 25 requests/day (very limited)
- Paid: No daily limit, varies per minute

**Pros:**
- Good documentation
- Wide data coverage
- Technical indicators built-in
- 20+ years historical data

**Cons:**
- Free tier too limited for practical use
- Real-time data requires premium
- 25/day limit disappears quickly

**Implementation Effort:** Low

**Recommendation:** Use as emergency fallback only due to severe rate limits.

---

### 5. Financial Modeling Prep (FMP)

**Cost:**
- Free tier: Limited requests
- Paid: Starts ~$19/month

**Website:** https://financialmodelingprep.com/

**Coverage:**
- ✅ Financial statements (standardized)
- ✅ Key ratios
- ✅ Stock prices
- ✅ SEC filings
- ✅ Company profiles
- ✅ Analyst estimates

**Pros:**
- Standardized financial data
- Good free tier for testing
- TTM (trailing twelve months) support
- Well-structured API

**Cons:**
- Free tier limited
- Commercial use requires paid plan

**Implementation Effort:** Low

---

### 6. FINRA API

**Cost:** Free for non-commercial/testing

**Website:** https://developer.finra.org/

**Coverage:**
- ✅ Short interest data
- ✅ Treasury securities volume
- ✅ ATS trade data
- ✅ Bond data (TRACE)
- ❌ No stock prices
- ❌ No financial statements

**Rate Limits:**
- 10GB/month per credential
- Test environment unlimited

**Pros:**
- Official regulatory data
- Unique datasets (short interest)
- Free for testing

**Cons:**
- Limited to specific regulatory data
- Not a general financial data source
- Complex authentication

**Recommendation:** Only use for specific FINRA data (short interest, bond data).

---

### 7. Finnhub

**Cost:**
- Free: 60 calls/minute
- Paid: $49-$499/month

**Website:** https://finnhub.io/

**Coverage:**
- ✅ Real-time stock prices
- ✅ Company fundamentals
- ✅ Analyst estimates
- ✅ Earnings calendars
- ✅ Crypto and forex
- ✅ Alternative data

**Pros:**
- Generous free tier (60/min)
- Real-time WebSocket
- Good alternative data

**Cons:**
- Some features paid only
- Less historical depth

**Implementation Effort:** Low

---

## Recommended Architecture

### Multi-Provider Fallback System

```
┌─────────────────────────────────────────────────────────────┐
│                    Financial Data Router                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │   Primary   │   │  Secondary  │   │   Tertiary  │       │
│  │   Source    │──▶│   Source    │──▶│   Source    │       │
│  └─────────────┘   └─────────────┘   └─────────────┘       │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  ┌─────────────────────────────────────────────────┐       │
│  │              Response Cache (Redis/Memory)       │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Type to Provider Mapping

| Data Type | Primary (Free) | Secondary (Free) | Tertiary (Paid) |
|-----------|---------------|------------------|-----------------|
| **Stock Prices** | yfinance | Finnhub | Polygon.io |
| **Historical Prices** | yfinance | Alpha Vantage | Polygon.io |
| **Financial Statements** | SEC EDGAR (XBRL) | yfinance | FMP |
| **Key Ratios** | yfinance | SEC EDGAR (calc) | FMP |
| **SEC Filings** | SEC EDGAR | - | FinancialDatasets |
| **Insider Trades** | SEC EDGAR (Form 4) | Finnhub | FinancialDatasets |
| **Company Info** | yfinance | Finnhub | FMP |
| **Analyst Estimates** | yfinance | Finnhub | FMP |
| **Crypto Prices** | yfinance | Finnhub | Polygon.io |
| **News** | Finnhub | yfinance | Polygon.io |

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

1. **Create Provider Interface**
   ```typescript
   interface FinancialDataProvider {
     name: string;
     priority: number;
     isAvailable(): Promise<boolean>;
     getRateLimitStatus(): RateLimitStatus;
   }
   ```

2. **Implement Fallback Router**
   ```typescript
   class FinancialDataRouter {
     async fetchWithFallback<T>(
       dataType: DataType,
       params: QueryParams
     ): Promise<T>;
   }
   ```

3. **Add Response Caching**
   - Cache prices for 1-5 minutes
   - Cache financials for 24 hours
   - Cache filings for 7 days

### Phase 2: Free Provider Integration (Week 2)

1. **SEC EDGAR Integration**
   - Implement XBRL parser for financial statements
   - Add filing retrieval (10-K, 10-Q, 8-K)
   - Create mapping from XBRL to current schema

2. **yfinance Integration**
   - Wrap yfinance library in TypeScript
   - Add rate limiting and caching
   - Map response to current schema

3. **Finnhub Integration**
   - Add API client
   - Implement real-time WebSocket option
   - Map response formats

### Phase 3: Paid Fallback (Week 3)

1. **Polygon.io Integration** (Optional paid tier)
   - Real-time prices when free sources fail
   - Historical data backup

2. **Keep FinancialDatasets as Ultimate Fallback**
   - Only use when all free sources fail
   - Track usage to monitor cost savings

### Phase 4: Monitoring & Optimization (Week 4)

1. **Add Metrics**
   - Track which providers are used
   - Monitor cache hit rates
   - Alert on provider failures

2. **Optimize Caching**
   - Tune TTLs based on usage
   - Implement smart prefetching

---

## Cost Analysis

### Current State
| Item | Monthly Cost |
|------|--------------|
| FinancialDatasets.ai | $200 |
| **Total** | **$200/month** |

### Proposed State (Option A - Fully Free)
| Item | Monthly Cost |
|------|--------------|
| SEC EDGAR | $0 |
| yfinance | $0 |
| Finnhub (free tier) | $0 |
| Alpha Vantage (free tier) | $0 |
| **Total** | **$0/month** |

### Proposed State (Option B - Hybrid)
| Item | Monthly Cost |
|------|--------------|
| SEC EDGAR | $0 |
| yfinance | $0 |
| Polygon.io (basic) | $29 |
| FMP (basic) | $19 |
| **Total** | **$48/month** |

### Savings
- **Option A:** $200/month saved (100%)
- **Option B:** $152/month saved (76%)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| yfinance gets blocked | Medium | High | Fallback to Polygon/Finnhub |
| SEC EDGAR downtime | Low | Medium | Cache heavily, fallback to FMP |
| Rate limit exceeded | Medium | Medium | Implement request queuing |
| Data quality issues | Medium | Medium | Cross-validate between sources |
| API changes | Medium | Low | Abstract provider interface |

---

## Recommendations

### Immediate Actions (This Sprint)

1. **Keep FinancialDatasets.ai for now** but start building fallback infrastructure
2. **Implement SEC EDGAR integration first** - it's free, official, and covers filings/financials
3. **Add yfinance as price data source** - easiest win for price data
4. **Implement caching layer** - reduces API calls across all providers

### Short-term (Next Month)

1. **Complete multi-provider router** with automatic fallback
2. **Add Finnhub for real-time data** (generous free tier)
3. **Monitor actual API usage** to understand which data is most requested

### Medium-term (Next Quarter)

1. **Evaluate if FinancialDatasets can be fully replaced**
2. **Consider Polygon.io paid tier** only if real-time is critical
3. **Build data quality monitoring** to catch discrepancies

### Long-term Considerations

1. **SEC EDGAR bulk downloads** for historical analysis (one-time download, no API calls)
2. **Self-hosted data warehouse** for frequently accessed data
3. **Contribute to open-source tools** like edgartools for better XBRL support

---

## Technical Implementation Details

### Proposed File Structure

```
src/tools/finance/
├── providers/
│   ├── index.ts              # Provider registry
│   ├── base.ts               # Base provider interface
│   ├── sec-edgar.ts          # SEC EDGAR implementation
│   ├── yfinance.ts           # yfinance wrapper
│   ├── finnhub.ts            # Finnhub client
│   ├── polygon.ts            # Polygon.io client
│   └── financial-datasets.ts # Existing (as fallback)
├── router/
│   ├── index.ts              # Main router
│   ├── fallback.ts           # Fallback logic
│   └── cache.ts              # Caching layer
├── mappers/
│   ├── xbrl-to-financials.ts # XBRL parsing
│   ├── yfinance-mapper.ts    # yfinance response mapping
│   └── schema.ts             # Unified response schema
└── [existing files...]
```

### Environment Variables

```bash
# Free providers (no keys needed for SEC)
FINNHUB_API_KEY=           # Free tier available
YFINANCE_CACHE_DIR=        # Local cache directory

# Paid fallbacks (optional)
POLYGON_API_KEY=           # Only if using paid tier
FMP_API_KEY=               # Only if using paid tier

# Existing (demote to last fallback)
FINANCIAL_DATASETS_API_KEY=
```

---

## Conclusion

Replacing FinancialDatasets.ai with free alternatives is **highly feasible**. The combination of:

1. **SEC EDGAR** (filings, financial statements)
2. **yfinance** (prices, basic fundamentals)
3. **Finnhub** (real-time data, estimates)

...can cover 90%+ of current functionality at **zero cost**.

The main trade-offs are:
- More complex implementation (multiple providers)
- Slightly less reliability (unofficial APIs)
- Need for robust caching and fallback logic

**Recommendation:** Start with Phase 1-2 (free providers) and keep FinancialDatasets as emergency fallback. Monitor usage and remove it entirely once confidence is high.

---

## Sources

- [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [yfinance GitHub](https://github.com/ranaroussi/yfinance)
- [Polygon.io/Massive Pricing](https://polygon.io/pricing)
- [Alpha Vantage Documentation](https://www.alphavantage.co/documentation/)
- [Finnhub API](https://finnhub.io/)
- [Financial Modeling Prep](https://site.financialmodelingprep.com/developer/docs)
- [FINRA API Developer Center](https://developer.finra.org/)
- [EdgarTools GitHub](https://github.com/dgunning/edgartools)
