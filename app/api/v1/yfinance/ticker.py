import logging
import yfinance as yf

from typing import Optional
from datetime import datetime

from fastapi import (
    APIRouter, 
    HTTPException, 
    Query, 
    Path
)

from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request
from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yfinance/ticker", tags=["YFinance Ticker"])

# Logger for this module
logger = logging.getLogger(__name__)

# Multi-ticker endpoint
@router.get("/multi")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_multi_ticker(symbols: str = Query(..., description="Comma-separated list of ticker symbols")):
    """
    Get basic information for multiple ticker symbols at once.

    Args:
        symbols: Comma-separated list of ticker symbols

    Returns:
        Dictionary with ticker symbols as keys and their info as values
    """
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

@router.get("/multi/{symbols}/news")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_multiple_tickers_news(symbols: str = Path(..., description="Comma-separated list of ticker symbols")):
    """
    Get news for multiple ticker symbols at once.

    Args:
        symbols: Comma-separated list of ticker symbols

    Returns:
        Dictionary with ticker symbols as keys and their news as values
    """
    symbol_list = [s.strip() for s in symbols.split(",")]
    tickers = yf.Tickers(" ".join(symbol_list))
    return tickers.news()

# Ticker history endpoint (with custom parameters)
@router.get("/{ticker}/history")
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
    """
    Get historical price data for a ticker symbol.

    Args:
        ticker: Stock ticker symbol (e.g., AAPL, MSFT)
        period: Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
        interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
        start: Start date in YYYY-MM-DD format
        end: End date in YYYY-MM-DD format
        prepost: Include pre and post market data
        actions: Include dividends and stock splits
        auto_adjust: Adjust all OHLC automatically
        back_adjust: Back-adjust data based on forward dividends adjustment
        repair: Repair missing data

    Returns:
        Historical price data for the specified ticker
    """
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

@router.get("/{ticker}/option-chain")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_option_chain(
        ticker: str,
        date: Optional[str] = Query(None, description="Options expiration date in YYYY-MM-DD format"),
        tz: Optional[str] = Query(None, description="Timezone for option dates (e.g., 'America/New_York')")
):
    """
    Get the option chain for a ticker symbol with timezone support.

    Args:
        ticker: Stock ticker symbol
        date: Options expiration date in YYYY-MM-DD format
        tz: Timezone for option dates

    Returns:
        Option chain with calls and puts for the specified date
    """
    ticker_obj = yf.Ticker(ticker)
    exp_dates = ticker_obj.options

    if not exp_dates:
        return {"expiration_dates": [], "options": {}}

    if date is None:
        date = exp_dates[0]
    elif date not in exp_dates:
        raise HTTPException(status_code=404, detail=f"Expiration date {date} not found. Available dates: {exp_dates}")

    options_chain = ticker_obj.option_chain(date, tz=tz)

    return {
        "expiration_dates": exp_dates,
        "options": {
            "date": date,
            "calls": options_chain.calls,
            "puts": options_chain.puts,
            "underlying": options_chain.underlying
        }
    }

@router.get("/{ticker}/actions")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_actions(ticker: str):
    """
    Get corporate actions (dividends, splits) for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Corporate actions for the ticker
    """
    return yf.Ticker(ticker).actions

@router.get("/{ticker}/analyst-price-targets")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_analyst_price_targets(ticker: str):
    """
    Get analyst price targets for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Analyst price targets for the ticker
    """
    return yf.Ticker(ticker).analyst_price_targets

@router.get("/{ticker}/balance-sheet")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_balance_sheet(ticker: str):
    """
    Get the annual balance sheet for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Annual balance sheet for the ticker
    """
    return yf.Ticker(ticker).balance_sheet

@router.get("/{ticker}/balancesheet")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_balancesheet(ticker: str):
    """
    Get the annual balance sheet for a ticker (alias).

    Args:
        ticker: Stock ticker symbol

    Returns:
        Annual balance sheet for the ticker
    """
    return yf.Ticker(ticker).balancesheet

