// src/accounts/dto/create-account.dto.ts
import { IsInt, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty({ example: 1, description: 'User-broker relationship ID' })
  @IsInt()
  userBrokerId: number;

  @ApiProperty({ example: 'Main Trading Account', description: 'Account name', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Account currency code', default: 'USD', maxLength: 3 })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string = 'USD';
}
