import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '../generated/prisma/internal/prismaNamespace';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
    },
    asset: {
      findUnique: jest.fn(),
    },
    transactionTag: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      accountId: 1,
      assetId: 1,
      type: 'BUY' as const,
      quantity: 10,
      price: 150.0,
      currency: 'USD',
      executedAt: '2024-01-15T10:00:00Z',
    };

    it('should create a BUY transaction', async () => {
      const account = { id: 1, name: 'Test Account' };
      const asset = { id: 1, symbol: 'AAPL' };
      const createdTransaction = {
        id: 1,
        ...createDto,
        quantity: new Decimal(10),
        price: new Decimal(150),
      };

      mockPrismaService.account.findUnique.mockResolvedValue(account);
      mockPrismaService.asset.findUnique.mockResolvedValue(asset);
      mockPrismaService.transaction.create.mockResolvedValue(createdTransaction);

      const result = await service.create(createDto);

      expect(result).toEqual(createdTransaction);
      expect(mockPrismaService.transaction.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if account not found', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if asset not found', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.asset.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should validate holdings for SELL transactions', async () => {
      const sellDto = { ...createDto, type: 'SELL' as const, quantity: 100 };
      const account = { id: 1, name: 'Test Account' };
      const asset = { id: 1, symbol: 'AAPL' };

      mockPrismaService.account.findUnique.mockResolvedValue(account);
      mockPrismaService.asset.findUnique.mockResolvedValue(asset);
      mockPrismaService.transaction.findMany.mockResolvedValue([
        { type: 'BUY', quantity: new Decimal(50) },
      ]);

      await expect(service.create(sellDto)).rejects.toThrow(BadRequestException);
    });

    it('should allow SELL when sufficient holdings exist', async () => {
      const sellDto = { ...createDto, type: 'SELL' as const, quantity: 5 };
      const account = { id: 1, name: 'Test Account' };
      const asset = { id: 1, symbol: 'AAPL' };

      mockPrismaService.account.findUnique.mockResolvedValue(account);
      mockPrismaService.asset.findUnique.mockResolvedValue(asset);
      mockPrismaService.transaction.findMany.mockResolvedValue([
        { type: 'BUY', quantity: new Decimal(10) },
      ]);
      mockPrismaService.transaction.create.mockResolvedValue({ id: 1, ...sellDto });

      const result = await service.create(sellDto);

      expect(result).toBeDefined();
    });
  });

  describe('findByUser', () => {
    it('should return paginated transactions for a user', async () => {
      const userId = 'user-123';
      const transactions = [
        { id: 1, type: 'BUY', quantity: new Decimal(10) },
        { id: 2, type: 'SELL', quantity: new Decimal(5) },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);
      mockPrismaService.transaction.count.mockResolvedValue(2);

      const result = await service.findByUser(userId, { page: 1, limit: 10 });

      expect(result.data).toEqual(transactions);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('findByAccount', () => {
    it('should return paginated transactions for an account', async () => {
      const accountId = 1;
      const transactions = [
        { id: 1, accountId, type: 'BUY' },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);
      mockPrismaService.transaction.count.mockResolvedValue(1);

      const result = await service.findByAccount(accountId, { page: 1, limit: 10 });

      expect(result.data).toEqual(transactions);
    });
  });

  describe('findAll', () => {
    it('should return filtered transactions', async () => {
      const userId = 'user-123';
      const filters = { accountId: 1, type: 'BUY' as const };
      const transactions = [{ id: 1, type: 'BUY' }];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);
      mockPrismaService.transaction.count.mockResolvedValue(1);

      const result = await service.findAll(userId, filters);

      expect(result.data).toEqual(transactions);
    });

    it('should filter by date range', async () => {
      const userId = 'user-123';
      const filters = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };
      const transactions = [{ id: 1, type: 'BUY' }];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactions);
      mockPrismaService.transaction.count.mockResolvedValue(1);

      const result = await service.findAll(userId, filters);

      expect(result.data).toEqual(transactions);
    });
  });

  describe('findOne', () => {
    it('should return a transaction by id', async () => {
      const transactionId = 1;
      const transaction = { id: transactionId, type: 'BUY' };

      mockPrismaService.transaction.findUnique.mockResolvedValue(transaction);

      const result = await service.findOne(transactionId);

      expect(result).toEqual(transaction);
    });

    it('should throw NotFoundException if transaction not found', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a transaction', async () => {
      const transactionId = 1;
      const updateDto = { quantity: 15, price: 160 };
      const existingTransaction = { id: transactionId, type: 'BUY' };
      const updatedTransaction = { ...existingTransaction, ...updateDto };

      mockPrismaService.transaction.findUnique.mockResolvedValue(existingTransaction);
      mockPrismaService.transaction.update.mockResolvedValue(updatedTransaction);

      const result = await service.update(transactionId, updateDto);

      expect(result.quantity).toBe(15);
    });

    it('should throw NotFoundException if transaction not found', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { quantity: 10 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a transaction', async () => {
      const transactionId = 1;
      const transaction = { id: transactionId, type: 'BUY' };

      mockPrismaService.transaction.findUnique.mockResolvedValue(transaction);
      mockPrismaService.transactionTag.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.transaction.delete.mockResolvedValue(transaction);

      const result = await service.remove(transactionId);

      expect(result).toEqual(transaction);
      expect(mockPrismaService.transactionTag.deleteMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if transaction not found', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addTag', () => {
    it('should add a tag to a transaction', async () => {
      const transactionId = 1;
      const tagId = 1;
      const result = { transactionId, tagId };

      mockPrismaService.transactionTag.create.mockResolvedValue(result);

      const tag = await service.addTag(transactionId, tagId);

      expect(tag).toEqual(result);
    });
  });

  describe('removeTag', () => {
    it('should remove a tag from a transaction', async () => {
      const transactionId = 1;
      const tagId = 1;

      mockPrismaService.transactionTag.delete.mockResolvedValue({ transactionId, tagId });

      const result = await service.removeTag(transactionId, tagId);

      expect(result).toBeDefined();
    });
  });
});
