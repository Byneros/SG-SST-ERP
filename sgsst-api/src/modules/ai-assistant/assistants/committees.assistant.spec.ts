import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { AiAssistantTools } from '../ai-assistant.tools';
import { createCommitteesAssistant } from './committees.assistant';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de Comites (Fase I2, S16 extendido).
 *
 * - Registro: 'committees' convive con los asistentes previos.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada, scoping por ToolContext.
 * - Formato: meetings_summary agrega por tipo/estado con top-10;
 *   overdue_commitments cuenta vencidos y acota take al tope 20.
 */
describe('CommitteesAssistant (Fase I2)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };
  const committeesRepo = {
    findSummaryForAssistant: jest.fn(),
    findOpenCommitmentsForAssistant: jest.fn(),
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
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      committeesRepo as never,
    );
  });

  it('registra el asistente committees junto al central', () => {
    expect(registry.all().map((assistant) => assistant.id)).toEqual([
      'central',
      'committees',
    ]);
    const committees = registry.get('committees');
    expect(committees?.module).toBe('committees');
    expect(committees?.tools.map((tool) => tool.name)).toEqual([
      'meetings_summary',
      'overdue_commitments',
    ]);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool(
        'committees',
        'meetings_summary',
        employeeA,
        auditService,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas del central no invocables', async () => {
    await expect(
      registry.runTool('committees', 'risks_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant committees/);
  });

  it('meetings_summary agrega por tipo y estado con top-10', async () => {
    committeesRepo.findSummaryForAssistant.mockResolvedValue([
      {
        name: 'COPASST 2026',
        type: 'COPASST',
        status: 'ACTIVE',
        periodStart: new Date('2026-01-01T00:00:00Z'),
        periodEnd: new Date('2026-12-31T00:00:00Z'),
        _count: { members: 6, meetings: 4 },
      },
      {
        name: 'Convivencia 2026',
        type: 'CONVIVENCIA',
        status: 'ACTIVE',
        periodStart: new Date('2026-01-01T00:00:00Z'),
        periodEnd: new Date('2026-12-31T00:00:00Z'),
        _count: { members: 5, meetings: 2 },
      },
    ]);
    const { data } = await registry.runTool(
      'committees',
      'meetings_summary',
      adminA,
      auditService,
    );
    expect(committeesRepo.findSummaryForAssistant).toHaveBeenCalledWith(
      'company-a',
    );
    expect(data).toEqual({
      total: 2,
      byType: { COPASST: 1, CONVIVENCIA: 1 },
      byStatus: { ACTIVE: 2 },
      committees: expect.any(Array) as unknown[],
    });
  });

  it('overdue_commitments cuenta vencidos y acota take al tope 20', async () => {
    committeesRepo.findOpenCommitmentsForAssistant.mockResolvedValue([
      {
        description: 'Entregar acta firmada',
        dueDate: new Date('2026-09-01T00:00:00Z'),
        meeting: {
          number: 3,
          committee: { name: 'COPASST 2026', type: 'COPASST' },
        },
        responsible: { firstName: 'Ana', lastName: 'Gomez', position: 'SST' },
      },
      {
        description: 'Planear capacitacion',
        dueDate: new Date('2026-11-01T00:00:00Z'),
        meeting: {
          number: 4,
          committee: { name: 'COPASST 2026', type: 'COPASST' },
        },
        responsible: { firstName: 'Luis', lastName: 'Perez', position: 'Jefe' },
      },
    ]);
    const { data } = await registry.runTool(
      'committees',
      'overdue_commitments',
      adminA,
      auditService,
      { take: 500 },
    );
    expect(committeesRepo.findOpenCommitmentsForAssistant).toHaveBeenCalledWith(
      'company-a',
      20,
    );
    expect(data).toEqual({
      total: 2,
      overdue: 1,
      commitments: expect.any(Array) as unknown[],
    });
  });

  it('la definicion factory expone solo herramientas READ', () => {
    const definition = createCommitteesAssistant(committeesRepo as never);
    expect(definition.id).toBe('committees');
    expect(definition.allowedRoles).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'SST',
      'AUDITOR',
    ]);
    expect(definition.tools.every((tool) => tool.kind === 'READ')).toBe(true);
  });
});
