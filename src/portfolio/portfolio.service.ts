// src/portfolio/portfolio.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { YahooFinanceService } from '../yahoo-finance/yahoo-finance.service';
import { TransactionType } from 'generated/prisma/client';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace';

export interface Holding {
  assetId: number;
  asset: {
    id: number;
    publicId: string;
    symbol: string;
    yahooSymbol: string;
    name: string;
    assetType: string;
    currency: string;
  };
  quantity: number;
  avgCostBasis: number;
  totalCostBasis: number;
  currentPrice?: number;
  currentValue?: number;
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
  dayChange?: number;
  dayChangePercent?: number;
  allocation?: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  totalUnrealizedGain: number;
  totalUnrealizedGainPercent: number;
  totalDayChange: number;
  totalDayChangePercent: number;
  totalDividendsReceived: number;
  totalFeesPaid: number;
  totalTaxesPaid: number;
  holdings: Holding[];
  lastUpdated: Date;
}

export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  realizedGains: number;
  unrealizedGains: number;
  dividendIncome: number;
  netGain: number;
}

@Injectable()
export class PortfolioService {
  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
  ) {}

  async getPortfolioSummary(userId: number): Promise<PortfolioSummary> {
    // Get all transactions for user
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
      },
      include: {
        asset: true,
      },
      orderBy: { executedAt: 'asc' },
    });

    // Calculate holdings using FIFO method
    const holdingsMap = new Map<
      number,
      {
        asset: any;
        lots: Array<{ quantity: Decimal; price: Decimal; date: Date }>;
      }
    >();

    let totalDividends = new Decimal(0);
    let totalFees = new Decimal(0);
    let totalTaxes = new Decimal(0);

    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          existing.lots.push({
            quantity: tx.quantity,
            price: tx.price,
            date: tx.executedAt,
          });
        } else {
          holdingsMap.set(tx.assetId, {
            asset: tx.asset,
            lots: [
              {
                quantity: tx.quantity,
                price: tx.price,
                date: tx.executedAt,
              },
            ],
          });
        }
      } else if (tx.type === TransactionType.SELL) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          let remainingToSell = tx.quantity;
          // FIFO: Sell from oldest lots first
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
      } else if (tx.type === TransactionType.DIVIDEND) {
        totalDividends = totalDividends.add(tx.quantity.mul(tx.price));
      }

      // Accumulate fees and taxes
      if (tx.fee) totalFees = totalFees.add(tx.fee);
      if (tx.tax) totalTaxes = totalTaxes.add(tx.tax);
    }

    // Build holdings array
    const holdings: Holding[] = [];
    const symbols: string[] = [];

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
          asset: {
            id: data.asset.id,
            publicId: data.asset.publicId,
            symbol: data.asset.symbol,
            yahooSymbol: data.asset.yahooSymbol,
            name: data.asset.name,
            assetType: data.asset.assetType,
            currency: data.asset.currency,
          },
          quantity: totalQuantity.toNumber(),
          avgCostBasis: totalCost.div(totalQuantity).toNumber(),
          totalCostBasis: totalCost.toNumber(),
        });

        symbols.push(data.asset.yahooSymbol);
      }
    });

    // Fetch current prices
    const quotes = await this.yahooFinance.getQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    let totalValue = 0;
    let totalCostBasis = 0;
    let totalDayChange = 0;

    // Enrich holdings with current prices
    for (const holding of holdings) {
      const quote = quoteMap.get(holding.asset.yahooSymbol);

      if (quote) {
        holding.currentPrice = quote.regularMarketPrice;
        holding.currentValue =
          holding.quantity * (quote.regularMarketPrice || 0);
        holding.unrealizedGain = holding.currentValue - holding.totalCostBasis;
        holding.unrealizedGainPercent =
          (holding.unrealizedGain / holding.totalCostBasis) * 100;
        holding.dayChange = holding.quantity * (quote.regularMarketChange || 0);
        holding.dayChangePercent = quote.regularMarketChangePercent;

        totalValue += holding.currentValue;
        totalDayChange += holding.dayChange;
      }

      totalCostBasis += holding.totalCostBasis;
    }

    // Calculate allocations
    for (const holding of holdings) {
      if (holding.currentValue && totalValue > 0) {
        holding.allocation = (holding.currentValue / totalValue) * 100;
      }
    }

    const totalUnrealizedGain = totalValue - totalCostBasis;

    return {
      totalValue,
      totalCostBasis,
      totalUnrealizedGain,
      totalUnrealizedGainPercent:
        totalCostBasis > 0 ? (totalUnrealizedGain / totalCostBasis) * 100 : 0,
      totalDayChange,
      totalDayChangePercent:
        totalValue > 0
          ? (totalDayChange / (totalValue - totalDayChange)) * 100
          : 0,
      totalDividendsReceived: totalDividends.toNumber(),
      totalFeesPaid: totalFees.toNumber(),
      totalTaxesPaid: totalTaxes.toNumber(),
      holdings: holdings.sort(
        (a, b) => (b.currentValue || 0) - (a.currentValue || 0),
      ),
      lastUpdated: new Date(),
    };
  }

  async getPerformanceMetrics(
    userId: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PerformanceMetrics> {
    const whereClause: any = {
      account: {
        userBroker: {
          userId,
        },
      },
    };

    if (startDate || endDate) {
      whereClause.executedAt = {};
      if (startDate) whereClause.executedAt.gte = startDate;
      if (endDate) whereClause.executedAt.lte = endDate;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: whereClause,
      include: { asset: true },
      orderBy: { executedAt: 'asc' },
    });

    let totalBought = new Decimal(0);
    let totalSold = new Decimal(0);
    let totalDividends = new Decimal(0);
    let realizedGains = new Decimal(0);

    // Track lots for realized gain calculation
    const lots = new Map<
      number,
      Array<{ quantity: Decimal; price: Decimal }>
    >();

    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        totalBought = totalBought.add(tx.quantity.mul(tx.price));

        const assetLots = lots.get(tx.assetId) || [];
        assetLots.push({ quantity: tx.quantity, price: tx.price });
        lots.set(tx.assetId, assetLots);
      } else if (tx.type === TransactionType.SELL) {
        totalSold = totalSold.add(tx.quantity.mul(tx.price));

        // Calculate realized gain using FIFO
        const assetLots = lots.get(tx.assetId) || [];
        let remainingToSell = tx.quantity;

        while (remainingToSell.gt(0) && assetLots.length > 0) {
          const oldestLot = assetLots[0];
          const sellQuantity = Decimal.min(remainingToSell, oldestLot.quantity);

          const costBasis = sellQuantity.mul(oldestLot.price);
          const saleProceeds = sellQuantity.mul(tx.price);
          realizedGains = realizedGains.add(saleProceeds.sub(costBasis));

          if (oldestLot.quantity.lte(remainingToSell)) {
            remainingToSell = remainingToSell.sub(oldestLot.quantity);
            assetLots.shift();
          } else {
            oldestLot.quantity = oldestLot.quantity.sub(remainingToSell);
            remainingToSell = new Decimal(0);
          }
        }
      } else if (tx.type === TransactionType.DIVIDEND) {
        totalDividends = totalDividends.add(tx.quantity.mul(tx.price));
      }
    }

    // Get current portfolio value for unrealized gains
    const summary = await this.getPortfolioSummary(userId);
    const unrealizedGains = summary.totalUnrealizedGain;

    const totalReturn =
      realizedGains.toNumber() + unrealizedGains + totalDividends.toNumber();
    const totalInvested = totalBought.toNumber();

    // Calculate annualized return (simplified)
    const firstTx = transactions[0];
    const yearsHeld = firstTx
      ? (Date.now() - firstTx.executedAt.getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
      : 1;

    const totalReturnPercent =
      totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
    const annualizedReturn =
      yearsHeld > 0
        ? (Math.pow(1 + totalReturn / totalInvested, 1 / yearsHeld) - 1) * 100
        : 0;

    return {
      totalReturn,
      totalReturnPercent,
      annualizedReturn: isNaN(annualizedReturn) ? 0 : annualizedReturn,
      realizedGains: realizedGains.toNumber(),
      unrealizedGains,
      dividendIncome: totalDividends.toNumber(),
      netGain: totalReturn - summary.totalFeesPaid - summary.totalTaxesPaid,
    };
  }

  async getAllocationByType(userId: number) {
    const summary = await this.getPortfolioSummary(userId);

    const allocation = summary.holdings.reduce(
      (acc, holding) => {
        const type = holding.asset.assetType;
        if (!acc[type]) {
          acc[type] = { value: 0, percentage: 0 };
        }
        acc[type].value += holding.currentValue || 0;
        return acc;
      },
      {} as Record<string, { value: number; percentage: number }>,
    );

    // Calculate percentages
    for (const type in allocation) {
      allocation[type].percentage =
        (allocation[type].value / summary.totalValue) * 100;
    }

    return allocation;
  }

  async getAllocationBySector(userId: number) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: { userId },
        },
        type: { in: [TransactionType.BUY, TransactionType.SELL] },
      },
      include: {
        asset: {
          include: { sector: true },
        },
      },
    });

    // Similar logic to portfolio summary but group by sector
    // ... implementation similar to getPortfolioSummary but grouped by sector

    return {}; // Placeholder - implement sector allocation logic
  }
}
