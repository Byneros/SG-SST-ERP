import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SitesModule } from '../sites/sites.module';
import { UsersModule } from '../users/users.module';
import { PlannedInspectionsController } from './planned-inspections.controller';
import { PlannedInspectionsRepository } from './planned-inspections.repository';
import { PlannedInspectionsService } from './planned-inspections.service';

@Module({
  imports: [AuditModule, SitesModule, UsersModule],
  controllers: [PlannedInspectionsController],
  providers: [PlannedInspectionsService, PlannedInspectionsRepository],
})
export class PlannedInspectionsModule {}
