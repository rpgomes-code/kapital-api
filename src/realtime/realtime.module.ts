// src/realtime/realtime.module.ts
import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { YahooFinanceModule } from '../yahoo-finance/yahoo-finance.module';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
  imports: [YahooFinanceModule, PortfolioModule],
  providers: [RealtimeGateway, RealtimeService, WsAuthGuard],
  exports: [RealtimeService],
})
export class RealtimeModule {}
