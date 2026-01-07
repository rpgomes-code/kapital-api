// src/portfolio/services/dividend.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { YahooFinanceService } from '../../yahoo-finance/yahoo-finance.service';
import { TransactionType } from '../../generated/prisma/client';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace';
import {
  DividendSummaryDto,
  DividendHistoryDto,
  DividendPaymentDto,
  MonthlyDividendDto,
  DividendBreakdownDto,
  DividendCalendarDto,
  DividendProjectionDto,
} from '../dto/dividend.dto';

@Injectable()
export class DividendService {
  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
  ) {}

  /**
   * Get dividend summary for a user
   */
  async getDividendSummary(userId: string): Promise<DividendSummaryDto> {
    const dividendTxs = await this.getDividendTransactions(userId);
    const holdings = await this.getCurrentHoldings(userId);

    const totalDividends = dividendTxs.reduce(
      (sum, tx) => sum + tx.quantity.toNumber() * tx.price.toNumber(),
      0,
    );

    // Count dividend-paying holdings
    const dividendPayingHoldings = new Set(dividendTxs.map((tx) => tx.assetId)).size;

    // Calculate current portfolio value for yield calculation
    const portfolioValue = await this.getPortfolioValue(holdings);
    const totalCostBasis = await this.getTotalCostBasis(userId);

    // Calculate projected annual income based on current holdings
    const projectedAnnualIncome = await this.calculateProjectedDividends(holdings);

    // Current yield = projected annual / current value
    const currentYield = portfolioValue > 0 ? (projectedAnnualIncome / portfolioValue) * 100 : 0;

    // Yield on cost = projected annual / cost basis
    const yieldOnCost =
      totalCostBasis > 0 ? (projectedAnnualIncome / totalCostBasis) * 100 : 0;

    // Average monthly income (based on last 12 months of data)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recentDividends = dividendTxs.filter((tx) => tx.executedAt >= oneYearAgo);
    const recentTotal = recentDividends.reduce(
      (sum, tx) => sum + tx.quantity.toNumber() * tx.price.toNumber(),
      0,
    );
    const averageMonthlyIncome = recentTotal / 12;

    return {
      totalDividends,
      currentYield,
      yieldOnCost,
      projectedAnnualIncome,
      averageMonthlyIncome,
      paymentCount: dividendTxs.length,
      dividendPayingHoldings,
    };
  }

  /**
   * Get dividend payment history
   */
  async getDividendHistory(
    userId: string,
    year?: number,
  ): Promise<DividendHistoryDto> {
    let whereClause: any = {
      account: {
        userBroker: {
          userId,
        },
      },
      type: TransactionType.DIVIDEND,
    };

    if (year) {
      whereClause.executedAt = {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      };
    }

    const dividendTxs = await this.prisma.transaction.findMany({
      where: whereClause,
      include: { asset: true },
      orderBy: { executedAt: 'desc' },
    });

    const payments: DividendPaymentDto[] = dividendTxs.map((tx) => ({
      assetId: tx.assetId,
      symbol: tx.asset.symbol,
      name: tx.asset.name,
      paymentDate: tx.executedAt.toISOString().split('T')[0],
      quantity: tx.quantity.toNumber(),
      dividendPerShare: tx.price.toNumber(),
      totalAmount: tx.quantity.toNumber() * tx.price.toNumber(),
      currency: tx.currency,
      isProjected: false,
    }));

    const summary = await this.getDividendSummary(userId);

    return {
      payments,
      summary,
    };
  }

  /**
   * Get monthly breakdown of dividends
   */
  async getDividendBreakdown(userId: string, year?: number): Promise<DividendBreakdownDto> {
    const targetYear = year || new Date().getFullYear();
    const dividendTxs = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
        type: TransactionType.DIVIDEND,
        executedAt: {
          gte: new Date(`${targetYear}-01-01`),
          lt: new Date(`${targetYear + 1}-01-01`),
        },
      },
      include: {
        asset: {
          include: { sector: true },
        },
      },
      orderBy: { executedAt: 'asc' },
    });

    // Monthly breakdown
    const monthlyMap = new Map<string, { amount: number; count: number }>();
    const holdingMap = new Map<string, number>();
    const sectorMap = new Map<string, number>();

    for (const tx of dividendTxs) {
      const monthKey = tx.executedAt.toISOString().slice(0, 7); // YYYY-MM
      const amount = tx.quantity.toNumber() * tx.price.toNumber();

      // Monthly aggregation
      const existing = monthlyMap.get(monthKey) || { amount: 0, count: 0 };
      existing.amount += amount;
      existing.count += 1;
      monthlyMap.set(monthKey, existing);

      // By holding
      const currentHolding = holdingMap.get(tx.asset.symbol) || 0;
      holdingMap.set(tx.asset.symbol, currentHolding + amount);

      // By sector
      const sectorName = tx.asset.sector?.name || 'Uncategorized';
      const currentSector = sectorMap.get(sectorName) || 0;
      sectorMap.set(sectorName, currentSector + amount);
    }

    // Convert to arrays
    const monthly: MonthlyDividendDto[] = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        amount: data.amount,
        paymentCount: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const byHolding: Record<string, number> = {};
    holdingMap.forEach((value, key) => {
      byHolding[key] = value;
    });

    const bySector: Record<string, number> = {};
    sectorMap.forEach((value, key) => {
      bySector[key] = value;
    });

    return {
      monthly,
      byHolding,
      bySector,
    };
  }

  /**
   * Get upcoming dividend calendar
   */
  async getDividendCalendar(
    userId: string,
    daysAhead: number = 30,
  ): Promise<DividendCalendarDto> {
    const holdings = await this.getCurrentHoldings(userId);
    const upcoming: DividendPaymentDto[] = [];

    for (const holding of holdings) {
      try {
        // Fetch dividend info from Yahoo Finance
        // Cast to any to access dividend-specific properties not in the base interface
        const quote = await this.yahooFinance.getQuote(holding.yahooSymbol) as any;

        if (quote?.dividendDate) {
          const dividendDate = new Date(quote.dividendDate * 1000); // Unix timestamp
          const now = new Date();
          const future = new Date();
          future.setDate(future.getDate() + daysAhead);

          if (dividendDate >= now && dividendDate <= future) {
            const dividendPerShare = quote.trailingAnnualDividendRate
              ? quote.trailingAnnualDividendRate / 4 // Approximate quarterly
              : 0;

            upcoming.push({
              assetId: holding.assetId,
              symbol: holding.symbol,
              name: holding.name,
              paymentDate: dividendDate.toISOString().split('T')[0],
              exDividendDate: quote.exDividendDate
                ? new Date(quote.exDividendDate * 1000).toISOString().split('T')[0]
                : undefined,
              quantity: holding.quantity,
              dividendPerShare,
              totalAmount: holding.quantity * dividendPerShare,
              currency: holding.currency,
              isProjected: true,
            });
          }
        }
      } catch (error) {
        // Continue if we can't get dividend info for this holding
        console.error(`Failed to get dividend info for ${holding.yahooSymbol}:`, error);
      }
    }

    // Sort by payment date
    upcoming.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

    const totalExpected = upcoming.reduce((sum, d) => sum + d.totalAmount, 0);

    return {
      upcoming,
      totalExpected,
      daysAhead,
    };
  }

  /**
   * Get dividend projections
   */
  async getDividendProjection(userId: string): Promise<DividendProjectionDto> {
    const holdings = await this.getCurrentHoldings(userId);
    const projectedByHolding: Record<string, number> = {};
    let annualProjection = 0;

    for (const holding of holdings) {
      try {
        // Cast to any to access dividend-specific properties
        const quote = await this.yahooFinance.getQuote(holding.yahooSymbol) as any;
        const annualDividend = quote?.trailingAnnualDividendRate || 0;
        const projectedAmount = holding.quantity * annualDividend;

        if (projectedAmount > 0) {
          projectedByHolding[holding.symbol] = projectedAmount;
          annualProjection += projectedAmount;
        }
      } catch (error) {
        console.error(`Failed to get projection for ${holding.yahooSymbol}:`, error);
      }
    }

    // Calculate monthly projections (simplified - assumes even distribution)
    const monthlyAverage = annualProjection / 12;
    const monthlyProjections = Array(12).fill(monthlyAverage);

    // Calculate YoY growth based on historical dividends
    const projectedGrowth = await this.calculateDividendGrowth(userId);

    return {
      annualProjection,
      monthlyAverage,
      monthlyProjections,
      byHolding: projectedByHolding,
      projectedGrowth,
    };
  }

  /**
   * Calculate year-over-year dividend growth
   */
  private async calculateDividendGrowth(userId: string): Promise<number | undefined> {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    const [currentYearDividends, lastYearDividends] = await Promise.all([
      this.getYearlyDividendTotal(userId, currentYear),
      this.getYearlyDividendTotal(userId, lastYear),
    ]);

    if (lastYearDividends === 0) return undefined;

    // Annualize current year if not complete
    const currentMonth = new Date().getMonth() + 1;
    const annualizedCurrent = (currentYearDividends / currentMonth) * 12;

    return ((annualizedCurrent - lastYearDividends) / lastYearDividends) * 100;
  }

  /**
   * Get total dividends for a specific year
   */
  private async getYearlyDividendTotal(userId: string, year: number): Promise<number> {
    const dividends = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
        type: TransactionType.DIVIDEND,
        executedAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });

    return dividends.reduce(
      (sum, tx) => sum + tx.quantity.toNumber() * tx.price.toNumber(),
      0,
    );
  }

  /**
   * Get dividend transactions for a user
   */
  private async getDividendTransactions(userId: string): Promise<any[]> {
    return this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
        type: TransactionType.DIVIDEND,
      },
      include: { asset: true },
      orderBy: { executedAt: 'desc' },
    });
  }

  /**
   * Get current holdings for a user
   */
  private async getCurrentHoldings(userId: string): Promise<
    Array<{
      assetId: number;
      symbol: string;
      yahooSymbol: string;
      name: string;
      quantity: number;
      currency: string;
    }>
  > {
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

    const holdingsMap = new Map<
      number,
      {
        asset: any;
        quantity: Decimal;
      }
    >();

    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          existing.quantity = existing.quantity.add(tx.quantity);
        } else {
          holdingsMap.set(tx.assetId, { asset: tx.asset, quantity: tx.quantity });
        }
      } else if (tx.type === TransactionType.SELL) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          existing.quantity = existing.quantity.sub(tx.quantity);
        }
      }
    }

    const holdings: Array<{
      assetId: number;
      symbol: string;
      yahooSymbol: string;
      name: string;
      quantity: number;
      currency: string;
    }> = [];

    holdingsMap.forEach((data, assetId) => {
      if (data.quantity.gt(0)) {
        holdings.push({
          assetId,
          symbol: data.asset.symbol,
          yahooSymbol: data.asset.yahooSymbol,
          name: data.asset.name,
          quantity: data.quantity.toNumber(),
          currency: data.asset.currency,
        });
      }
    });

    return holdings;
  }

  /**
   * Get current portfolio value
   */
  private async getPortfolioValue(
    holdings: Array<{ yahooSymbol: string; quantity: number }>,
  ): Promise<number> {
    if (holdings.length === 0) return 0;

    const symbols = holdings.map((h) => h.yahooSymbol);
    const quotes = await this.yahooFinance.getQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    return holdings.reduce((sum, holding) => {
      const quote = quoteMap.get(holding.yahooSymbol);
      return sum + holding.quantity * (quote?.regularMarketPrice || 0);
    }, 0);
  }

  /**
   * Get total cost basis for a user
   */
  private async getTotalCostBasis(userId: string): Promise<number> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
        type: { in: [TransactionType.BUY, TransactionType.SELL] },
      },
      orderBy: { executedAt: 'asc' },
    });

    // Use FIFO to track remaining cost basis
    const lots = new Map<number, Array<{ quantity: Decimal; price: Decimal }>>();

    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        const assetLots = lots.get(tx.assetId) || [];
        assetLots.push({ quantity: tx.quantity, price: tx.price });
        lots.set(tx.assetId, assetLots);
      } else if (tx.type === TransactionType.SELL) {
        const assetLots = lots.get(tx.assetId) || [];
        let remainingToSell = tx.quantity;

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

    let totalCostBasis = 0;
    lots.forEach((assetLots) => {
      for (const lot of assetLots) {
        totalCostBasis += lot.quantity.toNumber() * lot.price.toNumber();
      }
    });

    return totalCostBasis;
  }

  /**
   * Calculate projected dividends based on current holdings
   */
  private async calculateProjectedDividends(
    holdings: Array<{ yahooSymbol: string; quantity: number }>,
  ): Promise<number> {
    if (holdings.length === 0) return 0;

    let totalProjected = 0;

    for (const holding of holdings) {
      try {
        // Cast to any to access dividend-specific properties
        const quote = await this.yahooFinance.getQuote(holding.yahooSymbol) as any;
        const annualDividend = quote?.trailingAnnualDividendRate || 0;
        totalProjected += holding.quantity * annualDividend;
      } catch (error) {
        // Continue if we can't get dividend info
      }
    }

    return totalProjected;
  }
}
