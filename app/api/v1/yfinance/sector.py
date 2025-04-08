from fastapi import APIRouter, HTTPException
import yfinance as yf
import logging

from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yfinance/sector", tags=["YFinance Sector"])

# Logger for this module
logger = logging.getLogger(__name__)


@router.get("/{sector}/industries")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_sector_industries(sector: str):
    """
    Get all industries within the specified sector.

    Args:
        sector: Sector identifier or key

    Returns:
        List of industries within the sector
    """
    return yf.Sector(sector).industries


@router.get("/{sector}/key")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_sector_key(sector: str):
    """
    Get the unique key for the specified sector.

    Args:
        sector: Sector identifier or name

    Returns:
        The sector's unique key
    """
    return yf.Sector(sector).key


@router.get("/{sector}/name")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_sector_name(sector: str):
    """
    Get the display name for the specified sector.

    Args:
        sector: Sector identifier or key

    Returns:
        The sector's display name
    """
    return yf.Sector(sector).name


@router.get("/{sector}/overview")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_sector_overview(sector: str):
    """
    Get a comprehensive overview of the specified sector.

    Args:
        sector: Sector identifier or key

    Returns:
        Overview information about the sector including performance metrics
    """
    return yf.Sector(sector).overview


@router.get("/{sector}/research-reports")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_sector_research_reports(sector: str):
    """
    Get research reports related to the specified sector.

    Args:
        sector: Sector identifier or key

    Returns:
        Research reports for the sector
    """
    return yf.Sector(sector).research_reports


@router.get("/{sector}/symbol")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_sector_symbol(sector: str):
    """
    Get the symbol for the specified sector.

    Args:
        sector: Sector identifier or key

    Returns:
        The sector's symbol
    """
    return yf.Sector(sector).symbol


@router.get("/{sector}/ticker")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_sector_ticker(sector: str):
    """
    Get the ticker for the specified sector.

    Args:
        sector: Sector identifier or key

    Returns:
        The sector's ticker
    """
    return yf.Sector(sector).ticker


@router.get("/{sector}/top-companies")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_sector_top_companies(sector: str):
    """
    Get the top companies in the specified sector.

    Args:
        sector: Sector identifier or key

    Returns:
        List of top companies in the sector
    """
    return yf.Sector(sector).top_companies


@router.get("/{sector}/top-etfs")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_sector_top_etfs(sector: str):
    """
    Get the top ETFs for the specified sector.

    Args:
        sector: Sector identifier or key

    Returns:
        List of top ETFs tracking the sector
    """
    return yf.Sector(sector).top_etfs


@router.get("/{sector}/top-mutual-funds")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_sector_top_mutual_funds(sector: str):
    """
    Get the top mutual funds for the specified sector.

    Args:
        sector: Sector identifier or key

    Returns:
        List of top mutual funds focused on the sector
    """
    return yf.Sector(sector).top_mutual_funds