// src/alerts/dto/create-alert.dto.ts
import { IsInt, IsEnum, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AlertType } from '../../generated/prisma/client';

export class CreateAlertDto {
  @ApiProperty({ example: 1, description: 'Asset ID to monitor' })
  @IsInt()
  assetId: number;

  @ApiProperty({
    enum: AlertType,
    example: 'PRICE_ABOVE',
    description: 'Type of alert condition',
    enumName: 'AlertType',
  })
  @IsEnum(AlertType)
  type: AlertType;

  @ApiProperty({
    example: 150.0,
    description: 'Target value for the alert condition',
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  targetValue: number;

  // userId is set internally from session
  userId?: string;
}
