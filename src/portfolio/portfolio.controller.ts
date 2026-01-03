// src/portfolio/portfolio.controller.ts
import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  // Note: In production, userId would come from auth context
  @Get('summary')
  getSummary(@Query('userId', ParseIntPipe) userId: number) {
    return this.portfolioService.getPortfolioSummary(userId);
  }

  @Get('performance')
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
  getAllocationByType(@Query('userId', ParseIntPipe) userId: number) {
    return this.portfolioService.getAllocationByType(userId);
  }

  @Get('allocation/sector')
  getAllocationBySector(@Query('userId', ParseIntPipe) userId: number) {
    return this.portfolioService.getAllocationBySector(userId);
  }
}
