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
import { TransactionType } from 'generated/prisma/client';

export class CreateTransactionDto {
  @IsInt()
  accountId: number;

  @IsInt()
  assetId: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @IsDateString()
  executedAt: string;
}
