# Kapital API

A comprehensive financial data API that provides RESTful access to market data, with intelligent Redis caching for improved performance.

## Features

- **Complete yfinance coverage**: All yfinance functionality exposed through a clean REST API
- **Redis caching**: Intelligent caching strategy based on data update frequency
- **Robust data handling**: Proper conversion from pandas DataFrames/Series to JSON responses
- **Error handling**: Comprehensive error handling for all yfinance requests
- **API documentation**: Auto-generated Swagger and ReDoc documentation
- **Docker support**: Easy deployment with Docker and Docker Compose

## Key Data Categories

- **Ticker information**: Comprehensive data about stocks, including price, financials, and metadata
- **Historical price data**: Historical OHLC data with customizable periods and intervals
- **Financial statements**: Income statements, balance sheets, and cash flows (both annual and quarterly)
- **Market data**: Market status and summaries
- **Search functionality**: Search for tickers, news, and quotes
- **Sector and industry data**: Information on sectors, industries, and their top companies

## Installation

### Prerequisites

- Python 3.10+
- Redis server 6.0+ (for caching)

### Local Installation

1. Clone this repository
2. Create the required directory structure:
```bash
mkdir -p app/core app/utils
```
3. Install dependencies:
```bash
pip install -r requirements.txt
```
4. Create a `.env` file with your configuration (copy from `.env.sample`)

### Docker Installation (Recommended)

The simplest way to run the application is using Docker Compose:

```bash
docker-compose up -d
```

This will start both the API server and a Redis instance for caching.

## Running the API

### Local Development

To start the API server locally:

```bash
python main.py
```

Or you can use Uvicorn directly:

```bash
uvicorn main:app --reload
```

### Production Deployment

For production, we recommend using Gunicorn with Uvicorn workers:

```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

## Caching Strategy

The API implements intelligent caching based on how frequently the data changes:

- **30 minutes**: Market status, search results
- **1 day**: Financial data, news, and recommendations (invalidated at midnight UTC)
- **1 week**: Earnings dates, major holders, SEC filings
- **1 month**: Sustainability data
- **3 months**: Static data like ticker basic info, ISIN, etc.

The system automatically handles cache invalidation and updates.

## Cache Management

Special endpoints are available for cache management:

- `GET /v1/cache-strategy`: View the caching strategy for all endpoints
- `POST /v1/cache/clear`: Clear the entire Redis cache (admin only)
- `GET /v1/cache/stats`: View Redis cache statistics (admin only)

## API Documentation

FastAPI automatically generates interactive API documentation. Once the server is running, you can access:

- Swagger UI documentation: `http://localhost:8000/docs`
- ReDoc documentation: `http://localhost:8000/redoc`

## API Endpoints

The API is organized into several categories of endpoints:

### Ticker Endpoints

All ticker endpoints follow the pattern: `/v1/ticker/{ticker}/[endpoint]`

Examples include:
- `/v1/ticker/{ticker}/info` - General ticker information
- `/v1/ticker/{ticker}/history` - Historical price data
- `/v1/ticker/{ticker}/financials` - Financial statements
- `/v1/ticker/{ticker}/news` - Recent news
- And many more...

### Market Endpoints

- `/v1/market/{market}/status` - Market status (open/closed)
- `/v1/market/{market}/summary` - Market summary

### Search Endpoints

All search endpoints follow the pattern: `/v1/search/{query}/[endpoint]`

- `/v1/search/{query}/all` - All search results
- `/v1/search/{query}/quotes` - Quotes search results
- And more...

### Sector and Industry Endpoints

Explore sectors and industries:
- `/v1/sector/{sector}/top-companies` - Top companies in a sector
- `/v1/industry/{industry}/overview` - Industry overview

## Configuration

The application can be configured using environment variables or a `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | API server port | 8000 |
| HOST | API server host | 0.0.0.0 |
| LOG_LEVEL | Logging level | info |
| REDIS_HOST | Redis server hostname | localhost |
| REDIS_PORT | Redis server port | 6379 |
| REDIS_DB | Redis database number | 0 |
| REDIS_PASSWORD | Redis password (if required) | None |
| RATE_LIMIT | API rate limit (requests per minute) | 100 |

## Project Structure

```
├── app/
│   ├── core/
│   │   ├── __init__.py
│   │   └── settings.py
│   └── utils/
│       ├── __init__.py
│       ├── cache_decorator.py
│       ├── cache_strategies.py
│       ├── redis_manager.py
│       └── yfinance_data_manager.py
├── main.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.sample
└── README.md
```

## Example Usage

### Get Ticker Information with Caching

```
GET /v1/ticker/AAPL/info
```

The response will be cached for 3 months as this information rarely changes.

### Get Historical Data with Caching

```
GET /v1/ticker/MSFT/history?period=1y&interval=1d
```

The response will be cached for 1 day, with cache invalidation at midnight UTC.

### Search for a Company with Caching

```
GET /v1/search/Apple/quotes
```

The search results will be cached for 30 minutes.

## Notes

- This API is intended for educational and development purposes
- Yahoo Finance may have rate limits or terms of service that apply when using yfinance
- Consider adding authentication for production use
- Some endpoints in yfinance may return empty data or errors as noted in the code comments

## License

This project is licensed under the MIT License - see the LICENSE file for details.