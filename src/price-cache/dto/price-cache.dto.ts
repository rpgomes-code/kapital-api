import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PriceRangeQueryDto {
  @ApiProperty({
    description: 'Start date for price range',
    example: '2024-01-01',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description: 'End date for price range (defaults to today)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CachedPriceDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'AAPL' })
  symbol: string;

  @ApiProperty({ example: '2024-01-15' })
  date: Date;

  @ApiProperty({ example: 150.25 })
  open: number;

  @ApiProperty({ example: 152.5 })
  high: number;

  @ApiProperty({ example: 149.75 })
  low: number;

  @ApiProperty({ example: 151.8 })
  close: number;

  @ApiProperty({ example: 151.8 })
  adjClose: number;

  @ApiProperty({ example: 45000000 })
  volume: string;

  @ApiProperty({ example: '2024-01-15T22:00:00.000Z' })
  createdAt: Date;
}

export class CacheStatsDto {
  @ApiProperty({ example: 150000 })
  totalRecords: number;

  @ApiProperty({ example: 250 })
  symbolCount: number;

  @ApiPropertyOptional({ example: '2020-01-02' })
  oldestDate?: Date;

  @ApiPropertyOptional({ example: '2024-01-15' })
  newestDate?: Date;
}

export class BulkUpdateResultDto {
  @ApiProperty({
    example: { AAPL: 10, MSFT: 10, GOOGL: -1 },
    description: 'Map of symbols to number of records updated (-1 = failed)',
  })
  results: Record<string, number>;

  @ApiProperty({ example: 2 })
  successful: number;

  @ApiProperty({ example: 1 })
  failed: number;
}

export class RefreshCacheDto {
  @ApiPropertyOptional({
    description: 'Start date for refresh (defaults to last cached date)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class BulkRefreshDto {
  @ApiProperty({
    description: 'Array of symbols to refresh',
    example: ['AAPL', 'MSFT', 'GOOGL'],
    type: [String],
  })
  @IsString({ each: true })
  symbols: string[];
}
