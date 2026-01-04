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

  async onModuleInit() {
    this.yahooFinance = new YahooFinance();
    this.logger.log('Yahoo Finance service initialized');
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      const result = await this.yahooFinance.search(query, {
        quotesCount: limit,
        newsCount: 0,
      });

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
      const result = await this.yahooFinance.quote(symbol);
      return result as QuoteResult;
    } catch (error) {
      this.logger.error(`Failed to get quote for ${symbol}:`, error);
      return null;
    }
  }

  async getQuotes(symbols: string[]): Promise<QuoteResult[]> {
    try {
      const results = await Promise.allSettled(
        symbols.map((s) => this.yahooFinance.quote(s)),
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
}
