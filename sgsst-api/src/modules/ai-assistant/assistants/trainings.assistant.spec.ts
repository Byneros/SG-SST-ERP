import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { AiAssistantTools } from '../ai-assistant.tools';
import { createTrainingsAssistant } from './trainings.assistant';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de Capacitaciones (Fase H1, S16 extendido).
 *
 * - Registro: 'trainings' convive con los asistentes previos.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada, scoping por ToolContext.
 * - Formato: compliance_summary agrega por anio y sede y recorta recent.
 */
describe('TrainingsAssistant (Fase H1)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };
  const trainingsRepo = { findAllForAssistant: jest.fn() };

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
      trainingsRepo,
    );
  });

  it('registra el asistente trainings junto al central', () => {
    expect(registry.all().map((assistant) => assistant.id)).toEqual([
      'central',
      'trainings',
    ]);
    const trainings = registry.get('trainings');
    expect(trainings?.name).toBe('Asistente de Capacitaciones');
    expect(trainings?.module).toBe('trainings');
    expect(trainings?.tools.map((tool) => tool.name)).toEqual([
      'compliance_summary',
    ]);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool(
        'trainings',
        'compliance_summary',
        employeeA,
        auditService,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas del central no invocables', async () => {
    await expect(
      registry.runTool('trainings', 'employees_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant trainings/);
  });

  it('compliance_summary agrega por anio y sede con el companyId del ctx', async () => {
    trainingsRepo.findAllForAssistant.mockResolvedValue([
      {
        title: 'Alturas',
        description: null,
        date: new Date('2026-03-01T00:00:00Z'),
        siteId: 's1',
      },
      {
        title: 'Induccion',
        description: null,
        date: new Date('2025-02-01T00:00:00Z'),
        siteId: 's1',
      },
      {
        title: 'Bloqueos',
        description: null,
        date: new Date('2026-05-01T00:00:00Z'),
        siteId: null,
      },
    ]);
    const { data } = await registry.runTool(
      'trainings',
      'compliance_summary',
      adminA,
      auditService,
    );
    expect(trainingsRepo.findAllForAssistant).toHaveBeenCalledWith('company-a');
    expect(data).toEqual({
      total: 3,
      byYear: { '2025': 1, '2026': 2 },
      bySite: { s1: 2, 'Sin sede': 1 },
      recent: expect.any(Array) as unknown[],
    });
  });

  it('la definicion factory expone solo herramientas READ y roles completos', () => {
    const definition = createTrainingsAssistant(trainingsRepo as never);
    expect(definition.id).toBe('trainings');
    expect(definition.allowedRoles).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'SST',
      'AUDITOR',
    ]);
    expect(definition.tools.every((tool) => tool.kind === 'READ')).toBe(true);
  });
});
