import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { FindingsService } from './findings.service';

/**
 * S15.1: hallazgos unificados. Origen trazable same-tenant (404 si es ajeno),
 * owner del tenant, sello de cierre y causas con guardas (sin causas en un
 * hallazgo cerrado). Auditoria por operacion.
 */
describe('FindingsService - S15.1', () => {
  const repository = {
    findMany: jest.fn(),
    findByIdScoped: jest.fn(),
    create: jest.fn(),
    updateScoped: jest.fn(),
    removeScoped: jest.fn(),
    createCause: jest.fn(),
    findCauseByIdScoped: jest.fn(),
    removeCause: jest.fn(),
  };
  const prisma = {
    plannedInspection: { findFirst: jest.fn() },
    unplannedInspection: { findFirst: jest.fn() },
    audit: { findFirst: jest.fn() },
    unsafeReport: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
  };
  const auditService = { log: jest.fn() };
  // S15.3: la generacion automatica de tareas es best-effort; el mock
  // captura las llamadas para verificar el disparo con MAJOR/CRITICAL.
  const tasksService = { createForFinding: jest.fn().mockResolvedValue(null) };

  const service = new FindingsService(
    repository as never,
    prisma,
    auditService as never,
    tasksService as never,
  );

  const user: AuthenticatedUser = {
    sub: 'user-1',
    email: 'sst@a.com',
    role: 'ADMIN',
    companyId: 'company-a',
  };
  const findingId = 'finding-1';

  function mockFinding(overrides: Record<string, unknown> = {}) {
    repository.findByIdScoped.mockResolvedValue({
      id: findingId,
      title: 'Fuga en linea de aire',
      description: 'Perdida constante en el punto 3',
      sourceType: 'MANUAL',
      sourceId: null,
      type: 'NON_CONFORMITY',
      severity: 'MAJOR',
      status: 'OPEN',
      ownerId: null,
      closedAt: null,
      causes: [],
      companyId: 'company-a',
      ...overrides,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Creacion con origen trazable --------------------------------------------

  it('create valida que el origen citado sea del tenant', async () => {
    prisma.unplannedInspection.findFirst.mockResolvedValue({ id: 'insp-1' });
    repository.create.mockResolvedValue({ id: findingId, status: 'OPEN' });

    await service.create(user, {
      title: 'Fuga en linea de aire',
      description: 'Hallazgo desde inspeccion reactiva',
      sourceType: 'INSPECTION_UNPLANNED',
      sourceId: 'insp-1',
      companyId: 'company-a',
    });

    expect(prisma.unplannedInspection.findFirst).toHaveBeenCalledWith({
      where: { id: 'insp-1', companyId: 'company-a' },
      select: { id: true },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'Finding' }),
    );
  });

  it('create rechaza con 404 un origen de otra empresa', async () => {
    prisma.unplannedInspection.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, {
        title: 'Fuga en linea de aire',
        description: 'Hallazgo cruzado',
        sourceType: 'INSPECTION_UNPLANNED',
        sourceId: 'insp-other-tenant',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('create exige sourceId cuando el origen no es MANUAL', async () => {
    await expect(
      service.create(user, {
        title: 'Fuga en linea de aire',
        description: 'Sin origen citado',
        sourceType: 'INSPECTION_PLANNED',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create valida el owner del tenant', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, {
        title: 'Fuga en linea de aire',
        description: 'Owner ajeno',
        sourceType: 'MANUAL',
        ownerId: 'user-other-tenant',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // --- Lectura scoping ----------------------------------------------------------

  it('findOne responde 404 para un hallazgo de otra empresa', async () => {
    repository.findByIdScoped.mockResolvedValue(null);

    await expect(service.findOne(user, findingId)).rejects.toThrow(
      NotFoundException,
    );
  });

  // --- Cierre con sello -----------------------------------------------------------

  it('update sella closedAt al cerrar y audita la transicion', async () => {
    mockFinding();
    repository.updateScoped.mockResolvedValue({
      id: findingId,
      status: 'CLOSED',
      closedAt: new Date(),
    });

    const result = await service.update(user, findingId, {
      status: 'CLOSED',
    });

    expect(result.status).toBe('CLOSED');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', entity: 'Finding' }),
    );
  });

  it('update responde 404 si el hallazgo no existe en el tenant', async () => {
    repository.findByIdScoped.mockResolvedValue(null);

    await expect(
      service.update(user, findingId, { status: 'IN_PROGRESS' }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.updateScoped).not.toHaveBeenCalled();
  });

  // --- Causas ----------------------------------------------------------------------

  it('addCause registra la causa raiz en un hallazgo abierto', async () => {
    mockFinding({ status: 'OPEN' });
    repository.createCause.mockResolvedValue({
      id: 'cause-1',
      causeType: 'Mantencion',
      description: 'Falta de plan de purga',
    });

    const cause = await service.addCause(user, findingId, {
      causeType: 'Mantencion',
      description: 'Falta de plan de purga',
    });

    expect(cause.causeType).toBe('Mantencion');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'FindingCause' }),
    );
  });

  it('addCause rechaza registrar causas en un hallazgo cerrado', async () => {
    mockFinding({ status: 'CLOSED' });

    await expect(
      service.addCause(user, findingId, {
        causeType: 'Mantencion',
        description: 'Tarde para el analisis',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.createCause).not.toHaveBeenCalled();
  });

  it('removeCause elimina una causa del tenant y audita', async () => {
    mockFinding();
    repository.findCauseByIdScoped.mockResolvedValue({
      id: 'cause-1',
      findingId,
    });
    repository.removeCause.mockResolvedValue({
      id: 'cause-1',
    });

    const result = await service.removeCause(user, findingId, 'cause-1');

    expect(result.deleted).toBe(true);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', entity: 'FindingCause' }),
    );
  });

  it('removeCause responde 404 para una causa de otro hallazgo/empresa', async () => {
    mockFinding();
    repository.findCauseByIdScoped.mockResolvedValue(null);

    await expect(
      service.removeCause(user, findingId, 'cause-other'),
    ).rejects.toThrow(NotFoundException);
    expect(repository.removeCause).not.toHaveBeenCalled();
  });

  // --- Borrado ----------------------------------------------------------------------

  it('remove hace hard delete con traza del hallazgo', async () => {
    mockFinding();
    repository.removeScoped.mockResolvedValue({ id: findingId });

    const result = await service.remove(user, findingId);

    expect(result.deleted).toBe(true);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', entity: 'Finding' }),
    );
  });

  // --- Generacion automatica de tareas (S15.3) --------------------------------

  it('create dispara la tarea automatica para hallazgos MAJOR/CRITICAL', async () => {
    prisma.unplannedInspection.findFirst.mockResolvedValue({ id: 'insp-1' });
    repository.create.mockResolvedValue({
      id: findingId,
      severity: 'CRITICAL',
      title: 'Fuga grave',
    });

    await service.create(user, {
      title: 'Fuga grave',
      description: 'Hallazgo critico de inspeccion reactiva',
      sourceType: 'INSPECTION_UNPLANNED',
      sourceId: 'insp-1',
      severity: 'CRITICAL',
    });

    expect(tasksService.createForFinding).toHaveBeenCalledWith(
      expect.objectContaining({ id: findingId, severity: 'CRITICAL' }),
    );
  });

  it('update dispara la tarea automatica al escalar la severidad', async () => {
    mockFinding({ severity: 'MINOR' });
    repository.updateScoped.mockResolvedValue({
      id: findingId,
      severity: 'MAJOR',
      title: 'Fuga en linea de aire',
    });

    await service.update(user, findingId, { severity: 'MAJOR' });

    expect(tasksService.createForFinding).toHaveBeenCalledWith(
      expect.objectContaining({ id: findingId, severity: 'MAJOR' }),
    );
  });
});
