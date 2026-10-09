import { ForbiddenException } from '@nestjs/common';
import { AssistantRegistry } from './assistant-registry';
import { canInvokeTool, canUseAssistant } from './ai-assistant.framework';
import { AiAssistantTools } from './ai-assistant.tools';
import { RisksRepository } from '../risks/risks.repository';
import { IncidentsRepository } from '../incidents/incidents.repository';
import { UnsafeReportsRepository } from '../unsafe-reports/unsafe-reports.repository';
import { FindingsRepository } from '../findings/findings.repository';
import { ActionPlansRepository } from '../actions/action-plans.repository';
import { TrainingsRepository } from '../trainings/trainings.repository';
import { MedicalAssistantRepository } from '../medical/medical.repository';
import { PpeRepository } from '../ppe/ppe.repository';
import { ContractorsRepository } from '../contractors/contractors.repository';
import { CommitteesRepository } from '../committees/committees.repository';
import { EmergencyRepository } from '../emergency/emergency.repository';
import { SgsstAuditsRepository } from '../sgsst-audits/sgsst-audits.repository';
import { AnnualWorkPlansRepository } from '../annual-work-plans/annual-work-plans.repository';
import { AnnualPlanActivitiesRepository } from '../annual-work-plans/annual-plan-activities.repository';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

/**
 * Pruebas del registro de asistentes (Fase C, S16 extendido).
 *
 * - El asistente central expone exactamente las 6 herramientas de la fase 1.
 * - El rol se evalua por asistente y por herramienta (whitelist cerrada).
 * - El companyId del ToolContext se resuelve SOLO en backend
 *   (resolveCompanyScope): SUPER_ADMIN sin empresa activa => 403.
 */
describe('AssistantRegistry (framework Fase C)', () => {
  // Mock plano (no tipado como clase) para poder inspeccionar run() en expects.
  const legacyTools = {
    run: jest.fn().mockResolvedValue({ total: 1 }),
  };
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  let registry: AssistantRegistry;

  const adminA: AuthenticatedUser = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
  };
  const auditorA: AuthenticatedUser = {
    sub: 'auditor-a',
    email: 'auditor-a@test.com',
    role: 'AUDITOR',
    companyId: 'company-a',
  };
  const employeeA: AuthenticatedUser = {
    sub: 'employee-a',
    email: 'employee-a@test.com',
    role: 'EMPLOYEE',
    companyId: 'company-a',
  };
  const superAdminSinEmpresa: AuthenticatedUser = {
    sub: 'super-admin',
    email: 'super@platform.test',
    role: 'SUPER_ADMIN',
    companyId: null,
    activeCompanyId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new AssistantRegistry(
      legacyTools as unknown as AiAssistantTools,
    );
  });

  it('conserva clases de repositorio en la metadata DI de Nest', () => {
    const parameterTypes = Reflect.getMetadata(
      'design:paramtypes',
      AssistantRegistry,
    ) as unknown[];

    expect(parameterTypes).toEqual([
      AiAssistantTools,
      RisksRepository,
      IncidentsRepository,
      UnsafeReportsRepository,
      FindingsRepository,
      ActionPlansRepository,
      TrainingsRepository,
      MedicalAssistantRepository,
      PpeRepository,
      ContractorsRepository,
      CommitteesRepository,
      EmergencyRepository,
      SgsstAuditsRepository,
      AnnualWorkPlansRepository,
      AnnualPlanActivitiesRepository,
      PrismaService,
    ]);
  });

  it('el registro expone el asistente central con sus 6 herramientas', () => {
    const central = registry.get('central');
    expect(central).not.toBeNull();
    expect(central?.tools.map((tool) => tool.name)).toEqual([
      'company_summary',
      'sites_summary',
      'employees_summary',
      'risks_summary',
      'incidents_summary',
      'trainings_summary',
    ]);
    expect(registry.all()).toHaveLength(1);
  });

  it('get() devuelve null para asistentes inexistentes', () => {
    expect(registry.get('riesgos')).toBeNull();
  });

  it('forRole excluye a EMPLOYEE del asistente central', () => {
    expect(registry.forRole('EMPLOYEE')).toHaveLength(0);
    expect(registry.forRole('ADMIN')).toHaveLength(1);
  });

  it('canUseAssistant rechaza roles fuera del contrato', () => {
    const central = registry.get('central')!;
    expect(canUseAssistant(central, employeeA)).toBe(false);
    expect(canUseAssistant(central, adminA)).toBe(true);
  });

  it('runTool delega en la herramienta legacy con el usuario autenticado', async () => {
    const { tool, data } = await registry.runTool(
      'central',
      'risks_summary',
      adminA,
      auditService as never,
    );
    expect(tool.name).toBe('risks_summary');
    expect(data).toEqual({ total: 1 });
    expect(legacyTools.run).toHaveBeenCalledWith('risks_summary', adminA);
  });

  it('runTool rechaza 403 una herramienta fuera de la whitelist del asistente', async () => {
    await expect(
      registry.runTool(
        'central',
        'critical_without_actions',
        adminA,
        auditService as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(legacyTools.run).not.toHaveBeenCalled();
  });

  it('runTool rechaza 403 el asistente inexistente', async () => {
    await expect(
      registry.runTool(
        'riesgos',
        'matrix_summary',
        adminA,
        auditService as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('runTool rechaza 403 a EMPLOYEE sin consultar herramientas', async () => {
    await expect(
      registry.runTool(
        'central',
        'risks_summary',
        employeeA,
        auditService as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(legacyTools.run).not.toHaveBeenCalled();
  });

  it('runTool rechaza 403 a SUPER_ADMIN sin empresa activa (scope sin resolver)', async () => {
    await expect(
      registry.runTool(
        'central',
        'company_summary',
        superAdminSinEmpresa,
        auditService as never,
      ),
    ).rejects.toThrow('A company must be selected');
    expect(legacyTools.run).not.toHaveBeenCalled();
  });

  it('canInvokeTool respeta allowedRoles por herramienta', () => {
    const central = registry.get('central')!;
    const tool = central.tools.find((t) => t.name === 'risks_summary')!;
    expect(canInvokeTool(central, tool, adminA)).toBe(true);
    expect(canInvokeTool(central, tool, { ...adminA, role: 'AUDITOR' })).toBe(
      true,
    );
    expect(canInvokeTool(central, tool, { ...adminA, role: 'EMPLOYEE' })).toBe(
      false,
    );
  });

  it('AUDITOR conserva acceso de lectura al asistente central', async () => {
    const { tool } = await registry.runTool(
      'central',
      'incidents_summary',
      auditorA,
      auditService as never,
    );
    expect(tool.kind).toBe('READ');
  });
});
