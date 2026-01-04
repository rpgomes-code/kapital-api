// src/watchlists/watchlists.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { YahooFinanceService } from '../yahoo-finance/yahoo-finance.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';

@Injectable()
export class WatchlistsService {
  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
  ) {}

  async create(dto: CreateWatchlistDto) {
    return this.prisma.watchlist.create({
      data: {
        userId: dto.userId,
        name: dto.name,
      },
    });
  }

  async findByUser(userId: number) {
    return this.findAllByUser(userId);
  }

  async findAllByUser(userId: number) {
    return this.prisma.watchlist.findMany({
      where: { userId },
      include: {
        assets: {
          include: {
            asset: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const watchlist = await this.prisma.watchlist.findUnique({
      where: { id },
      include: {
        assets: {
          include: {
            asset: {
              include: {
                sector: true,
                industry: true,
              },
            },
          },
        },
      },
    });

    if (!watchlist) {
      throw new NotFoundException(`Watchlist with ID ${id} not found`);
    }

    return watchlist;
  }

  async getWatchlistWithPrices(id: number) {
    const watchlist = await this.findOne(id);

    const symbols = watchlist.assets.map((wa) => wa.asset.yahooSymbol);
    const quotes = await this.yahooFinance.getQuotes(symbols);

    const assetsWithPrices = watchlist.assets.map((wa) => {
      const quote = quotes.find((q) => q.symbol === wa.asset.yahooSymbol);
      return {
        ...wa.asset,
        currentPrice: quote?.regularMarketPrice,
        priceChange: quote?.regularMarketChange,
        priceChangePercent: quote?.regularMarketChangePercent,
        marketState: quote?.marketState,
      };
    });

    return {
      ...watchlist,
      assets: assetsWithPrices,
    };
  }

  async addAsset(watchlistId: number, dto: { assetId: number }) {
    // Check if already in watchlist
    const existing = await this.prisma.watchlistAsset.findFirst({
      where: {
        watchlistId,
        assetId: dto.assetId,
      },
    });

    if (existing) {
      throw new ConflictException('Asset already in watchlist');
    }

    return this.prisma.watchlistAsset.create({
      data: {
        watchlistId,
        assetId: dto.assetId,
      },
      include: {
        asset: true,
      },
    });
  }

  async removeAsset(watchlistId: number, assetId: number) {
    const existing = await this.prisma.watchlistAsset.findFirst({
      where: {
        watchlistId,
        assetId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Asset not in watchlist');
    }

    return this.prisma.watchlistAsset.delete({
      where: { id: existing.id },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    // Delete all watchlist assets first
    await this.prisma.watchlistAsset.deleteMany({
      where: { watchlistId: id },
    });

    return this.prisma.watchlist.delete({
      where: { id },
    });
  }
}
