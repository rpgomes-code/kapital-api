import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { StonksModule } from './stonks/stonks.module';
import { HolderModule } from './holder/holder.module';

@Module({
  imports: [PrismaModule, StonksModule, HolderModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
