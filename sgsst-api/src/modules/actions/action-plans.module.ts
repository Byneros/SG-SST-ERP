import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ActionPlansController } from './action-plans.controller';
import { ActionPlansRepository } from './action-plans.repository';
import { ActionPlansService } from './action-plans.service';

@Module({
  imports: [AuditModule],
  controllers: [ActionPlansController],
  providers: [ActionPlansService, ActionPlansRepository],
})
export class ActionPlansModule {}
