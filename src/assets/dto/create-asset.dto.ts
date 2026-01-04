// src/assets/dto/create-asset.dto.ts
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetType } from '../../generated/prisma/client';

export class CreateAssetDto {
  @ApiProperty({ example: 'AAPL', description: 'Asset symbol', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  symbol: string;

  @ApiProperty({ example: 'AAPL', description: 'Yahoo Finance symbol', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  yahooSymbol: string;

  @ApiPropertyOptional({ example: 'US0378331005', description: 'ISIN code', maxLength: 12 })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  isin?: string;

  @ApiPropertyOptional({ example: '037833100', description: 'CUSIP code', maxLength: 9 })
  @IsOptional()
  @IsString()
  @MaxLength(9)
  cusip?: string;

  @ApiProperty({ example: 'Apple Inc.', description: 'Asset name', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: AssetType, example: 'STOCK', description: 'Type of asset' })
  @IsEnum(AssetType)
  assetType: AssetType;

  @ApiPropertyOptional({ example: 'NASDAQ', description: 'Exchange name', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  exchange?: string;

  @ApiProperty({ example: 'USD', description: 'Currency code', maxLength: 3 })
  @IsString()
  @MaxLength(3)
  currency: string;

  @ApiPropertyOptional({ example: 1, description: 'Sector ID' })
  @IsOptional()
  sectorId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Industry ID' })
  @IsOptional()
  industryId?: number;
}
