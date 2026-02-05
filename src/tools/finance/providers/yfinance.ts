/**
 * yfinance provider - Free stock data via Python yfinance library
 * https://github.com/ranaroussi/yfinance
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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
  CompanyInfo,
  NewsArticle,
  NewsParams,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const YFINANCE_SCRIPT = join(__dirname, '../../../../scripts/yfinance_helper.py');

// Track rate limiting (yfinance can get blocked)
let consecutiveErrors = 0;
let rateLimitedUntil: Date | null = null;
const MAX_CONSECUTIVE_ERRORS = 3;
const RATE_LIMIT_BACKOFF_MS = 60000; // 1 minute

async function callYfinance<T>(command: string, args: Record<string, unknown>): Promise<T> {
  // Check if we're rate limited
  if (rateLimitedUntil && rateLimitedUntil > new Date()) {
    throw new Error(`yfinance rate limited until ${rateLimitedUntil.toISOString()}`);
  }

  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_PATH || 'python3';
    const proc = spawn(python, [YFINANCE_SCRIPT, command, JSON.stringify(args)]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          rateLimitedUntil = new Date(Date.now() + RATE_LIMIT_BACKOFF_MS);
          consecutiveErrors = 0;
        }
        reject(new Error(`yfinance error (code ${code}): ${stderr || stdout}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          consecutiveErrors++;
          reject(new Error(`yfinance: ${result.error}`));
        } else {
          consecutiveErrors = 0;
          resolve(result as T);
        }
      } catch (e) {
        reject(new Error(`Failed to parse yfinance output: ${stdout}`));
      }
    });

    proc.on('error', (err) => {
      consecutiveErrors++;
      reject(new Error(`Failed to spawn Python: ${err.message}`));
    });
  });
}

export class YfinanceProvider implements FinancialDataProvider {
  name = 'yfinance';
  priority = 20; // High priority (free, comprehensive)

  private supportedTypes: Set<DataType> = new Set([
    'priceSnapshot',
    'priceHistory',
    'incomeStatements',
    'balanceSheets',
    'cashFlowStatements',
    'keyRatios',
    'keyRatiosSnapshot',
    'companyInfo',
    'news',
  ]);

  supports(dataType: DataType): boolean {
    return this.supportedTypes.has(dataType);
  }

  private availabilityChecked = false;
  private isYfinanceAvailable = false;

  async isAvailable(): Promise<boolean> {
    // Cache availability check to avoid repeated slow checks
    if (this.availabilityChecked) {
      return this.isYfinanceAvailable;
    }

    this.availabilityChecked = true;

    try {
      // Quick check: verify Python and yfinance are installed
      const python = process.env.PYTHON_PATH || 'python3';
      const result = await new Promise<boolean>((resolve) => {
        const proc = spawn(python, ['-c', 'import yfinance; print("ok")']);
        let stdout = '';

        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        proc.on('close', (code) => {
          resolve(code === 0 && stdout.includes('ok'));
        });

        proc.on('error', () => {
          resolve(false);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          proc.kill();
          resolve(false);
        }, 5000);
      });

      this.isYfinanceAvailable = result;
      return result;
    } catch {
      this.isYfinanceAvailable = false;
      return false;
    }
  }

  getRateLimitStatus(): RateLimitStatus {
    if (rateLimitedUntil && rateLimitedUntil > new Date()) {
      return {
        remaining: 0,
        resetAt: rateLimitedUntil,
        isLimited: true,
      };
    }
    return { remaining: Infinity, isLimited: false };
  }

  async getPriceSnapshot(ticker: string): Promise<PriceSnapshot> {
    const result = await callYfinance<PriceSnapshot>('price_snapshot', { ticker });
    return {
      ticker,
      price: result.price,
      open: result.open,
      high: result.high,
      low: result.low,
      close: result.close,
      volume: result.volume,
      previousClose: result.previousClose,
      change: result.change,
      changePercent: result.changePercent,
    };
  }

  async getPriceHistory(params: PriceHistoryParams): Promise<PriceBar[]> {
    const result = await callYfinance<PriceBar[]>('price_history', {
      ticker: params.ticker,
      startDate: params.startDate,
      endDate: params.endDate,
      interval: params.interval || 'day',
    });

    return result.map((bar) => ({
      date: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    }));
  }

  async getIncomeStatements(params: FinancialStatementsParams): Promise<IncomeStatement[]> {
    // yfinance doesn't support TTM, fallback to annual
    const period = params.period === 'ttm' ? 'annual' : params.period;

    const result = await callYfinance<IncomeStatement[]>('income_statements', {
      ticker: params.ticker,
      period,
      limit: params.limit || 10,
    });

    return result.map((stmt) => ({
      ...stmt,
      ticker: params.ticker,
      period: params.period,
    }));
  }

  async getBalanceSheets(params: FinancialStatementsParams): Promise<BalanceSheet[]> {
    const period = params.period === 'ttm' ? 'annual' : params.period;

    const result = await callYfinance<BalanceSheet[]>('balance_sheets', {
      ticker: params.ticker,
      period,
      limit: params.limit || 10,
    });

    return result.map((stmt) => ({
      ...stmt,
      ticker: params.ticker,
      period: params.period,
    }));
  }

  async getCashFlowStatements(params: FinancialStatementsParams): Promise<CashFlowStatement[]> {
    const period = params.period === 'ttm' ? 'annual' : params.period;

    const result = await callYfinance<CashFlowStatement[]>('cash_flow_statements', {
      ticker: params.ticker,
      period,
      limit: params.limit || 10,
    });

    return result.map((stmt) => ({
      ...stmt,
      ticker: params.ticker,
      period: params.period,
    }));
  }

  async getKeyRatiosSnapshot(ticker: string): Promise<KeyRatios> {
    return callYfinance<KeyRatios>('key_ratios', { ticker });
  }

  async getKeyRatios(params: FinancialStatementsParams): Promise<KeyRatios[]> {
    // yfinance only provides current ratios, not historical
    const snapshot = await this.getKeyRatiosSnapshot(params.ticker);
    return [snapshot];
  }

  async getCompanyInfo(ticker: string): Promise<CompanyInfo> {
    return callYfinance<CompanyInfo>('company_info', { ticker });
  }

  async getNews(params: NewsParams): Promise<NewsArticle[]> {
    return callYfinance<NewsArticle[]>('news', {
      ticker: params.ticker,
      limit: params.limit || 10,
    });
  }
}
