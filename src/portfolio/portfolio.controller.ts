// src/portfolio/portfolio.controller.ts
import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';

@ApiTags('portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get portfolio summary with holdings and current values' })
  @ApiQuery({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Portfolio summary with holdings, values, and gains' })
  getSummary(@Query('userId', ParseIntPipe) userId: number) {
    return this.portfolioService.getPortfolioSummary(userId);
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get portfolio performance metrics' })
  @ApiQuery({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for performance calculation (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for performance calculation (ISO format)' })
  @ApiResponse({ status: 200, description: 'Performance metrics including returns and gains' })
  getPerformance(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.portfolioService.getPerformanceMetrics(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('allocation/type')
  @ApiOperation({ summary: 'Get portfolio allocation by asset type' })
  @ApiQuery({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Asset allocation breakdown by type (stocks, ETFs, etc.)' })
  getAllocationByType(@Query('userId', ParseIntPipe) userId: number) {
    return this.portfolioService.getAllocationByType(userId);
  }

  @Get('allocation/sector')
  @ApiOperation({ summary: 'Get portfolio allocation by sector' })
  @ApiQuery({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Asset allocation breakdown by sector' })
  getAllocationBySector(@Query('userId', ParseIntPipe) userId: number) {
    return this.portfolioService.getAllocationBySector(userId);
  }
}
