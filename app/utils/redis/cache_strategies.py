"""
Cache strategies for yfinance and yahooquery API endpoints.
This module centralizes all caching TTLs and invalidation rules.
"""

# Main yfinance cache strategy mapping
CACHE_STRATEGIES = {
    "ticker": {
        "actions": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "analyst-price-targets": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "balance-sheet": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "balancesheet": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "basic-info": {"ttl": "3 months", "invalidates": "never"},
        "calendar": {"ttl": "1 week", "invalidates": "never"},
        "capital-gains": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "cash-flow": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "cashflow": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "dividends": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "earnings": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "earnings-dates": {"ttl": "1 week", "invalidates": "never"},
        "earnings-estimate": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "earnings-history": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "eps-revisions": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "eps-trend": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "fast-info": {"ttl": "3 months", "invalidates": "never"},
        "financials": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "funds-data": {"ttl": "1 week", "invalidates": "never"},
        "growth-estimates": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "history": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "history-metadata": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "income-stmt": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "incomestmt": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "info": {"ttl": "3 months", "invalidates": "never"},
        "insider-purchases": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "insider-roster-holders": {"ttl": "1 week", "invalidates": "never"},
        "insider-transactions": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "institutional-holders": {"ttl": "1 week", "invalidates": "never"},
        "isin": {"ttl": "3 months", "invalidates": "never"},
        "major-holders": {"ttl": "1 week", "invalidates": "never"},
        "mutualfund-holders": {"ttl": "1 week", "invalidates": "never"},
        "news": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "option-chain": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "options": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "quarterly-balance-sheet": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "quarterly-balancesheet": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "quarterly-cash-flow": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "quarterly-cashflow": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "quarterly-earnings": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "quarterly-financials": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "quarterly-income-stmt": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "quarterly-incomestmt": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "recommendations": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "recommendations-summary": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "revenue-estimate": {"ttl": "1 week", "invalidates": "never"},
        "sec-filings": {"ttl": "1 week", "invalidates": "never"},
        "shares": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "splits": {"ttl": "1 week", "invalidates": "never"},
        "sustainability": {"ttl": "1 month", "invalidates": "never"},
        "upgrades-downgrades": {"ttl": "1 day", "invalidates": "00:00 UTC"},
    },
    "market": {
        "status": {"ttl": "30 minutes", "invalidates": "never"},
        "summary": {"ttl": "30 minutes", "invalidates": "never"}
    },
    "search": {
        "all": {"ttl": "30 minutes", "invalidates": "never"},
        "lists": {"ttl": "30 minutes", "invalidates": "never"},
        "news": {"ttl": "30 minutes", "invalidates": "never"},
        "quotes": {"ttl": "30 minutes", "invalidates": "never"},
        "research": {"ttl": "30 minutes", "invalidates": "never"},
        "response": {"ttl": "30 minutes", "invalidates": "never"}
    },
    "sector": {
        "industries": {"ttl": "3 months", "invalidates": "never"},
        "key": {"ttl": "3 months", "invalidates": "never"},
        "name": {"ttl": "3 months", "invalidates": "never"},
        "overview": {"ttl": "1 week", "invalidates": "never"},
        "research-reports": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "symbol": {"ttl": "3 months", "invalidates": "never"},
        "ticker": {"ttl": "3 months", "invalidates": "never"},
        "top-companies": {"ttl": "1 week", "invalidates": "never"},
        "top-etfs": {"ttl": "1 week", "invalidates": "never"},
        "top-mutual-funds": {"ttl": "1 week", "invalidates": "never"}
    },
    "industry": {
        "key": {"ttl": "3 months", "invalidates": "never"},
        "name": {"ttl": "3 months", "invalidates": "never"},
        "overview": {"ttl": "1 week", "invalidates": "never"},
        "research-reports": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "sector-key": {"ttl": "3 months", "invalidates": "never"},
        "sector-name": {"ttl": "3 months", "invalidates": "never"},
        "symbol": {"ttl": "3 months", "invalidates": "never"},
        "ticker": {"ttl": "3 months", "invalidates": "never"},
        "top-companies": {"ttl": "1 week", "invalidates": "never"},
        "top-growth-companies": {"ttl": "1 week", "invalidates": "never"},
        "top-performing-companies": {"ttl": "1 week", "invalidates": "never"}
    },
    "multi-ticker": {"ttl": "3 months", "invalidates": "never"},
    "screener": {
        "predefined-list": {"ttl": "1 day", "invalidates": "never"},
        "predefined": {"ttl": "30 minutes", "invalidates": "never"},
        "fields": {"ttl": "3 months", "invalidates": "never"},
        "values": {"ttl": "3 months", "invalidates": "never"},
        "custom": {"ttl": "30 minutes", "invalidates": "never"},
    }
}