@router.get("/{ticker}/basic-info")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_ticker_basic_info(ticker: str):
    """
    Get basic information for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Basic information for the ticker
    """
    return yf.Ticker(ticker).basic_info

@router.get("/{ticker}/calendar")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_calendar(ticker: str):
    """
    Get upcoming events calendar for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Calendar of upcoming events for the ticker
    """
    return yf.Ticker(ticker).calendar

@router.get("/{ticker}/capital-gains")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_capital_gains(ticker: str):
    """
    Get capital gains for a ticker (typically for funds).

    Args:
        ticker: Stock ticker symbol

    Returns:
        Capital gains for the ticker
    """
    return yf.Ticker(ticker).capital_gains

@router.get("/{ticker}/cash-flow")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_cash_flow(ticker: str):
    """
    Get the annual cash flow statement for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Annual cash flow statement for the ticker
    """
    return yf.Ticker(ticker).cash_flow

@router.get("/{ticker}/cashflow")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_cashflow(ticker: str):
    """
    Get the annual cash flow statement for a ticker (alias).

    Args:
        ticker: Stock ticker symbol

    Returns:
        Annual cash flow statement for the ticker
    """
    return yf.Ticker(ticker).cashflow

@router.get("/{ticker}/dividends")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_dividends(ticker: str):
    """
    Get dividend history for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Dividend history for the ticker
    """
    return yf.Ticker(ticker).dividends

@router.get("/{ticker}/earnings")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_earnings(ticker: str):
    """
    Get annual earnings data for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Annual earnings data for the ticker
    """
    return yf.Ticker(ticker).earnings

@router.get("/{ticker}/earnings-dates")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_earnings_dates(ticker: str):
    """
    Get upcoming and past earnings dates for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Earnings dates for the ticker
    """
    return yf.Ticker(ticker).earnings_dates

@router.get("/{ticker}/earnings-estimate")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_earnings_estimate(ticker: str):
    """
    Get earnings estimates for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Earnings estimates for the ticker
    """
    return yf.Ticker(ticker).earnings_estimate

@router.get("/{ticker}/earnings-history")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_earnings_history(ticker: str):
    """
    Get earnings history for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Earnings history for the ticker
    """
    return yf.Ticker(ticker).earnings_history

@router.get("/{ticker}/eps-revisions")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_eps_revisions(ticker: str):
    """
    Get EPS (Earnings Per Share) revisions for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        EPS revisions for the ticker
    """
    return yf.Ticker(ticker).eps_revisions

@router.get("/{ticker}/eps-trend")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_eps_trend(ticker: str):
    """
    Get EPS (Earnings Per Share) trend for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        EPS trend for the ticker
    """
    return yf.Ticker(ticker).eps_trend

@router.get("/{ticker}/fast-info")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_ticker_fast_info(ticker: str):
    """
    Get frequently accessed information for a ticker (optimized for performance).

    Args:
        ticker: Stock ticker symbol

    Returns:
        Fast access information for the ticker
    """
    return yf.Ticker(ticker).fast_info

@router.get("/{ticker}/financials")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_financials(ticker: str):
    """
    Get annual financial statements for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Annual financial statements for the ticker
    """
    return yf.Ticker(ticker).financials

@router.get("/{ticker}/funds-data")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_funds_data(ticker: str):
    """
    Get fund-specific data for a ticker (for ETFs and mutual funds).

    Args:
        ticker: Stock ticker symbol

    Returns:
        Fund-specific data for the ticker
    """
    return yf.Ticker(ticker).funds_data

@router.get("/{ticker}/growth-estimates")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_growth_estimates(ticker: str):
    """
    Get growth estimates for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Growth estimates for the ticker
    """
    return yf.Ticker(ticker).growth_estimates

@router.get("/{ticker}/history-metadata")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_history_metadata(ticker: str):
    """
    Get metadata about available historical data for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        History metadata for the ticker
    """
    return yf.Ticker(ticker).history_metadata

@router.get("/{ticker}/income-stmt")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_income_stmt(ticker: str):
    """
    Get the annual income statement for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Annual income statement for the ticker
    """
    return yf.Ticker(ticker).income_stmt

