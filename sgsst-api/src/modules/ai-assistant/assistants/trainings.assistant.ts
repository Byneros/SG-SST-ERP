import type { AssistantDefinition } from '../ai-assistant.framework';
import type { TrainingsRepository } from '../../trainings/trainings.repository';

/**
 * Asistente de Capacitaciones (Fase H1, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila H1). Amplia el
 * actual `trainings_summary` del central con agregaciones por anio y sede.
 * Herramientas READ sobre TrainingsRepository (scoping por companyId
 * garantizado por el repositorio); el ToolContext entrega el companyId
 * resuelto en backend y ninguna herramienta lo acepta del cliente.
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createTrainingsAssistant(
  trainingsRepository: TrainingsRepository,
): AssistantDefinition {
  return {
    id: 'trainings',
    name: 'Asistente de Capacitaciones',
    module: 'trainings',
    description:
      'Cumplimiento de capacitaciones: totales, distribucion por anio y ' +
      'sede, y las mas recientes programadas.',
    systemPromptAddendum:
      'Eres el asistente especializado en capacitaciones del SG-SST ' +
      '(Decreto 1072/2015, art. 2.2.4.6.25: minimo anual de 48 horas). ' +
      'Responde SOLO con los datos entregados; no calcules cumplimiento ' +
      'normativo que no este en los datos. Nunca inventes capacitaciones.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'capacitaciones',
      'capacitacion',
      'formacion',
      'entrenamiento',
      '48 horas',
      'curso',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'compliance_summary',
        description:
          'Resumen de capacitaciones por anio y por sede, con las 10 mas ' +
          'recientes (titulo y fecha).',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) => {
          const trainings = await trainingsRepository.findAllForAssistant(
            ctx.companyId,
          );
          const byYear: Record<string, number> = {};
          const bySite = new Map<string, number>();
          for (const training of trainings) {
            const year = String(new Date(training.date).getUTCFullYear());
            byYear[year] = (byYear[year] ?? 0) + 1;
            const siteKey = training.siteId ?? 'Sin sede';
            bySite.set(siteKey, (bySite.get(siteKey) ?? 0) + 1);
          }
          return {
            total: trainings.length,
            byYear,
            bySite: Object.fromEntries(bySite),
            recent: trainings.slice(0, 10).map((training) => ({
              title: training.title,
              date: training.date,
            })),
          };
        },
      },
    ],
  };
}
