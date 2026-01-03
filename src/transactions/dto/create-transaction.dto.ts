import {
  IsInt,
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { TransactionType } from 'generated/prisma/enums';

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
}
