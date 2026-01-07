import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AllowAnonymous, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { BrokersService } from './brokers.service';

@ApiTags('brokers')
@Controller('brokers')
export class BrokersController {
  constructor(private readonly brokersService: BrokersService) {}

  @Get()
  @AllowAnonymous() // Public: List all available brokers
  @ApiOperation({ summary: 'Get all brokers' })
  @ApiResponse({ status: 200, description: 'List of all available brokers' })
  findAll() {
    return this.brokersService.findAll();
  }

  @Get('me')
  @ApiBearerAuth('bearer-auth')
  @ApiOperation({ summary: 'Get all brokers linked to the current user' })
  @ApiResponse({ status: 200, description: 'List of user brokers with accounts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyBrokers(@Session() session: UserSession) {
    return this.brokersService.getUserBrokers(session.user.id);
  }

  @Get(':id')
  @AllowAnonymous() // Public: View broker details
  @ApiOperation({ summary: 'Get broker by ID' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: 200, description: 'Broker found' })
  @ApiResponse({ status: 404, description: 'Broker not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.brokersService.findOne(id);
  }

  @Post('link')
  @ApiBearerAuth('bearer-auth')
  @ApiOperation({ summary: 'Link a broker to the current user' })
  @ApiBody({ schema: { properties: { brokerId: { type: 'number' } } } })
  @ApiResponse({ status: 201, description: 'Broker linked to user successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Broker not found' })
  @ApiResponse({ status: 409, description: 'User already linked to this broker' })
  linkToUser(@Session() session: UserSession, @Body() body: { brokerId: number }) {
    return this.brokersService.linkToUser(session.user.id, body.brokerId);
  }
}
