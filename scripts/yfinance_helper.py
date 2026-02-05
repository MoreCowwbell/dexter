#!/usr/bin/env python3
"""
yfinance helper script for fetching financial data.
Called from TypeScript via subprocess.

Usage:
    python yfinance_helper.py <command> <args_json>

Commands:
    price_snapshot <ticker>
    price_history <ticker> <start_date> <end_date> [interval]
    income_statements <ticker> [period] [limit]
    balance_sheets <ticker> [period] [limit]
    cash_flow_statements <ticker> [period] [limit]
    key_ratios <ticker>
    company_info <ticker>
    news <ticker> [limit]
"""

import json
import sys
from datetime import datetime, timedelta

try:
    import yfinance as yf
except ImportError:
    print(json.dumps({"error": "yfinance not installed. Run: pip install yfinance"}))
    sys.exit(1)


def get_price_snapshot(ticker: str) -> dict:
    """Get current price snapshot for a ticker."""
    stock = yf.Ticker(ticker)
    info = stock.info

    # Try to get fast info first (less likely to be rate limited)
    try:
        fast_info = stock.fast_info
        return {
            "ticker": ticker,
            "price": fast_info.get("lastPrice") or info.get("currentPrice") or info.get("regularMarketPrice"),
            "open": fast_info.get("open") or info.get("regularMarketOpen"),
            "high": fast_info.get("dayHigh") or info.get("regularMarketDayHigh"),
            "low": fast_info.get("dayLow") or info.get("regularMarketDayLow"),
            "close": fast_info.get("previousClose") or info.get("regularMarketPreviousClose"),
            "volume": fast_info.get("lastVolume") or info.get("regularMarketVolume"),
            "previousClose": info.get("previousClose"),
            "change": info.get("regularMarketChange"),
            "changePercent": info.get("regularMarketChangePercent"),
            "marketCap": fast_info.get("marketCap") or info.get("marketCap"),
        }
    except Exception:
        return {
            "ticker": ticker,
            "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "open": info.get("regularMarketOpen"),
            "high": info.get("regularMarketDayHigh"),
            "low": info.get("regularMarketDayLow"),
            "close": info.get("regularMarketPreviousClose"),
            "volume": info.get("regularMarketVolume"),
            "previousClose": info.get("previousClose"),
            "change": info.get("regularMarketChange"),
            "changePercent": info.get("regularMarketChangePercent"),
            "marketCap": info.get("marketCap"),
        }


def get_price_history(ticker: str, start_date: str, end_date: str, interval: str = "1d") -> list:
    """Get historical price data."""
    stock = yf.Ticker(ticker)

    # Map interval names
    interval_map = {
        "minute": "1m",
        "day": "1d",
        "week": "1wk",
        "month": "1mo",
        "year": "1y",
    }
    yf_interval = interval_map.get(interval, interval)

    # yfinance has limitations on intraday data
    hist = stock.history(start=start_date, end=end_date, interval=yf_interval)

    if hist.empty:
        return []

    result = []
    for date, row in hist.iterrows():
        result.append({
            "date": date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)[:10],
            "open": float(row["Open"]) if row["Open"] == row["Open"] else None,
            "high": float(row["High"]) if row["High"] == row["High"] else None,
            "low": float(row["Low"]) if row["Low"] == row["Low"] else None,
            "close": float(row["Close"]) if row["Close"] == row["Close"] else None,
            "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else None,
        })

    return result


def get_income_statements(ticker: str, period: str = "annual", limit: int = 10) -> list:
    """Get income statements."""
    stock = yf.Ticker(ticker)

    if period == "quarterly":
        df = stock.quarterly_income_stmt
    else:
        df = stock.income_stmt

    if df.empty:
        return []

    result = []
    for col in list(df.columns)[:limit]:
        stmt = {"ticker": ticker, "reportPeriod": col.strftime("%Y-%m-%d"), "period": period}

        # Map yfinance fields to standard names
        field_map = {
            "Total Revenue": "revenue",
            "Cost Of Revenue": "costOfRevenue",
            "Gross Profit": "grossProfit",
            "Operating Expense": "operatingExpenses",
            "Operating Income": "operatingIncome",
            "Net Income": "netIncome",
            "Basic EPS": "eps",
            "Diluted EPS": "epsDiluted",
            "EBITDA": "ebitda",
            "Interest Expense": "interestExpense",
            "Tax Provision": "incomeTax",
        }

        for yf_field, std_field in field_map.items():
            if yf_field in df.index:
                val = df.loc[yf_field, col]
                stmt[std_field] = float(val) if val == val else None

        result.append(stmt)

    return result


