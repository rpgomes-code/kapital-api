import { Module } from '@nestjs/common';
import { AssetEnrichmentService } from './asset-enrichment.service';
import { YahooFinanceModule } from '../yahoo-finance/yahoo-finance.module';

@Module({
  imports: [YahooFinanceModule],
  providers: [AssetEnrichmentService],
  exports: [AssetEnrichmentService],
})
export class AssetEnrichmentModule {}
