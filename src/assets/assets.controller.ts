// src/assets/assets.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { SearchAssetDto } from './dto/search-asset.dto';

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new asset' })
  @ApiResponse({ status: 201, description: 'Asset created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Asset with symbol already exists' })
  create(@Body() createAssetDto: CreateAssetDto) {
    return this.assetsService.create(createAssetDto);
  }

  @Get()
  @ApiOperation({ summary: 'Search and list assets' })
  @ApiQuery({ name: 'query', required: false, description: 'Search by symbol, name, or ISIN' })
  @ApiQuery({ name: 'assetType', required: false, description: 'Filter by asset type' })
  @ApiQuery({ name: 'exchange', required: false, description: 'Filter by exchange' })
  @ApiQuery({ name: 'currency', required: false, description: 'Filter by currency' })
  @ApiResponse({ status: 200, description: 'List of assets matching criteria' })
  findAll(@Query() searchDto: SearchAssetDto) {
    return this.assetsService.findAll(searchDto);
  }

  @Get('symbol/:symbol')
  @ApiOperation({ summary: 'Get asset by symbol' })
  @ApiParam({ name: 'symbol', description: 'Asset symbol (e.g., AAPL, MSFT)' })
  @ApiResponse({ status: 200, description: 'Asset found' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findBySymbol(@Param('symbol') symbol: string) {
    return this.assetsService.findBySymbol(symbol);
  }

  @Get('symbol/:symbol/find-or-create')
  @ApiOperation({ summary: 'Find or create asset by symbol from Yahoo Finance' })
  @ApiParam({ name: 'symbol', description: 'Yahoo Finance symbol' })
  @ApiResponse({ status: 200, description: 'Asset found or created' })
  @ApiResponse({ status: 404, description: 'Symbol not found on Yahoo Finance' })
  findOrCreate(@Param('symbol') symbol: string) {
    return this.assetsService.findOrCreateBySymbol(symbol);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset by ID' })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiResponse({ status: 200, description: 'Asset found' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.assetsService.findOne(id);
  }

  @Get(':id/price')
  @ApiOperation({ summary: 'Get asset with current market price' })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiResponse({ status: 200, description: 'Asset with current price data' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  getWithPrice(@Param('id', ParseIntPipe) id: number) {
    return this.assetsService.getAssetWithCurrentPrice(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update asset' })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiResponse({ status: 200, description: 'Asset updated successfully' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAssetDto: UpdateAssetDto,
  ) {
    return this.assetsService.update(id, updateAssetDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete asset' })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiResponse({ status: 200, description: 'Asset deleted successfully' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete asset with transactions' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.assetsService.remove(id);
  }
}
