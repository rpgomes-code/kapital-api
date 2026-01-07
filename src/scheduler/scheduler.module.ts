import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PortfolioSnapshotJob } from './jobs/portfolio-snapshot.job';
import { PriceCacheUpdateJob } from './jobs/price-cache-update.job';
import { DividendDetectionJob } from './jobs/dividend-detection.job';
import { AssetEnrichmentJob } from './jobs/asset-enrichment.job';
import { CorporateActionJob } from './jobs/corporate-action.job';
import { AlertCheckJob } from './jobs/alert-check.job';
import { PriceCacheModule } from '../price-cache/price-cache.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { CorporateActionsModule } from '../corporate-actions/corporate-actions.module';
import { AssetEnrichmentModule } from '../asset-enrichment/asset-enrichment.module';
import { YahooFinanceModule } from '../yahoo-finance/yahoo-finance.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PriceCacheModule,
    PortfolioModule,
    CorporateActionsModule,
    AssetEnrichmentModule,
    YahooFinanceModule,
    AlertsModule,
  ],
  providers: [
    PortfolioSnapshotJob,
    PriceCacheUpdateJob,
    DividendDetectionJob,
    AssetEnrichmentJob,
    CorporateActionJob,
    AlertCheckJob,
  ],
  exports: [
    PortfolioSnapshotJob,
    PriceCacheUpdateJob,
    DividendDetectionJob,
    AssetEnrichmentJob,
    CorporateActionJob,
    AlertCheckJob,
  ],
})
export class SchedulerModule {}
