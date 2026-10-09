import type { AssistantDefinition } from '../ai-assistant.framework';
import type { PrismaService } from '../../../database/prisma.service';

/**
 * Asistente de Documentos (Fase J3, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§5, fila J3). UNICA
 * herramienta READ `search_authorized`: devuelve SOLO metadata autorizada
 * (nombre, categoria, estado, version, sedes, vencimiento). NUNCA expone
 * fileUrl, storage keys ni contenido binario, ni URLs de descarga.
 */

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR'] as const;

export function createDocumentsAssistant(
  prisma: PrismaService,
): AssistantDefinition {
  return {
    id: 'documents',
    name: 'Asistente de Documentos',
    module: 'documents',
    description:
      'Busqueda de documentos por nombre/categoria con SOLO metadata ' +
      'autorizada: sin archivos ni URLs de descarga.',
    systemPromptAddendum:
      'Eres el asistente especializado en documentación del SG-SST (Decreto ' +
      '1072/2015: documentación requerida). Responde SOLO con la metadata ' +
      'entregada (nombres, categorías, estados, vencimientos). NUNCA expongas ' +
      'enlaces de descarga, ni conteúdo de archivos, ni rutas de almacenamiento.',
    allowedRoles: [...ALL_ROLES],
    keywords: [
      'documentos',
      'documento',
      'documentacion',
      'documentación',
      'documentos vencidos',
      'procedimientos',
    ],
    delegateTo: [],
    tools: [
      {
        name: 'search_authorized',
        description:
          'Documentos de la empresa cuyo nombre coincide con eltermino ' +
          '(tope 15). Solo metadata autorizada; nunca fileUrl ni contenido.',
        kind: 'READ',
        allowedRoles: [...ALL_ROLES],
        paramsSchema: { search: 'string', take: 'number' },
        run: async (ctx, params) => {
          const search =
            typeof params.search === 'string'
              ? params.search.trim().slice(0, 120)
              : '';
          const take =
            typeof params.take === 'number' && params.take > 0
              ? Math.min(Math.floor(params.take), 15)
              : 10;
          if (!search) {
            return { total: 0, documents: [] };
          }
          const documents = await prisma.document.findMany({
            where: {
              companyId: ctx.companyId,
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            },
            select: {
              // Metadata autorizada: NADA de fileUrl/fileName/mimeType.
              id: true,
              name: true,
              category: true,
              status: true,
              version: true,
              expiresAt: true,
              site: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take,
          });
          return {
            total: documents.length,
            documents: documents.map((doc) => ({
              name: doc.name,
              category: doc.category,
              status: doc.status,
              version: doc.version,
              expiresAt: doc.expiresAt,
              site: doc.site?.name ?? null,
            })),
          };
        },
      },
    ],
  };
}
