import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WatchlistsService } from './watchlists.service';
import { PrismaService } from '../prisma/prisma.service';
import { YahooFinanceService } from '../yahoo-finance/yahoo-finance.service';

describe('WatchlistsService', () => {
  let service: WatchlistsService;
  let prisma: PrismaService;
  let yahooFinance: YahooFinanceService;

  const mockPrismaService = {
    watchlist: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    watchlistAsset: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockYahooFinanceService = {
    getQuotes: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchlistsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: YahooFinanceService, useValue: mockYahooFinanceService },
      ],
    }).compile();

    service = module.get<WatchlistsService>(WatchlistsService);
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
    it('should create a watchlist', async () => {
      const dto = { name: 'Tech Stocks', userId: 'user-123' };
      const expectedResult = { id: 1, ...dto };
      mockPrismaService.watchlist.create.mockResolvedValue(expectedResult);

      const result = await service.create(dto);

      expect(result).toEqual(expectedResult);
      expect(mockPrismaService.watchlist.create).toHaveBeenCalledWith({
        data: { userId: dto.userId, name: dto.name },
      });
    });
  });

  describe('findByUser', () => {
    it('should return user watchlists', async () => {
      const userId = 'user-123';
      const expectedResult = [
        { id: 1, userId, name: 'Watchlist 1', assets: [] },
      ];
      mockPrismaService.watchlist.findMany.mockResolvedValue(expectedResult);

      const result = await service.findByUser(userId);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return a watchlist by id', async () => {
      const watchlistId = 1;
      const expectedResult = { id: watchlistId, name: 'My Watchlist', assets: [] };
      mockPrismaService.watchlist.findUnique.mockResolvedValue(expectedResult);

      const result = await service.findOne(watchlistId);

      expect(result).toEqual(expectedResult);
    });

    it('should throw NotFoundException if watchlist not found', async () => {
      mockPrismaService.watchlist.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addAsset', () => {
    it('should add an asset to watchlist', async () => {
      const watchlistId = 1;
      const dto = { assetId: 10 };
      const expectedResult = { id: 1, watchlistId, assetId: 10, asset: { symbol: 'AAPL' } };

      mockPrismaService.watchlistAsset.findFirst.mockResolvedValue(null);
      mockPrismaService.watchlistAsset.create.mockResolvedValue(expectedResult);

      const result = await service.addAsset(watchlistId, dto);

      expect(result).toEqual(expectedResult);
    });

    it('should throw ConflictException if asset already in watchlist', async () => {
      mockPrismaService.watchlistAsset.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.addAsset(1, { assetId: 10 })).rejects.toThrow(ConflictException);
    });
  });

  describe('removeAsset', () => {
    it('should remove an asset from watchlist', async () => {
      const existing = { id: 1, watchlistId: 1, assetId: 10 };
      mockPrismaService.watchlistAsset.findFirst.mockResolvedValue(existing);
      mockPrismaService.watchlistAsset.delete.mockResolvedValue(existing);

      const result = await service.removeAsset(1, 10);

      expect(result).toEqual(existing);
      expect(mockPrismaService.watchlistAsset.delete).toHaveBeenCalledWith({
        where: { id: existing.id },
      });
    });

    it('should throw NotFoundException if asset not in watchlist', async () => {
      mockPrismaService.watchlistAsset.findFirst.mockResolvedValue(null);

      await expect(service.removeAsset(1, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a watchlist', async () => {
      const watchlistId = 1;
      const watchlist = { id: watchlistId, name: 'My Watchlist', assets: [] };
      mockPrismaService.watchlist.findUnique.mockResolvedValue(watchlist);
      mockPrismaService.watchlistAsset.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.watchlist.delete.mockResolvedValue(watchlist);

      const result = await service.remove(watchlistId);

      expect(result).toEqual(watchlist);
      expect(mockPrismaService.watchlistAsset.deleteMany).toHaveBeenCalledWith({
        where: { watchlistId },
      });
    });
  });
});
