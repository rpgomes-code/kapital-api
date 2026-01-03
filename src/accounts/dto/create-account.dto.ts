// src/accounts/dto/create-account.dto.ts
import { IsInt, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateAccountDto {
  @IsInt()
  userBrokerId: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string = 'USD';
}
