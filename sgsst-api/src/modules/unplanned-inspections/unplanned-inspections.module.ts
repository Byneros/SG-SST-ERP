import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SitesModule } from '../sites/sites.module';
import { UsersModule } from '../users/users.module';
import { UnplannedInspectionsController } from './unplanned-inspections.controller';
import { UnplannedInspectionsRepository } from './unplanned-inspections.repository';
import { UnplannedInspectionsService } from './unplanned-inspections.service';

@Module({
  imports: [AuditModule, SitesModule, UsersModule],
  controllers: [UnplannedInspectionsController],
  providers: [UnplannedInspectionsService, UnplannedInspectionsRepository],
})
export class UnplannedInspectionsModule {}
