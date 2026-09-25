import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AnnualPlanActivitiesController } from './annual-plan-activities.controller';
import { AnnualPlanActivitiesRepository } from './annual-plan-activities.repository';
import { AnnualPlanActivitiesService } from './annual-plan-activities.service';
import { AnnualWorkPlansController } from './annual-work-plans.controller';
import { AnnualWorkPlansRepository } from './annual-work-plans.repository';
import { AnnualWorkPlansService } from './annual-work-plans.service';

@Module({
  imports: [AuditModule],
  controllers: [AnnualWorkPlansController, AnnualPlanActivitiesController],
  providers: [
    AnnualWorkPlansService,
    AnnualWorkPlansRepository,
    AnnualPlanActivitiesService,
    AnnualPlanActivitiesRepository,
  ],
})
export class AnnualWorkPlansModule {}
