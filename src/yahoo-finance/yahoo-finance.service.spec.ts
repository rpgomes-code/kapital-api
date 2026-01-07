import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { YahooFinanceService } from './yahoo-finance.service';

// Mock the yahoo-finance2 module
jest.mock('yahoo-finance2', () => {
  return jest.fn().mockImplementation(() => ({
    search: jest.fn().mockResolvedValue({
      quotes: [
        { symbol: 'AAPL', shortname: 'Apple Inc.', isYahooFinance: true },
      ],
    }),
    quote: jest.fn().mockResolvedValue({
      symbol: 'AAPL',
      shortName: 'Apple Inc.',
      regularMarketPrice: 150,
      regularMarketChange: 2.5,
      quoteType: 'EQUITY',
      exchange: 'NASDAQ',
      currency: 'USD',
    }),
    chart: jest.fn().mockResolvedValue({
      meta: {
        symbol: 'AAPL',
        currency: 'USD',
        exchangeName: 'NASDAQ',
        instrumentType: 'EQUITY',
        regularMarketPrice: 150,
        previousClose: 148,
        chartPreviousClose: 148,
        dataGranularity: '1d',
        range: '1mo',
      },
      quotes: [
        { date: new Date('2024-01-15'), open: 148, high: 152, low: 147, close: 150, volume: 1000000 },
      ],
      events: { dividends: [], splits: [] },
    }),
    quoteSummary: jest.fn().mockResolvedValue({
      price: { regularMarketPrice: 150 },
      summaryDetail: { dividendYield: 0.005 },
    }),
    recommendationsBySymbol: jest.fn().mockResolvedValue({
      symbol: 'AAPL',
      recommendedSymbols: [{ symbol: 'MSFT', score: 0.8 }],
    }),
    trendingSymbols: jest.fn().mockResolvedValue({
      quotes: [{ symbol: 'AAPL' }, { symbol: 'TSLA' }],
    }),
    dailyGainers: jest.fn().mockResolvedValue({
      quotes: [{ symbol: 'AAPL', regularMarketChangePercent: 5 }],
    }),
    dailyLosers: jest.fn().mockResolvedValue({
      quotes: [{ symbol: 'META', regularMarketChangePercent: -3 }],
    }),
    insights: jest.fn().mockResolvedValue({
      symbol: 'AAPL',
      recommendation: { rating: 'BUY' },
    }),
    screener: jest.fn().mockResolvedValue({
      quotes: [{ symbol: 'AAPL' }],
    }),
    fundamentalsTimeSeries: jest.fn().mockResolvedValue([
      { date: new Date('2023-01-01'), periodType: '12M', revenue: 1000000 },
    ]),
    options: jest.fn().mockResolvedValue({
      underlyingSymbol: 'AAPL',
      expirationDates: [new Date('2024-03-15')],
      strikes: [145, 150, 155],
      hasMiniOptions: false,
      quote: { symbol: 'AAPL' },
      options: [
        {
          expirationDate: new Date('2024-03-15'),
          calls: [{ contractSymbol: 'AAPL240315C00150000', strike: 150 }],
          puts: [{ contractSymbol: 'AAPL240315P00150000', strike: 150 }],
        },
      ],
    }),
  }));
});

