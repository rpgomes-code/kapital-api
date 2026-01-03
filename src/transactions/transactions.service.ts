import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTransactionDto) {
    // Validate account exists
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) throw new NotFoundException('Account not found');

    // Validate asset exists
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    // For SELL transactions, validate sufficient holdings
    if (dto.type === 'SELL') {
      const holdings = await this.calculateHoldings(dto.accountId, dto.assetId);
      if (holdings < dto.quantity) {
        throw new BadRequestException(
          `Insufficient holdings. Available: ${holdings}, Requested: ${dto.quantity}`,
        );
      }
    }

    return this.prisma.transaction.create({
      data: {
        ...dto,
        executedAt: new Date(dto.executedAt),
      },
      include: {
        asset: true,
        account: { include: { userBroker: { include: { broker: true } } } },
      },
    });
  }

  private async calculateHoldings(
    accountId: number,
    assetId: number,
  ): Promise<number> {
    const transactions = await this.prisma.transaction.findMany({
      where: { accountId, assetId },
    });

    return transactions.reduce((total, tx) => {
      if (tx.type === 'BUY') return total + Number(tx.quantity);
      if (tx.type === 'SELL') return total - Number(tx.quantity);
      return total;
    }, 0);
  }

  async findByUser(userId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where = {
      account: { userBroker: { userId } },
    };

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          asset: true,
          account: { include: { userBroker: { include: { broker: true } } } },
        },
        orderBy: { executedAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByAccount(accountId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { accountId },
        skip,
        take: limit,
        include: { asset: true },
        orderBy: { executedAt: 'desc' },
      }),
      this.prisma.transaction.count({ where: { accountId } }),
    ]);

    return {
      data: transactions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        asset: true,
        account: { include: { userBroker: { include: { broker: true } } } },
        tags: { include: { tag: true } },
      },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.transaction.delete({ where: { id } });
  }
}
