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
import type {
  ChartInterval,
  ChartRange,
  FundamentalsModule,
  FundamentalsType,
} from './yahoo-finance.service';

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

  @Get('summary/:symbol/profile')
  @ApiOperation({ summary: 'Get company profile (assetProfile + summaryProfile)' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiResponse({ status: 200, description: 'Company profile including info, officers, and description' })
  getProfile(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getQuoteSummary(symbol, [
      'assetProfile',
      'summaryProfile',
    ]);
  }

  @Get('summary/:symbol/financials')
  @ApiOperation({ summary: 'Get financial metrics (financialData + defaultKeyStatistics)' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiResponse({ status: 200, description: 'Financial health metrics and key statistics' })
  getFinancials(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getQuoteSummary(symbol, [
      'financialData',
      'defaultKeyStatistics',
    ]);
  }

  @Get('summary/:symbol/earnings')
  @ApiOperation({ summary: 'Get earnings data (earnings + earningsHistory + earningsTrend)' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiResponse({ status: 200, description: 'Quarterly earnings, historical surprises, and analyst estimates' })
  getEarnings(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getQuoteSummary(symbol, [
      'earnings',
      'earningsHistory',
      'earningsTrend',
    ]);
  }

  @Get('summary/:symbol/holders')
  @ApiOperation({ summary: 'Get institutional and insider holders data' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiResponse({ status: 200, description: 'Institutional ownership, fund ownership, and insider holdings' })
  getHolders(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getQuoteSummary(symbol, [
      'institutionOwnership',
      'fundOwnership',
      'insiderHolders',
      'majorHoldersBreakdown',
    ]);
  }

  @Get('summary/:symbol/analysis')
  @ApiOperation({ summary: 'Get analyst recommendations and rating changes' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiResponse({ status: 200, description: 'Recommendation trends and upgrade/downgrade history' })
  getAnalysis(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getQuoteSummary(symbol, [
      'recommendationTrend',
      'upgradeDowngradeHistory',
    ]);
  }

  @Get('summary/:symbol/calendar')
  @ApiOperation({ summary: 'Get calendar events (earnings dates, dividends, splits)' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiResponse({ status: 200, description: 'Upcoming earnings dates, dividend dates, and split dates' })
  getCalendar(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getQuoteSummary(symbol, ['calendarEvents']);
  }

  @Get('summary/:symbol/sec-filings')
  @ApiOperation({ summary: 'Get SEC filings list' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiResponse({ status: 200, description: 'List of SEC filings' })
  getSecFilings(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getQuoteSummary(symbol, ['secFilings']);
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

  @Get('fundamentals/:symbol')
  @ApiOperation({ summary: 'Get historical fundamental financial data (income statement, balance sheet, cash flow)' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiQuery({
    name: 'module',
    required: true,
    enum: ['financials', 'balance-sheet', 'cash-flow', 'all'],
    description: 'Type of financial statement to retrieve',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['quarterly', 'annual', 'trailing'],
    description: 'Reporting period type (default: annual)',
  })
  @ApiQuery({
    name: 'start',
    required: true,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'end',
    required: false,
    description: 'End date (ISO format, default: today)',
  })
  @ApiResponse({ status: 200, description: 'Historical financial data time series' })
  getFundamentalsTimeSeries(
    @Param('symbol') symbol: string,
    @Query('module') module: FundamentalsModule,
    @Query('start') start: string,
    @Query('type') type?: FundamentalsType,
    @Query('end') end?: string,
  ) {
    return this.yahooFinanceService.getFundamentalsTimeSeries(symbol, {
      period1: new Date(start),
      period2: end ? new Date(end) : undefined,
      type: type || 'annual',
      module,
    });
  }

  @Get('fundamentals/:symbol/income')
  @ApiOperation({ summary: 'Get income statement time series (convenience endpoint)' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['quarterly', 'annual', 'trailing'],
    description: 'Reporting period type (default: annual)',
  })
  @ApiQuery({
    name: 'start',
    required: true,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'end',
    required: false,
    description: 'End date (ISO format, default: today)',
  })
  @ApiResponse({ status: 200, description: 'Income statement data' })
  getIncomeStatement(
    @Param('symbol') symbol: string,
    @Query('start') start: string,
    @Query('type') type?: FundamentalsType,
    @Query('end') end?: string,
  ) {
    return this.yahooFinanceService.getFundamentalsTimeSeries(symbol, {
      period1: new Date(start),
      period2: end ? new Date(end) : undefined,
      type: type || 'annual',
      module: 'financials',
    });
  }

  @Get('fundamentals/:symbol/balance-sheet')
  @ApiOperation({ summary: 'Get balance sheet time series (convenience endpoint)' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['quarterly', 'annual', 'trailing'],
    description: 'Reporting period type (default: annual)',
  })
  @ApiQuery({
    name: 'start',
    required: true,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'end',
    required: false,
    description: 'End date (ISO format, default: today)',
  })
  @ApiResponse({ status: 200, description: 'Balance sheet data' })
  getBalanceSheet(
    @Param('symbol') symbol: string,
    @Query('start') start: string,
    @Query('type') type?: FundamentalsType,
    @Query('end') end?: string,
  ) {
    return this.yahooFinanceService.getFundamentalsTimeSeries(symbol, {
      period1: new Date(start),
      period2: end ? new Date(end) : undefined,
      type: type || 'annual',
      module: 'balance-sheet',
    });
  }

  @Get('fundamentals/:symbol/cash-flow')
  @ApiOperation({ summary: 'Get cash flow statement time series (convenience endpoint)' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['quarterly', 'annual', 'trailing'],
    description: 'Reporting period type (default: annual)',
  })
  @ApiQuery({
    name: 'start',
    required: true,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'end',
    required: false,
    description: 'End date (ISO format, default: today)',
  })
  @ApiResponse({ status: 200, description: 'Cash flow statement data' })
  getCashFlow(
    @Param('symbol') symbol: string,
    @Query('start') start: string,
    @Query('type') type?: FundamentalsType,
    @Query('end') end?: string,
  ) {
    return this.yahooFinanceService.getFundamentalsTimeSeries(symbol, {
      period1: new Date(start),
      period2: end ? new Date(end) : undefined,
      type: type || 'annual',
      module: 'cash-flow',
    });
  }

  @Get('options/:symbol')
  @ApiOperation({ summary: 'Get options chain data for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Expiration date to filter by (ISO format)',
  })
  @ApiResponse({ status: 200, description: 'Options chain with calls and puts' })
  getOptions(
    @Param('symbol') symbol: string,
    @Query('date') date?: string,
  ) {
    return this.yahooFinanceService.getOptions(
      symbol,
      date ? new Date(date) : undefined,
    );
  }

  @Get('options/:symbol/expirations')
  @ApiOperation({ summary: 'Get available options expiration dates for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiResponse({ status: 200, description: 'List of available expiration dates' })
  getOptionsExpirations(@Param('symbol') symbol: string) {
    return this.yahooFinanceService.getOptionsExpirations(symbol);
  }

  @Get('options/:symbol/chain')
  @ApiOperation({ summary: 'Get filtered options chain for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Expiration date to filter by (ISO format)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['calls', 'puts', 'all'],
    description: 'Filter by option type (default: all)',
  })
  @ApiQuery({
    name: 'strikeMin',
    required: false,
    description: 'Minimum strike price',
  })
  @ApiQuery({
    name: 'strikeMax',
    required: false,
    description: 'Maximum strike price',
  })
  @ApiResponse({ status: 200, description: 'Filtered options chain' })
  async getOptionsChain(
    @Param('symbol') symbol: string,
    @Query('date') date?: string,
    @Query('type') type?: 'calls' | 'puts' | 'all',
    @Query('strikeMin') strikeMin?: number,
    @Query('strikeMax') strikeMax?: number,
  ) {
    const options = await this.yahooFinanceService.getOptions(
      symbol,
      date ? new Date(date) : undefined,
    );

    if (!options) {
      return null;
    }

    // Filter the options chain
    const filteredOptions = options.options.map((opt) => {
      let calls = opt.calls;
      let puts = opt.puts;

      // Filter by strike price
      if (strikeMin !== undefined) {
        calls = calls.filter((c) => c.strike >= strikeMin);
        puts = puts.filter((p) => p.strike >= strikeMin);
      }
      if (strikeMax !== undefined) {
        calls = calls.filter((c) => c.strike <= strikeMax);
        puts = puts.filter((p) => p.strike <= strikeMax);
      }

      // Filter by type
      if (type === 'calls') {
        puts = [];
      } else if (type === 'puts') {
        calls = [];
      }

      return {
        ...opt,
        calls,
        puts,
      };
    });

    return {
      ...options,
      options: filteredOptions,
    };
  }
}
