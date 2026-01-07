import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { PrismaService } from '../prisma/prisma.service';
import { YahooFinanceService } from '../yahoo-finance/yahoo-finance.service';

describe('AssetsService', () => {
  let service: AssetsService;
  let prisma: PrismaService;
  let yahooFinance: YahooFinanceService;

  const mockPrismaService = {
    asset: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    transaction: {
      count: jest.fn(),
    },
  };

  const mockYahooFinanceService = {
    getQuote: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: YahooFinanceService, useValue: mockYahooFinanceService },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    prisma = module.get<PrismaService>(PrismaService);
    yahooFinance = module.get<YahooFinanceService>(YahooFinanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an asset', async () => {
      const createAssetDto = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        assetType: 'STOCK',
        currency: 'USD',
      };
      const expectedResult = { id: 1, ...createAssetDto };

      mockPrismaService.asset.findFirst.mockResolvedValue(null);
      mockPrismaService.asset.create.mockResolvedValue(expectedResult);

      const result = await service.create(createAssetDto as any);

      expect(result).toEqual(expectedResult);
    });

    it('should throw ConflictException if symbol already exists', async () => {
      const createAssetDto = { symbol: 'AAPL' };
      mockPrismaService.asset.findFirst.mockResolvedValue({ id: 1, symbol: 'AAPL' });

      await expect(service.create(createAssetDto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all assets', async () => {
      const expectedResult = [
        { id: 1, symbol: 'AAPL', name: 'Apple Inc.' },
        { id: 2, symbol: 'MSFT', name: 'Microsoft Corp.' },
      ];
      mockPrismaService.asset.findMany.mockResolvedValue(expectedResult);

      const result = await service.findAll();

      expect(result).toEqual(expectedResult);
    });

    it('should filter by search query', async () => {
      const searchDto = { query: 'Apple' };
      const expectedResult = [{ id: 1, symbol: 'AAPL', name: 'Apple Inc.' }];
      mockPrismaService.asset.findMany.mockResolvedValue(expectedResult);

      const result = await service.findAll(searchDto);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return an asset by id', async () => {
      const assetId = 1;
      const expectedResult = { id: assetId, symbol: 'AAPL', name: 'Apple Inc.' };
      mockPrismaService.asset.findUnique.mockResolvedValue(expectedResult);

      const result = await service.findOne(assetId);

      expect(result).toEqual(expectedResult);
    });

    it('should throw NotFoundException if asset not found', async () => {
      mockPrismaService.asset.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySymbol', () => {
    it('should return an asset by symbol', async () => {
      const symbol = 'AAPL';
      const expectedResult = { id: 1, symbol, name: 'Apple Inc.' };
      mockPrismaService.asset.findFirst.mockResolvedValue(expectedResult);

      const result = await service.findBySymbol(symbol);

      expect(result).toEqual(expectedResult);
    });

    it('should throw NotFoundException if symbol not found', async () => {
      mockPrismaService.asset.findFirst.mockResolvedValue(null);

      await expect(service.findBySymbol('INVALID')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOrCreateBySymbol', () => {
    it('should return existing asset if found', async () => {
      const existingAsset = { id: 1, symbol: 'AAPL', yahooSymbol: 'AAPL' };
      mockPrismaService.asset.findFirst.mockResolvedValue(existingAsset);

      const result = await service.findOrCreateBySymbol('AAPL');

      expect(result).toEqual({ asset: existingAsset, created: false });
      expect(mockYahooFinanceService.getQuote).not.toHaveBeenCalled();
    });

    it('should create asset from Yahoo Finance if not found locally', async () => {
      const yahooData = {
        symbol: 'AAPL',
        shortName: 'Apple Inc.',
        quoteType: 'EQUITY',
        exchange: 'NASDAQ',
        currency: 'USD',
      };
      const createdAsset = { id: 1, symbol: 'AAPL', name: 'Apple Inc.' };

      mockPrismaService.asset.findFirst.mockResolvedValue(null);
      mockYahooFinanceService.getQuote.mockResolvedValue(yahooData);
      mockPrismaService.asset.create.mockResolvedValue(createdAsset);

      const result = await service.findOrCreateBySymbol('AAPL');

      expect(result).toEqual({ asset: createdAsset, created: true });
      expect(mockYahooFinanceService.getQuote).toHaveBeenCalledWith('AAPL');
    });
  });

  describe('update', () => {
    it('should update an asset', async () => {
      const assetId = 1;
      const updateAssetDto = { name: 'Updated Name' };
      const existingAsset = { id: assetId, symbol: 'AAPL' };
      const updatedAsset = { ...existingAsset, ...updateAssetDto };

      mockPrismaService.asset.findUnique.mockResolvedValue(existingAsset);
      mockPrismaService.asset.update.mockResolvedValue(updatedAsset);

      const result = await service.update(assetId, updateAssetDto as any);

      expect(result).toEqual(updatedAsset);
    });
  });

  describe('remove', () => {
    it('should delete an asset', async () => {
      const assetId = 1;
      const asset = { id: assetId, symbol: 'AAPL' };

      mockPrismaService.asset.findUnique.mockResolvedValue(asset);
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.asset.delete.mockResolvedValue(asset);

      const result = await service.remove(assetId);

      expect(result).toEqual(asset);
    });

    it('should throw ConflictException if asset has transactions', async () => {
      const assetId = 1;
      const asset = { id: assetId, symbol: 'AAPL' };

      mockPrismaService.asset.findUnique.mockResolvedValue(asset);
      mockPrismaService.transaction.count.mockResolvedValue(5);

      await expect(service.remove(assetId)).rejects.toThrow(ConflictException);
    });
  });

  describe('getAssetWithCurrentPrice', () => {
    it('should return asset with current price from Yahoo Finance', async () => {
      const assetId = 1;
      const asset = { id: assetId, symbol: 'AAPL', yahooSymbol: 'AAPL' };
      const quote = {
        regularMarketPrice: 150.0,
        regularMarketChange: 2.5,
        regularMarketChangePercent: 1.7,
        marketState: 'REGULAR',
      };

      mockPrismaService.asset.findUnique.mockResolvedValue(asset);
      mockYahooFinanceService.getQuote.mockResolvedValue(quote);

      const result = await service.getAssetWithCurrentPrice(assetId);

      expect(result.currentPrice).toEqual(150.0);
      expect(result.priceChange).toEqual(2.5);
      expect(result.priceChangePercent).toEqual(1.7);
    });
  });
});
