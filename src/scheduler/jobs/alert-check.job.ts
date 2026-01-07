// src/scheduler/jobs/alert-check.job.ts
import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { YahooFinanceService } from '../../yahoo-finance/yahoo-finance.service';
import { AlertsService } from '../../alerts/alerts.service';
import { JobStatus, AlertType } from '../../generated/prisma/client';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace';

@Injectable()
export class AlertCheckJob {
  private readonly logger = new Logger(AlertCheckJob.name);

  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
    private alertsService: AlertsService,
    @Optional() @Inject(EventEmitter2) private eventEmitter?: EventEmitter2,
  ) {}

  /**
   * Check alerts every 2 minutes during market hours (9:30 AM - 4:00 PM ET)
   * Runs Monday-Friday only
   */
  @Cron('*/2 9-16 * * 1-5', {
    name: 'alert-check',
    timeZone: 'America/New_York',
  })
  async handleAlertCheck() {
    // Skip if outside core market hours (more precise check)
    const now = new Date();
    const etTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
    );
    const hours = etTime.getHours();
    const minutes = etTime.getMinutes();

    // Skip before 9:30 AM or after 4:00 PM ET
    if (hours < 9 || (hours === 9 && minutes < 30) || hours >= 16) {
      return;
    }

    this.logger.log('Starting alert check job');

    const jobRun = await this.prisma.jobRun.create({
      data: {
        jobName: 'alert-check',
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      // Get all active, untriggered alerts
      const activeAlerts = await this.alertsService.getActiveAlerts();

      if (activeAlerts.length === 0) {
        await this.completeJob(jobRun.id, 0, { message: 'No active alerts' });
        return;
      }

      // Group alerts by asset for efficient price fetching
      const alertsByAsset = new Map<
        string,
        (typeof activeAlerts)[number][]
      >();
      for (const alert of activeAlerts) {
        const symbol = alert.asset.yahooSymbol;
        if (!alertsByAsset.has(symbol)) {
          alertsByAsset.set(symbol, []);
        }
        alertsByAsset.get(symbol)!.push(alert);
      }

      // Batch fetch prices
      const symbols = Array.from(alertsByAsset.keys());
      const quotes = await this.yahooFinance.getQuotes(symbols);
      const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

      let triggeredCount = 0;
      const triggeredAlerts: Array<{
        alertId: number;
        userId: string;
        symbol: string;
        type: AlertType;
        targetValue: Decimal;
        currentPrice: number;
      }> = [];

      // Check each alert against current prices
      for (const [symbol, alerts] of alertsByAsset) {
        const quote = quoteMap.get(symbol);
        if (!quote || !quote.regularMarketPrice) continue;

        const currentPrice = quote.regularMarketPrice;
        const previousClose = quote.regularMarketPreviousClose || currentPrice;
        const volume = quote.regularMarketVolume || 0;

        for (const alert of alerts) {
          const isTriggered = this.checkAlertCondition(
            alert.type,
            new Decimal(alert.targetValue).toNumber(),
            currentPrice,
            previousClose,
            volume,
          );

          if (isTriggered) {
            const triggered =
              await this.alertsService.markAlertTriggered(alert.id);
            triggeredCount++;
            triggeredAlerts.push({
              alertId: alert.id,
              userId: alert.userId,
              symbol,
              type: alert.type,
              targetValue: alert.targetValue,
              currentPrice,
            });

            // Emit event for WebSocket notification
            if (this.eventEmitter) {
              this.eventEmitter.emit('alert.triggered', {
                userId: alert.userId,
                alert: triggered,
                currentPrice,
              });
            }

            this.logger.log(
              `Alert triggered: ${symbol} ${alert.type} @ ${alert.targetValue} (current: ${currentPrice})`,
            );
          }
        }
      }

      await this.completeJob(jobRun.id, triggeredCount, {
        alertsChecked: activeAlerts.length,
        symbolsFetched: symbols.length,
        triggeredAlerts,
      });

      this.logger.log(
        `Alert check complete: ${triggeredCount} triggered out of ${activeAlerts.length} active alerts`,
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
      this.logger.error('Alert check job failed:', error);
    }
  }

  private checkAlertCondition(
    type: AlertType,
    targetValue: number,
    currentPrice: number,
    previousClose: number,
    volume: number,
  ): boolean {
    switch (type) {
      case AlertType.PRICE_ABOVE:
        return currentPrice >= targetValue;

      case AlertType.PRICE_BELOW:
        return currentPrice <= targetValue;

      case AlertType.PERCENT_UP:
        const percentUp =
          ((currentPrice - previousClose) / previousClose) * 100;
        return percentUp >= targetValue;

      case AlertType.PERCENT_DOWN:
        const percentDown =
          ((previousClose - currentPrice) / previousClose) * 100;
        return percentDown >= targetValue;

      case AlertType.VOLUME_SPIKE:
        // targetValue represents volume threshold
        return volume >= targetValue;

      default:
        return false;
    }
  }

  private async completeJob(
    jobId: number,
    processed: number,
    metadata: object,
  ) {
    await this.prisma.jobRun.update({
      where: { id: jobId },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        itemsProcessed: processed,
        metadata,
      },
    });
  }

  /**
   * Manual trigger for alert checking
   */
  async triggerManually(): Promise<{ checked: number; triggered: number }> {
    this.logger.log('Manually triggering alert check job');

    const activeAlerts = await this.alertsService.getActiveAlerts();

    if (activeAlerts.length === 0) {
      return { checked: 0, triggered: 0 };
    }

    const alertsByAsset = new Map<string, (typeof activeAlerts)[number][]>();
    for (const alert of activeAlerts) {
      const symbol = alert.asset.yahooSymbol;
      if (!alertsByAsset.has(symbol)) {
        alertsByAsset.set(symbol, []);
      }
      alertsByAsset.get(symbol)!.push(alert);
    }

    const symbols = Array.from(alertsByAsset.keys());
    const quotes = await this.yahooFinance.getQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    let triggered = 0;

    for (const [symbol, alerts] of alertsByAsset) {
      const quote = quoteMap.get(symbol);
      if (!quote || !quote.regularMarketPrice) continue;

      const currentPrice = quote.regularMarketPrice;
      const previousClose = quote.regularMarketPreviousClose || currentPrice;
      const volume = quote.regularMarketVolume || 0;

      for (const alert of alerts) {
        const isTriggered = this.checkAlertCondition(
          alert.type,
          new Decimal(alert.targetValue).toNumber(),
          currentPrice,
          previousClose,
          volume,
        );

        if (isTriggered) {
          await this.alertsService.markAlertTriggered(alert.id);
          triggered++;
        }
      }
    }

    return { checked: activeAlerts.length, triggered };
  }
}
