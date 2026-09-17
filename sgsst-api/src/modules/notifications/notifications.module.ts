import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsQueueService } from './notifications-queue.service';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './whatsapp.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsQueueService, EmailService, WhatsAppService],
  exports: [NotificationsService, NotificationsQueueService],
})
export class NotificationsModule {}
