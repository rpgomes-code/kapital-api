import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { YahooFinanceService } from '../yahoo-finance/yahoo-finance.service';
import { EnrichmentStatus, CorporateActionType } from '../generated/prisma/client';
import { Decimal } from '../generated/prisma/internal/prismaNamespace';

export interface EnrichmentResult {
  enriched: number;
  failed: number;
  skipped: number;
}

@Injectable()
export class AssetEnrichmentService {
  private readonly logger = new Logger(AssetEnrichmentService.name);

  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
  ) {}

  /**
   * Enrich a single asset with Yahoo Finance data
   */
  async enrichAsset(assetId: number): Promise<boolean> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      this.logger.warn(`Asset ${assetId} not found`);
      return false;
    }

    try {
      const summary = await this.yahooFinance.getQuoteSummary(
        asset.yahooSymbol,
        ['assetProfile', 'summaryDetail', 'price'],
      );

      if (!summary) {
        throw new Error('No data returned from Yahoo Finance');
      }

      const updateData: {
        name?: string;
        exchange?: string;
        sectorId?: number;
        industryId?: number;
      } = {};

      // Update name if available
      if (summary.price?.shortName) {
        updateData.name = summary.price.shortName;
      }

      // Update exchange if available
      if (summary.price?.exchange) {
        updateData.exchange = summary.price.exchange;
      }

      // Handle sector/industry
      if (summary.assetProfile?.sector) {
        const sector = await this.findOrCreateSector(
          summary.assetProfile.sector,
        );
        updateData.sectorId = sector.id;

        if (summary.assetProfile.industry) {
          const industry = await this.findOrCreateIndustry(
            summary.assetProfile.industry,
            sector.id,
          );
          updateData.industryId = industry.id;
        }
      }

      // Update asset if there's anything to update
      if (Object.keys(updateData).length > 0) {
        await this.prisma.asset.update({
          where: { id: assetId },
          data: updateData,
        });
      }

      // Update enrichment log
      await this.prisma.assetEnrichmentLog.upsert({
        where: { assetId },
        update: {
          lastEnriched: new Date(),
          status: EnrichmentStatus.SUCCESS,
          errorMessage: null,
          retryCount: 0,
        },
        create: {
          assetId,
          lastEnriched: new Date(),
          status: EnrichmentStatus.SUCCESS,
        },
      });

      this.logger.debug(`Successfully enriched asset ${asset.symbol}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to enrich asset ${asset.symbol}:`, error);

      // Update enrichment log with failure
      const log = await this.prisma.assetEnrichmentLog.findUnique({
        where: { assetId },
      });

      await this.prisma.assetEnrichmentLog.upsert({
        where: { assetId },
        update: {
          status: EnrichmentStatus.FAILED,
          errorMessage: (error as Error).message,
          retryCount: (log?.retryCount || 0) + 1,
        },
        create: {
          assetId,
          status: EnrichmentStatus.FAILED,
          errorMessage: (error as Error).message,
          retryCount: 1,
        },
      });

      return false;
    }
  }

  /**
   * Enrich all assets that are pending or need retry
   */
  async enrichPendingAssets(limit: number = 50): Promise<EnrichmentResult> {
    // Find assets needing enrichment:
    // 1. No enrichment log (never processed)
    // 2. Status is PENDING
    // 3. Status is FAILED with retryCount < 3
    // 4. Last enriched > 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const assets = await this.prisma.asset.findMany({
      where: {
        OR: [
          { enrichmentLog: null },
          { enrichmentLog: { status: EnrichmentStatus.PENDING } },
          {
            enrichmentLog: {
              status: EnrichmentStatus.FAILED,
              retryCount: { lt: 3 },
            },
          },
          {
            enrichmentLog: {
              status: EnrichmentStatus.SUCCESS,
              lastEnriched: { lt: thirtyDaysAgo },
            },
          },
        ],
      },
      take: limit,
      select: { id: true, symbol: true },
    });

    let enriched = 0;
    let failed = 0;

    for (const asset of assets) {
      const success = await this.enrichAsset(asset.id);
      if (success) {
        enriched++;
      } else {
        failed++;
      }

      // Rate limiting
      await this.sleep(500);
    }

    return {
      enriched,
      failed,
      skipped: 0,
    };
  }

  /**
   * Get enrichment status for all assets
   */
  async getEnrichmentStats(): Promise<{
    total: number;
    success: number;
    failed: number;
    pending: number;
    delisted: number;
    neverProcessed: number;
  }> {
    const [total, statusCounts, neverProcessed] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.assetEnrichmentLog.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.asset.count({
        where: { enrichmentLog: null },
      }),
    ]);

    const statusMap = new Map(
      statusCounts.map((s) => [s.status, s._count.status]),
    );

    return {
      total,
      success: statusMap.get(EnrichmentStatus.SUCCESS) || 0,
      failed: statusMap.get(EnrichmentStatus.FAILED) || 0,
      pending: statusMap.get(EnrichmentStatus.PENDING) || 0,
      delisted: statusMap.get(EnrichmentStatus.DELISTED) || 0,
      neverProcessed,
    };
  }

  /**
   * Mark asset as delisted
   */
  async markAsDelisted(assetId: number): Promise<void> {
    await this.prisma.assetEnrichmentLog.upsert({
      where: { assetId },
      update: { status: EnrichmentStatus.DELISTED },
      create: { assetId, status: EnrichmentStatus.DELISTED },
    });
  }

  /**
   * Handle symbol change
   */
  async handleSymbolChange(
    assetId: number,
    newSymbol: string,
    newYahooSymbol: string,
  ): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      this.logger.warn(`Asset ${assetId} not found for symbol change`);
      return;
    }

    // Create corporate action record
    await this.prisma.corporateAction.create({
      data: {
        assetId,
        type: CorporateActionType.SYMBOL_CHANGE,
        value: new Decimal(0),
        executedAt: new Date(),
        description: `Symbol changed from ${asset.symbol} to ${newSymbol}`,
        isProcessed: true,
        processedAt: new Date(),
      },
    });

    // Update the asset
    await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        symbol: newSymbol,
        yahooSymbol: newYahooSymbol,
      },
    });

    this.logger.log(
      `Updated symbol for asset ${assetId}: ${asset.symbol} -> ${newSymbol}`,
    );
  }

  /**
   * Trigger enrichment for specific assets
   */
  async triggerEnrichment(assetIds: number[]): Promise<EnrichmentResult> {
    let enriched = 0;
    let failed = 0;

    for (const assetId of assetIds) {
      const success = await this.enrichAsset(assetId);
      if (success) {
        enriched++;
      } else {
        failed++;
      }
      await this.sleep(500);
    }

    return {
      enriched,
      failed,
      skipped: 0,
    };
  }

  // Private helpers
  private async findOrCreateSector(name: string) {
    let sector = await this.prisma.sector.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (!sector) {
      sector = await this.prisma.sector.create({
        data: { name },
      });
    }

    return sector;
  }

  private async findOrCreateIndustry(name: string, sectorId: number) {
    let industry = await this.prisma.industry.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        sectorId,
      },
    });

    if (!industry) {
      industry = await this.prisma.industry.create({
        data: { name, sectorId },
      });
    }

    return industry;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
