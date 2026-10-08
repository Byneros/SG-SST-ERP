import type { AssistantDefinition } from '../ai-assistant.framework';
import type { CommitteesRepository } from '../../committees/committees.repository';

/**
 * Asistente de Comités (Fase I2, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila I2). Herramientas
 * READ sobre CommitteesRepository (scoping por companyId garantizado por el
 * repositorio); el ToolContext entrega el companyId resuelto en backend.
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createCommitteesAssistant(
  committeesRepository: CommitteesRepository,
): AssistantDefinition {
  return {
    id: 'committees',
    name: 'Asistente de Comités',
    module: 'committees',
    description:
      'Comites vigentes (COPASST y Convivencia) por tipo y estado, y ' +
      'compromisos de Actas pendientes con su responsable y vencimiento.',
    systemPromptAddendum:
      'Eres el asistente especializado en comites del SG-SST (COPASST: ' +
      'Decreto 1072/2015 art. 2.2.4.6.16 y Res. 0312/2019; Comite de ' +
      'Convivencia: Res. 0652/2012). Responde SOLO con los datos entregados; ' +
      'destaca compromisos vencidos. Nunca inventes actas ni integrantes.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'copasst',
      'comite',
      'comites',
      'comite de convivencia',
      'actas',
      'compromisos',
      'integrantes del comite',
      'vigencia del comite',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'meetings_summary',
        description:
          'Comites por tipo y estado con vigencia, integrantes y reuniones ' +
          'agregadas (tope 10 mas recientes).',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) => {
          const committees = await committeesRepository.findSummaryForAssistant(
            ctx.companyId,
          );
          const byType: Record<string, number> = {};
          const byStatus: Record<string, number> = {};
          for (const committee of committees) {
            byType[committee.type] = (byType[committee.type] ?? 0) + 1;
            byStatus[committee.status] = (byStatus[committee.status] ?? 0) + 1;
          }
          return {
            total: committees.length,
            byType,
            byStatus,
            committees: committees.slice(0, 10).map((committee) => ({
              name: committee.name,
              type: committee.type,
              status: committee.status,
              periodStart: committee.periodStart,
              periodEnd: committee.periodEnd,
              members: committee._count.members,
              meetings: committee._count.meetings,
            })),
          };
        },
      },
      {
        name: 'overdue_commitments',
        description:
          'Compromisos de actas pendientes (sin cierre), los mas urgentes ' +
          'primero, indicando cuales estan vencidos (tope 20).',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        paramsSchema: { take: 'number' },
        run: async (ctx, params) => {
          const take =
            typeof params.take === 'number' && params.take > 0
              ? Math.min(Math.floor(params.take), 20)
              : 10;
          const commitments =
            await committeesRepository.findOpenCommitmentsForAssistant(
              ctx.companyId,
              take,
            );
          const now = Date.now();
          return {
            total: commitments.length,
            overdue: commitments.filter(
              (commitment) => new Date(commitment.dueDate).getTime() < now,
            ).length,
            commitments: commitments.map((commitment) => ({
              committee: commitment.meeting.committee.name,
              meetingNumber: commitment.meeting.number,
              description: commitment.description,
              responsible: [
                commitment.responsible.firstName,
                commitment.responsible.lastName,
              ]
                .filter(Boolean)
                .join(' '),
              dueDate: commitment.dueDate,
              overdue: new Date(commitment.dueDate).getTime() < now,
            })),
          };
        },
      },
    ],
  };
}
