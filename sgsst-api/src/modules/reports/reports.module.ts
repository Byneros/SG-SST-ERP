import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsQueueService } from './reports-queue.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [DocumentsModule, NotificationsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsQueueService],
})
export class ReportsModule {}
