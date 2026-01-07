// src/realtime/realtime.service.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { YahooFinanceService } from '../yahoo-finance/yahoo-finance.service';
import { PortfolioService } from '../portfolio/portfolio.service';

export interface QuoteUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
}

export interface PortfolioUpdate {
  totalValue: number;
  totalDayChange: number;
  totalDayChangePercent: number;
  holdings: Array<{
    symbol: string;
    currentValue: number;
    dayChange: number;
  }>;
  timestamp: Date;
}

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);

  // Track subscriptions: symbol -> Set of userIds
  private quoteSubscriptions = new Map<string, Set<string>>();

  // Track user subscriptions: userId -> Set of symbols
  private userSubscriptions = new Map<string, Set<string>>();

  // Portfolio subscription: userId -> boolean
  private portfolioSubscriptions = new Set<string>();

  constructor(
    private yahooFinance: YahooFinanceService,
    private portfolioService: PortfolioService,
  ) {}

  onModuleDestroy() {
    // Cleanup on module destroy
    this.quoteSubscriptions.clear();
    this.userSubscriptions.clear();
    this.portfolioSubscriptions.clear();
  }

  subscribeToQuotes(userId: string, symbols: string[]): void {
    // Initialize user subscription set if needed
    if (!this.userSubscriptions.has(userId)) {
      this.userSubscriptions.set(userId, new Set());
    }

    const userSubs = this.userSubscriptions.get(userId)!;

    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      userSubs.add(upperSymbol);

      if (!this.quoteSubscriptions.has(upperSymbol)) {
        this.quoteSubscriptions.set(upperSymbol, new Set());
      }
      this.quoteSubscriptions.get(upperSymbol)!.add(userId);
    }

    this.logger.debug(`User ${userId} subscribed to: ${symbols.join(', ')}`);
  }

  unsubscribeFromQuotes(userId: string, symbols: string[]): void {
    const userSubs = this.userSubscriptions.get(userId);
    if (!userSubs) return;

    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      userSubs.delete(upperSymbol);

      const quoteSub = this.quoteSubscriptions.get(upperSymbol);
      if (quoteSub) {
        quoteSub.delete(userId);
        if (quoteSub.size === 0) {
          this.quoteSubscriptions.delete(upperSymbol);
        }
      }
    }

    this.logger.debug(`User ${userId} unsubscribed from: ${symbols.join(', ')}`);
  }

  unsubscribeAll(userId: string): void {
    const userSubs = this.userSubscriptions.get(userId);
    if (userSubs) {
      this.unsubscribeFromQuotes(userId, Array.from(userSubs));
      this.userSubscriptions.delete(userId);
    }
    this.portfolioSubscriptions.delete(userId);
    this.logger.debug(`User ${userId} unsubscribed from all`);
  }

  subscribeToPortfolio(userId: string): void {
    this.portfolioSubscriptions.add(userId);
    this.logger.debug(`User ${userId} subscribed to portfolio updates`);
  }

  unsubscribeFromPortfolio(userId: string): void {
    this.portfolioSubscriptions.delete(userId);
    this.logger.debug(`User ${userId} unsubscribed from portfolio updates`);
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.quoteSubscriptions.keys());
  }

  getUsersForSymbol(symbol: string): string[] {
    return Array.from(this.quoteSubscriptions.get(symbol.toUpperCase()) || []);
  }

  getPortfolioSubscribers(): string[] {
    return Array.from(this.portfolioSubscriptions);
  }

  hasActiveSubscriptions(): boolean {
    return (
      this.quoteSubscriptions.size > 0 || this.portfolioSubscriptions.size > 0
    );
  }

  async fetchQuoteUpdates(): Promise<Map<string, QuoteUpdate>> {
    const symbols = this.getSubscribedSymbols();
    if (symbols.length === 0) return new Map();

    try {
      const quotes = await this.yahooFinance.getQuotes(symbols);
      const updates = new Map<string, QuoteUpdate>();

      for (const quote of quotes) {
        updates.set(quote.symbol, {
          symbol: quote.symbol,
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          volume: quote.regularMarketVolume || 0,
          timestamp: new Date(),
        });
      }

      return updates;
    } catch (error) {
      this.logger.error('Error fetching quote updates:', error);
      return new Map();
    }
  }

  async fetchPortfolioUpdate(userId: string): Promise<PortfolioUpdate | null> {
    try {
      const summary = await this.portfolioService.getPortfolioSummary(userId);

      return {
        totalValue: summary.totalValue,
        totalDayChange: summary.totalDayChange,
        totalDayChangePercent: summary.totalDayChangePercent,
        holdings: summary.holdings.map((h) => ({
          symbol: h.asset.symbol,
          currentValue: h.currentValue || 0,
          dayChange: h.dayChange || 0,
        })),
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch portfolio for user ${userId}:`, error);
      return null;
    }
  }
}
