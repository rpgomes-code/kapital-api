from typing import Optional
from pydantic import BaseModel, Field


class TickerImageResponse(BaseModel):
    """Response model for company logo image URL"""
    imageUrl: Optional[str] = Field(
        None, 
        description="URL to the company logo image, or null if no image is found"
    )
