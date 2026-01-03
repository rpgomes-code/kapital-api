import { Test, TestingModule } from '@nestjs/testing';
import { StonksController } from './stonks.controller';

describe('StonksController', () => {
  let controller: StonksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StonksController],
    }).compile();

    controller = module.get<StonksController>(StonksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
