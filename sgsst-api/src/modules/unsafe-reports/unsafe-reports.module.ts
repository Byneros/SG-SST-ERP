import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SitesModule } from '../sites/sites.module';
import { UnsafeReportsController } from './unsafe-reports.controller';
import { UnsafeReportsRepository } from './unsafe-reports.repository';
import { UnsafeReportsService } from './unsafe-reports.service';

@Module({
  imports: [AuditModule, SitesModule],
  controllers: [UnsafeReportsController],
  providers: [UnsafeReportsService, UnsafeReportsRepository],
})
export class UnsafeReportsModule {}
