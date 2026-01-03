// src/assets/dto/search-asset.dto.ts
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { AssetType } from 'generated/prisma/client';

export class SearchAssetDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum(AssetType)
  assetType?: AssetType;

  @IsOptional()
  @IsString()
  exchange?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
