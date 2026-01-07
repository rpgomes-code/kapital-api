import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CorporateActionsService } from './corporate-actions.service';
import {
  CreateCorporateActionDto,
  CorporateActionResponseDto,
  CorporateActionWithAssetDto,
  ProcessActionResultDto,
} from './dto/corporate-action.dto';
import { CorporateActionType } from '../generated/prisma/client';

@ApiTags('corporate-actions')
@ApiBearerAuth('bearer-auth')
@Controller('corporate-actions')
export class CorporateActionsController {
  constructor(
    private readonly corporateActionsService: CorporateActionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new corporate action' })
  @ApiResponse({
    status: 201,
    description: 'Corporate action created',
    type: CorporateActionWithAssetDto,
  })
  async createCorporateAction(@Body() dto: CreateCorporateActionDto) {
    return this.corporateActionsService.createCorporateAction(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all corporate actions' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: CorporateActionType,
    description: 'Filter by action type',
  })
  @ApiQuery({
    name: 'isProcessed',
    required: false,
    type: Boolean,
    description: 'Filter by processed status',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number of results',
  })
  @ApiResponse({
    status: 200,
    description: 'List of corporate actions',
    type: [CorporateActionWithAssetDto],
  })
  async getAllCorporateActions(
    @Query('type') type?: CorporateActionType,
    @Query('isProcessed') isProcessed?: string,
    @Query('limit') limit?: string,
  ) {
    return this.corporateActionsService.getAllCorporateActions({
      type,
      isProcessed: isProcessed !== undefined ? isProcessed === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming corporate actions (next 30 days)' })
  @ApiResponse({
    status: 200,
    description: 'List of upcoming corporate actions',
    type: [CorporateActionWithAssetDto],
  })
  async getUpcomingActions() {
    return this.corporateActionsService.getUpcomingActions();
  }

  @Get('unprocessed')
  @ApiOperation({ summary: 'Get unprocessed corporate actions' })
  @ApiResponse({
    status: 200,
    description: 'List of unprocessed corporate actions',
    type: [CorporateActionWithAssetDto],
  })
  async getUnprocessedActions() {
    return this.corporateActionsService.getUnprocessedActions();
  }

  @Get('asset/:assetId')
  @ApiOperation({ summary: 'Get corporate actions for an asset' })
  @ApiParam({ name: 'assetId', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'List of corporate actions for the asset',
    type: [CorporateActionWithAssetDto],
  })
  async getAssetCorporateActions(
    @Param('assetId', ParseIntPipe) assetId: number,
  ) {
    return this.corporateActionsService.getAssetCorporateActions(assetId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a corporate action by ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Corporate action details',
    type: CorporateActionWithAssetDto,
  })
  async getCorporateAction(@Param('id', ParseIntPipe) id: number) {
    return this.corporateActionsService.getCorporateAction(id);
  }

  @Post(':id/process')
  @ApiOperation({ summary: 'Process a corporate action' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Result of processing the action',
    type: ProcessActionResultDto,
  })
  async processAction(@Param('id', ParseIntPipe) id: number) {
    const itemsAffected = await this.corporateActionsService.processAction(id);
    return {
      success: true,
      itemsAffected,
      message: `Successfully processed ${itemsAffected} items`,
    };
  }
}
