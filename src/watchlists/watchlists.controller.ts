import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { WatchlistsService } from './watchlists.service';
import {
  CreateWatchlistDto,
  AddAssetToWatchlistDto,
} from './dto/create-watchlist.dto';

@Controller('watchlists')
export class WatchlistsController {
  constructor(private readonly watchlistsService: WatchlistsService) {}

  @Post()
  create(@Body() dto: CreateWatchlistDto) {
    return this.watchlistsService.create(dto);
  }

  @Get('user/:userId')
  findByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.watchlistsService.findByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.watchlistsService.findOne(id);
  }

  @Post(':id/assets')
  addAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddAssetToWatchlistDto,
  ) {
    return this.watchlistsService.addAsset(id, dto);
  }

  @Delete(':id/assets/:assetId')
  removeAsset(
    @Param('id', ParseIntPipe) id: number,
    @Param('assetId', ParseIntPipe) assetId: number,
  ) {
    return this.watchlistsService.removeAsset(id, assetId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.watchlistsService.remove(id);
  }
}
