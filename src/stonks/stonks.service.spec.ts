import { Test, TestingModule } from '@nestjs/testing';
import { StonksService } from './stonks.service';
import { YahooFinanceService } from '../yahoo-finance/yahoo-finance.service';

describe('StonksService', () => {
  let service: StonksService;
  let yahooFinanceService: YahooFinanceService;

  const mockYahooFinanceService = {
    search: jest.fn(),
    getQuote: jest.fn(),
    getHistoricalData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StonksService,
        {
          provide: YahooFinanceService,
          useValue: mockYahooFinanceService,
        },
      ],
    }).compile();

    service = module.get<StonksService>(StonksService);
    yahooFinanceService = module.get<YahooFinanceService>(YahooFinanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchSymbol', () => {
    it('should search for a symbol', async () => {
      const query = 'AAPL';
      const expectedResult = {
        quotes: [{ symbol: 'AAPL', shortname: 'Apple Inc.' }],
      };
      mockYahooFinanceService.search.mockResolvedValue(expectedResult);

      const result = await service.searchSymbol(query);

      expect(result).toEqual(expectedResult);
      expect(mockYahooFinanceService.search).toHaveBeenCalledWith(query);
    });
  });

  describe('getQuote', () => {
    it('should get a stock quote', async () => {
      const symbol = 'AAPL';
      const expectedResult = {
        symbol: 'AAPL',
        regularMarketPrice: 150.0,
        currency: 'USD',
      };
      mockYahooFinanceService.getQuote.mockResolvedValue(expectedResult);

      const result = await service.getQuote(symbol);

      expect(result).toEqual(expectedResult);
      expect(mockYahooFinanceService.getQuote).toHaveBeenCalledWith(symbol);
    });
  });

  describe('getHistoricalData', () => {
    it('should get historical data', async () => {
      const symbol = 'AAPL';
      const from = '2023-01-01';
      const to = '2023-12-31';
      const expectedResult = [
        { date: new Date('2023-01-01'), close: 145.0 },
        { date: new Date('2023-12-31'), close: 155.0 },
      ];
      mockYahooFinanceService.getHistoricalData.mockResolvedValue(expectedResult);

      const result = await service.getHistoricalData(symbol, from, to);

      expect(result).toEqual(expectedResult);
      expect(mockYahooFinanceService.getHistoricalData).toHaveBeenCalledWith(
        symbol,
        new Date(from),
        new Date(to),
      );
    });
  });
});
