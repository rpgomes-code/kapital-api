"""
Cache strategies for yahooquery API endpoints.
This module centralizes all caching TTLs and invalidation rules.
"""

# Main cache strategy mapping
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
    },

    "screener": {
        "get_screeners": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "get_available_screeners": {"ttl": "1 week", "invalidates": "never"},
    },

    "research": {
        "get_reports": {"ttl": "1 day", "invalidates": "00:00 UTC"},
        "get_research": {"ttl": "1 day", "invalidates": "00:00 UTC"},
    },

    "market": {
        "quotes": {"ttl": "30 minutes", "invalidates": "never"},
        "spark": {"ttl": "30 minutes", "invalidates": "never"},
        "summary": {"ttl": "30 minutes", "invalidates": "never"},
    },

    "misc": {
        "search": {"ttl": "30 minutes", "invalidates": "never"},
        "trending": {"ttl": "30 minutes", "invalidates": "never"},
        "get_currencies": {"ttl": "1 day", "invalidates": "never"},
        "get_exchanges": {"ttl": "1 month", "invalidates": "never"},
        "get_market_summary": {"ttl": "30 minutes", "invalidates": "never"},
    }
}


def get_yahooquery_cache_strategy(category, endpoint):
    """
    Get cache strategy for a specific yahooquery endpoint.

    Args:
        category: The endpoint category (ticker, screener, market, etc.)
        endpoint: The specific endpoint name

    Returns:
        A dictionary with ttl and invalidates keys, or None if not found
    """
    if category in YAHOOQUERY_CACHE_STRATEGIES:
        if endpoint in YAHOOQUERY_CACHE_STRATEGIES[category]:
            return YAHOOQUERY_CACHE_STRATEGIES[category][endpoint]
        # Default to category default if specific endpoint not found
        if "default" in YAHOOQUERY_CACHE_STRATEGIES[category]:
            return YAHOOQUERY_CACHE_STRATEGIES[category]["default"]

    # Global default if nothing else matches
    return {"ttl": "1 hour", "invalidates": "never"}