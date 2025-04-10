import yfinance as yf
import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
import logging
from pydantic import BaseModel, Field

from app.models.kapital.indicators import FearGreedResponse, FearGreedValue, RSIResponse, SMAResponse
from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data
from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/kapital/indicators", tags=["Kapital Indicators"])

# Logger for this module
logger = logging.getLogger(__name__)

# RSI - Relative Strength Index

def calculate_rsi(close_prices, period=14):
    """
    Calculate RSI indicator based on Wilder's smoothing method.

    Args:
        close_prices: Pandas Series of closing prices
        period: RSI calculation period (typically 14 days)

    Returns:
        Pandas Series of RSI values
    """
    # Make a copy to avoid modifying the original
    close = close_prices.copy()

    # Calculate price changes
    delta = close.diff()

    # Create gain and loss series
    gain = pd.Series(index=delta.index)
    loss = pd.Series(index=delta.index)

    gain[delta > 0] = delta[delta > 0]
    gain[delta <= 0] = 0

    loss[delta < 0] = -delta[delta < 0]
    loss[delta >= 0] = 0

    # Initialize average gain/loss with SMA for first 'period' elements
    avg_gain = gain.iloc[:period].mean()
    avg_loss = loss.iloc[:period].mean()

    # Create result series
    rsi_values = pd.Series(index=close.index)
    rsi_values.iloc[:period] = 100 - (100 / (1 + (avg_gain / max(avg_loss, 1e-9))))

    # Calculate RSI based on Wilder's smoothing method
    for i in range(period, len(close)):
        avg_gain = ((avg_gain * (period - 1)) + gain.iloc[i]) / period
        avg_loss = ((avg_loss * (period - 1)) + loss.iloc[i]) / period

        if avg_loss == 0:
            rsi_values.iloc[i] = 100
        else:
            rs = avg_gain / avg_loss
            rsi_values.iloc[i] = 100 - (100 / (1 + rs))

    return rsi_values


