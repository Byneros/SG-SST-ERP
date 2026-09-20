import { Module } from '@nestjs/common';
import { SitesModule } from '../sites/sites.module';
import { RisksController } from './risks.controller';
import { RisksRepository } from './risks.repository';
import { RisksService } from './risks.service';

@Module({
  imports: [SitesModule],
  controllers: [RisksController],
  providers: [RisksService, RisksRepository],
})
export class RisksModule {}
