import { Test, TestingModule } from '@nestjs/testing';
import { WatchlistsController } from './watchlists.controller';
import { WatchlistsService } from './watchlists.service';

describe('WatchlistsController', () => {
  let controller: WatchlistsController;
  let watchlistsService: WatchlistsService;

  const mockWatchlistsService = {
    create: jest.fn(),
    findByUser: jest.fn(),
    findOne: jest.fn(),
    addAsset: jest.fn(),
    removeAsset: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WatchlistsController],
      providers: [
        {
          provide: WatchlistsService,
          useValue: mockWatchlistsService,
        },
      ],
    }).compile();

    controller = module.get<WatchlistsController>(WatchlistsController);
    watchlistsService = module.get<WatchlistsService>(WatchlistsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a watchlist', async () => {
      const session = { user: { id: 'user-123' } } as any;
      const dto = { name: 'My Watchlist' };
      const expectedResult = { id: 1, name: 'My Watchlist', userId: 'user-123' };
      mockWatchlistsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(session, dto);

      expect(result).toEqual(expectedResult);
      expect(mockWatchlistsService.create).toHaveBeenCalledWith({
        ...dto,
        userId: 'user-123',
      });
    });
  });

  describe('findMyWatchlists', () => {
    it('should return user watchlists', async () => {
      const session = { user: { id: 'user-123' } } as any;
      const expectedResult = [
        { id: 1, name: 'Watchlist 1', userId: 'user-123' },
        { id: 2, name: 'Watchlist 2', userId: 'user-123' },
      ];
      mockWatchlistsService.findByUser.mockResolvedValue(expectedResult);

      const result = await controller.findMyWatchlists(session);

      expect(result).toEqual(expectedResult);
      expect(mockWatchlistsService.findByUser).toHaveBeenCalledWith('user-123');
    });
  });

  describe('findOne', () => {
    it('should return a watchlist by id', async () => {
      const watchlistId = 1;
      const expectedResult = { id: watchlistId, name: 'My Watchlist' };
      mockWatchlistsService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(watchlistId);

      expect(result).toEqual(expectedResult);
      expect(mockWatchlistsService.findOne).toHaveBeenCalledWith(watchlistId);
    });
  });

  describe('addAsset', () => {
    it('should add an asset to watchlist', async () => {
      const watchlistId = 1;
      const dto = { assetId: 10 };
      const expectedResult = { watchlistId, assetId: 10 };
      mockWatchlistsService.addAsset.mockResolvedValue(expectedResult);

      const result = await controller.addAsset(watchlistId, dto);

      expect(result).toEqual(expectedResult);
      expect(mockWatchlistsService.addAsset).toHaveBeenCalledWith(watchlistId, dto);
    });
  });

  describe('removeAsset', () => {
    it('should remove an asset from watchlist', async () => {
      const watchlistId = 1;
      const assetId = 10;
      mockWatchlistsService.removeAsset.mockResolvedValue({ success: true });

      const result = await controller.removeAsset(watchlistId, assetId);

      expect(result).toEqual({ success: true });
      expect(mockWatchlistsService.removeAsset).toHaveBeenCalledWith(watchlistId, assetId);
    });
  });

  describe('remove', () => {
    it('should remove a watchlist', async () => {
      const watchlistId = 1;
      mockWatchlistsService.remove.mockResolvedValue({ id: watchlistId });

      const result = await controller.remove(watchlistId);

      expect(result).toEqual({ id: watchlistId });
      expect(mockWatchlistsService.remove).toHaveBeenCalledWith(watchlistId);
    });
  });
});
