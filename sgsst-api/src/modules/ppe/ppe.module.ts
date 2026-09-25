import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PpeController } from './ppe.controller';
import { PpeRepository } from './ppe.repository';
import { PpeService } from './ppe.service';

@Module({
  imports: [AuditModule],
  controllers: [PpeController],
  providers: [PpeService, PpeRepository],
})
export class PpeModule {}
