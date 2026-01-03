import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get('search')
  search(@Query('q') query: string) {
    return this.assetsService.search(query);
  }

  @Post('from-yahoo')
  createFromYahoo(@Body('symbol') symbol: string) {
    return this.assetsService.createFromYahoo(symbol);
  }

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.assetsService.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.assetsService.findOne(id);
  }

  @Get(':id/quote')
  getQuote(@Param('id', ParseIntPipe) id: number) {
    return this.assetsService.getQuote(id);
  }

  @Post(':id/sync-prices')
  syncPrices(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { from: string; to: string },
  ) {
    return this.assetsService.syncPrices(id, body.from, body.to);
  }
}
