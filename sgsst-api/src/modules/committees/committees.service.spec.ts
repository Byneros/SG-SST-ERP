import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommitteesService } from './committees.service';

/**
 * S11: comites (COPASST y Convivencia).
 * - Aislamiento multi-tenant: comité/acta/integrante de otra empresa -> 404.
 * - Same-tenant en referencias: empleado/acta document de otra empresa -> 404.
 * - Reglas de negocio: periodo, un comite activo por tipo, numero de reunion
 *   unico, duplicado de integrante.
 * - Hard delete con traza en AuditLog (ADR de borrado).
 */
describe('CommitteesService', () => {
  const repository = {
    findMany: jest.fn(),
    findByIdScoped: jest.fn(),
    create: jest.fn(),
    updateScoped: jest.fn(),
    removeScoped: jest.fn(),
    findMembers: jest.fn(),
    findMemberByIdScoped: jest.fn(),
    createMember: jest.fn(),
    updateMemberScoped: jest.fn(),
    removeMemberScoped: jest.fn(),
    findMeetings: jest.fn(),
    findMeetingByIdScoped: jest.fn(),
    createMeeting: jest.fn(),
    updateMeetingScoped: jest.fn(),
    removeMeetingScoped: jest.fn(),
    createCommitment: jest.fn(),
    findCommitmentByIdScoped: jest.fn(),
    updateCommitmentScoped: jest.fn(),
    removeCommitmentScoped: jest.fn(),
    findOverdueCommitments: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const prisma = {
    committee: { findFirst: jest.fn() },
    committeeMember: { findFirst: jest.fn() },
    committeeMeeting: { findFirst: jest.fn() },
    employee: { findFirst: jest.fn() },
    document: { findFirst: jest.fn() },
  };
  let service: CommitteesService;

  const adminA = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };

  const committeeA = {
    id: 'committee-a',
    name: 'COPASST vigencia 2026-2027',
    type: 'COPASST',
    status: 'ACTIVE',
    companyId: 'company-a',
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2027-12-31'),
    members: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommitteesService(
      repository as never,
      prisma as never,
      auditService as never,
    );
  });

  // --- Comites ---------------------------------------------------------------

  it('create audita la creacion del comite', async () => {
    prisma.committee.findFirst.mockResolvedValue(null);
    repository.create.mockResolvedValue({ ...committeeA, id: 'new-c' });

    const result = await service.create(adminA, {
      name: 'COPASST vigencia 2026-2027',
      type: 'COPASST',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2027-12-31T00:00:00.000Z',
      companyId: 'company-a',
    });

    expect(result.id).toBe('new-c');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'Committee',
        entityId: 'new-c',
      }),
    );
  });

  it('create rechaza periodo invalido (fin <= inicio)', async () => {
    await expect(
      service.create(adminA, {
        name: 'COPASST',
        type: 'COPASST',
        periodStart: '2027-01-01T00:00:00.000Z',
        periodEnd: '2026-01-01T00:00:00.000Z',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('create rechaza un segundo comite activo del mismo tipo', async () => {
    prisma.committee.findFirst.mockResolvedValue({ id: committeeA.id });

    await expect(
      service.create(adminA, {
        name: 'Otro COPASST',
        type: 'COPASST',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2027-01-01T00:00:00.000Z',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('findOne responde 404 para un comite de otra empresa', async () => {
    repository.findByIdScoped.mockResolvedValue(null);

    await expect(service.findOne(adminA, 'committee-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findByIdScoped).toHaveBeenCalledWith(
      'committee-b',
      'company-a',
    );
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('remove audita el borrado con el snapshot previo', async () => {
    repository.findByIdScoped.mockResolvedValue(committeeA);
    repository.removeScoped.mockResolvedValue(committeeA);

    await service.remove(adminA, committeeA.id);

    expect(repository.removeScoped).toHaveBeenCalledWith(
      committeeA.id,
      'company-a',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'Committee',
        entityId: committeeA.id,
        before: committeeA,
      }),
    );
  });

  // --- Integrantes -----------------------------------------------------------

  it('createMember rechaza empleado de otra empresa (404)', async () => {
    repository.findByIdScoped.mockResolvedValue(committeeA);
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(
      service.createMember(adminA, committeeA.id, {
        role: 'PRINCIPAL',
        startDate: '2026-01-10T00:00:00.000Z',
        employeeId: 'employee-b',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createMember).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('createMember rechaza duplicado y crea con auditoria en el camino feliz', async () => {
    repository.findByIdScoped.mockResolvedValue(committeeA);
    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-a1' });
    prisma.committeeMember.findFirst.mockResolvedValue({ id: 'member-1' });

    await expect(
      service.createMember(adminA, committeeA.id, {
        role: 'SECRETARY',
        startDate: '2026-01-10T00:00:00.000Z',
        employeeId: 'employee-a1',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.committeeMember.findFirst.mockResolvedValue(null);
    repository.createMember.mockResolvedValue({ id: 'member-2' });

    await service.createMember(adminA, committeeA.id, {
      role: 'SECRETARY',
      startDate: '2026-01-10T00:00:00.000Z',
      employeeId: 'employee-a1',
      companyId: 'company-a',
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'CommitteeMember',
        entityId: 'member-2',
      }),
    );
  });

  // --- Reuniones / actas -------------------------------------------------------

  it('createMeeting rechaza acta de otra empresa (404) y numero duplicado (400)', async () => {
    repository.findByIdScoped.mockResolvedValue(committeeA);
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      service.createMeeting(adminA, committeeA.id, {
        number: 1,
        meetingAt: '2026-02-01T14:00:00.000Z',
        minutesDocumentId: 'document-b',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.document.findFirst.mockResolvedValue({ id: 'document-a' });
    prisma.committeeMeeting.findFirst.mockResolvedValue({ id: 'meeting-1' });

    await expect(
      service.createMeeting(adminA, committeeA.id, {
        number: 1,
        meetingAt: '2026-02-01T14:00:00.000Z',
        minutesDocumentId: 'document-a',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createMeeting).not.toHaveBeenCalled();
  });

  it('createMeeting en camino feliz audita la reunion', async () => {
    repository.findByIdScoped.mockResolvedValue(committeeA);
    prisma.committeeMeeting.findFirst.mockResolvedValue(null);
    repository.createMeeting.mockResolvedValue({ id: 'meeting-2' });

    await service.createMeeting(adminA, committeeA.id, {
      number: 1,
      meetingAt: '2026-02-01T14:00:00.000Z',
      companyId: 'company-a',
    });

    expect(repository.createMeeting).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'CommitteeMeeting',
        entityId: 'meeting-2',
      }),
    );
  });

  // --- Compromisos ------------------------------------------------------------

  it('createCommitment valida meeting same-tenant y responsable same-tenant', async () => {
    prisma.committeeMeeting.findFirst // Busqueda del meeting por id+companyId: no existe para el actor.
      .mockResolvedValueOnce(null);
    repository.findMeetingByIdScoped.mockResolvedValue(null);

    await expect(
      service.createCommitment(adminA, 'meeting-b', {
        description: 'Implementar senalizacion',
        responsibleEmployeeId: 'employee-a1',
        dueDate: '2026-03-01T00:00:00.000Z',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    repository.findMeetingByIdScoped.mockResolvedValue({ id: 'meeting-a' });
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(
      service.createCommitment(adminA, 'meeting-a', {
        description: 'Implementar senalizacion',
        responsibleEmployeeId: 'employee-b',
        dueDate: '2026-03-01T00:00:00.000Z',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createCommitment).not.toHaveBeenCalled();
  });

  it('createCommitment en camino feliz audita el compromiso', async () => {
    repository.findMeetingByIdScoped.mockResolvedValue({ id: 'meeting-a' });
    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-a1' });
    repository.createCommitment.mockResolvedValue({ id: 'commitment-1' });

    await service.createCommitment(adminA, 'meeting-a', {
      description: 'Implementar senalizacion',
      responsibleEmployeeId: 'employee-a1',
      dueDate: '2026-03-01T00:00:00.000Z',
      companyId: 'company-a',
    });

    expect(repository.createCommitment).toHaveBeenCalledWith(
      expect.anything(),
      'meeting-a',
      'company-a',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'CommitteeCommitment',
        entityId: 'commitment-1',
      }),
    );
  });

  // --- Seguimiento ------------------------------------------------------------

  it('getFollowUp filtra los compromisos vencidos al alcance del comite', async () => {
    repository.findByIdScoped.mockResolvedValue(committeeA);
    repository.findMeetings.mockResolvedValue([
      { id: 'meeting-a' },
      { id: 'meeting-a2' },
    ]);
    repository.findOverdueCommitments.mockResolvedValue([
      { id: 'c1', meetingId: 'meeting-a', dueDate: new Date('2026-01-01') },
      { id: 'c2', meetingId: 'meeting-b', dueDate: new Date('2026-01-02') },
    ]);

    const result = await service.getFollowUp(adminA, committeeA.id);

    expect(result.overdueCount).toBe(1);
    expect(result.overdue[0].id).toBe('c1');
    expect(result.committee.id).toBe(committeeA.id);
  });
});
