import { Test, TestingModule } from '@nestjs/testing';
import { StonksController } from './stonks.controller';
import { StonksService } from './stonks.service';

describe('StonksController', () => {
  let controller: StonksController;
  let stonksService: StonksService;

  const mockStonksService = {
    searchSymbol: jest.fn(),
    getQuote: jest.fn(),
    getHistoricalData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StonksController],
      providers: [
        {
          provide: StonksService,
          useValue: mockStonksService,
        },
      ],
    }).compile();

    controller = module.get<StonksController>(StonksController);
    stonksService = module.get<StonksService>(StonksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('search', () => {
    it('should search for stocks', async () => {
      const query = 'Apple';
      const expectedResult = {
        quotes: [{ symbol: 'AAPL', shortname: 'Apple Inc.' }],
      };
      mockStonksService.searchSymbol.mockResolvedValue(expectedResult);

      const result = await controller.search(query);

      expect(result).toEqual(expectedResult);
      expect(mockStonksService.searchSymbol).toHaveBeenCalledWith(query);
    });
  });

  describe('quote', () => {
    it('should get a stock quote', async () => {
      const symbol = 'AAPL';
      const expectedResult = {
        symbol: 'AAPL',
        regularMarketPrice: 150.0,
      };
      mockStonksService.getQuote.mockResolvedValue(expectedResult);

      const result = await controller.quote(symbol);

      expect(result).toEqual(expectedResult);
      expect(mockStonksService.getQuote).toHaveBeenCalledWith(symbol);
    });
  });
});
