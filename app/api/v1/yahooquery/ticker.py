from fastapi import APIRouter, HTTPException, Query
from yahooquery import Ticker
import logging
from typing import Optional, List, Union

from app.utils.yahooquery.yahooquery_data_manager import clean_yahooquery_data
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yahooquery.error_handler import handle_yq_request

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yahooquery/ticker", tags=["YahooQuery Ticker"])

# Logger for this module
logger = logging.getLogger(__name__)


# Basic information endpoints
@router.get("/{ticker}/summary_profile")
@handle_yq_request
@redis_cache(ttl="3 months", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_summary_profile(ticker: str):
    """
    Get the summary profile for a ticker.

    This includes company description, industry, sector, website, etc.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Summary profile information
    """
    return Ticker(ticker).summary_profile


@router.get("/{ticker}/asset_profile")
@handle_yq_request
@redis_cache(ttl="3 months", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_asset_profile(ticker: str):
    """
    Get the asset profile for a ticker.

    This includes detailed company information, management team, etc.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Asset profile information
    """
    return Ticker(ticker).asset_profile


@router.get("/{ticker}/key_stats")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_key_stats(ticker: str):
    """
    Get key statistics for a ticker.

    This includes financial ratios, market cap, 52-week highs/lows, etc.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Key statistics
    """
    return Ticker(ticker).key_stats


@router.get("/{ticker}/summary_detail")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_summary_detail(ticker: str):
    """
    Get summary details for a ticker.

    This includes current price, market cap, PE ratio, dividend yield, etc.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Summary detail information
    """
    return Ticker(ticker).summary_detail


@router.get("/{ticker}/price")
@handle_yq_request
@redis_cache(ttl="30 minutes", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_price(ticker: str):
    """
    Get current price information for a ticker.

    This includes current price, market cap, 52-week high/low, etc.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Current price information
    """
    return Ticker(ticker).price


@router.get("/{ticker}/quote_type")
@handle_yq_request
@redis_cache(ttl="3 months", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_quote_type(ticker: str):
    """
    Get quote type information for a ticker.

    This includes exchange, quoteType (EQUITY, ETF, etc.), market, etc.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Quote type information
    """
    return Ticker(ticker).quote_type


# Financial statements endpoints
@router.get("/{ticker}/income_statement")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_income_statement(ticker: str, frequency: str = Query("annual", description="annual or quarterly")):
    """
    Get income statement for a ticker.

    Args:
        ticker: Stock ticker symbol
        frequency: 'annual' or 'quarterly'

    Returns:
        Income statement data
    """
    return Ticker(ticker).income_statement(frequency=frequency)


@router.get("/{ticker}/balance_sheet")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_balance_sheet(ticker: str, frequency: str = Query("annual", description="annual or quarterly")):
    """
    Get balance sheet for a ticker.

    Args:
        ticker: Stock ticker symbol
        frequency: 'annual' or 'quarterly'

    Returns:
        Balance sheet data
    """
    return Ticker(ticker).balance_sheet(frequency=frequency)


@router.get("/{ticker}/cash_flow")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_cash_flow(ticker: str, frequency: str = Query("annual", description="annual or quarterly")):
    """
    Get cash flow statement for a ticker.

    Args:
        ticker: Stock ticker symbol
        frequency: 'annual' or 'quarterly'

    Returns:
        Cash flow statement data
    """
    return Ticker(ticker).cash_flow(frequency=frequency)


@router.get("/{ticker}/financial_data")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_financial_data(ticker: str):
    """
    Get financial data for a ticker.

    This includes profit margins, revenue, earnings, debt, etc.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Financial data
    """
    return Ticker(ticker).financial_data


# Historical data endpoints
@router.get("/{ticker}/history")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_history(
        ticker: str,
        period: str = Query("1mo", description="1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max"),
        interval: str = Query("1d", description="1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo"),
        start: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
        end: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
):
    """
    Get historical price data for a ticker.

    Args:
        ticker: Stock ticker symbol
        period: Data period
        interval: Data interval
        start: Start date (overrides period if provided)
        end: End date (overrides period if provided)

    Returns:
        Historical price data
    """
    ticker_obj = Ticker(ticker)

    # If start and end dates are provided, use them instead of period
    if start and end:
        return ticker_obj.history(interval=interval, start=start, end=end)
    else:
        return ticker_obj.history(period=period, interval=interval)


# Fundamental analysis endpoints
@router.get("/{ticker}/calendar_events")
@handle_yq_request
@redis_cache(ttl="1 week", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_calendar_events(ticker: str):
    """
    Get calendar events for a ticker.

    This includes earnings dates, dividend dates, etc.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Calendar events
    """
    return Ticker(ticker).calendar_events


@router.get("/{ticker}/company_officers")
@handle_yq_request
@redis_cache(ttl="1 month", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_company_officers(ticker: str):
    """
    Get company officers for a ticker.

    This includes executives, board members, etc.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Company officers information
    """
    return Ticker(ticker).company_officers


@router.get("/{ticker}/earning_history")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_earning_history(ticker: str):
    """
    Get earning history for a ticker.

    This includes past earnings dates, EPS estimates vs. actual, etc.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Earning history
    """
    return Ticker(ticker).earning_history


@router.get("/{ticker}/earnings")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_earnings(ticker: str):
    """
    Get earnings data for a ticker.

    This includes earnings estimates, financials, etc.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Earnings data
    """
    return Ticker(ticker).earnings


@router.get("/{ticker}/earnings_trend")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_earnings_trend(ticker: str):
    """
    Get earnings trend for a ticker.

    This includes earnings trends over time.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Earnings trend data
    """
    return Ticker(ticker).earnings_trend


@router.get("/{ticker}/esg_scores")
@handle_yq_request
@redis_cache(ttl="1 month", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_esg_scores(ticker: str):
    """
    Get ESG (Environmental, Social, Governance) scores for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        ESG scores
    """
    return Ticker(ticker).esg_scores


# Holders and insider information endpoints
@router.get("/{ticker}/fund_ownership")
@handle_yq_request
@redis_cache(ttl="1 month", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_fund_ownership(ticker: str):
    """
    Get fund ownership information for a ticker.

    This includes funds that own the stock.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Fund ownership information
    """
    return Ticker(ticker).fund_ownership


@router.get("/{ticker}/grading_history")
@handle_yq_request
@redis_cache(ttl="1 week", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_grading_history(ticker: str):
    """
    Get analyst grading history for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Grading history
    """
    return Ticker(ticker).grading_history


@router.get("/{ticker}/insider_holders")
@handle_yq_request
@redis_cache(ttl="1 week", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_insider_holders(ticker: str):
    """
    Get insider holders for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Insider holders information
    """
    return Ticker(ticker).insider_holders


@router.get("/{ticker}/insider_transactions")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_insider_transactions(ticker: str):
    """
    Get insider transactions for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Insider transactions information
    """
    return Ticker(ticker).insider_transactions

@router.get("/{ticker}/major_holders")
@handle_yq_request
@redis_cache(ttl="1 week", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_major_holders(ticker: str):
    """
    Get major holders for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Major holders information
    """
    return Ticker(ticker).major_holders

@router.get("/{ticker}/recommendation_trend")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_recommendation_trend(ticker: str):
    """
    Get recommendation trend for a ticker.

    This includes analyst recommendations over time.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Recommendation trend
    """
    return Ticker(ticker).recommendation_trend


@router.get("/{ticker}/share_purchase_activity")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_share_purchase_activity(ticker: str):
    """
    Get share purchase activity for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Share purchase activity
    """
    return Ticker(ticker).share_purchase_activity


# Options endpoints
@router.get("/{ticker}/option_chain")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_option_chain(ticker: str, date: Optional[str] = None):
    """
    Get option chain for a ticker.

    Args:
        ticker: Stock ticker symbol
        date: Option expiration date (if None, returns all available dates)

    Returns:
        Option chain data
    """
    ticker_obj = Ticker(ticker)

    if date:
        return ticker_obj.option_chain(date=date)
    else:
        return ticker_obj.option_chain

# Fund-specific endpoints
@router.get("/{ticker}/fund_profile")
@handle_yq_request
@redis_cache(ttl="1 week", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_fund_profile(ticker: str):
    """
    Get fund profile for a ticker (for ETFs and mutual funds).

    Args:
        ticker: Fund ticker symbol

    Returns:
        Fund profile information
    """
    return Ticker(ticker).fund_profile


@router.get("/{ticker}/fund_performance")
@handle_yq_request
@redis_cache(ttl="1 week", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_fund_performance(ticker: str):
    """
    Get fund performance for a ticker (for ETFs and mutual funds).

    Args:
        ticker: Fund ticker symbol

    Returns:
        Fund performance information
    """
    return Ticker(ticker).fund_performance


@router.get("/{ticker}/fund_holding_info")
@handle_yq_request
@redis_cache(ttl="1 month", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_fund_holding_info(ticker: str):
    """
    Get fund holding information for a ticker (for ETFs and mutual funds).

    Args:
        ticker: Fund ticker symbol

    Returns:
        Fund holding information
    """
    return Ticker(ticker).fund_holding_info


@router.get("/{ticker}/fund_sector_weightings")
@handle_yq_request
@redis_cache(ttl="1 week", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_fund_sector_weightings(ticker: str):
    """
    Get fund sector weightings for a ticker (for ETFs and mutual funds).

    Args:
        ticker: Fund ticker symbol

    Returns:
        Fund sector weightings
    """
    return Ticker(ticker).fund_sector_weightings


# News and insights endpoints
@router.get("/{ticker}/news")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_news(ticker: str, count: int = Query(10, description="Number of news items to return")):
    """
    Get news for a ticker.

    Args:
        ticker: Stock ticker symbol
        count: Number of news items to return

    Returns:
        Recent news
    """
    return Ticker(ticker).news(count=count)

# Other endpoints
@router.get("/{ticker}/index_trend")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_index_trend(ticker: str):
    """
    Get index trend for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Index trend information
    """
    return Ticker(ticker).index_trend


@router.get("/{ticker}/industry_trend")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_industry_trend(ticker: str):
    """
    Get industry trend for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        Industry trend information
    """
    return Ticker(ticker).industry_trend

@router.get("/{ticker}/sec_filings")
@handle_yq_request
@redis_cache(ttl="1 week", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_sec_filings(ticker: str):
    """
    Get SEC filings for a ticker.

    Args:
        ticker: Stock ticker symbol

    Returns:
        SEC filings
    """
    return Ticker(ticker).sec_filings


# All in one data retrieval endpoints
@router.get("/{ticker}/all_modules")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_all_modules(ticker: str):
    """
    Get all available modules for a ticker.

    This retrieves comprehensive data about the ticker in a single request.

    Args:
        ticker: Stock ticker symbol

    Returns:
        All available data modules
    """
    modules = [
        "assetProfile", "summaryProfile", "summaryDetail", "esgScores", "price",
        "financialData", "incomeStatementHistory", "cashflowStatementHistory",
        "balanceSheetHistory", "incomeStatementHistoryQuarterly", "cashflowStatementHistoryQuarterly",
        "balanceSheetHistoryQuarterly", "earnings", "earningsHistory", "earningsTrend",
        "industryTrend", "indexTrend", "recommendationTrend", "upgradeDowngradeHistory",
        "institutionOwnership", "fundOwnership", "majorHoldersBreakdown", "insiderHolders",
        "calendarEvents", "sectorTrend", "netSharePurchaseActivity"
    ]

    return Ticker(ticker).get_modules(modules)