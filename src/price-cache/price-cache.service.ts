import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { YahooFinanceService } from '../yahoo-finance/yahoo-finance.service';
import { Decimal } from '../generated/prisma/internal/prismaNamespace';
import { PriceCache } from '../generated/prisma/client';

export interface PriceCacheEntry {
  id: number;
  symbol: string;
  date: Date;
  open: Decimal;
  high: Decimal;
  low: Decimal;
  close: Decimal;
  adjClose: Decimal;
  volume: bigint;
  createdAt: Date;
}

export interface CacheStats {
  totalRecords: number;
  symbolCount: number;
  oldestDate?: Date;
  newestDate?: Date;
}

@Injectable()
export class PriceCacheService {
  private readonly logger = new Logger(PriceCacheService.name);

  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
  ) {}

  /**
   * Get historical prices - cache first, fallback to Yahoo
   */
  async getHistoricalPrices(
    symbol: string,
    startDate: Date,
    endDate: Date = new Date(),
  ): Promise<PriceCache[]> {
    const normalizedSymbol = symbol.toUpperCase();

    // 1. Check cache for existing data
    const cached = await this.prisma.priceCache.findMany({
      where: {
        symbol: normalizedSymbol,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // 2. Find missing dates
    const cachedDates = new Set(
      cached.map((c) => c.date.toISOString().split('T')[0]),
    );
    const hasMissingDates = this.checkMissingDates(
      startDate,
      endDate,
      cachedDates,
    );

    // 3. Fetch missing data from Yahoo if needed
    if (hasMissingDates) {
      await this.fetchAndCacheMissingData(normalizedSymbol, startDate, endDate);

      // Re-query to get complete data
      return this.prisma.priceCache.findMany({
        where: {
          symbol: normalizedSymbol,
          date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: 'asc' },
      });
    }

    return cached;
  }

  /**
   * Update cache for a symbol with latest data
   */
  async updateCache(symbol: string): Promise<number> {
    const normalizedSymbol = symbol.toUpperCase();

    // Find the most recent cached date
    const lastCached = await this.prisma.priceCache.findFirst({
      where: { symbol: normalizedSymbol },
      orderBy: { date: 'desc' },
    });

    const startDate = lastCached
      ? new Date(lastCached.date.getTime() + 86400000) // Next day
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago

    const endDate = new Date();

    if (startDate >= endDate) {
      return 0; // Already up to date
    }

    return this.fetchAndCacheMissingData(normalizedSymbol, startDate, endDate);
  }

  /**
   * Bulk update cache for multiple symbols
   */
  async bulkUpdateCache(symbols: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();

    // Process in batches to avoid overwhelming Yahoo API
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (symbol) => {
          try {
            const count = await this.updateCache(symbol);
            results.set(symbol.toUpperCase(), count);
          } catch (error) {
            this.logger.error(`Failed to update cache for ${symbol}:`, error);
            results.set(symbol.toUpperCase(), -1);
          }
        }),
      );

      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await this.sleep(1000);
      }
    }

    return results;
  }

  /**
   * Get all cached symbols
   */
  async getCachedSymbols(): Promise<string[]> {
    const result = await this.prisma.priceCache.findMany({
      distinct: ['symbol'],
      select: { symbol: true },
    });
    return result.map((r) => r.symbol);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const [totalRecords, symbolsResult, oldestDate, newestDate] =
      await Promise.all([
        this.prisma.priceCache.count(),
        this.prisma.priceCache.findMany({
          distinct: ['symbol'],
          select: { symbol: true },
        }),
        this.prisma.priceCache.findFirst({
          orderBy: { date: 'asc' },
          select: { date: true },
        }),
        this.prisma.priceCache.findFirst({
          orderBy: { date: 'desc' },
          select: { date: true },
        }),
      ]);

    return {
      totalRecords,
      symbolCount: symbolsResult.length,
      oldestDate: oldestDate?.date,
      newestDate: newestDate?.date,
    };
  }

  /**
   * Get symbol cache info
   */
  async getSymbolCacheInfo(
    symbol: string,
  ): Promise<{ recordCount: number; oldestDate?: Date; newestDate?: Date }> {
    const normalizedSymbol = symbol.toUpperCase();

    const [recordCount, oldestDate, newestDate] = await Promise.all([
      this.prisma.priceCache.count({
        where: { symbol: normalizedSymbol },
      }),
      this.prisma.priceCache.findFirst({
        where: { symbol: normalizedSymbol },
        orderBy: { date: 'asc' },
        select: { date: true },
      }),
      this.prisma.priceCache.findFirst({
        where: { symbol: normalizedSymbol },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
    ]);

    return {
      recordCount,
      oldestDate: oldestDate?.date,
      newestDate: newestDate?.date,
    };
  }

  /**
   * Clear cache for a symbol
   */
  async clearSymbolCache(symbol: string): Promise<number> {
    const result = await this.prisma.priceCache.deleteMany({
      where: { symbol: symbol.toUpperCase() },
    });
    return result.count;
  }

  // Private helper methods
  private checkMissingDates(
    startDate: Date,
    endDate: Date,
    cachedDates: Set<string>,
  ): boolean {
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      if (!cachedDates.has(dateStr) && this.isBusinessDay(current)) {
        return true;
      }
      current.setDate(current.getDate() + 1);
    }
    return false;
  }

  private async fetchAndCacheMissingData(
    symbol: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    let totalCached = 0;

    try {
      const data = await this.yahooFinance.getHistoricalData(
        symbol,
        startDate,
        endDate,
        '1d',
      );

      if (data.length === 0) return 0;

      // Upsert each price record
      for (const point of data) {
        if (!point.open || !point.high || !point.low || !point.close) {
          continue; // Skip incomplete data
        }

        try {
          await this.prisma.priceCache.upsert({
            where: {
              symbol_date: {
                symbol: symbol.toUpperCase(),
                date: new Date(point.date),
              },
            },
            update: {
              open: new Decimal(point.open),
              high: new Decimal(point.high),
              low: new Decimal(point.low),
              close: new Decimal(point.close),
              adjClose: new Decimal(point.adjClose || point.close),
              volume: BigInt(Math.round(point.volume || 0)),
            },
            create: {
              symbol: symbol.toUpperCase(),
              date: new Date(point.date),
              open: new Decimal(point.open),
              high: new Decimal(point.high),
              low: new Decimal(point.low),
              close: new Decimal(point.close),
              adjClose: new Decimal(point.adjClose || point.close),
              volume: BigInt(Math.round(point.volume || 0)),
            },
          });
          totalCached++;
        } catch (error) {
          this.logger.warn(
            `Failed to cache price for ${symbol} on ${point.date}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to fetch data for ${symbol}:`, error);
    }

    return totalCached;
  }

  private isBusinessDay(date: Date): boolean {
    const day = date.getDay();
    return day !== 0 && day !== 6; // Not Sunday or Saturday
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
