import logging
import yfinance as yf

from typing import Optional

from datetime import datetime

from fastapi import (
    APIRouter, 
    HTTPException, 
    Query
)

from app.models.kapital.indicators import FearGreedResponse

from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request
from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data

from app.utils.kapital.fear_greed import (
    _sanitize_numpy_values, 
    calculate_market_fear_greed, 
    calculate_ticker_fear_greed
)

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/kapital/indicators", tags=["Kapital Indicators"])

# Logger for this module
logger = logging.getLogger(__name__)
  
# Fear and Greed Index
@router.get("/fear-greed", response_model=FearGreedResponse)
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_fear_greed_index(
        ticker: Optional[str] = Query(None, description="Stock ticker symbol (e.g., AAPL, MSFT). If omitted, returns market-wide index"),
        start: str = Query(..., description="Start date in YYYY-MM-DD format"),
        end: str = Query(..., description="End date in YYYY-MM-DD format"),
        include_components: bool = Query(False, description="Include individual components in the response")
):
    """
    Calculate Fear & Greed Index for a specific ticker or the overall market.
    
    The Fear & Greed Index is a composite indicator that measures market sentiment
    on a scale from 0 (Extreme Fear) to 100 (Extreme Greed). It combines multiple
    technical indicators to provide a comprehensive view of market psychology.
    
    When applied to individual stocks, it measures sentiment specific to that ticker.
    When no ticker is specified, it calculates a market-wide sentiment index similar
    to CNN's Fear & Greed Index.
    
    Components typically include:
    - Price momentum (current price vs moving averages)
    - Market volatility (VIX or price volatility)
    - Breadth (for market-wide) or volume trends (for individual tickers)
    - RSI (overbought/oversold conditions)
    - Bollinger Band Width (market anxiety)
    
    Parameters:
    - **ticker**: Stock ticker symbol (optional - if omitted, returns market-wide index)
    - **start**: Start date for historical data (YYYY-MM-DD)
    - **end**: End date for historical data (YYYY-MM-DD)
    - **include_components**: Include individual components in the response
    
    Returns:
    - **FearGreedResponse**: Object containing the index values and components
      - **values**: Time series of daily Fear & Greed values
      - **current_value**: Most recent Fear & Greed Index value
      - **current_sentiment**: Sentiment label based on the current value
      - **components**: Individual components that make up the index (if requested)
      - **is_market_wide**: Whether this is a market-wide or ticker-specific index
    
    Example response:
    ```json
    {
        "values": [
            {
                "Date": "2023-02-01T00:00:00",
                "Value": 25.4,
                "Sentiment": "Fear"
            },
            {
                "Date": "2023-02-02T00:00:00",
                "Value": 32.1,
                "Sentiment": "Fear"
            }
        ],
        "current_value": 32.1,
        "current_sentiment": "Fear",
        "components": [
            {
                "Name": "Price Momentum",
                "Value": 45.2,
                "Description": "Price vs 50-day moving average",
                "Weight": 0.25
            }
        ],
        "is_market_wide": false
    }
    ```
    
    Notes:
    - The calculation requires at least 100 days of historical data
    - The endpoint automatically fetches additional data before the start date
      to ensure accurate calculation for the requested period
    - Values are on a scale of 0-100 where:
      - 0-20: Extreme Fear
      - 21-40: Fear
      - 41-60: Neutral
      - 61-80: Greed
      - 81-100: Extreme Greed
    """
    try:
        # Convert string dates to datetime objects
        start_date = datetime.strptime(start, "%Y-%m-%d")
        end_date = datetime.strptime(end, "%Y-%m-%d")
        
        # Calculate the index
        if ticker:
            # Ticker-specific Fear & Greed Index
            ticker_data = yf.Ticker(ticker)
            result = calculate_ticker_fear_greed(ticker_data, start_date, end_date)
            is_market_wide = False
        else:
            # Market-wide Fear & Greed Index
            result = calculate_market_fear_greed(start_date, end_date)
            is_market_wide = True
        
        # Extract data for response
        values = result["values"]
        overall_value = result["overall_value"]
        sentiment = result["sentiment"]
        
        # Prepare response
        response = {
            "values": values,
            "current_value": overall_value,
            "current_sentiment": sentiment,
            "is_market_wide": is_market_wide
        }
        
        # Include components if requested
        if include_components:
            response["components"] = result["components"]
        
        # Sanitize NumPy values before returning to ensure proper caching
        response = _sanitize_numpy_values(response)
        
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating Fear & Greed Index: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calculating Fear & Greed Index: {str(e)}")
