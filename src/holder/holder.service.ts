import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from 'generated/prisma/enums';

@Injectable()
export class HolderService {
  constructor(private prisma: PrismaService) {}

  // 1. Create a Transaction
  async addTransaction(data: {
    accountId: number;
    assetId: number;
    type: TransactionType;
    quantity: number;
    price: number;
    currency: string;
    executedAt: Date;
  }) {
    return this.prisma.transaction.create({
      data: {
        accountId: data.accountId,
        assetId: data.assetId,
        type: data.type,
        quantity: data.quantity,
        price: data.price,
        currency: data.currency,
        executedAt: data.executedAt,
      },
    });
  }

  // 2. Get Portfolio (Simplified view)
  async getPortfolio(userId: number) {
    // This is where the complex "Snowball Analytics" logic will eventually go
    // For now, let's just fetch accounts and their transactions
    return this.prisma.userBroker.findMany({
      where: { userId },
      include: {
        accounts: {
          include: {
            transactions: {
              include: { asset: true }, // Include asset details
            },
          },
        },
      },
    });
  }
}
