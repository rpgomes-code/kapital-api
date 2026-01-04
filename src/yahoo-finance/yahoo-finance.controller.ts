// src/yahoo-finance/yahoo-finance.controller.ts
import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { YahooFinanceService } from './yahoo-finance.service';

@ApiTags('yahoo-finance')
@Controller('yahoo-finance')
export class YahooFinanceController {
  constructor(private readonly yahooFinanceService: YahooFinanceService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search for securities on Yahoo Finance' })
  @ApiQuery({ name: 'q', description: 'Search query (symbol or company name)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'List of matching securities' })
  search(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.yahooFinanceService.search(query, limit || 10);
  }

  @Get('quote/:symbol')
  @ApiOperation({ summary: 'Get real-time quote for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol (e.g., AAPL, MSFT)' })
  @ApiResponse({ status: 200, description: 'Current quote data' })
  @ApiResponse({ status: 404, description: 'Symbol not found' })
  getQuote(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getQuote(symbol);
  }

  @Get('quotes')
  @ApiOperation({ summary: 'Get real-time quotes for multiple symbols' })
  @ApiQuery({ name: 'symbols', description: 'Comma-separated list of symbols' })
  @ApiResponse({ status: 200, description: 'List of quote data' })
  getQuotes(@Query('symbols') symbols: string) {
    const symbolList = symbols.split(',').map((s) => s.trim());
    return this.yahooFinanceService.getQuotes(symbolList);
  }

  @Get('historical/:symbol')
  @ApiOperation({ summary: 'Get historical price data for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiQuery({ name: 'start', description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'end', required: false, description: 'End date (ISO format, default: today)' })
  @ApiQuery({ name: 'interval', required: false, enum: ['1d', '1wk', '1mo'], description: 'Data interval (default: 1d)' })
  @ApiResponse({ status: 200, description: 'Historical price data' })
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
  @ApiOperation({ summary: 'Get detailed quote summary for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiQuery({ name: 'modules', required: false, description: 'Comma-separated modules (default: price,summaryDetail)' })
  @ApiResponse({ status: 200, description: 'Detailed quote summary data' })
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
