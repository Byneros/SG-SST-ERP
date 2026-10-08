import type { AssistantDefinition } from '../ai-assistant.framework';
import type { FindingsRepository } from '../../findings/findings.repository';
import type { ActionPlansRepository } from '../../actions/action-plans.repository';

/**
 * Asistente de Hallazgos (Fase G, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila G). Herramientas
 * READ sobre FindingsRepository + ActionPlansRepository (scoping por
 * companyId garantizado por los repositorios); el ToolContext entrega el
 * companyId resuelto en backend y ninguna herramienta lo acepta del cliente.
 *
 * allowedRoles = mismos del asistente central (SUPER_ADMIN, ADMIN, SST,
 * AUDITOR). EMPLOYEE sigue fuera (criterio de fase 1).
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createFindingsAssistant(
  findingsRepository: FindingsRepository,
  actionPlansRepository: ActionPlansRepository,
): AssistantDefinition {
  return {
    id: 'findings',
    name: 'Asistente de Hallazgos',
    module: 'findings',
    description:
      'Resumen de hallazgos abiertos por severidad/origen, acciones ' +
      'vencidas sin cerrar (plan de accion) y responsables con mas ' +
      'hallazgos asignados.',
    systemPromptAddendum:
      'Eres el asistente especializado en hallazgos unificados del SG-SST ' +
      '(Decreto 1072/2015, planes de accion correctivos/preventivos). ' +
      'Responde SOLO con los datos entregados; prioriza lo vencido y lo ' +
      'critico, y nunca inventes acciones, responsables ni cifras.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'hallazgos',
      'hallazgo',
      'no conformidad',
      'no conformidades',
      'planes de accion',
      'plan de accion',
      'acciones correctivas',
      'accion correctiva',
      'vencidas',
      'reincidentes',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'open_summary',
        description:
          'Hallazgos abiertos agregados por severidad, tipo y origen; cuenta ' +
          'con y sin plan de accion, y acciones vencidas derivadas de ellos.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) => {
          const findings = await findingsRepository.findOpenForAssistant(
            ctx.companyId,
          );
          const now = Date.now();
          const bySeverity: Record<string, number> = {
            MINOR: 0,
            MAJOR: 0,
            CRITICAL: 0,
          };
          const byType: Record<string, number> = {};
          const bySource: Record<string, number> = {};
          let findingsWithAction = 0;
          let findingsWithoutAction = 0;
          let overdueActions = 0;
          const top: Array<Record<string, unknown>> = [];
          const findable = (finding) =>
            finding.severity === 'MAJOR' || finding.severity === 'CRITICAL';
          for (const finding of findings) {
            bySeverity[finding.severity] =
              (bySeverity[finding.severity] ?? 0) + 1;
            byType[finding.type] = (byType[finding.type] ?? 0) + 1;
            bySource[finding.sourceType] =
              (bySource[finding.sourceType] ?? 0) + 1;
            top.push({
              id: finding.id,
              title: finding.title,
              severity: finding.severity,
              status: finding.status,
            });
          }
          // Las acciones de un hallazgo no tienen relacion directa: se 
          // rastrean por origen (sourceType=FINDING, sourceId=id).
          const actionCounts =
            await actionPlansRepository.countForFindingsAsistente(
              ctx.companyId,
              findings.map((finding) => finding.id),
            );
          const actionByFinding = new Map(
            actionCounts.findings.map((row) => {
              const open = row.actions.filter(
                (action) =>
                  action.status === 'OPEN' || action.status === 'IN_PROGRESS',
              );
              const overdue = open.filter(
                (action) => new Date(action.dueDate).getTime() < now,
              );
              overdueActions += overdue.length;
              return [row.findingId, { open: open.length, overdue: overdue.length }];
            }),
          );
          for (const finding of findings) {
            const counts = actionByFinding.get(finding.id);
            if (counts && counts.open > 0) {
              findingsWithAction++;
            } else {
              findingsWithoutAction++;
            }
            if (top.length > 0 && findable(finding)) {
              const item = top.find((candidate) => candidate.id === finding.id);
              if (item) {
                item.openActions = counts?.open ?? 0;
                item.overdueActions = counts?.overdue ?? 0;
              }
            }
          }
          return {
            total: findings.length,
            bySeverity,
            byType,
            bySource,
            findingsWithAction,
            findingsWithoutAction,
            overdueActions,
            top: top.slice(0, 15),
          };
        },
      },
      {
        name: 'overdue_actions',
        description:
          'Planes de accion vencidos sin cerrar (OPEN/IN_PROGRESS con ' +
          'dueDate pasado), del mas vencido al mas reciente.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        paramsSchema: { take: 'number' },
        run: async (ctx, params) => {
          const take =
            typeof params.take === 'number' && params.take > 0
              ? Math.min(Math.floor(params.take), 20)
              : 10;
          const actions = await actionPlansRepository.findOverdueForAssistant(
            ctx.companyId,
            take,
          );
          return {
            total: actions.length,
            actions: actions.map((action) => ({
              id: action.id,
              title: action.title,
              kind: action.kind,
              status: action.status,
              dueDate: action.dueDate,
              owner: action.owner?.name ?? null,
              sourceType: action.sourceType,
            })),
          };
        },
      },
      {
        name: 'repeat_offenders',
        description:
          'Propietarios (owner) con mas hallazgos asignados en la empresa ' +
          '(posibles reincidencias por area/responsable).',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        paramsSchema: { minCount: 'number' },
        run: async (ctx, params) => {
          const minCount =
            typeof params.minCount === 'number' && params.minCount > 0
              ? Math.min(Math.floor(params.minCount), 50)
              : 2;
          const grouped = await findingsRepository.findRepeatOwners(
            ctx.companyId,
            minCount,
          );
          return {
            minCount,
            total: grouped.length,
            owners: grouped.map((row) => ({
              ownerId: row.ownerId,
              findings: row._count._all,
            })),
          };
        },
      },
    ],
  };
}
