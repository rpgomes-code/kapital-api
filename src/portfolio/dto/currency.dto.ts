// src/portfolio/dto/currency.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CurrencyConversionQueryDto {
  @ApiProperty({ example: 'EUR', description: 'Source currency' })
  @IsString()
  from: string;

  @ApiProperty({ example: 'USD', description: 'Target currency' })
  @IsString()
  to: string;

  @ApiProperty({ example: 1000, description: 'Amount to convert' })
  @Type(() => Number)
  @IsNumber()
  amount: number;
}

export class ExchangeRateDto {
  @ApiProperty({ example: 'EUR', description: 'Base currency' })
  from: string;

  @ApiProperty({ example: 'USD', description: 'Quote currency' })
  to: string;

  @ApiProperty({ example: 1.0856, description: 'Exchange rate' })
  rate: number;

  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Rate timestamp' })
  timestamp: string;
}

export class CurrencyConversionDto {
  @ApiProperty({ example: 'EUR', description: 'Source currency' })
  from: string;

  @ApiProperty({ example: 'USD', description: 'Target currency' })
  to: string;

  @ApiProperty({ example: 1000, description: 'Original amount' })
  originalAmount: number;

  @ApiProperty({ example: 1085.60, description: 'Converted amount' })
  convertedAmount: number;

  @ApiProperty({ example: 1.0856, description: 'Exchange rate used' })
  rate: number;

  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Conversion timestamp' })
  timestamp: string;
}

export class MultiCurrencyRatesDto {
  @ApiProperty({ example: 'USD', description: 'Base currency' })
  baseCurrency: string;

  @ApiProperty({
    example: { EUR: 0.9212, GBP: 0.7856, JPY: 148.25, CHF: 0.8654 },
    description: 'Exchange rates relative to base currency',
  })
  rates: Record<string, number>;

  @ApiProperty({ example: '2024-01-15T10:30:00Z', description: 'Rates timestamp' })
  timestamp: string;
}

export class PortfolioMultiCurrencyDto {
  @ApiProperty({ example: 'USD', description: 'Display currency' })
  displayCurrency: string;

  @ApiProperty({ example: 50000.00, description: 'Total value in display currency' })
  totalValueInDisplayCurrency: number;

  @ApiProperty({
    example: {
      USD: { originalValue: 35000, convertedValue: 35000, holdings: 8 },
      EUR: { originalValue: 9212, convertedValue: 10000, holdings: 3 },
      GBP: { originalValue: 3928, convertedValue: 5000, holdings: 2 },
    },
    description: 'Holdings breakdown by original currency',
  })
  byCurrency: Record<
    string,
    {
      originalValue: number;
      convertedValue: number;
      holdings: number;
    }
  >;

  @ApiProperty({ example: 250.00, description: 'Total FX gain/loss' })
  fxGainLoss: number;

  @ApiProperty({ example: 0.5, description: 'FX gain/loss percentage' })
  fxGainLossPercent: number;
}

export class FxGainLossDetailDto {
  @ApiProperty({ example: 1, description: 'Asset ID' })
  assetId: number;

  @ApiProperty({ example: 'VWCE.DE', description: 'Asset symbol' })
  symbol: string;

  @ApiProperty({ example: 'EUR', description: 'Asset currency' })
  assetCurrency: string;

  @ApiProperty({ example: 'USD', description: 'User base currency' })
  baseCurrency: string;

  @ApiProperty({ example: 1.12, description: 'Purchase exchange rate' })
  purchaseRate: number;

  @ApiProperty({ example: 1.0856, description: 'Current exchange rate' })
  currentRate: number;

  @ApiProperty({ example: -150.00, description: 'FX gain/loss amount' })
  fxGainLoss: number;

  @ApiProperty({ example: -1.25, description: 'FX gain/loss percentage' })
  fxGainLossPercent: number;
}
