import { Test, TestingModule } from '@nestjs/testing';
import { BrokersController } from './brokers.controller';
import { BrokersService } from './brokers.service';

describe('BrokersController', () => {
  let controller: BrokersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrokersController],
      providers: [
        {
          provide: BrokersService,
          useValue: {
            create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), findByPublicId: jest.fn(),
            update: jest.fn(), remove: jest.fn(), linkToUser: jest.fn(), getUserBrokers: jest.fn(),
          },
        },
      ],
    }).compile();
    controller = module.get<BrokersController>(BrokersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
