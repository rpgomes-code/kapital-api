import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { HolderService } from './holder.service';

@Controller('holder')
export class HolderController {
  constructor(private readonly holderService: HolderService) {}

  // Temporary: We pass UserID in params because we have no Auth yet
  @Get('portfolio/:userId')
  async getPortfolio(@Param('userId') userId: string) {
    return this.holderService.getPortfolio(Number(userId));
  }

  @Post('transaction')
  async addTransaction(@Body() body: any) {
    // In real app, validate DTO here
    return this.holderService.addTransaction(body);
  }
}
