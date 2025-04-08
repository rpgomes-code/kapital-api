from fastapi import APIRouter, HTTPException
import yfinance as yf
import logging

from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yfinance/industry", tags=["YFinance Industry"])

# Logger for this module
logger = logging.getLogger(__name__)


@router.get("/{industry}/key")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_key(industry: str):
    """
    Get the unique key for the specified industry.

    Args:
        industry: Industry identifier or name

    Returns:
        The industry's unique key
    """
    return yf.Industry(industry).key


@router.get("/{industry}/name")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_name(industry: str):
    """
    Get the display name for the specified industry.

    Args:
        industry: Industry identifier or key

    Returns:
        The industry's display name
    """
    return yf.Industry(industry).name


@router.get("/{industry}/overview")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_industry_overview(industry: str):
    """
    Get a comprehensive overview of the specified industry.

    Args:
        industry: Industry identifier or key

    Returns:
        Overview information about the industry including performance metrics
    """
    return yf.Industry(industry).overview


@router.get("/{industry}/research-reports")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_industry_research_reports(industry: str):
    """
    Get research reports related to the specified industry.

    Args:
        industry: Industry identifier or key

    Returns:
        Research reports for the industry
    """
    return yf.Industry(industry).research_reports


@router.get("/{industry}/sector-key")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_sector_key(industry: str):
    """
    Get the sector key that this industry belongs to.

    Args:
        industry: Industry identifier or key

    Returns:
        The parent sector's key
    """
    return yf.Industry(industry).sector_key


@router.get("/{industry}/sector-name")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_sector_name(industry: str):
    """
    Get the sector name that this industry belongs to.

    Args:
        industry: Industry identifier or key

    Returns:
        The parent sector's name
    """
    return yf.Industry(industry).sector_name


@router.get("/{industry}/symbol")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_symbol(industry: str):
    """
    Get the symbol for the specified industry.

    Args:
        industry: Industry identifier or key

    Returns:
        The industry's symbol
    """
    return yf.Industry(industry).symbol


@router.get("/{industry}/ticker")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_industry_ticker(industry: str):
    """
    Get the ticker for the specified industry.

    Args:
        industry: Industry identifier or key

    Returns:
        The industry's ticker
    """
    return yf.Industry(industry).ticker


@router.get("/{industry}/top-companies")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_industry_top_companies(industry: str):
    """
    Get the top companies in the specified industry.

    Args:
        industry: Industry identifier or key

    Returns:
        List of top companies in the industry
    """
    return yf.Industry(industry).top_companies


@router.get("/{industry}/top-growth-companies")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_industry_top_growth_companies(industry: str):
    """
    Get the top growth companies in the specified industry.

    Args:
        industry: Industry identifier or key

    Returns:
        List of top growth companies in the industry, sorted by growth metrics
    """
    return yf.Industry(industry).top_growth_companies


@router.get("/{industry}/top-performing-companies")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_industry_top_performing_companies(industry: str):
    """
    Get the top performing companies in the specified industry.

    Args:
        industry: Industry identifier or key

    Returns:
        List of top performing companies in the industry, sorted by performance metrics
    """
    return yf.Industry(industry).top_performing_companies