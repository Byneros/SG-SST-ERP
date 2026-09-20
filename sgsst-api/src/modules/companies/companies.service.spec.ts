import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service';

/**
 * Pruebas del fix multi-tenant de companies:
 * - GET /companies/:id con empresa activa: una empresa ajena NO existe (404)
 *   y nunca se filtra informacion cross-tenant.
 * - El actor con empresa activa solo puede leer su propia empresa (banner EMPLOYEE).
 * - NIT duplicado sigue rechazandose con 409.
 */
describe('CompaniesService (scope multi-tenant)', () => {
  const companiesRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByNit: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    deleteById: jest.fn(),
  };
  const auditService = {
    log: jest.fn(),
  };
  let service: CompaniesService;

  const companyA = {
    id: 'company-a',
    name: 'Empresa A S.A.S.',
    nit: '900000001-1',
    isActive: true,
  };
  const companyB = {
    id: 'company-b',
    name: 'Empresa B S.A.S.',
    nit: '900000002-2',
    isActive: true,
  };

  const adminA = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };
  const superAdmin = {
    sub: 'super-admin',
    email: 'super@platform.test',
    role: 'SUPER_ADMIN',
    companyId: null,
    activeCompanyId: null as string | null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CompaniesService(
      companiesRepository as never,
      auditService as never,
    );
  });

  it('returns 404 when an ADMIN reads a company outside its tenant', async () => {
    companiesRepository.findById.mockResolvedValue(companyB);

    await expect(service.findOne('company-b', adminA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // Sin fuga: la empresa no se devuelve bajo ninguna forma.
    await expect(service.findOne('company-b', adminA)).rejects.toThrow(
      'Company not found',
    );
  });

  it('allows the ADMIN to read only its own company (EMPLOYEE banner flow)', async () => {
    companiesRepository.findById.mockResolvedValue(companyA);

    await expect(service.findOne('company-a', adminA)).resolves.toEqual(
      companyA,
    );
  });

  it('requires SUPER_ADMIN to select an active company before reading a company detail (403)', async () => {
    // El listado de companies es global (para poder elegir empresa), pero el
    // detalle exige contexto de empresa activa (postura de f7879fb).
    companiesRepository.findById.mockResolvedValue(companyB);

    await expect(service.findOne('company-b', superAdmin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns 404 for SUPER_ADMIN when a selected active company is not the target', async () => {
    companiesRepository.findById.mockResolvedValue(companyB);
    const scopedSuperAdmin = { ...superAdmin, activeCompanyId: 'company-a' };

    await expect(
      service.findOne('company-b', scopedSuperAdmin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects duplicate NIT with 409 before writing an audit log', async () => {
    companiesRepository.findByNit.mockResolvedValue(companyA);

    await expect(
      service.create(
        { name: 'Nueva S.A.S.', nit: '900000001-1' },
        superAdmin,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(companiesRepository.create).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('writes an audit log when creating a company', async () => {
    companiesRepository.findByNit.mockResolvedValue(null);
    companiesRepository.create.mockResolvedValue(companyA);

    await service.create({ name: 'Empresa A S.A.S.', nit: '900000001-1' });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'Company',
        entityId: 'company-a',
      }),
    );
  });

  it('propagates DEACTIVATE on soft delete with the actor context', async () => {
    companiesRepository.findById.mockResolvedValue(companyA);
    companiesRepository.remove.mockResolvedValue({
      ...companyA,
      isActive: false,
    });

    await service.remove('company-a', adminA);

    expect(companiesRepository.remove).toHaveBeenCalledWith('company-a');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DEACTIVATE',
        entity: 'Company',
        entityId: 'company-a',
      }),
    );
  });

  it('returns 404 on update when the target company is outside the tenant', async () => {
    companiesRepository.findById.mockResolvedValue(companyB);

    await expect(
      service.update('company-b', { name: 'Hacked' }, adminA),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(companiesRepository.update).not.toHaveBeenCalled();
  });
});
