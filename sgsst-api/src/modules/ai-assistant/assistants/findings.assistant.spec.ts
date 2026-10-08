import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { AiAssistantTools } from '../ai-assistant.tools';
import { createFindingsAssistant } from './findings.assistant';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de Hallazgos (Fase G, S16 extendido).
 *
 * - Registro: 'findings' convive con 'central', 'risks' e 'incidents' cuando
 *   se inyectan FindingsRepository y ActionPlansRepository.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada (tools de otros asistentes
 *   no invocables y viceversa), params validados antes de ejecutar.
 * - Scoping: los repositorios se llaman con el companyId del ToolContext.
 * - Formato: open_summary agrega por severidad/tipo/origen y cuenta actions
 *   vencidas; overdue_actions aplica tope de 20; repeat_offenders respeta
 *   minCount acotado.
 */
describe('FindingsAssistant (Fase G)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };

  const findingsRepo = {
    findOpenForAssistant: jest.fn(),
    findRepeatOwners: jest.fn(),
  };
  const actionPlansRepo = {
    findOverdueForAssistant: jest.fn(),
    countForFindingsAsistente: jest.fn(),
  };
  // Repos solo para que el registro incluya 'risks' e 'incidents' (asserts
  // de convivencia y whitelist cruzada; no se invocan en estos tests).
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

  const FUTURE = new Date('2099-01-01T00:00:00Z');
  const PAST = new Date('2026-01-01T00:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new AssistantRegistry(
      legacyTools as unknown as AiAssistantTools,
      risksRepo as never,
      incidentsRepo as never,
      unsafeReportsRepo as never,
      findingsRepo as never,
      actionPlansRepo as never,
    );
  });

  it('registra el asistente findings junto a central, risks e incidents', () => {
    expect(registry.all().map((assistant) => assistant.id)).toEqual([
      'central',
      'risks',
      'incidents',
      'findings',
    ]);
    const findings = registry.get('findings');
    expect(findings?.name).toBe('Asistente de Hallazgos');
    expect(findings?.module).toBe('findings');
    expect(findings?.tools.map((tool) => tool.name)).toEqual([
      'open_summary',
      'overdue_actions',
      'repeat_offenders',
    ]);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool('findings', 'open_summary', employeeA, auditService),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas de otros asistentes no invocables', async () => {
    await expect(
      registry.runTool('findings', 'matrix_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant findings/);
    await expect(
      registry.runTool('risks', 'overdue_actions', adminA, auditService),
    ).rejects.toThrow(/not available for assistant risks/);
  });

  it('open_summary agrega por severidad/tipo/origen y cuenta vencidas', async () => {
    findingsRepo.findOpenForAssistant.mockResolvedValue([
      {
        id: 'f1',
        title: 'Fuga de gas',
        severity: 'CRITICAL',
        type: 'NON_CONFORMITY',
        sourceType: 'INSPECTION_PLANNED',
        status: 'OPEN',
        ownerId: 'u1',
        createdAt: PAST,
      },
      {
        id: 'f2',
        title: 'Sin demarcacion',
        severity: 'MINOR',
        type: 'OBSERVATION',
        sourceType: 'MANUAL',
        status: 'IN_PROGRESS',
        ownerId: null,
        createdAt: PAST,
      },
    ]);
    actionPlansRepo.countForFindingsAsistente.mockResolvedValue({
      findings: [
        {
          findingId: 'f1',
          actions: [
            { status: 'IN_PROGRESS', dueDate: PAST },
            { status: 'OPEN', dueDate: FUTURE },
          ],
        },
      ],
    });
    const { data } = await registry.runTool(
      'findings',
      'open_summary',
      adminA,
      auditService,
    );
    expect(findingsRepo.findOpenForAssistant).toHaveBeenCalledWith('company-a');
    expect(actionPlansRepo.countForFindingsAsistente).toHaveBeenCalledWith(
      'company-a',
      ['f1', 'f2'],
    );
    expect(data).toEqual({
      total: 2,
      bySeverity: { MINOR: 1, MAJOR: 0, CRITICAL: 1 },
      byType: { NON_CONFORMITY: 1, OBSERVATION: 1 },
      bySource: { INSPECTION_PLANNED: 1, MANUAL: 1 },
      findingsWithAction: 1,
      findingsWithoutAction: 1,
      overdueActions: 1,
      top: expect.any(Array) as unknown[],
    });
  });

  it('overdue_actions aplica tope maximo de 20 y mapea owner', async () => {
    actionPlansRepo.findOverdueForAssistant.mockResolvedValue([
      {
        id: 'a1',
        title: 'Reparar fuga',
        kind: 'CORRECTIVE',
        status: 'IN_PROGRESS',
        dueDate: PAST,
        sourceType: 'FINDING',
        sourceId: 'f1',
        owner: { id: 'u1', name: 'Maria', email: 'm@x.com' },
      },
    ]);
    const { data } = await registry.runTool(
      'findings',
      'overdue_actions',
      adminA,
      auditService,
      { take: 999 },
    );
    expect(actionPlansRepo.findOverdueForAssistant).toHaveBeenCalledWith(
      'company-a',
      20,
    );
    const actions = (data as { actions: Array<{ owner: string | null }> })
      .actions;
    expect(actions[0].owner).toBe('Maria');
  });

  it('overdue_actions rechaza params invalidos (take no numerico)', async () => {
    await expect(
      registry.runTool('findings', 'overdue_actions', adminA, auditService, {
        take: ' muchas',
      }),
    ).rejects.toThrow(TypeError);
    expect(actionPlansRepo.findOverdueForAssistant).not.toHaveBeenCalled();
  });

  it('repeat_offenders respeta minCount acotado a 50', async () => {
    findingsRepo.findRepeatOwners.mockResolvedValue([
      { ownerId: 'u1', _count: { _all: 5 } },
    ]);
    const { data } = await registry.runTool(
      'findings',
      'repeat_offenders',
      adminA,
      auditService,
      { minCount: 999 },
    );
    expect(findingsRepo.findRepeatOwners).toHaveBeenCalledWith('company-a', 50);
    expect(data).toEqual({
      minCount: 50,
      total: 1,
      owners: [{ ownerId: 'u1', findings: 5 }],
    });
  });

  it('la definicion factory expone solo herramientas READ y roles completos', () => {
    const definition = createFindingsAssistant(
      findingsRepo as never,
      actionPlansRepo as never,
    );
    expect(definition.id).toBe('findings');
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
