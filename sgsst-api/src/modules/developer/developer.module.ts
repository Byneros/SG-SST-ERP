import { Module } from '@nestjs/common';
import { AppService } from '../../app.service';
import { DatabaseModule } from '../../database/database.module';
import { DeveloperController } from './developer.controller';
import { DeveloperService } from './developer.service';
import { ErrorEventsService } from './error-events.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DeveloperController],
  providers: [DeveloperService, AppService, ErrorEventsService],
})
export class DeveloperModule {}
