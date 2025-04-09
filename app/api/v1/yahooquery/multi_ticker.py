from fastapi import APIRouter, HTTPException, Query
from yahooquery import Ticker
import logging
from typing import List, Optional, Dict, Any, Union

from app.utils.yahooquery.yahooquery_data_manager import clean_yahooquery_data
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yahooquery.error_handler import handle_yq_request

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yahooquery/multi", tags=["YahooQuery Multi-Ticker"])

# Logger for this module
logger = logging.getLogger(__name__)


@router.get("/quotes")
@handle_yq_request
@redis_cache(ttl="30 minutes", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_multi_quotes(
        symbols: str = Query(..., description="Comma-separated list of ticker symbols")
):
    """
    Get quotes for multiple ticker symbols in a single request.

    This is more efficient than making individual requests for each symbol.

    Args:
        symbols: Comma-separated list of ticker symbols

    Returns:
        Quote data for all requested symbols
    """
    # Split the symbols string into a list
    symbol_list = [s.strip() for s in symbols.split(",")]

    if len(symbol_list) == 0:
        raise HTTPException(status_code=400, detail="No symbols provided")

    if len(symbol_list) > 200:
        raise HTTPException(status_code=400, detail="Too many symbols. Maximum is 200.")

    # Create a Ticker object with multiple symbols
    ticker = Ticker(symbol_list)

    # Get quotes for all symbols
    return ticker.quotes


@router.get("/price")
@handle_yq_request
@redis_cache(ttl="30 minutes", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_multi_price(
        symbols: str = Query(..., description="Comma-separated list of ticker symbols")
):
    """
    Get price data for multiple ticker symbols in a single request.

    Args:
        symbols: Comma-separated list of ticker symbols

    Returns:
        Price data for all requested symbols
    """
    # Split the symbols string into a list
    symbol_list = [s.strip() for s in symbols.split(",")]

    if len(symbol_list) == 0:
        raise HTTPException(status_code=400, detail="No symbols provided")

    if len(symbol_list) > 200:
        raise HTTPException(status_code=400, detail="Too many symbols. Maximum is 200.")

    # Create a Ticker object with multiple symbols
    ticker = Ticker(symbol_list)

    # Get price data for all symbols
    return ticker.price


@router.get("/summary")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_multi_summary(
        symbols: str = Query(..., description="Comma-separated list of ticker symbols")
):
    """
    Get summary data for multiple ticker symbols in a single request.

    This returns summary profile, detail, and quote type information.

    Args:
        symbols: Comma-separated list of ticker symbols

    Returns:
        Summary data for all requested symbols
    """
    # Split the symbols string into a list
    symbol_list = [s.strip() for s in symbols.split(",")]

    if len(symbol_list) == 0:
        raise HTTPException(status_code=400, detail="No symbols provided")

    if len(symbol_list) > 100:
        raise HTTPException(status_code=400, detail="Too many symbols. Maximum is 100.")

    # Create a Ticker object with multiple symbols
    ticker = Ticker(symbol_list)

    # Get modules for all symbols
    modules = ["summaryProfile", "summaryDetail", "quoteType"]
    return ticker.get_modules(modules)


@router.get("/financials")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_multi_financials(
        symbols: str = Query(..., description="Comma-separated list of ticker symbols"),
        types: str = Query("incomeStatementHistory", description="Financial data types to retrieve")
):
    """
    Get financial data for multiple ticker symbols in a single request.

    Args:
        symbols: Comma-separated list of ticker symbols
        types: Financial data types to retrieve

    Returns:
        Financial data for all requested symbols
    """
    # Split the symbols string into a list
    symbol_list = [s.strip() for s in symbols.split(",")]

    if len(symbol_list) == 0:
        raise HTTPException(status_code=400, detail="No symbols provided")

    if len(symbol_list) > 50:
        raise HTTPException(status_code=400, detail="Too many symbols. Maximum is 50.")

    # Create a Ticker object with multiple symbols
    ticker = Ticker(symbol_list)

    # Split types string into a list
    type_list = [t.strip() for t in types.split(",")]

    # Valid types for financials
    valid_types = [
        "incomeStatementHistory", "balanceSheetHistory", "cashflowStatementHistory",
        "incomeStatementHistoryQuarterly", "balanceSheetHistoryQuarterly",
        "cashflowStatementHistoryQuarterly", "financialData", "defaultKeyStatistics"
    ]

    # Validate types
    invalid_types = [t for t in type_list if t not in valid_types]
    if invalid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid financial data types: {invalid_types}. Valid types are: {valid_types}"
        )

    # Get modules for all symbols
    return ticker.get_modules(type_list)


@router.get("/history")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_multi_history(
        symbols: str = Query(..., description="Comma-separated list of ticker symbols"),
        period: str = Query("1mo", description="1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max"),
        interval: str = Query("1d", description="1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo"),
        start: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
        end: Optional[str] = Query(None, description="End date in YYYY-MM-DD format")
):
    """
    Get historical price data for multiple ticker symbols in a single request.

    Args:
        symbols: Comma-separated list of ticker symbols
        period: Data period
        interval: Data interval
        start: Start date (overrides period if provided)
        end: End date (overrides period if provided)

    Returns:
        Historical price data for all requested symbols
    """
    # Split the symbols string into a list
    symbol_list = [s.strip() for s in symbols.split(",")]

    if len(symbol_list) == 0:
        raise HTTPException(status_code=400, detail="No symbols provided")

    if len(symbol_list) > 50:
        raise HTTPException(status_code=400, detail="Too many symbols. Maximum is 50.")

    # Create a Ticker object with multiple symbols
    ticker = Ticker(symbol_list)

    # If start and end dates are provided, use them instead of period
    if start and end:
        return ticker.history(interval=interval, start=start, end=end)
    else:
        return ticker.history(period=period, interval=interval)