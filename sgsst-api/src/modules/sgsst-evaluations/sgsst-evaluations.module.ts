import { Module } from '@nestjs/common';
import { CompanyScopeService } from '../../common/company/company-scope.service';
import { SgsstEvaluationsController } from './sgsst-evaluations.controller';
import { SgsstEvaluationsService } from './sgsst-evaluations.service';

@Module({
  controllers: [SgsstEvaluationsController],
  providers: [SgsstEvaluationsService, CompanyScopeService],
  exports: [SgsstEvaluationsService],
})
export class SgsstEvaluationsModule {}