@router.get("/{ticker}/incomestmt")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_incomestmt(ticker: str):
    """
    Get the annual income statement for a ticker (alias).

    Args:
        ticker: Stock ticker symbol

    Returns:
        Annual income statement for the ticker
    """
    return yf.Ticker(ticker).incomestmt

@router.get("/{ticker}/info")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_ticker_info(ticker: str):
    """
    Get comprehensive information for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Comprehensive information for the ticker
    """
    return yf.Ticker(ticker).info

@router.get("/{ticker}/insider-purchases")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_insider_purchases(ticker: str):
    """
    Get insider purchases for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Insider purchases for the ticker
    """
    return yf.Ticker(ticker).insider_purchases

@router.get("/{ticker}/insider-roster-holders")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_insider_roster_holders(ticker: str):
    """
    Get insider roster holders for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Insider roster holders for the ticker
    """
    return yf.Ticker(ticker).insider_roster_holders

@router.get("/{ticker}/insider-transactions")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_insider_transactions(ticker: str):
    """
    Get insider transactions for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Insider transactions for the ticker
    """
    return yf.Ticker(ticker).insider_transactions

@router.get("/{ticker}/institutional-holders")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_institutional_holders(ticker: str):
    """
    Get institutional holders for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Institutional holders for the ticker
    """
    return yf.Ticker(ticker).institutional_holders

@router.get("/{ticker}/isin")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_ticker_isin(ticker: str):
    """
    Get the ISIN (International Securities Identification Number) for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        ISIN for the ticker
    """
    return yf.Ticker(ticker).isin

@router.get("/isin/{isin}/ticker")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_ticker_by_isin(isin: str):
    """
    Get the ticker symbol for a given ISIN.

    Args:
        isin: International Securities Identification Number

    Returns:
        Corresponding ticker symbol
    """
    return yf.utils.get_ticker_by_isin(isin)

@router.get("/isin/{isin}/info")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_info_by_isin(isin: str):
    """
    Get basic information for a given ISIN.

    Args:
        isin: International Securities Identification Number

    Returns:
        Basic information for the corresponding ticker
    """
    return yf.utils.get_info_by_isin(isin)

@router.get("/isin/{isin}/news")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_news_by_isin(isin: str):
    """
    Get news for a given ISIN.

    Args:
        isin: International Securities Identification Number

    Returns:
        News for the corresponding ticker
    """
    return yf.utils.get_news_by_isin(isin)

@router.get("/{ticker}/major-holders")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_major_holders(ticker: str):
    """
    Get major holders for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Major holders for the ticker
    """
    return yf.Ticker(ticker).major_holders

@router.get("/{ticker}/mutualfund-holders")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_mutualfund_holders(ticker: str):
    """
    Get mutual fund holders for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Mutual fund holders for the ticker
    """
    return yf.Ticker(ticker).mutualfund_holders

@router.get("/{ticker}/news")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_news(ticker: str):
    """
    Get recent news for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Recent news for the ticker
    """
    return yf.Ticker(ticker).news

@router.get("/{ticker}/options")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_options(ticker: str):
    """
    Get available options expiration dates for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Available options expiration dates for the ticker
    """
    return yf.Ticker(ticker).options

@router.get("/{ticker}/quarterly-balance-sheet")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_balance_sheet(ticker: str):
    """
    Get the quarterly balance sheet for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Quarterly balance sheet for the ticker
    """
    return yf.Ticker(ticker).quarterly_balance_sheet

@router.get("/{ticker}/quarterly-balancesheet")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_balancesheet(ticker: str):
    """
    Get the quarterly balance sheet for a ticker (alias).

    Args:
        ticker: Stock ticker symbol

    Returns:
        Quarterly balance sheet for the ticker
    """
    return yf.Ticker(ticker).quarterly_balancesheet

@router.get("/{ticker}/quarterly-cash-flow")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_cash_flow(ticker: str):
    """
    Get the quarterly cash flow statement for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Quarterly cash flow statement for the ticker
    """
    return yf.Ticker(ticker).quarterly_cash_flow

