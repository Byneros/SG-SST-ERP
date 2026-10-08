import type { AssistantDefinition } from '../ai-assistant.framework';
import type { PpeRepository } from '../../ppe/ppe.repository';

/**
 * Asistente de EPP (Fase H3, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila H3). Herramientas
 * READ sobre PpeRepository (scoping por companyId garantizado por el
 * repositorio); el ToolContext entrega el companyId resuelto en backend.
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createPpeAssistant(
  ppeRepository: PpeRepository,
): AssistantDefinition {
  return {
    id: 'ppe',
    name: 'Asistente de EPP',
    module: 'ppe',
    description:
      'Inventario de elementos de proteccion personal (items por debajo del ' +
      'stock minimo) y entregas con reposicion vencida o proxima (30 dias).',
    systemPromptAddendum:
      'Eres el asistente especializado en elementos de proteccion personal ' +
      'del SG-SST (Decreto 1072/2015, Res. 0427/2021 sobre EPP). Responde ' +
      'SOLO con los datos entregados; destaca items bajo minimo y ' +
      'reposiciones vencidas. Nunca inventes stock ni entregas.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'epp',
      'proteccion personal',
      'dotacion',
      'inventario epp',
      'stock epp',
      'entregas',
      'reposicion',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'stock_summary',
        description:
          'Items EPP activos con stock y estado frente al minimo (bajo ' +
          'minimo, en el limite, suficiente).',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) => {
          const items = await ppeRepository.findStockSummary(ctx.companyId);
          const belowMin = items.filter((item) => item.stock < item.stockMin);
          const byType: Record<string, number> = {};
          for (const item of items) {
            const typeKey = item.type ?? 'Sin tipo';
            byType[typeKey] = (byType[typeKey] ?? 0) + 1;
          }
          return {
            total: items.length,
            belowMinCount: belowMin.length,
            belowMin: belowMin.slice(0, 15).map((item) => ({
              name: item.name,
              type: item.type,
              size: item.size,
              stock: item.stock,
              stockMin: item.stockMin,
            })),
            byType,
          };
        },
      },
      {
        name: 'expiring_deliveries',
        description:
          'Entregas EPP con reposicion vencida o que vence en los proximos ' +
          '30 dias, la mas urgente primero (tope 20).',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        paramsSchema: { take: 'number' },
        run: async (ctx, params) => {
          const take =
            typeof params.take === 'number' && params.take > 0
              ? Math.min(Math.floor(params.take), 20)
              : 10;
          const deliveries = await ppeRepository.findExpiringDeliveries(
            ctx.companyId,
            take,
          );
          const now = Date.now();
          return {
            total: deliveries.length,
            overdue: deliveries.filter(
              (delivery) =>
                delivery.dueReplacementAt &&
                new Date(delivery.dueReplacementAt).getTime() < now,
            ).length,
            deliveries: deliveries.map((delivery) => ({
              item: delivery.item.name,
              type: delivery.item.type,
              quantity: delivery.quantity,
              employee: [
                delivery.employee.firstName,
                delivery.employee.lastName,
              ]
                .filter(Boolean)
                .join(' '),
              position: delivery.employee.position,
              dueReplacementAt: delivery.dueReplacementAt,
            })),
          };
        },
      },
    ],
  };
}
