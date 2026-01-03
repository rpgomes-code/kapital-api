import { Module } from '@nestjs/common';
import { StonksController } from './stonks.controller';
import { StonksService } from './stonks.service';

@Module({
  controllers: [StonksController],
  providers: [StonksService]
})
export class StonksModule {}
