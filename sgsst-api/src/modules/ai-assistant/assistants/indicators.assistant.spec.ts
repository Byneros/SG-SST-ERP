import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { AiAssistantTools } from '../ai-assistant.tools';
import { createIndicatorsAssistant } from './indicators.assistant';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de Indicadores (Fase J2, S16 extendido).
 *
 * - Registro: 'indicators' convive con los asistentes previos.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada, scoping por ToolContext.
 * - Formato: plan_progress calcula avance por plan (filtro year) e
 *   indicator_snapshot limita a tope 15 con meta mas reciente.
 */
describe('IndicatorsAssistant (Fase J2)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };
  const plansRepo = { findAll: jest.fn() };
  const activitiesRepo = { computePlanProgress: jest.fn() };
  const prisma = { indicator: { findMany: jest.fn() } };

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
      plansRepo as never,
      activitiesRepo as never,
      prisma as never,
    );
  });

  it('registra el asistente indicators junto a los previos', () => {
    const ids = registry.all().map((assistant) => assistant.id);
    expect(ids).toContain('central');
    expect(ids).toContain('indicators');
    const indicators = registry.get('indicators');
    expect(indicators?.module).toBe('indicators');
    expect(indicators?.tools.map((tool) => tool.name)).toEqual([
      'plan_progress',
      'indicator_snapshot',
    ]);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool('indicators', 'plan_progress', employeeA, auditService),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas del central no invocables', async () => {
    await expect(
      registry.runTool('indicators', 'employees_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant indicators/);
  });

  it('plan_progress calcula el avance de los planes (filtro year opcional)', async () => {
    plansRepo.findAll.mockResolvedValue([
      { id: 'plan-2026', year: 2026, status: 'APPROVED', approvedAt: null },
      { id: 'plan-2025', year: 2025, status: 'DRAFT', approvedAt: null },
    ]);
    activitiesRepo.computePlanProgress
      .mockResolvedValueOnce(42.5)
      .mockResolvedValueOnce(10);
    const { data } = await registry.runTool(
      'indicators',
      'plan_progress',
      adminA,
      auditService,
      { year: 2026 },
    );
    expect(plansRepo.findAll).toHaveBeenCalledWith('company-a');
    expect(activitiesRepo.computePlanProgress).toHaveBeenCalledTimes(1);
    expect(activitiesRepo.computePlanProgress).toHaveBeenCalledWith(
      'company-a',
      'plan-2026',
    );
    expect(data).toEqual({
      total: 1,
      plans: [
        {
          id: 'plan-2026',
          year: 2026,
          status: 'APPROVED',
          approvedAt: null,
          progress: 42.5,
        },
      ],
    });
  });

  it('indicator_snapshot acota take al tope 15 y elige la meta mas reciente', async () => {
    prisma.indicator.findMany.mockResolvedValue([
      {
        id: 'ind-1',
        code: 'IND-ACC',
        name: 'Indice de accidentalidad',
        unit: '%',
        value: 1.2,
        direction: 'LOWER_IS_BETTER',
        targets: [{ period: '2026-09', target: 1 }],
      },
    ]);
    const { data } = await registry.runTool(
      'indicators',
      'indicator_snapshot',
      adminA,
      auditService,
      { take: 99 },
    );
    expect(prisma.indicator.findMany).toHaveBeenCalledTimes(1);
    expect(
      (prisma.indicator.findMany.mock.calls[0] as unknown[])[0],
    ).toMatchObject({ where: { companyId: 'company-a' } });
    expect(data).toEqual({
      total: 1,
      indicators: [
        {
          code: 'IND-ACC',
          name: 'Indice de accidentalidad',
          value: 1.2,
          unit: '%',
          direction: 'LOWER_IS_BETTER',
          latestTarget: { period: '2026-09', target: 1 },
        },
      ],
    });
  });

  it('la definicion factory expone solo herramientas READ', () => {
    const definition = createIndicatorsAssistant(
      plansRepo as never,
      activitiesRepo as never,
      prisma as never,
    );
    expect(definition.id).toBe('indicators');
    expect(definition.allowedRoles).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'SST',
      'AUDITOR',
    ]);
    expect(definition.tools.every((tool) => tool.kind === 'READ')).toBe(true);
  });
});
