from datetime import datetime

from typing import (
    List, 
    Optional
)

from pydantic import (
    BaseModel, 
    Field
)

# RSI - Relative Strength Index Models
class RSIValue(BaseModel):
    """Single data point for RSI calculation"""
    Date: datetime = Field(..., description="The date of the RSI measurement")
    RSI: float = Field(..., description="Relative Strength Index value (0-100)")

class RSIResponse(BaseModel):
    """Response model for RSI indicator endpoint"""
    values: List[RSIValue] = Field(..., description="Time series of RSI values")

# SMA - Simple Moving Average Models
class SMAValue(BaseModel):
    """Single data point for SMA calculation"""
    Date: datetime = Field(..., description="The date of the SMA measurement")
    SMA: float = Field(..., description="Simple Moving Average value")

class SMAResponse(BaseModel):
    """Response model for SMA indicator endpoint"""
    values: List[SMAValue] = Field(..., description="Time series of SMA values")
    
# Fear and Greed Index Models
class FearGreedValue(BaseModel):
    """Single data point for Fear & Greed Index calculation"""
    Date: datetime = Field(..., description="The date of the measurement")
    Value: float = Field(..., description="Fear & Greed Index value (0-100)")
    Sentiment: str = Field(..., description="Sentiment label based on the value")
    
    @staticmethod
    def get_sentiment(value: float) -> str:
        """Convert numerical value to sentiment label"""
        if value <= 20:
            return "Extreme Fear"
        elif value <= 40:
            return "Fear"
        elif value <= 60:
            return "Neutral"
        elif value <= 80:
            return "Greed"
        else:
            return "Extreme Greed"

class FearGreedComponent(BaseModel):
    """Component of Fear & Greed Index with its contribution"""
    Name: str = Field(..., description="Component name")
    Value: float = Field(..., description="Component value (0-100)")
    Description: str = Field(..., description="Description of what this component measures")
    Weight: float = Field(..., description="Weight in the overall index")

class FearGreedResponse(BaseModel):
    """Response model for Fear & Greed Index endpoint"""
    values: List[FearGreedValue] = Field(..., description="Time series of Fear & Greed values")
    current_value: float = Field(..., description="Current Fear & Greed Index value (0-100)")
    current_sentiment: str = Field(..., description="Current sentiment label")
    components: Optional[List[FearGreedComponent]] = Field(None, description="Components that make up the index (if requested)")
    is_market_wide: bool = Field(..., description="Whether this is a market-wide or ticker-specific index")
    
    class Config:
        schema_extra = {
            "example": {
                "values": [
                    {
                        "Date": "2023-02-01T00:00:00",
                        "Value": 25.4,
                        "Sentiment": "Fear"
                    },
                    {
                        "Date": "2023-02-02T00:00:00",
                        "Value": 32.1,
                        "Sentiment": "Fear"
                    }
                ],
                "current_value": 32.1,
                "current_sentiment": "Fear",
                "components": [
                    {
                        "Name": "Price Momentum",
                        "Value": 45.2,
                        "Description": "Price vs 50-day moving average",
                        "Weight": 0.25
                    },
                    {
                        "Name": "Volatility",
                        "Value": 24.5,
                        "Description": "Current volatility vs historical average",
                        "Weight": 0.25
                    }
                ],
                "is_market_wide": False
            }
        }