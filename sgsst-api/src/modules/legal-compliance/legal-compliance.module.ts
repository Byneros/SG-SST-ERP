import { Module } from '@nestjs/common';
import { LegalComplianceController } from './legal-compliance.controller';
import { LegalComplianceService } from './legal-compliance.service';

@Module({
  controllers: [LegalComplianceController],
  providers: [LegalComplianceService],
})
export class LegalComplianceModule {}
