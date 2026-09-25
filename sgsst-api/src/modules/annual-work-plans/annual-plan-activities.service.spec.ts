import { ConflictException, NotFoundException } from '@nestjs/common';
import { AnnualPlanActivitiesService } from './annual-plan-activities.service';

/**
 * Pruebas de actividades del Plan Anual (S8.2):
 * - Aislamiento: plan/actividad de otra empresa -> 404.
 * - Evidencia (documents) de otra empresa -> 404.
 * - Regla de consistencia: DONE exige 100% de avance.
 * - Hard delete con traza en AuditLog (ADR de borrado).
 */
describe('AnnualPlanActivitiesService', () => {
  const activitiesRepository = {
    findAllByPlan: jest.fn(),
    findByIdScoped: jest.fn(),
    findByIdScopedInPlan: jest.fn(),
    create: jest.fn(),
    updateScoped: jest.fn(),
    removeScoped: jest.fn(),
    computePlanProgress: jest.fn(),
  };
  const plansRepository = {
    findByIdScoped: jest.fn(),
  };
  const auditService = {
    log: jest.fn(),
  };
  const prisma = {
    document: {
      findFirst: jest.fn(),
    },
  };
  let service: AnnualPlanActivitiesService;

  const adminA = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  const planA = {
    id: 'plan-a-2026',
    year: 2026,
    status: 'DRAFT',
    companyId: 'company-a',
  };
  const activityA = {
    id: 'act-1',
    name: 'Capacitacion alturas',
    status: 'IN_PROGRESS',
    progress: 50,
    companyId: 'company-a',
    planId: 'plan-a-2026',
    plan: planA,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    plansRepository.findByIdScoped.mockResolvedValue(planA);
    service = new AnnualPlanActivitiesService(
      activitiesRepository as never,
      plansRepository as never,
      auditService as never,
      prisma as never,
    );
  });

  it('findAll lista actividades del plan y devuelve el % de avance del plan', async () => {
    activitiesRepository.findAllByPlan.mockResolvedValue([activityA]);
    activitiesRepository.computePlanProgress.mockResolvedValue(50);

    const result = await service.findAll(adminA, 'plan-a-2026');

    expect(result.data).toEqual([activityA]);
    expect(result.planProgress).toBe(50);
    expect(activitiesRepository.findAllByPlan).toHaveBeenCalledWith(
      'company-a',
      'plan-a-2026',
    );
  });

  it('findAll devuelve 404 si el plan es de otra empresa', async () => {
    plansRepository.findByIdScoped.mockResolvedValue(null);

    await expect(service.findAll(adminA, 'plan-b')).rejects.toThrow(
      NotFoundException,
    );
    expect(activitiesRepository.findAllByPlan).not.toHaveBeenCalled();
  });

  it('create rechaza evidencia (Document) de otra empresa con 404', async () => {
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      service.create(adminA, 'plan-a-2026', {
        name: 'Inspeccion',
        evidenceId: 'doc-b',
        planId: 'plan-a-2026',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(activitiesRepository.create).not.toHaveBeenCalled();
  });

  it('create registra traza CREATE y acepta evidencia de la misma empresa', async () => {
    prisma.document.findFirst.mockResolvedValue({ id: 'doc-a' });
    activitiesRepository.create.mockResolvedValue(activityA);

    await service.create(adminA, 'plan-a-2026', {
      name: 'Capacitacion alturas',
      evidenceId: 'doc-a',
      planId: 'plan-a-2026',
      companyId: 'company-a',
    });

    expect(activitiesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-a',
        planId: 'plan-a-2026',
        evidenceId: 'doc-a',
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'AnnualPlanActivity',
        entityId: 'act-1',
      }),
    );
  });

  it('update rechaza con 409 marcar DONE sin 100% de avance', async () => {
    activitiesRepository.findByIdScopedInPlan.mockResolvedValue(activityA);

    await expect(
      service.update(adminA, 'plan-a-2026', 'act-1', { status: 'DONE' }),
    ).rejects.toThrow(ConflictException);
    expect(activitiesRepository.updateScoped).not.toHaveBeenCalled();
  });

  it('update promueve a DONE cuando el avance llega a 100%', async () => {
    activitiesRepository.findByIdScopedInPlan.mockResolvedValue(activityA);
    activitiesRepository.updateScoped.mockResolvedValue({
      ...activityA,
      progress: 100,
      status: 'DONE',
    });

    await service.update(adminA, 'plan-a-2026', 'act-1', { progress: 100 });

    expect(activitiesRepository.updateScoped).toHaveBeenCalledWith(
      'act-1',
      'company-a',
      expect.objectContaining({ progress: 100, status: 'DONE' }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', before: activityA }),
    );
  });

  it('remove borra fisicamente con traza DELETE (ADR)', async () => {
    activitiesRepository.findByIdScopedInPlan.mockResolvedValue(activityA);
    activitiesRepository.removeScoped.mockResolvedValue(activityA);

    await expect(
      service.remove(adminA, 'plan-a-2026', 'act-1'),
    ).resolves.toEqual({ id: 'act-1', deleted: true });

    expect(activitiesRepository.removeScoped).toHaveBeenCalledWith(
      'act-1',
      'company-a',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'AnnualPlanActivity',
        before: activityA,
      }),
    );
  });
});
