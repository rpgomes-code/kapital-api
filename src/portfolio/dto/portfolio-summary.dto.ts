// src/portfolio/dto/portfolio-summary.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { HoldingDto } from './holding.dto';

export class PortfolioSummaryDto {
  @ApiProperty({ example: 50000.00, description: 'Total portfolio market value' })
  totalValue: number;

  @ApiProperty({ example: 40000.00, description: 'Total cost basis (amount invested)' })
  totalCostBasis: number;

  @ApiProperty({ example: 10000.00, description: 'Total unrealized gain/loss' })
  totalUnrealizedGain: number;

  @ApiProperty({ example: 25.00, description: 'Total unrealized gain/loss percentage' })
  totalUnrealizedGainPercent: number;

  @ApiProperty({ example: 500.00, description: 'Total day change in dollars' })
  totalDayChange: number;

  @ApiProperty({ example: 1.01, description: 'Total day change percentage' })
  totalDayChangePercent: number;

  @ApiProperty({ example: 1500.00, description: 'Total dividends received' })
  totalDividendsReceived: number;

  @ApiProperty({ example: 150.00, description: 'Total fees paid' })
  totalFeesPaid: number;

  @ApiProperty({ example: 200.00, description: 'Total taxes paid' })
  totalTaxesPaid: number;

  @ApiProperty({ type: [HoldingDto], description: 'List of holdings sorted by value' })
  holdings: HoldingDto[];

  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Last updated timestamp' })
  lastUpdated: Date;
}
