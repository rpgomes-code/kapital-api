import math
import logging
import datetime
import numpy as np
import pandas as pd

from functools import wraps

logger = logging.getLogger(__name__)

def _sanitize_for_json(obj, depth=0, max_depth=10):
    """
    Recursively process data to ensure it's JSON serializable:
    - Convert non-string keys to strings in dictionaries
    - Replace NaN, Infinity, -Infinity with appropriate values
    - Convert non-serializable objects to strings
    - Prevent infinite recursion with depth limiting

    Args:
        obj: The object to sanitize
        depth: Current recursion depth
        max_depth: Maximum recursion depth before converting to string

    Returns:
        JSON-serializable version of the input object
    """
    # Prevent excessive recursion
    if depth > max_depth:
        return str(obj)

    try:
        if isinstance(obj, dict):
            # Create a new dict with string keys and sanitized values
            return {str(key): _sanitize_for_json(value, depth + 1, max_depth)
                    for key, value in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [_sanitize_for_json(item, depth + 1, max_depth) for item in obj]
        elif isinstance(obj, (float, np.float64, np.float32)):
            # Handle special float values
            if math.isnan(obj):
                return None  # Convert NaN to None (null in JSON)
            elif math.isinf(obj):
                return str(obj)  # Convert Infinity to string representation
            return obj
        elif pd.isna(obj):
            # Handle pandas NA values
            return None
        elif isinstance(obj, (datetime.datetime, datetime.date)):
            # Convert datetime objects to ISO format strings
            return obj.isoformat()
        elif isinstance(obj, (pd.Timestamp)):
            # Convert pandas Timestamp to ISO format strings
            return obj.isoformat()
        elif isinstance(obj, pd.Series):
            # Convert Series to dictionary and sanitize
            return _sanitize_for_json(obj.to_dict(), depth + 1, max_depth)
        elif isinstance(obj, pd.DataFrame):
            # Convert DataFrame to list of dictionaries and sanitize
            return _sanitize_for_json(obj.to_dict(orient="records"), depth + 1, max_depth)
        # Special handling for yahooquery's objects
        elif str(type(obj)).find('yahooquery') != -1 and hasattr(obj, '__dict__'):
            try:
                # Try to extract attributes from yahooquery object
                return _sanitize_for_json(obj.__dict__, depth + 1, max_depth)
            except Exception as e:
                logger.debug(f"Failed to extract attributes from yahooquery object: {str(e)}")
                return str(obj)
        elif hasattr(obj, '__dict__'):
            # Handle objects with __dict__ attribute
            try:
                return _sanitize_for_json(obj.__dict__, depth + 1, max_depth)
            except Exception:
                # Fall back to string representation if we hit any issues
                return str(obj)
        elif not isinstance(obj, (str, int, float, bool, type(None))):
            # Convert other non-serializable types to string
            return str(obj)

        # Return primitive types as-is
        return obj
    except RecursionError:
        # Catch any remaining recursion errors and return string representation
        return str(obj)
    except Exception as e:
        # Catch any other exceptions during serialization
        logger.debug(f"Error in _sanitize_for_json: {str(e)}")
        return str(obj)

def clean_yahooquery_data(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        endpoint_name = func.__name__
        try:
            # Call the original function and await its result
            result = await func(*args, **kwargs)

            # Handle different types of data returned from yahooquery
            if isinstance(result, pd.DataFrame):
                # Reset index to make it a column
                result = result.reset_index()

                # Convert datetime columns to string format
                for col in result.columns:
                    if pd.api.types.is_datetime64_any_dtype(result[col]):
                        result[col] = result[col].dt.strftime('%Y-%m-%d %H:%M:%S')

                # Convert to records format (list of dicts)
                data = result.to_dict(orient="records") if not result.empty else []

            # Handle pandas Series
            elif isinstance(result, pd.Series):
                # Convert Series with DatetimeIndex to dict with date strings
                if isinstance(result.index, pd.DatetimeIndex):
                    result = result.reset_index()
                    if len(result.columns) == 2:
                        result.columns = ['Date', 'Value']
                        result['Date'] = result['Date'].dt.strftime('%Y-%m-%d %H:%M:%S')
                    data = result.to_dict(orient="records") if not result.empty else []
                else:
                    # Regular series
                    data = result.to_dict() if not result.empty else {}

            # Handle None/empty results
            elif result is None:
                return {}
            # Handle yahooquery's dict responses
            elif isinstance(result, dict):
                data = result
            else:
                # Use the result as is
                data = result

            # Apply final sanitization to ensure JSON compatibility
            try:
                sanitized_data = _sanitize_for_json(data)
                return sanitized_data
            except Exception as e:
                logger.error(f"Error sanitizing data in {endpoint_name}: {str(e)}")
                # If sanitization fails, make one last attempt to convert to string
                if hasattr(data, 'to_dict'):
                    return {"error": "Data could not be properly serialized", "string_data": str(data.to_dict())}
                return {"error": "Data could not be properly serialized", "string_data": str(data)}

        except Exception as e:
            logger.error(f"Error in endpoint {endpoint_name} with args {args} and kwargs {kwargs}: {str(e)}")
            raise

    return wrapper