@router.get("/{ticker}/quarterly-cashflow")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_cashflow(ticker: str):
    """
    Get the quarterly cash flow statement for a ticker (alias).

    Args:
        ticker: Stock ticker symbol

    Returns:
        Quarterly cash flow statement for the ticker
    """
    return yf.Ticker(ticker).quarterly_cashflow

@router.get("/{ticker}/quarterly-earnings")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_earnings(ticker: str):
    """
    Get quarterly earnings data for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Quarterly earnings data for the ticker
    """
    return yf.Ticker(ticker).quarterly_earnings

@router.get("/{ticker}/quarterly-financials")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_financials(ticker: str):
    """
    Get quarterly financial statements for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Quarterly financial statements for the ticker
    """
    return yf.Ticker(ticker).quarterly_financials

@router.get("/{ticker}/quarterly-income-stmt")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_income_stmt(ticker: str):
    """
    Get the quarterly income statement for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Quarterly income statement for the ticker
    """
    return yf.Ticker(ticker).quarterly_income_stmt

@router.get("/{ticker}/quarterly-incomestmt")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_quarterly_incomestmt(ticker: str):
    """
    Get the quarterly income statement for a ticker (alias).

    Args:
        ticker: Stock ticker symbol

    Returns:
        Quarterly income statement for the ticker
    """
    return yf.Ticker(ticker).quarterly_incomestmt

@router.get("/{ticker}/recommendations")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_recommendations(ticker: str):
    """
    Get analyst recommendations for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Analyst recommendations for the ticker
    """
    return yf.Ticker(ticker).recommendations

@router.get("/{ticker}/recommendations-summary")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_recommendations_summary(ticker: str):
    """
    Get a summary of analyst recommendations for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Summary of analyst recommendations for the ticker
    """
    return yf.Ticker(ticker).recommendations_summary

@router.get("/{ticker}/revenue-estimate")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_revenue_estimate(ticker: str):
    """
    Get revenue estimates for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Revenue estimates for the ticker
    """
    return yf.Ticker(ticker).revenue_estimate

@router.get("/{ticker}/sec-filings")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_sec_filings(ticker: str):
    """
    Get SEC filings for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        SEC filings for the ticker
    """
    return yf.Ticker(ticker).sec_filings

@router.get("/{ticker}/shares")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_shares(ticker: str):
    """
    Get share count and related metrics for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Share information for the ticker
    """
    return yf.Ticker(ticker).shares

@router.get("/{ticker}/shares-full")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_shares_full(
        ticker: str,
        start: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
        end: Optional[str] = Query(None, description="End date in YYYY-MM-DD format")
):
    """
    Get the full share count history for a ticker within the specified date range.

    This endpoint provides detailed historical share count data, which is useful
    for analyzing dilution, buybacks, and calculating accurate market cap history.

    Args:
        ticker: Stock ticker symbol
        start: Start date for share count data (default: 18 months ago)
        end: End date for share count data (default: today)

    Returns:
        Time series of share count data for the specified ticker
    """
    # Convert string dates to datetime if provided
    start_date = datetime.strptime(start, "%Y-%m-%d") if start else None
    end_date = datetime.strptime(end, "%Y-%m-%d") if end else None

    return yf.Ticker(ticker).get_shares_full(start=start_date, end=end_date)

@router.get("/{ticker}/splits")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_ticker_splits(ticker: str):
    """
    Get stock split history for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Stock split history for the ticker
    """
    return yf.Ticker(ticker).splits

@router.get("/{ticker}/sustainability")
@handle_yf_request
@redis_cache(ttl="1 month")
@clean_yfinance_data
async def get_ticker_sustainability(ticker: str):
    """
    Get sustainability and ESG scores for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Sustainability and ESG scores for the ticker
    """
    return yf.Ticker(ticker).sustainability

@router.get("/{ticker}/upgrades-downgrades")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_ticker_upgrades_downgrades(ticker: str):
    """
    Get analyst upgrades and downgrades for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Analyst upgrades and downgrades for the ticker
    """
    return yf.Ticker(ticker).upgrades_downgrades