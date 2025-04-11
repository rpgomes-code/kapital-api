import logging
import yfinance as yf

from fastapi import (
    APIRouter, 
    HTTPException
)

from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request
from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yfinance/ticker", tags=["YFinance Fund / ETF"])

# Logger for this module
logger = logging.getLogger(__name__)

@router.get("/{ticker}/fund/overview")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_fund_overview(ticker: str):
    """
    Get an overview of a fund or ETF.

    This endpoint provides basic information about the fund, including
    its category, family, and legal type.

    Args:
        ticker: Fund/ETF ticker symbol

    Returns:
        Overview information about the fund/ETF
    """
    fund_data = yf.Ticker(ticker).funds_data
    if fund_data is None:
        raise HTTPException(status_code=404, detail=f"Fund data not found for {ticker}")
    return fund_data.fund_overview

@router.get("/{ticker}/fund/operations")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_fund_operations(ticker: str):
    """
    Get operating data for a fund or ETF.

    This endpoint provides operational metrics such as expense ratio,
    turnover rate, and total net assets.

    Args:
        ticker: Fund/ETF ticker symbol

    Returns:
        Operational metrics for the fund/ETF
    """
    fund_data = yf.Ticker(ticker).funds_data
    if fund_data is None:
        raise HTTPException(status_code=404, detail=f"Fund data not found for {ticker}")
    return fund_data.fund_operations

@router.get("/{ticker}/fund/top-holdings")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_fund_top_holdings(ticker: str):
    """
    Get the top holdings of a fund or ETF.

    This endpoint provides a list of the fund's largest positions,
    including the security name, symbol, and percentage of assets.

    Args:
        ticker: Fund/ETF ticker symbol

    Returns:
        Top holdings of the fund/ETF
    """
    fund_data = yf.Ticker(ticker).funds_data
    if fund_data is None:
        raise HTTPException(status_code=404, detail=f"Fund data not found for {ticker}")
    return fund_data.top_holdings

@router.get("/{ticker}/fund/asset-classes")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_fund_asset_classes(ticker: str):
    """
    Get the asset class breakdown of a fund or ETF.

    This endpoint provides the allocation across major asset classes,
    such as stocks, bonds, cash, and other investments.

    Args:
        ticker: Fund/ETF ticker symbol

    Returns:
        Asset class breakdown of the fund/ETF
    """
    fund_data = yf.Ticker(ticker).funds_data
    if fund_data is None:
        raise HTTPException(status_code=404, detail=f"Fund data not found for {ticker}")
    return fund_data.asset_classes

@router.get("/{ticker}/fund/equity-holdings")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_fund_equity_holdings(ticker: str):
    """
    Get detailed information about the equity holdings of a fund or ETF.

    This endpoint provides metrics such as P/E ratio, P/B ratio, and
    earnings growth for the fund's equity portfolio.

    Args:
        ticker: Fund/ETF ticker symbol

    Returns:
        Equity holdings metrics for the fund/ETF
    """
    fund_data = yf.Ticker(ticker).funds_data
    if fund_data is None:
        raise HTTPException(status_code=404, detail=f"Fund data not found for {ticker}")
    return fund_data.equity_holdings

@router.get("/{ticker}/fund/bond-holdings")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_fund_bond_holdings(ticker: str):
    """
    Get detailed information about the bond holdings of a fund or ETF.

    This endpoint provides metrics such as duration, maturity, and
    credit quality for the fund's bond portfolio.

    Args:
        ticker: Fund/ETF ticker symbol

    Returns:
        Bond holdings metrics for the fund/ETF
    """
    fund_data = yf.Ticker(ticker).funds_data
    if fund_data is None:
        raise HTTPException(status_code=404, detail=f"Fund data not found for {ticker}")
    return fund_data.bond_holdings

@router.get("/{ticker}/fund/bond-ratings")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_fund_bond_ratings(ticker: str):
    """
    Get the bond ratings breakdown of a fund or ETF.

    This endpoint provides the distribution of bond holdings
    across different credit ratings (AAA, AA, A, BBB, etc.).

    Args:
        ticker: Fund/ETF ticker symbol

    Returns:
        Bond ratings breakdown of the fund/ETF
    """
    fund_data = yf.Ticker(ticker).funds_data
    if fund_data is None:
        raise HTTPException(status_code=404, detail=f"Fund data not found for {ticker}")
    return fund_data.bond_ratings

@router.get("/{ticker}/fund/sector-weightings")
@handle_yf_request
@redis_cache(ttl="1 week")
@clean_yfinance_data
async def get_fund_sector_weightings(ticker: str):
    """
    Get the sector weightings of a fund or ETF.

    This endpoint provides the allocation across different market sectors,
    such as technology, healthcare, financials, etc.

    Args:
        ticker: Fund/ETF ticker symbol

    Returns:
        Sector weightings of the fund/ETF
    """
    fund_data = yf.Ticker(ticker).funds_data
    if fund_data is None:
        raise HTTPException(status_code=404, detail=f"Fund data not found for {ticker}")
    return fund_data.sector_weightings