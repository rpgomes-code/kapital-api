// src/transactions/transactions.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { Prisma, TransactionType } from 'generated/prisma/client';
import { getPaginationParams, paginate } from '../common/utils/pagination.util';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTransactionDto) {
    // Validate account exists
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${dto.accountId} not found`);
    }

    // Validate asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
    });

    if (!asset) {
      throw new NotFoundException(`Asset with ID ${dto.assetId} not found`);
    }

    // For SELL transactions, validate sufficient holdings
    if (dto.type === TransactionType.SELL) {
      const holdings = await this.calculateHoldings(dto.accountId, dto.assetId);
      if (holdings < dto.quantity) {
        throw new BadRequestException(
          `Insufficient holdings. Available: ${holdings}, Requested: ${dto.quantity}`,
        );
      }
    }

    return this.prisma.transaction.create({
      data: {
        accountId: dto.accountId,
        assetId: dto.assetId,
        type: dto.type,
        quantity: new Decimal(dto.quantity),
        price: new Decimal(dto.price),
        currency: dto.currency,
        fee: dto.fee ? new Decimal(dto.fee) : null,
        tax: dto.tax ? new Decimal(dto.tax) : null,
        executedAt: new Date(dto.executedAt),
      },
      include: {
        account: {
          include: {
            userBroker: {
              include: { broker: true },
            },
          },
        },
        asset: true,
      },
    });
  }

  async findAll(userId: number, filters: FilterTransactionsDto) {
    const where: Prisma.TransactionWhereInput = {
      account: {
        userBroker: {
          userId,
        },
      },
    };

    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    if (filters.assetId) {
      where.assetId = filters.assetId;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.executedAt = {};
      if (filters.startDate) {
        where.executedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.executedAt.lte = new Date(filters.endDate);
      }
    }

    const { skip, take } = getPaginationParams(filters);

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take,
        include: {
          account: true,
          asset: true,
          tags: {
            include: { tag: true },
          },
        },
        orderBy: { executedAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return paginate(transactions, total, filters);
  }

  async findOne(id: number) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        account: {
          include: {
            userBroker: {
              include: { broker: true },
            },
          },
        },
        asset: {
          include: {
            sector: true,
            industry: true,
          },
        },
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async update(id: number, dto: UpdateTransactionDto) {
    await this.findOne(id);

    const updateData: Prisma.TransactionUpdateInput = {};

    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.quantity !== undefined)
      updateData.quantity = new Decimal(dto.quantity);
    if (dto.price !== undefined) updateData.price = new Decimal(dto.price);
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.fee !== undefined) updateData.fee = new Decimal(dto.fee);
    if (dto.tax !== undefined) updateData.tax = new Decimal(dto.tax);
    if (dto.executedAt !== undefined)
      updateData.executedAt = new Date(dto.executedAt);

    return this.prisma.transaction.update({
      where: { id },
      data: updateData,
      include: {
        account: true,
        asset: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    // Remove associated tags first
    await this.prisma.transactionTag.deleteMany({
      where: { transactionId: id },
    });

    return this.prisma.transaction.delete({
      where: { id },
    });
  }

  async addTag(transactionId: number, tagId: number) {
    return this.prisma.transactionTag.create({
      data: {
        transactionId,
        tagId,
      },
    });
  }

  async removeTag(transactionId: number, tagId: number) {
    return this.prisma.transactionTag.delete({
      where: {
        transactionId_tagId: {
          transactionId,
          tagId,
        },
      },
    });
  }

  private async calculateHoldings(
    accountId: number,
    assetId: number,
  ): Promise<number> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId,
        assetId,
        type: { in: [TransactionType.BUY, TransactionType.SELL] },
      },
    });

    let holdings = new Decimal(0);

    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        holdings = holdings.add(tx.quantity);
      } else if (tx.type === TransactionType.SELL) {
        holdings = holdings.sub(tx.quantity);
      }
    }

    return holdings.toNumber();
  }
}
