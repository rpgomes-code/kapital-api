from datetime import datetime
from typing import List
from pydantic import BaseModel, Field

# RSI - Relative Strength Index Models

class RSIValue(BaseModel):
    """Single data point for RSI calculation"""
    Date: datetime = Field(..., description="The date of the RSI measurement")
    RSI: float = Field(..., description="Relative Strength Index value (0-100)")

class RSIResponse(BaseModel):
    """Response model for RSI indicator endpoint"""
    values: List[RSIValue] = Field(..., description="Time series of RSI values")