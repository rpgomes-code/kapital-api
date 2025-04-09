from fastapi import APIRouter, HTTPException, Query
from yahooquery import Ticker, Tickers, search, get_trending
import logging
from typing import List, Optional, Dict, Any, Union

from app.utils.yahooquery.yahooquery_data_manager import clean_yahooquery_data
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yahooquery.error_handler import handle_yq_request

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yahooquery", tags=["YahooQuery Miscellaneous"])

# Logger for this module
logger = logging.getLogger(__name__)


@router.get("/search")
@handle_yq_request
@redis_cache(ttl="30 minutes", key_prefix="yahooquery:")
@clean_yahooquery_data
async def search_tickers(
        query: str = Query(..., description="Search query string"),
        count: int = Query(10, description="Number of results to return", ge=1, le=50),
        news_count: int = Query(0, description="Number of news items to return", ge=0, le=10),
        quotes_count: int = Query(5, description="Number of quotes to return", ge=0, le=20),
):
    """
    Search for ticker symbols, companies, etc.

    Args:
        query: Search query string
        count: Number of results to return
        news_count: Number of news items to include
        quotes_count: Number of quotes to include

    Returns:
        Search results
    """
    return search(
        query,
        count=count,
        news_count=news_count,
        quotes_count=quotes_count
    )


@router.get("/trending")
@handle_yq_request
@redis_cache(ttl="30 minutes", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_trending_tickers(
        country: str = Query("united states", description="Country for trending data"),
        count: int = Query(20, description="Number of trending tickers to return", ge=1, le=50),
):
    """
    Get trending tickers for a specified country.

    Args:
        country: Country for trending data
        count: Number of trending tickers to return

    Returns:
        Trending tickers
    """
    return get_trending(country=country, count=count)


@router.get("/market-summary")
@handle_yq_request
@redis_cache(ttl="30 minutes", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_market_summary():
    """
    Get a summary of market performance across major indices.

    Returns:
        Market summary data
    """
    # Create a Tickers object with major indices
    indices = Tickers([
        "^GSPC",  # S&P 500
        "^DJI",  # Dow Jones Industrial Average
        "^IXIC",  # NASDAQ Composite
        "^RUT",  # Russell 2000
        "^FTSE",  # FTSE 100
        "^N225",  # Nikkei 225
        "^HSI",  # Hang Seng Index
        "^GDAXI",  # DAX
    ])

    # Get quotes for these indices
    return indices.quotes


@router.get("/currencies")
@handle_yq_request
@redis_cache(ttl="1 day", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_currency_data(
        base_currency: str = Query("USD", description="Base currency code"),
):
    """
    Get exchange rates for a base currency against major world currencies.

    Args:
        base_currency: Base currency code (e.g., USD, EUR, GBP)

    Returns:
        Currency exchange rate data
    """
    # Create forex pairs
    pairs = [
        f"{base_currency}EUR=X",  # Euro
        f"{base_currency}JPY=X",  # Japanese Yen
        f"{base_currency}GBP=X",  # British Pound
        f"{base_currency}CAD=X",  # Canadian Dollar
        f"{base_currency}CHF=X",  # Swiss Franc
        f"{base_currency}AUD=X",  # Australian Dollar
        f"{base_currency}NZD=X",  # New Zealand Dollar
        f"{base_currency}CNY=X",  # Chinese Yuan
        f"{base_currency}HKD=X",  # Hong Kong Dollar
        f"{base_currency}SGD=X",  # Singapore Dollar
    ]

    # Get quotes for these currency pairs
    tickers = Tickers(pairs)
    return tickers.quotes


@router.get("/market-movers")
@handle_yq_request
@redis_cache(ttl="30 minutes", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_market_movers(
        category: str = Query(
            "day_gainers",
            description="Category of market movers (day_gainers, day_losers, most_actives)"
        ),
        count: int = Query(20, description="Number of results to return", ge=1, le=50),
):
    """
    Get market movers (gainers, losers, most active) for a specific category.

    Args:
        category: Category of market movers (day_gainers, day_losers, most_actives)
        count: Number of results to return

    Returns:
        Market mover data
    """
    # Validate category
    valid_categories = ["day_gainers", "day_losers", "most_actives"]
    if category not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{category}'. Must be one of: {valid_categories}"
        )

    # Create a Screener object for the specified category
    from yahooquery import Screener
    screener = Screener()

    # Get screener results
    return screener.get_screeners(
        screeners=[category],
        count=count
    )