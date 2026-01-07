// src/portfolio/portfolio.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { PortfolioService } from './portfolio.service';

@ApiTags('portfolio')
@ApiBearerAuth('bearer-auth')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get portfolio summary with holdings and current values' })
  @ApiResponse({ status: 200, description: 'Portfolio summary with holdings, values, and gains' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSummary(@Session() session: UserSession) {
    return this.portfolioService.getPortfolioSummary(session.user.id);
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get portfolio performance metrics' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for performance calculation (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for performance calculation (ISO format)' })
  @ApiResponse({ status: 200, description: 'Performance metrics including returns and gains' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getPerformance(
    @Session() session: UserSession,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.portfolioService.getPerformanceMetrics(
      session.user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('allocation/type')
  @ApiOperation({ summary: 'Get portfolio allocation by asset type' })
  @ApiResponse({ status: 200, description: 'Asset allocation breakdown by type (stocks, ETFs, etc.)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getAllocationByType(@Session() session: UserSession) {
    return this.portfolioService.getAllocationByType(session.user.id);
  }

  @Get('allocation/sector')
  @ApiOperation({ summary: 'Get portfolio allocation by sector' })
  @ApiResponse({ status: 200, description: 'Asset allocation breakdown by sector' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getAllocationBySector(@Session() session: UserSession) {
    return this.portfolioService.getAllocationBySector(session.user.id);
  }
}
