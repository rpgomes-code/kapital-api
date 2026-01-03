import { IsString, IsInt, IsOptional } from 'class-validator';

export class CreateAccountDto {
  @IsInt()
  userBrokerId: number;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  currency?: string = 'USD';
}
