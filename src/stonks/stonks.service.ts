import { Injectable } from '@nestjs/common';
import { YahooFinanceService } from '../yahoo-finance/yahoo-finance.service';

@Injectable()
export class StonksService {
  constructor(private readonly yahooFinance: YahooFinanceService) {}

  // Search for an asset (e.g., "AAPL" or "Apple")
  async searchSymbol(query: string) {
    return this.yahooFinance.search(query);
  }

  // Get detailed info to populate your Asset DB table later
  async getQuote(symbol: string) {
    return this.yahooFinance.getQuote(symbol);
  }

  // Get historical data for charts
  async getHistoricalData(symbol: string, from: string, to: string) {
    return this.yahooFinance.getHistoricalData(
      symbol,
      new Date(from),
      new Date(to),
    );
  }
}
