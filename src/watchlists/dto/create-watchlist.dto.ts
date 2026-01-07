import {
  IsString,
  IsOptional,
  MaxLength,
  IsArray,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWatchlistDto {
  @ApiProperty({ example: 'Tech Stocks', description: 'Watchlist name', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: [1, 2, 3], description: 'Initial asset IDs to add', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  assetIds?: number[];

  // userId is set internally from session, not from request body
  userId?: string;
}

export class AddAssetToWatchlistDto {
  @ApiProperty({ example: 1, description: 'Asset ID to add to watchlist' })
  @IsInt()
  assetId: number;
}
