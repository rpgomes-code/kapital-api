import { Module } from '@nestjs/common';
import { PriceCacheService } from './price-cache.service';
import { PriceCacheController } from './price-cache.controller';
import { YahooFinanceModule } from '../yahoo-finance/yahoo-finance.module';

@Module({
  imports: [YahooFinanceModule],
  controllers: [PriceCacheController],
  providers: [PriceCacheService],
  exports: [PriceCacheService],
})
export class PriceCacheModule {}
