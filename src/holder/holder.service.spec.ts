import { Test, TestingModule } from '@nestjs/testing';
import { HolderService } from './holder.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HolderService', () => {
  let service: HolderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HolderService,
        {
          provide: PrismaService,
          useValue: {
            holder: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
          },
        },
      ],
    }).compile();
    service = module.get<HolderService>(HolderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
