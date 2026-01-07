import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { PriceCacheService } from '../../price-cache/price-cache.service';
import { JobStatus } from '../../generated/prisma/client';

@Injectable()
export class PriceCacheUpdateJob {
  private readonly logger = new Logger(PriceCacheUpdateJob.name);

  constructor(
    private prisma: PrismaService,
    private priceCacheService: PriceCacheService,
  ) {}

  /**
   * Update price cache at 6:30 PM Eastern (after market close)
   * Runs Monday-Friday only
   */
  @Cron('30 18 * * 1-5', {
    name: 'price-cache-update',
    timeZone: 'America/New_York',
  })
  async handlePriceCacheUpdate() {
    this.logger.log('Starting price cache update job');

    const jobRun = await this.prisma.jobRun.create({
      data: {
        jobName: 'price-cache-update',
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      // Get all symbols from user holdings
      const holdingAssets = await this.prisma.asset.findMany({
        where: {
          transactions: { some: {} },
        },
        select: { yahooSymbol: true },
        distinct: ['yahooSymbol'],
      });

      const symbols = holdingAssets.map((h) => h.yahooSymbol);

      if (symbols.length === 0) {
        await this.prisma.jobRun.update({
          where: { id: jobRun.id },
          data: {
            status: JobStatus.COMPLETED,
            completedAt: new Date(),
            itemsProcessed: 0,
            metadata: { message: 'No symbols to update' },
          },
        });
        return;
      }

      const results = await this.priceCacheService.bulkUpdateCache(symbols);

      let successful = 0;
      let failed = 0;
      const resultsObj: Record<string, number> = {};

      results.forEach((count, symbol) => {
        resultsObj[symbol] = count;
        if (count >= 0) {
          successful++;
        } else {
          failed++;
        }
      });

      await this.prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          itemsProcessed: successful,
          metadata: { failed, total: symbols.length, results: resultsObj },
        },
      });

      this.logger.log(
        `Updated price cache: ${successful} succeeded, ${failed} failed out of ${symbols.length} symbols`,
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
      this.logger.error('Price cache update job failed:', error);
    }
  }

  /**
   * Manual trigger for price cache update
   */
  async triggerManually(): Promise<{ successful: number; failed: number }> {
    this.logger.log('Manually triggering price cache update job');

    const holdingAssets = await this.prisma.asset.findMany({
      where: {
        transactions: { some: {} },
      },
      select: { yahooSymbol: true },
      distinct: ['yahooSymbol'],
    });

    const symbols = holdingAssets.map((h) => h.yahooSymbol);

    if (symbols.length === 0) {
      return { successful: 0, failed: 0 };
    }

    const results = await this.priceCacheService.bulkUpdateCache(symbols);

    let successful = 0;
    let failed = 0;

    results.forEach((count) => {
      if (count >= 0) {
        successful++;
      } else {
        failed++;
      }
    });

    return { successful, failed };
  }
}
