import httpx
import logging

from typing import Optional

logger = logging.getLogger(__name__)

# Define a function to validate an image URL
async def validate_image_url(url: str, client: httpx.AsyncClient) -> Optional[str]:
    """
    Validates if a URL contains an actual image by checking Content-Type and status code.
    Args:
        url: URL to check
        client: httpx.AsyncClient instance to use for the request
    Returns:
        The URL if it's a valid image, None otherwise
    """
    try:
        # Use GET instead of HEAD to get headers including Content-Type
        response = await client.get(url, timeout=3.0, follow_redirects=True)
        # Check status code first
        if response.status_code != 200:
            return None
        # Check for image content type
        content_type = response.headers.get('Content-Type', '')
        if not content_type.startswith('image/'):
            logger.debug(f"URL {url} returned non-image Content-Type: {content_type}")
            return None
        # Check for minimum content length to avoid empty images or tiny placeholders
        content_length = int(response.headers.get('Content-Length', '0'))
        if content_length < 100:  # Arbitrary minimum size for a real logo
            logger.debug(f"URL {url} has suspiciously small image size: {content_length} bytes")
            return None
        # If all checks pass, return the URL
        logger.debug(f"Valid image found at {url} ({content_type}, {content_length} bytes)")
        return url
    except Exception as e:
        logger.debug(f"Failed to validate image from {url}: {str(e)}")
        return None