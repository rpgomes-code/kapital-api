import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWatchlistDto,
  AddAssetToWatchlistDto,
} from './dto/create-watchlist.dto';

@Injectable()
export class WatchlistsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWatchlistDto) {
    return this.prisma.watchlist.create({
      data: dto,
    });
  }

  async findByUser(userId: number) {
    return this.prisma.watchlist.findMany({
      where: { userId },
      include: {
        assets: {
          include: { asset: true },
        },
      },
    });
  }

  async findOne(id: number) {
    const watchlist = await this.prisma.watchlist.findUnique({
      where: { id },
      include: {
        assets: {
          include: { asset: true },
        },
      },
    });
    if (!watchlist) throw new NotFoundException('Watchlist not found');
    return watchlist;
  }

  async addAsset(watchlistId: number, dto: AddAssetToWatchlistDto) {
    await this.findOne(watchlistId);

    const existing = await this.prisma.watchlistAsset.findFirst({
      where: { watchlistId, assetId: dto.assetId },
    });
    if (existing) throw new ConflictException('Asset already in watchlist');

    return this.prisma.watchlistAsset.create({
      data: {
        watchlistId,
        assetId: dto.assetId,
      },
      include: { asset: true },
    });
  }

  async removeAsset(watchlistId: number, assetId: number) {
    const entry = await this.prisma.watchlistAsset.findFirst({
      where: { watchlistId, assetId },
    });
    if (!entry) throw new NotFoundException('Asset not in watchlist');

    return this.prisma.watchlistAsset.delete({
      where: { id: entry.id },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    // Delete associated assets first
    await this.prisma.watchlistAsset.deleteMany({ where: { watchlistId: id } });
    return this.prisma.watchlist.delete({ where: { id } });
  }
}
