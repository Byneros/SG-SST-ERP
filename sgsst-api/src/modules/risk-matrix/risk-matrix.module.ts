import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SitesModule } from '../sites/sites.module';
import { RiskMatrixController } from './risk-matrix.controller';
import { RiskMatrixRepository } from './risk-matrix.repository';
import { RiskMatrixService } from './risk-matrix.service';

@Module({
  imports: [AuditModule, SitesModule],
  controllers: [RiskMatrixController],
  providers: [RiskMatrixService, RiskMatrixRepository],
})
export class RiskMatrixModule {}
