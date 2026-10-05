import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { ContractorsService } from './contractors.service';

/**
 * S13: flujo de ingreso del contratista (#37) y sede del trabajador (#35).
 * El estado de autorizacion es calculado (la UI nunca decide) y las
 * transiciones del flujo VALIDATION -> INDUCTION -> AUTHORIZED -> WORK ->
 * CLOSED tienen guardas: documentos criticos vencidos bloquean la validacion
 * y el personal sin induccion bloquea la autorizacion.
 */
describe('ContractorsService - flujo de ingreso y sede', () => {
  const repository = {
    findMany: jest.fn(),
    findByIdScoped: jest.fn(),
    create: jest.fn(),
    updateScoped: jest.fn(),
    removeScoped: jest.fn(),
    updateEntryStatus: jest.fn(),
    findWorkers: jest.fn(),
    findWorkerByIdScoped: jest.fn(),
    createWorker: jest.fn(),
    updateWorkerScoped: jest.fn(),
    removeWorkerScoped: jest.fn(),
    findDocuments: jest.fn(),
    findDocumentByIdScoped: jest.fn(),
    createDocument: jest.fn(),
    updateDocumentScoped: jest.fn(),
    removeDocumentScoped: jest.fn(),
    getCompliance: jest.fn(),
  };
  const prisma = {
    contractor: { findFirst: jest.fn() },
    contractorWorker: { findFirst: jest.fn() },
    site: { findFirst: jest.fn() },
    document: { findFirst: jest.fn() },
  };
  const auditService = { log: jest.fn() };

  const service = new ContractorsService(
    repository as never,
    prisma as never,
    auditService as never,
  );

  const user: AuthenticatedUser = {
    sub: 'user-1',
    email: 'sst@a.com',
    role: 'ADMIN',
    companyId: 'company-a',
  };
  const contractorId = 'contractor-a';

  const contractorRow = {
    id: contractorId,
    name: 'Seguridad Total SAS',
    status: 'ACTIVE',
    entryStatus: 'VALIDATION',
  };

  /** Estado base de compliance: contratista activo, todo valido. */
  function mockCompliance(
    overrides: {
      entryStatus?: string;
      contractorStatus?: string;
      byDocumentStatus?: Record<string, number>;
      documentsTotal?: number;
      canAuthorizeEntry?: boolean;
    } = {},
  ) {
    const byDocumentStatus = overrides.byDocumentStatus ?? { VALID: 2 };
    repository.getCompliance.mockResolvedValue({
      contractor: {
        id: contractorId,
        name: contractorRow.name,
        status: overrides.contractorStatus ?? 'ACTIVE',
        entryStatus: overrides.entryStatus ?? 'VALIDATION',
      },
      documentsTotal:
        overrides.documentsTotal ??
        Object.values(byDocumentStatus).reduce((a, b) => a + b, 0),
      byDocumentStatus,
      workersTotal: 1,
      workersActive: 1,
      canAuthorizeEntry: overrides.canAuthorizeEntry ?? true,
      blockingReasons: [],
    });
    repository.findDocuments.mockResolvedValue([]);
    repository.findWorkers.mockResolvedValue([
      { id: 'w1', status: 'ACTIVE', inductedAt: new Date('2026-09-01') },
    ]);
    repository.findByIdScoped.mockResolvedValue(contractorRow);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Estado calculado -------------------------------------------------------

  it('getEntryAuthorization devuelve entryStatus, nextStage y el estado calculado', async () => {
    mockCompliance();

    const result = await service.getEntryAuthorization(user, contractorId);

    expect(result.entryStatus).toBe('VALIDATION');
    expect(result.nextStage).toBe('INDUCTION');
    expect(result.canAuthorizeEntry).toBe(true);
    expect(result.documentsValidated).toBe(true);
    expect(result.workersInducted).toBe(true);
  });

  it('marca documentosValidated=false cuando un documento esta vencido por fecha aunque su estado almacenado sea VALID (#37)', async () => {
    mockCompliance();
    repository.findDocuments.mockResolvedValue([
      {
        id: 'doc-1',
        documentType: 'ARL',
        status: 'VALID',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ]);

    const result = await service.getEntryAuthorization(user, contractorId);

    expect(result.documentsValidated).toBe(false);
    expect(result.expiredByDate).toHaveLength(1);
    expect(result.canAuthorizeEntry).toBe(false);
    expect(result.blockingReasons.join(' ')).toContain('vencido');
  });

  // --- Transiciones del flujo (#37) -------------------------------------------

  it('avanza VALIDATION -> INDUCTION con todos los documentos validos y audita', async () => {
    mockCompliance({ entryStatus: 'VALIDATION' });
    repository.updateEntryStatus.mockResolvedValue({
      ...contractorRow,
      entryStatus: 'INDUCTION',
    });

    const result = await service.advanceEntry(user, contractorId, {
      target: 'INDUCTION',
    });

    expect(repository.updateEntryStatus).toHaveBeenCalledWith(
      contractorId,
      'company-a',
      'INDUCTION',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ENTRY_FLOW_ADVANCE',
        entity: 'Contractor',
        entityId: contractorId,
        before: { entryStatus: 'VALIDATION' },
        after: { entryStatus: 'INDUCTION' },
      }),
    );
    expect(result.entryStatus).toBe('INDUCTION');
    expect(result.nextStage).toBe('AUTHORIZED');
  });

  it('rechaza VALIDATION -> INDUCTION con documentos pendientes', async () => {
    mockCompliance({ byDocumentStatus: { VALID: 1, PENDING: 1 } });

    await expect(
      service.advanceEntry(user, contractorId, { target: 'INDUCTION' }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.updateEntryStatus).not.toHaveBeenCalled();
  });

  it('rechaza VALIDATION -> INDUCTION con documento vencido por fecha (doc critico vencido bloquea)', async () => {
    mockCompliance();
    repository.findDocuments.mockResolvedValue([
      {
        id: 'doc-1',
        documentType: 'ARL',
        status: 'VALID',
        expiresAt: new Date(Date.now() - 60 * 1000),
      },
    ]);

    await expect(
      service.advanceEntry(user, contractorId, { target: 'INDUCTION' }),
    ).rejects.toThrow(
      'No se puede avanzar a Induccion: hay documentos pendientes, vencidos o rechazados',
    );
  });

  it('rechaza saltar etapas (VALIDATION -> AUTHORIZED)', async () => {
    mockCompliance({ entryStatus: 'VALIDATION' });

    await expect(
      service.advanceEntry(user, contractorId, { target: 'AUTHORIZED' }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.updateEntryStatus).not.toHaveBeenCalled();
  });

  it('rechaza volver atras en el flujo (AUTHORIZED -> INDUCTION)', async () => {
    mockCompliance({ entryStatus: 'AUTHORIZED' });

    await expect(
      service.advanceEntry(user, contractorId, { target: 'INDUCTION' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('avanza INDUCTION -> AUTHORIZED solo con todo el personal inducido', async () => {
    mockCompliance({ entryStatus: 'INDUCTION' });
    repository.updateEntryStatus.mockResolvedValue({
      ...contractorRow,
      entryStatus: 'AUTHORIZED',
    });

    const result = await service.advanceEntry(user, contractorId, {
      target: 'AUTHORIZED',
    });

    expect(result.entryStatus).toBe('AUTHORIZED');
    expect(result.nextStage).toBe('WORK');
  });

  it('rechaza INDUCTION -> AUTHORIZED con trabajador activo sin induccion', async () => {
    mockCompliance({ entryStatus: 'INDUCTION' });
    repository.findWorkers.mockResolvedValue([
      { id: 'w1', status: 'ACTIVE', inductedAt: null },
    ]);

    await expect(
      service.advanceEntry(user, contractorId, { target: 'AUTHORIZED' }),
    ).rejects.toThrow('personal sin induccion');
    expect(repository.updateEntryStatus).not.toHaveBeenCalled();
  });

  it('rechaza INDUCTION -> AUTHORIZED sin personal registrado', async () => {
    mockCompliance({ entryStatus: 'INDUCTION' });
    repository.findWorkers.mockResolvedValue([]);

    await expect(
      service.advanceEntry(user, contractorId, { target: 'AUTHORIZED' }),
    ).rejects.toThrow('personal sin induccion');
  });

  it('rechaza INDUCTION -> AUTHORIZED con contratista suspendido', async () => {
    mockCompliance({ entryStatus: 'INDUCTION', contractorStatus: 'SUSPENDED' });

    await expect(
      service.advanceEntry(user, contractorId, { target: 'AUTHORIZED' }),
    ).rejects.toThrow('contratista no activo');
  });

  it('avanza AUTHORIZED -> WORK sin requisitos adicionales', async () => {
    mockCompliance({ entryStatus: 'AUTHORIZED' });
    repository.updateEntryStatus.mockResolvedValue({
      ...contractorRow,
      entryStatus: 'WORK',
    });

    const result = await service.advanceEntry(user, contractorId, {
      target: 'WORK',
    });

    expect(result.entryStatus).toBe('WORK');
    expect(result.nextStage).toBe('CLOSED');
  });

  it('avanza WORK -> CLOSED y cierra el flujo (nextStage null)', async () => {
    mockCompliance({ entryStatus: 'WORK' });
    repository.updateEntryStatus.mockResolvedValue({
      ...contractorRow,
      entryStatus: 'CLOSED',
    });

    const result = await service.advanceEntry(user, contractorId, {
      target: 'CLOSED',
    });

    expect(result.entryStatus).toBe('CLOSED');
    expect(result.nextStage).toBeNull();
  });

  it('rechaza cualquier transicion desde CLOSED', async () => {
    mockCompliance({ entryStatus: 'CLOSED' });

    await expect(
      service.advanceEntry(user, contractorId, { target: 'WORK' }),
    ).rejects.toThrow('El flujo de ingreso ya esta cerrado');
    expect(repository.updateEntryStatus).not.toHaveBeenCalled();
  });

  // --- Sede del trabajador (#35) ----------------------------------------------

  it('createWorker asigna sede same-tenant', async () => {
    mockCompliance();
    repository.findByIdScoped.mockResolvedValue(contractorRow);
    prisma.site.findFirst.mockResolvedValue({ id: 'site-1' });
    prisma.contractorWorker.findFirst.mockResolvedValue(null);
    repository.createWorker.mockResolvedValue({ id: 'w-new' });

    await service.createWorker(user, contractorId, {
      document: '1020304050',
      firstName: 'Ana',
      lastName: 'Perez',
      siteId: 'site-1',
      companyId: 'company-a',
    });

    expect(prisma.site.findFirst).toHaveBeenCalledWith({
      where: { id: 'site-1', companyId: 'company-a' },
      select: { id: true },
    });
    expect(repository.createWorker).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-1' }),
      contractorId,
      'company-a',
    );
  });

  it('createWorker rechaza con 404 una sede de otra empresa', async () => {
    mockCompliance();
    prisma.site.findFirst.mockResolvedValue(null);
    prisma.contractorWorker.findFirst.mockResolvedValue(null);

    await expect(
      service.createWorker(user, contractorId, {
        document: '1020304050',
        firstName: 'Ana',
        lastName: 'Perez',
        siteId: 'site-other-tenant',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.createWorker).not.toHaveBeenCalled();
  });

  it('updateWorker permite desasignar la sede (null) sin validar sede', async () => {
    repository.findWorkerByIdScoped.mockResolvedValue({
      id: 'w1',
      contractorId,
      document: '1020304050',
    });
    repository.updateWorkerScoped.mockResolvedValue({
      id: 'w1',
      siteId: null,
    });

    await service.updateWorker(user, contractorId, 'w1', { siteId: null });

    expect(prisma.site.findFirst).not.toHaveBeenCalled();
    expect(repository.updateWorkerScoped).toHaveBeenCalledWith(
      'w1',
      'company-a',
      { siteId: null },
    );
  });

  it('updateWorker rechaza con 404 una sede de otra empresa', async () => {
    repository.findWorkerByIdScoped.mockResolvedValue({
      id: 'w1',
      contractorId,
      document: '1020304050',
    });
    prisma.site.findFirst.mockResolvedValue(null);

    await expect(
      service.updateWorker(user, contractorId, 'w1', { siteId: 'site-b' }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.updateWorkerScoped).not.toHaveBeenCalled();
  });
});