def get_balance_sheets(ticker: str, period: str = "annual", limit: int = 10) -> list:
    """Get balance sheets."""
    stock = yf.Ticker(ticker)

    if period == "quarterly":
        df = stock.quarterly_balance_sheet
    else:
        df = stock.balance_sheet

    if df.empty:
        return []

    result = []
    for col in list(df.columns)[:limit]:
        stmt = {"ticker": ticker, "reportPeriod": col.strftime("%Y-%m-%d"), "period": period}

        field_map = {
            "Total Assets": "totalAssets",
            "Total Liabilities Net Minority Interest": "totalLiabilities",
            "Stockholders Equity": "totalEquity",
            "Cash And Cash Equivalents": "cash",
            "Total Debt": "totalDebt",
            "Current Assets": "currentAssets",
            "Current Liabilities": "currentLiabilities",
            "Long Term Debt": "longTermDebt",
            "Inventory": "inventory",
            "Accounts Receivable": "accountsReceivable",
        }

        for yf_field, std_field in field_map.items():
            if yf_field in df.index:
                val = df.loc[yf_field, col]
                stmt[std_field] = float(val) if val == val else None

        result.append(stmt)

    return result


def get_cash_flow_statements(ticker: str, period: str = "annual", limit: int = 10) -> list:
    """Get cash flow statements."""
    stock = yf.Ticker(ticker)

    if period == "quarterly":
        df = stock.quarterly_cashflow
    else:
        df = stock.cashflow

    if df.empty:
        return []

    result = []
    for col in list(df.columns)[:limit]:
        stmt = {"ticker": ticker, "reportPeriod": col.strftime("%Y-%m-%d"), "period": period}

        field_map = {
            "Operating Cash Flow": "operatingCashFlow",
            "Investing Cash Flow": "investingCashFlow",
            "Financing Cash Flow": "financingCashFlow",
            "Free Cash Flow": "freeCashFlow",
            "Capital Expenditure": "capitalExpenditures",
            "Depreciation And Amortization": "depreciation",
        }

        for yf_field, std_field in field_map.items():
            if yf_field in df.index:
                val = df.loc[yf_field, col]
                stmt[std_field] = float(val) if val == val else None

        result.append(stmt)

    return result


def get_key_ratios(ticker: str) -> dict:
    """Get key financial ratios."""
    stock = yf.Ticker(ticker)
    info = stock.info

    return {
        "ticker": ticker,
        "marketCap": info.get("marketCap"),
        "peRatio": info.get("trailingPE") or info.get("forwardPE"),
        "pegRatio": info.get("pegRatio"),
        "pbRatio": info.get("priceToBook"),
        "psRatio": info.get("priceToSalesTrailing12Months"),
        "dividendYield": info.get("dividendYield"),
        "eps": info.get("trailingEps"),
        "roe": info.get("returnOnEquity"),
        "roa": info.get("returnOnAssets"),
        "debtToEquity": info.get("debtToEquity"),
        "currentRatio": info.get("currentRatio"),
        "quickRatio": info.get("quickRatio"),
        "profitMargin": info.get("profitMargins"),
        "operatingMargin": info.get("operatingMargins"),
        "grossMargin": info.get("grossMargins"),
        "beta": info.get("beta"),
        "52WeekHigh": info.get("fiftyTwoWeekHigh"),
        "52WeekLow": info.get("fiftyTwoWeekLow"),
    }


def get_company_info(ticker: str) -> dict:
    """Get company information."""
    stock = yf.Ticker(ticker)
    info = stock.info

    return {
        "ticker": ticker,
        "name": info.get("longName") or info.get("shortName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "marketCap": info.get("marketCap"),
        "employees": info.get("fullTimeEmployees"),
        "exchange": info.get("exchange"),
        "website": info.get("website"),
        "description": info.get("longBusinessSummary"),
        "country": info.get("country"),
        "city": info.get("city"),
        "state": info.get("state"),
        "currency": info.get("currency"),
    }


def get_news(ticker: str, limit: int = 10) -> list:
    """Get recent news for a ticker."""
    stock = yf.Ticker(ticker)

    try:
        news = stock.news
    except Exception:
        return []

    if not news:
        return []

    result = []
    for item in news[:limit]:
        result.append({
            "title": item.get("title"),
            "url": item.get("link"),
            "publishedAt": datetime.fromtimestamp(item.get("providerPublishTime", 0)).isoformat(),
            "source": item.get("publisher"),
            "ticker": ticker,
        })

    return result


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command specified"}))
        sys.exit(1)

    command = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    try:
        if command == "price_snapshot":
            result = get_price_snapshot(args.get("ticker"))
        elif command == "price_history":
            result = get_price_history(
                args.get("ticker"),
                args.get("startDate"),
                args.get("endDate"),
                args.get("interval", "day"),
            )
        elif command == "income_statements":
            result = get_income_statements(
                args.get("ticker"),
                args.get("period", "annual"),
                args.get("limit", 10),
            )
        elif command == "balance_sheets":
            result = get_balance_sheets(
                args.get("ticker"),
                args.get("period", "annual"),
                args.get("limit", 10),
            )
        elif command == "cash_flow_statements":
            result = get_cash_flow_statements(
                args.get("ticker"),
                args.get("period", "annual"),
                args.get("limit", 10),
            )
        elif command == "key_ratios":
            result = get_key_ratios(args.get("ticker"))
        elif command == "company_info":
            result = get_company_info(args.get("ticker"))
        elif command == "news":
            result = get_news(args.get("ticker"), args.get("limit", 10))
        else:
            print(json.dumps({"error": f"Unknown command: {command}"}))
            sys.exit(1)

        print(json.dumps(result, default=str))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
