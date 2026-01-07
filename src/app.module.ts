// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { BrokersModule } from './brokers/brokers.module';
import { AccountsModule } from './accounts/accounts.module';
import { AssetsModule } from './assets/assets.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WatchlistsModule } from './watchlists/watchlists.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { YahooFinanceModule } from './yahoo-finance/yahoo-finance.module';
import { CacheModule } from './cache/cache.module';
import { PriceCacheModule } from './price-cache/price-cache.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { CorporateActionsModule } from './corporate-actions/corporate-actions.module';
import { AssetEnrichmentModule } from './asset-enrichment/asset-enrichment.module';
import { auth } from './auth/auth';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Rate limiting: 100 requests per minute per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute in milliseconds
        limit: 100, // 100 requests per minute
      },
    ]),
    // Express 5 fix: The /*path pattern sets req.url=/ and req.baseUrl=full_path
    // better-call concatenates baseUrl+url creating a trailing slash that causes 404
    // This middleware restores req.url to the full path before the handler runs
    AuthModule.forRoot({
      auth,
      middleware: (req, _res, next) => {
        req.url = req.originalUrl;
        req.baseUrl = '';
        next();
      },
    }),
    // Global caching with Redis
    CacheModule,
    PrismaModule,
    UsersModule,
    BrokersModule,
    AccountsModule,
    AssetsModule,
    TransactionsModule,
    WatchlistsModule,
    PortfolioModule,
    YahooFinanceModule,
    // Phase 4: Data Management & Caching
    PriceCacheModule,
    CorporateActionsModule,
    AssetEnrichmentModule,
    SchedulerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
