// src/yahoo-finance/yahoo-finance.controller.ts
import { Controller, Get, Query, Param } from '@nestjs/common';
import { YahooFinanceService } from './yahoo-finance.service';

@Controller('yahoo-finance')
export class YahooFinanceController {
  constructor(private readonly yahooFinanceService: YahooFinanceService) {}

  @Get('search')
  search(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.yahooFinanceService.search(query, limit || 10);
  }

  @Get('quote/:symbol')
  getQuote(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getQuote(symbol);
  }

  @Get('quotes')
  getQuotes(@Query('symbols') symbols: string) {
    const symbolList = symbols.split(',').map((s) => s.trim());
    return this.yahooFinanceService.getQuotes(symbolList);
  }

  @Get('historical/:symbol')
  getHistoricalData(
    @Param('symbol') symbol: string,
    @Query('start') start: string,
    @Query('end') end?: string,
    @Query('interval') interval?: '1d' | '1wk' | '1mo',
  ) {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    return this.yahooFinanceService.getHistoricalData(
      symbol,
      startDate,
      endDate,
      interval || '1d',
    );
  }

  @Get('summary/:symbol')
  getQuoteSummary(
    @Param('symbol') symbol: string,
    @Query('modules') modules?: string,
  ) {
    const moduleList = modules
      ? modules.split(',').map((m) => m.trim())
      : ['price', 'summaryDetail'];
    return this.yahooFinanceService.getQuoteSummary(symbol, moduleList);
  }
}
