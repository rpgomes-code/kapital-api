import { Controller, Get, Query } from '@nestjs/common';
import { StonksService } from './stonks.service';

@Controller('stonks')
export class StonksController {
  constructor(private readonly stonksService: StonksService) {}

  @Get('search')
  async search(@Query('q') query: string) {
    return this.stonksService.searchSymbol(query);
  }

  @Get('quote')
  async quote(@Query('symbol') symbol: string) {
    return this.stonksService.getQuote(symbol);
  }
}
