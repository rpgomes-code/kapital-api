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