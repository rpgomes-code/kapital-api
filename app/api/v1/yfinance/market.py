from fastapi import APIRouter, HTTPException
import yfinance as yf
import logging

from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yfinance/market", tags=["YFinance Market"])

# Logger for this module
logger = logging.getLogger(__name__)


@router.get("/{market}/status")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def get_market_status(market: str):
    """
    Get the current status of the specified market.

    Args:
        market: Market identifier (e.g., us, uk, hk)

    Returns:
        Market status information including whether it's open or closed
    """
    return yf.Market(market).status


@router.get("/{market}/summary")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def get_market_summary(market: str):
    """
    Get a summary of the specified market.

    Args:
        market: Market identifier (e.g., us, uk, hk)

    Returns:
        Market summary information including major indices and trends
    """
    return yf.Market(market).summary