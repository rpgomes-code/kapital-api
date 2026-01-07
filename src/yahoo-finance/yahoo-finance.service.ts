// src/yahoo-finance/yahoo-finance.service.ts
import { Injectable, Logger, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
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

export type FundamentalsModule = 'financials' | 'balance-sheet' | 'cash-flow' | 'all';
export type FundamentalsType = 'quarterly' | 'annual' | 'trailing';

export interface FundamentalsTimeSeriesOptions {
  period1: Date;
  period2?: Date;
  type?: FundamentalsType;
  module: FundamentalsModule;
}

export interface FundamentalsResult {
  date: Date;
  periodType: '3M' | '12M';
  [key: string]: any;
}

export interface OptionsContract {
  contractSymbol: string;
  strike: number;
  currency?: string;
  lastPrice: number;
  change: number;
  percentChange?: number;
  volume?: number;
  openInterest?: number;
  bid?: number;
  ask?: number;
  contractSize: string;
  expiration: Date;
  lastTradeDate: Date;
  impliedVolatility: number;
  inTheMoney: boolean;
}

export interface OptionsChain {
  expirationDate: Date;
  hasMiniOptions: boolean;
  calls: OptionsContract[];
  puts: OptionsContract[];
}

export interface OptionsResult {
  underlyingSymbol: string;
  expirationDates: Date[];
  strikes: number[];
  hasMiniOptions: boolean;
  quote: QuoteResult;
  options: OptionsChain[];
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

  // Cache TTL settings in milliseconds
  private readonly cacheTTL = {
    quote: 30 * 1000, // 30 seconds
    quotes: 30 * 1000, // 30 seconds
    chart: 5 * 60 * 1000, // 5 minutes
    recommendations: 60 * 60 * 1000, // 1 hour
    quoteSummary: 30 * 60 * 1000, // 30 minutes
    trending: 5 * 60 * 1000, // 5 minutes
    insights: 30 * 60 * 1000, // 30 minutes
    screener: 10 * 60 * 1000, // 10 minutes
  };

  constructor(
    @Optional() @Inject(CACHE_MANAGER) private cacheManager?: Cache,
  ) {}

  async onModuleInit() {
    this.yahooFinance = new YahooFinance();
    this.logger.log('Yahoo Finance service initialized');
    if (this.cacheManager) {
      this.logger.log('Redis caching enabled for Yahoo Finance');
    } else {
      this.logger.log('Running without cache - set up Redis for better performance');
    }
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
    const cacheKey = `yf:quote:${symbol.toUpperCase()}`;

    // Check cache first
    if (this.cacheManager) {
      const cached = await this.cacheManager.get<QuoteResult>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for quote: ${symbol}`);
        return cached;
      }
    }

    try {
      const result = await this.withRetry(
        () => this.yahooFinance.quote(symbol),
        `quote(${symbol})`,
      );

      // Cache the result
      if (this.cacheManager && result) {
        await this.cacheManager.set(cacheKey, result, this.cacheTTL.quote);
      }

      return result as QuoteResult;
    } catch (error) {
      this.logger.error(`Failed to get quote for ${symbol}:`, error);
      return null;
    }
  }

  async getQuotes(symbols: string[]): Promise<QuoteResult[]> {
    if (symbols.length === 0) return [];

    const results: QuoteResult[] = [];
    const uncachedSymbols: string[] = [];

    // Check cache for each symbol
    if (this.cacheManager) {
      for (const symbol of symbols) {
        const cacheKey = `yf:quote:${symbol.toUpperCase()}`;
        const cached = await this.cacheManager.get<QuoteResult>(cacheKey);
        if (cached) {
          results.push(cached);
        } else {
          uncachedSymbols.push(symbol);
        }
      }
    } else {
      uncachedSymbols.push(...symbols);
    }

    // Fetch uncached symbols
    if (uncachedSymbols.length > 0) {
      try {
        const fetched = await Promise.allSettled(
          uncachedSymbols.map((s) =>
            this.withRetry(() => this.yahooFinance.quote(s), `quote(${s})`),
          ),
        );

        for (let i = 0; i < fetched.length; i++) {
          if (fetched[i].status === 'fulfilled') {
            const quote = (fetched[i] as PromiseFulfilledResult<any>).value as QuoteResult;
            results.push(quote);

            // Cache each quote
            if (this.cacheManager && quote) {
              const cacheKey = `yf:quote:${uncachedSymbols[i].toUpperCase()}`;
              await this.cacheManager.set(cacheKey, quote, this.cacheTTL.quotes);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Failed to get quotes:`, error);
      }
    }

    return results;
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
    const cacheKey = `yf:recommendations:${symbol.toUpperCase()}`;

    // Check cache first
    if (this.cacheManager) {
      const cached = await this.cacheManager.get<RecommendationResult>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for recommendations: ${symbol}`);
        return cached;
      }
    }

    try {
      const result = await this.withRetry(
        () => this.yahooFinance.recommendationsBySymbol(symbol),
        `recommendations(${symbol})`,
      );

      const recommendations = {
        symbol: result.symbol,
        score: (result as any).score || 0,
        recommendedSymbols: (result.recommendedSymbols || []).map((r: any) => ({
          symbol: r.symbol,
          score: r.score || 0,
        })),
      };

      // Cache the result
      if (this.cacheManager) {
        await this.cacheManager.set(cacheKey, recommendations, this.cacheTTL.recommendations);
      }

      return recommendations;
    } catch (error) {
      this.logger.error(`Failed to get recommendations for ${symbol}:`, error);
      return null;
    }
  }

  async getTrendingSymbols(
    region: string = 'US',
    count: number = 20,
  ): Promise<TrendingSymbol[]> {
    const cacheKey = `yf:trending:${region}:${count}`;

    // Check cache first
    if (this.cacheManager) {
      const cached = await this.cacheManager.get<TrendingSymbol[]>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for trending: ${region}`);
        return cached;
      }
    }

    try {
      const result = await this.withRetry(
        () => this.yahooFinance.trendingSymbols(region, { count }),
        `trendingSymbols(${region})`,
      );

      const symbols = result.quotes?.map((q: any) => q.symbol) || [];
      if (symbols.length === 0) return [];

      // Get quotes for trending symbols
      const quotes = await this.getQuotes(symbols);

      const trending = quotes.map((q) => ({
        symbol: q.symbol,
        shortName: q.shortName,
        longName: q.longName,
        regularMarketPrice: q.regularMarketPrice,
        regularMarketChange: q.regularMarketChange,
        regularMarketChangePercent: q.regularMarketChangePercent,
      }));

      // Cache the result
      if (this.cacheManager) {
        await this.cacheManager.set(cacheKey, trending, this.cacheTTL.trending);
      }

      return trending;
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
    const cacheKey = `yf:insights:${symbol.toUpperCase()}`;

    // Check cache first
    if (this.cacheManager) {
      const cached = await this.cacheManager.get<InsightsResult>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for insights: ${symbol}`);
        return cached;
      }
    }

    try {
      const result = await this.withRetry(
        () => this.yahooFinance.insights(symbol),
        `insights(${symbol})`,
      );

      const insights = {
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

      // Cache the result
      if (this.cacheManager) {
        await this.cacheManager.set(cacheKey, insights, this.cacheTTL.insights);
      }

      return insights;
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

  async getFundamentalsTimeSeries(
    symbol: string,
    options: FundamentalsTimeSeriesOptions,
  ): Promise<FundamentalsResult[]> {
    try {
      const result = await this.withRetry(
        () =>
          this.yahooFinance.fundamentalsTimeSeries(symbol, {
            period1: options.period1,
            period2: options.period2 || new Date(),
            type: options.type || 'annual',
            module: options.module,
          }),
        `fundamentalsTimeSeries(${symbol})`,
      );

      return (result || []).map((item: any) => ({
        date: item.date,
        periodType: item.periodType,
        ...item,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get fundamentals time series for ${symbol}:`,
        error,
      );
      return [];
    }
  }

  async getOptions(
    symbol: string,
    date?: Date,
  ): Promise<OptionsResult | null> {
    try {
      const queryOptions: any = {
        formatted: false,
        lang: 'en-US',
        region: 'US',
      };

      if (date) {
        queryOptions.date = date;
      }

      const result = await this.withRetry(
        () => this.yahooFinance.options(symbol, queryOptions),
        `options(${symbol})`,
      );

      return {
        underlyingSymbol: result.underlyingSymbol,
        expirationDates: result.expirationDates || [],
        strikes: result.strikes || [],
        hasMiniOptions: result.hasMiniOptions || false,
        quote: result.quote as QuoteResult,
        options: (result.options || []).map((opt: any) => ({
          expirationDate: opt.expirationDate,
          hasMiniOptions: opt.hasMiniOptions || false,
          calls: (opt.calls || []).map((c: any) => ({
            contractSymbol: c.contractSymbol,
            strike: c.strike,
            currency: c.currency,
            lastPrice: c.lastPrice,
            change: c.change,
            percentChange: c.percentChange,
            volume: c.volume,
            openInterest: c.openInterest,
            bid: c.bid,
            ask: c.ask,
            contractSize: c.contractSize,
            expiration: c.expiration,
            lastTradeDate: c.lastTradeDate,
            impliedVolatility: c.impliedVolatility,
            inTheMoney: c.inTheMoney,
          })),
          puts: (opt.puts || []).map((p: any) => ({
            contractSymbol: p.contractSymbol,
            strike: p.strike,
            currency: p.currency,
            lastPrice: p.lastPrice,
            change: p.change,
            percentChange: p.percentChange,
            volume: p.volume,
            openInterest: p.openInterest,
            bid: p.bid,
            ask: p.ask,
            contractSize: p.contractSize,
            expiration: p.expiration,
            lastTradeDate: p.lastTradeDate,
            impliedVolatility: p.impliedVolatility,
            inTheMoney: p.inTheMoney,
          })),
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get options for ${symbol}:`, error);
      return null;
    }
  }

  async getOptionsExpirations(symbol: string): Promise<Date[]> {
    try {
      const result = await this.withRetry(
        () => this.yahooFinance.options(symbol, { formatted: false }),
        `options-expirations(${symbol})`,
      );
      return result.expirationDates || [];
    } catch (error) {
      this.logger.error(
        `Failed to get options expirations for ${symbol}:`,
        error,
      );
      return [];
    }
  }
}
