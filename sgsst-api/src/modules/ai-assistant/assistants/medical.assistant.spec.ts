import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { AiAssistantTools } from '../ai-assistant.tools';
import { createMedicalAssistant } from './medical.assistant';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de Medicina Laboral (Fase H2, S16 extendido).
 *
 * - Registro: 'medical' convive con los asistentes previos.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada, scoping por ToolContext.
 * - Formato: las herramientas delegan en el repositorio con el companyId del
 *   ctx y devuelven SOLO agregaciones (sin datos clinicos por diseno).
 */
describe('MedicalAssistant (Fase H2)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };
  const medicalRepo = { examSummary: jest.fn(), pveSummary: jest.fn() };

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
      medicalRepo,
    );
  });

  it('registra el asistente medical junto al central', () => {
    expect(registry.all().map((assistant) => assistant.id)).toEqual([
      'central',
      'medical',
    ]);
    const medical = registry.get('medical');
    expect(medical?.name).toBe('Asistente de Medicina Laboral');
    expect(medical?.module).toBe('medical');
    expect(medical?.tools.map((tool) => tool.name)).toEqual([
      'exam_summary',
      'pve_summary',
    ]);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool('medical', 'exam_summary', employeeA, auditService),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas de otros asistentes no invocables', async () => {
    await expect(
      registry.runTool('medical', 'employees_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant medical/);
    await expect(
      registry.runTool('central', 'exam_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant central/);
  });

  it('exam_summary delega en el repositorio con el companyId del ctx', async () => {
    medicalRepo.examSummary.mockResolvedValue({
      total: 5,
      byConcept: { APTO: 4, RESTRICCION: 1 },
      byType: { INGRESO: 2, PERIODICO: 3 },
      nextDueIn30Days: 1,
    });
    const { data } = await registry.runTool(
      'medical',
      'exam_summary',
      adminA,
      auditService,
    );
    expect(medicalRepo.examSummary).toHaveBeenCalledWith('company-a');
    expect(data).toEqual({
      total: 5,
      byConcept: { APTO: 4, RESTRICCION: 1 },
      byType: { INGRESO: 2, PERIODICO: 3 },
      nextDueIn30Days: 1,
    });
  });

  it('pve_summary delega en el repositorio con el companyId del ctx', async () => {
    medicalRepo.pveSummary.mockResolvedValue({
      total: 3,
      byStatus: { SUSPECTED: 2, CONFIRMED: 1 },
      byProgram: { Ruido: 3 },
      totalAbsenceDays: 12,
      withFollowUpScheduled: 2,
    });
    const { data } = await registry.runTool(
      'medical',
      'pve_summary',
      adminA,
      auditService,
    );
    expect(medicalRepo.pveSummary).toHaveBeenCalledWith('company-a');
    expect(data).toEqual({
      total: 3,
      byStatus: { SUSPECTED: 2, CONFIRMED: 1 },
      byProgram: { Ruido: 3 },
      totalAbsenceDays: 12,
      withFollowUpScheduled: 2,
    });
  });

  it('la definicion factory expone solo herramientas READ y roles completos', () => {
    const definition = createMedicalAssistant(medicalRepo as never);
    expect(definition.id).toBe('medical');
    expect(definition.allowedRoles).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'SST',
      'AUDITOR',
    ]);
    expect(definition.tools.every((tool) => tool.kind === 'READ')).toBe(true);
  });
});
