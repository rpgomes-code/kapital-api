// src/portfolio/portfolio.controller.ts
import { Controller, Get, Post, Query, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { PortfolioService } from './portfolio.service';
import { AnalyticsService } from './services/analytics.service';
import { SnapshotService } from './services/snapshot.service';
import { DividendService } from './services/dividend.service';
import { TaxLotService } from './services/tax-lot.service';
import { CurrencyService } from './services/currency.service';
import { PortfolioSummaryDto } from './dto/portfolio-summary.dto';
import {
  PerformanceMetricsDto,
  EnhancedPerformanceMetricsDto,
  BenchmarkComparisonDto,
} from './dto/performance-metrics.dto';
import { SectorAllocationDto } from './dto/allocation.dto';
import {
  PortfolioHistoryDto,
  PortfolioSnapshotDto,
  DetailedSnapshotDto,
  HistoryInterval,
} from './dto/portfolio-history.dto';
import {
  DividendSummaryDto,
  DividendHistoryDto,
  DividendBreakdownDto,
  DividendCalendarDto,
  DividendProjectionDto,
} from './dto/dividend.dto';
import {
  AssetTaxLotsDto,
  RealizedGainsSummaryDto,
  TaxLossHarvestingSummaryDto,
  GainType,
} from './dto/tax-lot.dto';
import {
  ExchangeRateDto,
  CurrencyConversionDto,
  MultiCurrencyRatesDto,
  PortfolioMultiCurrencyDto,
  FxGainLossDetailDto,
} from './dto/currency.dto';

@ApiTags('portfolio')
@ApiBearerAuth('bearer-auth')
@Controller('portfolio')
export class PortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly analyticsService: AnalyticsService,
    private readonly snapshotService: SnapshotService,
    private readonly dividendService: DividendService,
    private readonly taxLotService: TaxLotService,
    private readonly currencyService: CurrencyService,
  ) {}

  // ==========================================
  // PORTFOLIO SUMMARY & HOLDINGS
  // ==========================================

  @Get('summary')
  @ApiOperation({ summary: 'Get portfolio summary with holdings and current values' })
  @ApiQuery({ name: 'currency', required: false, description: 'Display currency (default: USD)' })
  @ApiResponse({ status: 200, description: 'Portfolio summary with holdings, values, and gains', type: PortfolioSummaryDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSummary(
    @Session() session: UserSession,
    @Query('currency') currency?: string,
  ) {
    // TODO: Add currency conversion support
    return this.portfolioService.getPortfolioSummary(session.user.id);
  }

  // ==========================================
  // PERFORMANCE METRICS
  // ==========================================

  @Get('performance')
  @ApiOperation({ summary: 'Get basic portfolio performance metrics' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO format)' })
  @ApiResponse({ status: 200, description: 'Performance metrics including returns and gains', type: PerformanceMetricsDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getPerformance(
    @Session() session: UserSession,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.portfolioService.getPerformanceMetrics(
      session.user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('performance/enhanced')
  @ApiOperation({ summary: 'Get enhanced performance metrics (TWR, Sharpe, Beta, Alpha, etc.)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO format)' })
  @ApiQuery({ name: 'benchmark', required: false, description: 'Benchmark symbol (e.g., SPY)' })
  @ApiResponse({ status: 200, description: 'Enhanced performance metrics', type: EnhancedPerformanceMetricsDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getEnhancedPerformance(
    @Session() session: UserSession,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('benchmark') benchmark?: string,
  ) {
    return this.analyticsService.getEnhancedPerformanceMetrics(
      session.user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      benchmark,
    );
  }

  @Get('vs-benchmark')
  @ApiOperation({ summary: 'Compare portfolio performance against a benchmark' })
  @ApiQuery({ name: 'benchmark', required: true, description: 'Benchmark symbol (e.g., SPY, QQQ)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO format)' })
  @ApiResponse({ status: 200, description: 'Benchmark comparison', type: BenchmarkComparisonDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getBenchmarkComparison(
    @Session() session: UserSession,
    @Query('benchmark') benchmark: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getBenchmarkComparison(
      session.user.id,
      benchmark,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // ==========================================
  // ALLOCATION
  // ==========================================

  @Get('allocation/type')
  @ApiOperation({ summary: 'Get portfolio allocation by asset type' })
  @ApiResponse({ status: 200, description: 'Asset allocation breakdown by type (stocks, ETFs, etc.)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getAllocationByType(@Session() session: UserSession) {
    return this.portfolioService.getAllocationByType(session.user.id);
  }

  @Get('allocation/sector')
  @ApiOperation({ summary: 'Get portfolio allocation by sector' })
  @ApiResponse({ status: 200, description: 'Asset allocation breakdown by sector', type: SectorAllocationDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getAllocationBySector(@Session() session: UserSession) {
    return this.portfolioService.getAllocationBySector(session.user.id);
  }

  @Get('allocation/currency')
  @ApiOperation({ summary: 'Get portfolio allocation by currency' })
  @ApiQuery({ name: 'baseCurrency', required: false, description: 'Base currency for display (default: USD)' })
  @ApiResponse({ status: 200, description: 'Asset allocation breakdown by currency' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getAllocationByCurrency(
    @Session() session: UserSession,
    @Query('baseCurrency') baseCurrency?: string,
  ) {
    return this.currencyService.getCurrencyAllocation(session.user.id, baseCurrency || 'USD');
  }

  // ==========================================
  // PORTFOLIO HISTORY & SNAPSHOTS
  // ==========================================

  @Get('history')
  @ApiOperation({ summary: 'Get portfolio value history over time' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO format)' })
  @ApiQuery({ name: 'interval', required: false, enum: HistoryInterval, description: 'Data interval' })
  @ApiResponse({ status: 200, description: 'Portfolio history with snapshots', type: PortfolioHistoryDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getHistory(
    @Session() session: UserSession,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('interval') interval?: HistoryInterval,
  ) {
    return this.snapshotService.getPortfolioHistory(
      session.user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      interval,
    );
  }

  @Get('snapshot/latest')
  @ApiOperation({ summary: 'Get latest portfolio snapshot (creates one if needed)' })
  @ApiResponse({ status: 200, description: 'Latest portfolio snapshot', type: PortfolioSnapshotDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getLatestSnapshot(@Session() session: UserSession) {
    return this.snapshotService.getOrCreateLatestSnapshot(session.user.id);
  }

  @Get('snapshot/:date')
  @ApiOperation({ summary: 'Get portfolio snapshot for a specific date' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format' })
  @ApiResponse({ status: 200, description: 'Detailed portfolio snapshot', type: DetailedSnapshotDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Snapshot not found' })
  getSnapshotByDate(
    @Session() session: UserSession,
    @Param('date') date: string,
  ) {
    return this.snapshotService.getDetailedSnapshot(session.user.id, new Date(date));
  }

  @Post('snapshot')
  @ApiOperation({ summary: 'Create a portfolio snapshot for today' })
  @ApiResponse({ status: 201, description: 'Snapshot created', type: PortfolioSnapshotDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createSnapshot(@Session() session: UserSession) {
    return this.snapshotService.createDailySnapshot(session.user.id);
  }

  @Post('snapshot/backfill')
  @ApiOperation({ summary: 'Backfill historical snapshots from transactions' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO format)' })
  @ApiResponse({ status: 200, description: 'Number of snapshots created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  backfillSnapshots(
    @Session() session: UserSession,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.snapshotService.backfillSnapshots(
      session.user.id,
      new Date(startDate),
      endDate ? new Date(endDate) : undefined,
    );
  }

  // ==========================================
  // DIVIDENDS
  // ==========================================

  @Get('dividends/summary')
  @ApiOperation({ summary: 'Get dividend summary for portfolio' })
  @ApiResponse({ status: 200, description: 'Dividend summary', type: DividendSummaryDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getDividendSummary(@Session() session: UserSession) {
    return this.dividendService.getDividendSummary(session.user.id);
  }

  @Get('dividends/history')
  @ApiOperation({ summary: 'Get dividend payment history' })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by year' })
  @ApiResponse({ status: 200, description: 'Dividend history', type: DividendHistoryDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getDividendHistory(
    @Session() session: UserSession,
    @Query('year') year?: string,
  ) {
    return this.dividendService.getDividendHistory(
      session.user.id,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('dividends/breakdown')
  @ApiOperation({ summary: 'Get dividend breakdown by month, holding, and sector' })
  @ApiQuery({ name: 'year', required: false, description: 'Year for breakdown (default: current year)' })
  @ApiResponse({ status: 200, description: 'Dividend breakdown', type: DividendBreakdownDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getDividendBreakdown(
    @Session() session: UserSession,
    @Query('year') year?: string,
  ) {
    return this.dividendService.getDividendBreakdown(
      session.user.id,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('dividends/calendar')
  @ApiOperation({ summary: 'Get upcoming dividend calendar' })
  @ApiQuery({ name: 'daysAhead', required: false, description: 'Days ahead to look (default: 30)' })
  @ApiResponse({ status: 200, description: 'Upcoming dividends', type: DividendCalendarDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getDividendCalendar(
    @Session() session: UserSession,
    @Query('daysAhead') daysAhead?: string,
  ) {
    return this.dividendService.getDividendCalendar(
      session.user.id,
      daysAhead ? parseInt(daysAhead, 10) : 30,
    );
  }

  @Get('dividends/projection')
  @ApiOperation({ summary: 'Get projected dividend income' })
  @ApiResponse({ status: 200, description: 'Dividend projections', type: DividendProjectionDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getDividendProjection(@Session() session: UserSession) {
    return this.dividendService.getDividendProjection(session.user.id);
  }

  // ==========================================
  // TAX LOTS
  // ==========================================

  @Get('tax-lots')
  @ApiOperation({ summary: 'Get all tax lots for the portfolio' })
  @ApiResponse({ status: 200, description: 'Tax lots by asset', type: [AssetTaxLotsDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getTaxLots(@Session() session: UserSession) {
    return this.taxLotService.getAllTaxLots(session.user.id);
  }

  @Get('tax-lots/:assetId')
  @ApiOperation({ summary: 'Get tax lots for a specific asset' })
  @ApiParam({ name: 'assetId', description: 'Asset ID' })
  @ApiResponse({ status: 200, description: 'Tax lots for asset', type: AssetTaxLotsDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  getTaxLotsForAsset(
    @Session() session: UserSession,
    @Param('assetId', ParseIntPipe) assetId: number,
  ) {
    return this.taxLotService.getTaxLotsForAsset(session.user.id, assetId);
  }

  @Get('realized-gains')
  @ApiOperation({ summary: 'Get realized gains/losses for tax reporting' })
  @ApiQuery({ name: 'year', required: false, description: 'Tax year (default: current year)' })
  @ApiQuery({ name: 'type', required: false, enum: GainType, description: 'Filter by gain type' })
  @ApiResponse({ status: 200, description: 'Realized gains summary', type: RealizedGainsSummaryDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getRealizedGains(
    @Session() session: UserSession,
    @Query('year') year?: string,
    @Query('type') type?: GainType,
  ) {
    return this.taxLotService.getRealizedGains(
      session.user.id,
      year ? parseInt(year, 10) : undefined,
      type,
    );
  }

  @Get('tax-loss-harvest')
  @ApiOperation({ summary: 'Get tax-loss harvesting opportunities' })
  @ApiResponse({ status: 200, description: 'Tax-loss harvesting opportunities', type: TaxLossHarvestingSummaryDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getTaxLossHarvestingOpportunities(@Session() session: UserSession) {
    return this.taxLotService.getTaxLossHarvestingOpportunities(session.user.id);
  }

  // ==========================================
  // CURRENCY
  // ==========================================

  @Get('currencies/rates')
  @ApiOperation({ summary: 'Get exchange rates for major currencies' })
  @ApiQuery({ name: 'base', required: false, description: 'Base currency (default: USD)' })
  @ApiResponse({ status: 200, description: 'Exchange rates', type: MultiCurrencyRatesDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getCurrencyRates(@Query('base') base?: string) {
    return this.currencyService.getMultiCurrencyRates(base || 'USD');
  }

  @Get('currencies/rate')
  @ApiOperation({ summary: 'Get exchange rate between two currencies' })
  @ApiQuery({ name: 'from', required: true, description: 'Source currency' })
  @ApiQuery({ name: 'to', required: true, description: 'Target currency' })
  @ApiResponse({ status: 200, description: 'Exchange rate', type: ExchangeRateDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getExchangeRate(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.currencyService.getExchangeRate(from, to);
  }

  @Get('currencies/convert')
  @ApiOperation({ summary: 'Convert an amount between currencies' })
  @ApiQuery({ name: 'from', required: true, description: 'Source currency' })
  @ApiQuery({ name: 'to', required: true, description: 'Target currency' })
  @ApiQuery({ name: 'amount', required: true, description: 'Amount to convert' })
  @ApiResponse({ status: 200, description: 'Conversion result', type: CurrencyConversionDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  convertCurrency(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('amount') amount: string,
  ) {
    return this.currencyService.convert(from, to, parseFloat(amount));
  }

  @Get('multi-currency')
  @ApiOperation({ summary: 'Get portfolio breakdown by currency' })
  @ApiQuery({ name: 'displayCurrency', required: false, description: 'Display currency (default: USD)' })
  @ApiResponse({ status: 200, description: 'Multi-currency portfolio breakdown', type: PortfolioMultiCurrencyDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMultiCurrencyPortfolio(
    @Session() session: UserSession,
    @Query('displayCurrency') displayCurrency?: string,
  ) {
    return this.currencyService.getMultiCurrencyPortfolio(session.user.id, displayCurrency);
  }

  @Get('fx-gains')
  @ApiOperation({ summary: 'Get FX gain/loss details for holdings' })
  @ApiQuery({ name: 'baseCurrency', required: false, description: 'Base currency (default: USD)' })
  @ApiResponse({ status: 200, description: 'FX gain/loss details', type: [FxGainLossDetailDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getFxGainLoss(
    @Session() session: UserSession,
    @Query('baseCurrency') baseCurrency?: string,
  ) {
    return this.currencyService.getFxGainLossDetails(session.user.id, baseCurrency);
  }
}
