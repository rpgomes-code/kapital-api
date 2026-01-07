import { Test, TestingModule } from '@nestjs/testing';
import { BrokersService } from './brokers.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BrokersService', () => {
  let service: BrokersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrokersService,
        {
          provide: PrismaService,
          useValue: {
            broker: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
            userBroker: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
          },
        },
      ],
    }).compile();
    service = module.get<BrokersService>(BrokersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
