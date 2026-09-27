import { Module } from '@nestjs/common';
import { CompaniesRepository } from '../companies/companies.repository';
import { EmployeesRepository } from '../employees/employees.repository';
import { IncidentsRepository } from '../incidents/incidents.repository';
import { RisksRepository } from '../risks/risks.repository';
import { SitesRepository } from '../sites/sites.repository';
import { TrainingsRepository } from '../trainings/trainings.repository';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantTools } from './ai-assistant.tools';
import { AiProviderClient } from './ai-provider.client';

@Module({
  controllers: [AiAssistantController],
  // Los repositorios leen via PrismaService (global). Se proveen aqui para no
  // acoplar el asistente a los controladores/servicios de otros modulos.
  providers: [
    AiAssistantService,
    AiAssistantTools,
    AiProviderClient,
    CompaniesRepository,
    SitesRepository,
    EmployeesRepository,
    RisksRepository,
    IncidentsRepository,
    TrainingsRepository,
  ],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
