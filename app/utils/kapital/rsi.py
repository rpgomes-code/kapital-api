import pandas as pd

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
