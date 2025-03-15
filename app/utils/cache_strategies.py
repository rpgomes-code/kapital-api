"""
Cache strategies for yfinance API endpoints.
This module centralizes all caching TTLs and invalidation rules.
"""

# Main cache strategy mapping
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
    "multi-ticker": {"ttl": "3 months", "invalidates": "never"}
}


def get_cache_strategy(category, endpoint):
    """
    Get cache strategy for a specific endpoint.

    Args:
        category: The endpoint category (ticker, market, search, etc.)
        endpoint: The specific endpoint name

    Returns:
        A dictionary with ttl and invalidates keys, or None if not found
    """
    if category in CACHE_STRATEGIES:
        if endpoint in CACHE_STRATEGIES[category]:
            return CACHE_STRATEGIES[category][endpoint]
        # Default to category default if specific endpoint not found
        if "default" in CACHE_STRATEGIES[category]:
            return CACHE_STRATEGIES[category]["default"]

    # Global default if nothing else matches
    return {"ttl": "1 hour", "invalidates": "never"}