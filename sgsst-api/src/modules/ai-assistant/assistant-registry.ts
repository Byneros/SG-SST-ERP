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
import type { RisksRepository } from '../risks/risks.repository';
import type { IncidentsRepository } from '../incidents/incidents.repository';
import type { UnsafeReportsRepository } from '../unsafe-reports/unsafe-reports.repository';
import type { FindingsRepository } from '../findings/findings.repository';
import type { ActionPlansRepository } from '../actions/action-plans.repository';

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
        ? [
            createFindingsAssistant(
              findingsRepository,
              actionPlansRepository,
            ),
          ]
        : []),
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
