from pydantic import (
    BaseModel, 
    Field
)

class RootResponse(BaseModel):
    """Response model for the API root endpoint"""
    message: str = Field(..., description="Welcome message")
    version: str = Field(..., description="API version number")
    cache_status: str = Field(..., description="Redis cache connection status: 'connected' or 'disconnected'")
    
    class Config:
        schema_extra = {
            "example": {
                "message": "Welcome to Kapital API",
                "version": "1.0.0",
                "cache_status": "connected"
            }
        }