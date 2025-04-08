from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# Import settings
from app.core.settings import API_PORT, API_HOST, logger

# Import routers
from app.api.v1.yfinance.ticker import router as ticker_router
from app.api.v1.yfinance.market import router as market_router
from app.api.v1.yfinance.search import router as search_router
from app.api.v1.yfinance.sector import router as sector_router
from app.api.v1.yfinance.industry import router as industry_router
from app.api.v1.yfinance.download import router as download_router
from app.api.v1.yfinance.screener import router as screener_router
from app.api.v1.yfinance.fund import router as fund_router
from app.api.v1.yfinance.batch import router as batch_router
from app.api.v1.kapital.image import router as image_router
from app.api.v1.redis.cache import router as cache_router

# Import Redis manager for startup check
from app.utils.redis.redis_manager import redis_manager

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
@app.get("/")
def read_root():
    redis_status = "connected" if redis_manager.is_connected() else "disconnected"
    return {
        "message": "Welcome to Kapital API",
        "version": "1.0.0",
        "cache_status": redis_status
    }

# Include all routers
app.include_router(ticker_router)
app.include_router(market_router)
app.include_router(search_router)
app.include_router(sector_router)
app.include_router(industry_router)
app.include_router(download_router)
app.include_router(screener_router)
app.include_router(fund_router)
app.include_router(batch_router)
app.include_router(image_router)
app.include_router(cache_router)