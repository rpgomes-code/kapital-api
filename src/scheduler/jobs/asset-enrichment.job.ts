import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetEnrichmentService } from '../../asset-enrichment/asset-enrichment.service';
import { JobStatus, Prisma } from '../../generated/prisma/client';

@Injectable()
export class AssetEnrichmentJob {
  private readonly logger = new Logger(AssetEnrichmentJob.name);

  constructor(
    private prisma: PrismaService,
    private enrichmentService: AssetEnrichmentService,
  ) {}

  /**
   * Enrich assets with missing data at 8:00 PM Eastern
   * Runs Monday-Friday only
   */
  @Cron('0 20 * * 1-5', {
    name: 'asset-enrichment',
    timeZone: 'America/New_York',
  })
  async handleAssetEnrichment() {
    this.logger.log('Starting asset enrichment job');

    const jobRun = await this.prisma.jobRun.create({
      data: {
        jobName: 'asset-enrichment',
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      const result = await this.enrichmentService.enrichPendingAssets(50);

      await this.prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          itemsProcessed: result.enriched,
          metadata: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
        },
      });

      this.logger.log(
        `Asset enrichment complete: ${result.enriched} enriched, ${result.failed} failed`,
      );
    } catch (error) {
      await this.prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: JobStatus.FAILED,
          completedAt: new Date(),
          errorMessage: (error as Error).message,
        },
      });
      this.logger.error('Asset enrichment job failed:', error);
    }
  }

  /**
   * Manual trigger for asset enrichment
   */
  async triggerManually(limit?: number): Promise<{
    enriched: number;
    failed: number;
    skipped: number;
  }> {
    this.logger.log('Manually triggering asset enrichment job');
    return this.enrichmentService.enrichPendingAssets(limit || 50);
  }
}
