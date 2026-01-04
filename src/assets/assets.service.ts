// src/assets/assets.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { YahooFinanceService } from '../yahoo-finance/yahoo-finance.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { SearchAssetDto } from './dto/search-asset.dto';
import { AssetType, Prisma } from '../generated/prisma/client';

@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
  ) {}

  async create(createAssetDto: CreateAssetDto) {
    // Check if symbol already exists
    const existing = await this.prisma.asset.findFirst({
      where: { symbol: createAssetDto.symbol },
    });

    if (existing) {
      throw new ConflictException(
        `Asset with symbol ${createAssetDto.symbol} already exists`,
      );
    }

    return this.prisma.asset.create({
      data: createAssetDto,
      include: {
        sector: true,
        industry: true,
      },
    });
  }

  async findAll(searchDto?: SearchAssetDto) {
    const where: Prisma.AssetWhereInput = {};

    if (searchDto?.query) {
      where.OR = [
        { symbol: { contains: searchDto.query, mode: 'insensitive' } },
        { name: { contains: searchDto.query, mode: 'insensitive' } },
        { isin: { contains: searchDto.query, mode: 'insensitive' } },
      ];
    }

    if (searchDto?.assetType) {
      where.assetType = searchDto.assetType;
    }

    if (searchDto?.exchange) {
      where.exchange = searchDto.exchange;
    }

    if (searchDto?.currency) {
      where.currency = searchDto.currency;
    }

    return this.prisma.asset.findMany({
      where,
      include: {
        sector: true,
        industry: true,
      },
      orderBy: { symbol: 'asc' },
    });
  }

  async findOne(id: number) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        sector: true,
        industry: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }

    return asset;
  }

  async findBySymbol(symbol: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { symbol: symbol.toUpperCase() },
      include: {
        sector: true,
        industry: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with symbol ${symbol} not found`);
    }

    return asset;
  }

  async findOrCreateBySymbol(symbol: string): Promise<{
    asset: any;
    created: boolean;
  }> {
    // First check if we have it locally
    const existing = await this.prisma.asset.findFirst({
      where: { yahooSymbol: symbol.toUpperCase() },
      include: {
        sector: true,
        industry: true,
      },
    });

    if (existing) {
      return { asset: existing, created: false };
    }

    // Fetch from Yahoo Finance
    const yahooData = await this.yahooFinance.getQuote(symbol);

    if (!yahooData) {
      throw new NotFoundException(`Asset ${symbol} not found on Yahoo Finance`);
    }

    // Create the asset
    const asset = await this.prisma.asset.create({
      data: {
        symbol: yahooData.symbol,
        yahooSymbol: yahooData.symbol,
        name: yahooData.shortName || yahooData.longName || yahooData.symbol,
        assetType: this.mapQuoteTypeToAssetType(yahooData.quoteType),
        exchange: yahooData.exchange,
        currency: yahooData.currency || 'USD',
      },
      include: {
        sector: true,
        industry: true,
      },
    });

    return { asset, created: true };
  }

  async update(id: number, updateAssetDto: UpdateAssetDto) {
    await this.findOne(id);

    return this.prisma.asset.update({
      where: { id },
      data: updateAssetDto,
      include: {
        sector: true,
        industry: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    // Check for transactions
    const transactionCount = await this.prisma.transaction.count({
      where: { assetId: id },
    });

    if (transactionCount > 0) {
      throw new ConflictException(
        `Cannot delete asset with ${transactionCount} transactions`,
      );
    }

    return this.prisma.asset.delete({
      where: { id },
    });
  }

  async getAssetWithCurrentPrice(id: number) {
    const asset = await this.findOne(id);
    const quote = await this.yahooFinance.getQuote(asset.yahooSymbol);

    return {
      ...asset,
      currentPrice: quote?.regularMarketPrice,
      priceChange: quote?.regularMarketChange,
      priceChangePercent: quote?.regularMarketChangePercent,
      marketState: quote?.marketState,
      lastUpdated: new Date(),
    };
  }

  private mapQuoteTypeToAssetType(quoteType: string): AssetType {
    const mapping: Record<string, AssetType> = {
      EQUITY: AssetType.STOCK,
      ETF: AssetType.ETF,
      MUTUALFUND: AssetType.FUND,
      CRYPTOCURRENCY: AssetType.CRYPTO,
    };

    return mapping[quoteType] || AssetType.STOCK;
  }
}
