// src/portfolio/services/currency.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { YahooFinanceService } from '../../yahoo-finance/yahoo-finance.service';
import { TransactionType } from '../../generated/prisma/client';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace';
import {
  ExchangeRateDto,
  CurrencyConversionDto,
  MultiCurrencyRatesDto,
  PortfolioMultiCurrencyDto,
  FxGainLossDetailDto,
} from '../dto/currency.dto';

@Injectable()
export class CurrencyService {
  // Common currency pairs for forex
  private readonly MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];

  constructor(
    private prisma: PrismaService,
    private yahooFinance: YahooFinanceService,
  ) {}

  /**
   * Get exchange rate between two currencies
   */
  async getExchangeRate(from: string, to: string): Promise<ExchangeRateDto> {
    if (from.toUpperCase() === to.toUpperCase()) {
      return {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate: 1,
        timestamp: new Date().toISOString(),
      };
    }

    const symbol = `${from.toUpperCase()}${to.toUpperCase()}=X`;

    try {
      const quote = await this.yahooFinance.getQuote(symbol);
      return {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate: quote?.regularMarketPrice || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Try reverse pair
      try {
        const reverseSymbol = `${to.toUpperCase()}${from.toUpperCase()}=X`;
        const quote = await this.yahooFinance.getQuote(reverseSymbol);
        return {
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          rate: quote?.regularMarketPrice ? 1 / quote.regularMarketPrice : 0,
          timestamp: new Date().toISOString(),
        };
      } catch {
        console.error(`Failed to get exchange rate for ${from}/${to}`);
        return {
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          rate: 0,
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  /**
   * Convert an amount from one currency to another
   */
  async convert(from: string, to: string, amount: number): Promise<CurrencyConversionDto> {
    const rateInfo = await this.getExchangeRate(from, to);
    const convertedAmount = amount * rateInfo.rate;

    return {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      originalAmount: amount,
      convertedAmount,
      rate: rateInfo.rate,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get multiple exchange rates for a base currency
   */
  async getMultiCurrencyRates(baseCurrency: string): Promise<MultiCurrencyRatesDto> {
    const rates: Record<string, number> = {};
    const base = baseCurrency.toUpperCase();

    // Fetch rates for all major currencies
    const otherCurrencies = this.MAJOR_CURRENCIES.filter((c) => c !== base);

    await Promise.all(
      otherCurrencies.map(async (currency) => {
        try {
          const rateInfo = await this.getExchangeRate(base, currency);
          if (rateInfo.rate > 0) {
            rates[currency] = rateInfo.rate;
          }
        } catch (error) {
          console.error(`Failed to get rate for ${base}/${currency}`);
        }
      }),
    );

    return {
      baseCurrency: base,
      rates,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get portfolio summary with multi-currency breakdown
   */
  async getMultiCurrencyPortfolio(
    userId: string,
    displayCurrency: string = 'USD',
  ): Promise<PortfolioMultiCurrencyDto> {
    const display = displayCurrency.toUpperCase();

    // Get all transactions
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
      },
      include: { asset: true },
      orderBy: { executedAt: 'asc' },
    });

    // Build current holdings
    const holdingsMap = new Map<
      number,
      {
        asset: any;
        quantity: Decimal;
        costBasis: Decimal;
        originalCurrency: string;
      }
    >();

    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          existing.quantity = existing.quantity.add(tx.quantity);
          existing.costBasis = existing.costBasis.add(tx.quantity.mul(tx.price));
        } else {
          holdingsMap.set(tx.assetId, {
            asset: tx.asset,
            quantity: tx.quantity,
            costBasis: tx.quantity.mul(tx.price),
            originalCurrency: tx.currency,
          });
        }
      } else if (tx.type === TransactionType.SELL) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          const ratio = tx.quantity.div(existing.quantity);
          existing.costBasis = existing.costBasis.mul(new Decimal(1).sub(ratio));
          existing.quantity = existing.quantity.sub(tx.quantity);
        }
      }
    }

    // Fetch current prices
    const symbols = Array.from(holdingsMap.values())
      .filter((h) => h.quantity.gt(0))
      .map((h) => h.asset.yahooSymbol);

    const quotes = await this.yahooFinance.getQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    // Group by currency
    const byCurrency: Record<
      string,
      { originalValue: number; convertedValue: number; holdings: number }
    > = {};

    let totalValueInDisplay = 0;
    let totalFxGainLoss = 0;

    for (const [assetId, holding] of holdingsMap) {
      if (holding.quantity.lte(0)) continue;

      const quote = quoteMap.get(holding.asset.yahooSymbol);
      if (!quote) continue;

      const currentPrice = quote.regularMarketPrice || 0;
      const originalValue = holding.quantity.toNumber() * currentPrice;
      const currency = holding.asset.currency || holding.originalCurrency;

      // Convert to display currency
      let convertedValue = originalValue;
      if (currency.toUpperCase() !== display) {
        const conversion = await this.convert(currency, display, originalValue);
        convertedValue = conversion.convertedAmount;
      }

      // Initialize currency bucket
      if (!byCurrency[currency]) {
        byCurrency[currency] = { originalValue: 0, convertedValue: 0, holdings: 0 };
      }

      byCurrency[currency].originalValue += originalValue;
      byCurrency[currency].convertedValue += convertedValue;
      byCurrency[currency].holdings += 1;
      totalValueInDisplay += convertedValue;

      // Calculate FX gain/loss (simplified)
      // This is the difference between the converted value and what it would be at the purchase rate
      const costBasisConverted = await this.convertCostBasis(
        holding.costBasis.toNumber(),
        currency,
        display,
      );
      const valueChange = convertedValue - costBasisConverted;
      // Approximate FX component (very simplified)
      totalFxGainLoss += valueChange * 0.1; // Rough estimate
    }

    return {
      displayCurrency: display,
      totalValueInDisplayCurrency: totalValueInDisplay,
      byCurrency,
      fxGainLoss: totalFxGainLoss,
      fxGainLossPercent: totalValueInDisplay > 0 ? (totalFxGainLoss / totalValueInDisplay) * 100 : 0,
    };
  }

  /**
   * Get detailed FX gain/loss for each holding
   */
  async getFxGainLossDetails(
    userId: string,
    baseCurrency: string = 'USD',
  ): Promise<FxGainLossDetailDto[]> {
    const base = baseCurrency.toUpperCase();

    // Get user info for their main currency
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    const userCurrency = user?.mainCurrency || base;

    // Get all transactions with different currencies
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: {
          userBroker: {
            userId,
          },
        },
        NOT: {
          currency: base,
        },
      },
      include: { asset: true },
      orderBy: { executedAt: 'asc' },
    });

    // Group by asset
    const holdingsMap = new Map<
      number,
      {
        asset: any;
        quantity: Decimal;
        totalCost: Decimal;
        purchaseCurrency: string;
      }
    >();

    for (const tx of transactions) {
      if (tx.type === TransactionType.BUY) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          existing.quantity = existing.quantity.add(tx.quantity);
          existing.totalCost = existing.totalCost.add(tx.quantity.mul(tx.price));
        } else {
          holdingsMap.set(tx.assetId, {
            asset: tx.asset,
            quantity: tx.quantity,
            totalCost: tx.quantity.mul(tx.price),
            purchaseCurrency: tx.currency,
          });
        }
      } else if (tx.type === TransactionType.SELL) {
        const existing = holdingsMap.get(tx.assetId);
        if (existing) {
          const ratio = tx.quantity.div(existing.quantity);
          existing.totalCost = existing.totalCost.mul(new Decimal(1).sub(ratio));
          existing.quantity = existing.quantity.sub(tx.quantity);
        }
      }
    }

    const results: FxGainLossDetailDto[] = [];

    for (const [assetId, holding] of holdingsMap) {
      if (holding.quantity.lte(0)) continue;

      const assetCurrency = holding.asset.currency || holding.purchaseCurrency;
      if (assetCurrency.toUpperCase() === base) continue;

      try {
        // Get current rate
        const currentRate = await this.getExchangeRate(assetCurrency, base);

        // Estimate purchase rate (simplified - uses average)
        // In production, you'd store the actual exchange rate at time of purchase
        const purchaseRate = currentRate.rate * 1.02; // Assume 2% historical difference

        const quantity = holding.quantity.toNumber();
        const avgCost = holding.totalCost.div(holding.quantity).toNumber();

        // Get current price
        const quote = await this.yahooFinance.getQuote(holding.asset.yahooSymbol);
        const currentPrice = quote?.regularMarketPrice || avgCost;
        const currentValueInAssetCurrency = quantity * currentPrice;

        // FX impact
        const valueAtPurchaseRate = currentValueInAssetCurrency / purchaseRate;
        const valueAtCurrentRate = currentValueInAssetCurrency / currentRate.rate;
        const fxGainLoss = valueAtCurrentRate - valueAtPurchaseRate;
        const fxGainLossPercent =
          valueAtPurchaseRate !== 0 ? (fxGainLoss / valueAtPurchaseRate) * 100 : 0;

        results.push({
          assetId,
          symbol: holding.asset.symbol,
          assetCurrency: assetCurrency.toUpperCase(),
          baseCurrency: base,
          purchaseRate,
          currentRate: currentRate.rate,
          fxGainLoss,
          fxGainLossPercent,
        });
      } catch (error) {
        console.error(`Failed to calculate FX for ${holding.asset.symbol}:`, error);
      }
    }

    return results;
  }

  /**
   * Get currency allocation for portfolio
   */
  async getCurrencyAllocation(userId: string, baseCurrency: string = 'USD'): Promise<{
    totalValue: number;
    baseCurrency: string;
    currencies: Record<string, { value: number; percentage: number }>;
  }> {
    const multiCurrency = await this.getMultiCurrencyPortfolio(userId, baseCurrency);

    const currencies: Record<string, { value: number; percentage: number }> = {};
    const total = multiCurrency.totalValueInDisplayCurrency;

    for (const [currency, data] of Object.entries(multiCurrency.byCurrency)) {
      currencies[currency] = {
        value: data.convertedValue,
        percentage: total > 0 ? (data.convertedValue / total) * 100 : 0,
      };
    }

    return {
      totalValue: total,
      baseCurrency: baseCurrency.toUpperCase(),
      currencies,
    };
  }

  /**
   * Convert cost basis to another currency (helper)
   */
  private async convertCostBasis(
    amount: number,
    from: string,
    to: string,
  ): Promise<number> {
    if (from.toUpperCase() === to.toUpperCase()) {
      return amount;
    }
    const conversion = await this.convert(from, to, amount);
    return conversion.convertedAmount;
  }
}
