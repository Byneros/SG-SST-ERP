import { NotFoundException } from '@nestjs/common';
import { PlannedInspectionsService } from './planned-inspections.service';

/**
 * S9.1: inspecciones planeadas.
 * - Aislamiento: inspeccion/sede/inspector de otra empresa -> 404.
 * - Checklist por items; hallazgos generan acciones correctivas reutilizando
 *   el modelo CorrectiveAction (trazabilidad hallazgo -> accion -> cierre).
 * - Hard delete con traza en AuditLog (ADR de borrado).
 */
describe('PlannedInspectionsService', () => {
  const repository = {
    findAll: jest.fn(),
    findByIdScoped: jest.fn(),
    create: jest.fn(),
    updateScoped: jest.fn(),
    removeScoped: jest.fn(),
    findItemByIdScoped: jest.fn(),
    updateItemScoped: jest.fn(),
    createFinding: jest.fn(),
    findFindingByIdScoped: jest.fn(),
    updateFinding: jest.fn(),
    createCorrectiveAction: jest.fn(),
  };
  const sitesRepository = {
    findByIdScoped: jest.fn(),
  };
  const usersRepository = {
    findByIdScoped: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const prisma = {
    inspectionFinding: { update: jest.fn() },
  };
  let service: PlannedInspectionsService;

  const adminA = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  const inspectionA = {
    id: 'insp-1',
    title: 'Inspeccion mensual orden y aseo',
    companyId: 'company-a',
    items: [],
    findings: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlannedInspectionsService(
      repository as never,
      sitesRepository as never,
      usersRepository as never,
      auditService as never,
      prisma as never,
    );
  });

  it('findOne devuelve 404 para una inspeccion de otra empresa', async () => {
    repository.findByIdScoped.mockResolvedValue(null);

    await expect(service.findOne(adminA, 'insp-b')).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.findByIdScoped).toHaveBeenCalledWith(
      'insp-b',
      'company-a',
    );
  });

  it('create rechaza una sede de otra empresa con 404', async () => {
    sitesRepository.findByIdScoped.mockResolvedValue(null);

    await expect(
      service.create(adminA, {
        title: 'Inspeccion',
        scheduledAt: '2026-10-01',
        siteId: 'site-b',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('create rechaza un inspector de otra empresa con 404', async () => {
    sitesRepository.findByIdScoped.mockResolvedValue({ id: 'site-a' });
    usersRepository.findByIdScoped.mockResolvedValue(null);

    await expect(
      service.create(adminA, {
        title: 'Inspeccion',
        scheduledAt: '2026-10-01',
        siteId: 'site-a',
        inspectorId: 'user-b',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('create con items del checklist registra traza CREATE', async () => {
    repository.create.mockResolvedValue(inspectionA);

    await service.create(adminA, {
      title: 'Inspeccion mensual',
      scheduledAt: '2026-10-01',
      companyId: 'company-a',
      items: [
        { question: 'Pisos limpios y secos' },
        { question: 'Extintores vigentes' },
      ],
    });

    const [createPayload, scopeCompanyId] = (
      repository.create.mock.calls as unknown as Array<
        [Record<string, unknown>, string]
      >
    )[0];
    const typedPayload = createPayload as {
      items: Array<{ question: string }>;
    };
    expect(typedPayload.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ question: 'Pisos limpios y secos' }),
      ]),
    );
    expect(scopeCompanyId).toBe('company-a');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'PlannedInspection',
        entityId: 'insp-1',
      }),
    );
  });

  it('addCorrectiveAction crea la accion y la vincula al hallazgo', async () => {
    const finding = {
      id: 'finding-1',
      description: 'Extintor vencido',
      severity: 'MAJOR',
      actionId: null,
    };
    const action: Record<string, unknown> = {
      id: 'action-1',
      title: 'Recargar extintor',
      responsible: 'Mantenimiento',
      dueDate: new Date('2026-10-15'),
    };
    repository.findFindingByIdScoped.mockResolvedValue(finding);
    repository.createCorrectiveAction.mockResolvedValue(action);
    prisma.inspectionFinding.update.mockResolvedValue({
      ...finding,
      actionId: 'action-1',
    });

    const result = await service.addCorrectiveAction(adminA, 'finding-1', {
      title: 'Recargar extintor',
      responsible: 'Mantenimiento',
      dueDate: '2026-10-15',
    });

    expect(result).toEqual(action);
    expect(repository.createCorrectiveAction).toHaveBeenCalledWith(
      'finding-1',
      {
        title: 'Recargar extintor',
        responsible: 'Mantenimiento',
        dueDate: '2026-10-15',
      },
    );
    expect(prisma.inspectionFinding.update).toHaveBeenCalledWith({
      where: { id: 'finding-1' },
      data: { actionId: 'action-1' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'CorrectiveAction',
        entityId: 'action-1',
      }),
    );
  });

  it('addCorrectiveAction devuelve la accion existente si el hallazgo ya tiene una', async () => {
    const existing = { id: 'action-1', title: 'Ya creada' };
    repository.findFindingByIdScoped.mockResolvedValue({
      id: 'finding-1',
      actionId: 'action-1',
      action: existing,
    });

    const result = await service.addCorrectiveAction(adminA, 'finding-1', {
      title: 'Otra',
      responsible: 'X',
      dueDate: '2026-10-15',
    });

    expect(result).toEqual(existing);
    expect(repository.createCorrectiveAction).not.toHaveBeenCalled();
  });

  it('remove borra fisicamente con traza DELETE (ADR)', async () => {
    repository.findByIdScoped.mockResolvedValue(inspectionA);
    repository.removeScoped.mockResolvedValue(inspectionA);

    await expect(service.remove(adminA, 'insp-1')).resolves.toEqual({
      id: 'insp-1',
      deleted: true,
    });

    expect(repository.removeScoped).toHaveBeenCalledWith('insp-1', 'company-a');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'PlannedInspection',
        entityId: 'insp-1',
        before: inspectionA,
      }),
    );
  });
});
