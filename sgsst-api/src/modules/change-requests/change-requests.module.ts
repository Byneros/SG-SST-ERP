import { Module } from '@nestjs/common';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsRepository } from './change-requests.repository';
import { ChangeRequestsService } from './change-requests.service';

@Module({
  controllers: [ChangeRequestsController],
  providers: [ChangeRequestsService, ChangeRequestsRepository],
  exports: [ChangeRequestsService],
})
export class ChangeRequestsModule {}
