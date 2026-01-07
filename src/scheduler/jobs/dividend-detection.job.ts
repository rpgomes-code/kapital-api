import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { YahooFinanceService } from '../../yahoo-finance/yahoo-finance.service';
import { CorporateActionsService } from '../../corporate-actions/corporate-actions.service';
import { JobStatus, CorporateActionType } from '../../generated/prisma/client';

@Injectable()
export class DividendDetectionJob {
  private readonly logger = new Logger(DividendDetectionJob.name);

  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
    private corporateActionsService: CorporateActionsService,
  ) {}

  /**
   * Check for new dividends at 7:00 PM Eastern
   * Runs Monday-Friday only
   */
  @Cron('0 19 * * 1-5', {
    name: 'dividend-detection',
    timeZone: 'America/New_York',
  })
  async handleDividendDetection() {
    this.logger.log('Starting dividend detection job');

    const jobRun = await this.prisma.jobRun.create({
      data: {
        jobName: 'dividend-detection',
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      // Get all assets in user portfolios
      const assets = await this.prisma.asset.findMany({
        where: {
          transactions: { some: {} },
        },
        select: { id: true, yahooSymbol: true, symbol: true },
      });

      let detected = 0;
      let checked = 0;
      const errors: string[] = [];
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      for (const asset of assets) {
        try {
          const dividends = await this.yahooFinance.getDividendHistory(
            asset.yahooSymbol,
            oneMonthAgo,
          );

          for (const div of dividends) {
            // Check if this dividend is already recorded
            const divDate = new Date(div.date);
            const existing = await this.prisma.corporateAction.findFirst({
              where: {
                assetId: asset.id,
                type: CorporateActionType.DIVIDEND,
                executedAt: {
                  gte: new Date(divDate.getTime() - 86400000), // Within 1 day
                  lte: new Date(divDate.getTime() + 86400000),
                },
              },
            });

            if (!existing && div.dividends > 0) {
              await this.corporateActionsService.createCorporateAction({
                assetId: asset.id,
                type: CorporateActionType.DIVIDEND,
                value: div.dividends,
                executedAt: divDate.toISOString(),
                description: `Dividend detected for ${asset.symbol}`,
              });
              detected++;
              this.logger.debug(
                `Detected dividend for ${asset.symbol}: $${div.dividends} on ${divDate.toISOString().split('T')[0]}`,
              );
            }
          }
          checked++;
        } catch (error) {
          const errMsg = `Failed to check dividends for ${asset.symbol}: ${(error as Error).message}`;
          errors.push(errMsg);
          this.logger.warn(errMsg);
        }

        // Rate limiting
        await this.sleep(300);
      }

      await this.prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          itemsProcessed: detected,
          metadata: {
            assetsChecked: checked,
            dividendsDetected: detected,
            errors: errors.slice(0, 10), // Keep first 10 errors
          },
        },
      });

      this.logger.log(
        `Dividend detection complete: checked ${checked} assets, detected ${detected} new dividends`,
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
      this.logger.error('Dividend detection job failed:', error);
    }
  }

  /**
   * Manual trigger for dividend detection
   */
  async triggerManually(): Promise<{ checked: number; detected: number }> {
    this.logger.log('Manually triggering dividend detection job');

    const assets = await this.prisma.asset.findMany({
      where: {
        transactions: { some: {} },
      },
      select: { id: true, yahooSymbol: true, symbol: true },
    });

    let detected = 0;
    let checked = 0;
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    for (const asset of assets) {
      try {
        const dividends = await this.yahooFinance.getDividendHistory(
          asset.yahooSymbol,
          oneMonthAgo,
        );

        for (const div of dividends) {
          const divDate = new Date(div.date);
          const existing = await this.prisma.corporateAction.findFirst({
            where: {
              assetId: asset.id,
              type: CorporateActionType.DIVIDEND,
              executedAt: {
                gte: new Date(divDate.getTime() - 86400000),
                lte: new Date(divDate.getTime() + 86400000),
              },
            },
          });

          if (!existing && div.dividends > 0) {
            await this.corporateActionsService.createCorporateAction({
              assetId: asset.id,
              type: CorporateActionType.DIVIDEND,
              value: div.dividends,
              executedAt: divDate.toISOString(),
              description: `Dividend detected for ${asset.symbol}`,
            });
            detected++;
          }
        }
        checked++;
      } catch (error) {
        this.logger.warn(
          `Failed to check dividends for ${asset.symbol}:`,
          error,
        );
      }

      await this.sleep(300);
    }

    return { checked, detected };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
