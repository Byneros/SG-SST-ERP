import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { AiAssistantTools } from '../ai-assistant.tools';
import { createIncidentsAssistant } from './incidents.assistant';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de Incidentes (Fase F, S16 extendido).
 *
 * - Registro: 'incidents' convive con 'central' y 'risks' cuando se inyectan
 *   IncidentsRepository y UnsafeReportsRepository.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada (tool del central/risks no
 *   invocable desde 'incidents' y viceversa), params validados.
 * - Scoping: los repositorios se llaman con el companyId del ToolContext.
 * - Formato: stats_summary agrega por estado; recurrent_causes agrega por
 *   kind/severidad y cuenta abiertos (status != CLOSED).
 */
describe('IncidentsAssistant (Fase F)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };

  const risksRepo = {
    findAll: jest.fn(),
    findWithoutCorrectiveAction: jest.fn(),
    findOldest: jest.fn(),
  };
  const incidentsRepo = { findAllForAssistant: jest.fn() };
  const unsafeReportsRepo = { findAll: jest.fn() };

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
      incidentsRepo as never,
      unsafeReportsRepo as never,
    );
  });

  it('registra el asistente incidents junto a central y risks', () => {
    expect(registry.all().map((assistant) => assistant.id)).toEqual([
      'central',
      'risks',
      'incidents',
    ]);
    const incidents = registry.get('incidents');
    expect(incidents?.name).toBe('Asistente de Incidentes');
    expect(incidents?.module).toBe('incidents');
    expect(incidents?.tools.map((tool) => tool.name)).toEqual([
      'stats_summary',
      'recurrent_causes',
    ]);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool('incidents', 'stats_summary', employeeA, auditService),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas de otros asistentes no invocables', async () => {
    await expect(
      registry.runTool('incidents', 'matrix_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant incidents/);
    await expect(
      registry.runTool('risks', 'stats_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant risks/);
  });

  it('stats_summary agrega por estado con el companyId del ctx', async () => {
    incidentsRepo.findAllForAssistant.mockResolvedValue([
      { title: 'a', description: 'x', date: new Date(), status: 'PENDING' },
      { title: 'b', description: 'y', date: new Date(), status: 'RESOLVED' },
      { title: 'c', description: 'z', date: new Date(), status: 'RESOLVED' },
    ]);
    const { data } = await registry.runTool(
      'incidents',
      'stats_summary',
      adminA,
      auditService,
    );
    expect(incidentsRepo.findAllForAssistant).toHaveBeenCalledWith('company-a');
    expect(data).toEqual({
      total: 3,
      byStatus: { PENDING: 1, IN_PROGRESS: 0, RESOLVED: 2 },
    });
  });

  it('recurrent_causes agrega por kind/severidad y cuenta abiertos', async () => {
    unsafeReportsRepo.findAll.mockResolvedValue([
      {
        id: '1',
        kind: 'UNSAFE_CONDITION',
        description: 'd1',
        severity: 'MINOR',
        status: 'OPEN',
        createdAt: new Date(),
      },
      {
        id: '2',
        kind: 'UNSAFE_ACT',
        description: 'd2',
        severity: 'MAJOR',
        status: 'IN_PROGRESS',
        createdAt: new Date(),
      },
      {
        id: '3',
        kind: 'UNSAFE_CONDITION',
        description: 'd3',
        severity: 'CRITICAL',
        status: 'CLOSED',
        createdAt: new Date(),
      },
    ]);
    const { data } = await registry.runTool(
      'incidents',
      'recurrent_causes',
      adminA,
      auditService,
    );
    expect(unsafeReportsRepo.findAll).toHaveBeenCalledWith('company-a');
    expect(data).toEqual({
      total: 3,
      open: 2,
      byKind: { UNSAFE_CONDITION: 2, UNSAFE_ACT: 1 },
      bySeverity: { MINOR: 1, MAJOR: 1, CRITICAL: 1 },
    });
  });

  it('la definicion factory expone solo herramientas READ y roles completos', () => {
    const definition = createIncidentsAssistant(
      incidentsRepo as never,
      unsafeReportsRepo as never,
    );
    expect(definition.id).toBe('incidents');
    expect(definition.allowedRoles).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'SST',
      'AUDITOR',
    ]);
    expect(definition.tools.every((tool) => tool.kind === 'READ')).toBe(true);
  });
});
