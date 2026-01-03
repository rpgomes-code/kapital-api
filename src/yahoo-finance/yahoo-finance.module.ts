// src/yahoo-finance/yahoo-finance.module.ts
import { Module } from '@nestjs/common';
import { YahooFinanceService } from './yahoo-finance.service';
import { YahooFinanceController } from './yahoo-finance.controller';

@Module({
  providers: [YahooFinanceService],
  controllers: [YahooFinanceController],
  exports: [YahooFinanceService],
})
export class YahooFinanceModule {}
