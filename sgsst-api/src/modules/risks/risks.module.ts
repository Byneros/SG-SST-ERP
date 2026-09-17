import { Module } from '@nestjs/common';
import { RisksController } from './risks.controller';
import { RisksRepository } from './risks.repository';
import { RisksService } from './risks.service';

@Module({
  controllers: [RisksController],
  providers: [RisksService, RisksRepository],
})
export class RisksModule {}
