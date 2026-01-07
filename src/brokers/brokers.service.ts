// src/brokers/brokers.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrokerDto } from './dto/create-broker.dto';
import { UpdateBrokerDto } from './dto/update-broker.dto';

@Injectable()
export class BrokersService {
  constructor(private prisma: PrismaService) {}

  async create(createBrokerDto: CreateBrokerDto) {
    return this.prisma.broker.create({
      data: createBrokerDto,
    });
  }

  async findAll() {
    return this.prisma.broker.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const broker = await this.prisma.broker.findUnique({
      where: { id },
    });

    if (!broker) {
      throw new NotFoundException(`Broker with ID ${id} not found`);
    }

    return broker;
  }

  async findByPublicId(publicId: string) {
    const broker = await this.prisma.broker.findUnique({
      where: { publicId },
    });

    if (!broker) {
      throw new NotFoundException(`Broker not found`);
    }

    return broker;
  }

  async update(id: number, updateBrokerDto: UpdateBrokerDto) {
    await this.findOne(id);

    return this.prisma.broker.update({
      where: { id },
      data: updateBrokerDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.broker.delete({
      where: { id },
    });
  }

  async linkToUser(userId: string, brokerId: number) {
    // Check if broker exists
    await this.findOne(brokerId);

    // Check if already linked
    const existing = await this.prisma.userBroker.findFirst({
      where: { userId, brokerId },
    });

    if (existing) {
      throw new ConflictException('User is already linked to this broker');
    }

    return this.prisma.userBroker.create({
      data: {
        userId,
        brokerId,
      },
      include: {
        broker: true,
      },
    });
  }

  async getUserBrokers(userId: string) {
    return this.prisma.userBroker.findMany({
      where: { userId },
      include: {
        broker: true,
        accounts: true,
      },
    });
  }
}
