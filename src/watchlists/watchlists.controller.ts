import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { WatchlistsService } from './watchlists.service';
import {
  CreateWatchlistDto,
  AddAssetToWatchlistDto,
} from './dto/create-watchlist.dto';

@ApiTags('watchlists')
@ApiBearerAuth('bearer-auth')
@Controller('watchlists')
export class WatchlistsController {
  constructor(private readonly watchlistsService: WatchlistsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new watchlist for the current user' })
  @ApiResponse({ status: 201, description: 'Watchlist created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Session() session: UserSession, @Body() dto: CreateWatchlistDto) {
    return this.watchlistsService.create({ ...dto, userId: session.user.id });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get all watchlists for the current user' })
  @ApiResponse({ status: 200, description: 'List of user watchlists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findMyWatchlists(@Session() session: UserSession) {
    return this.watchlistsService.findByUser(session.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get watchlist by ID' })
  @ApiParam({ name: 'id', description: 'Watchlist ID' })
  @ApiResponse({ status: 200, description: 'Watchlist found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Watchlist not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.watchlistsService.findOne(id);
  }

  @Post(':id/assets')
  @ApiOperation({ summary: 'Add asset to watchlist' })
  @ApiParam({ name: 'id', description: 'Watchlist ID' })
  @ApiResponse({ status: 201, description: 'Asset added to watchlist' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Watchlist not found' })
  @ApiResponse({ status: 409, description: 'Asset already in watchlist' })
  addAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddAssetToWatchlistDto,
  ) {
    return this.watchlistsService.addAsset(id, dto);
  }

  @Delete(':id/assets/:assetId')
  @ApiOperation({ summary: 'Remove asset from watchlist' })
  @ApiParam({ name: 'id', description: 'Watchlist ID' })
  @ApiParam({ name: 'assetId', description: 'Asset ID' })
  @ApiResponse({ status: 200, description: 'Asset removed from watchlist' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not in watchlist' })
  removeAsset(
    @Param('id', ParseIntPipe) id: number,
    @Param('assetId', ParseIntPipe) assetId: number,
  ) {
    return this.watchlistsService.removeAsset(id, assetId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete watchlist' })
  @ApiParam({ name: 'id', description: 'Watchlist ID' })
  @ApiResponse({ status: 200, description: 'Watchlist deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Watchlist not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.watchlistsService.remove(id);
  }
}
