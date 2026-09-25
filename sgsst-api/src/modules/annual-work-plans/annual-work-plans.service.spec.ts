import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AnnualWorkPlansService } from './annual-work-plans.service';

/**
 * Pruebas del CRUD de Plan Anual de Trabajo (S8.1):
 * - Aislamiento multi-tenant: un plan de otra empresa no existe (404).
 * - Unicidad por (companyId, year): 409 si el anio ya tiene plan.
 * - Hard delete con traza en AuditLog (ADR de estrategia de borrado).
 */
describe('AnnualWorkPlansService', () => {
  const repository = {
    findAll: jest.fn(),
    findByIdScoped: jest.fn(),
    findByYear: jest.fn(),
    create: jest.fn(),
    updateScoped: jest.fn(),
    removeScoped: jest.fn(),
  };
  const auditService = {
    log: jest.fn(),
  };
  let service: AnnualWorkPlansService;

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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnnualWorkPlansService(
      repository as never,
      auditService as never,
    );
  });

  it('findAll resuelve el scope desde el usuario (empresa del actor)', async () => {
    repository.findAll.mockResolvedValue([planA]);

    await service.findAll(adminA);

    expect(repository.findAll).toHaveBeenCalledWith('company-a');
  });

  it('findAll rechaza con 403 un companyId de otra empresa enviado por el cliente', async () => {
    await expect(service.findAll(adminA, 'company-b')).rejects.toThrow(
      ForbiddenException,
    );
    expect(repository.findAll).not.toHaveBeenCalled();
  });

  it('findOne devuelve 404 para un plan de otra empresa', async () => {
    repository.findByIdScoped.mockResolvedValue(null);

    await expect(service.findOne(adminA, 'plan-b-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.findByIdScoped).toHaveBeenCalledWith(
      'plan-b-1',
      'company-a',
    );
  });

  it('create rechaza con 409 un segundo plan del mismo anio', async () => {
    repository.findByYear.mockResolvedValue(planA);

    await expect(
      service.create(adminA, { year: 2026, companyId: 'company-a' }),
    ).rejects.toThrow(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('create registra traza de auditoria CREATE con snapshot after', async () => {
    repository.findByYear.mockResolvedValue(null);
    repository.create.mockResolvedValue(planA);

    await service.create(adminA, { year: 2026, companyId: 'company-a' });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'AnnualWorkPlan',
        entityId: 'plan-a-2026',
        after: planA,
      }),
    );
  });

  it('remove borra fisicamente y deja traza DELETE con before (ADR)', async () => {
    repository.findByIdScoped.mockResolvedValue(planA);
    repository.removeScoped.mockResolvedValue(planA);

    await expect(service.remove(adminA, 'plan-a-2026')).resolves.toEqual({
      id: 'plan-a-2026',
      deleted: true,
    });

    expect(repository.removeScoped).toHaveBeenCalledWith(
      'plan-a-2026',
      'company-a',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'AnnualWorkPlan',
        entityId: 'plan-a-2026',
        before: planA,
      }),
    );
  });

  it('remove devuelve 404 si el plan no existe en la empresa del actor', async () => {
    repository.findByIdScoped.mockResolvedValue(null);

    await expect(service.remove(adminA, 'plan-b-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.removeScoped).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
