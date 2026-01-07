// src/alerts/alerts.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { FilterAlertsDto } from './dto/filter-alerts.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { PriceAlert, Prisma } from '../generated/prisma/client';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAlertDto & { userId: string }) {
    // Verify asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ID ${dto.assetId} not found`);
    }

    return this.prisma.priceAlert.create({
      data: {
        userId: dto.userId,
        assetId: dto.assetId,
        type: dto.type,
        targetValue: dto.targetValue,
      },
      include: { asset: true },
    });
  }

  async findByUser(
    userId: string,
    filters: FilterAlertsDto,
  ): Promise<PaginatedResult<PriceAlert>> {
    const { page = 1, limit = 20, type, isActive, assetId } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.PriceAlertWhereInput = { userId };
    if (type) where.type = type;
    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (assetId) where.assetId = assetId;

    const [data, total] = await Promise.all([
      this.prisma.priceAlert.findMany({
        where,
        include: { asset: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.priceAlert.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, userId: string) {
    const alert = await this.prisma.priceAlert.findUnique({
      where: { id },
      include: { asset: true },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    if (alert.userId !== userId) {
      throw new ForbiddenException('You do not have access to this alert');
    }

    return alert;
  }

  async toggle(id: number, userId: string) {
    const alert = await this.findOne(id, userId);

    return this.prisma.priceAlert.update({
      where: { id },
      data: {
        isActive: !alert.isActive,
        // Reset triggeredAt if re-activating
        triggeredAt: !alert.isActive ? null : alert.triggeredAt,
      },
      include: { asset: true },
    });
  }

  async remove(id: number, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.priceAlert.delete({
      where: { id },
    });
  }

  // Used by the alert checking job
  async getActiveAlerts() {
    return this.prisma.priceAlert.findMany({
      where: { isActive: true, triggeredAt: null },
      include: { asset: true },
    });
  }

  async markAlertTriggered(alertId: number) {
    return this.prisma.priceAlert.update({
      where: { id: alertId },
      data: {
        triggeredAt: new Date(),
        isActive: false,
      },
      include: { asset: true, user: { select: { id: true, email: true } } },
    });
  }
}
