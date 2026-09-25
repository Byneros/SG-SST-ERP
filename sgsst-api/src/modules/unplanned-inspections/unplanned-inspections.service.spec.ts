import { NotFoundException } from '@nestjs/common';
import { UnplannedInspectionsService } from './unplanned-inspections.service';

/**
 * S9.2: inspecciones no planeadas.
 * - Aislamiento multi-tenant (404 cross-tenant para inspeccion/sede/inspector).
 * - Hallazgo con riskLevel crea ademas un Risk GTC-45 vinculado.
 * - Accion correctiva reutiliza CorrectiveAction (idempotente).
 * - Hard delete con traza (ADR).
 */
describe('UnplannedInspectionsService', () => {
  const repository = {
    findAll: jest.fn(),
    findByIdScoped: jest.fn(),
    create: jest.fn(),
    updateScoped: jest.fn(),
    removeScoped: jest.fn(),
    createFinding: jest.fn(),
    findFindingByIdScoped: jest.fn(),
    updateFinding: jest.fn(),
    createRisk: jest.fn(),
    createCorrectiveAction: jest.fn(),
  };
  const sitesRepository = { findByIdScoped: jest.fn() };
  const usersRepository = { findByIdScoped: jest.fn() };
  const auditService = { log: jest.fn() };
  let service: UnplannedInspectionsService;

  const adminA = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  const inspectionA = {
    id: 'uinsp-1',
    title: 'Visita por queja',
    reason: 'Reporte de trabajador',
    companyId: 'company-a',
    siteId: 'site-a',
    findings: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UnplannedInspectionsService(
      repository as never,
      sitesRepository as never,
      usersRepository as never,
      auditService as never,
    );
  });

  it('findOne devuelve 404 para una inspeccion de otra empresa', async () => {
    repository.findByIdScoped.mockResolvedValue(null);

    await expect(service.findOne(adminA, 'uinsp-b')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('create rechaza una sede de otra empresa con 404', async () => {
    sitesRepository.findByIdScoped.mockResolvedValue(null);

    await expect(
      service.create(adminA, {
        title: 'Inspeccion',
        reason: 'Queja',
        siteId: 'site-b',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('addFinding con riskLevel crea el Risk GTC-45 y lo vincula al hallazgo', async () => {
    repository.findByIdScoped.mockResolvedValue(inspectionA);
    repository.createRisk.mockResolvedValue({
      id: 'risk-1',
      title: 'Riesgo por hallazgo: Piso mojado',
      level: 'HIGH',
    });
    repository.createFinding.mockResolvedValue({
      id: 'finding-1',
      description: 'Piso mojado sin senalizacion',
      severity: 'MAJOR',
      riskId: 'risk-1',
    });

    const finding = await service.addFinding(adminA, 'uinsp-1', {
      description: 'Piso mojado sin senalizacion',
      severity: 'MAJOR',
      riskLevel: 'HIGH',
    });

    expect(finding.riskId).toBe('risk-1');
    expect(repository.createRisk).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-a',
        siteId: 'site-a',
        level: 'HIGH',
      }),
    );
    // Trazabilidad: se audita tambien la creacion del riesgo.
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'Risk', entityId: 'risk-1' }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'InspectionFinding',
        entityId: 'finding-1',
      }),
    );
  });

  it('addFinding sin riskLevel no crea riesgo', async () => {
    repository.findByIdScoped.mockResolvedValue(inspectionA);
    repository.createFinding.mockResolvedValue({
      id: 'finding-2',
      description: 'Cable expuesto',
      severity: 'MINOR',
      riskId: null,
    });

    await service.addFinding(adminA, 'uinsp-1', {
      description: 'Cable expuesto',
      severity: 'MINOR',
    });

    expect(repository.createRisk).not.toHaveBeenCalled();
    expect(repository.createFinding).toHaveBeenCalledWith(
      'uinsp-1',
      expect.objectContaining({ description: 'Cable expuesto' }),
      undefined,
    );
  });

  it('addCorrectiveAction es idempotente cuando el hallazgo ya tiene accion', async () => {
    const existing = { id: 'action-1', title: 'Colocar senalizacion' };
    repository.findFindingByIdScoped.mockResolvedValue({
      id: 'finding-1',
      actionId: 'action-1',
      action: existing,
    });

    const result = await service.addCorrectiveAction(adminA, 'finding-1', {
      title: 'Otra accion',
      responsible: 'X',
      dueDate: '2026-10-20',
    });

    expect(result).toEqual(existing);
    expect(repository.createCorrectiveAction).not.toHaveBeenCalled();
  });

  it('remove borra fisicamente con traza DELETE (ADR)', async () => {
    repository.findByIdScoped.mockResolvedValue(inspectionA);
    repository.removeScoped.mockResolvedValue(inspectionA);

    await expect(service.remove(adminA, 'uinsp-1')).resolves.toEqual({
      id: 'uinsp-1',
      deleted: true,
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'UnplannedInspection',
        before: inspectionA,
      }),
    );
  });
});
