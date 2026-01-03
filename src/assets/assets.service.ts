import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StonksService } from '../stonks/stonks.service';
import { AssetType } from 'generated/prisma/enums';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    private stonks: StonksService,
  ) {}

  async search(query: string) {
    const yahooResults = await this.stonks.searchSymbol(query);

    const symbols = yahooResults.map((r) => r.symbol);
    const existing = await this.prisma.asset.findMany({
      where: { yahooSymbol: { in: symbols } },
      select: { yahooSymbol: true },
    });
    const existingSet = new Set(existing.map((e) => e.yahooSymbol));

    return yahooResults.map((r) => ({
      ...r,
      existsInDb: existingSet.has(r.symbol),
    }));
  }

  async createFromYahoo(yahooSymbol: string) {
    const existing = await this.prisma.asset.findFirst({
      where: { yahooSymbol },
    });
    if (existing) return existing;

    const quote = await this.stonks.getQuote(yahooSymbol);

    return this.prisma.asset.create({
      data: {
        symbol: quote.symbol,
        yahooSymbol: quote.symbol,
        name: quote.shortName || quote.longName || quote.symbol,
        assetType: this.mapQuoteType(quote.quoteType),
        exchange: quote.exchange,
        currency: quote.currency || 'USD',
      },
    });
  }

  private mapQuoteType(quoteType: string): AssetType {
    const mapping: Record<string, AssetType> = {
      EQUITY: AssetType.STOCK,
      ETF: AssetType.ETF,
      CRYPTOCURRENCY: AssetType.CRYPTO,
      MUTUALFUND: AssetType.FUND,
    };
    return mapping[quoteType] || AssetType.STOCK;
  }

  async findAll(pagination: PaginationDto) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        skip,
        take: limit,
        include: {
          sector: true,
          industry: true,
        },
        orderBy: { symbol: 'asc' },
      }),
      this.prisma.asset.count(),
    ]);

    return {
      data: assets,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        sector: true,
        industry: true,
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async getQuote(assetId: number) {
    const asset = await this.findOne(assetId);
    const quote = await this.stonks.getQuote(asset.yahooSymbol);

    return {
      asset,
      quote: {
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        dayHigh: quote.regularMarketDayHigh,
        dayLow: quote.regularMarketDayLow,
        volume: quote.regularMarketVolume,
        marketCap: quote.marketCap,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      },
    };
  }

  async syncPrices(assetId: number, from: string, to: string) {
    const asset = await this.findOne(assetId);

    const history = await this.stonks.getHistoricalData(
      asset.yahooSymbol,
      from,
      to,
    );

    const priceData = history.map((h) => ({
      assetId,
      date: h.date,
      open: h.open,
      close: h.close,
      high: h.high,
      low: h.low,
      volume: BigInt(h.volume),
      currency: asset.currency,
    }));

    // Upsert prices
    for (const price of priceData) {
      await this.prisma.assetPrice.upsert({
        where: {
          assetId_date: {
            assetId: price.assetId,
            date: price.date,
          },
        },
        update: price,
        create: price,
      });
    }

    return { synced: priceData.length };
  }
}
