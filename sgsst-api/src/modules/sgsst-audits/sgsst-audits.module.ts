import { Module } from '@nestjs/common';
import { CompanyScopeService } from '../../common/company/company-scope.service';
import { AuditModule } from '../audit/audit.module';
import { SgsstAuditsController } from './sgsst-audits.controller';
import { SgsstAuditsRepository } from './sgsst-audits.repository';
import { SgsstAuditsService } from './SgsstAuditsService';

@Module({
  imports: [AuditModule],
  controllers: [SgsstAuditsController],
  providers: [SgsstAuditsService, SgsstAuditsRepository, CompanyScopeService],
  exports: [SgsstAuditsService],
})
export class SgsstAuditsModule {}
