import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from '../assistant-registry';
import { AiAssistantTools } from '../ai-assistant.tools';
import { createEmergencyAssistant } from './emergency.assistant';
import type { AuthenticatedUser } from '../../../../common/types/authenticated-request';

/**
 * Pruebas del asistente de Emergencias (Fase I3, S16 extendido).
 *
 * - Registro: 'emergency' convive con los asistentes previos.
 * - Seguridad: EMPLOYEE fuera, whitelist cerrada, scoping por ToolContext.
 * - Formato: brigades_summary agrega integrantes/rol y cuenta formaciones
 *   vencidas o proximas (30 dias); drills_findings agrega por estado y
 *   severidad de hallazgos abiertos.
 */
describe('EmergencyAssistant (Fase I3)', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 1 }) };
  const emergencyRepo = {
    findBrigadesForAssistant: jest.fn(),
    findDrillsForAssistant: jest.fn(),
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
      undefined,
      emergencyRepo as never,
    );
  });

  it('registra el asistente emergency junto al central', () => {
    expect(registry.all().map((assistant) => assistant.id)).toEqual([
      'central',
      'emergency',
    ]);
    const emergency = registry.get('emergency');
    expect(emergency?.module).toBe('emergency');
    expect(emergency?.tools.map((tool) => tool.name)).toEqual([
      'brigades_summary',
      'drills_findings',
    ]);
  });

  it('EMPLOYEE no puede invocar el asistente', async () => {
    await expect(
      registry.runTool(
        'emergency',
        'brigades_summary',
        employeeA,
        auditService,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('whitelist cerrada: herramientas del central no invocables', async () => {
    await expect(
      registry.runTool('emergency', 'sites_summary', adminA, auditService),
    ).rejects.toThrow(/not available for assistant emergency/);
  });

  it('brigades_summary agrega integrantes por rol y formaciones vencidas', async () => {
    emergencyRepo.findBrigadesForAssistant.mockResolvedValue([
      {
        name: 'Brigada Planta Norte',
        site: { name: 'Planta Norte' },
        members: [
          {
            role: 'LIDER',
            validUntil: new Date('2026-09-01T00:00:00Z'),
            formationCompletedAt: new Date('2025-09-01T00:00:00Z'),
          },
          { role: 'BRIGADISTA', validUntil: null, formationCompletedAt: null },
        ],
      },
    ]);
    const { data } = await registry.runTool(
      'emergency',
      'brigades_summary',
      adminA,
      auditService,
    );
    expect(emergencyRepo.findBrigadesForAssistant).toHaveBeenCalledWith(
      'company-a',
    );
    expect(data).toEqual({
      total: 1,
      totalMembers: 2,
      byRole: { LIDER: 1, BRIGADISTA: 1 },
      expiredFormations: 1,
      brigades: expect.any(Array) as unknown[],
    });
  });

  it('drills_findings agrega por estado y severidad de hallazgos abiertos', async () => {
    emergencyRepo.findDrillsForAssistant.mockResolvedValue([
      {
        name: 'Simulacro de incendio',
        plannedAt: new Date('2026-08-01T00:00:00Z'),
        executedAt: new Date('2026-08-05T00:00:00Z'),
        status: 'COMPLETED',
        plan: { name: 'Plan Piso 2', site: { name: 'Sede Central' } },
        findings: [
          { severity: 'MAJOR', description: 'Ruta bloqueada' },
          { severity: 'MINOR', description: 'Falta senal' },
        ],
      },
      {
        name: 'Simulacro de evacuacion',
        plannedAt: new Date('2026-10-01T00:00:00Z'),
        executedAt: null,
        status: 'PLANNED',
        plan: { name: 'Plan General', site: null },
        findings: [],
      },
    ]);
    const { data } = await registry.runTool(
      'emergency',
      'drills_findings',
      adminA,
      auditService,
    );
    expect(emergencyRepo.findDrillsForAssistant).toHaveBeenCalledWith(
      'company-a',
    );
    expect(data).toEqual({
      total: 2,
      byStatus: { COMPLETED: 1, PLANNED: 1 },
      openFindings: 2,
      bySeverity: { MAJOR: 1, MINOR: 1 },
      drills: expect.any(Array) as unknown[],
    });
  });

  it('la definicion factory expone solo herramientas READ', () => {
    const definition = createEmergencyAssistant(emergencyRepo as never);
    expect(definition.id).toBe('emergency');
    expect(definition.allowedRoles).toEqual([
      'SUPER_ADMIN',
      'ADMIN',
      'SST',
      'AUDITOR',
    ]);
    expect(definition.tools.every((tool) => tool.kind === 'READ')).toBe(true);
  });
});
