import httpx
import asyncio
import re
import yfinance as yf
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.kapital.image import TickerImageResponse

from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/ticker", tags=["Kapital"])

# Logger for this module
logger = logging.getLogger(__name__)

@router.get("/{ticker}/image", response_model=TickerImageResponse)
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_ticker_image(ticker: str):
    """
    Get a company logo image URL for the specified ticker symbol.
    
    This endpoint dynamically determines the market/exchange and tries multiple 
    sources for company logos, using parallel requests and image validation
    for improved reliability.
    
    Parameters:
    - **ticker**: The stock ticker symbol (e.g., AAPL, MSFT)
    
    Returns:
    - **TickerImageResponse**: Object containing the image URL or null if no image is found
    
    Example response:
    ```json
    {
        "imageUrl": "https://example.com/images/AAPL.png"
    }
    ```
    
    Notes:
    - The endpoint attempts to locate images from over 15 different sources
    - Each image is validated to ensure it's a proper image file (not a 404 page or placeholder)
    - The algorithm uses market/exchange information to find the best match
    - If no valid image is found after trying all sources, imageUrl will be null
    """
    # First, try to get the exchange information from yfinance
    try:
        ticker_obj = yf.Ticker(ticker)
        info = ticker_obj.info

        # Extract exchange, currency and company name information
        exchange = info.get('exchange', '')
        currency = info.get('currency', 'USD')  # Get currency from yfinance

        # Get company names in different formats
        display_name = info.get('displayName', '')
        company_name = info.get('shortName', '') or info.get('longName', '')

        # Format display name for TradingView (lowercase with hyphens)
        display_name_dashed = display_name.lower().replace(' ', '-') if display_name else ''

        # Create URL-friendly version of company name for MarketBeat
        company_name_url = company_name.lower()
        # Replace special characters and spaces with dashes
        company_name_url = re.sub(r'[^a-z0-9]+', '-', company_name_url)
        # Remove leading/trailing dashes
        company_name_url = company_name_url.strip('-')

        market = 'US'  # Default
        exchange_code = 'NASDAQ'  # Default - set this early to ensure it exists even if not matched

        # Map exchange to market code
        if exchange:
            exchange_lower = exchange.lower()
            if 'nasdaq' in exchange_lower:
                market = 'US'
                exchange_code = 'NASDAQ'
            elif 'nyse' in exchange_lower:
                market = 'US'
                exchange_code = 'NYSE'
            elif 'lse' in exchange_lower or 'london' in exchange_lower:
                market = 'UK'
                exchange_code = 'LSE'
            elif 'tsx' in exchange_lower or 'toronto' in exchange_lower:
                market = 'CA'
                exchange_code = 'TSX'
            elif 'asx' in exchange_lower or 'australia' in exchange_lower:
                market = 'AU'
                exchange_code = 'ASX'
            elif 'bse' in exchange_lower or 'bombay' in exchange_lower:
                market = 'IN'
                exchange_code = 'BSE'
            elif 'nse' in exchange_lower or 'national stock exchange' in exchange_lower:
                market = 'IN'
                exchange_code = 'NSE'
            elif 'hkex' in exchange_lower or 'hong kong' in exchange_lower:
                market = 'HK'
                exchange_code = 'HKEX'
            elif 'shanghai' in exchange_lower or 'shenzhen' in exchange_lower:
                market = 'CN'
                exchange_code = 'SSE'
            elif 'tse' in exchange_lower or 'tokyo' in exchange_lower:
                market = 'JP'
                exchange_code = 'TSE'
            elif 'krx' in exchange_lower or 'korea exchange' in exchange_lower:
                market = 'KR'
                exchange_code = 'KRX'
            elif 'sgx' in exchange_lower or 'singapore' in exchange_lower:
                market = 'SG'
                exchange_code = 'SGX'
            elif 'b3' in exchange_lower or 'brazil' in exchange_lower:
                market = 'BR'
                exchange_code = 'B3'
            elif 'jse' in exchange_lower or 'johannesburg' in exchange_lower:
                market = 'ZA'
                exchange_code = 'JSE'
            elif 'bmv' in exchange_lower or 'mexico' in exchange_lower:
                market = 'MX'
                exchange_code = 'BMV'
            elif 'bvc' in exchange_lower or 'colombia' in exchange_lower:
                market = 'CO'
                exchange_code = 'BVC'
            elif 'buenos aires' in exchange_lower or 'argentina' in exchange_lower:
                market = 'AR'
                exchange_code = 'BYMA'
            elif 'bursa' in exchange_lower or 'malaysia' in exchange_lower:
                market = 'MY'
                exchange_code = 'BURSA'
            elif 'nzx' in exchange_lower or 'new zealand' in exchange_lower:
                market = 'NZ'
                exchange_code = 'NZX'
            elif 'egx' in exchange_lower or 'egypt' in exchange_lower:
                market = 'EG'
                exchange_code = 'EGX'
            elif 'bahrain' in exchange_lower:
                market = 'BH'
                exchange_code = 'BSE'
            elif 'muscat' in exchange_lower or 'oman' in exchange_lower:
                market = 'OM'
                exchange_code = 'MSM'
            elif 'tadawul' in exchange_lower or 'saudi' in exchange_lower:
                market = 'SA'
                exchange_code = 'TADAWUL'
            elif 'dubai' in exchange_lower or 'dfm' in exchange_lower:
                market = 'AE'
                exchange_code = 'DFM'
            elif 'adx' in exchange_lower or 'abu dhabi' in exchange_lower:
                market = 'AE'
                exchange_code = 'ADX'
            elif 'nairobi' in exchange_lower or 'kenya' in exchange_lower:
                market = 'KE'
                exchange_code = 'NSE'
            elif 'nigeria' in exchange_lower:
                market = 'NG'
                exchange_code = 'NSE'
            elif 'bist' in exchange_lower or 'istanbul' in exchange_lower:
                market = 'TR'
                exchange_code = 'BIST'
            elif 'bvc' in exchange_lower or 'colombia' in exchange_lower:
                market = 'CO'
                exchange_code = 'BVC'
            elif 'euronext lisbon' in exchange_lower or 'lisbon' in exchange_lower or 'portugal' in exchange_lower:
                market = 'PT'
                exchange_code = 'EURONEXT'
            # Add more exchange mappings as needed
    except Exception as e:
        logger.debug(f"Failed to get exchange info for {ticker}: {str(e)}")
        market = 'US'  # Default to US market if we can't determine
        exchange_code = 'NASDAQ'
        currency = 'USD'  # Default to USD if we can't determine
        company_name_url = ticker.lower()  # Default to lowercase ticker if we can't get company name
        display_name_dashed = ticker.lower()  # Default to lowercase ticker for TradingView URLs

    # Process ticker for different formats
    ticker_upper = ticker.upper()
    ticker_lower = ticker.lower()
    market_lower = market.lower()

    # List of potential image URLs to try with dynamic market
    urls = [
        # Broker logos
        f"https://etoro-cdn.etorostatic.com/market-avatars/{ticker_lower}/150x150.png",
        f"https://logos.m1.com/{ticker_upper}",
        f"https://logos.xtb.com/{ticker_lower}_{market_lower}.svg",
        f"https://trading212equities.s3.eu-central-1.amazonaws.com/{ticker_upper}_{market}_EQ.png",
        f"https://cdn.plus500.com/Media/Apps/cfd_invest/Stocks/{ticker_upper}_border.png",

        # TradingView logos using company display name instead of ticker
        f"https://s3-symbol-logo.tradingview.com/{display_name_dashed}--big.svg",
        f"https://s3-symbol-logo.tradingview.com/{display_name_dashed}.svg",

        # Financial data providers
        f"https://financialmodelingprep.com/image-stock/{ticker_upper}.png",
        f"https://storage.googleapis.com/iex/api/logos/{ticker_upper}.png",
        f"https://storage.googleapis.com/iexcloud-hl37opg/api/logos/{ticker_upper}.png",

        # URLs with dynamic market
        f"https://eodhistoricaldata.com/img/logos/{market}/{ticker_lower}.png",
        f"https://eodhd.com/img/logos/{market}/{ticker_upper}.png",
        f"https://static.stocktitan.net/company-logo/{ticker_lower}.png",
        f"https://companiesmarketcap.com/img/company-logos/256/{ticker_upper}.png",
        f"https://assets-netstorage.groww.in/intl-stocks/logos/{ticker_upper}.png",

        # Snowball Analytics with dynamic currency instead of market
        f"https://cdn.snowball-analytics.com/asset-logos/{ticker_upper}-{exchange_code}-{currency}.png",
        f"https://cdn.snowball-analytics.com/asset-logos/{ticker_upper}-{exchange_code}-{currency}-custom.png",

        # Various other sources
        f"https://assets.parqet.com/logos/symbol/{ticker_upper}",

        # MarketBeat URL using company name instead of ticker
        f"https://www.marketbeat.com/logos/thumbnail/{company_name_url}-logo.png",

        # GitHub repository
        f"https://github.com/davidepalazzo/ticker-logos/blob/main/ticker_icons/{ticker_upper}.png",
    ]

    # Define a function to validate an image URL
    async def validate_image_url(url: str, client: httpx.AsyncClient) -> Optional[str]:
        """
        Validates if a URL contains an actual image by checking Content-Type and status code.

        Args:
            url: URL to check
            client: httpx.AsyncClient instance to use for the request

        Returns:
            The URL if it's a valid image, None otherwise
        """
        try:
            # Use GET instead of HEAD to get headers including Content-Type
            response = await client.get(url, timeout=3.0, follow_redirects=True)

            # Check status code first
            if response.status_code != 200:
                return None

            # Check for image content type
            content_type = response.headers.get('Content-Type', '')
            if not content_type.startswith('image/'):
                logger.debug(f"URL {url} returned non-image Content-Type: {content_type}")
                return None

            # Check for minimum content length to avoid empty images or tiny placeholders
            content_length = int(response.headers.get('Content-Length', '0'))
            if content_length < 100:  # Arbitrary minimum size for a real logo
                logger.debug(f"URL {url} has suspiciously small image size: {content_length} bytes")
                return None

            # If all checks pass, return the URL
            logger.debug(f"Valid image found at {url} ({content_type}, {content_length} bytes)")
            return url

        except Exception as e:
            logger.debug(f"Failed to validate image from {url}: {str(e)}")
            return None

    # Check all URLs in parallel
    async with httpx.AsyncClient() as client:
        # Create tasks for all URLs
        tasks = [validate_image_url(url, client) for url in urls]

        # Wait for all tasks to complete (will complete in the order they finish)
        for result in asyncio.as_completed(tasks):
            valid_url = await result
            if valid_url:
                return {"imageUrl": valid_url}

    # If no valid URL is found, return null
    return {"imageUrl": None}