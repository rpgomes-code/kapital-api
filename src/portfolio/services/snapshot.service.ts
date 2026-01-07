// src/portfolio/services/snapshot.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { YahooFinanceService } from '../../yahoo-finance/yahoo-finance.service';
import { TransactionType } from '../../generated/prisma/client';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace';
import {
  PortfolioHistoryDto,
  PortfolioSnapshotDto,
  DetailedSnapshotDto,
  HistoryInterval,
} from '../dto/portfolio-history.dto';

@Injectable()
export class SnapshotService {
  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
  ) {}

  /**
   * Create a portfolio snapshot for the current day
   */
  async createDailySnapshot(userId: string): Promise<PortfolioSnapshotDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if snapshot already exists for today
    const existing = await this.prisma.portfolioSnapshot.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (existing) {
      return this.formatSnapshot(existing);
    }

    // Calculate current portfolio state
    const portfolioData = await this.calculatePortfolioState(userId);

    // Get yesterday's snapshot for day change calculation
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const previousSnapshot = await this.prisma.portfolioSnapshot.findUnique({
      where: {
        userId_date: {
          userId,
          date: yesterday,
        },
      },
    });

    const dayChange = previousSnapshot
      ? portfolioData.totalValue - previousSnapshot.totalValue.toNumber()
      : 0;

    // Create the snapshot
    const snapshot = await this.prisma.portfolioSnapshot.create({
      data: {
        userId,
        date: today,
        totalValue: portfolioData.totalValue,
        totalCost: portfolioData.totalCost,
        dayChange,
        cashBalance: 0, // TODO: Implement cash tracking
      },
    });

    // Create holding snapshots
    for (const holding of portfolioData.holdings) {
      await this.prisma.holdingSnapshot.create({
        data: {
          snapshotId: snapshot.id,
          assetId: holding.assetId,
          quantity: holding.quantity,
          price: holding.currentPrice,
          value: holding.currentValue,
          costBasis: holding.costBasis,
        },
      });
    }

    return this.formatSnapshot(snapshot);
  }

  /**
   * Get portfolio history over a date range
   */
  async getPortfolioHistory(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    interval: HistoryInterval = HistoryInterval.DAILY,
  ): Promise<PortfolioHistoryDto> {
    const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const snapshots = await this.prisma.portfolioSnapshot.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Filter by interval
    const filteredSnapshots = this.filterByInterval(snapshots, interval);

    if (filteredSnapshots.length === 0) {
      return {
        snapshots: [],
        periodStart: start.toISOString().split('T')[0],
        periodEnd: end.toISOString().split('T')[0],
        startValue: 0,
        endValue: 0,
        totalChange: 0,
        totalChangePercent: 0,
        highValue: 0,
        lowValue: 0,
      };
    }

    const snapshotDtos: PortfolioSnapshotDto[] = filteredSnapshots.map((s) =>
      this.formatSnapshot(s),
    );

    const startValue = filteredSnapshots[0].totalValue.toNumber();
    const endValue = filteredSnapshots[filteredSnapshots.length - 1].totalValue.toNumber();
    const totalChange = endValue - startValue;
    const totalChangePercent = startValue > 0 ? (totalChange / startValue) * 100 : 0;

    const values = filteredSnapshots.map((s) => s.totalValue.toNumber());
    const highValue = Math.max(...values);
    const lowValue = Math.min(...values);

    return {
      snapshots: snapshotDtos,
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0],
      startValue,
      endValue,
      totalChange,
      totalChangePercent,
      highValue,
      lowValue,
    };
  }

  /**
   * Get a detailed snapshot for a specific date
   */
  async getDetailedSnapshot(
    userId: string,
    date: Date,
  ): Promise<DetailedSnapshotDto | null> {
    const snapshot = await this.prisma.portfolioSnapshot.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      include: {
        holdings: {
          include: {
            asset: true,
          },
        },
      },
    });

    if (!snapshot) return null;

    const totalValue = snapshot.totalValue.toNumber();

    return {
      date: snapshot.date.toISOString().split('T')[0],
      totalValue,
      totalCost: snapshot.totalCost.toNumber(),
      dayChange: snapshot.dayChange.toNumber(),
      dayChangePercent:
        totalValue - snapshot.dayChange.toNumber() > 0
          ? (snapshot.dayChange.toNumber() /
              (totalValue - snapshot.dayChange.toNumber())) *
            100
          : 0,
      unrealizedGain: totalValue - snapshot.totalCost.toNumber(),
      unrealizedGainPercent:
        snapshot.totalCost.toNumber() > 0
          ? ((totalValue - snapshot.totalCost.toNumber()) /
              snapshot.totalCost.toNumber()) *
            100
          : 0,
      cashBalance: snapshot.cashBalance.toNumber(),
      holdings: snapshot.holdings.map((h) => ({
        assetId: h.assetId,
        symbol: h.asset.symbol,
        quantity: h.quantity.toNumber(),
        price: h.price.toNumber(),
        value: h.value.toNumber(),
        costBasis: h.costBasis.toNumber(),
        unrealizedGain: h.value.toNumber() - h.costBasis.toNumber(),
        allocation: totalValue > 0 ? (h.value.toNumber() / totalValue) * 100 : 0,
      })),
    };
  }

  /**
   * Get latest snapshot or create one if none exists today
   */
  async getOrCreateLatestSnapshot(userId: string): Promise<PortfolioSnapshotDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.portfolioSnapshot.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (existing) {
      return this.formatSnapshot(existing);
    }

    return this.createDailySnapshot(userId);
  }

  /**
   * Backfill historical snapshots from transactions
   * This is useful for new users or when snapshots are missing
   */
  async backfillSnapshots(
    userId: string,
    startDate: Date,
    endDate?: Date,
  ): Promise<number> {
    const end = endDate || new Date();
    let created = 0;

    // Get all transactions in the range
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
        executedAt: {
          gte: startDate,
          lte: end,
        },
      },
      include: { asset: true },
      orderBy: { executedAt: 'asc' },
    });

    if (transactions.length === 0) return 0;

    // Group transactions by date
    const txByDate = new Map<string, any[]>();
    for (const tx of transactions) {
      const dateKey = tx.executedAt.toISOString().split('T')[0];
      const existing = txByDate.get(dateKey) || [];
      existing.push(tx);
      txByDate.set(dateKey, existing);
    }

    // Iterate through each day
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];

      // Check if snapshot exists
      const existing = await this.prisma.portfolioSnapshot.findUnique({
        where: {
          userId_date: {
            userId,
            date: new Date(current),
          },
        },
      });

      if (!existing) {
        // Calculate portfolio state for this date
        const stateAtDate = await this.calculateHistoricalState(userId, new Date(current));

        if (stateAtDate.totalValue > 0) {
          // Get previous day's value
          const prevDate = new Date(current);
          prevDate.setDate(prevDate.getDate() - 1);
          const prevSnapshot = await this.prisma.portfolioSnapshot.findUnique({
            where: {
              userId_date: {
                userId,
                date: prevDate,
              },
            },
          });

          const dayChange = prevSnapshot
            ? stateAtDate.totalValue - prevSnapshot.totalValue.toNumber()
            : 0;

          await this.prisma.portfolioSnapshot.create({
            data: {
              userId,
              date: new Date(current),
              totalValue: stateAtDate.totalValue,
              totalCost: stateAtDate.totalCost,
              dayChange,
              cashBalance: 0,
            },
          });
          created++;
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return created;
  }

  /**
   * Delete old snapshots (for cleanup/storage management)
   */
  async deleteOldSnapshots(userId: string, beforeDate: Date): Promise<number> {
    const result = await this.prisma.portfolioSnapshot.deleteMany({
      where: {
        userId,
        date: {
          lt: beforeDate,
        },
      },
    });
    return result.count;
  }

  /**
   * Calculate current portfolio state
   */
  private async calculatePortfolioState(userId: string): Promise<{
    totalValue: number;
    totalCost: number;
    holdings: Array<{
      assetId: number;
      quantity: number;
      currentPrice: number;
      currentValue: number;
      costBasis: number;
    }>;
  }> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
      },
      include: { asset: true },
      orderBy: { executedAt: 'asc' },
    });

    // Build holdings using FIFO
    const holdingsMap = new Map<
      number,
      {
        asset: any;
        lots: Array<{ quantity: Decimal; price: Decimal }>;
      }
    >();

    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          existing.lots.push({ quantity: tx.quantity, price: tx.price });
        } else {
          holdingsMap.set(tx.assetId, {
            asset: tx.asset,
            lots: [{ quantity: tx.quantity, price: tx.price }],
          });
        }
      } else if (tx.type === TransactionType.SELL) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          let remainingToSell = tx.quantity;
          while (remainingToSell.gt(0) && existing.lots.length > 0) {
            const oldestLot = existing.lots[0];
            if (oldestLot.quantity.lte(remainingToSell)) {
              remainingToSell = remainingToSell.sub(oldestLot.quantity);
              existing.lots.shift();
            } else {
              oldestLot.quantity = oldestLot.quantity.sub(remainingToSell);
              remainingToSell = new Decimal(0);
            }
          }
        }
      }
    }

    // Build holdings array
    const holdings: Array<{
      assetId: number;
      yahooSymbol: string;
      quantity: number;
      costBasis: number;
    }> = [];

    holdingsMap.forEach((data, assetId) => {
      const totalQuantity = data.lots.reduce(
        (sum, lot) => sum.add(lot.quantity),
        new Decimal(0),
      );

      if (totalQuantity.gt(0)) {
        const totalCost = data.lots.reduce(
          (sum, lot) => sum.add(lot.quantity.mul(lot.price)),
          new Decimal(0),
        );

        holdings.push({
          assetId,
          yahooSymbol: data.asset.yahooSymbol,
          quantity: totalQuantity.toNumber(),
          costBasis: totalCost.toNumber(),
        });
      }
    });

    // Fetch current prices
    const symbols = holdings.map((h) => h.yahooSymbol);
    if (symbols.length === 0) {
      return { totalValue: 0, totalCost: 0, holdings: [] };
    }

    const quotes = await this.yahooFinance.getQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    let totalValue = 0;
    let totalCost = 0;

    const enrichedHoldings = holdings.map((h) => {
      const quote = quoteMap.get(h.yahooSymbol);
      const currentPrice = quote?.regularMarketPrice || 0;
      const currentValue = h.quantity * currentPrice;

      totalValue += currentValue;
      totalCost += h.costBasis;

      return {
        assetId: h.assetId,
        quantity: h.quantity,
        currentPrice,
        currentValue,
        costBasis: h.costBasis,
      };
    });

    return { totalValue, totalCost, holdings: enrichedHoldings };
  }

  /**
   * Calculate portfolio state at a historical date
   * Uses transactions up to that date
   */
  private async calculateHistoricalState(
    userId: string,
    asOfDate: Date,
  ): Promise<{ totalValue: number; totalCost: number }> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
        executedAt: {
          lte: asOfDate,
        },
      },
      include: { asset: true },
      orderBy: { executedAt: 'asc' },
    });

    // Build holdings using FIFO
    const holdingsMap = new Map<
      number,
      {
        asset: any;
        lots: Array<{ quantity: Decimal; price: Decimal }>;
      }
    >();

    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          existing.lots.push({ quantity: tx.quantity, price: tx.price });
        } else {
          holdingsMap.set(tx.assetId, {
            asset: tx.asset,
            lots: [{ quantity: tx.quantity, price: tx.price }],
          });
        }
      } else if (tx.type === TransactionType.SELL) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          let remainingToSell = tx.quantity;
          while (remainingToSell.gt(0) && existing.lots.length > 0) {
            const oldestLot = existing.lots[0];
            if (oldestLot.quantity.lte(remainingToSell)) {
              remainingToSell = remainingToSell.sub(oldestLot.quantity);
              existing.lots.shift();
            } else {
              oldestLot.quantity = oldestLot.quantity.sub(remainingToSell);
              remainingToSell = new Decimal(0);
            }
          }
        }
      }
    }

    // Calculate total cost and approximate value using last known prices
    let totalCost = 0;
    let totalValue = 0;

    holdingsMap.forEach((data) => {
      const totalQuantity = data.lots.reduce(
        (sum, lot) => sum.add(lot.quantity),
        new Decimal(0),
      );

      if (totalQuantity.gt(0)) {
        const costBasis = data.lots.reduce(
          (sum, lot) => sum.add(lot.quantity.mul(lot.price)),
          new Decimal(0),
        );

        totalCost += costBasis.toNumber();

        // Use average cost as approximate value for historical dates
        // In production, you'd want to fetch historical prices
        const avgPrice = costBasis.div(totalQuantity);
        totalValue += totalQuantity.mul(avgPrice).toNumber();
      }
    });

    return { totalValue, totalCost };
  }

  /**
   * Filter snapshots by interval
   */
  private filterByInterval(snapshots: any[], interval: HistoryInterval): any[] {
    if (interval === HistoryInterval.DAILY) {
      return snapshots;
    }

    const filtered: any[] = [];
    let lastIncludedDate: Date | null = null;

    for (const snapshot of snapshots) {
      const date = new Date(snapshot.date);

      if (interval === HistoryInterval.WEEKLY) {
        // Include if it's a Monday or first in list
        if (
          !lastIncludedDate ||
          date.getDay() === 1 ||
          this.daysDiff(lastIncludedDate, date) >= 7
        ) {
          filtered.push(snapshot);
          lastIncludedDate = date;
        }
      } else if (interval === HistoryInterval.MONTHLY) {
        // Include first of each month
        if (!lastIncludedDate || date.getMonth() !== lastIncludedDate.getMonth()) {
          filtered.push(snapshot);
          lastIncludedDate = date;
        }
      }
    }

    return filtered;
  }

  /**
   * Calculate days between two dates
   */
  private daysDiff(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Format snapshot for response
   */
  private formatSnapshot(snapshot: any): PortfolioSnapshotDto {
    const totalValue = snapshot.totalValue.toNumber();
    const totalCost = snapshot.totalCost.toNumber();
    const dayChange = snapshot.dayChange.toNumber();

    return {
      date: snapshot.date.toISOString().split('T')[0],
      totalValue,
      totalCost,
      dayChange,
      dayChangePercent:
        totalValue - dayChange > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0,
      unrealizedGain: totalValue - totalCost,
      unrealizedGainPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
      cashBalance: snapshot.cashBalance?.toNumber() || 0,
    };
  }
}
