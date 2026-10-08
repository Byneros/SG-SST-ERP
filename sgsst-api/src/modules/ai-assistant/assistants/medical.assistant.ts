import type { AssistantDefinition } from '../ai-assistant.framework';
import type { MedicalAssistantRepository } from '../../medical/medical.repository';

/**
 * Asistente de Medicina Laboral (Fase H2, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila H2). Solo
 * ADMIN/SST/AUDITOR (sin SUPER_ADMIN? no: SUPER_ADMIN incluido como en los
 * demas). Sin datos clinicos: solo agregaciones de conceptos ocupacionales
 * y estados PVE, mismo criterio de la fase 1 (datos sensibles).
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createMedicalAssistant(
  medicalAssistantRepository: MedicalAssistantRepository,
): AssistantDefinition {
  return {
    id: 'medical',
    name: 'Asistente de Medicina Laboral',
    module: 'medical',
    description:
      'Resumen agregado de examenes ocupacionales (concepto APTO/RESTRICCION/' +
      'NO_APTO, proximos vencimientos) y casos de vigilancia epidemiologica ' +
      'PVE por estado y programa (sin datos clinicos).',
    systemPromptAddendum:
      'Eres el asistente especializado en medicina laboral del SG-SST ' +
      '(Res. 2346/2007, Res. 2646/2008). Responde SOLO con los datos ' +
      'entregados, que son agregados y no incluyen historia clinica ni ' +
      'diagnosticos individuales. Nunca des consejos medicos ni interpretes ' +
      'examenes: deriva al profesional de salud ocupacional.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'medicina laboral',
      'examenes ocupacionales',
      'examen ocupacional',
      'examen medico',
      'profesiograma',
      'pve',
      'vigilancia epidemiologica',
      'apto',
      'ausentismo',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'exam_summary',
        description:
          'Examenes ocupacionales agregados por concepto y tipo, y proximos ' +
          'a vencer en 30 dias (sin diagnosticos individuales).',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) =>
          medicalAssistantRepository.examSummary(ctx.companyId),
      },
      {
        name: 'pve_summary',
        description:
          'Casos de vigilancia epidemiologica por estado y programa, con ' +
          'dias de ausentismo acumulados (agregado, sin datos personales).',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) =>
          medicalAssistantRepository.pveSummary(ctx.companyId),
      },
    ],
  };
}
