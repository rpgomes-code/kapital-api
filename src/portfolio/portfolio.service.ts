import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StonksService } from '../stonks/stonks.service';
import { Decimal } from 'generated/prisma/client';

interface Holding {
  assetId: number;
  publicId: string;
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  avgCost: number;
  totalCost: number;
  currentPrice: number;
  currentValue: number;
  gain: number;
  gainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  allocation: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

@Injectable()
export class PortfolioService {
  constructor(
    private prisma: PrismaService,
    private stonks: StonksService,
  ) {}

  async getHoldings(userId: number): Promise<{
    holdings: Holding[];
    summary: PortfolioSummary;
  }> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { userBroker: { userId } },
      },
      include: { asset: true },
      orderBy: { executedAt: 'asc' },
    });

    // Calculate holdings per asset
    const holdingsMap = new Map
    number,
    {
      asset: (typeof transactions)[0]['asset'];
      quantity: Decimal;
      totalCost: Decimal;
    }
    >();

    for (const tx of transactions) {
      const current = holdingsMap.get(tx.assetId) || {
        asset: tx.asset,
        quantity: new Decimal(0),
        totalCost: new Decimal(0),
      };

      if (tx.type === 'BUY') {
        const txCost = tx.quantity.mul(tx.price).add(tx.fee || 0);
        current.quantity = current.quantity.add(tx.quantity);
        current.totalCost = current.totalCost.add(txCost);
      } else if (tx.type === 'SELL') {
        if (current.quantity.greaterThan(0)) {
          const proportion = Decimal.min(
            tx.quantity.div(current.quantity),
            new Decimal(1),
          );
          const costSold = current.totalCost.mul(proportion);
          current.quantity = current.quantity.sub(tx.quantity);
          current.totalCost = current.totalCost.sub(costSold);
        }
      }

      holdingsMap.set(tx.assetId, current);
    }

    // Fetch current prices and build holdings
    const holdings: Holding[] = [];
    let totalValue = 0;
    let totalCost = 0;
    let totalDayChange = 0;

    for (const [assetId, data] of holdingsMap) {
      if (data.quantity.lessThanOrEqualTo(0)) continue;

      try {
        const quote = await this.stonks.getQuote(data.asset.yahooSymbol);
        const currentPrice = quote.regularMarketPrice || 0;
        const quantity = data.quantity.toNumber();
        const cost = data.totalCost.toNumber();
        const currentValue = quantity * currentPrice;
        const gain = currentValue - cost;
        const dayChange = (quote.regularMarketChange || 0) * quantity;

        totalValue += currentValue;
        totalCost += cost;
        totalDayChange += dayChange;

        holdings.push({
          assetId,
          publicId: data.asset.publicId,
          symbol: data.asset.symbol,
          name: data.asset.name,
          assetType: data.asset.assetType,
          quantity,
          avgCost: cost / quantity,
          totalCost: cost,
          currentPrice,
          currentValue,
          gain,
          gainPercent: cost > 0 ? (gain / cost) * 100 : 0,
          dayChange,
          dayChangePercent: quote.regularMarketChangePercent || 0,
          allocation: 0, // Calculate after loop
        });
      } catch (error) {
        console.error(`Failed to fetch quote for ${data.asset.yahooSymbol}:`, error);
      }
    }

    // Calculate allocations
    holdings.forEach((h) => {
      h.allocation = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
    });

    // Sort by value descending
    holdings.sort((a, b) => b.currentValue - a.currentValue);

    const summary: PortfolioSummary = {
      totalValue,
      totalCost,
      totalGain: totalValue - totalCost,
      totalGainPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
      dayChange: totalDayChange,
      dayChangePercent: totalValue > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0,
    };

    return { holdings, summary };
  }

  async getAllocationByType(userId: number) {
    const { holdings } = await this.getHoldings(userId);

    const allocation = holdings.reduce(
      (acc, h) => {
        acc[h.assetType] = (acc[h.assetType] || 0) + h.currentValue;
        return acc;
      },
      {} as Record<string, number>,
    );

    const total = Object.values(allocation).reduce((a, b) => a + b, 0);

    return Object.entries(allocation).map(([type, value]) => ({
      type,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
    }));
  }

  async getPerformanceHistory(userId: number, days: number = 30) {
    // Get all user's assets and their historical prices
    const transactions = await this.prisma.transaction.findMany({
      where: { account: { userBroker: { userId } } },
      include: { asset: true },
    });

    const assetIds = [...new Set(transactions.map((t) => t.assetId))];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const prices = await this.prisma.assetPrice.findMany({
      where: {
        assetId: { in: assetIds },
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    // Group prices by date
    const pricesByDate = new Map<string, Map<number, number>>();

    for (const price of prices) {
      const dateKey = price.date.toISOString().split('T')[0];
      if (!pricesByDate.has(dateKey)) {
        pricesByDate.set(dateKey, new Map());
      }
      pricesByDate.get(dateKey)!.set(price.assetId, Number(price.close));
    }

    // Calculate portfolio value for each date
    // This is simplified - real implementation would need to account for transaction dates
    const history = Array.from(pricesByDate.entries()).map(([date, assetPrices]) => {
      let totalValue = 0;
      // Calculate holdings as of that date...
      // (simplified for brevity)
      return { date, value: totalValue };
    });

    return history;
  }
}