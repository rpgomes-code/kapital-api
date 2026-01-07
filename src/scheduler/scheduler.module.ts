import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PortfolioSnapshotJob } from './jobs/portfolio-snapshot.job';
import { PriceCacheUpdateJob } from './jobs/price-cache-update.job';
import { DividendDetectionJob } from './jobs/dividend-detection.job';
import { AssetEnrichmentJob } from './jobs/asset-enrichment.job';
import { CorporateActionJob } from './jobs/corporate-action.job';
import { PriceCacheModule } from '../price-cache/price-cache.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { CorporateActionsModule } from '../corporate-actions/corporate-actions.module';
import { AssetEnrichmentModule } from '../asset-enrichment/asset-enrichment.module';
import { YahooFinanceModule } from '../yahoo-finance/yahoo-finance.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PriceCacheModule,
    PortfolioModule,
    CorporateActionsModule,
    AssetEnrichmentModule,
    YahooFinanceModule,
  ],
  providers: [
    PortfolioSnapshotJob,
    PriceCacheUpdateJob,
    DividendDetectionJob,
    AssetEnrichmentJob,
    CorporateActionJob,
  ],
  exports: [
    PortfolioSnapshotJob,
    PriceCacheUpdateJob,
    DividendDetectionJob,
    AssetEnrichmentJob,
    CorporateActionJob,
  ],
})
export class SchedulerModule {}