# Yahooquery cache strategy mapping
YAHOOQUERY_CACHE_STRATEGIES = {
    "ticker": {
        # Financial data
        "asset_profile": {"ttl": "3 months", "invalidates": "never"},
        "calendar_events": {"ttl": "1 week", "invalidates": "never"},
        "company_officers": {"ttl": "1 month", "invalidates": "never"},
        "earning_history": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "earnings": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "earnings_trend": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "esg_scores": {"ttl": "1 month", "invalidates": "never"},
        "financial_data": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "fund_profile": {"ttl": "1 week", "invalidates": "never"},
        "grading_history": {"ttl": "1 week", "invalidates": "never"},
        "income_statement": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "balance_sheet": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "cash_flow": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "key_stats": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "major_holders": {"ttl": "1 week", "invalidates": "never"},
        "price": {"ttl": "30 minutes", "invalidates": "never"},
        "quote_type": {"ttl": "3 months", "invalidates": "never"},
        "recommendation_trend": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "share_purchase_activity": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "summary_detail": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "summary_profile": {"ttl": "3 months", "invalidates": "never"},
        "symbol": {"ttl": "3 months", "invalidates": "never"},

        # Historical data
        "history": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "dividends": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "splits": {"ttl": "1 week", "invalidates": "never"},
        "capital_gains": {"ttl": "1 day", "invalidates": "00:00 UTC"},

        # Options data
        "option_chain": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "option_expiration_dates": {"ttl": "1 day", "invalidates": "00:00 UTC"},

        # Insights
        "news": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "insights": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "recommendations": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "upgrades_downgrades": {"ttl": "1 day", "invalidates": "00:00 UTC"},

        # Misc endpoints
        "index_trend": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "industry_trend": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "net_share_purchase_activity": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "sec_filings": {"ttl": "1 week", "invalidates": "never"},
        "fund_holding_info": {"ttl": "1 month", "invalidates": "never"},
        "fund_ownership": {"ttl": "1 month", "invalidates": "never"},
        "fund_performance": {"ttl": "1 week", "invalidates": "never"},
        "fund_sector_weightings": {"ttl": "1 week", "invalidates": "never"},
        "all_modules": {"ttl": "1 day", "invalidates": "00:00 UTC"},
    },

    "tickers": {
        "batch": {"ttl": "30 minutes", "invalidates": "never"},
        "history": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "quotes": {"ttl": "30 minutes", "invalidates": "never"},
        "news": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "options": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "financial_data": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "valuation_measures": {"ttl": "1 day", "invalidates": "00:00 UTC"},
    },

    "screener": {
        "available": {"ttl": "1 week", "invalidates": "never"},
        "get_screener": {"ttl": "1 day", "invalidates": "00:00 UTC"},
    },

    "misc": {
        "search": {"ttl": "30 minutes", "invalidates": "never"},
        "trending": {"ttl": "30 minutes", "invalidates": "never"},
        "market-summary": {"ttl": "30 minutes", "invalidates": "never"},
        "currencies": {"ttl": "1 day", "invalidates": "never"},
        "market-movers": {"ttl": "30 minutes", "invalidates": "never"},
    }
}


# Combined cache strategies for the API
ALL_CACHE_STRATEGIES = {
    "yfinance": CACHE_STRATEGIES,
    "yahooquery": YAHOOQUERY_CACHE_STRATEGIES
}


def get_cache_strategy(category, endpoint, provider="yfinance"):
    """
    Get cache strategy for a specific endpoint.

    Args:
        category: The endpoint category (ticker, market, search, etc.)
        endpoint: The specific endpoint name
        provider: The data provider ('yfinance' or 'yahooquery')

    Returns:
        A dictionary with ttl and invalidates keys, or None if not found
    """
    strategies = YAHOOQUERY_CACHE_STRATEGIES if provider == "yahooquery" else CACHE_STRATEGIES

    if category in strategies:
        if endpoint in strategies[category]:
            return strategies[category][endpoint]
        # Default to category default if specific endpoint not found
        if "default" in strategies[category]:
            return strategies[category]["default"]

    # Global default if nothing else matches
    return {"ttl": "1 hour", "invalidates": "never"}