import type { AssistantDefinition } from '../ai-assistant.framework';
import type { ContractorsRepository } from '../../contractors/contractors.repository';

/**
 * Asistente de Contratistas (Fase I1, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila I1). Herramientas
 * READ sobre ContractorsRepository (scoping por companyId garantizado por el
 * repositorio); el ToolContext entrega el companyId resuelto en backend.
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createContractorsAssistant(
  contractorsRepository: ContractorsRepository,
): AssistantDefinition {
  return {
    id: 'contractors',
    name: 'Asistente de Contratistas',
    module: 'contractors',
    description:
      'Documentos de contratistas vencidos o proximos a vencer (30 dias) y ' +
      'estado del flujo de ingreso (induccion, autorizado, trabajo, cerrado).',
    systemPromptAddendum:
      'Eres el asistente especializado en contratistas del SG-SST ' +
      '(Decreto 1072/2015, art. 2.2.4.6.17: colaboradores contractuales). ' +
      'Responde SOLO con los datos entregados; destaca documentos vencidos y ' +
      'bloqueos del flujo de ingreso. Nunca inventes estados ni fechas.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'contratistas',
      'contratista',
      'colaboradores contractuales',
      'flujo de ingreso',
      'induccion de contratistas',
      'documentos de contratistas',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'docs_expiring',
        description:
          'Documentos de contratistas vencidos o que vencen en los proximos ' +
          '30 dias, el mas urgente primero (tope 20).',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        paramsSchema: { take: 'number' },
        run: async (ctx, params) => {
          const take =
            typeof params.take === 'number' && params.take > 0
              ? Math.min(Math.floor(params.take), 20)
              : 10;
          const docs =
            await contractorsRepository.findExpiringDocumentsForAssistant(
              ctx.companyId,
              take,
            );
          const now = Date.now();
          return {
            total: docs.length,
            expired: docs.filter(
              (doc) => doc.expiresAt && new Date(doc.expiresAt).getTime() < now,
            ).length,
            documents: docs.map((doc) => ({
              contractor: doc.contractor.name,
              documentType: doc.documentType,
              status: doc.status,
              expiresAt: doc.expiresAt,
            })),
          };
        },
      },
      {
        name: 'entry_flow_status',
        description:
          'Contratistas agregados por etapa del flujo de ingreso ' +
          '(INDUCTION/AUTHORIZED/WORK/CLOSED) y estado del contratista.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        run: async (ctx) => {
          const contractors =
            await contractorsRepository.findEntryFlowForAssistant(
              ctx.companyId,
            );
          const byEntryStatus: Record<string, number> = {};
          const byStatus: Record<string, number> = {};
          for (const contractor of contractors) {
            byEntryStatus[contractor.entryStatus] =
              (byEntryStatus[contractor.entryStatus] ?? 0) + 1;
            byStatus[contractor.status] =
              (byStatus[contractor.status] ?? 0) + 1;
          }
          return {
            total: contractors.length,
            byEntryStatus,
            byStatus,
          };
        },
      },
    ],
  };
}
