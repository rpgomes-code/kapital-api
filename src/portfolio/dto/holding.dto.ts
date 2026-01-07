// src/portfolio/dto/holding.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssetInfoDto {
  @ApiProperty({ example: 1, description: 'Internal asset ID' })
  id: number;

  @ApiProperty({ example: 'uuid-string', description: 'Public asset ID' })
  publicId: string;

  @ApiProperty({ example: 'AAPL', description: 'Asset symbol' })
  symbol: string;

  @ApiProperty({ example: 'AAPL', description: 'Yahoo Finance symbol' })
  yahooSymbol: string;

  @ApiProperty({ example: 'Apple Inc.', description: 'Asset name' })
  name: string;

  @ApiProperty({ example: 'STOCK', description: 'Asset type', enum: ['STOCK', 'ETF', 'CRYPTO', 'FUND'] })
  assetType: string;

  @ApiProperty({ example: 'USD', description: 'Asset currency' })
  currency: string;
}

export class HoldingDto {
  @ApiProperty({ example: 1, description: 'Asset ID' })
  assetId: number;

  @ApiProperty({ type: AssetInfoDto, description: 'Asset details' })
  asset: AssetInfoDto;

  @ApiProperty({ example: 100, description: 'Number of shares/units held' })
  quantity: number;

  @ApiProperty({ example: 150.25, description: 'Average cost per share' })
  avgCostBasis: number;

  @ApiProperty({ example: 15025.00, description: 'Total cost basis' })
  totalCostBasis: number;

  @ApiPropertyOptional({ example: 175.50, description: 'Current market price' })
  currentPrice?: number;

  @ApiPropertyOptional({ example: 17550.00, description: 'Current market value' })
  currentValue?: number;

  @ApiPropertyOptional({ example: 2525.00, description: 'Unrealized gain/loss in dollars' })
  unrealizedGain?: number;

  @ApiPropertyOptional({ example: 16.81, description: 'Unrealized gain/loss percentage' })
  unrealizedGainPercent?: number;

  @ApiPropertyOptional({ example: 125.00, description: 'Day change in dollars' })
  dayChange?: number;

  @ApiPropertyOptional({ example: 0.72, description: 'Day change percentage' })
  dayChangePercent?: number;

  @ApiPropertyOptional({ example: 35.5, description: 'Allocation percentage in portfolio' })
  allocation?: number;
}