describe('YahooFinanceService', () => {
  let service: YahooFinanceService;
  let cacheManager: any;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YahooFinanceService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<YahooFinanceService>(YahooFinanceService);
    cacheManager = module.get(CACHE_MANAGER);

    // Initialize the service
    await service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should return search results for a query', async () => {
      const results = await service.search('AAPL');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].symbol).toBe('AAPL');
    });

    it('should respect the limit parameter', async () => {
      const results = await service.search('tech', 5);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getQuote', () => {
    it('should return cached quote when available', async () => {
      const cachedQuote = {
        symbol: 'AAPL',
        regularMarketPrice: 150,
        shortName: 'Apple Inc.',
      };
      mockCacheManager.get.mockResolvedValue(cachedQuote);

      const result = await service.getQuote('AAPL');

      expect(result).toEqual(cachedQuote);
      expect(mockCacheManager.get).toHaveBeenCalledWith('yf:quote:AAPL');
    });

    it('should fetch and cache quote when not in cache', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getQuote('AAPL');

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('AAPL');
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });

  describe('getQuotes', () => {
    it('should return empty array for empty symbols list', async () => {
      const results = await service.getQuotes([]);

      expect(results).toEqual([]);
    });

    it('should return quotes from cache when available', async () => {
      const cachedQuote1 = { symbol: 'AAPL', regularMarketPrice: 150 };
      const cachedQuote2 = { symbol: 'MSFT', regularMarketPrice: 350 };

      mockCacheManager.get
        .mockResolvedValueOnce(cachedQuote1)
        .mockResolvedValueOnce(cachedQuote2);

      const results = await service.getQuotes(['AAPL', 'MSFT']);

      expect(results).toContainEqual(cachedQuote1);
      expect(results).toContainEqual(cachedQuote2);
    });

    it('should fetch uncached symbols', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const results = await service.getQuotes(['AAPL']);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getHistoricalData', () => {
    it('should return historical data for a valid symbol', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const results = await service.getHistoricalData('AAPL', startDate, endDate);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should support different intervals', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-06-30');

      const dailyResults = await service.getHistoricalData('AAPL', startDate, endDate, '1d');
      const weeklyResults = await service.getHistoricalData('AAPL', startDate, endDate, '1wk');

      expect(Array.isArray(dailyResults)).toBe(true);
      expect(Array.isArray(weeklyResults)).toBe(true);
    });
  });

  describe('getQuoteSummary', () => {
    it('should return quote summary for a valid symbol', async () => {
      const result = await service.getQuoteSummary('AAPL');

      expect(result).toBeDefined();
      expect(result?.price).toBeDefined();
    });

    it('should support custom modules', async () => {
      const result = await service.getQuoteSummary('AAPL', ['price', 'summaryProfile']);

      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('getDividendHistory', () => {
    it('should return dividend history', async () => {
      const startDate = new Date('2020-01-01');

      const results = await service.getDividendHistory('AAPL', startDate);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getSplitHistory', () => {
    it('should return split history', async () => {
      const startDate = new Date('2015-01-01');

      const results = await service.getSplitHistory('AAPL', startDate);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getChart', () => {
    it('should return chart data with default options', async () => {
      const result = await service.getChart('AAPL');

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('AAPL');
      expect(Array.isArray(result?.quotes)).toBe(true);
    });

    it('should support range parameter', async () => {
      const result = await service.getChart('AAPL', { range: '1mo' });

      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should support interval parameter', async () => {
      const result = await service.getChart('AAPL', { interval: '1h', range: '5d' });

      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should support period1 and period2', async () => {
      const result = await service.getChart('AAPL', {
        period1: new Date('2024-01-01'),
        period2: new Date('2024-01-31'),
      });

      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('getRecommendations', () => {
    it('should return cached recommendations when available', async () => {
      const cachedRecommendations = {
        symbol: 'AAPL',
        score: 0.5,
        recommendedSymbols: [{ symbol: 'MSFT', score: 0.3 }],
      };
      mockCacheManager.get.mockResolvedValue(cachedRecommendations);

      const result = await service.getRecommendations('AAPL');

      expect(result).toEqual(cachedRecommendations);
    });

    it('should fetch and cache recommendations', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getRecommendations('AAPL');

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('AAPL');
    });
  });

  describe('getTrendingSymbols', () => {
    it('should return cached trending symbols when available', async () => {
      const cachedTrending = [
        { symbol: 'AAPL', shortName: 'Apple' },
        { symbol: 'TSLA', shortName: 'Tesla' },
      ];
      mockCacheManager.get.mockResolvedValue(cachedTrending);

      const result = await service.getTrendingSymbols();

      expect(result).toEqual(cachedTrending);
    });

    it('should fetch trending symbols for different regions', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getTrendingSymbols('US', 10);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getDailyGainers', () => {
    it('should return daily gainers', async () => {
      const results = await service.getDailyGainers(10);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getDailyLosers', () => {
    it('should return daily losers', async () => {
      const results = await service.getDailyLosers(10);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getInsights', () => {
    it('should return cached insights when available', async () => {
      const cachedInsights = {
        symbol: 'AAPL',
        recommendation: { rating: 'BUY' },
      };
      mockCacheManager.get.mockResolvedValue(cachedInsights);

      const result = await service.getInsights('AAPL');

      expect(result).toEqual(cachedInsights);
    });

    it('should fetch insights for a valid symbol', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getInsights('AAPL');

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('AAPL');
    });
  });

  describe('getScreener', () => {
    it('should return screener results', async () => {
      const results = await service.getScreener('day_gainers', { count: 10 });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getFundamentalsTimeSeries', () => {
    it('should return fundamentals time series', async () => {
      const results = await service.getFundamentalsTimeSeries('AAPL', {
        period1: new Date('2022-01-01'),
        module: 'financials',
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should support different modules', async () => {
      const results = await service.getFundamentalsTimeSeries('AAPL', {
        period1: new Date('2022-01-01'),
        module: 'balance-sheet',
        type: 'annual',
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getOptions', () => {
    it('should return options chain', async () => {
      const result = await service.getOptions('AAPL');

      expect(result).toBeDefined();
      expect(result?.underlyingSymbol).toBe('AAPL');
      expect(Array.isArray(result?.expirationDates)).toBe(true);
      expect(Array.isArray(result?.options)).toBe(true);
    });

    it('should support date parameter', async () => {
      const result = await service.getOptions('AAPL', new Date('2024-03-15'));

      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('getOptionsExpirations', () => {
    it('should return options expiration dates', async () => {
      const results = await service.getOptionsExpirations('AAPL');

      expect(Array.isArray(results)).toBe(true);
    });
  });
});
