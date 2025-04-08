from fastapi import APIRouter, HTTPException, Query
import yfinance as yf
import pandas as pd
import logging
from typing import Optional
from datetime import datetime

from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yfinance", tags=["YFinance Download"])

# Logger for this module
logger = logging.getLogger(__name__)

@router.get("/download")
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def download_data(
        symbols: str = Query(..., description="Comma-separated list of ticker symbols (max 20)"),
        period: str = Query("1mo", description="Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)"),
        interval: str = Query("1d",
                              description="Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)"),
        start: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
        end: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
        group_by: str = Query("column", description="Group by 'column' or 'ticker'"),
        auto_adjust: bool = Query(True, description="Adjust all OHLC automatically"),
        back_adjust: bool = Query(False, description="Back-adjust data based on forward dividends adjustment"),
        actions: bool = Query(True, description="Include dividends and stock splits"),
        prepost: bool = Query(False, description="Include pre and post market data"),
        threads: bool = Query(True, description="Use threads for mass downloading"),
        repair: bool = Query(False, description="Repair missing data"),
        rounding: bool = Query(False, description="Round values to 2 decimal places"),
        timeout: Optional[int] = Query(None, description="Timeout in seconds")
):
    """
    Download historical price data for multiple ticker symbols at once.

    This endpoint is a direct wrapper around the yfinance.download() function,
    which is more efficient for downloading data for multiple tickers than
    calling the history endpoint for each ticker separately.

    Args:
        symbols: Comma-separated list of ticker symbols (max 20)
        period: Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
        interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
        start: Start date in YYYY-MM-DD format
        end: End date in YYYY-MM-DD format
        group_by: Group by 'column' or 'ticker'
        auto_adjust: Adjust all OHLC automatically
        back_adjust: Back-adjust data based on forward dividends adjustment
        actions: Include dividends and stock splits
        prepost: Include pre and post market data
        threads: Use threads for mass downloading
        repair: Repair missing data
        rounding: Round values to 2 decimal places
        timeout: Timeout in seconds

    Returns:
        Historical price data for the specified tickers.
        If group_by='column', the result is a multi-level dataframe with tickers as the top level.
        If group_by='ticker', the result is a dict of dataframes, with each ticker as a key.
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

    # Download data
    data = yf.download(
        tickers=symbol_list,
        period=period,
        interval=interval,
        start=start_date,
        end=end_date,
        group_by=group_by,
        auto_adjust=auto_adjust,
        back_adjust=back_adjust,
        actions=actions,
        prepost=prepost,
        threads=threads,
        repair=repair,
        rounding=rounding,
        timeout=timeout
    )

    # Check if data is empty
    if isinstance(data, pd.DataFrame) and data.empty:
        return {"error": "No data found for the specified parameters"}

    return data