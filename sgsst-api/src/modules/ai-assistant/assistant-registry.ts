import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import {
  canInvokeTool,
  canUseAssistant,
  validateToolParams,
  type AssistantDefinition,
  type AssistantToolDefinition,
  type ToolContext,
} from './ai-assistant.framework';
import { AiAssistantTools } from './ai-assistant.tools';
import { createCentralAssistant } from './assistants/central.assistant';
import { createRisksAssistant } from './assistants/risks.assistant';
import { createIncidentsAssistant } from './assistants/incidents.assistant';
import { createFindingsAssistant } from './assistants/findings.assistant';
import { createTrainingsAssistant } from './assistants/trainings.assistant';
import { createMedicalAssistant } from './assistants/medical.assistant';
import { createPpeAssistant } from './assistants/ppe.assistant';
import { createContractorsAssistant } from './assistants/contractors.assistant';
import { createCommitteesAssistant } from './assistants/committees.assistant';
import { createEmergencyAssistant } from './assistants/emergency.assistant';
import { createAuditAssistant } from './assistants/audit.assistant';
import { createIndicatorsAssistant } from './assistants/indicators.assistant';
import { createDocumentsAssistant } from './assistants/documents.assistant';
// Import de VALOR (no `import type`): Nest emite design:paramtypes desde los
// metadatos de compilacion y `import type` se borra, dejando `Object` en el
// indice y rompiendo la resolucion de dependencias al arrancar la app.
import { RisksRepository } from '../risks/risks.repository';
import { IncidentsRepository } from '../incidents/incidents.repository';
import { UnsafeReportsRepository } from '../unsafe-reports/unsafe-reports.repository';
import { FindingsRepository } from '../findings/findings.repository';
import { ActionPlansRepository } from '../actions/action-plans.repository';
import { TrainingsRepository } from '../trainings/trainings.repository';
import { MedicalAssistantRepository } from '../medical/medical.repository';
import { PpeRepository } from '../ppe/ppe.repository';
import { ContractorsRepository } from '../contractors/contractors.repository';
import { CommitteesRepository } from '../committees/committees.repository';
import { EmergencyRepository } from '../emergency/emergency.repository';
import { SgsstAuditsRepository } from '../sgsst-audits/sgsst-audits.repository';
import { AnnualWorkPlansRepository } from '../annual-work-plans/annual-work-plans.repository';
import { AnnualPlanActivitiesRepository } from '../annual-work-plans/annual-plan-activities.repository';
import { PrismaService } from '../../database/prisma.service';

/**
 * Registro de asistentes + orquestador minimo (Fase C).
 *
 * - El registro es declarativo: agregar un asistente = crear su archivo de
 *   definicion y anadirlo a buildRegistry(). El router/service no cambian.
 * - runAssistant() aplica el orden de seguridad del §6 del plan:
 *   rol de asistente -> whitelist de herramienta -> params -> ToolContext.
 * - En esta fase solo existe 'central'; las fases E+ anaden definiciones.
 */
@Injectable()
export class AssistantRegistry {
  private readonly registry: AssistantDefinition[];

