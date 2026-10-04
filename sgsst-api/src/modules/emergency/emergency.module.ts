import { Module } from '@nestjs/common';
import {
  EmergencyBrigadesController,
  EmergencyDrillsController,
  EmergencyPlansController,
} from './emergency.controller';
import { EmergencyRepository } from './emergency.repository';
import { EmergencyService } from './emergency.service';

@Module({
  controllers: [
    EmergencyBrigadesController,
    EmergencyPlansController,
    EmergencyDrillsController,
  ],
  providers: [EmergencyService, EmergencyRepository],
})
export class EmergencyModule {}
