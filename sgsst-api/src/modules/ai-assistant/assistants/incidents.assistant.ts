import type { AssistantDefinition } from '../ai-assistant.framework';
import type { IncidentsRepository } from '../../incidents/incidents.repository';
import type { UnsafeReportsRepository } from '../../unsafe-reports/unsafe-reports.repository';

/**
 * Asistente de Incidentes (Fase F, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila F). Herramientas
 * READ sobre IncidentsRepository + UnsafeReportsRepository (scoping por
 * companyId garantizado por los repositorios); el ToolContext entrega el
 * companyId resuelto en backend y ninguna herramienta lo acepta del cliente.
 *
 * allowedRoles = mismos del asistente central (SUPER_ADMIN, ADMIN, SST,
 * AUDITOR). EMPLOYEE sigue fuera (criterio de fase 1).
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

interface UnsafeLike {
  id: string;
  kind: string;
  description: string;
  severity: string;
  status: string;
  createdAt: Date;
}

export function createIncidentsAssistant(
  incidentsRepository: IncidentsRepository,
  unsafeReportsRepository: UnsafeReportsRepository,
): AssistantDefinition {
  return {
    id: 'incidents',
    name: 'Asistente de Incidentes',
    module: 'incidents',
    description:
      'Estadisticas de incidentes y accidentes por estado, causas mas ' +
      'frecuentes en reportes de actos/condiciones inseguras y abiertos por ' +
      'severidad (Res. 1401/2007).',
    systemPromptAddendum:
      'Eres el asistente especializado en reporte e investigacion de ' +
      'incidentes y accidentes de trabajo (Res. 1401/2007, Res. GCOVID). ' +
      'Responde SOLO con los datos entregados; distingue incidente/accidente ' +
      'de acto o condicion insegura de reportes; Never invent datos.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'incidentes',
      'incidente',
      'accidentes',
      'accidente',
      'laboral',
      'reportes inseguros',
      'acto inseguro',
      'condicion insegura',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'stats_summary',
        description: 'Incidentes agregados por estado y del ultimo ano.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) => {
          const all = await incidentsRepository.findAllForAssistant(
            ctx.companyId,
          );
          const byStatus: Record<string, number> = {
            PENDING: 0,
            IN_PROGRESS: 0,
            RESOLVED: 0,
          };
          for (const incident of all) {
            byStatus[incident.status] = (byStatus[incident.status] ?? 0) + 1;
          }
          return { total: all.length, byStatus };
        },
      },
      {
        name: 'recurrent_causes',
        description:
          'Causas/areas mas frecuentes en reportes de actos y condiciones ' +
          'inseguras, y abiertos por severidad.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) => {
          const reports = (await unsafeReportsRepository.findAll(
            ctx.companyId,
          )) as UnsafeLike[];
          const byKind = new Map<string, number>();
          const bySeverity: Record<string, number> = {};
          let open = 0;
          for (const report of reports) {
            byKind.set(report.kind, (byKind.get(report.kind) ?? 0) + 1);
            bySeverity[report.severity] =
              (bySeverity[report.severity] ?? 0) + 1;
            if (String(report.status).toUpperCase() !== 'CLOSED') open++;
          }
          return {
            total: reports.length,
            open,
            byKind: Object.fromEntries(byKind),
            bySeverity,
          };
        },
      },
    ],
  };
}
