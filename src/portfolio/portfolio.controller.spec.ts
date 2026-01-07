import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { AnalyticsService } from './services/analytics.service';
import { SnapshotService } from './services/snapshot.service';
import { DividendService } from './services/dividend.service';
import { TaxLotService } from './services/tax-lot.service';
import { CurrencyService } from './services/currency.service';

describe('PortfolioController', () => {
  let controller: PortfolioController;

  const mockPortfolioService = {
    getPortfolioSummary: jest.fn(),
    getPerformanceMetrics: jest.fn(),
    getAllocationByType: jest.fn(),
    getAllocationBySector: jest.fn(),
  };

  const mockAnalyticsService = {
    getEnhancedPerformanceMetrics: jest.fn(),
    getBenchmarkComparison: jest.fn(),
  };

  const mockSnapshotService = {
    getPortfolioHistory: jest.fn(),
    getOrCreateLatestSnapshot: jest.fn(),
    getDetailedSnapshot: jest.fn(),
    createDailySnapshot: jest.fn(),
    backfillSnapshots: jest.fn(),
  };

  const mockDividendService = {
    getDividendSummary: jest.fn(),
    getDividendHistory: jest.fn(),
    getDividendBreakdown: jest.fn(),
    getDividendCalendar: jest.fn(),
    getDividendProjection: jest.fn(),
  };

  const mockTaxLotService = {
    getAllTaxLots: jest.fn(),
    getTaxLotsForAsset: jest.fn(),
    getRealizedGains: jest.fn(),
    getTaxLossHarvestingOpportunities: jest.fn(),
  };

  const mockCurrencyService = {
    getCurrencyAllocation: jest.fn(),
    getMultiCurrencyRates: jest.fn(),
    getExchangeRate: jest.fn(),
    convert: jest.fn(),
    getMultiCurrencyPortfolio: jest.fn(),
    getFxGainLossDetails: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortfolioController],
      providers: [
        { provide: PortfolioService, useValue: mockPortfolioService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: SnapshotService, useValue: mockSnapshotService },
        { provide: DividendService, useValue: mockDividendService },
        { provide: TaxLotService, useValue: mockTaxLotService },
        { provide: CurrencyService, useValue: mockCurrencyService },
      ],
    }).compile();

    controller = module.get<PortfolioController>(PortfolioController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSummary', () => {
    it('should return portfolio summary', async () => {
      const session = { user: { id: 'user-123' } } as any;
      const expectedResult = {
        totalValue: 10000,
        holdings: [{ symbol: 'AAPL', quantity: 10, currentValue: 1500 }],
      };
      mockPortfolioService.getPortfolioSummary.mockResolvedValue(expectedResult);

      const result = await controller.getSummary(session);

      expect(result).toEqual(expectedResult);
      expect(mockPortfolioService.getPortfolioSummary).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getPerformance', () => {
    it('should return performance metrics', async () => {
      const session = { user: { id: 'user-123' } } as any;
      const expectedResult = { totalReturn: 0.15, annualizedReturn: 0.12 };
      mockPortfolioService.getPerformanceMetrics.mockResolvedValue(expectedResult);

      const result = await controller.getPerformance(session);

      expect(result).toEqual(expectedResult);
      expect(mockPortfolioService.getPerformanceMetrics).toHaveBeenCalledWith(
        'user-123',
        undefined,
        undefined,
      );
    });

    it('should accept date range parameters', async () => {
      const session = { user: { id: 'user-123' } } as any;
      const startDate = '2023-01-01';
      const endDate = '2023-12-31';
      const expectedResult = { totalReturn: 0.20 };
      mockPortfolioService.getPerformanceMetrics.mockResolvedValue(expectedResult);

      const result = await controller.getPerformance(session, startDate, endDate);

      expect(result).toEqual(expectedResult);
      expect(mockPortfolioService.getPerformanceMetrics).toHaveBeenCalledWith(
        'user-123',
        new Date(startDate),
        new Date(endDate),
      );
    });
  });

  describe('getAllocationByType', () => {
    it('should return allocation by type', async () => {
      const session = { user: { id: 'user-123' } } as any;
      const expectedResult = [
        { type: 'Stock', percentage: 70, value: 7000 },
        { type: 'ETF', percentage: 30, value: 3000 },
      ];
      mockPortfolioService.getAllocationByType.mockResolvedValue(expectedResult);

      const result = await controller.getAllocationByType(session);

      expect(result).toEqual(expectedResult);
      expect(mockPortfolioService.getAllocationByType).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getAllocationBySector', () => {
    it('should return allocation by sector', async () => {
      const session = { user: { id: 'user-123' } } as any;
      const expectedResult = [
        { sector: 'Technology', percentage: 50, value: 5000 },
        { sector: 'Healthcare', percentage: 30, value: 3000 },
      ];
      mockPortfolioService.getAllocationBySector.mockResolvedValue(expectedResult);

      const result = await controller.getAllocationBySector(session);

      expect(result).toEqual(expectedResult);
      expect(mockPortfolioService.getAllocationBySector).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getEnhancedPerformance', () => {
    it('should return enhanced performance metrics', async () => {
      const session = { user: { id: 'user-123' } } as any;
      const expectedResult = { sharpeRatio: 1.5, beta: 0.9 };
      mockAnalyticsService.getEnhancedPerformanceMetrics.mockResolvedValue(expectedResult);

      const result = await controller.getEnhancedPerformance(session);

      expect(result).toEqual(expectedResult);
      expect(mockAnalyticsService.getEnhancedPerformanceMetrics).toHaveBeenCalledWith(
        'user-123',
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('getDividendSummary', () => {
    it('should return dividend summary', async () => {
      const session = { user: { id: 'user-123' } } as any;
      const expectedResult = { totalDividends: 500, yield: 0.05 };
      mockDividendService.getDividendSummary.mockResolvedValue(expectedResult);

      const result = await controller.getDividendSummary(session);

      expect(result).toEqual(expectedResult);
      expect(mockDividendService.getDividendSummary).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getTaxLots', () => {
    it('should return all tax lots', async () => {
      const session = { user: { id: 'user-123' } } as any;
      const expectedResult = [{ assetId: 1, lots: [] }];
      mockTaxLotService.getAllTaxLots.mockResolvedValue(expectedResult);

      const result = await controller.getTaxLots(session);

      expect(result).toEqual(expectedResult);
      expect(mockTaxLotService.getAllTaxLots).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getCurrencyRates', () => {
    it('should return currency rates', async () => {
      const expectedResult = { base: 'USD', rates: { EUR: 0.85 } };
      mockCurrencyService.getMultiCurrencyRates.mockResolvedValue(expectedResult);

      const result = await controller.getCurrencyRates();

      expect(result).toEqual(expectedResult);
      expect(mockCurrencyService.getMultiCurrencyRates).toHaveBeenCalledWith('USD');
    });
  });
});
