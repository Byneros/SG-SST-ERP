import { Module } from '@nestjs/common';
import { TrainingsController } from './trainings.controller';
import { SitesModule } from '../sites/sites.module';
import { DocumentsModule } from '../documents/documents.module';
import { TrainingsService } from './trainings.service';
import { TrainingsRepository } from './trainings.repository';

@Module({
  imports: [SitesModule, DocumentsModule],
  controllers: [TrainingsController],
  providers: [TrainingsService, TrainingsRepository],
})
export class TrainingsModule {}
