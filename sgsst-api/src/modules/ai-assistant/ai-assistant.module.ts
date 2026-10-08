import { Module } from '@nestjs/common';
import { CompaniesRepository } from '../companies/companies.repository';
import { EmployeesRepository } from '../employees/employees.repository';
import { IncidentsRepository } from '../incidents/incidents.repository';
import { UnsafeReportsRepository } from '../unsafe-reports/unsafe-reports.repository';
import { FindingsRepository } from '../findings/findings.repository';
import { ActionPlansRepository } from '../actions/action-plans.repository';
import { TrainingsRepository } from '../trainings/trainings.repository';
import { MedicalAssistantRepository } from '../medical/medical.repository';
import { PpeRepository } from '../ppe/ppe.repository';
import { RisksRepository } from '../risks/risks.repository';
import { SitesRepository } from '../sites/sites.repository';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AssistantRegistry } from './assistant-registry';
import { AiAssistantTools } from './ai-assistant.tools';
import { AiProviderClient } from './ai-provider.client';

@Module({
  controllers: [AiAssistantController],
  // Los repositorios leen via PrismaService (global). Se proveen aqui para no
  // acoplar el asistente a los controladores/servicios de otros modulos.
  providers: [
    AiAssistantService,
    AssistantRegistry,
    AiAssistantTools,
    AiProviderClient,
    CompaniesRepository,
    SitesRepository,
    EmployeesRepository,
    RisksRepository,
    IncidentsRepository,
    UnsafeReportsRepository,
    FindingsRepository,
    ActionPlansRepository,
    TrainingsRepository,
    MedicalAssistantRepository,
    PpeRepository,
  ],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
