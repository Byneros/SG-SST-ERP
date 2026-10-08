import type { AssistantDefinition } from '../ai-assistant.framework';
import type { EmergencyRepository } from '../../emergency/emergency.repository';

/**
 * Asistente de Emergencias (Fase I3, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila I3). Herramientas
 * READ sobre EmergencyRepository (scoping por companyId garantizado por el
 * repositorio); el ToolContext entrega el companyId resuelto en backend.
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createEmergencyAssistant(
  emergencyRepository: EmergencyRepository,
): AssistantDefinition {
  return {
    id: 'emergency',
    name: 'Asistente de Emergencias',
    module: 'emergency',
    description:
      'Brigadas por sede con vigencia de formacion (vencida = recertificar) ' +
      'y simulacros con hallazgos abiertos por severidad.',
    systemPromptAddendum:
      'Eres el asistente especializado en emergencias del SG-SST (Decreto ' +
      '1072/2015 art. 2.2.4.6.26: brigadas, planes y simulacros; Res. ' +
      '0394/2008 sobre brigadas de emergencia). Responde SOLO con los datos ' +
      'entregados; destaca formaciones vencidas y hallazgos abiertos. Nunca ' +
      'inventes simulacros ni integrantes.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'brigadas',
      'brigada',
      'emergencias',
      'plan de emergencias',
      'simulacros',
      'simulacro',
      'recertificacion de brigada',
      'formacion de brigada',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'brigades_summary',
        description:
          'Brigadas por sede con integrantes agregados y formaciones vencidas ' +
          'o proximas a vencer en 30 dias.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) => {
          const brigades = await emergencyRepository.findBrigadesForAssistant(
            ctx.companyId,
          );
          const now = Date.now();
          const in30 = now + 30 * 24 * 3600 * 1000;
          let totalMembers = 0;
          let expiredFormations = 0;
          const byRole: Record<string, number> = {};
          for (const brigade of brigades) {
            for (const member of brigade.members) {
              totalMembers++;
              byRole[member.role] = (byRole[member.role] ?? 0) + 1;
              if (
                member.validUntil &&
                new Date(member.validUntil).getTime() <= in30
              ) {
                expiredFormations++;
              }
            }
          }
          return {
            total: brigades.length,
            totalMembers,
            byRole,
            expiredFormations,
            brigades: brigades.slice(0, 10).map((brigade) => ({
              name: brigade.name,
              site: brigade.site.name,
              members: brigade.members.length,
            })),
          };
        },
      },
      {
        name: 'drills_findings',
        description:
          'Simulacros agregados por estado, con los hallazgos abiertos (sin ' +
          'cierre) por severidad de los 20 mas recientes.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) => {
          const drills = await emergencyRepository.findDrillsForAssistant(
            ctx.companyId,
          );
          const byStatus: Record<string, number> = {};
          const bySeverity: Record<string, number> = {};
          let openFindings = 0;
          for (const drill of drills) {
            byStatus[drill.status] = (byStatus[drill.status] ?? 0) + 1;
            for (const finding of drill.findings) {
              openFindings++;
              bySeverity[finding.severity] =
                (bySeverity[finding.severity] ?? 0) + 1;
            }
          }
          return {
            total: drills.length,
            byStatus,
            openFindings,
            bySeverity,
            drills: drills.slice(0, 10).map((drill) => ({
              name: drill.name,
              plan: drill.plan.name,
              site: drill.plan.site?.name ?? null,
              status: drill.status,
              plannedAt: drill.plannedAt,
              executedAt: drill.executedAt,
              openFindings: drill.findings.length,
            })),
          };
        },
      },
    ],
  };
}
