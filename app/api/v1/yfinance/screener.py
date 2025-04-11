import logging
import yfinance as yf

from typing import (
    List, 
    Any
)

from fastapi import (
    APIRouter, 
    HTTPException, 
    Query
)

from pydantic import (
    BaseModel, 
    Field
)

from app.utils.redis.cache_decorator import redis_cache
from app.utils.yfinance.error_handler import handle_yf_request
from app.utils.yfinance.yfinance_data_manager import clean_yfinance_data

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/yfinance/screener", tags=["YFinance Screener"])

# Logger for this module
logger = logging.getLogger(__name__)

@router.get("/predefined-list")
@handle_yf_request
@redis_cache(ttl="1 day")
@clean_yfinance_data
async def get_predefined_screeners():
    """
    Get a list of all available predefined screeners.
    
    Returns:
        Dictionary with predefined screener names as keys and their descriptions as values
    """
    # Get the predefined screeners from yfinance
    predefined_screeners = yf.PREDEFINED_SCREENER_QUERIES
    
    # Format the response
    result = {}
    for name, config in predefined_screeners.items():
        # Extract the sort field and direction
        sort_field = config.get("sortField", "")
        sort_type = config.get("sortType", "")
        
        # Extract the query type (EquityQuery or FundQuery)
        query = config.get("query", None)
        query_type = query.__class__.__name__ if query else "Unknown"
        
        # Format the result
        result[name] = {
            "query_type": query_type,
            "sort_field": sort_field,
            "sort_type": sort_type,
            "description": _get_screener_description(name)
        }
    
    return result

@router.get("/predefined/{screen_name}")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def get_predefined_screen(
    screen_name: str,
    size: int = Query(25, description="Number of results to return (max 250)", ge=1, le=250),
    offset: int = Query(0, description="Offset for pagination", ge=0)
):
    """
    Run a predefined stock screener query.
    
    Args:
        screen_name: Name of the predefined screen (e.g., day_gainers, undervalued_growth_stocks)
        size: Number of results to return (max 250)
        offset: Offset for pagination
        
    Returns:
        Screener results based on the selected criteria
    """
    # Check if the predefined screener exists
    if screen_name not in yf.PREDEFINED_SCREENER_QUERIES:
        available_screens = list(yf.PREDEFINED_SCREENER_QUERIES.keys())
        raise HTTPException(
            status_code=404, 
            detail=f"Screen '{screen_name}' not found. Available screens: {available_screens}"
        )
    
    try:
        # Run the screener with the specified parameters
        results = yf.screen(
            query=screen_name,
            size=size,
            offset=offset
        )
        
        # Add metadata to the response
        return {
            "screen_name": screen_name,
            "description": _get_screener_description(screen_name),
            "size": size,
            "offset": offset,
            "results": results
        }
    except ValueError as e:
        # Handle the specific case of Yahoo limiting query size
        if "Yahoo limits query size to 250" in str(e):
            raise HTTPException(status_code=400, detail="Yahoo limits query size to a maximum of 250 results")
        raise

@router.get("/fields")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_screener_fields():
    """
    Get a list of all available fields for custom screener queries.
    
    Returns:
        Dictionary with field categories and their available fields
    """
    # Get the field maps from yfinance
    equity_fields = yf.EquityQuery.valid_fields
    fund_fields = yf.FundQuery.valid_fields
    
    # Return both field sets
    return {
        "equity_fields": equity_fields,
        "fund_fields": fund_fields
    }

@router.get("/values")
@handle_yf_request
@redis_cache(ttl="3 months")
@clean_yfinance_data
async def get_screener_values():
    """
    Get a list of valid values for fields that require specific values.
    
    Returns:
        Dictionary with field names and their valid values
    """
    # Get the valid values maps from yfinance
    equity_values = yf.EquityQuery.valid_values
    fund_values = yf.FundQuery.valid_values
    
    # Return both value sets
    return {
        "equity_values": equity_values,
        "fund_values": fund_values
    }

# Custom query model for the request body
class ScreenerQueryOperation(BaseModel):
    operator: str = Field(..., description="Operator for the query (e.g., 'eq', 'gt', 'lt', 'btwn', 'is-in')")
    operands: List[Any] = Field(..., description="Operands for the query")

@router.post("/custom/equity")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def run_custom_equity_screener(
    query: ScreenerQueryOperation,
    size: int = Query(25, description="Number of results to return (max 250)", ge=1, le=250),
    offset: int = Query(0, description="Offset for pagination", ge=0),
    sort_field: str = Query("ticker", description="Field to sort by"),
    sort_asc: bool = Query(False, description="Sort in ascending order?")
):
    """
    Run a custom equity screener query.
    
    Args:
        query: Custom query specification
        size: Number of results to return (max 250)
        offset: Offset for pagination
        sort_field: Field to sort by
        sort_asc: Sort in ascending order?
        
    Returns:
        Screener results based on the custom criteria
    """
    try:
        # Construct the equity query
        equity_query = _build_equity_query(query)
        
        # Run the screener with the custom query
        results = yf.screen(
            query=equity_query,
            size=size,
            offset=offset,
            sortField=sort_field,
            sortAsc=sort_asc
        )
        
        # Return the results with metadata
        return {
            "query_type": "equity",
            "size": size,
            "offset": offset,
            "sort_field": sort_field,
            "sort_asc": sort_asc,
            "results": results
        }
    except ValueError as e:
        # Handle the specific case of Yahoo limiting query size
        if "Yahoo limits query size to 250" in str(e):
            raise HTTPException(status_code=400, detail="Yahoo limits query size to a maximum of 250 results")
        # Handle invalid field errors
        if "Invalid field for EquityQuery" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid field in query: {str(e)}")
        raise

