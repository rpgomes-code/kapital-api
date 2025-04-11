from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import settings
from app.core.settings import logger

# Import yfinance routers
from app.api.v1.yfinance.ticker import router as yf_ticker_router
from app.api.v1.yfinance.market import router as yf_market_router
from app.api.v1.yfinance.search import router as yf_search_router
from app.api.v1.yfinance.sector import router as yf_sector_router
from app.api.v1.yfinance.industry import router as yf_industry_router
from app.api.v1.yfinance.download import router as yf_download_router
from app.api.v1.yfinance.screener import router as yf_screener_router
from app.api.v1.yfinance.fund import router as yf_fund_router
from app.api.v1.yfinance.batch import router as yf_batch_router

# Import yahooquery routers
from app.api.v1.yahooquery.ticker import router as yq_ticker_router
from app.api.v1.yahooquery.screener import router as yq_screener_router
from app.api.v1.yahooquery.misc import router as yq_misc_router
from app.api.v1.yahooquery.multi_ticker import router as yq_multi_ticker_router

# Import kapital routers
from app.api.v1.kapital.image import router as image_router
from app.api.v1.kapital.indicators import router as indicators_router
from app.api.v1.redis.cache import router as cache_router

# Import Redis manager for startup check
from app.models.kapital.root import RootResponse
from app.utils.redis.redis_manager import redis_manager
from app.api.v1.health.endpoints import router as health_router

# Create FastAPI app
app = FastAPI(
    title="Kapital API",
    description="Comprehensive financial data API providing access to market data and analytics",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to check Redis connection
@app.on_event("startup")
async def startup_event():
    if redis_manager.is_connected():
        logger.info("Redis connection established - caching is enabled")
    else:
        logger.warning("Redis connection failed - caching is disabled")

# Root endpoint
@app.get("/", response_model=RootResponse, summary="API Welcome Endpoint", tags=["Main"],
         description="Basic information about the Kapital API")
def read_root():
    """
    Root endpoint that provides essential information about the Kapital API status and version.

    This endpoint serves as the primary entry point for the API and can be used to verify
    connectivity, check the current version, and determine if the caching layer is operational.
    It's particularly useful for simple health checks and version verification during deployments.

    Returns:
    - **RootResponse**: Object containing API information
      - **message**: Welcome message confirming successful connection
      - **version**: Current API version number for compatibility verification
      - **cache_status**: Redis connection status ('connected' or 'disconnected')

    Example response:
    ```json
    {
        "message": "Welcome to Kapital API",
        "version": "1.0.0",
        "cache_status": "connected"
    }
    ```

    Notes:
    - A 'connected' cache_status indicates Redis is operational and caching is enabled
    - A 'disconnected' cache_status means the API is functioning without caching
    - This endpoint does not require authentication and can be used for basic connectivity tests
    - Version information should be checked when integrating with client applications to ensure compatibility
    """
    redis_status = "connected" if redis_manager.is_connected() else "disconnected"
    return RootResponse(
        message="Welcome to Kapital API",
        version="1.0.0",
        cache_status=redis_status
    )

# Include all yfinance routers
app.include_router(yf_ticker_router)
app.include_router(yf_market_router)
app.include_router(yf_search_router)
app.include_router(yf_sector_router)
app.include_router(yf_industry_router)
app.include_router(yf_download_router)
app.include_router(yf_screener_router)
app.include_router(yf_fund_router)
app.include_router(yf_batch_router)

# Include all yahooquery routers
app.include_router(yq_ticker_router)
app.include_router(yq_screener_router)
app.include_router(yq_misc_router)
app.include_router(yq_multi_ticker_router)

# Include other routers
app.include_router(image_router)
app.include_router(indicators_router)
app.include_router(cache_router)
app.include_router(health_router)