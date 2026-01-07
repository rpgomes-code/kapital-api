// src/yahoo-finance/yahoo-finance.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import YahooFinance from 'yahoo-finance2';

export interface QuoteResult {
  symbol: string;
  shortName?: string;
  longName?: string;
  quoteType: string;
  exchange: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketOpen?: number;
  regularMarketPreviousClose?: number;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketState?: string;
}

export type ChartInterval =
  | '1m'
  | '2m'
  | '5m'
  | '15m'
  | '30m'
  | '60m'
  | '90m'
  | '1h'
  | '1d'
  | '5d'
  | '1wk'
  | '1mo'
  | '3mo';

export type ChartRange =
  | '1d'
  | '5d'
  | '1mo'
  | '3mo'
  | '6mo'
  | '1y'
  | '2y'
  | '5y'
  | '10y'
  | 'ytd'
  | 'max';

export interface ChartDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

export interface ChartResult {
  symbol: string;
  currency: string;
  exchangeName: string;
  instrumentType: string;
  regularMarketPrice: number;
  previousClose?: number;
  chartPreviousClose?: number;
  dataGranularity: string;
  range: string;
  quotes: ChartDataPoint[];
}

export interface RecommendationResult {
  symbol: string;
  score: number;
  recommendedSymbols: Array<{
    symbol: string;
    score: number;
  }>;
}

export interface TrendingSymbol {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
}

export interface InsightsResult {
  symbol: string;
  instrumentInfo?: any;
  companySnapshot?: any;
  recommendation?: any;
  events?: any;
  reports?: any;
  sigDevs?: any;
  secReports?: any;
  upsell?: any;
}

export interface HistoricalDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

export interface SearchResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  typeDisp?: string;
  quoteType?: string;
  exchange?: string;
}

@Injectable()
export class YahooFinanceService implements OnModuleInit {
  private readonly logger = new Logger(YahooFinanceService.name);
  private yahooFinance: InstanceType<typeof YahooFinance>;
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second

  async onModuleInit() {
    this.yahooFinance = new YahooFinance();
    this.logger.log('Yahoo Finance service initialized');
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const isLastAttempt = attempt === this.maxRetries;

        if (isLastAttempt) {
          this.logger.error(
            `${operationName} failed after ${this.maxRetries} attempts: ${lastError.message}`,
          );
          throw lastError;
        }

        // Exponential backoff with jitter
        const delay = this.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        this.logger.warn(
          `${operationName} failed (attempt ${attempt}/${this.maxRetries}), retrying in ${Math.round(delay)}ms...`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      const result = await this.withRetry(
        () =>
          this.yahooFinance.search(query, {
            quotesCount: limit,
            newsCount: 0,
          }),
        `search(${query})`,
      );

      return result.quotes
        .filter((q: any) => q.isYahooFinance !== false)
        .map((q: any) => ({
          symbol: q.symbol,
          shortname: q.shortname,
          longname: q.longname,
          exchDisp: q.exchDisp,
          typeDisp: q.typeDisp,
          quoteType: q.quoteType,
          exchange: q.exchange,
        }));
    } catch (error) {
      this.logger.error(`Search failed for query "${query}":`, error);
      return [];
    }
  }

  async getQuote(symbol: string): Promise<QuoteResult | null> {
    try {
      const result = await this.withRetry(
        () => this.yahooFinance.quote(symbol),
        `quote(${symbol})`,
      );
      return result as QuoteResult;
    } catch (error) {
      this.logger.error(`Failed to get quote for ${symbol}:`, error);
      return null;
    }
  }

