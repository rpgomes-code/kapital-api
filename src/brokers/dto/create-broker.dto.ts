// src/brokers/dto/create-broker.dto.ts
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateBrokerDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  acronym?: string;

  @IsOptional()
  @IsString()
  logo?: string;
}
