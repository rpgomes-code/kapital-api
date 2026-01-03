import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrokersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.broker.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const broker = await this.prisma.broker.findUnique({ where: { id } });
    if (!broker) throw new NotFoundException('Broker not found');
    return broker;
  }

  // Link a broker to a user
  async linkToUser(userId: number, brokerId: number) {
    const existing = await this.prisma.userBroker.findFirst({
      where: { userId, brokerId },
    });
    if (existing) return existing;

    return this.prisma.userBroker.create({
      data: { userId, brokerId },
      include: { broker: true },
    });
  }

  async getUserBrokers(userId: number) {
    return this.prisma.userBroker.findMany({
      where: { userId },
      include: {
        broker: true,
        accounts: true,
      },
    });
  }
}
