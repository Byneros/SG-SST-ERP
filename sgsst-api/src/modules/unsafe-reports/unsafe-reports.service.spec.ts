import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UnsafeReportsService } from './unsafe-reports.service';

/**
 * S9.3: actos y condiciones inseguras.
 * - Canal de participacion: EMPLOYEE puede reportar.
 * - Anonimato: el reportante anonimo no se expone al EMPLOYEE.
 * - Acciones correctivas idempotentes; hard delete con traza (ADR).
 */
describe('UnsafeReportsService', () => {
  const repository = {
    findAll: jest.fn(),
    findByIdScoped: jest.fn(),
    create: jest.fn(),
    updateScoped: jest.fn(),
    removeScoped: jest.fn(),
    createFinding: jest.fn(),
    findFindingByIdScoped: jest.fn(),
    createCorrectiveAction: jest.fn(),
  };
  const sitesRepository = { findByIdScoped: jest.fn() };
  const auditService = { log: jest.fn() };
  let service: UnsafeReportsService;

  const employeeA = {
    sub: 'emp-a',
    email: 'emp@a.com',
    role: Role.EMPLOYEE,
    companyId: 'company-a',
    activeCompanyId: null,
  };
  const adminA = {
    sub: 'admin-a',
    email: 'admin@a.com',
    role: Role.ADMIN,
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  const anonymousReport = {
    id: 'report-1',
    kind: 'UNSAFE_ACT',
    description: 'Trabajador sin arnes en altura',
    isAnonymous: true,
    reporterId: null,
    reporterName: null,
    companyId: 'company-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UnsafeReportsService(
      repository as never,
      sitesRepository as never,
      auditService as never,
    );
  });

  it('EMPLOYEE crea un reporte anonimo y no se guarda el reporter', async () => {
    repository.create.mockResolvedValue(anonymousReport);

    await service.create(employeeA, {
      kind: 'UNSAFE_ACT',
      description: 'Trabajador sin arnes en altura',
      severity: 'CRITICAL',
      isAnonymous: true,
      reporterName: 'Juan',
      companyId: 'company-a',
    });

    // create() recibe reporterId del actor, pero el repositorio lo omite por
    // ser anonimo; ademas el reporterName declarado no se persiste.
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isAnonymous: true }),
      'company-a',
      'emp-a',
    );
  });

  it('findOne oculta el reportante anonimo para EMPLOYEE', async () => {
    repository.findByIdScoped.mockResolvedValue(anonymousReport);

    const result = await service.findOne(employeeA, 'report-1');

    expect(result.reporter).toBeNull();
    expect(result.reporterName).toBeNull();
  });

  it('findOne expone el reportante anonimo a ADMIN (seguimiento interno)', async () => {
    repository.findByIdScoped.mockResolvedValue({
      ...anonymousReport,
      reporter: { id: 'u1', name: 'Autor interno' },
    });

    const result = await service.findOne(adminA, 'report-1');

    expect(result.reporter).not.toBeNull();
  });

  it('findOne devuelve 404 para un reporte de otra empresa', async () => {
    repository.findByIdScoped.mockResolvedValue(null);

    await expect(service.findOne(adminA, 'report-b')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('addCorrectiveAction es idempotente cuando el hallazgo ya tiene accion', async () => {
    const existing = { id: 'action-1', title: 'Capacitacion' };
    repository.findFindingByIdScoped.mockResolvedValue({
      id: 'finding-1',
      actionId: 'action-1',
      action: existing,
    });

    const result = await service.addCorrectiveAction(adminA, 'finding-1', {
      title: 'Otra',
      responsible: 'X',
      dueDate: '2026-10-25',
    });

    expect(result).toEqual(existing);
    expect(repository.createCorrectiveAction).not.toHaveBeenCalled();
  });

  it('remove borra fisicamente con traza DELETE (ADR)', async () => {
    repository.findByIdScoped.mockResolvedValue(anonymousReport);
    repository.removeScoped.mockResolvedValue(anonymousReport);

    await expect(service.remove(adminA, 'report-1')).resolves.toEqual({
      id: 'report-1',
      deleted: true,
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'UnsafeReport',
        before: anonymousReport,
      }),
    );
  });
});
