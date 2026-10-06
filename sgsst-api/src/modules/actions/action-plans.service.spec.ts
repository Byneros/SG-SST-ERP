import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { ActionPlansService } from './action-plans.service';

/**
 * S15.2: plan de accion unificado. Reglas probadas: CORRECTIVE exige hallazgo
 * de origen del tenant, DONE exige evidencia, VERIFIED exige causa raiz
 * (CORRECTIVE) o beneficio esperado (PREVENTIVE/IMPROVEMENT), hallazgo
 * CRITICAL exige verificador distinto del responsable y CANCELLED solo desde
 * OPEN/IN_PROGRESS. Auditoria por transicion.
 */
describe('ActionPlansService - guardas del workflow (#41)', () => {
  const repository = {
    findMany: jest.fn(),
    findByIdScoped: jest.fn(),
    create: jest.fn(),
    updateScoped: jest.fn(),
    updateStatus: jest.fn(),
    removeScoped: jest.fn(),
  };
  const prisma = {
    finding: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
    document: { findFirst: jest.fn() },
  };
  const auditService = { log: jest.fn() };

  const service = new ActionPlansService(
    repository as never,
    prisma,
    auditService as never,
  );

  const admin: AuthenticatedUser = {
    sub: 'user-admin',
    email: 'admin@a.com',
    role: 'ADMIN',
    companyId: 'company-a',
  };
  const sstUser: AuthenticatedUser = {
    sub: 'user-sst',
    email: 'sst@a.com',
    role: 'SST',
    companyId: 'company-a',
  };
  const actionId = 'action-1';
  const dueDate = '2026-12-01T00:00:00.000Z';

  function mockAction(overrides: Record<string, unknown> = {}) {
    repository.findByIdScoped.mockResolvedValue({
      id: actionId,
      title: 'Cerrar fuga de aire',
      description: 'Reparar y documentar',
      kind: 'CORRECTIVE',
      rootCause: null,
      expectedBenefit: null,
      result: null,
      ownerId: null,
      dueDate: new Date(dueDate),
      status: 'OPEN',
      effectiveness: 'PENDING',
      evidenceId: null,
      verifiedById: null,
      verifiedAt: null,
      closedAt: null,
      sourceType: 'FINDING',
      sourceId: 'finding-1',
      companyId: 'company-a',
      ...overrides,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Creacion ------------------------------------------------------------------

  it('create exige hallazgo de origen para una CORRECTIVE', async () => {
    await expect(
      service.create(admin, {
        title: 'Accion sin hallazgo',
        description: 'Debe fallar',
        kind: 'CORRECTIVE',
        dueDate,
        companyId: 'company-a',
      }),
    ).rejects.toThrow('La accion correctiva exige un hallazgo de origen');
  });

  it('create valida que el hallazgo de origen sea del tenant (404 ajeno)', async () => {
    prisma.finding.findFirst.mockResolvedValue(null);

    await expect(
      service.create(admin, {
        title: 'Accion cruzada',
        description: 'Hallazgo de otra empresa',
        kind: 'CORRECTIVE',
        sourceType: 'FINDING',
        sourceId: 'finding-other',
        dueDate,
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('create audita la accion correctiva valida', async () => {
    prisma.finding.findFirst.mockResolvedValue({ id: 'finding-1' });
    repository.create.mockResolvedValue({ id: actionId, status: 'OPEN' });

    await service.create(admin, {
      title: 'Cerrar fuga de aire',
      description: 'Reparar y documentar',
      kind: 'CORRECTIVE',
      sourceType: 'FINDING',
      sourceId: 'finding-1',
      dueDate,
      companyId: 'company-a',
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'ActionPlan' }),
    );
  });

  // --- Avance con evidencia -------------------------------------------------------

  it('advance DONE sin evidencia es rechazado con la guarda', async () => {
    mockAction({ status: 'IN_PROGRESS', evidenceId: null });

    await expect(
      service.advance(admin, actionId, { target: 'DONE' }),
    ).rejects.toThrow('falta evidencia de ejecucion');
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('advance con salto de etapa es rechazado (OPEN -> DONE)', async () => {
    mockAction({ status: 'OPEN' });

    await expect(
      service.advance(admin, actionId, { target: 'DONE' }),
    ).rejects.toThrow('Transicion invalida');
  });

  it('advance IN_PROGRESS -> DONE con evidencia audita la transicion', async () => {
    mockAction({ status: 'IN_PROGRESS', evidenceId: 'doc-1' });
    repository.updateStatus.mockResolvedValue({ id: actionId, status: 'DONE' });

    const result = await service.advance(admin, actionId, { target: 'DONE' });

    expect(result.status).toBe('DONE');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACTION_FLOW_ADVANCE',
        before: { status: 'IN_PROGRESS' },
        after: { status: 'DONE' },
      }),
    );
  });

  // --- Verificacion de eficacia -----------------------------------------------------

  it('verify exige que la accion este en DONE', async () => {
    mockAction({ status: 'IN_PROGRESS' });

    await expect(
      service.verify(admin, actionId, { effectiveness: 'EFFECTIVE' }),
    ).rejects.toThrow('Solo se puede verificar una accion en DONE');
  });

  it('verify de una CORRECTIVE exige causa raiz', async () => {
    mockAction({ status: 'DONE', kind: 'CORRECTIVE', rootCause: null });
    prisma.finding.findFirst.mockResolvedValue({ severity: 'MAJOR' });

    await expect(
      service.verify(admin, actionId, { effectiveness: 'EFFECTIVE' }),
    ).rejects.toThrow('falta causa raiz');
  });

  it('verify de PREVENTIVE/IMPROVEMENT exige beneficio esperado', async () => {
    mockAction({
      status: 'DONE',
      kind: 'IMPROVEMENT',
      sourceType: null,
      sourceId: null,
      expectedBenefit: null,
    });

    await expect(
      service.verify(admin, actionId, { effectiveness: 'EFFECTIVE' }),
    ).rejects.toThrow('falta beneficio o resultado esperado');
  });

  it('verify sella eficacia, verificador y fecha en una CORRECTIVE completa', async () => {
    mockAction({ status: 'DONE', rootCause: 'Falta de plan de purga' });
    prisma.finding.findFirst.mockResolvedValue({ severity: 'MAJOR' });
    repository.updateStatus.mockResolvedValue({
      id: actionId,
      status: 'VERIFIED',
      effectiveness: 'EFFECTIVE',
    });

    const result = await service.verify(admin, actionId, {
      effectiveness: 'EFFECTIVE',
    });

    expect(result.status).toBe('VERIFIED');
    expect(repository.updateStatus).toHaveBeenCalledWith(
      actionId,
      'company-a',
      expect.objectContaining({
        effectiveness: 'EFFECTIVE',
        verifiedById: 'user-admin',
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACTION_VERIFIED' }),
    );
  });

  // --- Regla CRITICAL: verificador distinto ---------------------------------------

  it('verify en hallazgo CRITICAL exige responsable asignado', async () => {
    mockAction({ status: 'DONE', rootCause: 'Causa', ownerId: null });
    prisma.finding.findFirst.mockResolvedValue({ severity: 'CRITICAL' });

    await expect(
      service.verify(admin, actionId, { effectiveness: 'EFFECTIVE' }),
    ).rejects.toThrow('responsable de la accion');
  });

  it('verify en hallazgo CRITICAL rechaza al responsable como verificador', async () => {
    mockAction({
      status: 'DONE',
      rootCause: 'Causa',
      ownerId: 'user-admin',
    });
    prisma.finding.findFirst.mockResolvedValue({ severity: 'CRITICAL' });

    await expect(
      service.verify(admin, actionId, { effectiveness: 'EFFECTIVE' }),
    ).rejects.toThrow('verificador debe ser distinto del responsable');
  });

  it('verify en hallazgo CRITICAL por un verificador distinto es valido', async () => {
    mockAction({
      status: 'DONE',
      rootCause: 'Causa',
      ownerId: 'user-admin',
    });
    prisma.finding.findFirst.mockResolvedValue({ severity: 'CRITICAL' });
    repository.updateStatus.mockResolvedValue({
      id: actionId,
      status: 'VERIFIED',
    });

    const result = await service.verify(sstUser, actionId, {
      effectiveness: 'INEFFECTIVE',
      result: 'Reincidio',
    });

    expect(result.status).toBe('VERIFIED');
    expect(repository.updateStatus).toHaveBeenCalledWith(
      actionId,
      'company-a',
      expect.objectContaining({ verifiedById: 'user-sst' }),
    );
  });

  // --- Cancelacion -------------------------------------------------------------------

  it('cancelar una accion en DONE es rechazado', async () => {
    mockAction({ status: 'DONE' });

    await expect(
      service.update(admin, actionId, { status: 'CANCELLED' }),
    ).rejects.toThrow('Solo se puede cancelar');
    expect(repository.updateScoped).not.toHaveBeenCalled();
  });

  it('cancelar una accion en OPEN sella closedAt y audita', async () => {
    mockAction({ status: 'OPEN' });
    repository.updateScoped.mockResolvedValue({
      id: actionId,
      status: 'CANCELLED',
      closedAt: new Date(),
    });

    const result = await service.update(admin, actionId, {
      status: 'CANCELLED',
    });

    expect(result.status).toBe('CANCELLED');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', entity: 'ActionPlan' }),
    );
  });

  // --- Lectura y borrado scoping ------------------------------------------------------

  it('findOne responde 404 para una accion de otra empresa', async () => {
    repository.findByIdScoped.mockResolvedValue(null);

    await expect(service.findOne(admin, actionId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove hace hard delete con traza', async () => {
    mockAction();
    repository.removeScoped.mockResolvedValue({ id: actionId });

    const result = await service.remove(admin, actionId);

    expect(result.deleted).toBe(true);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', entity: 'ActionPlan' }),
    );
  });
});
