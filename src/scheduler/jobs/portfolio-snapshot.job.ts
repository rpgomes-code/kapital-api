import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SnapshotService } from '../../portfolio/services/snapshot.service';
import { JobStatus } from '../../generated/prisma/client';

@Injectable()
export class PortfolioSnapshotJob {
  private readonly logger = new Logger(PortfolioSnapshotJob.name);

  constructor(
    private prisma: PrismaService,
    private snapshotService: SnapshotService,
  ) {}

  /**
   * Daily snapshot at 6:00 PM Eastern (after market close)
   * Runs Monday-Friday only
   */
  @Cron('0 18 * * 1-5', {
    name: 'daily-portfolio-snapshot',
    timeZone: 'America/New_York',
  })
  async handleDailySnapshot() {
    this.logger.log('Starting daily portfolio snapshot job');

    const jobRun = await this.prisma.jobRun.create({
      data: {
        jobName: 'daily-portfolio-snapshot',
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      // Get all users with holdings (users who have transactions)
      const users = await this.prisma.user.findMany({
        where: {
          userBrokers: {
            some: {
              accounts: {
                some: {
                  transactions: { some: {} },
                },
              },
            },
          },
        },
        select: { id: true },
      });

      let processed = 0;
      let failed = 0;

      for (const user of users) {
        try {
          await this.snapshotService.createDailySnapshot(user.id);
          processed++;
        } catch (error) {
          this.logger.error(`Failed snapshot for user ${user.id}:`, error);
          failed++;
        }
      }

      await this.prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          itemsProcessed: processed,
          metadata: { failed, total: users.length },
        },
      });

      this.logger.log(
        `Completed snapshots: ${processed} succeeded, ${failed} failed out of ${users.length} users`,
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
      this.logger.error('Portfolio snapshot job failed:', error);
    }
  }

  /**
   * Manual trigger for portfolio snapshot (useful for testing or catch-up)
   */
  async triggerManually(): Promise<{ processed: number; failed: number }> {
    this.logger.log('Manually triggering portfolio snapshot job');

    const users = await this.prisma.user.findMany({
      where: {
        userBrokers: {
          some: {
            accounts: {
              some: {
                transactions: { some: {} },
              },
            },
          },
        },
      },
      select: { id: true },
    });

    let processed = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await this.snapshotService.createDailySnapshot(user.id);
        processed++;
      } catch (error) {
        this.logger.error(`Failed snapshot for user ${user.id}:`, error);
        failed++;
      }
    }

    return { processed, failed };
  }
}
