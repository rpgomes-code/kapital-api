from fastapi import APIRouter

# Import all indicator routers
from app.api.v1.kapital.indicators.fear_greed import router as fear_greed_router
from app.api.v1.kapital.indicators.rsi import router as rsi_router
from app.api.v1.kapital.indicators.sma import router as sma_router

# Create a combined router with the same path prefix and tag
router = APIRouter()

# Include all individual indicator routers
router.include_router(fear_greed_router)
router.include_router(rsi_router)
router.include_router(sma_router)