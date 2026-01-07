import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
  IsInt,
} from 'class-validator';
import { CorporateActionType } from '../../generated/prisma/client';

export class CreateCorporateActionDto {
  @ApiProperty({ example: 1, description: 'Asset ID' })
  @IsInt()
  assetId: number;

  @ApiProperty({
    enum: CorporateActionType,
    example: 'DIVIDEND',
    description: 'Type of corporate action',
  })
  @IsEnum(CorporateActionType)
  type: CorporateActionType;

  @ApiProperty({
    example: 0.25,
    description: 'Value (dividend amount, split ratio, etc.)',
  })
  @IsNumber()
  value: number;

  @ApiProperty({
    example: '2024-01-15T00:00:00.000Z',
    description: 'Execution date',
  })
  @IsDateString()
  executedAt: string;

  @ApiPropertyOptional({
    example: '2024-01-10T00:00:00.000Z',
    description: 'Record date',
  })
  @IsOptional()
  @IsDateString()
  recordDate?: string;

  @ApiPropertyOptional({
    example: '2024-01-09T00:00:00.000Z',
    description: 'Ex-dividend date',
  })
  @IsOptional()
  @IsDateString()
  exDate?: string;

  @ApiPropertyOptional({
    example: '2024-01-20T00:00:00.000Z',
    description: 'Payment date',
  })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({
    example: 'Q4 2023 dividend payment',
    description: 'Description of the action',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CorporateActionResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  assetId: number;

  @ApiProperty({ enum: CorporateActionType, example: 'DIVIDEND' })
  type: CorporateActionType;

  @ApiProperty({ example: 0.25 })
  value: number;

  @ApiProperty({ example: '2024-01-15T00:00:00.000Z' })
  executedAt: Date;

  @ApiPropertyOptional({ example: '2024-01-10T00:00:00.000Z' })
  recordDate?: Date;

  @ApiPropertyOptional({ example: '2024-01-09T00:00:00.000Z' })
  exDate?: Date;

  @ApiPropertyOptional({ example: '2024-01-20T00:00:00.000Z' })
  paymentDate?: Date;

  @ApiPropertyOptional({ example: 'Q4 2023 dividend payment' })
  description?: string;

  @ApiProperty({ example: false })
  isProcessed: boolean;

  @ApiPropertyOptional({ example: '2024-01-15T10:30:00.000Z' })
  processedAt?: Date;

  @ApiProperty({ example: '2024-01-15T00:00:00.000Z' })
  createdAt: Date;
}

export class CorporateActionWithAssetDto extends CorporateActionResponseDto {
  @ApiProperty({
    example: { id: 1, symbol: 'AAPL', name: 'Apple Inc.' },
    description: 'Associated asset',
  })
  asset: {
    id: number;
    symbol: string;
    name: string;
  };
}

export class ProcessActionResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 10 })
  itemsAffected: number;

  @ApiPropertyOptional({ example: 'Successfully processed 10 transactions' })
  message?: string;
}