  async getQuotes(symbols: string[]): Promise<QuoteResult[]> {
    if (symbols.length === 0) return [];

    try {
      const results = await Promise.allSettled(
        symbols.map((s) =>
          this.withRetry(() => this.yahooFinance.quote(s), `quote(${s})`),
        ),
      );

      return results
        .filter(
          (r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled',
        )
        .map((r) => r.value as QuoteResult);
    } catch (error) {
      this.logger.error(`Failed to get quotes:`, error);
      return [];
    }
  }

  async getHistoricalData(
    symbol: string,
    period1: Date,
    period2: Date = new Date(),
    interval: '1d' | '1wk' | '1mo' = '1d',
  ): Promise<HistoricalDataPoint[]> {
    try {
      const result = await this.yahooFinance.chart(symbol, {
        period1,
        period2,
        interval,
      });

      if (!result.quotes) {
        return [];
      }

      return result.quotes.map((q: any) => ({
        date: q.date,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
        adjClose: q.adjclose,
      }));
    } catch (error) {
      this.logger.error(`Failed to get historical data for ${symbol}:`, error);
      return [];
    }
  }

  async getQuoteSummary(
    symbol: string,
    modules: string[] = ['price', 'summaryDetail'],
  ) {
    try {
      const result = await this.yahooFinance.quoteSummary(symbol, {
        modules: modules as any,
      });
      return result;
    } catch (error) {
      this.logger.error(`Failed to get quote summary for ${symbol}:`, error);
      return null;
    }
  }

  async getDividendHistory(symbol: string, startDate: Date): Promise<any[]> {
    try {
      const result = await this.yahooFinance.chart(symbol, {
        period1: startDate,
        events: 'dividends',
      });

      return result.events?.dividends || [];
    } catch (error) {
      this.logger.error(`Failed to get dividend history for ${symbol}:`, error);
      return [];
    }
  }

  async getSplitHistory(symbol: string, startDate: Date): Promise<any[]> {
    try {
      const result = await this.yahooFinance.chart(symbol, {
        period1: startDate,
        events: 'splits',
      });

      return result.events?.splits || [];
    } catch (error) {
      this.logger.error(`Failed to get split history for ${symbol}:`, error);
      return [];
    }
  }

  async getChart(
    symbol: string,
    options: {
      interval?: ChartInterval;
      range?: ChartRange;
      period1?: Date;
      period2?: Date;
      includePrePost?: boolean;
    } = {},
  ): Promise<ChartResult | null> {
    try {
      const chartOptions: any = {
        interval: options.interval || '1d',
        includePrePost: options.includePrePost || false,
      };

      if (options.range) {
        chartOptions.range = options.range;
      } else if (options.period1) {
        chartOptions.period1 = options.period1;
        chartOptions.period2 = options.period2 || new Date();
      } else {
        chartOptions.range = '1mo';
      }

      const result = await this.withRetry(
        () => this.yahooFinance.chart(symbol, chartOptions),
        `chart(${symbol})`,
      );

      const quotes = Array.isArray(result.quotes) ? result.quotes : [];

      return {
        symbol: result.meta.symbol,
        currency: result.meta.currency,
        exchangeName: result.meta.exchangeName,
        instrumentType: result.meta.instrumentType,
        regularMarketPrice: result.meta.regularMarketPrice,
        previousClose: result.meta.previousClose,
        chartPreviousClose: result.meta.chartPreviousClose,
        dataGranularity: result.meta.dataGranularity,
        range: result.meta.range,
        quotes: quotes.map((q: any) => ({
          date: q.date,
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
          volume: q.volume,
          adjClose: q.adjclose,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get chart for ${symbol}:`, error);
      return null;
    }
  }

  async getRecommendations(
    symbol: string,
  ): Promise<RecommendationResult | null> {
    try {
      const result = await this.withRetry(
        () => this.yahooFinance.recommendationsBySymbol(symbol),
        `recommendations(${symbol})`,
      );

      return {
        symbol: result.symbol,
        score: (result as any).score || 0,
        recommendedSymbols: (result.recommendedSymbols || []).map((r: any) => ({
          symbol: r.symbol,
          score: r.score || 0,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get recommendations for ${symbol}:`, error);
      return null;
    }
  }

  async getTrendingSymbols(
    region: string = 'US',
    count: number = 20,
  ): Promise<TrendingSymbol[]> {
    try {
      const result = await this.withRetry(
        () => this.yahooFinance.trendingSymbols(region, { count }),
        `trendingSymbols(${region})`,
      );

      const symbols = result.quotes?.map((q: any) => q.symbol) || [];
      if (symbols.length === 0) return [];

      // Get quotes for trending symbols
      const quotes = await this.getQuotes(symbols);

      return quotes.map((q) => ({
        symbol: q.symbol,
        shortName: q.shortName,
        longName: q.longName,
        regularMarketPrice: q.regularMarketPrice,
        regularMarketChange: q.regularMarketChange,
        regularMarketChangePercent: q.regularMarketChangePercent,
      }));
    } catch (error) {
      this.logger.error(`Failed to get trending symbols for ${region}:`, error);
      return [];
    }
  }

  async getDailyGainers(count: number = 20): Promise<QuoteResult[]> {
    try {
      const result = await this.withRetry(
        () => this.yahooFinance.dailyGainers(),
        'dailyGainers',
      );
      const quotes = (result as any).quotes || [];
      return quotes.slice(0, count) as QuoteResult[];
    } catch (error) {
      this.logger.error(`Failed to get daily gainers:`, error);
      return [];
    }
  }

  async getDailyLosers(count: number = 20): Promise<QuoteResult[]> {
    try {
      const result = await this.withRetry(
        () => this.yahooFinance.dailyLosers(),
        'dailyLosers',
      );
      const quotes = (result as any).quotes || [];
      return quotes.slice(0, count) as QuoteResult[];
    } catch (error) {
      this.logger.error(`Failed to get daily losers:`, error);
      return [];
    }
  }

  async getInsights(symbol: string): Promise<InsightsResult | null> {
    try {
      const result = await this.withRetry(
        () => this.yahooFinance.insights(symbol),
        `insights(${symbol})`,
      );

      return {
        symbol: result.symbol,
        instrumentInfo: result.instrumentInfo,
        companySnapshot: result.companySnapshot,
        recommendation: result.recommendation,
        events: result.events,
        reports: result.reports,
        sigDevs: result.sigDevs,
        secReports: result.secReports,
        upsell: result.upsell,
      };
    } catch (error) {
      this.logger.error(`Failed to get insights for ${symbol}:`, error);
      return null;
    }
  }

  async getScreener(
    predefined: string,
    options: { count?: number } = {},
  ): Promise<QuoteResult[]> {
    try {
      const result = await this.withRetry(
        () =>
          this.yahooFinance.screener(
            {
              scrIds: predefined as any,
              count: options.count || 25,
            },
            undefined,
            { validateResult: false },
          ),
        `screener(${predefined})`,
      );

      const quotes = (result as any)?.quotes || [];
      return quotes as QuoteResult[];
    } catch (error) {
      this.logger.error(`Failed to run screener ${predefined}:`, error);
      return [];
    }
  }
}
