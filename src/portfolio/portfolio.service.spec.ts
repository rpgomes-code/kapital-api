import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioService } from './portfolio.service';
import { PrismaService } from '../prisma/prisma.service';
import { YahooFinanceService } from '../yahoo-finance/yahoo-finance.service';
import { Decimal } from '../generated/prisma/internal/prismaNamespace';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let prisma: PrismaService;
  let yahooFinance: YahooFinanceService;

  const mockPrismaService = {
    transaction: {
      findMany: jest.fn(),
    },
    asset: {
      findMany: jest.fn(),
    },
  };

  const mockYahooFinanceService = {
    getQuotes: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: YahooFinanceService, useValue: mockYahooFinanceService },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    prisma = module.get<PrismaService>(PrismaService);
    yahooFinance = module.get<YahooFinanceService>(YahooFinanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPortfolioSummary', () => {
    it('should return empty portfolio summary when no transactions', async () => {
      const userId = 'user-123';
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockYahooFinanceService.getQuotes.mockResolvedValue([]);

      const result = await service.getPortfolioSummary(userId);

      expect(result.totalValue).toBe(0);
      expect(result.totalCostBasis).toBe(0);
      expect(result.holdings).toEqual([]);
    });

    it('should calculate holdings from BUY transactions', async () => {
      const userId = 'user-123';
      const transactions = [
        {
          id: 1,
          type: 'BUY',
          assetId: 1,
          quantity: new Decimal(10),
          price: new Decimal(100),
          executedAt: new Date('2023-01-15'),
          fee: null,
          tax: null,
          asset: {
            id: 1,
            publicId: 'asset-1',
            symbol: 'AAPL',
            yahooSymbol: 'AAPL',
            name: 'Apple Inc.',
            assetType: 'STOCK',
            currency: 'USD',
          },
        },
      ];

      const quotes = [
        {
          symbol: 'AAPL',
          regularMarketPrice: 150,
          regularMarketChange: 2,
          regularMarketChangePercent: 1.35,
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);
      mockYahooFinanceService.getQuotes.mockResolvedValue(quotes);

      const result = await service.getPortfolioSummary(userId);

      expect(result.holdings.length).toBe(1);
      expect(result.holdings[0].quantity).toBe(10);
      expect(result.holdings[0].totalCostBasis).toBe(1000); // 10 * 100
      expect(result.holdings[0].currentPrice).toBe(150);
      expect(result.holdings[0].currentValue).toBe(1500); // 10 * 150
      expect(result.holdings[0].unrealizedGain).toBe(500); // 1500 - 1000
    });

    it('should calculate holdings using FIFO for BUY and SELL', async () => {
      const userId = 'user-123';
      const transactions = [
        {
          id: 1,
          type: 'BUY',
          assetId: 1,
          quantity: new Decimal(10),
          price: new Decimal(100),
          executedAt: new Date('2023-01-15'),
          fee: null,
          tax: null,
          asset: {
            id: 1,
            publicId: 'asset-1',
            symbol: 'AAPL',
            yahooSymbol: 'AAPL',
            name: 'Apple Inc.',
            assetType: 'STOCK',
            currency: 'USD',
          },
        },
        {
          id: 2,
          type: 'SELL',
          assetId: 1,
          quantity: new Decimal(5),
          price: new Decimal(150),
          executedAt: new Date('2023-06-15'),
          fee: null,
          tax: null,
          asset: {
            id: 1,
            publicId: 'asset-1',
            symbol: 'AAPL',
            yahooSymbol: 'AAPL',
            name: 'Apple Inc.',
            assetType: 'STOCK',
            currency: 'USD',
          },
        },
      ];

      const quotes = [
        {
          symbol: 'AAPL',
          regularMarketPrice: 160,
          regularMarketChange: 1,
          regularMarketChangePercent: 0.63,
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);
      mockYahooFinanceService.getQuotes.mockResolvedValue(quotes);

      const result = await service.getPortfolioSummary(userId);

      expect(result.holdings.length).toBe(1);
      expect(result.holdings[0].quantity).toBe(5); // 10 bought - 5 sold
      expect(result.holdings[0].totalCostBasis).toBe(500); // 5 * 100 (FIFO cost)
    });

    it('should accumulate dividends', async () => {
      const userId = 'user-123';
      const transactions = [
        {
          id: 1,
          type: 'DIVIDEND',
          assetId: 1,
          quantity: new Decimal(10), // shares eligible
          price: new Decimal(0.5), // dividend per share
          executedAt: new Date('2023-03-15'),
          fee: null,
          tax: null,
          asset: {
            id: 1,
            publicId: 'asset-1',
            symbol: 'AAPL',
            yahooSymbol: 'AAPL',
            name: 'Apple Inc.',
            assetType: 'STOCK',
            currency: 'USD',
          },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);
      mockYahooFinanceService.getQuotes.mockResolvedValue([]);

      const result = await service.getPortfolioSummary(userId);

      expect(result.totalDividendsReceived).toBe(5); // 10 * 0.5
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return zero metrics when no transactions', async () => {
      const userId = 'user-123';
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockYahooFinanceService.getQuotes.mockResolvedValue([]);

      const result = await service.getPerformanceMetrics(userId);

      expect(result.totalReturn).toBe(0);
      expect(result.realizedGains).toBe(0);
      expect(result.dividendIncome).toBe(0);
    });
  });

  describe('getAllocationByType', () => {
    it('should return allocation by asset type', async () => {
      const userId = 'user-123';
      const transactions = [
        {
          id: 1,
          type: 'BUY',
          assetId: 1,
          quantity: new Decimal(10),
          price: new Decimal(100),
          executedAt: new Date('2023-01-15'),
          fee: null,
          tax: null,
          asset: {
            id: 1,
            publicId: 'asset-1',
            symbol: 'AAPL',
            yahooSymbol: 'AAPL',
            name: 'Apple Inc.',
            assetType: 'STOCK',
            currency: 'USD',
          },
        },
        {
          id: 2,
          type: 'BUY',
          assetId: 2,
          quantity: new Decimal(20),
          price: new Decimal(50),
          executedAt: new Date('2023-01-20'),
          fee: null,
          tax: null,
          asset: {
            id: 2,
            publicId: 'asset-2',
            symbol: 'SPY',
            yahooSymbol: 'SPY',
            name: 'SPDR S&P 500',
            assetType: 'ETF',
            currency: 'USD',
          },
        },
      ];

      const quotes = [
        { symbol: 'AAPL', regularMarketPrice: 100, regularMarketChange: 0, regularMarketChangePercent: 0 },
        { symbol: 'SPY', regularMarketPrice: 50, regularMarketChange: 0, regularMarketChangePercent: 0 },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);
      mockYahooFinanceService.getQuotes.mockResolvedValue(quotes);

      const result = await service.getAllocationByType(userId);

      expect(result['STOCK']).toBeDefined();
      expect(result['ETF']).toBeDefined();
      expect(result['STOCK'].value).toBe(1000); // 10 * 100
      expect(result['ETF'].value).toBe(1000); // 20 * 50
      expect(result['STOCK'].percentage).toBe(50);
      expect(result['ETF'].percentage).toBe(50);
    });
  });

  describe('getAllocationBySector', () => {
    it('should return allocation by sector', async () => {
      const userId = 'user-123';
      const transactions = [
        {
          id: 1,
          type: 'BUY',
          assetId: 1,
          quantity: new Decimal(10),
          price: new Decimal(100),
          executedAt: new Date('2023-01-15'),
          fee: null,
          tax: null,
          asset: {
            id: 1,
            publicId: 'asset-1',
            symbol: 'AAPL',
            yahooSymbol: 'AAPL',
            name: 'Apple Inc.',
            assetType: 'STOCK',
            currency: 'USD',
          },
        },
      ];

      const quotes = [
        { symbol: 'AAPL', regularMarketPrice: 100, regularMarketChange: 0, regularMarketChangePercent: 0 },
      ];

      const assetsWithSector = [
        { id: 1, sector: { name: 'Technology' } },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);
      mockYahooFinanceService.getQuotes.mockResolvedValue(quotes);
      mockPrismaService.asset.findMany.mockResolvedValue(assetsWithSector);

      const result = await service.getAllocationBySector(userId);

      expect(result.sectors['Technology']).toBeDefined();
      expect(result.sectors['Technology'].value).toBe(1000);
      expect(result.sectors['Technology'].percentage).toBe(100);
    });
  });
});
