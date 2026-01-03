import { Test, TestingModule } from '@nestjs/testing';
import { HolderService } from './holder.service';

describe('HolderService', () => {
  let service: HolderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HolderService],
    }).compile();

    service = module.get<HolderService>(HolderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
