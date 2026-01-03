// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { BrokersModule } from './brokers/brokers.module';
import { AccountsModule } from './accounts/accounts.module';
import { AssetsModule } from './assets/assets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WatchlistsModule } from './watchlists/watchlists.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { YahooFinanceModule } from './yahoo-finance/yahoo-finance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    BrokersModule,
    AccountsModule,
    AssetsModule,
    TransactionsModule,
    WatchlistsModule,
    PortfolioModule,
    YahooFinanceModule,
  ],
})
export class AppModule {}
