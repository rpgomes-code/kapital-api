import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Body,
} from '@nestjs/common';
import { BrokersService } from './brokers.service';

@Controller('brokers')
export class BrokersController {
  constructor(private readonly brokersService: BrokersService) {}

  @Get()
  findAll() {
    return this.brokersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.brokersService.findOne(id);
  }

  @Post('link')
  linkToUser(@Body() body: { userId: number; brokerId: number }) {
    return this.brokersService.linkToUser(body.userId, body.brokerId);
  }

  @Get('user/:userId')
  getUserBrokers(@Param('userId', ParseIntPipe) userId: number) {
    return this.brokersService.getUserBrokers(userId);
  }
}
