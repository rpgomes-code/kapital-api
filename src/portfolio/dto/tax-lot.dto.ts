// src/portfolio/dto/tax-lot.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export enum CostBasisMethod {
  FIFO = 'FIFO',
  LIFO = 'LIFO',
  HIFO = 'HIFO', // Highest In, First Out
  AVERAGE = 'AVERAGE',
  SPECIFIC = 'SPECIFIC',
}

export enum GainType {
  SHORT_TERM = 'short-term',
  LONG_TERM = 'long-term',
  ALL = 'all',
}

export class TaxLotQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Filter by asset ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assetId?: number;
}

export class RealizedGainsQueryDto {
  @ApiPropertyOptional({ example: 2024, description: 'Tax year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ enum: GainType, example: 'all', description: 'Type of gains to include' })
  @IsOptional()
  @IsEnum(GainType)
  type?: GainType;
}

export class TaxLotDto {
  @ApiProperty({ example: 1, description: 'Lot ID' })
  id: number;

  @ApiProperty({ example: 1, description: 'Asset ID' })
  assetId: number;

  @ApiProperty({ example: 'AAPL', description: 'Asset symbol' })
  symbol: string;

  @ApiProperty({ example: '2023-06-15', description: 'Acquisition date' })
  acquisitionDate: string;

  @ApiProperty({ example: 50, description: 'Number of shares in this lot' })
  quantity: number;

  @ApiProperty({ example: 150.00, description: 'Cost per share' })
  costPerShare: number;

  @ApiProperty({ example: 7500.00, description: 'Total cost basis for this lot' })
  totalCostBasis: number;

  @ApiProperty({ example: 175.50, description: 'Current price per share' })
  currentPrice: number;

  @ApiProperty({ example: 8775.00, description: 'Current market value' })
  currentValue: number;

  @ApiProperty({ example: 1275.00, description: 'Unrealized gain/loss' })
  unrealizedGain: number;

  @ApiProperty({ example: 17.00, description: 'Unrealized gain/loss percentage' })
  unrealizedGainPercent: number;

  @ApiProperty({ example: 'long-term', description: 'Tax classification', enum: ['short-term', 'long-term'] })
  holdingPeriod: string;

  @ApiProperty({ example: 570, description: 'Days held' })
  daysHeld: number;
}

export class AssetTaxLotsDto {
  @ApiProperty({ example: 1, description: 'Asset ID' })
  assetId: number;

  @ApiProperty({ example: 'AAPL', description: 'Asset symbol' })
  symbol: string;

  @ApiProperty({ example: 'Apple Inc.', description: 'Asset name' })
  name: string;

  @ApiProperty({ example: 100, description: 'Total shares held' })
  totalQuantity: number;

  @ApiProperty({ example: 15000.00, description: 'Total cost basis' })
  totalCostBasis: number;

  @ApiProperty({ example: 17550.00, description: 'Total current value' })
  totalCurrentValue: number;

  @ApiProperty({ example: 2550.00, description: 'Total unrealized gain' })
  totalUnrealizedGain: number;

  @ApiProperty({ type: [TaxLotDto], description: 'Individual tax lots' })
  lots: TaxLotDto[];
}

export class RealizedGainDto {
  @ApiProperty({ example: 1, description: 'Transaction ID' })
  transactionId: number;

  @ApiProperty({ example: 'AAPL', description: 'Asset symbol' })
  symbol: string;

  @ApiProperty({ example: '2024-03-15', description: 'Sale date' })
  saleDate: string;

  @ApiProperty({ example: '2023-06-15', description: 'Acquisition date' })
  acquisitionDate: string;

  @ApiProperty({ example: 25, description: 'Quantity sold' })
  quantity: number;

  @ApiProperty({ example: 150.00, description: 'Cost per share' })
  costPerShare: number;

  @ApiProperty({ example: 3750.00, description: 'Total cost basis' })
  costBasis: number;

  @ApiProperty({ example: 175.50, description: 'Sale price per share' })
  salePrice: number;

  @ApiProperty({ example: 4387.50, description: 'Total sale proceeds' })
  proceeds: number;

  @ApiProperty({ example: 637.50, description: 'Realized gain/loss' })
  realizedGain: number;

  @ApiProperty({ example: 17.00, description: 'Realized gain/loss percentage' })
  realizedGainPercent: number;

  @ApiProperty({ example: 'long-term', description: 'Tax classification', enum: ['short-term', 'long-term'] })
  holdingPeriod: string;

  @ApiProperty({ example: 274, description: 'Days held' })
  daysHeld: number;
}

export class RealizedGainsSummaryDto {
  @ApiProperty({ example: 2024, description: 'Tax year' })
  year: number;

  @ApiProperty({ example: 5000.00, description: 'Total realized gains' })
  totalGains: number;

  @ApiProperty({ example: -1500.00, description: 'Total realized losses' })
  totalLosses: number;

  @ApiProperty({ example: 3500.00, description: 'Net realized gain/loss' })
  netGain: number;

  @ApiProperty({ example: 2000.00, description: 'Short-term gains' })
  shortTermGains: number;

  @ApiProperty({ example: -500.00, description: 'Short-term losses' })
  shortTermLosses: number;

  @ApiProperty({ example: 3000.00, description: 'Long-term gains' })
  longTermGains: number;

  @ApiProperty({ example: -1000.00, description: 'Long-term losses' })
  longTermLosses: number;

  @ApiProperty({ type: [RealizedGainDto], description: 'Individual realized gain transactions' })
  transactions: RealizedGainDto[];
}

export class TaxLossHarvestingOpportunityDto {
  @ApiProperty({ example: 1, description: 'Asset ID' })
  assetId: number;

  @ApiProperty({ example: 'XYZ', description: 'Asset symbol' })
  symbol: string;

  @ApiProperty({ example: 'XYZ Corp', description: 'Asset name' })
  name: string;

  @ApiProperty({ example: -1500.00, description: 'Unrealized loss amount' })
  unrealizedLoss: number;

  @ApiProperty({ example: -15.00, description: 'Unrealized loss percentage' })
  unrealizedLossPercent: number;

  @ApiProperty({ example: 8500.00, description: 'Current market value' })
  currentValue: number;

  @ApiProperty({ example: 10000.00, description: 'Cost basis' })
  costBasis: number;

  @ApiProperty({ example: 50, description: 'Number of shares' })
  quantity: number;

  @ApiProperty({
    example: ['VTI', 'ITOT'],
    description: 'Suggested replacement securities to avoid wash sale',
  })
  suggestedReplacements?: string[];
}

export class TaxLossHarvestingSummaryDto {
  @ApiProperty({ example: -5000.00, description: 'Total harvestable losses' })
  totalHarvestableLosses: number;

  @ApiProperty({ example: 3, description: 'Number of positions with losses' })
  positionsWithLosses: number;

  @ApiProperty({
    type: [TaxLossHarvestingOpportunityDto],
    description: 'Tax loss harvesting opportunities',
  })
  opportunities: TaxLossHarvestingOpportunityDto[];

  @ApiPropertyOptional({
    example: ['Wash sale warning: Sold similar position within 30 days'],
    description: 'Wash sale warnings',
  })
  washSaleWarnings?: string[];
}
