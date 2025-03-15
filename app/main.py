from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
from typing import List, Optional, Dict, Any, Union
import pandas as pd
from datetime import datetime, timedelta
import uvicorn
from pydantic import BaseModel, Field
from functools import wraps
import logging

# Import application modules
from app.utils.yfinance_data_manager import clean_yfinance_data
from app.utils.cache_decorator import redis_cache
from app.utils.cache_strategies import CACHE_STRATEGIES, get_cache_strategy
from app.utils.redis_manager import redis_manager
from app.core.settings import API_PORT, API_HOST, logger

# Create FastAPI app
app = FastAPI(
    title="yFinance API",
    description="Comprehensive API wrapper for yfinance package to access Yahoo Finance data",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logger for this module
logger = logging.getLogger(__name__)


# Startup event to check Redis connection
@app.on_event("startup")
async def startup_event():
    if redis_manager.is_connected():
        logger.info("Redis connection established - caching is enabled")
    else:
        logger.warning("Redis connection failed - caching is disabled")


# Helper function to convert pandas DataFrames to dictionaries
def df_to_dict(df: pd.DataFrame) -> Dict:
    if df is None:
        return {}
    if isinstance(df, pd.DataFrame):
        return df.to_dict(orient="records") if not df.empty else {}
    return df if isinstance(df, dict) else {}


# Error handling for yfinance requests
def handle_yf_request(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):  # Make this async
        try:
            return await func(*args, **kwargs)  # Await the coroutine
        except Exception as e:
            logger.error(f"yfinance error in {func.__name__}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"yfinance error: {str(e)}")
    return wrapper


# Root endpoint
@app.get("/")
def read_root():
    redis_status = "connected" if redis_manager.is_connected() else "disconnected"
    return {
        "message": "Welcome to yFinance API",
        "version": "1.0.0",
        "cache_status": redis_status
    }


# -----------------------------------------
# TICKER ENDPOINTS
# -----------------------------------------

# Ticker history endpoint (with custom parameters)
@app.get("/v1/ticker/{ticker}/history")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_history(
        ticker: str,
        period: str = Query("1mo", description="Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)"),
        interval: str = Query("1d",
                              description="Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)"),
        start: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
        end: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
        prepost: bool = Query(False, description="Include pre and post market data"),
        actions: bool = Query(True, description="Include dividends and stock splits"),
        auto_adjust: bool = Query(True, description="Adjust all OHLC automatically"),
        back_adjust: bool = Query(False, description="Back-adjust data based on forward dividends adjustment"),
        repair: bool = Query(False, description="Repair missing data"),
):
    # Convert string dates to datetime if provided
    start_date = datetime.strptime(start, "%Y-%m-%d") if start else None
    end_date = datetime.strptime(end, "%Y-%m-%d") if end else None

    # Get historical data
    hist = yf.Ticker(ticker).history(
        period=period,
        interval=interval,
        start=start_date,
        end=end_date,
        prepost=prepost,
        actions=actions,
        auto_adjust=auto_adjust,
        back_adjust=back_adjust,
        repair=repair,
    )

    return hist


# All the ticker endpoints from the paste - now with Redis caching

@app.get("/v1/ticker/{ticker}/actions")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_actions(ticker: str):
    return yf.Ticker(ticker).actions


@app.get("/v1/ticker/{ticker}/analyst-price-targets")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_analyst_price_targets(ticker: str):
    return yf.Ticker(ticker).analyst_price_targets


@app.get("/v1/ticker/{ticker}/balance-sheet")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_balance_sheet(ticker: str):
    return yf.Ticker(ticker).balance_sheet


@app.get("/v1/ticker/{ticker}/balancesheet")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_balancesheet(ticker: str):
    return yf.Ticker(ticker).balancesheet


@app.get("/v1/ticker/{ticker}/basic-info")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_ticker_basic_info(ticker: str):
    return yf.Ticker(ticker).basic_info


@app.get("/v1/ticker/{ticker}/calendar")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_calendar(ticker: str):
    return yf.Ticker(ticker).calendar


@app.get("/v1/ticker/{ticker}/capital-gains")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_capital_gains(ticker: str):
    return yf.Ticker(ticker).capital_gains


@app.get("/v1/ticker/{ticker}/cash-flow")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_cash_flow(ticker: str):
    return yf.Ticker(ticker).cash_flow


@app.get("/v1/ticker/{ticker}/cashflow")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_cashflow(ticker: str):
    return yf.Ticker(ticker).cashflow


@app.get("/v1/ticker/{ticker}/dividends")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_dividends(ticker: str):
    return yf.Ticker(ticker).dividends


@app.get("/v1/ticker/{ticker}/earnings")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_earnings(ticker: str):
    return yf.Ticker(ticker).earnings


@app.get("/v1/ticker/{ticker}/earnings-dates")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_earnings_dates(ticker: str):
    return yf.Ticker(ticker).earnings_dates


@app.get("/v1/ticker/{ticker}/earnings-estimate")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_earnings_estimate(ticker: str):
    return yf.Ticker(ticker).earnings_estimate


@app.get("/v1/ticker/{ticker}/earnings-history")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_earnings_history(ticker: str):
    return yf.Ticker(ticker).earnings_history


@app.get("/v1/ticker/{ticker}/eps-revisions")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_eps_revisions(ticker: str):
    return yf.Ticker(ticker).eps_revisions


@app.get("/v1/ticker/{ticker}/eps-trend")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_eps_trend(ticker: str):
    return yf.Ticker(ticker).eps_trend


@app.get("/v1/ticker/{ticker}/fast-info")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_ticker_fast_info(ticker: str):
    return yf.Ticker(ticker).fast_info


@app.get("/v1/ticker/{ticker}/financials")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_financials(ticker: str):
    return yf.Ticker(ticker).financials


@app.get("/v1/ticker/{ticker}/funds-data")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_funds_data(ticker: str):
    return yf.Ticker(ticker).funds_data


@app.get("/v1/ticker/{ticker}/growth-estimates")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_growth_estimates(ticker: str):
    return yf.Ticker(ticker).growth_estimates


@app.get("/v1/ticker/{ticker}/history-metadata")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_history_metadata(ticker: str):
    return yf.Ticker(ticker).history_metadata


@app.get("/v1/ticker/{ticker}/income-stmt")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_income_stmt(ticker: str):
    return yf.Ticker(ticker).income_stmt


@app.get("/v1/ticker/{ticker}/incomestmt")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_incomestmt(ticker: str):
    return yf.Ticker(ticker).incomestmt


@app.get("/v1/ticker/{ticker}/info")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_ticker_info(ticker: str):
    return yf.Ticker(ticker).info


@app.get("/v1/ticker/{ticker}/insider-purchases")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_insider_purchases(ticker: str):
    return yf.Ticker(ticker).insider_purchases


@app.get("/v1/ticker/{ticker}/insider-roster-holders")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_insider_roster_holders(ticker: str):
    return yf.Ticker(ticker).insider_roster_holders


@app.get("/v1/ticker/{ticker}/insider-transactions")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_insider_transactions(ticker: str):
    return yf.Ticker(ticker).insider_transactions


@app.get("/v1/ticker/{ticker}/institutional-holders")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_institutional_holders(ticker: str):
    return yf.Ticker(ticker).institutional_holders


@app.get("/v1/ticker/{ticker}/isin")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_ticker_isin(ticker: str):
    return yf.Ticker(ticker).isin


@app.get("/v1/ticker/{ticker}/major-holders")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_major_holders(ticker: str):
    return yf.Ticker(ticker).major_holders


@app.get("/v1/ticker/{ticker}/mutualfund-holders")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_mutualfund_holders(ticker: str):
    return yf.Ticker(ticker).mutualfund_holders


@app.get("/v1/ticker/{ticker}/news")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_news(ticker: str):
    return yf.Ticker(ticker).news


@app.get("/v1/ticker/{ticker}/options")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_options(ticker: str):
    return yf.Ticker(ticker).options


@app.get("/v1/ticker/{ticker}/quarterly-balance-sheet")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_balance_sheet(ticker: str):
    return yf.Ticker(ticker).quarterly_balance_sheet


@app.get("/v1/ticker/{ticker}/quarterly-balancesheet")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_balancesheet(ticker: str):
    return yf.Ticker(ticker).quarterly_balancesheet


@app.get("/v1/ticker/{ticker}/quarterly-cash-flow")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_cash_flow(ticker: str):
    return yf.Ticker(ticker).quarterly_cash_flow


@app.get("/v1/ticker/{ticker}/quarterly-cashflow")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_cashflow(ticker: str):
    return yf.Ticker(ticker).quarterly_cashflow


@app.get("/v1/ticker/{ticker}/quarterly-earnings")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_earnings(ticker: str):
    return yf.Ticker(ticker).quarterly_earnings


@app.get("/v1/ticker/{ticker}/quarterly-financials")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_financials(ticker: str):
    return yf.Ticker(ticker).quarterly_financials


@app.get("/v1/ticker/{ticker}/quarterly-income-stmt")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_income_stmt(ticker: str):
    return yf.Ticker(ticker).quarterly_income_stmt


@app.get("/v1/ticker/{ticker}/quarterly-incomestmt")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_incomestmt(ticker: str):
    return yf.Ticker(ticker).quarterly_incomestmt


@app.get("/v1/ticker/{ticker}/recommendations")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_recommendations(ticker: str):
    return yf.Ticker(ticker).recommendations


@app.get("/v1/ticker/{ticker}/recommendations-summary")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_recommendations_summary(ticker: str):
    return yf.Ticker(ticker).recommendations_summary


@app.get("/v1/ticker/{ticker}/revenue-estimate")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_revenue_estimate(ticker: str):
    return yf.Ticker(ticker).revenue_estimate


@app.get("/v1/ticker/{ticker}/sec-filings")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_sec_filings(ticker: str):
    return yf.Ticker(ticker).sec_filings


@app.get("/v1/ticker/{ticker}/shares")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_shares(ticker: str):
    return yf.Ticker(ticker).shares


@app.get("/v1/ticker/{ticker}/splits")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_splits(ticker: str):
    return yf.Ticker(ticker).splits


@app.get("/v1/ticker/{ticker}/sustainability")
@handle_yf_request
@redis_cache(ttl="1 month")
@clean_yfinance_data
async def get_ticker_sustainability(ticker: str):
    return yf.Ticker(ticker).sustainability


@app.get("/v1/ticker/{ticker}/upgrades-downgrades")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_upgrades_downgrades(ticker: str):
    return yf.Ticker(ticker).upgrades_downgrades


# -----------------------------------------
# MARKET ENDPOINTS
# -----------------------------------------

@app.get("/v1/market/{market}/status")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def get_market_status(market: str):
    return yf.Market(market).status


@app.get("/v1/market/{market}/summary")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def get_market_summary(market: str):
    return yf.Market(market).summary


# -----------------------------------------
# SEARCH ENDPOINTS
# -----------------------------------------

@app.get("/v1/search/{query}/all")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_all(query: str):
    return yf.Search(query).all


@app.get("/v1/search/{query}/lists")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_lists(query: str):
    return yf.Search(query).lists


@app.get("/v1/search/{query}/news")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_news(query: str):
    return yf.Search(query).news


@app.get("/v1/search/{query}/quotes")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_quotes(query: str):
    return yf.Search(query).quotes


@app.get("/v1/search/{query}/research")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_research(query: str):
    return yf.Search(query).research


@app.get("/v1/search/{query}/response")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_response(query: str):
    return yf.Search(query).response


# -----------------------------------------
# SECTOR ENDPOINTS
# -----------------------------------------

@app.get("/v1/sector/{sector}/industries")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_sector_industries(sector: str):
    return yf.Sector(sector).industries


@app.get("/v1/sector/{sector}/key")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_sector_key(sector: str):
    return yf.Sector(sector).key


@app.get("/v1/sector/{sector}/name")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_sector_name(sector: str):
    return yf.Sector(sector).name


@app.get("/v1/sector/{sector}/overview")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_sector_overview(sector: str):
    return yf.Sector(sector).overview


@app.get("/v1/sector/{sector}/research-reports")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_sector_research_reports(sector: str):
    return yf.Sector(sector).research_reports


@app.get("/v1/sector/{sector}/symbol")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_sector_symbol(sector: str):
    return yf.Sector(sector).symbol


@app.get("/v1/sector/{sector}/ticker")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_sector_ticker(sector: str):
    return yf.Sector(sector).ticker


@app.get("/v1/sector/{sector}/top-companies")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_sector_top_companies(sector: str):
    return yf.Sector(sector).top_companies


@app.get("/v1/sector/{sector}/top-etfs")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_sector_top_etfs(sector: str):
    return yf.Sector(sector).top_etfs


@app.get("/v1/sector/{sector}/top-mutual-funds")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_sector_top_mutual_funds(sector: str):
    return yf.Sector(sector).top_mutual_funds


# -----------------------------------------
# INDUSTRY ENDPOINTS
# -----------------------------------------

@app.get("/v1/industry/{industry}/key")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_key(industry: str):
    return yf.Industry(industry).key


@app.get("/v1/industry/{industry}/name")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_name(industry: str):
    return yf.Industry(industry).name


@app.get("/v1/industry/{industry}/overview")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_industry_overview(industry: str):
    return yf.Industry(industry).overview


@app.get("/v1/industry/{industry}/research-reports")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_industry_research_reports(industry: str):
    return yf.Industry(industry).research_reports


@app.get("/v1/industry/{industry}/sector-key")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_sector_key(industry: str):
    return yf.Industry(industry).sector_key


@app.get("/v1/industry/{industry}/sector-name")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_sector_name(industry: str):
    return yf.Industry(industry).sector_name


@app.get("/v1/industry/{industry}/symbol")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_symbol(industry: str):
    return yf.Industry(industry).symbol


@app.get("/v1/industry/{industry}/ticker")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_ticker(industry: str):
    return yf.Industry(industry).ticker


@app.get("/v1/industry/{industry}/top-companies")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_industry_top_companies(industry: str):
    return yf.Industry(industry).top_companies


@app.get("/v1/industry/{industry}/top-growth-companies")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_industry_top_growth_companies(industry: str):
    return yf.Industry(industry).top_growth_companies


@app.get("/v1/industry/{industry}/top-performing-companies")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_industry_top_performing_companies(industry: str):
    return yf.Industry(industry).top_performing_companies


# Resolve duplicated endpoint
@app.get("/v1/industry/{industry}/overview-duplicate")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_industry_overview_duplicate(industry: str):
    """Duplicate endpoint added to handle the duplicate in the original code"""
    return yf.Industry(industry).overview


# Add multi-ticker endpoint from my original implementation
@app.get("/v1/multi-ticker")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_multi_ticker(symbols: str = Query(..., description="Comma-separated list of ticker symbols")):
    symbol_list = [s.strip() for s in symbols.split(",")]
    tickers = yf.Tickers(" ".join(symbol_list))

    result = {}
    for symbol in symbol_list:
        try:
            ticker_info = tickers.tickers[symbol].info if symbol in tickers.tickers else {}
            result[symbol] = ticker_info
        except:
            result[symbol] = {"error": f"Failed to retrieve info for {symbol}"}

    return result


# Option chain endpoint with more details
@app.get("/v1/ticker/{ticker}/option-chain")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_option_chain(
        ticker: str,
        date: Optional[str] = Query(None, description="Options expiration date in YYYY-MM-DD format")
):
    ticker_obj = yf.Ticker(ticker)

    # Get available expiration dates
    exp_dates = ticker_obj.options

    if not exp_dates:
        return {
            "expiration_dates": [],
            "options": {}
        }

    # If no date provided, use the first available date
    if date is None:
        date = exp_dates[0]
    elif date not in exp_dates:
        raise HTTPException(status_code=404, detail=f"Expiration date {date} not found. Available dates: {exp_dates}")

    # Get options data for the specified date
    options_chain = ticker_obj.option_chain(date)

    return {
        "expiration_dates": exp_dates,
        "options": {
            "date": date,
            "calls": options_chain.calls,
            "puts": options_chain.puts
        }
    }


# -----------------------------------------
# CACHE MANAGEMENT ENDPOINTS
# -----------------------------------------

# Get cache strategy information
@app.get("/v1/cache-strategy")
def get_cache_strategy():
    """
    Returns recommended caching strategies for all endpoints based on the config.
    This can be used by a caching layer or proxy to set appropriate cache TTLs.
    """
    return CACHE_STRATEGIES


# Clear Redis cache
@app.post("/v1/cache/clear")
def clear_cache():
    """
    Clear all Redis cache data.
    This is an administrative endpoint that should be secured in production.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    success = redis_manager.clear_all()
    if success:
        return {"message": "Cache cleared successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to clear cache")


# Cache stats endpoint
@app.get("/v1/cache/stats")
def get_cache_stats():
    """
    Get Redis cache statistics.
    This is an informational endpoint that should be secured in production.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    try:
        stats = redis_manager.client.info()
        cache_stats = {
            "used_memory": stats.get("used_memory_human", "Unknown"),
            "used_memory_peak": stats.get("used_memory_peak_human", "Unknown"),
            "clients_connected": stats.get("connected_clients", 0),
            "uptime_days": stats.get("uptime_in_days", 0),
            "hits": stats.get("keyspace_hits", 0),
            "misses": stats.get("keyspace_misses", 0),
            "hit_rate": stats.get("keyspace_hits", 0) / max(1, (
                        stats.get("keyspace_hits", 0) + stats.get("keyspace_misses", 0))) * 100,
            "keys": {db: int(info.split(",")[0].split("=")[1]) for db, info in stats.items() if db.startswith("db")}
        }
        return cache_stats
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache stats: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host=API_HOST, port=API_PORT)