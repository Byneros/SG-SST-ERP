import { Module } from '@nestjs/common';
import { SitesModule } from '../sites/sites.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsRepository } from './incidents.repository';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [SitesModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentsRepository],
})
export class IncidentsModule {}
