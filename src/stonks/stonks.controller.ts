import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { StonksService } from './stonks.service';

@ApiTags('stonks')
@Controller('stonks')
@AllowAnonymous() // All stonks endpoints are public (market data)
export class StonksController {
  constructor(private readonly stonksService: StonksService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search for stocks by symbol or name' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiResponse({ status: 200, description: 'List of matching stocks' })
  async search(@Query('q') query: string) {
    return this.stonksService.searchSymbol(query);
  }

  @Get('quote')
  @ApiOperation({ summary: 'Get stock quote by symbol' })
  @ApiQuery({ name: 'symbol', description: 'Stock symbol (e.g., AAPL)' })
  @ApiResponse({ status: 200, description: 'Stock quote data' })
  async quote(@Query('symbol') symbol: string) {
    return this.stonksService.getQuote(symbol);
  }
}
