// src/portfolio/dto/performance-metrics.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsString, IsEnum } from 'class-validator';

export class PerformanceQueryDto {
  @ApiPropertyOptional({ example: '2024-01-01', description: 'Start date (ISO format)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'End date (ISO format)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'SPY', description: 'Benchmark symbol for comparison' })
  @IsOptional()
  @IsString()
  benchmark?: string;
}

export class PerformanceMetricsDto {
  @ApiProperty({ example: 12500.00, description: 'Total return in dollars (realized + unrealized + dividends)' })
  totalReturn: number;

  @ApiProperty({ example: 25.00, description: 'Total return percentage' })
  totalReturnPercent: number;

  @ApiProperty({ example: 18.50, description: 'Annualized return percentage (CAGR)' })
  annualizedReturn: number;

  @ApiProperty({ example: 2500.00, description: 'Realized gains from sales' })
  realizedGains: number;

  @ApiProperty({ example: 8500.00, description: 'Unrealized gains (paper profits)' })
  unrealizedGains: number;

  @ApiProperty({ example: 1500.00, description: 'Total dividend income' })
  dividendIncome: number;

  @ApiProperty({ example: 12150.00, description: 'Net gain after fees and taxes' })
  netGain: number;
}

export class EnhancedPerformanceMetricsDto extends PerformanceMetricsDto {
  @ApiProperty({ example: 15.25, description: 'Time-weighted return percentage (TWR)' })
  timeWeightedReturn: number;

  @ApiProperty({ example: 16.50, description: 'Money-weighted return percentage (IRR)' })
  moneyWeightedReturn: number;

  @ApiProperty({ example: 1.25, description: 'Sharpe ratio (risk-adjusted return)' })
  sharpeRatio: number;

  @ApiProperty({ example: 1.45, description: 'Sortino ratio (downside risk-adjusted)' })
  sortinoRatio: number;

  @ApiProperty({ example: 1.05, description: 'Beta vs benchmark' })
  beta: number;

  @ApiProperty({ example: 2.50, description: 'Alpha (excess return vs benchmark)' })
  alpha: number;

  @ApiProperty({ example: -15.25, description: 'Maximum drawdown percentage' })
  maxDrawdown: number;

  @ApiProperty({ example: 18.50, description: 'Volatility (annualized standard deviation)' })
  volatility: number;

  @ApiPropertyOptional({ example: -2500.00, description: 'Value at Risk (95% confidence)' })
  valueAtRisk?: number;

  @ApiPropertyOptional({ example: 0.85, description: 'Treynor ratio' })
  treynorRatio?: number;

  @ApiPropertyOptional({ example: 0.45, description: 'Information ratio' })
  informationRatio?: number;

  @ApiPropertyOptional({ example: 3.25, description: 'Dividend yield on cost percentage' })
  dividendYieldOnCost?: number;
}

export class BenchmarkComparisonDto {
  @ApiProperty({ example: 'SPY', description: 'Benchmark symbol' })
  benchmarkSymbol: string;

  @ApiProperty({ example: 'S&P 500 ETF', description: 'Benchmark name' })
  benchmarkName: string;

  @ApiProperty({ example: 18.50, description: 'Portfolio return percentage' })
  portfolioReturn: number;

  @ApiProperty({ example: 15.25, description: 'Benchmark return percentage' })
  benchmarkReturn: number;

  @ApiProperty({ example: 3.25, description: 'Excess return (alpha)' })
  excessReturn: number;

  @ApiProperty({ example: 2.50, description: 'Tracking error' })
  trackingError: number;

  @ApiProperty({ example: 1.05, description: 'Beta vs benchmark' })
  beta: number;

  @ApiProperty({ example: 0.92, description: 'Correlation with benchmark' })
  correlation: number;
}
