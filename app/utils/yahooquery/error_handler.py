import functools
import json
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)

def handle_yq_request(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except ConnectionError as e:
            logger.error(f"yahooquery connection error in {func.__name__}: {str(e)}")
            raise HTTPException(status_code=503, detail="Yahoo Finance service unavailable")
        except json.JSONDecodeError as e:
            logger.error(f"yahooquery JSON decode error in {func.__name__}: {str(e)}")
            raise HTTPException(status_code=502, detail="Invalid response from Yahoo Finance")
        except Exception as e:
            logger.error(f"yahooquery error in {func.__name__}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"yahooquery error: {str(e)}")
    return wrapper