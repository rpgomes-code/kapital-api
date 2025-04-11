import functools
import logging

from fastapi import HTTPException

logger = logging.getLogger(__name__)

def handle_yf_request(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"yfinance error in {func.__name__}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"yfinance error: {str(e)}")
    return wrapper