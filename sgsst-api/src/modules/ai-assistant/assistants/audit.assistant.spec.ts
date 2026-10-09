import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { AiAssistantTools } from '../ai-assistant.tools';
import { createAuditAssistant } from './audit.assistant';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de Auditorías (Fase J1, S16 extendido).
 *
 * - Registro: 'audit' convive con los asistentes previos.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada, scoping por ToolContext.
 * - Formato: audits_summary expone total/byStatus/openFindings/audits y
 *   recorta take al tope 20.
 */
describe('AuditAssistant (Fase J1)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };
  const auditsRepo = { summaryForAssistant: jest.fn() };

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
      auditsRepo as never,
    );
  });

  it('registra el asistente audit junto a los previos', () => {
    const ids = registry.all().map((assistant) => assistant.id);
    expect(ids).toContain('central');
    expect(ids).toContain('audit');
    const audit = registry.get('audit');
    expect(audit?.module).toBe('sgsst-audits');
    expect(audit?.tools.map((tool) => tool.name)).toEqual(['audits_summary']);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool('audit', 'audits_summary', employeeA, auditService),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas del central no invocables', async () => {
    await expect(
      registry.runTool('audit', 'employees_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant audit/);
  });

  it('audits_summary pasa el companyId del ctx y acota take al tope 20', async () => {
    auditsRepo.summaryForAssistant.mockResolvedValue({
      total: 2,
      byStatus: { PLANNED: 1, IN_PROGRESS: 1 },
      openFindings: 3,
      audits: [
        {
          id: 'audit-1',
          title: 'Auditoría legal 2026',
          status: 'IN_PROGRESS',
          scheduledAt: new Date('2026-10-01T00:00:00Z'),
          auditorName: 'Ana Auditora',
          findings: 4,
          openActions: 2,
        },
      ],
    });
    const { data } = await registry.runTool(
      'audit',
      'audits_summary',
      adminA,
      auditService,
      { take: 99 },
    );
    expect(auditsRepo.summaryForAssistant).toHaveBeenCalledWith(
      'company-a',
      20,
    );
    expect(data).toMatchObject({
      total: 2,
      openFindings: 3,
      audits: expect.any(Array) as unknown[],
    });
  });

  it('la definicion factory expone solo herramientas READ', () => {
    const definition = createAuditAssistant(auditsRepo as never);
    expect(definition.id).toBe('audit');
    expect(definition.allowedRoles).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'SST',
      'AUDITOR',
    ]);
    expect(definition.tools.every((tool) => tool.kind === 'READ')).toBe(true);
  });
});
