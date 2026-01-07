// src/yahoo-finance/yahoo-finance.controller.ts
import { Controller, Get, Query, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { YahooFinanceService } from './yahoo-finance.service';
import type { ChartInterval, ChartRange } from './yahoo-finance.service';

@ApiTags('yahoo-finance')
@Controller('yahoo-finance')
@AllowAnonymous() // All Yahoo Finance endpoints are public (market data)
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
  @ApiQuery({
    name: 'modules',
    required: false,
    description: 'Comma-separated modules (default: price,summaryDetail)',
  })
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

  @Get('chart/:symbol')
  @ApiOperation({ summary: 'Get chart data for a symbol with various intervals' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiQuery({
    name: 'interval',
    required: false,
    enum: ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo'],
    description: 'Data interval (default: 1d)',
  })
  @ApiQuery({
    name: 'range',
    required: false,
    enum: ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'],
    description: 'Time range (default: 1mo)',
  })
  @ApiQuery({
    name: 'start',
    required: false,
    description: 'Start date (ISO format) - alternative to range',
  })
  @ApiQuery({
    name: 'end',
    required: false,
    description: 'End date (ISO format) - used with start',
  })
  @ApiQuery({
    name: 'includePrePost',
    required: false,
    description: 'Include pre/post market data (default: false)',
  })
  @ApiResponse({ status: 200, description: 'Chart data with OHLCV quotes' })
  getChart(
    @Param('symbol') symbol: string,
    @Query('interval') interval?: ChartInterval,
    @Query('range') range?: ChartRange,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('includePrePost') includePrePost?: string,
  ) {
    return this.yahooFinanceService.getChart(symbol, {
      interval,
      range,
      period1: start ? new Date(start) : undefined,
      period2: end ? new Date(end) : undefined,
      includePrePost: includePrePost === 'true',
    });
  }

  @Get('recommendations/:symbol')
  @ApiOperation({ summary: 'Get recommended similar symbols for a security' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiResponse({ status: 200, description: 'List of recommended symbols' })
  getRecommendations(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getRecommendations(symbol);
  }

  @Get('insights/:symbol')
  @ApiOperation({ summary: 'Get AI-powered insights and analysis for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiResponse({ status: 200, description: 'Insights including company snapshot, recommendations, and events' })
  getInsights(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getInsights(symbol);
  }

  @Get('market/trending')
  @ApiOperation({ summary: 'Get trending symbols by region' })
  @ApiQuery({
    name: 'region',
    required: false,
    description: 'Region code (default: US). Examples: US, GB, DE, FR, JP',
  })
  @ApiQuery({
    name: 'count',
    required: false,
    description: 'Number of results (default: 20)',
  })
  @ApiResponse({ status: 200, description: 'List of trending symbols with quotes' })
  getTrending(
    @Query('region') region?: string,
    @Query('count') count?: number,
  ) {
    return this.yahooFinanceService.getTrendingSymbols(region || 'US', count || 20);
  }

  @Get('market/gainers')
  @ApiOperation({ summary: 'Get top daily gainers' })
  @ApiQuery({
    name: 'count',
    required: false,
    description: 'Number of results (default: 20)',
  })
  @ApiResponse({ status: 200, description: 'List of top gaining stocks' })
  getDailyGainers(@Query('count') count?: number) {
    return this.yahooFinanceService.getDailyGainers(count || 20);
  }

  @Get('market/losers')
  @ApiOperation({ summary: 'Get top daily losers' })
  @ApiQuery({
    name: 'count',
    required: false,
    description: 'Number of results (default: 20)',
  })
  @ApiResponse({ status: 200, description: 'List of top losing stocks' })
  getDailyLosers(@Query('count') count?: number) {
    return this.yahooFinanceService.getDailyLosers(count || 20);
  }

  @Get('screener/:preset')
  @ApiOperation({ summary: 'Run a predefined stock screener' })
  @ApiParam({
    name: 'preset',
    description: 'Screener preset ID. Examples: day_gainers, day_losers, most_actives, undervalued_growth_stocks, growth_technology_stocks',
  })
  @ApiQuery({
    name: 'count',
    required: false,
    description: 'Number of results (default: 25)',
  })
  @ApiResponse({ status: 200, description: 'List of stocks matching screener criteria' })
  getScreener(
    @Param('preset') preset: string,
    @Query('count') count?: number,
  ) {
    return this.yahooFinanceService.getScreener(preset, {
      count: count || 25,
    });
  }
}
