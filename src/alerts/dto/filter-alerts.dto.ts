// src/alerts/dto/filter-alerts.dto.ts
import { IsOptional, IsEnum, IsBoolean, IsInt } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AlertType } from '../../generated/prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class FilterAlertsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: AlertType,
    description: 'Filter by alert type',
    enumName: 'AlertType',
  })
  @IsOptional()
  @IsEnum(AlertType)
  type?: AlertType;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by asset ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assetId?: number;
}
