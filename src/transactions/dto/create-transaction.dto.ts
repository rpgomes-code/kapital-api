// src/transactions/dto/create-transaction.dto.ts
import {
  IsInt,
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '../../generated/prisma/client';

export class CreateTransactionDto {
  @ApiProperty({ example: 1, description: 'Account ID' })
  @IsInt()
  accountId: number;

  @ApiProperty({ example: 1, description: 'Asset ID' })
  @IsInt()
  assetId: number;

  @ApiProperty({ enum: TransactionType, example: 'BUY', description: 'Transaction type' })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 10.5, description: 'Number of shares/units', minimum: 0 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 150.25, description: 'Price per share/unit', minimum: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 'USD', description: 'Transaction currency' })
  @IsString()
  currency: string;

  @ApiPropertyOptional({ example: 9.99, description: 'Transaction fee', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fee?: number;

  @ApiPropertyOptional({ example: 5.00, description: 'Tax amount', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Execution date and time (ISO 8601)' })
  @IsDateString()
  executedAt: string;
}
