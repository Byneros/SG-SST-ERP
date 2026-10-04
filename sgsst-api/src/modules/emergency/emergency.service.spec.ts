import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmergencyService } from './emergency.service';

/**
 * S12: emergencias.
 * - Aislamiento multi-tenant: sede/empleado/plan de otra empresa -> 404.
 * - Reglas de negocio: un plan por sede, empleado duplicado en brigada,
 *   cierre de simulacro sin ejecucion rechazado, ejecucion sella executedAt.
 * - Hard delete con traza en AuditLog (ADR de borrado).
 */
describe('EmergencyService', () => {
  const repository = {
    findBrigades: jest.fn(),
    findBrigadeByIdScoped: jest.fn(),
    createBrigade: jest.fn(),
    updateBrigadeScoped: jest.fn(),
    removeBrigadeScoped: jest.fn(),
    findBrigadeMembers: jest.fn(),
    findBrigadeMemberByIdScoped: jest.fn(),
    createBrigadeMember: jest.fn(),
    updateBrigadeMemberScoped: jest.fn(),
    removeBrigadeMemberScoped: jest.fn(),
    findPlans: jest.fn(),
    findPlanByIdScoped: jest.fn(),
    createPlan: jest.fn(),
    updatePlanScoped: jest.fn(),
    removePlanScoped: jest.fn(),
    createThreat: jest.fn(),
    findThreatByIdScoped: jest.fn(),
    updateThreatScoped: jest.fn(),
    removeThreatScoped: jest.fn(),
    createResource: jest.fn(),
    findResourceByIdScoped: jest.fn(),
    updateResourceScoped: jest.fn(),
    removeResourceScoped: jest.fn(),
    findDrills: jest.fn(),
    findDrillByIdScoped: jest.fn(),
    createDrill: jest.fn(),
    updateDrillScoped: jest.fn(),
    removeDrillScoped: jest.fn(),
    createFinding: jest.fn(),
    findFindingByIdScoped: jest.fn(),
    updateFindingScoped: jest.fn(),
    removeFindingScoped: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const prisma = {
    site: { findFirst: jest.fn() },
    employee: { findFirst: jest.fn() },
    emergencyBrigadeMember: { findFirst: jest.fn() },
    emergencyPlan: { findFirst: jest.fn() },
  };
  let service: EmergencyService;

  const adminA = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  const brigadeA = {
    id: 'brigade-a',
    name: 'Brigada sede norte',
    siteId: 'site-a',
    companyId: 'company-a',
    members: [],
  };

  const planA = {
    id: 'plan-a',
    name: 'Plan emergencias norte',
    siteId: 'site-a',
    companyId: 'company-a',
  };

  const drillA = {
    id: 'drill-a',
    name: 'Simulacro incendio',
    planId: 'plan-a',
    status: 'PLANNED',
    executedAt: null,
    companyId: 'company-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmergencyService(
      repository as never,
      prisma as never,
      auditService as never,
    );
  });

  // --- Brigadas (#31) -----------------------------------------------------------

  it('createBrigade rechaza sede de otra empresa (404)', async () => {
    prisma.site.findFirst.mockResolvedValue(null);

    await expect(
      service.createBrigade(adminA, {
        name: 'Brigada sede norte',
        siteId: 'site-b',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createBrigade).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('createBrigade en camino feliz audita la creacion', async () => {
    prisma.site.findFirst.mockResolvedValue({ id: 'site-a' });
    repository.createBrigade.mockResolvedValue({
      ...brigadeA,
      id: 'brigade-2',
    });

    await service.createBrigade(adminA, {
      name: 'Brigada sede norte',
      siteId: 'site-a',
      companyId: 'company-a',
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'EmergencyBrigade',
        entityId: 'brigade-2',
      }),
    );
  });

  it('createBrigadeMember valida empleado same-tenant y duplicados', async () => {
    repository.findBrigadeByIdScoped.mockResolvedValue(brigadeA);
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(
      service.createBrigadeMember(adminA, brigadeA.id, {
        role: 'BRIGADISTA',
        employeeId: 'employee-b',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-a1' });
    prisma.emergencyBrigadeMember.findFirst.mockResolvedValue({
      id: 'member-1',
    });

    await expect(
      service.createBrigadeMember(adminA, brigadeA.id, {
        role: 'JEFE_BRIGADA',
        employeeId: 'employee-a1',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createBrigadeMember).not.toHaveBeenCalled();
  });

  it('createBrigadeMember en camino feliz audita el integrante', async () => {
    repository.findBrigadeByIdScoped.mockResolvedValue(brigadeA);
    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-a1' });
    prisma.emergencyBrigadeMember.findFirst.mockResolvedValue(null);
    repository.createBrigadeMember.mockResolvedValue({ id: 'member-2' });

    await service.createBrigadeMember(adminA, brigadeA.id, {
      role: 'PRIMEROS_AUXILIOS',
      formationCompletedAt: '2026-01-10T00:00:00.000Z',
      validUntil: '2027-01-10T00:00:00.000Z',
      employeeId: 'employee-a1',
      companyId: 'company-a',
    });

    expect(repository.createBrigadeMember).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'EmergencyBrigadeMember',
        entityId: 'member-2',
      }),
    );
  });

  it('removeBrigade audita el borrado con snapshot previo', async () => {
    repository.findBrigadeByIdScoped.mockResolvedValue(brigadeA);
    repository.removeBrigadeScoped.mockResolvedValue(brigadeA);

    await service.removeBrigade(adminA, brigadeA.id);

    expect(repository.removeBrigadeScoped).toHaveBeenCalledWith(
      brigadeA.id,
      'company-a',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'EmergencyBrigade',
        before: brigadeA,
      }),
    );
  });

  // --- Planes (#32) --------------------------------------------------------------

  it('createPlan rechaza sede de otra empresa y sede con plan existente', async () => {
    prisma.site.findFirst.mockResolvedValue(null);

    await expect(
      service.createPlan(adminA, {
        name: 'Plan emergencias norte',
        siteId: 'site-b',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.site.findFirst.mockResolvedValue({ id: 'site-a' });
    prisma.emergencyPlan.findFirst.mockResolvedValue({ id: 'plan-existing' });

    await expect(
      service.createPlan(adminA, {
        name: 'Plan emergencias norte',
        siteId: 'site-a',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createPlan).not.toHaveBeenCalled();
  });

  it('createPlan en camino feliz crea el plan independiente por sede', async () => {
    prisma.site.findFirst.mockResolvedValue({ id: 'site-a' });
    prisma.emergencyPlan.findFirst.mockResolvedValue(null);
    repository.createPlan.mockResolvedValue({ ...planA, id: 'plan-2' });

    await service.createPlan(adminA, {
      name: 'Plan emergencias norte',
      siteId: 'site-a',
      companyId: 'company-a',
    });

    expect(repository.createPlan).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'EmergencyPlan',
        entityId: 'plan-2',
      }),
    );
  });

  // --- Simulacros (#33) ------------------------------------------------------------

  it('createDrill rechaza plan de otra empresa (404)', async () => {
    repository.findPlanByIdScoped.mockResolvedValue(null);

    await expect(
      service.createDrill(adminA, {
        name: 'Simulacro incendio',
        planId: 'plan-b',
        plannedAt: '2026-06-01T14:00:00.000Z',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createDrill).not.toHaveBeenCalled();
  });

  it('updateDrill sella executedAt al pasar a EXECUTED sin fecha', async () => {
    repository.findDrillByIdScoped.mockResolvedValue(drillA);
    // Captura tipada del data que envia el servicio (evita mocks any).
    let capturedData: Record<string, unknown> | undefined;
    repository.updateDrillScoped.mockImplementation(
      (_id: string, _companyId: string, data: Record<string, unknown>) => {
        capturedData = data;
        return Promise.resolve({
          ...drillA,
          status: 'EXECUTED',
          executedAt: new Date(),
        });
      },
    );

    await service.updateDrill(adminA, drillA.id, { status: 'EXECUTED' });

    const data: Record<string, unknown> | undefined = capturedData;
    expect(data?.executedAt).toBeInstanceOf(Date);
    expect(data?.status).toBe('EXECUTED');
  });

  it('updateDrill rechaza el cierre de un simulacro no ejecutado', async () => {
    repository.findDrillByIdScoped.mockResolvedValue(drillA);

    await expect(
      service.updateDrill(adminA, drillA.id, { status: 'CLOSED' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.updateDrillScoped).not.toHaveBeenCalled();
  });

  it('updateDrill permite cerrar un simulacro ya ejecutado y audita', async () => {
    repository.findDrillByIdScoped.mockResolvedValue({
      ...drillA,
      status: 'EXECUTED',
      executedAt: new Date('2026-06-01T14:30:00.000Z'),
    });
    repository.updateDrillScoped.mockResolvedValue({
      ...drillA,
      status: 'CLOSED',
      executedAt: new Date('2026-06-01T14:30:00.000Z'),
    });

    await service.updateDrill(adminA, drillA.id, { status: 'CLOSED' });

    expect(repository.updateDrillScoped).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        entity: 'EmergencyDrill',
        entityId: drillA.id,
      }),
    );
  });

  it('createFinding valida simulacro same-tenant y audita el hallazgo', async () => {
    repository.findDrillByIdScoped.mockResolvedValue(null);

    await expect(
      service.createFinding(adminA, 'drill-b', {
        description: 'Ruta bloqueada',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    repository.findDrillByIdScoped.mockResolvedValue(drillA);
    repository.createFinding.mockResolvedValue({ id: 'finding-1' });

    await service.createFinding(adminA, drillA.id, {
      description: 'Ruta bloqueada',
      severity: 'MAJOR',
      actionDescription: 'Despejar ruta',
      companyId: 'company-a',
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'EmergencyDrillFinding',
        entityId: 'finding-1',
      }),
    );
  });

  it('updateFinding rechaza hallazgo de otro simulacro (404) y cierra en camino feliz', async () => {
    repository.findFindingByIdScoped.mockResolvedValue({
      id: 'finding-x',
      drillId: 'drill-b',
      closedAt: null,
    });

    await expect(
      service.updateFinding(adminA, drillA.id, 'finding-x', {
        closedAt: '2026-06-02T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    repository.findFindingByIdScoped.mockResolvedValue({
      id: 'finding-1',
      drillId: drillA.id,
      closedAt: null,
    });
    repository.updateFindingScoped.mockResolvedValue({
      id: 'finding-1',
      closedAt: new Date('2026-06-02T00:00:00.000Z'),
    });

    await service.updateFinding(adminA, drillA.id, 'finding-1', {
      closedAt: '2026-06-02T00:00:00.000Z',
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        entity: 'EmergencyDrillFinding',
        entityId: 'finding-1',
      }),
    );
  });
});
