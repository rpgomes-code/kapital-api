import logging
import yfinance as yf

from fastapi import APIRouter
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request
from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yfinance/search", tags=["YFinance Search"])

# Logger for this module
logger = logging.getLogger(__name__)

@router.get("/{query}/all")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_all(query: str):
    """
    Search for all information related to a query string.

    Args:
        query: The search query string

    Returns:
        All available search results including quotes, news, and other information
    """
    return yf.Search(query).all

@router.get("/{query}/lists")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_lists(query: str):
    """
    Search for lists related to a query string.

    Args:
        query: The search query string

    Returns:
        List search results
    """
    return yf.Search(query).lists

@router.get("/{query}/news")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_news(query: str):
    """
    Search for news articles related to a query string.

    Args:
        query: The search query string

    Returns:
        News search results
    """
    return yf.Search(query).news

@router.get("/{query}/quotes")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_quotes(query: str):
    """
    Search for financial quotes related to a query string.

    Args:
        query: The search query string

    Returns:
        Quote search results, typically including matching ticker symbols
    """
    return yf.Search(query).quotes

@router.get("/{query}/research")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_research(query: str):
    """
    Search for research information related to a query string.

    Args:
        query: The search query string

    Returns:
        Research search results
    """
    return yf.Search(query).research

@router.get("/{query}/response")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def search_response(query: str):
    """
    Get the raw search response for a query string.

    Args:
        query: The search query string

    Returns:
        Raw search response data
    """
    return yf.Search(query).response