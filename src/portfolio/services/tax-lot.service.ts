// src/portfolio/services/tax-lot.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { YahooFinanceService } from '../../yahoo-finance/yahoo-finance.service';
import { TransactionType } from '../../generated/prisma/client';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace';
import {
  TaxLotDto,
  AssetTaxLotsDto,
  RealizedGainDto,
  RealizedGainsSummaryDto,
  TaxLossHarvestingOpportunityDto,
  TaxLossHarvestingSummaryDto,
  CostBasisMethod,
  GainType,
} from '../dto/tax-lot.dto';

interface TaxLot {
  id: number;
  assetId: number;
  acquisitionDate: Date;
  quantity: Decimal;
  costPerShare: Decimal;
  transactionId: number;
}

@Injectable()
export class TaxLotService {
  private readonly LONG_TERM_DAYS = 365; // Days to qualify for long-term capital gains

  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
  ) {}

  /**
   * Get all tax lots for a user
   */
  async getAllTaxLots(userId: string): Promise<AssetTaxLotsDto[]> {
    const lots = await this.buildTaxLots(userId);
    const assetIds = [...new Set(lots.map((l) => l.assetId))];

    // Get assets info
    const assets = await this.prisma.asset.findMany({
      where: { id: { in: assetIds } },
    });
    const assetMap = new Map(assets.map((a) => [a.id, a]));

    // Get current prices
    const symbols = assets.map((a) => a.yahooSymbol);
    const quotes = await this.yahooFinance.getQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    // Group lots by asset
    const lotsByAsset = new Map<number, TaxLot[]>();
    for (const lot of lots) {
      const existing = lotsByAsset.get(lot.assetId) || [];
      existing.push(lot);
      lotsByAsset.set(lot.assetId, existing);
    }

    const result: AssetTaxLotsDto[] = [];

    lotsByAsset.forEach((assetLots, assetId) => {
      const asset = assetMap.get(assetId);
      if (!asset) return;

      const quote = quoteMap.get(asset.yahooSymbol);
      const currentPrice = quote?.regularMarketPrice || 0;

      let totalQuantity = 0;
      let totalCostBasis = 0;

      const lotDtos: TaxLotDto[] = assetLots.map((lot, index) => {
        const quantity = lot.quantity.toNumber();
        const costPerShare = lot.costPerShare.toNumber();
        const totalCost = quantity * costPerShare;
        const currentValue = quantity * currentPrice;
        const unrealizedGain = currentValue - totalCost;
        const daysHeld = this.calculateDaysHeld(lot.acquisitionDate);

        totalQuantity += quantity;
        totalCostBasis += totalCost;

        return {
          id: lot.id,
          assetId: lot.assetId,
          symbol: asset.symbol,
          acquisitionDate: lot.acquisitionDate.toISOString().split('T')[0],
          quantity,
          costPerShare,
          totalCostBasis: totalCost,
          currentPrice,
          currentValue,
          unrealizedGain,
          unrealizedGainPercent: totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0,
          holdingPeriod: daysHeld >= this.LONG_TERM_DAYS ? 'long-term' : 'short-term',
          daysHeld,
        };
      });

      const totalCurrentValue = totalQuantity * currentPrice;
      const totalUnrealizedGain = totalCurrentValue - totalCostBasis;

      result.push({
        assetId,
        symbol: asset.symbol,
        name: asset.name,
        totalQuantity,
        totalCostBasis,
        totalCurrentValue,
        totalUnrealizedGain,
        lots: lotDtos,
      });
    });

    return result;
  }

  /**
   * Get tax lots for a specific asset
   */
  async getTaxLotsForAsset(userId: string, assetId: number): Promise<AssetTaxLotsDto | null> {
    const allLots = await this.getAllTaxLots(userId);
    return allLots.find((l) => l.assetId === assetId) || null;
  }

  /**
   * Get realized gains/losses for a user
   */
  async getRealizedGains(
    userId: string,
    year?: number,
    gainType: GainType = GainType.ALL,
  ): Promise<RealizedGainsSummaryDto> {
    const targetYear = year || new Date().getFullYear();

    const sellTransactions = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
        type: TransactionType.SELL,
        executedAt: {
          gte: new Date(`${targetYear}-01-01`),
          lt: new Date(`${targetYear + 1}-01-01`),
        },
      },
      include: { asset: true },
      orderBy: { executedAt: 'asc' },
    });

    // We need to calculate the cost basis for each sale using FIFO
    const allTransactions = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
        executedAt: {
          lt: new Date(`${targetYear + 1}-01-01`), // All transactions before end of year
        },
      },
      include: { asset: true },
      orderBy: { executedAt: 'asc' },
    });

    // Track lots by asset
    const lotsByAsset = new Map<
      number,
      Array<{ quantity: Decimal; price: Decimal; date: Date }>
    >();

    const realizedGains: RealizedGainDto[] = [];
    let totalGains = 0;
    let totalLosses = 0;
    let shortTermGains = 0;
    let shortTermLosses = 0;
    let longTermGains = 0;
    let longTermLosses = 0;

    for (const tx of allTransactions) {
      if (tx.type === TransactionType.BUY) {
        const assetLots = lotsByAsset.get(tx.assetId) || [];
        assetLots.push({
          quantity: tx.quantity,
          price: tx.price,
          date: tx.executedAt,
        });
        lotsByAsset.set(tx.assetId, assetLots);
      } else if (tx.type === TransactionType.SELL) {
        const assetLots = lotsByAsset.get(tx.assetId) || [];
        let remainingToSell = tx.quantity;
        const saleDate = tx.executedAt;

        // Only include in report if sale is in target year
        const includeInReport =
          saleDate >= new Date(`${targetYear}-01-01`) &&
          saleDate < new Date(`${targetYear + 1}-01-01`);

        while (remainingToSell.gt(0) && assetLots.length > 0) {
          const oldestLot = assetLots[0];
          const sellQuantity = Decimal.min(remainingToSell, oldestLot.quantity);
          const costBasis = sellQuantity.mul(oldestLot.price).toNumber();
          const proceeds = sellQuantity.mul(tx.price).toNumber();
          const gain = proceeds - costBasis;
          const daysHeld = this.calculateDaysHeld(oldestLot.date, saleDate);
          const isLongTerm = daysHeld >= this.LONG_TERM_DAYS;

          if (includeInReport) {
            const matchesFilter =
              gainType === GainType.ALL ||
              (gainType === GainType.SHORT_TERM && !isLongTerm) ||
              (gainType === GainType.LONG_TERM && isLongTerm);

            if (matchesFilter) {
              realizedGains.push({
                transactionId: tx.id,
                symbol: tx.asset.symbol,
                saleDate: saleDate.toISOString().split('T')[0],
                acquisitionDate: oldestLot.date.toISOString().split('T')[0],
                quantity: sellQuantity.toNumber(),
                costPerShare: oldestLot.price.toNumber(),
                costBasis,
                salePrice: tx.price.toNumber(),
                proceeds,
                realizedGain: gain,
                realizedGainPercent: costBasis > 0 ? (gain / costBasis) * 100 : 0,
                holdingPeriod: isLongTerm ? 'long-term' : 'short-term',
                daysHeld,
              });
            }

            // Accumulate totals
            if (gain >= 0) {
              totalGains += gain;
              if (isLongTerm) longTermGains += gain;
              else shortTermGains += gain;
            } else {
              totalLosses += gain;
              if (isLongTerm) longTermLosses += gain;
              else shortTermLosses += gain;
            }
          }

          // Update lot
          if (oldestLot.quantity.lte(remainingToSell)) {
            remainingToSell = remainingToSell.sub(oldestLot.quantity);
            assetLots.shift();
          } else {
            oldestLot.quantity = oldestLot.quantity.sub(remainingToSell);
            remainingToSell = new Decimal(0);
          }
        }
      }
    }

    return {
      year: targetYear,
      totalGains,
      totalLosses,
      netGain: totalGains + totalLosses,
      shortTermGains,
      shortTermLosses,
      longTermGains,
      longTermLosses,
      transactions: realizedGains,
    };
  }

  /**
   * Get tax loss harvesting opportunities
   */
  async getTaxLossHarvestingOpportunities(
    userId: string,
  ): Promise<TaxLossHarvestingSummaryDto> {
    const allTaxLots = await this.getAllTaxLots(userId);
    const opportunities: TaxLossHarvestingOpportunityDto[] = [];
    let totalHarvestableLosses = 0;

    for (const assetLots of allTaxLots) {
      if (assetLots.totalUnrealizedGain < 0) {
        // This is a loss position
        const lossPercent =
          (assetLots.totalUnrealizedGain / assetLots.totalCostBasis) * 100;

        // Only suggest if loss is significant (> 5%)
        if (lossPercent < -5) {
          totalHarvestableLosses += assetLots.totalUnrealizedGain;

          // Get suggested replacements (similar assets)
          const replacements = await this.getSuggestedReplacements(assetLots.assetId);

          opportunities.push({
            assetId: assetLots.assetId,
            symbol: assetLots.symbol,
            name: assetLots.name,
            unrealizedLoss: assetLots.totalUnrealizedGain,
            unrealizedLossPercent: lossPercent,
            currentValue: assetLots.totalCurrentValue,
            costBasis: assetLots.totalCostBasis,
            quantity: assetLots.totalQuantity,
            suggestedReplacements: replacements,
          });
        }
      }
    }

    // Check for wash sale warnings
    const washSaleWarnings = await this.checkWashSaleRisk(userId);

    // Sort by largest loss first
    opportunities.sort((a, b) => a.unrealizedLoss - b.unrealizedLoss);

    return {
      totalHarvestableLosses,
      positionsWithLosses: opportunities.length,
      opportunities,
      washSaleWarnings,
    };
  }

  /**
   * Calculate what-if for selling with different cost basis methods
   */
  async compareSellingMethods(
    userId: string,
    assetId: number,
    quantityToSell: number,
    salePrice: number,
  ): Promise<Record<CostBasisMethod, { costBasis: number; gain: number; isLongTerm: boolean }>> {
    const lots = await this.buildTaxLots(userId);
    const assetLots = lots
      .filter((l) => l.assetId === assetId)
      .sort((a, b) => a.acquisitionDate.getTime() - b.acquisitionDate.getTime());

    const today = new Date();
    const proceeds = quantityToSell * salePrice;

    const results: Record<
      CostBasisMethod,
      { costBasis: number; gain: number; isLongTerm: boolean }
    > = {
      [CostBasisMethod.FIFO]: { costBasis: 0, gain: 0, isLongTerm: true },
      [CostBasisMethod.LIFO]: { costBasis: 0, gain: 0, isLongTerm: true },
      [CostBasisMethod.HIFO]: { costBasis: 0, gain: 0, isLongTerm: true },
      [CostBasisMethod.AVERAGE]: { costBasis: 0, gain: 0, isLongTerm: true },
      [CostBasisMethod.SPECIFIC]: { costBasis: 0, gain: 0, isLongTerm: true },
    };

    // FIFO (First In, First Out)
    let remaining = quantityToSell;
    let costBasis = 0;
    let allLongTerm = true;
    for (const lot of assetLots) {
      if (remaining <= 0) break;
      const qty = Math.min(remaining, lot.quantity.toNumber());
      costBasis += qty * lot.costPerShare.toNumber();
      if (this.calculateDaysHeld(lot.acquisitionDate, today) < this.LONG_TERM_DAYS) {
        allLongTerm = false;
      }
      remaining -= qty;
    }
    results[CostBasisMethod.FIFO] = {
      costBasis,
      gain: proceeds - costBasis,
      isLongTerm: allLongTerm,
    };

    // LIFO (Last In, First Out)
    const lifoLots = [...assetLots].reverse();
    remaining = quantityToSell;
    costBasis = 0;
    allLongTerm = true;
    for (const lot of lifoLots) {
      if (remaining <= 0) break;
      const qty = Math.min(remaining, lot.quantity.toNumber());
      costBasis += qty * lot.costPerShare.toNumber();
      if (this.calculateDaysHeld(lot.acquisitionDate, today) < this.LONG_TERM_DAYS) {
        allLongTerm = false;
      }
      remaining -= qty;
    }
    results[CostBasisMethod.LIFO] = {
      costBasis,
      gain: proceeds - costBasis,
      isLongTerm: allLongTerm,
    };

    // HIFO (Highest In, First Out)
    const hifoLots = [...assetLots].sort(
      (a, b) => b.costPerShare.toNumber() - a.costPerShare.toNumber(),
    );
    remaining = quantityToSell;
    costBasis = 0;
    allLongTerm = true;
    for (const lot of hifoLots) {
      if (remaining <= 0) break;
      const qty = Math.min(remaining, lot.quantity.toNumber());
      costBasis += qty * lot.costPerShare.toNumber();
      if (this.calculateDaysHeld(lot.acquisitionDate, today) < this.LONG_TERM_DAYS) {
        allLongTerm = false;
      }
      remaining -= qty;
    }
    results[CostBasisMethod.HIFO] = {
      costBasis,
      gain: proceeds - costBasis,
      isLongTerm: allLongTerm,
    };

    // AVERAGE
    const totalQuantity = assetLots.reduce((sum, l) => sum + l.quantity.toNumber(), 0);
    const totalCost = assetLots.reduce(
      (sum, l) => sum + l.quantity.toNumber() * l.costPerShare.toNumber(),
      0,
    );
    const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    costBasis = quantityToSell * avgCost;
    // For average, use weighted holding period
    const weightedDays = assetLots.reduce(
      (sum, l) =>
        sum +
        (l.quantity.toNumber() / totalQuantity) *
          this.calculateDaysHeld(l.acquisitionDate, today),
      0,
    );
    results[CostBasisMethod.AVERAGE] = {
      costBasis,
      gain: proceeds - costBasis,
      isLongTerm: weightedDays >= this.LONG_TERM_DAYS,
    };

    // SPECIFIC - same as HIFO for now (user would need to specify)
    results[CostBasisMethod.SPECIFIC] = { ...results[CostBasisMethod.HIFO] };

    return results;
  }

  /**
   * Build tax lots from transactions
   */
  private async buildTaxLots(userId: string): Promise<TaxLot[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
      },
      orderBy: { executedAt: 'asc' },
    });

    const lotsByAsset = new Map<number, TaxLot[]>();
    let lotId = 1;

    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        const assetLots = lotsByAsset.get(tx.assetId) || [];
        assetLots.push({
          id: lotId++,
          assetId: tx.assetId,
          acquisitionDate: tx.executedAt,
          quantity: tx.quantity,
          costPerShare: tx.price,
          transactionId: tx.id,
        });
        lotsByAsset.set(tx.assetId, assetLots);
      } else if (tx.type === TransactionType.SELL) {
        const assetLots = lotsByAsset.get(tx.assetId) || [];
        let remainingToSell = tx.quantity;

        // FIFO: sell from oldest lots first
        while (remainingToSell.gt(0) && assetLots.length > 0) {
          const oldestLot = assetLots[0];
          if (oldestLot.quantity.lte(remainingToSell)) {
            remainingToSell = remainingToSell.sub(oldestLot.quantity);
            assetLots.shift();
          } else {
            oldestLot.quantity = oldestLot.quantity.sub(remainingToSell);
            remainingToSell = new Decimal(0);
          }
        }
      }
    }

    // Flatten all remaining lots
    const allLots: TaxLot[] = [];
    lotsByAsset.forEach((lots) => {
      for (const lot of lots) {
        if (lot.quantity.gt(0)) {
          allLots.push(lot);
        }
      }
    });

    return allLots;
  }

  /**
   * Calculate days held for a position
   */
  private calculateDaysHeld(acquisitionDate: Date, asOfDate: Date = new Date()): number {
    const diff = asOfDate.getTime() - acquisitionDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Get suggested replacement securities for tax-loss harvesting
   */
  private async getSuggestedReplacements(assetId: number): Promise<string[]> {
    try {
      const asset = await this.prisma.asset.findUnique({
        where: { id: assetId },
      });

      if (!asset) return [];

      // Get recommendations from Yahoo Finance
      const recommendations = await this.yahooFinance.getRecommendations(
        asset.yahooSymbol,
      );

      // Return top 3 that aren't "substantially identical"
      // Note: In reality, you'd need more sophisticated logic to avoid wash sales
      if (!recommendations || !recommendations.recommendedSymbols) {
        return [];
      }

      return recommendations.recommendedSymbols
        .filter((r) => r.symbol !== asset.symbol)
        .slice(0, 3)
        .map((r) => r.symbol);
    } catch (error) {
      return [];
    }
  }

  /**
   * Check for wash sale risk
   */
  private async checkWashSaleRisk(userId: string): Promise<string[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get recent sells
    const recentSells = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
        type: TransactionType.SELL,
        executedAt: {
          gte: thirtyDaysAgo,
        },
      },
      include: { asset: true },
    });

    // Get recent buys
    const recentBuys = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
        type: TransactionType.BUY,
        executedAt: {
          gte: thirtyDaysAgo,
        },
      },
      include: { asset: true },
    });

    const warnings: string[] = [];

    // Check for matching sells and buys
    for (const sell of recentSells) {
      const matchingBuy = recentBuys.find((buy) => buy.assetId === sell.assetId);
      if (matchingBuy) {
        const daysDiff = Math.abs(
          (sell.executedAt.getTime() - matchingBuy.executedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (daysDiff <= 30) {
          warnings.push(
            `Potential wash sale: ${sell.asset.symbol} sold and repurchased within 30 days`,
          );
        }
      }
    }

    return warnings;
  }
}
