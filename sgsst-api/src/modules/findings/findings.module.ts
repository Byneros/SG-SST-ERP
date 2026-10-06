import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TasksModule } from '../tasks/tasks.module';
import { FindingsController } from './findings.controller';
import { FindingsRepository } from './findings.repository';
import { FindingsService } from './findings.service';

@Module({
  imports: [AuditModule, TasksModule],
  controllers: [FindingsController],
  providers: [FindingsService, FindingsRepository],
})
export class FindingsModule {}
