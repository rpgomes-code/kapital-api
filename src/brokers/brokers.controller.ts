import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { BrokersService } from './brokers.service';

@ApiTags('brokers')
@Controller('brokers')
export class BrokersController {
  constructor(private readonly brokersService: BrokersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all brokers' })
  @ApiResponse({ status: 200, description: 'List of all available brokers' })
  findAll() {
    return this.brokersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get broker by ID' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: 200, description: 'Broker found' })
  @ApiResponse({ status: 404, description: 'Broker not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.brokersService.findOne(id);
  }

  @Post('link')
  @ApiOperation({ summary: 'Link a broker to a user' })
  @ApiBody({ schema: { properties: { userId: { type: 'number' }, brokerId: { type: 'number' } } } })
  @ApiResponse({ status: 201, description: 'Broker linked to user successfully' })
  @ApiResponse({ status: 404, description: 'Broker not found' })
  @ApiResponse({ status: 409, description: 'User already linked to this broker' })
  linkToUser(@Body() body: { userId: number; brokerId: number }) {
    return this.brokersService.linkToUser(body.userId, body.brokerId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all brokers linked to a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'List of user brokers with accounts' })
  getUserBrokers(@Param('userId', ParseIntPipe) userId: number) {
    return this.brokersService.getUserBrokers(userId);
  }
}
