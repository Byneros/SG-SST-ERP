import type { AssistantDefinition } from '../ai-assistant.framework';
import type { RisksRepository } from '../../risks/risks.repository';

/**
 * Asistente de Riesgos (Fase E, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila E). Herramientas
 * READ sobre RisksRepository (scoping por companyId garantizado por el
 * repositorio); el ToolContext entrega el companyId resuelto en backend y
 * ninguna herramienta lo acepta del cliente.
 *
 * allowedRoles = mismos del asistente central (SUPER_ADMIN, ADMIN, SST,
 * AUDITOR). EMPLOYEE sigue fuera (criterio de fase 1).
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createRisksAssistant(
  risksRepository: RisksRepository,
): AssistantDefinition {
  return {
    id: 'risks',
    name: 'Asistente de Riesgos',
    module: 'risks',
    description:
      'Resumenes de la matriz GTC-45: distribucion por nivel y sede, riesgos ' +
      'criticos sin accion correctiva y riesgos mas antiguos sin tratar.',
    systemPromptAddendum:
      'Eres el asistente especializado en riesgos del SG-SST (metodologia ' +
      'GTC 45, Decreto 1072/2015). Responde SOLO con los datos entregados; ' +
      'si un riesgo es critico o alto sin accion correctiva, recomiendalo ' +
      'explícitamente y distingue norma de recomendacion. Nunca inventes ' +
      'riesgos ni controles que no esten en los datos.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'riesgos',
      'riesgo',
      'matriz',
      'gtc 45',
      'gtc45',
      'peligros',
      'valoracion',
      'nivel de riesgo',
      'critico',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'matrix_summary',
        description:
          'Distribucion de la matriz de riesgos por nivel, por sede y total.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) => {
          const risks = await risksRepository.findAll(ctx.companyId);
          const byLevel: Record<string, number> = {
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0,
            CRITICAL: 0,
          };
          const bySite = new Map<string, number>();
          for (const risk of risks) {
            byLevel[risk.level] = (byLevel[risk.level] ?? 0) + 1;
            const siteName = risk.site?.name ?? 'Sin sede';
            bySite.set(siteName, (bySite.get(siteName) ?? 0) + 1);
          }
          return {
            total: risks.length,
            byLevel,
            bySite: Object.fromEntries(bySite),
          };
        },
      },
      {
        name: 'critical_without_actions',
        description:
          'Riesgos altos y criticos con hallazgos de inspeccion abiertos sin ' +
          'accion correctiva asociada.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) => {
          const risks = await risksRepository.findWithoutCorrectiveAction(
            ctx.companyId,
          );
          return {
            total: risks.length,
            risks: risks.slice(0, 20).map((risk) => ({
              title: risk.title,
              level: risk.level,
              position: risk.position ?? null,
              site: risk.site?.name ?? null,
              findingsWithoutAction: risk.inspectionFindings.map((finding) => ({
                id: finding.id,
                description: finding.description,
                severity: finding.severity,
                status: finding.status,
              })),
            })),
          };
        },
      },
      {
        name: 'oldest_open',
        description:
          'Riesgos registrados hace mas tiempo sin hallazgos resueltos ' +
          '(candidatos a revision o cierre), mas antiguos primero.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        paramsSchema: { take: 'number' },
        run: async (ctx, params) => {
          const take =
            typeof params.take === 'number' && params.take > 0
              ? Math.min(Math.floor(params.take), 20)
              : 5;
          const risks = await risksRepository.findOldest(ctx.companyId, take);
          return {
            total: risks.length,
            risks: risks.map((risk) => ({
              title: risk.title,
              level: risk.level,
              position: risk.position ?? null,
              site: risk.site?.name ?? null,
              createdAt: risk.createdAt,
              openFindings: risk.inspectionFindings.filter(
                (finding) => finding.status !== 'CLOSED',
              ).length,
            })),
          };
        },
      },
    ],
  };
}
