// src/portfolio/portfolio.module.ts
import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { YahooFinanceModule } from '../yahoo-finance/yahoo-finance.module';
import { AnalyticsService } from './services/analytics.service';
import { SnapshotService } from './services/snapshot.service';
import { DividendService } from './services/dividend.service';
import { TaxLotService } from './services/tax-lot.service';
import { CurrencyService } from './services/currency.service';

@Module({
  imports: [YahooFinanceModule],
  controllers: [PortfolioController],
  providers: [
    PortfolioService,
    AnalyticsService,
    SnapshotService,
    DividendService,
    TaxLotService,
    CurrencyService,
  ],
  exports: [
    PortfolioService,
    AnalyticsService,
    SnapshotService,
    DividendService,
    TaxLotService,
    CurrencyService,
  ],
})
export class PortfolioModule {}
