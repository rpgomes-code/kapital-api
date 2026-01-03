// src/accounts/accounts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: dto,
      include: {
        userBroker: {
          include: {
            broker: true,
          },
        },
      },
    });
  }

  async findAllByUser(userId: number) {
    return this.prisma.account.findMany({
      where: {
        userBroker: {
          userId,
        },
      },
      include: {
        userBroker: {
          include: {
            broker: true,
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        userBroker: {
          include: {
            broker: true,
            user: {
              select: {
                id: true,
                publicId: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async getAccountSummary(accountId: number) {
    const account = await this.findOne(accountId);

    // Get all transactions for this account
    const transactions = await this.prisma.transaction.findMany({
      where: { accountId },
      include: {
        asset: true,
      },
    });

    // Calculate holdings
    const holdings = new Map<
      number,
      {
        asset: any;
        quantity: Decimal;
        avgCost: Decimal;
        totalCost: Decimal;
      }
    >();

    for (const tx of transactions) {
      const existing = holdings.get(tx.assetId);

      if (tx.type === 'BUY') {
        if (existing) {
          const newQuantity = existing.quantity.add(tx.quantity);
          const newTotalCost = existing.totalCost.add(
            tx.quantity.mul(tx.price),
          );
          existing.quantity = newQuantity;
          existing.totalCost = newTotalCost;
          existing.avgCost = newTotalCost.div(newQuantity);
        } else {
          holdings.set(tx.assetId, {
            asset: tx.asset,
            quantity: tx.quantity,
            avgCost: tx.price,
            totalCost: tx.quantity.mul(tx.price),
          });
        }
      } else if (tx.type === 'SELL') {
        if (existing) {
          existing.quantity = existing.quantity.sub(tx.quantity);
          // Keep avg cost the same for simplified calculation
        }
      }
    }

    // Filter out fully sold positions
    const activeHoldings = Array.from(holdings.values())
      .filter((h) => h.quantity.gt(0))
      .map((h) => ({
        asset: {
          id: h.asset.id,
          publicId: h.asset.publicId,
          symbol: h.asset.symbol,
          name: h.asset.name,
          assetType: h.asset.assetType,
          currency: h.asset.currency,
        },
        quantity: h.quantity.toNumber(),
        avgCost: h.avgCost.toNumber(),
        totalCost: h.totalCost.toNumber(),
      }));

    // Calculate total dividends
    const dividends = transactions
      .filter((tx) => tx.type === 'DIVIDEND')
      .reduce((sum, tx) => sum.add(tx.quantity.mul(tx.price)), new Decimal(0));

    // Calculate total fees and taxes
    const totalFees = transactions.reduce(
      (sum, tx) => sum.add(tx.fee || new Decimal(0)),
      new Decimal(0),
    );
    const totalTaxes = transactions.reduce(
      (sum, tx) => sum.add(tx.tax || new Decimal(0)),
      new Decimal(0),
    );

    return {
      account: {
        id: account.id,
        publicId: account.publicId,
        name: account.name,
        currency: account.currency,
        broker: account.userBroker.broker,
      },
      summary: {
        holdingsCount: activeHoldings.length,
        totalDividends: dividends.toNumber(),
        totalFees: totalFees.toNumber(),
        totalTaxes: totalTaxes.toNumber(),
        transactionCount: transactions.length,
      },
      holdings: activeHoldings,
    };
  }

  async update(id: number, dto: UpdateAccountDto) {
    await this.findOne(id);

    return this.prisma.account.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    // Check if account has transactions
    const transactionCount = await this.prisma.transaction.count({
      where: { accountId: id },
    });

    if (transactionCount > 0) {
      throw new Error(
        `Cannot delete account with ${transactionCount} transactions. Delete transactions first.`,
      );
    }

    return this.prisma.account.delete({
      where: { id },
    });
  }
}
