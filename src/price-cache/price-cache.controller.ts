import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PriceCacheService } from './price-cache.service';
import {
  PriceRangeQueryDto,
  CacheStatsDto,
  BulkUpdateResultDto,
  RefreshCacheDto,
  BulkRefreshDto,
} from './dto/price-cache.dto';

@ApiTags('price-cache')
@ApiBearerAuth('bearer-auth')
@Controller('price-cache')
export class PriceCacheController {
  constructor(private readonly priceCacheService: PriceCacheService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get cache statistics' })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics',
    type: CacheStatsDto,
  })
  async getCacheStats() {
    return this.priceCacheService.getCacheStats();
  }

  @Get('symbols')
  @ApiOperation({ summary: 'Get all cached symbols' })
  @ApiResponse({
    status: 200,
    description: 'List of cached symbols',
    type: [String],
  })
  async getCachedSymbols() {
    return this.priceCacheService.getCachedSymbols();
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Get cached historical prices for a symbol' })
  @ApiParam({ name: 'symbol', example: 'AAPL' })
  @ApiResponse({ status: 200, description: 'Historical price data' })
  async getSymbolPrices(
    @Param('symbol') symbol: string,
    @Query() query: PriceRangeQueryDto,
  ) {
    const startDate = new Date(query.startDate);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    const prices = await this.priceCacheService.getHistoricalPrices(
      symbol,
      startDate,
      endDate,
    );

    // Convert BigInt volume to string for JSON serialization
    return prices.map((p) => ({
      ...p,
      open: Number(p.open),
      high: Number(p.high),
      low: Number(p.low),
      close: Number(p.close),
      adjClose: Number(p.adjClose),
      volume: p.volume.toString(),
    }));
  }

  @Get(':symbol/info')
  @ApiOperation({ summary: 'Get cache info for a symbol' })
  @ApiParam({ name: 'symbol', example: 'AAPL' })
  @ApiResponse({ status: 200, description: 'Symbol cache information' })
  async getSymbolCacheInfo(@Param('symbol') symbol: string) {
    return this.priceCacheService.getSymbolCacheInfo(symbol);
  }

  @Post(':symbol/refresh')
  @ApiOperation({ summary: 'Refresh cache for a symbol' })
  @ApiParam({ name: 'symbol', example: 'AAPL' })
  @ApiResponse({
    status: 200,
    description: 'Number of records updated',
  })
  async refreshSymbolCache(
    @Param('symbol') symbol: string,
    @Body() body: RefreshCacheDto,
  ) {
    let count: number;

    if (body.startDate) {
      // If start date provided, fetch from that date
      const startDate = new Date(body.startDate);
      const endDate = new Date();
      const prices = await this.priceCacheService.getHistoricalPrices(
        symbol,
        startDate,
        endDate,
      );
      count = prices.length;
    } else {
      // Otherwise just update from last cached date
      count = await this.priceCacheService.updateCache(symbol);
    }

    return {
      symbol: symbol.toUpperCase(),
      recordsUpdated: count,
    };
  }

  @Post('bulk-refresh')
  @ApiOperation({ summary: 'Refresh cache for multiple symbols' })
  @ApiResponse({
    status: 200,
    description: 'Bulk update results',
    type: BulkUpdateResultDto,
  })
  async bulkRefreshCache(@Body() body: BulkRefreshDto) {
    const results = await this.priceCacheService.bulkUpdateCache(body.symbols);

    const resultsObj: Record<string, number> = {};
    let successful = 0;
    let failed = 0;

    results.forEach((count, symbol) => {
      resultsObj[symbol] = count;
      if (count >= 0) {
        successful++;
      } else {
        failed++;
      }
    });

    return {
      results: resultsObj,
      successful,
      failed,
    };
  }

  @Delete(':symbol')
  @ApiOperation({ summary: 'Clear cache for a symbol' })
  @ApiParam({ name: 'symbol', example: 'AAPL' })
  @ApiResponse({
    status: 200,
    description: 'Number of records deleted',
  })
  async clearSymbolCache(@Param('symbol') symbol: string) {
    const count = await this.priceCacheService.clearSymbolCache(symbol);
    return {
      symbol: symbol.toUpperCase(),
      recordsDeleted: count,
    };
  }
}
