import { Module } from '@nestjs/common';
import { CorporateActionsService } from './corporate-actions.service';
import { CorporateActionsController } from './corporate-actions.controller';

@Module({
  controllers: [CorporateActionsController],
  providers: [CorporateActionsService],
  exports: [CorporateActionsService],
})
export class CorporateActionsModule {}
