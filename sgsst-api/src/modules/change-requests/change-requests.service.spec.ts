import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { ChangeRequestsService } from './change-requests.service';

/**
 * S14: gestion del cambio. La solicitud exige evaluacion de riesgos (riskId
 * same-tenant) y el workflow REQUESTED -> ... -> CLOSED tiene guardas por
 * etapa con auditoria en cada transicion (#38, #39).
 */
describe('ChangeRequestsService - evaluacion y workflow', () => {
  const repository = {
    findMany: jest.fn(),
    findByIdScoped: jest.fn(),
    create: jest.fn(),
    updateScoped: jest.fn(),
    updateStatus: jest.fn(),
    removeScoped: jest.fn(),
  };
  const prisma = {
    risk: { findFirst: jest.fn() },
    document: { findFirst: jest.fn() },
  };
  const auditService = { log: jest.fn() };

  const service = new ChangeRequestsService(
    repository as never,
    prisma,
    auditService as never,
  );

  const user: AuthenticatedUser = {
    sub: 'user-1',
    email: 'sst@a.com',
    role: 'ADMIN',
    companyId: 'company-a',
  };
  const changeId = 'change-1';

  /** Cambio base en REQUESTED con evaluacion completa. */
  function mockChange(overrides: Record<string, unknown> = {}) {
    repository.findByIdScoped.mockResolvedValue({
      id: changeId,
      title: 'Cambio de bomba',
      status: 'REQUESTED',
      riskId: 'risk-1',
      hazards: 'Contacto con partes moviles',
      impacts: 'Atrapamiento',
      controls: 'Guardas y bloqueo LOTO',
      implementationEvidenceId: null,
      implementationNotes: null,
      verificationNotes: null,
      ...overrides,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Evaluacion obligatoria (#38) -------------------------------------------

  it('create valida que el riesgo de la evaluacion sea del tenant', async () => {
    prisma.risk.findFirst.mockResolvedValue({ id: 'risk-1' });
    repository.create.mockResolvedValue({ id: changeId, status: 'REQUESTED' });

    await service.create(user, {
      title: 'Cambio de bomba',
      reason: 'Falla recurrente',
      process: 'Produccion',
      responsible: 'Mantenimiento',
      riskId: 'risk-1',
      companyId: 'company-a',
    });

    expect(prisma.risk.findFirst).toHaveBeenCalledWith({
      where: { id: 'risk-1', companyId: 'company-a' },
      select: { id: true },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'ChangeRequest' }),
    );
  });

  it('create rechaza con 404 un riesgo de otra empresa', async () => {
    prisma.risk.findFirst.mockResolvedValue(null);

    await expect(
      service.create(user, {
        title: 'Cambio de bomba',
        reason: 'Falla recurrente',
        process: 'Produccion',
        responsible: 'Mantenimiento',
        riskId: 'risk-other-tenant',
        companyId: 'company-a',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('update rechaza desasignar el riesgo de un cambio abierto', async () => {
    mockChange({ status: 'EVALUATION' });

    await expect(
      service.update(user, changeId, { riskId: null }),
    ).rejects.toThrow('La evaluacion de riesgos es obligatoria');
    expect(repository.updateScoped).not.toHaveBeenCalled();
  });

  // --- Workflow con guardas (#39) ---------------------------------------------

  it('avanza REQUESTED -> EVALUATION con evaluacion completa y audita', async () => {
    mockChange();
    repository.updateStatus.mockResolvedValue({
      id: changeId,
      status: 'EVALUATION',
    });

    const result = await service.advance(user, changeId, {
      target: 'EVALUATION',
    });

    expect(repository.updateStatus).toHaveBeenCalledWith(
      changeId,
      'company-a',
      { status: 'EVALUATION' },
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CHANGE_FLOW_ADVANCE',
        entity: 'ChangeRequest',
        entityId: changeId,
        before: { status: 'REQUESTED' },
        after: { status: 'EVALUATION' },
      }),
    );
    expect(result.status).toBe('EVALUATION');
  });

  it('rechaza REQUESTED -> EVALUATION sin riesgo asignado', async () => {
    mockChange({ riskId: null });

    await expect(
      service.advance(user, changeId, { target: 'EVALUATION' }),
    ).rejects.toThrow('evaluacion de riesgos');
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('rechaza saltar etapas (REQUESTED -> CONTROLS)', async () => {
    mockChange();

    await expect(
      service.advance(user, changeId, { target: 'CONTROLS' }),
    ).rejects.toThrow('Transicion invalida');
  });

  it('rechaza volver atras en el workflow (EVALUATION -> REQUESTED)', async () => {
    mockChange({ status: 'EVALUATION' });

    await expect(
      service.advance(user, changeId, { target: 'REQUESTED' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza EVALUATION -> CONTROLS sin peligros o impactos', async () => {
    mockChange({ status: 'EVALUATION', hazards: null });

    await expect(
      service.advance(user, changeId, { target: 'CONTROLS' }),
    ).rejects.toThrow('peligros e impactos');
  });

  it('rechaza IMPLEMENTATION -> VERIFICATION sin evidencia de implementacion (#39)', async () => {
    mockChange({ status: 'IMPLEMENTATION' });

    await expect(
      service.advance(user, changeId, { target: 'VERIFICATION' }),
    ).rejects.toThrow('evidencia de implementacion');
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('rechaza VERIFICATION -> CLOSED sin notas de verificacion (#39)', async () => {
    mockChange({ status: 'VERIFICATION' });

    await expect(
      service.advance(user, changeId, { target: 'CLOSED' }),
    ).rejects.toThrow('notas de verificacion');
  });

  it('cierra el cambio con verificacion registrada y audita el cierre', async () => {
    mockChange({
      status: 'VERIFICATION',
      verificationNotes: 'Controles verificados en campo',
    });
    repository.updateStatus.mockResolvedValue({
      id: changeId,
      status: 'CLOSED',
    });

    const result = await service.advance(user, changeId, {
      target: 'CLOSED',
    });

    expect(result.status).toBe('CLOSED');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ after: { status: 'CLOSED' } }),
    );
  });

  it('rechaza cualquier transicion desde CLOSED', async () => {
    mockChange({ status: 'CLOSED' });

    await expect(
      service.advance(user, changeId, { target: 'EVALUATION' }),
    ).rejects.toThrow('El workflow ya esta cerrado');
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('al aprobar (-> IMPLEMENTATION) sella aprobador y fecha', async () => {
    mockChange({ status: 'APPROVAL' });
    repository.updateStatus.mockResolvedValue({
      id: changeId,
      status: 'IMPLEMENTATION',
      approvedById: 'user-1',
    });

    await service.advance(user, changeId, { target: 'IMPLEMENTATION' });

    const statusCall = (
      repository.updateStatus.mock.calls as unknown as Array<
        [
          string,
          string,
          { status: string; approvedById?: string; approvedAt?: Date },
        ]
      >
    )[0];
    expect(statusCall[0]).toBe(changeId);
    expect(statusCall[1]).toBe('company-a');
    expect(statusCall[2].status).toBe('IMPLEMENTATION');
    expect(statusCall[2].approvedById).toBe('user-1');
    expect(statusCall[2].approvedAt).toBeInstanceOf(Date);
  });

  it('rechaza con 404 un cambio de otra empresa al avanzar', async () => {
    repository.findByIdScoped.mockResolvedValue(null);

    await expect(
      service.advance(user, changeId, { target: 'EVALUATION' }),
    ).rejects.toThrow(NotFoundException);
  });
});
