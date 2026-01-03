import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get(':userId')
  getHoldings(@Param('userId', ParseIntPipe) userId: number) {
    return this.portfolioService.getHoldings(userId);
  }

  @Get(':userId/allocation')
  getAllocation(@Param('userId', ParseIntPipe) userId: number) {
    return this.portfolioService.getAllocationByType(userId);
  }

  @Get(':userId/history')
  getHistory(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('days', ParseIntPipe) days: number = 30,
  ) {
    return this.portfolioService.getPerformanceHistory(userId, days);
  }
}
