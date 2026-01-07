import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType, CorporateActionType } from '../generated/prisma/client';
import { Decimal } from '../generated/prisma/internal/prismaNamespace';
import { CreateCorporateActionDto } from './dto/corporate-action.dto';

@Injectable()
export class CorporateActionsService {
  private readonly logger = new Logger(CorporateActionsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new corporate action record
   */
  async createCorporateAction(data: CreateCorporateActionDto) {
    return this.prisma.corporateAction.create({
      data: {
        assetId: data.assetId,
        type: data.type,
        value: new Decimal(data.value),
        executedAt: new Date(data.executedAt),
        description: data.description,
        recordDate: data.recordDate ? new Date(data.recordDate) : undefined,
        exDate: data.exDate ? new Date(data.exDate) : undefined,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : undefined,
      },
      include: { asset: true },
    });
  }

  /**
   * Get a corporate action by ID
   */
  async getCorporateAction(id: number) {
    const action = await this.prisma.corporateAction.findUnique({
      where: { id },
      include: { asset: true },
    });

    if (!action) {
      throw new NotFoundException(`Corporate action with ID ${id} not found`);
    }

    return action;
  }

  /**
   * Get corporate actions for an asset
   */
  async getAssetCorporateActions(assetId: number) {
    return this.prisma.corporateAction.findMany({
      where: { assetId },
      orderBy: { executedAt: 'desc' },
      include: {
        asset: {
          select: { id: true, symbol: true, name: true },
        },
      },
    });
  }

  /**
   * Get all corporate actions
   */
  async getAllCorporateActions(options?: {
    type?: CorporateActionType;
    isProcessed?: boolean;
    limit?: number;
  }) {
    return this.prisma.corporateAction.findMany({
      where: {
        type: options?.type,
        isProcessed: options?.isProcessed,
      },
      orderBy: { executedAt: 'desc' },
      take: options?.limit,
      include: {
        asset: {
          select: { id: true, symbol: true, name: true },
        },
      },
    });
  }

  /**
   * Get upcoming corporate actions (next 30 days)
   */
  async getUpcomingActions() {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return this.prisma.corporateAction.findMany({
      where: {
        OR: [
          { executedAt: { gte: new Date(), lte: thirtyDaysFromNow } },
          { paymentDate: { gte: new Date(), lte: thirtyDaysFromNow } },
        ],
      },
      include: {
        asset: {
          select: { id: true, symbol: true, name: true },
        },
      },
      orderBy: { executedAt: 'asc' },
    });
  }

  /**
   * Get unprocessed corporate actions
   */
  async getUnprocessedActions() {
    return this.prisma.corporateAction.findMany({
      where: { isProcessed: false },
      include: {
        asset: {
          select: { id: true, symbol: true, name: true },
        },
      },
      orderBy: { executedAt: 'asc' },
    });
  }

  /**
   * Process a stock split
   * Adjusts all BUY transaction quantities for users holding this asset
   */
  async processSplit(actionId: number): Promise<number> {
    const action = await this.prisma.corporateAction.findUnique({
      where: { id: actionId },
      include: { asset: true },
    });

    if (!action) {
      throw new NotFoundException(`Corporate action ${actionId} not found`);
    }

    if (action.isProcessed) {
      this.logger.warn(`Action ${actionId} already processed`);
      return 0;
    }

    if (
      action.type !== CorporateActionType.SPLIT &&
      action.type !== CorporateActionType.REVERSE_SPLIT
    ) {
      throw new Error(`Action ${actionId} is not a split type`);
    }

    const splitRatio = action.value.toNumber(); // e.g., 4.0 for 4:1 split

    // Find all BUY transactions for this asset before the split date
    const transactions = await this.prisma.transaction.findMany({
      where: {
        assetId: action.assetId,
        type: TransactionType.BUY,
        executedAt: { lt: action.executedAt },
      },
    });

    let updated = 0;
    for (const tx of transactions) {
      // Adjust quantity and price
      const newQuantity = tx.quantity.mul(splitRatio);
      const newPrice = tx.price.div(splitRatio);

      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          quantity: newQuantity,
          price: newPrice,
        },
      });
      updated++;
    }

    // Mark action as processed
    await this.prisma.corporateAction.update({
      where: { id: actionId },
      data: {
        isProcessed: true,
        processedAt: new Date(),
      },
    });

    this.logger.log(
      `Processed ${action.type} for ${action.asset.symbol}: ${updated} transactions adjusted`,
    );

    return updated;
  }

  /**
   * Process a dividend - create dividend transactions for all holders
   */
  async processDividend(actionId: number): Promise<number> {
    const action = await this.prisma.corporateAction.findUnique({
      where: { id: actionId },
      include: { asset: true },
    });

    if (!action) {
      throw new NotFoundException(`Corporate action ${actionId} not found`);
    }

    if (action.isProcessed) {
      this.logger.warn(`Action ${actionId} already processed`);
      return 0;
    }

    if (
      action.type !== CorporateActionType.DIVIDEND &&
      action.type !== CorporateActionType.SPECIAL_DIVIDEND
    ) {
      throw new Error(`Action ${actionId} is not a dividend type`);
    }

    const dividendPerShare = action.value.toNumber();

    // Find all users holding this asset at the record date
    const holdings = await this.calculateHoldingsAtDate(
      action.assetId,
      action.recordDate || action.executedAt,
    );

    let created = 0;
    for (const holding of holdings) {
      if (holding.quantity > 0) {
        // Create dividend transaction
        await this.prisma.transaction.create({
          data: {
            accountId: holding.accountId,
            assetId: action.assetId,
            type: TransactionType.DIVIDEND,
            quantity: new Decimal(holding.quantity),
            price: new Decimal(dividendPerShare),
            currency: action.asset.currency,
            executedAt: action.paymentDate || action.executedAt,
          },
        });
        created++;
      }
    }

    // Mark action as processed
    await this.prisma.corporateAction.update({
      where: { id: actionId },
      data: {
        isProcessed: true,
        processedAt: new Date(),
      },
    });

    this.logger.log(
      `Processed dividend for ${action.asset.symbol}: ${created} transactions created`,
    );

    return created;
  }

  /**
   * Process any corporate action based on its type
   */
  async processAction(actionId: number): Promise<number> {
    const action = await this.prisma.corporateAction.findUnique({
      where: { id: actionId },
    });

    if (!action) {
      throw new NotFoundException(`Corporate action ${actionId} not found`);
    }

    switch (action.type) {
      case CorporateActionType.SPLIT:
      case CorporateActionType.REVERSE_SPLIT:
        return this.processSplit(actionId);
      case CorporateActionType.DIVIDEND:
      case CorporateActionType.SPECIAL_DIVIDEND:
        return this.processDividend(actionId);
      default:
        this.logger.warn(
          `Unsupported corporate action type: ${action.type}. Marking as processed.`,
        );
        await this.prisma.corporateAction.update({
          where: { id: actionId },
          data: {
            isProcessed: true,
            processedAt: new Date(),
          },
        });
        return 0;
    }
  }

  /**
   * Calculate holdings for an asset at a specific date
   */
  private async calculateHoldingsAtDate(
    assetId: number,
    date: Date,
  ): Promise<Array<{ accountId: number; quantity: number }>> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        assetId,
        executedAt: { lte: date },
        type: { in: [TransactionType.BUY, TransactionType.SELL] },
      },
      orderBy: { executedAt: 'asc' },
    });

    const holdingsByAccount = new Map<number, Decimal>();

    for (const tx of transactions) {
      const current = holdingsByAccount.get(tx.accountId) || new Decimal(0);

      if (tx.type === TransactionType.BUY) {
        holdingsByAccount.set(tx.accountId, current.add(tx.quantity));
      } else {
        holdingsByAccount.set(tx.accountId, current.sub(tx.quantity));
      }
    }

    return Array.from(holdingsByAccount.entries()).map(
      ([accountId, quantity]) => ({
        accountId,
        quantity: quantity.toNumber(),
      }),
    );
  }
}
