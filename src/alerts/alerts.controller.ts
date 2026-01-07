// src/alerts/alerts.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { FilterAlertsDto } from './dto/filter-alerts.dto';

@ApiTags('alerts')
@ApiBearerAuth('bearer-auth')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new price alert' })
  @ApiResponse({ status: 201, description: 'Alert created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  create(@Session() session: UserSession, @Body() dto: CreateAlertDto) {
    return this.alertsService.create({ ...dto, userId: session.user.id });
  }

  @Get()
  @ApiOperation({ summary: 'Get all alerts for current user' })
  @ApiResponse({ status: 200, description: 'Paginated list of alerts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @Session() session: UserSession,
    @Query() filters: FilterAlertsDto,
  ) {
    return this.alertsService.findByUser(session.user.id, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get alert by ID' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({ status: 200, description: 'Alert found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession,
  ) {
    return this.alertsService.findOne(id, session.user.id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle alert active state' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({ status: 200, description: 'Alert toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  toggle(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession,
  ) {
    return this.alertsService.toggle(id, session.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete alert' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({ status: 200, description: 'Alert deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession,
  ) {
    return this.alertsService.remove(id, session.user.id);
  }
}
