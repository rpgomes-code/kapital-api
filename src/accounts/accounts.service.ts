import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: dto,
      include: { userBroker: { include: { broker: true } } },
    });
  }

  async findAllByUser(userId: number) {
    return this.prisma.account.findMany({
      where: {
        userBroker: { userId },
      },
      include: {
        userBroker: { include: { broker: true } },
        _count: { select: { transactions: true } },
      },
    });
  }

  async findOne(id: number, userId?: number) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        userBroker: { include: { broker: true, user: true } },
        transactions: {
          include: { asset: true },
          orderBy: { executedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!account) throw new NotFoundException('Account not found');

    // Optional: verify ownership
    if (userId && account.userBroker.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return account;
  }

  async getAccountSummary(accountId: number) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: {
        transactions: {
          include: { asset: true },
        },
      },
    });

    if (!account) throw new NotFoundException('Account not found');

    // Calculate totals
    const summary = {
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalFees: 0,
      totalTaxes: 0,
      transactionCount: account.transactions.length,
    };

    for (const tx of account.transactions) {
      const value = Number(tx.quantity) * Number(tx.price);
      if (tx.type === 'BUY') summary.totalDeposited += value;
      if (tx.type === 'SELL') summary.totalWithdrawn += value;
      summary.totalFees += Number(tx.fee || 0);
      summary.totalTaxes += Number(tx.tax || 0);
    }

    return { account, summary };
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.account.delete({ where: { id } });
  }
}
