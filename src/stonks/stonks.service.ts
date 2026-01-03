import { Injectable } from '@nestjs/common';
import yahooFinance from 'yahoo-finance2';

@Injectable()
export class StonksService {
  // Search for an asset (e.g., "AAPL" or "Apple")
  async searchSymbol(query: string) {
    const results = await yahooFinance.search(query);
    return results.quotes.filter((q) => q.isYahooFinance);
  }

  // Get detailed info to populate your Asset DB table later
  async getQuote(symbol: string) {
    return await yahooFinance.quote(symbol);
  }

  // Get historical data for charts
  async getHistoricalData(symbol: string, from: string, to: string) {
    return await yahooFinance.historical(symbol, {
      period1: from,
      period2: to,
    });
  }
}
