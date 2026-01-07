// src/portfolio/dto/portfolio-history.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsString, IsEnum } from 'class-validator';

export enum HistoryInterval {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class PortfolioHistoryQueryDto {
  @ApiPropertyOptional({ example: '2024-01-01', description: 'Start date (ISO format)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'End date (ISO format)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: HistoryInterval, example: 'daily', description: 'Data interval' })
  @IsOptional()
  @IsEnum(HistoryInterval)
  interval?: HistoryInterval;
}

export class PortfolioSnapshotDto {
  @ApiProperty({ example: '2024-01-15', description: 'Snapshot date' })
  date: string;

  @ApiProperty({ example: 50000.00, description: 'Total portfolio value' })
  totalValue: number;

  @ApiProperty({ example: 40000.00, description: 'Total cost basis' })
  totalCost: number;

  @ApiProperty({ example: 500.00, description: 'Day change in dollars' })
  dayChange: number;

  @ApiProperty({ example: 1.01, description: 'Day change percentage' })
  dayChangePercent: number;

  @ApiProperty({ example: 10000.00, description: 'Unrealized gain/loss' })
  unrealizedGain: number;

  @ApiProperty({ example: 25.00, description: 'Unrealized gain/loss percentage' })
  unrealizedGainPercent: number;

  @ApiPropertyOptional({ example: 0.00, description: 'Cash balance' })
  cashBalance?: number;
}

export class PortfolioHistoryDto {
  @ApiProperty({ type: [PortfolioSnapshotDto], description: 'Historical portfolio snapshots' })
  snapshots: PortfolioSnapshotDto[];

  @ApiProperty({ example: '2024-01-01', description: 'Period start date' })
  periodStart: string;

  @ApiProperty({ example: '2024-12-31', description: 'Period end date' })
  periodEnd: string;

  @ApiProperty({ example: 45000.00, description: 'Value at period start' })
  startValue: number;

  @ApiProperty({ example: 50000.00, description: 'Value at period end' })
  endValue: number;

  @ApiProperty({ example: 5000.00, description: 'Total change in value' })
  totalChange: number;

  @ApiProperty({ example: 11.11, description: 'Total change percentage' })
  totalChangePercent: number;

  @ApiProperty({ example: 52000.00, description: 'Highest value during period' })
  highValue: number;

  @ApiProperty({ example: 43000.00, description: 'Lowest value during period' })
  lowValue: number;
}

export class HoldingSnapshotDto {
  @ApiProperty({ example: 1, description: 'Asset ID' })
  assetId: number;

  @ApiProperty({ example: 'AAPL', description: 'Asset symbol' })
  symbol: string;

  @ApiProperty({ example: 100, description: 'Quantity held' })
  quantity: number;

  @ApiProperty({ example: 175.50, description: 'Price at snapshot' })
  price: number;

  @ApiProperty({ example: 17550.00, description: 'Value at snapshot' })
  value: number;

  @ApiProperty({ example: 15000.00, description: 'Cost basis' })
  costBasis: number;

  @ApiProperty({ example: 2550.00, description: 'Unrealized gain at snapshot' })
  unrealizedGain: number;

  @ApiProperty({ example: 35.5, description: 'Allocation percentage at snapshot' })
  allocation: number;
}

export class DetailedSnapshotDto extends PortfolioSnapshotDto {
  @ApiProperty({ type: [HoldingSnapshotDto], description: 'Holdings at this snapshot' })
  holdings: HoldingSnapshotDto[];
}
