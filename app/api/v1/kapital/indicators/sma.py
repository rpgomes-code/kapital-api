import logging
import pandas as pd
import yfinance as yf

from datetime import (
    datetime, 
    timedelta
)
from fastapi import (
    APIRouter, 
    HTTPException, 
    Query
)

from app.models.kapital.indicators import SMAResponse

from app.utils.kapital.sma import calculate_sma
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request
from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/kapital/indicators", tags=["Kapital Indicators"])

# Logger for this module
logger = logging.getLogger(__name__)

# SMA - Simple Moving Average
@router.get("/sma", response_model=SMAResponse)
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_sma(
        ticker: str = Query(..., description="Stock ticker symbol (e.g., AAPL, MSFT)"),
        start: str = Query(..., description="Start date in YYYY-MM-DD format"),
        end: str = Query(..., description="End date in YYYY-MM-DD format"),
        period: int = Query(20, description="SMA calculation period (default: 20 days)", ge=1, le=200)
):
    """
    Calculate Simple Moving Average (SMA) for a specific ticker.

    The SMA is a widely used indicator that helps smooth out price action by filtering out the "noise" 
    from random price fluctuations. It's calculated by averaging a stock's price over a specific period.

    Trading signals based on SMA:
    - When price crosses above SMA: Potential bullish signal
    - When price crosses below SMA: Potential bearish signal
    - Multiple SMAs can be used together - when shorter-term SMA crosses above longer-term SMA: bullish signal (golden cross)
    - When shorter-term SMA crosses below longer-term SMA: bearish signal (death cross)
    - SMAs can also act as support or resistance levels

    Common SMA periods:
    - 20-day SMA: Short-term trend
    - 50-day SMA: Medium-term trend
    - 200-day SMA: Long-term trend

    Parameters:
    - **ticker**: Stock ticker symbol
    - **start**: Start date for historical data (YYYY-MM-DD)
    - **end**: End date for historical data (YYYY-MM-DD)
    - **period**: SMA calculation period (default: 20 days)

    Returns:
    - **SMAResponse**: Object containing the time series of SMA values

    Example response:
    ```json
    {
        "values": [
            {
                "Date": "2023-01-21T00:00:00",
                "SMA": 155.42
            },
            {
                "Date": "2023-01-22T00:00:00",
                "SMA": 156.31
            }
        ]
    }
    ```

    Notes:
    - The calculation requires at least 'period' data points to generate valid SMA values
    - The endpoint automatically fetches additional historical data before the start date
      to ensure accurate SMA calculation for the requested period
    """
    try:
        # Convert string dates to datetime objects
        start_date = datetime.strptime(start, "%Y-%m-%d")
        end_date = datetime.strptime(end, "%Y-%m-%d")

        # Add some buffer days before start date to have enough data for SMA calculation
        buffer_start_date = start_date - timedelta(days=period * 2)

        # Get historical data
        ticker_data = yf.Ticker(ticker)
        history = ticker_data.history(start=buffer_start_date, end=end_date, interval="1d")

        # Check if we have enough data
        if len(history) < period:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough historical data for SMA calculation with period={period}"
            )

        # Calculate SMA
        sma_values = calculate_sma(history['Close'], period=period)

        # Create result dataframe with Date and SMA (without including index in response)
        result = pd.DataFrame({
            'Date': history.index,
            'SMA': sma_values.values
        }, index=None)

        # Filter for the requested date range (remove buffer period)
        # Convert dates to timezone-naive for consistent comparison
        start_ts = pd.Timestamp(start_date).tz_localize(None)
        end_ts = pd.Timestamp(end_date).tz_localize(None)

        # For comparison, make the Date column timezone-naive if it has timezone info
        if result['Date'].dt.tz is not None:
            date_filter = result['Date'].dt.tz_localize(None)
            result = result[(date_filter >= start_ts) & (date_filter <= end_ts)]
        else:
            result = result[(result['Date'] >= start_ts) & (result['Date'] <= end_ts)]

        # Handle any NaN values
        result = result.dropna()

        # Convert to records and explicitly reset index to avoid it being included in the output
        result_records = result.reset_index(drop=True).to_dict(orient='records')

        # Wrap in the values field for our Pydantic model
        return {"values": result_records}

    except Exception as e:
        logger.error(f"Error calculating SMA for {ticker}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calculating SMA: {str(e)}")