// src/portfolio/dto/dividend.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class DividendQueryDto {
  @ApiPropertyOptional({ example: 2024, description: 'Year to filter dividends' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ example: true, description: 'Include projected future dividends' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeProjected?: boolean;
}

export class DividendPaymentDto {
  @ApiProperty({ example: 1, description: 'Asset ID' })
  assetId: number;

  @ApiProperty({ example: 'AAPL', description: 'Asset symbol' })
  symbol: string;

  @ApiProperty({ example: 'Apple Inc.', description: 'Asset name' })
  name: string;

  @ApiProperty({ example: '2024-02-15', description: 'Payment date' })
  paymentDate: string;

  @ApiProperty({ example: '2024-02-01', description: 'Ex-dividend date' })
  exDividendDate?: string;

  @ApiProperty({ example: 100, description: 'Number of shares at payment' })
  quantity: number;

  @ApiProperty({ example: 0.24, description: 'Dividend per share' })
  dividendPerShare: number;

  @ApiProperty({ example: 24.00, description: 'Total dividend amount' })
  totalAmount: number;

  @ApiProperty({ example: 'USD', description: 'Currency' })
  currency: string;

  @ApiPropertyOptional({ example: false, description: 'Whether this is a projected dividend' })
  isProjected?: boolean;
}

export class DividendSummaryDto {
  @ApiProperty({ example: 1500.00, description: 'Total dividends received' })
  totalDividends: number;

  @ApiProperty({ example: 2.85, description: 'Current portfolio dividend yield percentage' })
  currentYield: number;

  @ApiProperty({ example: 3.25, description: 'Dividend yield on cost percentage' })
  yieldOnCost: number;

  @ApiProperty({ example: 1800.00, description: 'Projected annual dividend income' })
  projectedAnnualIncome: number;

  @ApiProperty({ example: 150.00, description: 'Average monthly dividend income' })
  averageMonthlyIncome: number;

  @ApiProperty({ example: 12, description: 'Number of dividend payments received' })
  paymentCount: number;

  @ApiProperty({ example: 8, description: 'Number of dividend-paying holdings' })
  dividendPayingHoldings: number;
}

export class DividendHistoryDto {
  @ApiProperty({ type: [DividendPaymentDto], description: 'List of dividend payments' })
  payments: DividendPaymentDto[];

  @ApiProperty({ type: DividendSummaryDto, description: 'Dividend summary' })
  summary: DividendSummaryDto;
}

export class MonthlyDividendDto {
  @ApiProperty({ example: '2024-01', description: 'Month (YYYY-MM format)' })
  month: string;

  @ApiProperty({ example: 125.00, description: 'Total dividends for the month' })
  amount: number;

  @ApiProperty({ example: 3, description: 'Number of payments in the month' })
  paymentCount: number;
}

export class DividendBreakdownDto {
  @ApiProperty({ type: [MonthlyDividendDto], description: 'Monthly dividend breakdown' })
  monthly: MonthlyDividendDto[];

  @ApiProperty({
    example: { AAPL: 300, MSFT: 250, JNJ: 200 },
    description: 'Dividends by holding',
  })
  byHolding: Record<string, number>;

  @ApiProperty({
    example: { Technology: 550, Healthcare: 200, Finance: 150 },
    description: 'Dividends by sector',
  })
  bySector: Record<string, number>;
}

export class DividendCalendarDto {
  @ApiProperty({ type: [DividendPaymentDto], description: 'Upcoming dividend payments' })
  upcoming: DividendPaymentDto[];

  @ApiProperty({ example: 150.00, description: 'Total expected from upcoming dividends' })
  totalExpected: number;

  @ApiProperty({ example: 30, description: 'Days ahead included in calendar' })
  daysAhead: number;
}

export class DividendProjectionDto {
  @ApiProperty({ example: 1800.00, description: 'Projected annual dividend income' })
  annualProjection: number;

  @ApiProperty({ example: 150.00, description: 'Projected monthly average' })
  monthlyAverage: number;

  @ApiProperty({
    example: [150, 125, 175, 150, 125, 175, 150, 125, 175, 150, 125, 175],
    description: 'Projected monthly amounts',
  })
  monthlyProjections: number[];

  @ApiProperty({
    example: { AAPL: 400, MSFT: 350, JNJ: 300 },
    description: 'Projected dividends by holding',
  })
  byHolding: Record<string, number>;

  @ApiPropertyOptional({ example: 15.5, description: 'Projected year-over-year dividend growth' })
  projectedGrowth?: number;
}
