// src/holder/dto/create-transaction.dto.ts
import {
  IsInt,
  IsEnum,
  IsNumber,
  IsString,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { TransactionType } from '../../generated/prisma/client';

export class CreateTransactionDto {
  @IsInt()
  accountId: number;

  @IsInt()
  assetId: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNumber()
  quantity: number;

  @IsNumber()
  price: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsNumber()
  fee?: number;

  @IsOptional()
  @IsNumber()
  tax?: number;

  @IsDateString()
  executedAt: string;

  @IsOptional()
  @IsInt({ each: true })
  tagIds?: number[];
}
