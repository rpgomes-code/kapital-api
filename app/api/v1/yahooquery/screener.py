from fastapi import APIRouter, HTTPException, Query
from yahooquery import Screener
import logging
from typing import List, Optional, Dict, Any, Union

from app.utils.yahooquery.yahooquery_data_manager import clean_yahooquery_data
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yahooquery.error_handler import handle_yq_request

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yahooquery/screener", tags=["YahooQuery Screener"])

# Logger for this module
logger = logging.getLogger(__name__)


@router.get("/available")
@handle_yq_request
@redis_cache(ttl="1 week", key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_available_screeners():
    """
    Get a list of all available predefined screeners.

    Returns:
        List of available screeners
    """
    return Screener().available_screeners


@router.get("/{scrname}")
@handle_yq_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True, key_prefix="yahooquery:")
@clean_yahooquery_data
async def get_screener(
        scrname: str,
        count: int = Query(25, description="Number of results to return", ge=1, le=250)
):
    """
    Get results for a predefined screener.

    Args:
        scrname: Name of the predefined screener
        count: Number of results to return (max 250)

    Returns:
        Screener results
    """
    try:
        # Create Screener object with specified parameters
        screener = Screener()

        # Get screener results
        return screener.get_screeners(
            screen_ids=[scrname],
            count=count
        )
    except ValueError as e:
        # Handle specific error cases
        error_message = str(e)
        if "not found in list of available screeners" in error_message:
            available = screener.available_screeners
            raise HTTPException(
                status_code=404,
                detail=f"Screener '{scrname}' not found. Available screeners: {available}"
            )
        # Re-raise other errors
        raise