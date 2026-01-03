import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { StonksModule } from './stonks/stonks.module';
import { HolderModule } from './holder/holder.module';
import { UsersModule } from './users/users.module';
import { BrokersModule } from './brokers/brokers.module';
import { AccountsModule } from './accounts/accounts.module';
import { AssetsModule } from './assets/assets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WatchlistsModule } from './watchlists/watchlists.module';
import { PortfolioModule } from './portfolio/portfolio.module';

@Module({
  imports: [
    PrismaModule,
    StonksModule,
    HolderModule,
    UsersModule,
    BrokersModule,
    AccountsModule,
    AssetsModule,
    TransactionsModule,
    WatchlistsModule,
    PortfolioModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