@router.post("/custom/fund")
@handle_yf_request
@redis_cache(ttl="30 minutes")
@clean_yfinance_data
async def run_custom_fund_screener(
    query: ScreenerQueryOperation,
    size: int = Query(25, description="Number of results to return (max 250)", ge=1, le=250),
    offset: int = Query(0, description="Offset for pagination", ge=0),
    sort_field: str = Query("ticker", description="Field to sort by"),
    sort_asc: bool = Query(False, description="Sort in ascending order?")
):
    """
    Run a custom mutual fund screener query.
    
    Args:
        query: Custom query specification
        size: Number of results to return (max 250)
        offset: Offset for pagination
        sort_field: Field to sort by
        sort_asc: Sort in ascending order?
        
    Returns:
        Screener results based on the custom criteria
    """
    try:
        # Construct the fund query
        fund_query = _build_fund_query(query)
        
        # Run the screener with the custom query
        results = yf.screen(
            query=fund_query,
            size=size,
            offset=offset,
            sortField=sort_field,
            sortAsc=sort_asc
        )
        
        # Return the results with metadata
        return {
            "query_type": "fund",
            "size": size,
            "offset": offset,
            "sort_field": sort_field,
            "sort_asc": sort_asc,
            "results": results
        }
    except ValueError as e:
        # Handle the specific case of Yahoo limiting query size
        if "Yahoo limits query size to 250" in str(e):
            raise HTTPException(status_code=400, detail="Yahoo limits query size to a maximum of 250 results")
        # Handle invalid field errors
        if "Invalid field for FundQuery" in str(e):
            raise HTTPException(status_code=400, detail=f"Invalid field in query: {str(e)}")
        raise


def _build_equity_query(query_data):
    """
    Recursively build an EquityQuery from the provided query data.
    
    Args:
        query_data: Query specification from the request
        
    Returns:
        An EquityQuery object
    """
    operator = query_data.operator.lower()
    operands = query_data.operands
    
    # Handle logical operators (and, or)
    if operator in ['and', 'or']:
        # Recursively build nested queries
        nested_queries = []
        for operand in operands:
            if isinstance(operand, dict):
                # Convert dict to Pydantic model
                operand_model = ScreenerQueryOperation(**operand)
                nested_queries.append(_build_equity_query(operand_model))
            elif isinstance(operand, ScreenerQueryOperation):
                nested_queries.append(_build_equity_query(operand))
            else:
                raise HTTPException(status_code=400, detail=f"Invalid operand for '{operator}' operator: {operand}")
        
        return yf.EquityQuery(operator, nested_queries)
    
    # Handle comparison operators (eq, gt, lt, etc.)
    else:
        return yf.EquityQuery(operator, operands)

def _build_fund_query(query_data):
    """
    Recursively build a FundQuery from the provided query data.
    
    Args:
        query_data: Query specification from the request
        
    Returns:
        A FundQuery object
    """
    operator = query_data.operator.lower()
    operands = query_data.operands
    
    # Handle logical operators (and, or)
    if operator in ['and', 'or']:
        # Recursively build nested queries
        nested_queries = []
        for operand in operands:
            if isinstance(operand, dict):
                # Convert dict to Pydantic model
                operand_model = ScreenerQueryOperation(**operand)
                nested_queries.append(_build_fund_query(operand_model))
            elif isinstance(operand, ScreenerQueryOperation):
                nested_queries.append(_build_fund_query(operand))
            else:
                raise HTTPException(status_code=400, detail=f"Invalid operand for '{operator}' operator: {operand}")
        
        return yf.FundQuery(operator, nested_queries)
    
    # Handle comparison operators (eq, gt, lt, etc.)
    else:
        return yf.FundQuery(operator, operands)

def _get_screener_description(screen_name):
    """
    Get a descriptive string for a predefined screener.
    
    Args:
        screen_name: Name of the predefined screener
        
    Returns:
        A description string
    """
    descriptions = {
        'aggressive_small_caps': "Aggressive small-cap stocks with high earnings growth potential",
        'day_gainers': "Stocks with the largest gains for the day",
        'day_losers': "Stocks with the largest losses for the day",
        'growth_technology_stocks': "Technology stocks with strong revenue and earnings growth",
        'most_actives': "Most actively traded stocks by volume",
        'most_shorted_stocks': "Stocks with the highest short interest as a percentage of float",
        'small_cap_gainers': "Small-cap stocks with recent price increases",
        'undervalued_growth_stocks': "Growth stocks with relatively low P/E and PEG ratios",
        'undervalued_large_caps': "Large-cap stocks with relatively low P/E and PEG ratios",
        'conservative_foreign_funds': "Foreign equity funds with strong performance and low risk ratings",
        'high_yield_bond': "High-yield bond funds with strong performance",
        'portfolio_anchors': "Large-blend funds that can form the core of a portfolio",
        'solid_large_growth_funds': "Large-growth funds with consistent performance",
        'solid_midcap_growth_funds': "Mid-cap growth funds with consistent performance",
        'top_mutual_funds': "Top-rated mutual funds with strong recent performance"
    }
    
    return descriptions.get(screen_name, "Yahoo Finance predefined screen")