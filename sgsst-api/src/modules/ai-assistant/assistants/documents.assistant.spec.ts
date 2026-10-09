import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { AiAssistantTools } from '../ai-assistant.tools';
import { createDocumentsAssistant } from './documents.assistant';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de Documentos (Fase J3, S16 extendido).
 *
 * - Registro: 'documents' convive con los asistentes previos.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada, scoping por ToolContext.
 * - Aislamiento crítico: search_authorized SOLO devuelve metadata — jamás
 *   fileUrl/fileName/mimeType ni rutas ni contenido binario.
 */
describe('DocumentsAssistant (Fase J3)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };
  const prisma = { document: { findMany: jest.fn() } };

  const adminA: AuthenticatedUser = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
  };
  const employeeA: AuthenticatedUser = {
    sub: 'emp-a',
    email: 'emp-a@test.com',
    role: 'EMPLOYEE',
    companyId: 'company-a',
  };

  let registry: AssistantRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new AssistantRegistry(
      legacyTools as unknown as AiAssistantTools,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      prisma as never,
    );
  });

  it('registra el asistente documents junto a los previos', () => {
    const ids = registry.all().map((assistant) => assistant.id);
    expect(ids).toContain('central');
    expect(ids).toContain('documents');
    const documents = registry.get('documents');
    expect(documents?.module).toBe('documents');
    expect(documents?.tools.map((tool) => tool.name)).toEqual([
      'search_authorized',
    ]);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool(
        'documents',
        'search_authorized',
        employeeA,
        auditService,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas del central no invocables', async () => {
    await expect(
      registry.runTool('documents', 'employees_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant documents/);
  });

  it('search_authorized consulta con el companyId del ctx y recorta el termino', async () => {
    prisma.document.findMany.mockResolvedValue([
      {
        id: 'doc-1',
        name: 'Matriz de riesgos',
        category: 'PROCEDURE',
        status: 'PUBLISHED',
        version: 3,
        expiresAt: new Date('2027-01-01T00:00:00Z'),
        site: { name: 'Planta Norte' },
      },
    ]);
    const { data } = await registry.runTool(
      'documents',
      'search_authorized',
      adminA,
      auditService,
      { search: 'matriz' },
    );
    const query = (prisma.document.findMany.mock.calls[0] as unknown[])[0] as {
      where: { companyId: string };
      select: Record<string, unknown>;
    };
    expect(query.where.companyId).toBe('company-a');
    // Metadata autorizada: NADA de fileUrl/fileName/mimeType en el select.
    expect(Object.keys(query.select)).not.toContain('fileUrl');
    expect(Object.keys(query.select)).not.toContain('fileName');
    expect(Object.keys(query.select)).not.toContain('mimeType');
    expect(data).toEqual({
      total: 1,
      documents: [
        {
          name: 'Matriz de riesgos',
          category: 'PROCEDURE',
          status: 'PUBLISHED',
          version: 3,
          expiresAt: new Date('2027-01-01T00:00:00Z'),
          site: 'Planta Norte',
        },
      ],
    });
  });

  it('search_authorized sin termino devuelve vacio sin consultar', async () => {
    const { data } = await registry.runTool(
      'documents',
      'search_authorized',
      adminA,
      auditService,
    );
    expect(prisma.document.findMany).not.toHaveBeenCalled();
    expect(data).toEqual({ total: 0, documents: [] });
  });

  it('la definicion factory expone solo herramientas READ', () => {
    const definition = createDocumentsAssistant(prisma as never);
    expect(definition.id).toBe('documents');
    expect(definition.allowedRoles).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'SST',
      'AUDITOR',
    ]);
    expect(definition.tools.every((tool) => tool.kind === 'READ')).toBe(true);
  });
});
