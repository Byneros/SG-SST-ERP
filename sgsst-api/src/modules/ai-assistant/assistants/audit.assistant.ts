import type { AssistantDefinition } from '../ai-assistant.framework';
import type { SgsstAuditsRepository } from '../../sgsst-audits/sgsst-audits.repository';

/**
 * Asistente de Auditorías SG-SST (Fase J1, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila J1). Herramienta
 * READ sobre SgsstAuditsRepository (scoping por companyId garantizado por el
 * repositorio); el ToolContext entrega el companyId resuelto en backend.
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createAuditAssistant(
  sgsstAuditsRepository: SgsstAuditsRepository,
): AssistantDefinition {
  return {
    id: 'audit',
    name: 'Asistente de Auditorías',
    module: 'sgsst-audits',
    description:
      'Estado del programa de auditorías: auditorías por estado, hallazgos ' +
      'abiertos y acciones correctivas pendientes por auditoría.',
    systemPromptAddendum:
      'Eres el asistente especializado en auditorías SG-SST del sistema ' +
      '(Decreto 1072/2015, art. 2.2.4.6.24: auditorías anuales). Responde ' +
      'SOLO con los datos entregados; destaca auditorías con hallazgos ' +
      'abiertos y acciones pendientes. Nunca inventes resultados ni fechas.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'auditorias',
      'auditoria',
      'auditoría',
      'auditorías',
      'programa de auditorias',
      'hallazgos de auditoria',
      'auditor SG-SST',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'audits_summary',
        description:
          'Auditorías SG-SST de la empresa: total, agregadas por estado ' +
          '(PLANNED/IN_PROGRESS/CLOSED/CANCELLED), hallazgos abiertos y las ' +
          'más recientes con conteo de hallazgos y acciones pendientes.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        paramsSchema: { take: 'number' },
        run: async (ctx, params) => {
          const take =
            typeof params.take === 'number' && params.take > 0
              ? Math.min(Math.floor(params.take), 20)
              : 10;
          return sgsstAuditsRepository.summaryForAssistant(ctx.companyId, take);
        },
      },
    ],
  };
}
