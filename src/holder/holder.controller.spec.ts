import { Test, TestingModule } from '@nestjs/testing';
import { HolderController } from './holder.controller';

describe('HolderController', () => {
  let controller: HolderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HolderController],
    }).compile();

    controller = module.get<HolderController>(HolderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
