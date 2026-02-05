/**
 * SEC EDGAR provider - Free official API for SEC filings and XBRL financial data
 * https://www.sec.gov/search-filings/edgar-application-programming-interfaces
 */

import type {
  FinancialDataProvider,
  DataType,
  RateLimitStatus,
  IncomeStatement,
  BalanceSheet,
  CashFlowStatement,
  FinancialStatementsParams,
  FilingMetadata,
  FilingContent,
  FilingsParams,
  CompanyInfo,
} from './types.js';

const SEC_BASE_URL = 'https://data.sec.gov';
const SEC_EFTS_URL = 'https://efts.sec.gov/LATEST/search-index';

// SEC requires a User-Agent header with contact info
const USER_AGENT = process.env.SEC_USER_AGENT || 'Dexter/1.0 (contact@example.com)';

// Rate limiting: SEC allows 10 requests/second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms = 10 req/s

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`SEC EDGAR API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

// CIK lookup cache
const cikCache = new Map<string, string>();

async function getCIK(ticker: string): Promise<string> {
  const upperTicker = ticker.toUpperCase();

  if (cikCache.has(upperTicker)) {
    return cikCache.get(upperTicker)!;
  }

  // Fetch company tickers mapping
  const response = await rateLimitedFetch(`${SEC_BASE_URL}/files/company_tickers.json`);
  const data = await response.json();

  // Build lookup table
  for (const entry of Object.values(data) as Array<{ cik_str: number; ticker: string }>) {
    const cik = String(entry.cik_str).padStart(10, '0');
    cikCache.set(entry.ticker.toUpperCase(), cik);
  }

  const cik = cikCache.get(upperTicker);
  if (!cik) {
    throw new Error(`Could not find CIK for ticker: ${ticker}`);
  }

  return cik;
}

// Parse XBRL concept values from SEC company facts
interface XBRLFact {
  val: number;
  end: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
}

interface CompanyFacts {
  cik: number;
  entityName: string;
  facts: {
    'us-gaap'?: Record<string, { units: Record<string, XBRLFact[]> }>;
    dei?: Record<string, { units: Record<string, XBRLFact[]> }>;
  };
}

function extractFactValues(
  facts: CompanyFacts,
  conceptName: string,
  namespace: 'us-gaap' | 'dei' = 'us-gaap'
): XBRLFact[] {
  const concept = facts.facts[namespace]?.[conceptName];
  if (!concept) return [];

  // Get USD values or pure numbers
  return concept.units.USD || concept.units.pure || concept.units.shares || [];
}

function filterByPeriod(
  facts: XBRLFact[],
  period: 'annual' | 'quarterly' | 'ttm',
  limit: number
): XBRLFact[] {
  let filtered: XBRLFact[];

  if (period === 'annual') {
    filtered = facts.filter((f) => f.fp === 'FY' && (f.form === '10-K' || f.form === '10-K/A'));
  } else if (period === 'quarterly') {
    filtered = facts.filter(
      (f) => ['Q1', 'Q2', 'Q3', 'Q4'].includes(f.fp) && (f.form === '10-Q' || f.form === '10-Q/A')
    );
  } else {
    // TTM - get most recent
    filtered = facts.filter((f) => f.form === '10-K' || f.form === '10-Q');
  }

  // Sort by end date descending and take limit
  return filtered.sort((a, b) => b.end.localeCompare(a.end)).slice(0, limit);
}

export class SecEdgarProvider implements FinancialDataProvider {
  name = 'sec-edgar';
  priority = 10; // High priority (free, official)

  private supportedTypes: Set<DataType> = new Set([
    'incomeStatements',
    'balanceSheets',
    'cashFlowStatements',
    'filings',
    'filingContent',
    'companyInfo',
  ]);

  supports(dataType: DataType): boolean {
    return this.supportedTypes.has(dataType);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${SEC_BASE_URL}/files/company_tickers.json`, {
        method: 'HEAD',
        headers: { 'User-Agent': USER_AGENT },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getRateLimitStatus(): RateLimitStatus {
    return { remaining: Infinity, isLimited: false };
  }

  private async getCompanyFacts(ticker: string): Promise<CompanyFacts> {
    const cik = await getCIK(ticker);
    const response = await rateLimitedFetch(`${SEC_BASE_URL}/api/xbrl/companyfacts/CIK${cik}.json`);
    return response.json();
  }

  async getIncomeStatements(params: FinancialStatementsParams): Promise<IncomeStatement[]> {
    const facts = await this.getCompanyFacts(params.ticker);
    const limit = params.limit || 10;

    // Map XBRL concepts to income statement fields
    const conceptMappings: Record<string, string[]> = {
      revenue: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'],
      costOfRevenue: ['CostOfRevenue', 'CostOfGoodsAndServicesSold'],
      grossProfit: ['GrossProfit'],
      operatingExpenses: ['OperatingExpenses'],
      operatingIncome: ['OperatingIncomeLoss'],
      netIncome: ['NetIncomeLoss', 'ProfitLoss'],
      eps: ['EarningsPerShareBasic'],
      epsDiluted: ['EarningsPerShareDiluted'],
    };

    // Get all values for each concept
    const conceptData: Record<string, XBRLFact[]> = {};
    for (const [field, concepts] of Object.entries(conceptMappings)) {
      for (const concept of concepts) {
        const values = extractFactValues(facts, concept);
        if (values.length > 0) {
          conceptData[field] = filterByPeriod(values, params.period, limit);
          break;
        }
      }
    }

    // Use revenue dates as base, or fall back to netIncome
    const baseFacts = conceptData.revenue || conceptData.netIncome || [];

    return baseFacts.map((base) => {
      const getValue = (field: string): number | undefined => {
        const fieldFacts = conceptData[field];
        if (!fieldFacts) return undefined;
        const match = fieldFacts.find((f) => f.end === base.end);
        return match?.val;
      };

      return {
        ticker: params.ticker,
        reportPeriod: base.end,
        period: params.period,
        fiscalYear: base.fy,
        fiscalPeriod: base.fp,
        revenue: getValue('revenue'),
        costOfRevenue: getValue('costOfRevenue'),
        grossProfit: getValue('grossProfit'),
        operatingExpenses: getValue('operatingExpenses'),
        operatingIncome: getValue('operatingIncome'),
        netIncome: getValue('netIncome'),
        eps: getValue('eps'),
        epsDiluted: getValue('epsDiluted'),
      };
    });
  }

  async getBalanceSheets(params: FinancialStatementsParams): Promise<BalanceSheet[]> {
    const facts = await this.getCompanyFacts(params.ticker);
    const limit = params.limit || 10;

    const conceptMappings: Record<string, string[]> = {
      totalAssets: ['Assets'],
      totalLiabilities: ['Liabilities'],
      totalEquity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
      cash: ['CashAndCashEquivalentsAtCarryingValue', 'Cash'],
      totalDebt: ['LongTermDebt', 'DebtCurrent'],
      currentAssets: ['AssetsCurrent'],
      currentLiabilities: ['LiabilitiesCurrent'],
    };

    const conceptData: Record<string, XBRLFact[]> = {};
    for (const [field, concepts] of Object.entries(conceptMappings)) {
      for (const concept of concepts) {
        const values = extractFactValues(facts, concept);
        if (values.length > 0) {
          conceptData[field] = filterByPeriod(values, params.period, limit);
          break;
        }
      }
    }

    const baseFacts = conceptData.totalAssets || [];

    return baseFacts.map((base) => {
      const getValue = (field: string): number | undefined => {
        const fieldFacts = conceptData[field];
        if (!fieldFacts) return undefined;
        const match = fieldFacts.find((f) => f.end === base.end);
        return match?.val;
      };

      return {
        ticker: params.ticker,
        reportPeriod: base.end,
        period: params.period,
        fiscalYear: base.fy,
        fiscalPeriod: base.fp,
        totalAssets: getValue('totalAssets'),
        totalLiabilities: getValue('totalLiabilities'),
        totalEquity: getValue('totalEquity'),
        cash: getValue('cash'),
        totalDebt: getValue('totalDebt'),
        currentAssets: getValue('currentAssets'),
        currentLiabilities: getValue('currentLiabilities'),
      };
    });
  }

  async getCashFlowStatements(params: FinancialStatementsParams): Promise<CashFlowStatement[]> {
    const facts = await this.getCompanyFacts(params.ticker);
    const limit = params.limit || 10;

    const conceptMappings: Record<string, string[]> = {
      operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
      investingCashFlow: ['NetCashProvidedByUsedInInvestingActivities'],
      financingCashFlow: ['NetCashProvidedByUsedInFinancingActivities'],
      capitalExpenditures: ['PaymentsToAcquirePropertyPlantAndEquipment'],
      depreciation: ['DepreciationDepletionAndAmortization'],
    };

    const conceptData: Record<string, XBRLFact[]> = {};
    for (const [field, concepts] of Object.entries(conceptMappings)) {
      for (const concept of concepts) {
        const values = extractFactValues(facts, concept);
        if (values.length > 0) {
          conceptData[field] = filterByPeriod(values, params.period, limit);
          break;
        }
      }
    }

    const baseFacts = conceptData.operatingCashFlow || [];

    return baseFacts.map((base) => {
      const getValue = (field: string): number | undefined => {
        const fieldFacts = conceptData[field];
        if (!fieldFacts) return undefined;
        const match = fieldFacts.find((f) => f.end === base.end);
        return match?.val;
      };

      const opCF = getValue('operatingCashFlow');
      const capex = getValue('capitalExpenditures');

      return {
        ticker: params.ticker,
        reportPeriod: base.end,
        period: params.period,
        fiscalYear: base.fy,
        fiscalPeriod: base.fp,
        operatingCashFlow: opCF,
        investingCashFlow: getValue('investingCashFlow'),
        financingCashFlow: getValue('financingCashFlow'),
        freeCashFlow: opCF && capex ? opCF - capex : undefined,
        capitalExpenditures: capex,
        depreciation: getValue('depreciation'),
      };
    });
  }

  async getFilings(params: FilingsParams): Promise<FilingMetadata[]> {
    const cik = await getCIK(params.ticker);
    const response = await rateLimitedFetch(`${SEC_BASE_URL}/submissions/CIK${cik}.json`);
    const data = await response.json();

    const filings = data.filings?.recent;
    if (!filings) return [];

    const results: FilingMetadata[] = [];
    const limit = params.limit || 10;

    for (let i = 0; i < filings.accessionNumber.length && results.length < limit; i++) {
      const filingType = filings.form[i] as string;

      // Filter by filing type if specified
      if (params.filingType && !filingType.startsWith(params.filingType)) {
        continue;
      }

      // Only include 10-K, 10-Q, 8-K
      if (!['10-K', '10-Q', '8-K'].some((t) => filingType.startsWith(t))) {
        continue;
      }

      const accessionNumber = filings.accessionNumber[i].replace(/-/g, '');
      const accessionFormatted = filings.accessionNumber[i];

      results.push({
        accessionNumber: accessionFormatted,
        filingType,
        filingDate: filings.filingDate[i],
        reportDate: filings.reportDate[i],
        companyName: data.name,
        cik: cik.replace(/^0+/, ''),
        url: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accessionNumber}/${filings.primaryDocument[i]}`,
      });
    }

    return results;
  }

  async getFilingContent(accessionNumber: string, _items?: string[]): Promise<FilingContent> {
    // For SEC EDGAR, we return the filing URL - full text extraction requires HTML parsing
    // This is a simplified implementation that returns the filing index
    const cleanAccession = accessionNumber.replace(/-/g, '');

    // We need the CIK to build the URL - this is a limitation
    // In practice, you'd cache the CIK when getting filings
    return {
      accessionNumber,
      items: {
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&filenum=${accessionNumber}&type=&dateb=&owner=include&count=40`,
        note: 'SEC EDGAR provides raw filing documents. Use the URL to access the full filing.',
      },
    };
  }

  async getCompanyInfo(ticker: string): Promise<CompanyInfo> {
    const cik = await getCIK(ticker);
    const response = await rateLimitedFetch(`${SEC_BASE_URL}/submissions/CIK${cik}.json`);
    const data = await response.json();

    return {
      ticker,
      name: data.name,
      cik: cik.replace(/^0+/, ''),
      sic: data.sic,
      sicDescription: data.sicDescription,
      exchange: data.exchanges?.[0],
      stateOfIncorporation: data.stateOfIncorporation,
      fiscalYearEnd: data.fiscalYearEnd,
      website: data.website,
    };
  }
}
