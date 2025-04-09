from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

class RedisDetails(BaseModel):
    """Details about the Redis instance"""
    version: str = Field(..., description="Redis server version")
    memory_used: str = Field(..., description="Memory usage in human-readable format")
    clients_connected: int = Field(..., description="Number of connected clients")
    uptime_days: int = Field(..., description="Server uptime in days")


class ComponentStatus(BaseModel):
    """Status of individual system components"""
    api: str = Field("up", description="API service status: 'up' or 'down'")
    redis: str = Field(..., description="Redis status: 'up', 'down', or 'unknown'")


class HealthCheckResponse(BaseModel):
    """Response model for the health check endpoint"""
    status: str = Field(..., description="Overall system status: 'healthy' or 'degraded'")
    components: ComponentStatus = Field(..., description="Status of individual components")
    details: Dict[str, Any] = Field(default_factory=dict, description="Additional details about component health")
    
    class Config:
        schema_extra = {
            "example": {
                "status": "healthy",
                "components": {
                    "api": "up",
                    "redis": "up"
                },
                "details": {
                    "redis": {
                        "version": "7.0.5",
                        "memory_used": "2.5M",
                        "clients_connected": 1,
                        "uptime_days": 15
                    }
                }
            }
        }