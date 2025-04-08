from fastapi import APIRouter, HTTPException, Query
import yfinance as yf
import pandas as pd
from datetime import datetime
from typing import List, Optional, Dict, Any
import logging
import asyncio
import json

from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yfinance/ticker/batch", tags=["YFinance Batch Operations"])

# Logger for this module
logger = logging.getLogger(__name__)


@router.get("/info")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_batch_info(
        symbols: str = Query(..., description="Comma-separated list of ticker symbols (max 30)"),
        fields: Optional[str] = Query(None, description="Comma-separated list of specific info fields to retrieve")
):
    """
    Get basic information for multiple ticker symbols efficiently in a single request.

    This endpoint is optimized for retrieving specific information across multiple
    tickers efficiently, reducing the number of API calls required.

    Args:
        symbols: Comma-separated list of ticker symbols (max 30)
        fields: Optional comma-separated list of specific info fields to retrieve

    Returns:
        Dictionary with ticker symbols as keys and their info as values
    """
    # Process symbol list
    symbol_list = [s.strip() for s in symbols.split(",")]

    # Limit number of tickers to prevent abuse
    if len(symbol_list) > 30:
        raise HTTPException(status_code=400, detail="Too many ticker symbols. Maximum allowed is 30.")

    # Process fields list if provided
    field_list = None
    if fields:
        field_list = [f.strip() for f in fields.split(",")]

    # Create Tickers object and fetch data
    tickers = yf.Tickers(" ".join(symbol_list))

    result = {}
    for symbol in symbol_list:
        try:
            # Get ticker info
            ticker_info = tickers.tickers[symbol].info if symbol in tickers.tickers else {}

            # Filter by requested fields if specified
            if field_list and ticker_info:
                ticker_info = {k: v for k, v in ticker_info.items() if k in field_list}

            result[symbol] = ticker_info
        except Exception as e:
            logger.error(f"Error fetching info for {symbol}: {str(e)}")
            result[symbol] = {"error": f"Failed to retrieve info: {str(e)}"}

    return result


@router.get("/history")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_batch_history(
        symbols: str = Query(..., description="Comma-separated list of ticker symbols (max 20)"),
        period: str = Query("1mo", description="Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)"),
        interval: str = Query("1d",
                              description="Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)"),
        start: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
        end: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
        group_by: str = Query("ticker", description="Group by 'column' or 'ticker'"),
        auto_adjust: bool = Query(True, description="Adjust all OHLC automatically"),
        actions: bool = Query(True, description="Include dividends and stock splits"),
        prepost: bool = Query(False, description="Include pre and post market data")
):
    """
    Get historical price data for multiple ticker symbols efficiently in a single request.

    This endpoint leverages yfinance's download functionality for optimal performance
    when fetching historical data for multiple tickers simultaneously.

    Args:
        symbols: Comma-separated list of ticker symbols (max 20)
        period: Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
        interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
        start: Start date in YYYY-MM-DD format
        end: End date in YYYY-MM-DD format
        group_by: Group by 'column' or 'ticker'
        auto_adjust: Adjust all OHLC automatically
        actions: Include dividends and stock splits
        prepost: Include pre and post market data

    Returns:
        Dictionary with ticker symbols as keys and their historical data as values
    """
    # Process symbol list
    symbol_list = [s.strip() for s in symbols.split(",")]

    # Limit number of tickers to prevent abuse
    if len(symbol_list) > 20:
        raise HTTPException(status_code=400, detail="Too many ticker symbols. Maximum allowed is 20.")

    # Convert string dates to datetime if provided
    start_date = None
    end_date = None

    if start:
        try:
            start_date = datetime.strptime(start, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start date format. Use YYYY-MM-DD.")

    if end:
        try:
            end_date = datetime.strptime(end, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end date format. Use YYYY-MM-DD.")

    # Download data using efficient yfinance download function
    data = yf.download(
        tickers=symbol_list,
        period=period,
        interval=interval,
        start=start_date,
        end=end_date,
        group_by=group_by,
        auto_adjust=auto_adjust,
        actions=actions,
        prepost=prepost,
        threads=True,  # Use threads for optimal performance
        progress=False  # Disable progress bar in API context
    )

    # Check if data is empty
    if isinstance(data, pd.DataFrame) and data.empty:
        return {"error": "No data found for the specified parameters"}

    return data


@router.get("/fast-info")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def get_batch_fast_info(
        symbols: str = Query(..., description="Comma-separated list of ticker symbols (max 50)"),
        fields: Optional[str] = Query(None, description="Comma-separated list of specific fast_info fields to retrieve")
):
    """
    Get frequently accessed information for multiple tickers efficiently.

    This endpoint uses the fast_info property which is optimized for performance
    when retrieving commonly accessed information like price, volume, and market cap.

    Args:
        symbols: Comma-separated list of ticker symbols (max 50)
        fields: Optional comma-separated list of specific fast_info fields to retrieve

    Returns:
        Dictionary with ticker symbols as keys and their fast info as values
    """
    # Process symbol list
    symbol_list = [s.strip() for s in symbols.split(",")]

    # Limit number of tickers to prevent abuse
    if len(symbol_list) > 50:
        raise HTTPException(status_code=400, detail="Too many ticker symbols. Maximum allowed is 50.")

    # Process fields list if provided
    field_list = None
    if fields:
        field_list = [f.strip() for f in fields.split(",")]

    # Create tickers object and fetch data in parallel
    result = {}

    async def get_ticker_fast_info(symbol):
        try:
            ticker = yf.Ticker(symbol)
            fast_info = ticker.fast_info

            # Convert to dictionary
            if hasattr(fast_info, 'to_dict'):
                fast_info_dict = fast_info.to_dict()
            else:
                # Handle case where fast_info might be a different structure
                fast_info_dict = dict((k, getattr(fast_info, k)) for k in dir(fast_info)
                                      if not k.startswith('_') and not callable(getattr(fast_info, k)))

            # Filter by requested fields if specified
            if field_list:
                fast_info_dict = {k: v for k, v in fast_info_dict.items() if k in field_list}

            return symbol, fast_info_dict
        except Exception as e:
            logger.error(f"Error fetching fast_info for {symbol}: {str(e)}")
            return symbol, {"error": f"Failed to retrieve fast_info: {str(e)}"}

    # Run tasks in parallel
    tasks = [get_ticker_fast_info(symbol) for symbol in symbol_list]
    results = await asyncio.gather(*tasks)

    # Process results
    for symbol, data in results:
        result[symbol] = data

    return result