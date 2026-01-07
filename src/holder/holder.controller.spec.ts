import { Test, TestingModule } from '@nestjs/testing';
import { HolderController } from './holder.controller';
import { HolderService } from './holder.service';

describe('HolderController', () => {
  let controller: HolderController;
  let holderService: HolderService;

  const mockHolderService = {
    getPortfolio: jest.fn(),
    addTransaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HolderController],
      providers: [
        {
          provide: HolderService,
          useValue: mockHolderService,
        },
      ],
    }).compile();

    controller = module.get<HolderController>(HolderController);
    holderService = module.get<HolderService>(HolderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPortfolio', () => {
    it('should return portfolio for a user', async () => {
      const userId = 'user-123';
      const expectedResult = [
        {
          id: 1,
          userId,
          accounts: [
            {
              id: 1,
              transactions: [
                { id: 1, assetId: 1, quantity: 10, asset: { symbol: 'AAPL' } },
              ],
            },
          ],
        },
      ];
      mockHolderService.getPortfolio.mockResolvedValue(expectedResult);

      const result = await controller.getPortfolio(userId);

      expect(result).toEqual(expectedResult);
      expect(mockHolderService.getPortfolio).toHaveBeenCalledWith(userId);
    });
  });

  describe('addTransaction', () => {
    it('should add a transaction', async () => {
      const transactionData = {
        accountId: 1,
        assetId: 1,
        type: 'BUY',
        quantity: 10,
        price: 150.0,
        currency: 'USD',
        executedAt: new Date('2023-01-15'),
      };
      const expectedResult = { id: 1, ...transactionData };
      mockHolderService.addTransaction.mockResolvedValue(expectedResult);

      const result = await controller.addTransaction(transactionData);

      expect(result).toEqual(expectedResult);
      expect(mockHolderService.addTransaction).toHaveBeenCalledWith(transactionData);
    });
  });
});
