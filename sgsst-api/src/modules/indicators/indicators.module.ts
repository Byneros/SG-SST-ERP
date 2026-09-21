import { Module } from '@nestjs/common';
import { CompanyScopeService } from '../../common/company/company-scope.service';
import { IndicatorsController } from './indicators.controller';
import { IndicatorsService } from './indicators.service';

@Module({
  controllers: [IndicatorsController],
  providers: [IndicatorsService, CompanyScopeService],
  exports: [IndicatorsService],
})
export class IndicatorsModule {}