@router.get("/rsi", response_model=RSIResponse)
@handle_yf_request
@redis_cache(ttl="1 day", invalidate_at_midnight=True)
@clean_yfinance_data
async def get_rsi(
        ticker: str = Query(..., description="Stock ticker symbol (e.g., AAPL, MSFT)"),
        start: str = Query(..., description="Start date in YYYY-MM-DD format"),
        end: str = Query(..., description="End date in YYYY-MM-DD format"),
        period: int = Query(14, description="RSI calculation period (default: 14 days)", ge=1, le=100)
):
    """
    Calculate Relative Strength Index (RSI) for a specific ticker.

    The RSI is a momentum oscillator developed by J. Welles Wilder that measures the speed and
    change of price movements. It oscillates between 0 and 100 and is typically used to identify
    overbought or oversold conditions in a traded security.

    Trading signals based on RSI:
    - RSI values of 70 or above indicate that a security may be **overbought** - potentially overvalued
    - RSI values of 30 or below indicate that a security may be **oversold** - potentially undervalued
    - Divergences between price and RSI can signal potential trend reversals
    - The centerline (50) can act as support/resistance in trending markets

    Parameters:
    - **ticker**: Stock ticker symbol
    - **start**: Start date for historical data (YYYY-MM-DD)
    - **end**: End date for historical data (YYYY-MM-DD)
    - **period**: RSI calculation period (default: 14 days)

    Returns:
    - **RSIResponse**: Object containing the time series of RSI values

    Example response:
    ```json
    {
        "values": [
            {
                "Date": "2023-01-01T00:00:00",
                "RSI": 65.42
            },
            {
                "Date": "2023-01-02T00:00:00",
                "RSI": 68.31
            }
        ]
    }
    ```

    Notes:
    - This implementation uses Wilder's smoothing method for the RSI calculation,
      which is the traditional approach used by most trading platforms
    - The calculation requires at least (period + 1) data points to generate valid RSI values
    - The endpoint automatically fetches additional historical data before the start date
      to ensure accurate RSI calculation for the requested period
    """
    try:
        # Convert string dates to datetime objects
        start_date = datetime.strptime(start, "%Y-%m-%d")
        end_date = datetime.strptime(end, "%Y-%m-%d")

        # Add some buffer days before start date to have enough data for RSI calculation
        buffer_start_date = start_date - timedelta(days=period * 2)

        # Get historical data
        ticker_data = yf.Ticker(ticker)
        history = ticker_data.history(start=buffer_start_date, end=end_date, interval="1d")

        # Check if we have enough data
        if len(history) < period + 1:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough historical data for RSI calculation with period={period}"
            )

        # Calculate RSI
        rsi_values = calculate_rsi(history['Close'], period=period)

        # Create result dataframe with Date and RSI (without including index in response)
        result = pd.DataFrame({
            'Date': history.index,
            'RSI': rsi_values.values
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
        logger.error(f"Error calculating RSI for {ticker}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calculating RSI: {str(e)}")
    
# SMA - Simple Moving Average

def calculate_sma(prices, period=20):
    """
    Calculate Simple Moving Average (SMA) for a series of prices.

    Args:
        prices: Pandas Series of prices
        period: SMA calculation period (typically 20, 50, or 200 days)

    Returns:
        Pandas Series of SMA values
    """
    return prices.rolling(window=period).mean()


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
    
# Fear and Greed Index

def _sanitize_numpy_values(obj):
    """
    Recursively convert NumPy data types to Python native types to ensure JSON serialization works.
    
    Args:
        obj: The object to sanitize
        
    Returns:
        Object with NumPy types converted to Python native types
    """
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return _sanitize_numpy_values(obj.tolist())
    elif isinstance(obj, (list, tuple)):
        return [_sanitize_numpy_values(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: _sanitize_numpy_values(value) for key, value in obj.items()}
    else:
        return obj

def normalize_value(value, min_val, max_val, inverse=False):
    """
    Normalize a value to a 0-100 scale.
    
    Args:
        value: The value to normalize
        min_val: The minimum value in the range
        max_val: The maximum value in the range
        inverse: If True, the output will be inverted (100 becomes 0, 0 becomes 100)
        
    Returns:
        Normalized value from 0-100
    """
    # Handle edge cases
    if max_val == min_val:
        normalized = 50  # Default to neutral if min=max
    else:
        # Restrict to min-max range
        value = max(min(value, max_val), min_val)
        
        # Normalize to 0-100
        normalized = 100 * (value - min_val) / (max_val - min_val)
    
    # Invert if needed (higher values indicate fear instead of greed)
    if inverse:
        normalized = 100 - normalized
        
    return normalized

def calculate_price_momentum(prices, ma_period=50):
    """
    Calculate price momentum component by comparing current price to moving average.
    
    Args:
        prices: Series of closing prices
        ma_period: Moving average period (default: 50 days)
        
    Returns:
        Dictionary with component value and description
    """
    # Calculate moving average
    ma = prices.rolling(window=ma_period).mean()
    
    # Get the latest price and MA
    current_price = prices.iloc[-1]
    current_ma = ma.iloc[-1]
    
    # Calculate percentage difference
    percent_diff = ((current_price / current_ma) - 1) * 100
    
    # Determine historical range for normalization
    hist_diffs = ((prices / ma) - 1) * 100
    hist_diffs = hist_diffs.dropna()
    
    # Use 5th and 95th percentiles to avoid outliers
    min_diff = hist_diffs.quantile(0.05)
    max_diff = hist_diffs.quantile(0.95)
    
    # Normalize to 0-100 scale (higher values = more greed)
    value = normalize_value(percent_diff, min_diff, max_diff, inverse=False)
    
    return {
        "Name": "Price Momentum",
        "Value": value,
        "Description": f"Price vs {ma_period}-day moving average",
        "Weight": 0.25
    }

def calculate_volatility(prices, short_period=20, long_period=100):
    """
    Calculate volatility component by comparing recent volatility to historical.
    
    Args:
        prices: Series of closing prices
        short_period: Recent volatility calculation period
        long_period: Historical volatility calculation period
        
    Returns:
        Dictionary with component value and description
    """
    # Calculate daily returns
    returns = prices.pct_change().dropna()
    
    # Calculate recent volatility (annualized)
    recent_vol = returns[-short_period:].std() * np.sqrt(252) * 100
    
    # Calculate historical volatility
    hist_vol = returns[-long_period:].std() * np.sqrt(252) * 100
    
    # Calculate ratio of recent to historical vol
    vol_ratio = recent_vol / max(hist_vol, 0.001)  # Avoid division by zero
    
    # Determine historical range for this ratio
    rolling_recent_vol = returns.rolling(short_period).std().dropna() * np.sqrt(252) * 100
    rolling_hist_vol = returns.rolling(long_period).std().dropna() * np.sqrt(252) * 100
    
    # Need to align these series
    min_length = min(len(rolling_recent_vol), len(rolling_hist_vol))
    vol_ratios = rolling_recent_vol[-min_length:] / rolling_hist_vol[-min_length:].clip(lower=0.001)
    
    # Use 5th and 95th percentiles for normalization
    min_ratio = vol_ratios.quantile(0.05)
    max_ratio = vol_ratios.quantile(0.95)
    
    # Normalize to 0-100 scale (higher volatility = more fear, so inverse)
    value = normalize_value(vol_ratio, min_ratio, max_ratio, inverse=True)
    
    return {
        "Name": "Volatility",
        "Value": value,
        "Description": f"Recent volatility ({short_period}d) vs historical ({long_period}d)",
        "Weight": 0.25
    }

def calculate_volume_trend(prices, volumes, period=20):
    """
    Calculate volume trend component by comparing recent volume to historical.
    
    Args:
        prices: Series of closing prices
        volumes: Series of trading volumes
        period: Lookback period for volume average
        
    Returns:
        Dictionary with component value and description
    """
    # Calculate the average volume over the lookback period
    avg_volume = volumes.rolling(window=period).mean()
    
    # Recent average volume vs longer-term average
    recent_avg = volumes[-5:].mean()
    longer_term_avg = avg_volume.iloc[-1]
    
    # Calculate ratio
    volume_ratio = recent_avg / max(longer_term_avg, 1)  # Avoid division by zero
    
    # Determine historical range for normalization
    rolling_recent = volumes.rolling(5).mean().dropna()
    rolling_longer = avg_volume.dropna()
    
    # Need to align these series
    min_length = min(len(rolling_recent), len(rolling_longer))
    volume_ratios = rolling_recent[-min_length:] / rolling_longer[-min_length:].clip(lower=1)
    
    # Use 5th and 95th percentiles for normalization
    min_ratio = volume_ratios.quantile(0.05)
    max_ratio = volume_ratios.quantile(0.95)
    
    # Normalize to 0-100 scale (higher volume = more activity/greed)
    value = normalize_value(volume_ratio, min_ratio, max_ratio, inverse=False)
    
    return {
        "Name": "Volume Trend",
        "Value": value,
        "Description": f"Recent volume vs {period}-day average",
        "Weight": 0.15
    }

def calculate_rsi_component(prices, period=14):
    """
    Calculate RSI component for Fear & Greed Index using Wilder's smoothing method.
    
    Args:
        prices: Series of closing prices
        period: RSI calculation period
        
    Returns:
        Dictionary with component value and description
    """
    # Make a copy to avoid modifying the original
    close = prices.copy()
    
    # Calculate price changes
    delta = close.diff()
    
    # Create gain and loss series
    gain = delta.copy()
    loss = delta.copy()
    
    gain[gain < 0] = 0
    loss[loss > 0] = 0
    loss = -loss  # Make losses positive
    
    # First average gain and loss
    first_avg_gain = gain.iloc[1:period+1].mean()
    first_avg_loss = loss.iloc[1:period+1].mean()
    
    # Get WMA gain and loss values
    avg_gain_values = [first_avg_gain]
    avg_loss_values = [first_avg_loss]
    
    # Loop through data points after the initial period
    for i in range(period+1, len(close)):
        # Calculate smoothed averages
        avg_gain = ((period-1) * avg_gain_values[-1] + gain.iloc[i]) / period
        avg_loss = ((period-1) * avg_loss_values[-1] + loss.iloc[i]) / period
        avg_gain_values.append(avg_gain)
        avg_loss_values.append(avg_loss)
    
    # Convert to Series
    avg_gain_series = pd.Series(avg_gain_values, index=close.index[period:])
    avg_loss_series = pd.Series(avg_loss_values, index=close.index[period:])
    
    # Calculate RS and RSI
    rs = avg_gain_series / avg_loss_series.replace(0, 1e-9)  # Avoid division by zero
    rsi = 100 - (100 / (1 + rs))
    
    # If no valid RSI (not enough data), return a neutral value
    if len(rsi) == 0 or pd.isna(rsi.iloc[-1]):
        return {
            "Name": "RSI",
            "Value": 50.0,  # Neutral value
            "Description": f"Relative Strength Index ({period} days) - insufficient data",
            "Weight": 0.20
        }
    
    # RSI is already on a 0-100 scale
    return {
        "Name": "RSI",
        "Value": rsi.iloc[-1],
        "Description": f"Relative Strength Index ({period} days)",
        "Weight": 0.20
    }

def calculate_bollinger_component(prices, period=20, std_dev=2):
    """
    Calculate Bollinger Band Width component for Fear & Greed Index.
    
    Args:
        prices: Series of closing prices
        period: Bollinger band calculation period
        std_dev: Number of standard deviations
        
    Returns:
        Dictionary with component value and description
    """
    # Calculate Bollinger Bands
    rolling_mean = prices.rolling(window=period).mean()
    rolling_std = prices.rolling(window=period).std()
    
    # Calculate band width as percentage of the middle band
    band_width = (rolling_std * std_dev * 2) / rolling_mean * 100
    
    # Get current band width
    current_width = band_width.iloc[-1]
    
    # Determine historical range for normalization
    min_width = band_width.quantile(0.05)
    max_width = band_width.quantile(0.95)
    
    # Normalize to 0-100 scale (wider bands = more volatility = more fear)
    value = normalize_value(current_width, min_width, max_width, inverse=True)
    
    return {
        "Name": "Market Anxiety",
        "Value": value,
        "Description": f"Bollinger Band Width ({period} days, {std_dev} std dev)",
        "Weight": 0.15
    }

def calculate_ticker_fear_greed(ticker_data, start_date, end_date):
    """
    Calculate Fear & Greed Index for a specific ticker.
    
    Args:
        ticker_data: yfinance Ticker object
        start_date: Start date for historical data
        end_date: End date for historical data
        
    Returns:
        Dictionary with component calculations and overall index
    """
    # Get historical data with some buffer for calculations
    buffer_start = start_date - timedelta(days=150)  # Need enough data for longer-term averages
    history = ticker_data.history(start=buffer_start, end=end_date, interval="1d")
    
    # Make sure we have enough data
    if len(history) < 100:
        raise HTTPException(
            status_code=400,
            detail="Not enough historical data for Fear & Greed calculation (need at least 100 days)"
        )
    
    # Calculate components
    components = []
    
    # 1. Price Momentum
    momentum = calculate_price_momentum(history['Close'])
    components.append(momentum)
    
    # 2. Volatility
    volatility = calculate_volatility(history['Close'])
    components.append(volatility)
    
    # 3. Volume Trend (if volume data is available)
    if 'Volume' in history.columns and not history['Volume'].isnull().all():
        volume = calculate_volume_trend(history['Close'], history['Volume'])
        components.append(volume)
    
    # 4. RSI
    rsi = calculate_rsi_component(history['Close'])
    components.append(rsi)
    
    # 5. Bollinger Band Width
    bollinger = calculate_bollinger_component(history['Close'])
    components.append(bollinger)
    
    # Calculate weighted average for the overall index
    total_weight = sum(c["Weight"] for c in components)
    
    # Normalize weights if they don't sum to 1
    if abs(total_weight - 1.0) > 0.001:
        for c in components:
            c["Weight"] = c["Weight"] / total_weight
    
    # Calculate overall index value
    overall_value = sum(c["Value"] * c["Weight"] for c in components)
    
    # Prepare the time series data
    # For simplicity, we'll calculate the index for each day
    date_range = pd.date_range(start=start_date, end=end_date)
    values = []
    
    # Filter history to our actual requested date range - handling timezone differences
    start_ts = pd.Timestamp(start_date)
    end_ts = pd.Timestamp(end_date)
    
    # Convert datetime indices to the same format for comparison
    if history.index.tzinfo is not None:
        # If history has timezone info, make our comparison dates timezone-aware
        if start_ts.tzinfo is None:
            start_ts = start_ts.tz_localize(history.index.tzinfo)
        if end_ts.tzinfo is None:
            end_ts = end_ts.tz_localize(history.index.tzinfo)
    
    history_in_range = history.loc[(history.index >= start_ts) & 
                                   (history.index <= end_ts)]
    
    # For each day in the requested range
    for date in history_in_range.index:
        # Slice data up to this date
        history_to_date = history.loc[history.index <= date]
        
        # Need enough data for calculations
        if len(history_to_date) < 100:
            continue
        
        # Calculate components for this date
        day_components = []
        
        # 1. Price Momentum
        day_momentum = calculate_price_momentum(history_to_date['Close'])
        day_components.append(day_momentum)
        
        # 2. Volatility
        day_volatility = calculate_volatility(history_to_date['Close'])
        day_components.append(day_volatility)
        
        # 3. Volume Trend (if volume data is available)
        if 'Volume' in history_to_date.columns and not history_to_date['Volume'].isnull().all():
            day_volume = calculate_volume_trend(history_to_date['Close'], history_to_date['Volume'])
            day_components.append(day_volume)
        
        # 4. RSI
        day_rsi = calculate_rsi_component(history_to_date['Close'])
        day_components.append(day_rsi)
        
        # 5. Bollinger Band Width
        day_bollinger = calculate_bollinger_component(history_to_date['Close'])
        day_components.append(day_bollinger)
        
        # Calculate weighted average for this day
        day_total_weight = sum(c["Weight"] for c in day_components)
        day_value = sum(c["Value"] * c["Weight"] for c in day_components) / day_total_weight
        
        # Get sentiment label
        sentiment = FearGreedValue.get_sentiment(day_value)
        
        # Add to values list
        values.append({
            "Date": date.to_pydatetime(),
            "Value": round(day_value, 1),
            "Sentiment": sentiment
        })
    
    return {
        "components": components,
        "overall_value": round(overall_value, 1),
        "values": values,
        "sentiment": FearGreedValue.get_sentiment(overall_value)
    }

def calculate_market_fear_greed(start_date, end_date):
    """
    Calculate market-wide Fear & Greed Index.
    
    Args:
        start_date: Start date for historical data
        end_date: End date for historical data
        
    Returns:
        Dictionary with component calculations and overall index
    """
    # We'll use SPY as a proxy for the overall market
    spy_ticker = yf.Ticker("SPY")
    
    # Get VIX data as well for volatility
    vix_ticker = yf.Ticker("^VIX")
    
    # Get historical data with some buffer for calculations
    buffer_start = start_date - timedelta(days=150)
    spy_history = spy_ticker.history(start=buffer_start, end=end_date, interval="1d")
    
    try:
        vix_history = vix_ticker.history(start=buffer_start, end=end_date, interval="1d")
        has_vix = True
    except:
        has_vix = False
    
    # Make sure we have enough data
    if len(spy_history) < 100:
        raise HTTPException(
            status_code=400,
            detail="Not enough historical data for Fear & Greed calculation (need at least 100 days)"
        )
    
    # Calculate components
    components = []
    
    # 1. Market Momentum (using SPY)
    momentum = calculate_price_momentum(spy_history['Close'])
    momentum["Name"] = "Market Momentum"
    momentum["Description"] = "S&P 500 vs 50-day moving average"
    components.append(momentum)
    
    # 2. Market Volatility (using VIX if available)
    if has_vix and len(vix_history) >= 100:
        # VIX is already a fear measure - higher VIX = more fear
        current_vix = vix_history['Close'].iloc[-1]
        
        # Determine historical range for normalization
        min_vix = vix_history['Close'].quantile(0.05)
        max_vix = vix_history['Close'].quantile(0.95)
        
        # Normalize to 0-100 scale (higher VIX = more fear)
        vix_value = normalize_value(current_vix, min_vix, max_vix, inverse=True)
        
        components.append({
            "Name": "Market Volatility",
            "Value": vix_value,
            "Description": "VIX (market volatility index)",
            "Weight": 0.30
        })
    else:
        # Use price volatility from SPY as a backup
        volatility = calculate_volatility(spy_history['Close'])
        volatility["Name"] = "Market Volatility"
        volatility["Weight"] = 0.30
        components.append(volatility)
    
    # 3. SPY RSI component
    rsi = calculate_rsi_component(spy_history['Close'])
    rsi["Name"] = "Market RSI"
    components.append(rsi)
    
    # 4. Market Anxiety (Bollinger Band Width on SPY)
    bollinger = calculate_bollinger_component(spy_history['Close'])
    bollinger["Name"] = "Market Anxiety"
    components.append(bollinger)
    
    # 5. Try to get some sector ETFs to calculate sector divergence
    # This approximates market breadth
    sector_etfs = ["XLK", "XLF", "XLE", "XLV", "XLY", "XLP", "XLI", "XLB", "XLU", "XLRE"]
    
    try:
        # Get data for sector ETFs
        sector_data = yf.download(
            tickers=sector_etfs,
            start=buffer_start,
            end=end_date,
            interval="1d",
            group_by='ticker',
            progress=False
        )
        
        # Calculate 20-day returns for each sector
        sector_returns = {}
        for etf in sector_etfs:
            if etf in sector_data:
                try:
                    if 'Close' in sector_data[etf]:
                        closes = sector_data[etf]['Close']
                        if len(closes) > 20:
                            sector_returns[etf] = (closes.iloc[-1] / closes.iloc[-21] - 1) * 100
                except:
                    pass
        
        # If we have at least 5 sectors, calculate dispersion
        if len(sector_returns) >= 5:
            returns_values = list(sector_returns.values())
            returns_std = np.std(returns_values)
            returns_mean = np.mean(returns_values)
            
            # Coefficient of variation as a measure of dispersion
            dispersion = returns_std / abs(max(returns_mean, 0.1))
            
            # For scaling, we'll assume higher dispersion is associated with fear
            # Use a reasonable range based on historical market behavior
            min_dispersion = 0.2
            max_dispersion = 2.0
            
            # Normalize to 0-100 scale (higher dispersion = more fear)
            dispersion_value = normalize_value(dispersion, min_dispersion, max_dispersion, inverse=True)
            
            components.append({
                "Name": "Sector Divergence",
                "Value": dispersion_value,
                "Description": "Dispersion of sector performance",
                "Weight": 0.20
            })
    except:
        # If sector calculation fails, increase weight of other components
        for c in components:
            c["Weight"] = c["Weight"] * (1 / 0.8)  # Normalize the weights to sum to 1
    
    # Calculate weighted average for the overall index
    total_weight = sum(c["Weight"] for c in components)
    
    # Normalize weights if they don't sum to 1
    if abs(total_weight - 1.0) > 0.001:
        for c in components:
            c["Weight"] = c["Weight"] / total_weight
    
    # Calculate overall index value
    overall_value = sum(c["Value"] * c["Weight"] for c in components)
    
    # Prepare the time series data
    # For market-wide, we'll use a similar approach to the ticker-specific one
    date_range = pd.date_range(start=start_date, end=end_date)
    values = []
    
    # Filter history to our actual requested date range - handling timezone differences
    start_ts = pd.Timestamp(start_date)
    end_ts = pd.Timestamp(end_date)
    
    # Convert datetime indices to the same format for comparison
    if spy_history.index.tzinfo is not None:
        # If history has timezone info, make our comparison dates timezone-aware
        if start_ts.tzinfo is None:
            start_ts = start_ts.tz_localize(spy_history.index.tzinfo)
        if end_ts.tzinfo is None:
            end_ts = end_ts.tz_localize(spy_history.index.tzinfo)
    
    spy_history_in_range = spy_history.loc[(spy_history.index >= start_ts) & 
                                         (spy_history.index <= end_ts)]
    
    # For each day in the requested range
    for date in spy_history_in_range.index:
        # For simplicity, we'll still calculate the full algorithm
        # In a production scenario, you might want to pre-calculate for efficiency
        
        # Slice data up to this date
        spy_to_date = spy_history.loc[spy_history.index <= date]
        
        # Need enough data for calculations
        if len(spy_to_date) < 100:
            continue
        
        if has_vix:
            vix_to_date = vix_history.loc[vix_history.index <= date]
        
        # Calculate components for this date
        day_components = []
        
        # 1. Market Momentum
        day_momentum = calculate_price_momentum(spy_to_date['Close'])
        day_momentum["Name"] = "Market Momentum"
        day_momentum["Description"] = "S&P 500 vs 50-day moving average"
        day_components.append(day_momentum)
        
        # 2. Market Volatility
        if has_vix and len(vix_to_date) >= 100:
            current_vix = vix_to_date['Close'].iloc[-1]
            min_vix = vix_to_date['Close'].quantile(0.05)
            max_vix = vix_to_date['Close'].quantile(0.95)
            vix_value = normalize_value(current_vix, min_vix, max_vix, inverse=True)
            
            day_components.append({
                "Name": "Market Volatility",
                "Value": vix_value,
                "Description": "VIX (market volatility index)",
                "Weight": 0.30
            })
        else:
            day_volatility = calculate_volatility(spy_to_date['Close'])
            day_volatility["Name"] = "Market Volatility"
            day_volatility["Weight"] = 0.30
            day_components.append(day_volatility)
        
        # 3. SPY RSI
        day_rsi = calculate_rsi_component(spy_to_date['Close'])
        day_rsi["Name"] = "Market RSI"
        day_components.append(day_rsi)
        
        # 4. Market Anxiety
        day_bollinger = calculate_bollinger_component(spy_to_date['Close'])
        day_bollinger["Name"] = "Market Anxiety"
        day_components.append(day_bollinger)
        
        # For day-by-day calculation, we'll skip the sector divergence to simplify
        
        # Normalize component weights
        day_total_weight = sum(c["Weight"] for c in day_components)
        for c in day_components:
            c["Weight"] = c["Weight"] / day_total_weight
        
        # Calculate weighted average for this day
        day_value = sum(c["Value"] * c["Weight"] for c in day_components)
        
        # Get sentiment label
        sentiment = FearGreedValue.get_sentiment(day_value)
        
        # Add to values list
        values.append({
            "Date": date.to_pydatetime(),
            "Value": round(day_value, 1),
            "Sentiment": sentiment
        })
    
    return {
        "components": components,
        "overall_value": round(overall_value, 1),
        "values": values,
        "sentiment": FearGreedValue.get_sentiment(overall_value)
    }

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