  constructor(
    private readonly legacyTools: AiAssistantTools,
    private readonly risksRepository?: RisksRepository,
    private readonly incidentsRepository?: IncidentsRepository,
    private readonly unsafeReportsRepository?: UnsafeReportsRepository,
    private readonly findingsRepository?: FindingsRepository,
    private readonly actionPlansRepository?: ActionPlansRepository,
    private readonly trainingsRepository?: TrainingsRepository,
    private readonly medicalAssistantRepository?: MedicalAssistantRepository,
    private readonly ppeRepository?: PpeRepository,
    private readonly contractorsRepository?: ContractorsRepository,
    private readonly committeesRepository?: CommitteesRepository,
    private readonly emergencyRepository?: EmergencyRepository,
    private readonly sgsstAuditsRepository?: SgsstAuditsRepository,
    private readonly annualWorkPlansRepository?: AnnualWorkPlansRepository,
    private readonly annualPlanActivitiesRepository?: AnnualPlanActivitiesRepository,
    private readonly prisma?: PrismaService,
  ) {
    this.registry = [
      createCentralAssistant(legacyTools),
      // Fase E: asistente especializado de riesgos (opcional para no romper
      // los tests que construyen el registro solo con las tools legacy).
      ...(risksRepository ? [createRisksAssistant(risksRepository)] : []),
      // Fase F: asistente de incidentes y reportes inseguros.
      ...(incidentsRepository && unsafeReportsRepository
        ? [
            createIncidentsAssistant(
              incidentsRepository,
              unsafeReportsRepository,
            ),
          ]
        : []),
      // Fase G: asistente de hallazgos unificados y planes de accion.
      ...(findingsRepository && actionPlansRepository
        ? [createFindingsAssistant(findingsRepository, actionPlansRepository)]
        : []),
      // Fase H1: asistente de capacitaciones.
      ...(trainingsRepository
        ? [createTrainingsAssistant(trainingsRepository)]
        : []),
      // Fase H2: asistente de medicina laboral (solo agregaciones).
      ...(medicalAssistantRepository
        ? [createMedicalAssistant(medicalAssistantRepository)]
        : []),
      // Fase H3: asistente de EPP (inventario y reposiciones).
      ...(ppeRepository ? [createPpeAssistant(ppeRepository)] : []),
      // Fase I1: asistente de contratistas (documentos y flujo de ingreso).
      ...(contractorsRepository
        ? [createContractorsAssistant(contractorsRepository)]
        : []),
      // Fase I2: asistente de comites (COPASST/Convivencia y compromisos).
      ...(committeesRepository
        ? [createCommitteesAssistant(committeesRepository)]
        : []),
      // Fase I3: asistente de emergencias (brigadas y simulacros).
      ...(emergencyRepository
        ? [createEmergencyAssistant(emergencyRepository)]
        : []),
      // Fase J1: asistente de auditorías SG-SST (resumen y hallazgos abiertos).
      ...(sgsstAuditsRepository
        ? [createAuditAssistant(sgsstAuditsRepository)]
        : []),
      // Fase J2: asistente de indicadores y Plan Anual de Trabajo.
      ...(annualWorkPlansRepository && annualPlanActivitiesRepository && prisma
        ? [
            createIndicatorsAssistant(
              annualWorkPlansRepository,
              annualPlanActivitiesRepository,
              prisma,
            ),
          ]
        : []),
      // Fase J3: asistente de documentos (solo metadata autorizada).
      ...(prisma ? [createDocumentsAssistant(prisma)] : []),
    ];
  }

  all(): AssistantDefinition[] {
    return this.registry;
  }

  get(id: string): AssistantDefinition | null {
    return this.registry.find((assistant) => assistant.id === id) ?? null;
  }

  /** Asistentes visibles para el rol (para capabilities y la UI). */
  forRole(role: string): AssistantDefinition[] {
    return this.registry.filter((assistant) =>
      canUseAssistant(assistant, { sub: '', email: '', role, companyId: null }),
    );
  }

  /**
   * Ejecuta una herramienta del asistente con el ctx construido en backend.
   * Devuelve la definicion de herramienta usada (para auditoria/respuesta).
   */
  async runTool(
    assistantId: string,
    toolName: string,
    user: AuthenticatedUser,
    auditService: ToolContext['auditService'],
    params: Record<string, unknown> = {},
  ): Promise<{ tool: AssistantToolDefinition; data: Record<string, unknown> }> {
    const assistant = this.get(assistantId);
    if (!assistant) {
      throw new ForbiddenException(`Unknown assistant: ${assistantId}`);
    }
    if (!canUseAssistant(assistant, user)) {
      throw new ForbiddenException('Assistant is not available for this role');
    }
    const tool = assistant.tools.find(
      (candidate) => candidate.name === toolName,
    );
    if (!tool) {
      // Whitelist cerrada: la herramienta no pertenece al asistente.
      throw new ForbiddenException(
        `Tool ${toolName} is not available for assistant ${assistantId}`,
      );
    }
    if (!canInvokeTool(assistant, tool, user)) {
      throw new ForbiddenException('Tool is not available for this role');
    }
    validateToolParams(tool, params);

    const ctx: ToolContext = {
      companyId: resolveCompanyScope(user),
      user,
      auditService,
    };
    const data = await tool.run(ctx, params);
    return { tool, data };
  }
}
