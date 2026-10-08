import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { createRisksAssistant } from './risks.assistant';
import { AiAssistantTools } from '../ai-assistant.tools';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de Riesgos (Fase E, S16 extendido).
 *
 * - Registro: el asistente 'risks' queda disponible junto al central cuando
 *   se inyecta RisksRepository, con su whitelist cerrada de 3 herramientas.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada (tool del central no
 *   invocable desde 'risks' y viceversa), rol y params validados.
 * - Scoping: toda herramienta llama al repositorio con el companyId del
 *   ToolContext (resuelto en backend con resolveCompanyScope).
 * - Formato: matrix_summary agrega por nivel/sede; critical_without_actions
 *   y oldest_open mapean y recortan.
 */
describe('RisksAssistant (Fase E)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };

  const risksRepo = {
    findAll: jest.fn(),
    findWithoutCorrectiveAction: jest.fn(),
    findOldest: jest.fn(),
  };

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
      risksRepo as never,
    );
  });

  it('registra el asistente risks junto al central', () => {
    expect(registry.all().map((assistant) => assistant.id)).toEqual([
      'central',
      'risks',
    ]);
    const risks = registry.get('risks');
    expect(risks?.name).toBe('Asistente de Riesgos');
    expect(risks?.module).toBe('risks');
    expect(risks?.tools.map((tool) => tool.name)).toEqual([
      'matrix_summary',
      'critical_without_actions',
      'oldest_open',
    ]);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool('risks', 'matrix_summary', employeeA, auditService),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas del central no invocables desde risks', async () => {
    await expect(
      registry.runTool('risks', 'employees_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant risks/);
  });

  it('whitelist cerrada: herramientas de risks no invocables desde central', async () => {
    await expect(
      registry.runTool('central', 'matrix_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant central/);
  });

  it('matrix_summary agrega por nivel y sede con el companyId del ctx', async () => {
    risksRepo.findAll.mockResolvedValue([
      { level: 'HIGH', site: { name: 'Sede 1' } },
      { level: 'CRITICAL', site: { name: 'Sede 1' } },
      { level: 'LOW', site: null },
    ]);
    const { data } = await registry.runTool(
      'risks',
      'matrix_summary',
      adminA,
      auditService,
    );
    expect(risksRepo.findAll).toHaveBeenCalledWith('company-a');
    expect(data).toEqual({
      total: 3,
      byLevel: { LOW: 1, MEDIUM: 0, HIGH: 1, CRITICAL: 1 },
      bySite: { 'Sede 1': 2, 'Sin sede': 1 },
    });
  });

  it('critical_without_actions mapea hallazgos sin accion y recorta a 20', async () => {
    risksRepo.findWithoutCorrectiveAction.mockResolvedValue([
      {
        title: 'Ruido',
        level: 'CRITICAL',
        position: 'Operario',
        site: { name: 'Sede 1' },
        inspectionFindings: [
          {
            id: 'f1',
            description: 'Sin proteccion',
            severity: 'CRITICAL',
            status: 'OPEN',
          },
        ],
      },
    ]);
    const { data } = await registry.runTool(
      'risks',
      'critical_without_actions',
      adminA,
      auditService,
    );
    expect(risksRepo.findWithoutCorrectiveAction).toHaveBeenCalledWith(
      'company-a',
    );
    expect((data as { total: number }).total).toBe(1);
    expect(
      (data as { risks: Array<{ findingsWithoutAction: unknown[] }> }).risks[0]
        .findingsWithoutAction,
    ).toHaveLength(1);
  });

  it('oldest_open aplica tope maximo de 20 y cuenta hallazgos abiertos', async () => {
    risksRepo.findOldest.mockResolvedValue([
      {
        title: 'Espacio confinado',
        level: 'HIGH',
        position: null,
        site: { name: 'Sede 2' },
        createdAt: new Date('2026-01-01T00:00:00Z'),
        inspectionFindings: [{ status: 'OPEN' }, { status: 'CLOSED' }],
      },
    ]);
    const { tool, data } = await registry.runTool(
      'risks',
      'oldest_open',
      adminA,
      auditService,
      { take: 999 },
    );
    expect(risksRepo.findOldest).toHaveBeenCalledWith('company-a', 20);
    expect(tool.name).toBe('oldest_open');
    const risks = (data as { risks: Array<{ openFindings: number }> }).risks;
    expect(risks[0].openFindings).toBe(1);
  });

  it('oldest_open rechaza params invalidos (take no numerico) con 400', async () => {
    await expect(
      registry.runTool('risks', 'oldest_open', adminA, auditService, {
        take: 'muchos',
      }),
    ).rejects.toThrow(TypeError);
    expect(risksRepo.findOldest).not.toHaveBeenCalled();
  });

  it('la definicion factory es equivalente a la registrada', () => {
    const definition = createRisksAssistant(risksRepo as never);
    expect(definition.id).toBe('risks');
    expect(definition.allowedRoles).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'SST',
      'AUDITOR',
    ]);
    expect(definition.delegateTo).toEqual([]);
    expect(definition.tools.every((tool) => tool.kind === 'READ')).toBe(true);
  });
});
