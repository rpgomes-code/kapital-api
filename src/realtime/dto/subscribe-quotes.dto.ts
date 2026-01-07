// src/realtime/dto/subscribe-quotes.dto.ts
import {
  IsArray,
  IsString,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';

export class SubscribeQuotesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  symbols: string[];
}

export class UnsubscribeQuotesDto {
  @IsArray()
  @IsString({ each: true })
  symbols: string[];
}
