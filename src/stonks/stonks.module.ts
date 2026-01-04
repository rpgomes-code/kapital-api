import { Module } from '@nestjs/common';
import { StonksController } from './stonks.controller';
import { StonksService } from './stonks.service';
import { YahooFinanceModule } from '../yahoo-finance/yahoo-finance.module';

@Module({
  imports: [YahooFinanceModule],
  controllers: [StonksController],
  providers: [StonksService],
})
export class StonksModule {}
