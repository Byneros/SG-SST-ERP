import type { AssistantDefinition } from '../ai-assistant.framework';
import type { AiAssistantTools } from '../ai-assistant.tools';

/**
 * Asistente central (punto de entrada general del ERP).
 *
 * Envuelve las 6 herramientas READ de la fase 1 (AiAssistantTools) SIN
 * duplicar su logica: cada definicion delega en tools.run(nombre, ctx.user),
 * que resuelve el companyId con resolveCompanyScope y aplica el mismo scoping
 * de siempre. Los nombres legacy se conservan para compatibilidad con
 * `@datos` y el export AssistantToolName.
 *
 * allowedRoles = ASSISTANT_ALLOWED_ROLES (SUPER_ADMIN, ADMIN, SST, AUDITOR).
 * EMPLOYEE sigue fuera (mismo criterio de la fase 1, evaluado en tools.run).
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createCentralAssistant(
  tools: AiAssistantTools,
): AssistantDefinition {
  const wrap =
    (toolName: string) =>
    async (ctx: { user: Parameters<AiAssistantTools['run']>[1] }) => {
      return tools.run(toolName as never, ctx.user);
    };

  return {
    id: 'central',
    name: 'Asistente IA del ERP',
    module: 'dashboard',
    description:
      'Punto de entrada general: ayuda sobre el ERP y resumenes de datos por modulo.',
    systemPromptAddendum:
      'Eres el punto de entrada general del ERP. Si la consulta pertenece a un ' +
      'modulo concreto, indicalo en tu respuesta mencionando el modulo principal.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'estado general',
      'resumen',
      'situcion',
      'que modulos',
      'ayuda',
      'como uso',
      'como creo',
      'como configuro',
    ],
    delegateTo: ['risks', 'incidents', 'findings', 'trainings'],
    tools: [
      {
        name: 'company_summary',
        description: 'Datos basicos de la empresa del actor.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: wrap('company_summary'),
      },
      {
        name: 'sites_summary',
        description: 'Sedes de la empresa con conteo de empleados.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: wrap('sites_summary'),
      },
      {
        name: 'employees_summary',
        description: 'Empleados de la empresa (primeros 20).',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: wrap('employees_summary'),
      },
      {
        name: 'risks_summary',
        description: 'Matriz de riesgos agregada por nivel.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: wrap('risks_summary'),
      },
      {
        name: 'incidents_summary',
        description: 'Incidentes y accidentes agregados por estado.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: wrap('incidents_summary'),
      },
      {
        name: 'trainings_summary',
        description: 'Capacitaciones registradas (primeras 10).',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: wrap('trainings_summary'),
      },
    ],
  };
}
