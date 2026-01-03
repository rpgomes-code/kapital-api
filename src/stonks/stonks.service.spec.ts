import { Test, TestingModule } from '@nestjs/testing';
import { StonksService } from './stonks.service';

describe('StonksService', () => {
  let service: StonksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StonksService],
    }).compile();

    service = module.get<StonksService>(StonksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
