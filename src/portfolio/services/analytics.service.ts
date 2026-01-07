// src/portfolio/services/analytics.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { YahooFinanceService } from '../../yahoo-finance/yahoo-finance.service';
import { TransactionType } from '../../generated/prisma/client';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace';
import {
  EnhancedPerformanceMetricsDto,
  BenchmarkComparisonDto,
} from '../dto/performance-metrics.dto';

interface DailyReturn {
  date: Date;
  portfolioValue: number;
  cashFlow: number;
  return: number;
}

interface PortfolioDataPoint {
  date: Date;
  value: number;
}

@Injectable()
export class AnalyticsService {
  private readonly RISK_FREE_RATE = 0.04; // 4% annual risk-free rate (approximate T-bill rate)
  private readonly TRADING_DAYS_PER_YEAR = 252;

  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
  ) {}

  /**
   * Calculate enhanced performance metrics including TWR, MWR, Sharpe, etc.
   */
  async getEnhancedPerformanceMetrics(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    benchmarkSymbol?: string,
  ): Promise<EnhancedPerformanceMetricsDto> {
    const transactions = await this.getTransactionsForUser(userId, startDate, endDate);
    const portfolioHistory = await this.getPortfolioValueHistory(userId, startDate, endDate);
    const dailyReturns = this.calculateDailyReturns(portfolioHistory, transactions);

    // Basic return metrics
    const { realizedGains, unrealizedGains, dividendIncome, totalCost, currentValue } =
      await this.calculateGainsBreakdown(userId, transactions);

    const totalReturn = realizedGains + unrealizedGains + dividendIncome;
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

    // Time-weighted return (TWR)
    const timeWeightedReturn = this.calculateTimeWeightedReturn(dailyReturns);

    // Money-weighted return (IRR)
    const moneyWeightedReturn = this.calculateMoneyWeightedReturn(transactions, currentValue);

    // Risk metrics
    const volatility = this.calculateVolatility(dailyReturns);
    const downsideDeviation = this.calculateDownsideDeviation(dailyReturns);
    const maxDrawdown = this.calculateMaxDrawdown(portfolioHistory);

    // Risk-adjusted returns
    const sharpeRatio = this.calculateSharpeRatio(dailyReturns, volatility);
    const sortinoRatio = this.calculateSortinoRatio(dailyReturns, downsideDeviation);

    // Benchmark comparison (if provided)
    let beta = 0;
    let alpha = 0;
    let treynorRatio: number | undefined;
    let informationRatio: number | undefined;

    if (benchmarkSymbol) {
      const benchmarkData = await this.getBenchmarkData(benchmarkSymbol, startDate, endDate);
      const benchmarkMetrics = this.calculateBenchmarkMetrics(dailyReturns, benchmarkData);
      beta = benchmarkMetrics.beta;
      alpha = benchmarkMetrics.alpha;
      treynorRatio = benchmarkMetrics.treynorRatio;
      informationRatio = benchmarkMetrics.informationRatio;
    }

    // Value at Risk (95% confidence)
    const valueAtRisk = this.calculateValueAtRisk(portfolioHistory, dailyReturns);

    // Dividend metrics
    const dividendYieldOnCost = totalCost > 0 ? (dividendIncome / totalCost) * 100 : undefined;

    // Annualized return
    const yearsHeld = this.calculateYearsHeld(transactions);
    const annualizedReturn =
      yearsHeld > 0
        ? (Math.pow(1 + totalReturn / Math.max(totalCost, 1), 1 / yearsHeld) - 1) * 100
        : 0;

    // Net gain after fees and taxes
    const { totalFees, totalTaxes } = this.sumFeesAndTaxes(transactions);
    const netGain = totalReturn - totalFees - totalTaxes;

    return {
      totalReturn,
      totalReturnPercent,
      annualizedReturn: isNaN(annualizedReturn) ? 0 : annualizedReturn,
      realizedGains,
      unrealizedGains,
      dividendIncome,
      netGain,
      timeWeightedReturn,
      moneyWeightedReturn,
      sharpeRatio,
      sortinoRatio,
      beta,
      alpha,
      maxDrawdown,
      volatility,
      valueAtRisk,
      treynorRatio,
      informationRatio,
      dividendYieldOnCost,
    };
  }

  /**
   * Compare portfolio performance against a benchmark
   */
  async getBenchmarkComparison(
    userId: string,
    benchmarkSymbol: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<BenchmarkComparisonDto> {
    const transactions = await this.getTransactionsForUser(userId, startDate, endDate);
    const portfolioHistory = await this.getPortfolioValueHistory(userId, startDate, endDate);
    const dailyReturns = this.calculateDailyReturns(portfolioHistory, transactions);

    const benchmarkData = await this.getBenchmarkData(benchmarkSymbol, startDate, endDate);
    const benchmarkReturns = this.calculateBenchmarkReturns(benchmarkData);

    // Get benchmark info
    const benchmarkQuote = await this.yahooFinance.getQuote(benchmarkSymbol);

    // Calculate portfolio return
    const portfolioReturn = this.calculateTotalReturn(portfolioHistory);

    // Calculate benchmark return
    const benchmarkReturn =
      benchmarkData.length >= 2
        ? ((benchmarkData[benchmarkData.length - 1].value - benchmarkData[0].value) /
            benchmarkData[0].value) *
          100
        : 0;

    // Calculate metrics
    const { beta, alpha, correlation, trackingError } = this.calculateBenchmarkMetrics(
      dailyReturns,
      benchmarkData,
    );

    return {
      benchmarkSymbol,
      benchmarkName: benchmarkQuote?.shortName || benchmarkSymbol,
      portfolioReturn,
      benchmarkReturn,
      excessReturn: portfolioReturn - benchmarkReturn,
      trackingError,
      beta,
      correlation,
    };
  }

  /**
   * Calculate Time-Weighted Return (TWR)
   * TWR measures performance independent of cash flows
   */
  private calculateTimeWeightedReturn(dailyReturns: DailyReturn[]): number {
    if (dailyReturns.length < 2) return 0;

    // Calculate geometric mean of returns
    let cumulativeReturn = 1;
    for (const day of dailyReturns) {
      if (!isNaN(day.return) && isFinite(day.return)) {
        cumulativeReturn *= 1 + day.return;
      }
    }

    // Annualize the return
    const years = dailyReturns.length / this.TRADING_DAYS_PER_YEAR;
    const annualizedTWR = (Math.pow(cumulativeReturn, 1 / years) - 1) * 100;

    return isNaN(annualizedTWR) ? 0 : annualizedTWR;
  }

  /**
   * Calculate Money-Weighted Return (MWR/IRR)
   * Uses Newton-Raphson method to solve for IRR
   */
  private calculateMoneyWeightedReturn(
    transactions: any[],
    currentValue: number,
  ): number {
    const cashFlows: { date: Date; amount: number }[] = [];

    // Build cash flows from transactions
    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        // Cash outflow (negative)
        cashFlows.push({
          date: tx.executedAt,
          amount: -tx.quantity.toNumber() * tx.price.toNumber(),
        });
      } else if (tx.type === TransactionType.SELL) {
        // Cash inflow (positive)
        cashFlows.push({
          date: tx.executedAt,
          amount: tx.quantity.toNumber() * tx.price.toNumber(),
        });
      } else if (tx.type === TransactionType.DIVIDEND) {
        // Cash inflow (positive)
        cashFlows.push({
          date: tx.executedAt,
          amount: tx.quantity.toNumber() * tx.price.toNumber(),
        });
      }
    }

    // Add current portfolio value as final cash flow
    if (cashFlows.length > 0) {
      cashFlows.push({
        date: new Date(),
        amount: currentValue,
      });
    }

    if (cashFlows.length < 2) return 0;

    // Solve for IRR using Newton-Raphson
    const irr = this.solveIRR(cashFlows);
    return irr * 100; // Convert to percentage
  }

  /**
   * Newton-Raphson method to solve for IRR
   */
  private solveIRR(cashFlows: { date: Date; amount: number }[]): number {
    const firstDate = cashFlows[0].date;
    let rate = 0.1; // Initial guess
    const tolerance = 0.0001;
    const maxIterations = 100;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivativeNpv = 0;

      for (const cf of cashFlows) {
        const years =
          (cf.date.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        const discountFactor = Math.pow(1 + rate, years);
        npv += cf.amount / discountFactor;
        derivativeNpv -= (years * cf.amount) / (discountFactor * (1 + rate));
      }

      if (Math.abs(derivativeNpv) < tolerance) break;

      const newRate = rate - npv / derivativeNpv;
      if (Math.abs(newRate - rate) < tolerance) {
        return newRate;
      }
      rate = newRate;
    }

    return isNaN(rate) || !isFinite(rate) ? 0 : rate;
  }

  /**
   * Calculate Sharpe Ratio
   * Measures excess return per unit of risk
   */
  private calculateSharpeRatio(dailyReturns: DailyReturn[], volatility: number): number {
    if (dailyReturns.length < 2 || volatility === 0) return 0;

    const avgDailyReturn =
      dailyReturns.reduce((sum, d) => sum + d.return, 0) / dailyReturns.length;
    const annualizedReturn = avgDailyReturn * this.TRADING_DAYS_PER_YEAR;
    const dailyRiskFreeRate = this.RISK_FREE_RATE / this.TRADING_DAYS_PER_YEAR;
    const excessReturn = annualizedReturn - this.RISK_FREE_RATE;

    const annualizedVolatility = volatility * Math.sqrt(this.TRADING_DAYS_PER_YEAR);

    return annualizedVolatility > 0 ? excessReturn / annualizedVolatility : 0;
  }

  /**
   * Calculate Sortino Ratio
   * Like Sharpe but only considers downside volatility
   */
  private calculateSortinoRatio(
    dailyReturns: DailyReturn[],
    downsideDeviation: number,
  ): number {
    if (dailyReturns.length < 2 || downsideDeviation === 0) return 0;

    const avgDailyReturn =
      dailyReturns.reduce((sum, d) => sum + d.return, 0) / dailyReturns.length;
    const annualizedReturn = avgDailyReturn * this.TRADING_DAYS_PER_YEAR;
    const excessReturn = annualizedReturn - this.RISK_FREE_RATE;

    const annualizedDownside = downsideDeviation * Math.sqrt(this.TRADING_DAYS_PER_YEAR);

    return annualizedDownside > 0 ? excessReturn / annualizedDownside : 0;
  }

  /**
   * Calculate portfolio volatility (standard deviation of returns)
   */
  private calculateVolatility(dailyReturns: DailyReturn[]): number {
    if (dailyReturns.length < 2) return 0;

    const returns = dailyReturns.map((d) => d.return).filter((r) => !isNaN(r) && isFinite(r));
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const squaredDiffs = returns.map((r) => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (returns.length - 1);

    return Math.sqrt(variance);
  }

  /**
   * Calculate downside deviation (for Sortino ratio)
   */
  private calculateDownsideDeviation(dailyReturns: DailyReturn[]): number {
    if (dailyReturns.length < 2) return 0;

    const targetReturn = this.RISK_FREE_RATE / this.TRADING_DAYS_PER_YEAR;
    const downsideReturns = dailyReturns
      .map((d) => d.return)
      .filter((r) => !isNaN(r) && isFinite(r) && r < targetReturn);

    if (downsideReturns.length === 0) return 0;

    const squaredDiffs = downsideReturns.map((r) => Math.pow(r - targetReturn, 2));
    const downsideVariance = squaredDiffs.reduce((sum, d) => sum + d, 0) / dailyReturns.length;

    return Math.sqrt(downsideVariance);
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(history: PortfolioDataPoint[]): number {
    if (history.length < 2) return 0;

    let maxDrawdown = 0;
    let peak = history[0].value;

    for (const point of history) {
      if (point.value > peak) {
        peak = point.value;
      }
      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return -maxDrawdown * 100; // Return as negative percentage
  }

  /**
   * Calculate Value at Risk (VaR) at 95% confidence
   */
  private calculateValueAtRisk(
    history: PortfolioDataPoint[],
    dailyReturns: DailyReturn[],
  ): number {
    if (history.length === 0 || dailyReturns.length < 2) return 0;

    const returns = dailyReturns.map((d) => d.return).filter((r) => !isNaN(r) && isFinite(r));
    if (returns.length < 2) return 0;

    // Sort returns and find 5th percentile
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const varIndex = Math.floor(sortedReturns.length * 0.05);
    const varReturn = sortedReturns[varIndex];

    const currentValue = history[history.length - 1].value;
    return currentValue * varReturn;
  }

  /**
   * Calculate benchmark metrics (beta, alpha, correlation, tracking error)
   */
  private calculateBenchmarkMetrics(
    portfolioReturns: DailyReturn[],
    benchmarkData: PortfolioDataPoint[],
  ): { beta: number; alpha: number; correlation: number; trackingError: number; treynorRatio: number; informationRatio: number } {
    const benchmarkReturns = this.calculateBenchmarkReturns(benchmarkData);

    if (portfolioReturns.length < 2 || benchmarkReturns.length < 2) {
      return { beta: 0, alpha: 0, correlation: 0, trackingError: 0, treynorRatio: 0, informationRatio: 0 };
    }

    // Align dates
    const alignedData = this.alignReturns(portfolioReturns, benchmarkReturns);
    if (alignedData.length < 2) {
      return { beta: 0, alpha: 0, correlation: 0, trackingError: 0, treynorRatio: 0, informationRatio: 0 };
    }

    const pReturns = alignedData.map((d) => d.portfolio);
    const bReturns = alignedData.map((d) => d.benchmark);

    // Calculate means
    const pMean = pReturns.reduce((a, b) => a + b, 0) / pReturns.length;
    const bMean = bReturns.reduce((a, b) => a + b, 0) / bReturns.length;

    // Calculate covariance and variances
    let covariance = 0;
    let pVariance = 0;
    let bVariance = 0;

    for (let i = 0; i < pReturns.length; i++) {
      covariance += (pReturns[i] - pMean) * (bReturns[i] - bMean);
      pVariance += Math.pow(pReturns[i] - pMean, 2);
      bVariance += Math.pow(bReturns[i] - bMean, 2);
    }

    covariance /= pReturns.length - 1;
    pVariance /= pReturns.length - 1;
    bVariance /= bReturns.length - 1;

    const beta = bVariance > 0 ? covariance / bVariance : 0;
    const correlation =
      pVariance > 0 && bVariance > 0
        ? covariance / (Math.sqrt(pVariance) * Math.sqrt(bVariance))
        : 0;

    // Calculate alpha (annualized)
    const annualizedPReturn = pMean * this.TRADING_DAYS_PER_YEAR;
    const annualizedBReturn = bMean * this.TRADING_DAYS_PER_YEAR;
    const alpha = annualizedPReturn - (this.RISK_FREE_RATE + beta * (annualizedBReturn - this.RISK_FREE_RATE));

    // Calculate tracking error
    const excessReturns = pReturns.map((p, i) => p - bReturns[i]);
    const excessMean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
    const trackingVariance =
      excessReturns.reduce((sum, e) => sum + Math.pow(e - excessMean, 2), 0) /
      (excessReturns.length - 1);
    const trackingError = Math.sqrt(trackingVariance) * Math.sqrt(this.TRADING_DAYS_PER_YEAR);

    // Treynor ratio
    const treynorRatio = beta !== 0 ? (annualizedPReturn - this.RISK_FREE_RATE) / beta : 0;

    // Information ratio
    const informationRatio = trackingError !== 0 ? (annualizedPReturn - annualizedBReturn) / trackingError : 0;

    return { beta, alpha: alpha * 100, correlation, trackingError: trackingError * 100, treynorRatio, informationRatio };
  }

  /**
   * Get historical portfolio value data
   */
  private async getPortfolioValueHistory(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PortfolioDataPoint[]> {
    // First check if we have snapshots
    const whereClause: any = { userId };
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = startDate;
      if (endDate) whereClause.date.lte = endDate;
    }

    const snapshots = await this.prisma.portfolioSnapshot.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
    });

    if (snapshots.length > 0) {
      return snapshots.map((s) => ({
        date: s.date,
        value: s.totalValue.toNumber(),
      }));
    }

    // If no snapshots, build from transactions
    return this.buildHistoricalValues(userId, startDate, endDate);
  }

  /**
   * Build historical portfolio values from transactions
   */
  private async buildHistoricalValues(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PortfolioDataPoint[]> {
    const transactions = await this.getTransactionsForUser(userId, startDate, endDate);
    if (transactions.length === 0) return [];

    // This is a simplified version - in production you'd want actual historical prices
    const dataPoints: PortfolioDataPoint[] = [];
    let runningValue = 0;

    for (const tx of transactions) {
      const txValue = tx.quantity.toNumber() * tx.price.toNumber();
      if (tx.type === TransactionType.BUY) {
        runningValue += txValue;
      } else if (tx.type === TransactionType.SELL) {
        runningValue -= txValue * 0.9; // Approximate cost basis
      }

      dataPoints.push({
        date: tx.executedAt,
        value: Math.max(runningValue, 0),
      });
    }

    return dataPoints;
  }

  /**
   * Calculate daily returns from portfolio history
   */
  private calculateDailyReturns(
    history: PortfolioDataPoint[],
    transactions: any[],
  ): DailyReturn[] {
    if (history.length < 2) return [];

    const returns: DailyReturn[] = [];
    const txByDate = new Map<string, number>();

    // Group cash flows by date
    for (const tx of transactions) {
      const dateKey = tx.executedAt.toISOString().split('T')[0];
      const amount = tx.quantity.toNumber() * tx.price.toNumber();
      const flow =
        tx.type === TransactionType.BUY
          ? amount
          : tx.type === TransactionType.SELL
            ? -amount
            : 0;
      txByDate.set(dateKey, (txByDate.get(dateKey) || 0) + flow);
    }

    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      const dateKey = curr.date.toISOString().split('T')[0];
      const cashFlow = txByDate.get(dateKey) || 0;

      // Modified Dietz return for the day
      const adjustedPrevValue = prev.value + cashFlow * 0.5;
      const dailyReturn =
        adjustedPrevValue > 0 ? (curr.value - prev.value - cashFlow) / adjustedPrevValue : 0;

      returns.push({
        date: curr.date,
        portfolioValue: curr.value,
        cashFlow,
        return: dailyReturn,
      });
    }

    return returns;
  }

  /**
   * Calculate benchmark daily returns
   */
  private calculateBenchmarkReturns(
    benchmarkData: PortfolioDataPoint[],
  ): DailyReturn[] {
    if (benchmarkData.length < 2) return [];

    const returns: DailyReturn[] = [];
    for (let i = 1; i < benchmarkData.length; i++) {
      const prev = benchmarkData[i - 1];
      const curr = benchmarkData[i];
      const dailyReturn = prev.value > 0 ? (curr.value - prev.value) / prev.value : 0;

      returns.push({
        date: curr.date,
        portfolioValue: curr.value,
        cashFlow: 0,
        return: dailyReturn,
      });
    }

    return returns;
  }

  /**
   * Align portfolio and benchmark returns by date
   */
  private alignReturns(
    portfolioReturns: DailyReturn[],
    benchmarkReturns: DailyReturn[],
  ): { date: Date; portfolio: number; benchmark: number }[] {
    const benchmarkMap = new Map<string, number>();
    for (const b of benchmarkReturns) {
      benchmarkMap.set(b.date.toISOString().split('T')[0], b.return);
    }

    const aligned: { date: Date; portfolio: number; benchmark: number }[] = [];
    for (const p of portfolioReturns) {
      const dateKey = p.date.toISOString().split('T')[0];
      const benchmarkReturn = benchmarkMap.get(dateKey);
      if (benchmarkReturn !== undefined) {
        aligned.push({
          date: p.date,
          portfolio: p.return,
          benchmark: benchmarkReturn,
        });
      }
    }

    return aligned;
  }

  /**
   * Get benchmark historical data
   */
  private async getBenchmarkData(
    symbol: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PortfolioDataPoint[]> {
    try {
      const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      const historical = await this.yahooFinance.getHistoricalData(
        symbol,
        start,
        end,
        '1d',
      );

      return historical.map((h: any) => ({
        date: new Date(h.date),
        value: h.close,
      }));
    } catch (error) {
      console.error(`Failed to fetch benchmark data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Calculate total return from history
   */
  private calculateTotalReturn(history: PortfolioDataPoint[]): number {
    if (history.length < 2) return 0;
    const start = history[0].value;
    const end = history[history.length - 1].value;
    return start > 0 ? ((end - start) / start) * 100 : 0;
  }

  /**
   * Get transactions for a user
   */
  private async getTransactionsForUser(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any[]> {
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

    return this.prisma.transaction.findMany({
      where: whereClause,
      include: { asset: true },
      orderBy: { executedAt: 'asc' },
    });
  }

  /**
   * Calculate gains breakdown
   */
  private async calculateGainsBreakdown(
    userId: string,
    transactions: any[],
  ): Promise<{
    realizedGains: number;
    unrealizedGains: number;
    dividendIncome: number;
    totalCost: number;
    currentValue: number;
  }> {
    let totalCost = 0;
    let realizedGains = 0;
    let dividendIncome = 0;

    // Lot tracking for realized gains
    const lots = new Map<number, { quantity: Decimal; price: Decimal }[]>();

    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        totalCost += tx.quantity.toNumber() * tx.price.toNumber();
        const assetLots = lots.get(tx.assetId) || [];
        assetLots.push({ quantity: tx.quantity, price: tx.price });
        lots.set(tx.assetId, assetLots);
      } else if (tx.type === TransactionType.SELL) {
        const assetLots = lots.get(tx.assetId) || [];
        let remainingToSell = tx.quantity;

        while (remainingToSell.gt(0) && assetLots.length > 0) {
          const oldestLot = assetLots[0];
          const sellQuantity = Decimal.min(remainingToSell, oldestLot.quantity);
          const costBasis = sellQuantity.mul(oldestLot.price);
          const proceeds = sellQuantity.mul(tx.price);
          realizedGains += proceeds.sub(costBasis).toNumber();

          if (oldestLot.quantity.lte(remainingToSell)) {
            remainingToSell = remainingToSell.sub(oldestLot.quantity);
            assetLots.shift();
          } else {
            oldestLot.quantity = oldestLot.quantity.sub(remainingToSell);
            remainingToSell = new Decimal(0);
          }
        }
      } else if (tx.type === TransactionType.DIVIDEND) {
        dividendIncome += tx.quantity.toNumber() * tx.price.toNumber();
      }
    }

    // Calculate current value (simplified - would need actual holdings)
    let currentValue = 0;
    const holdingsMap = new Map<number, { asset: any; quantity: Decimal }>();

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

    // Fetch current prices
    const symbols = Array.from(holdingsMap.values())
      .filter((h) => h.quantity.gt(0))
      .map((h) => h.asset.yahooSymbol);

    if (symbols.length > 0) {
      const quotes = await this.yahooFinance.getQuotes(symbols);
      const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

      for (const [assetId, holding] of holdingsMap) {
        if (holding.quantity.gt(0)) {
          const quote = quoteMap.get(holding.asset.yahooSymbol);
          if (quote?.regularMarketPrice) {
            currentValue += holding.quantity.toNumber() * quote.regularMarketPrice;
          }
        }
      }
    }

    // Calculate unrealized gains (current value - remaining cost basis)
    let remainingCostBasis = 0;
    for (const assetLots of lots.values()) {
      for (const lot of assetLots) {
        remainingCostBasis += lot.quantity.toNumber() * lot.price.toNumber();
      }
    }
    const unrealizedGains = currentValue - remainingCostBasis;

    return { realizedGains, unrealizedGains, dividendIncome, totalCost, currentValue };
  }

  /**
   * Sum fees and taxes from transactions
   */
  private sumFeesAndTaxes(transactions: any[]): { totalFees: number; totalTaxes: number } {
    let totalFees = 0;
    let totalTaxes = 0;

    for (const tx of transactions) {
      if (tx.fee) totalFees += tx.fee.toNumber();
      if (tx.tax) totalTaxes += tx.tax.toNumber();
    }

    return { totalFees, totalTaxes };
  }

  /**
   * Calculate years held based on first transaction
   */
  private calculateYearsHeld(transactions: any[]): number {
    if (transactions.length === 0) return 1;
    const firstTx = transactions[0];
    return (Date.now() - firstTx.executedAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  }
}
