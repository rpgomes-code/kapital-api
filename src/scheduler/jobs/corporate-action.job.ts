import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CorporateActionsService } from '../../corporate-actions/corporate-actions.service';
import { JobStatus, CorporateActionType } from '../../generated/prisma/client';

@Injectable()
export class CorporateActionJob {
  private readonly logger = new Logger(CorporateActionJob.name);

  constructor(
    private prisma: PrismaService,
    private corporateActionsService: CorporateActionsService,
  ) {}

  /**
   * Process pending corporate actions at 9:00 PM Eastern
   * Runs Monday-Friday only
   */
  @Cron('0 21 * * 1-5', {
    name: 'corporate-action-processing',
    timeZone: 'America/New_York',
  })
  async handleCorporateActionProcessing() {
    this.logger.log('Starting corporate action processing job');

    const jobRun = await this.prisma.jobRun.create({
      data: {
        jobName: 'corporate-action-processing',
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      // Get unprocessed corporate actions that are due (executedAt <= now)
      const unprocessedActions = await this.prisma.corporateAction.findMany({
        where: {
          isProcessed: false,
          executedAt: { lte: new Date() },
        },
        include: {
          asset: { select: { id: true, symbol: true } },
        },
        orderBy: { executedAt: 'asc' },
      });

      let processed = 0;
      let failed = 0;
      const results: Array<{
        id: number;
        symbol: string;
        type: string;
        success: boolean;
        itemsAffected?: number;
        error?: string;
      }> = [];

      for (const action of unprocessedActions) {
        try {
          let itemsAffected = 0;

          // Process based on type
          switch (action.type) {
            case CorporateActionType.SPLIT:
            case CorporateActionType.REVERSE_SPLIT:
              itemsAffected =
                await this.corporateActionsService.processSplit(action.id);
              break;
            case CorporateActionType.DIVIDEND:
            case CorporateActionType.SPECIAL_DIVIDEND:
              itemsAffected =
                await this.corporateActionsService.processDividend(action.id);
              break;
            default:
              // Mark other types as processed without action
              await this.prisma.corporateAction.update({
                where: { id: action.id },
                data: {
                  isProcessed: true,
                  processedAt: new Date(),
                },
              });
              this.logger.debug(
                `Marked ${action.type} action ${action.id} as processed (no action needed)`,
              );
          }

          processed++;
          results.push({
            id: action.id,
            symbol: action.asset.symbol,
            type: action.type,
            success: true,
            itemsAffected,
          });
        } catch (error) {
          failed++;
          results.push({
            id: action.id,
            symbol: action.asset.symbol,
            type: action.type,
            success: false,
            error: (error as Error).message,
          });
          this.logger.error(
            `Failed to process ${action.type} for ${action.asset.symbol}:`,
            error,
          );
        }
      }

      await this.prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          itemsProcessed: processed,
          metadata: {
            total: unprocessedActions.length,
            processed,
            failed,
            results: results.slice(0, 20), // Keep first 20 results
          },
        },
      });

      this.logger.log(
        `Corporate action processing complete: ${processed} processed, ${failed} failed out of ${unprocessedActions.length}`,
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
      this.logger.error('Corporate action processing job failed:', error);
    }
  }

  /**
   * Manual trigger for corporate action processing
   */
  async triggerManually(): Promise<{ processed: number; failed: number }> {
    this.logger.log('Manually triggering corporate action processing job');

    const unprocessedActions = await this.prisma.corporateAction.findMany({
      where: {
        isProcessed: false,
        executedAt: { lte: new Date() },
      },
      orderBy: { executedAt: 'asc' },
    });

    let processed = 0;
    let failed = 0;

    for (const action of unprocessedActions) {
      try {
        await this.corporateActionsService.processAction(action.id);
        processed++;
      } catch (error) {
        failed++;
        this.logger.error(
          `Failed to process corporate action ${action.id}:`,
          error,
        );
      }
    }

    return { processed, failed };
  }
}
