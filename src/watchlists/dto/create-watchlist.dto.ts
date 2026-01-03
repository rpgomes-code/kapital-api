import {
  IsString,
  IsOptional,
  MaxLength,
  IsArray,
  IsInt,
} from 'class-validator';

export class CreateWatchlistDto {
  @IsInt()
  userId: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  assetIds?: number[];
}

export class AddAssetToWatchlistDto {
  @IsInt()
  assetId: number;
}
