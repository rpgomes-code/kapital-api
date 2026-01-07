// src/portfolio/dto/allocation.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class AllocationItemDto {
  @ApiProperty({ example: 25000.00, description: 'Value in this category' })
  value: number;

  @ApiProperty({ example: 50.00, description: 'Percentage allocation' })
  percentage: number;
}

export class SectorAllocationItemDto extends AllocationItemDto {
  @ApiProperty({ example: 5, description: 'Number of holdings in this sector' })
  holdings: number;
}

// TypeAllocationDto is a Record type - using ApiExtraModels for Swagger
export type TypeAllocationDto = Record<string, AllocationItemDto>;

export class SectorAllocationDto {
  @ApiProperty({ example: 50000.00, description: 'Total portfolio value' })
  totalValue: number;

  @ApiProperty({
    example: {
      Technology: { value: 20000, percentage: 40, holdings: 5 },
      Healthcare: { value: 15000, percentage: 30, holdings: 3 },
      Finance: { value: 10000, percentage: 20, holdings: 4 },
      Uncategorized: { value: 5000, percentage: 10, holdings: 2 },
    },
    description: 'Allocation by sector',
  })
  sectors: Record<string, SectorAllocationItemDto>;
}

export class CurrencyAllocationDto {
  @ApiProperty({ example: 50000.00, description: 'Total portfolio value in base currency' })
  totalValue: number;

  @ApiProperty({ example: 'USD', description: 'Base currency for conversion' })
  baseCurrency: string;

  @ApiProperty({
    example: {
      USD: { value: 35000, percentage: 70 },
      EUR: { value: 10000, percentage: 20 },
      GBP: { value: 5000, percentage: 10 },
    },
    description: 'Allocation by currency',
  })
  currencies: Record<string, AllocationItemDto>;
}

export class GeographyAllocationDto {
  @ApiProperty({ example: 50000.00, description: 'Total portfolio value' })
  totalValue: number;

  @ApiProperty({
    example: {
      'United States': { value: 40000, percentage: 80, holdings: 10 },
      'United Kingdom': { value: 5000, percentage: 10, holdings: 2 },
      Germany: { value: 5000, percentage: 10, holdings: 3 },
    },
    description: 'Allocation by geography/country',
  })
  regions: Record<string, SectorAllocationItemDto>;
}
