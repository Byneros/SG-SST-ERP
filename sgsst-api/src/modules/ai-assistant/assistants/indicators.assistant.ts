import type { AssistantDefinition } from '../ai-assistant.framework';
import type { AnnualWorkPlansRepository } from '../../annual-work-plans/annual-work-plans.repository';
import type { AnnualPlanActivitiesRepository } from '../../annual-work-plans/annual-plan-activities.repository';
import type { PrismaService } from '../../../database/prisma.service';

/**
 * Asistente de Indicadores (Fase J2, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila J2). Herramientas
 * READ sobre AnnualWorkPlansRepository/AnnualPlanActivitiesRepository e
 * IndicatorsService (scoping por companyId garantizado por cada repositorio);
 * el ToolContext entrega el companyId resuelto en backend. Nunca accede a
 * metas/mediciones de otra empresa.
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createIndicatorsAssistant(
  annualWorkPlansRepository: AnnualWorkPlansRepository,
  annualPlanActivitiesRepository: AnnualPlanActivitiesRepository,
  prisma: PrismaService,
): AssistantDefinition {
  return {
    id: 'indicators',
    name: 'Asistente de Indicadores',
    module: 'indicators',
    description:
      'Avance del Plan Anual de Trabajo (progreso de sus actividades) y ' +
      'valores vigentes de los indicadores con sus metas del periodo.',
    systemPromptAddendum:
      'Eres el asistente especializado en indicadores del SG-SST y su Plan ' +
      'Anual de Trabajo (Res. 0391/2024: indicadores de supervision). ' +
      'Responde SOLO con los datos entregados; compara valores medidos contra ' +
      'metas cuando existan. Nunca inventes valores ni periodos.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'indicadores',
      'indicador',
      'plan anual',
      'plan anual de trabajo',
      'avance del plan',
      'metas',
      'mediciones',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'plan_progress',
        description:
          'Avance del Plan Anual de Trabajo: planes con su promedio de ' +
          'progreso de actividades (CANCELLED excluida), el anio mas reciente ' +
          'primero.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        paramsSchema: { year: 'number' },
        run: async (ctx, params) => {
          const plans = await annualWorkPlansRepository.findAll(ctx.companyId);
          const filtered =
            typeof params.year === 'number'
              ? plans.filter((plan) => plan.year === params.year)
              : plans;
          const withProgress = await Promise.all(
            filtered.slice(0, 5).map(async (plan) => ({
              id: plan.id,
              year: plan.year,
              status: plan.status,
              approvedAt: plan.approvedAt,
              progress:
                await annualPlanActivitiesRepository.computePlanProgress(
                  ctx.companyId,
                  plan.id,
                ),
            })),
          );
          return { total: filtered.length, plans: withProgress };
        },
      },
      {
        name: 'indicator_snapshot',
        description:
          'Valores vigentes de los indicadores de la empresa (tope 15): ' +
          'codigo, nombre, valor actual, unidad, direccion de lectura y meta ' +
          'del periodo mas reciente.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        paramsSchema: { take: 'number' },
        run: async (ctx, params) => {
          const take =
            typeof params.take === 'number' && params.take > 0
              ? Math.min(Math.floor(params.take), 15)
              : 10;
          const indicators = await prisma.indicator.findMany({
            where: { companyId: ctx.companyId },
            select: {
              id: true,
              name: true,
              code: true,
              unit: true,
              value: true,
              direction: true,
              targets: {
                orderBy: { period: 'desc' },
                take: 1,
                select: { period: true, target: true },
              },
            },
            orderBy: { createdAt: 'desc' },
            take,
          });
          return {
            total: indicators.length,
            indicators: indicators.map((indicator) => ({
              code: indicator.code,
              name: indicator.name,
              value: indicator.value,
              unit: indicator.unit,
              direction: indicator.direction,
              latestTarget: indicator.targets[0] ?? null,
            })),
          };
        },
      },
    ],
  };
}
