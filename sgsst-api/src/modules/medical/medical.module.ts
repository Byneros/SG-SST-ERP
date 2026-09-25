import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MedicalController } from './medical.controller';
import { MedicalService } from './medical.service';

@Module({
  imports: [AuditModule],
  controllers: [MedicalController],
  providers: [MedicalService],
})
export class MedicalModule {}
