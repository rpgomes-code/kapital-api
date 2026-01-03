// src/watchlists/dto/update-watchlist.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateWatchlistDto } from './create-watchlist.dto';

export class UpdateWatchlistDto extends PartialType(
  OmitType(CreateWatchlistDto, ['assetIds'] as const),
) {}
