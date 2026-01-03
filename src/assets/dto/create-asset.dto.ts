// src/assets/dto/create-asset.dto.ts
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { AssetType } from 'generated/prisma/client';

export class CreateAssetDto {
  @IsString()
  @MaxLength(20)
  symbol: string;

  @IsString()
  @MaxLength(20)
  yahooSymbol: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  isin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  cusip?: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsEnum(AssetType)
  assetType: AssetType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  exchange?: string;

  @IsString()
  @MaxLength(3)
  currency: string;

  @IsOptional()
  sectorId?: number;

  @IsOptional()
  industryId?: number;
}
