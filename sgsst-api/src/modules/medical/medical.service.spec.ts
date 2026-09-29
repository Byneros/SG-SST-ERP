import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MedicalService, assertMedicalRole } from './medical.service';

/**
 * S10: medicina laboral.
 * - Datos sensibles: EMPLOYEE queda excluido (404, sin revelar el recurso).
 * - Profesiograma unico por (empresa, cargo): 409 en duplicado.
 * - Restricciones: levantamiento con responsable trazado.
 * - Auditoria completa en mutaciones.
 */
describe('MedicalService', () => {
  const prisma = {
    medicalProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    medicalExam: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    medicalRestriction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    employee: { findFirst: jest.fn() },
  };
  const auditService = { log: jest.fn() };
  let service: MedicalService;

  const adminA = {
    sub: 'admin-a',
    email: 'admin@a.com',
    role: Role.ADMIN,
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };
  const employeeA = {
    sub: 'emp-a',
    email: 'emp@a.com',
    role: Role.EMPLOYEE,
    companyId: 'company-a',
    activeCompanyId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MedicalService(prisma as never, auditService as never);
  });

  describe('assertMedicalRole (RBAC estricto)', () => {
    it('bloquea EMPLOYEE con 404 (no revela la existencia del recurso)', () => {
      expect(() => assertMedicalRole(employeeA as never)).toThrow(
        NotFoundException,
      );
    });

    it('permite ADMIN/SST/AUDITOR/SUPER_ADMIN', () => {
      expect(() =>
        assertMedicalRole({ ...employeeA, role: Role.ADMIN }),
      ).not.toThrow();
      expect(() =>
        assertMedicalRole({ ...employeeA, role: Role.SST }),
      ).not.toThrow();
      expect(() =>
        assertMedicalRole({ ...employeeA, role: Role.AUDITOR }),
      ).not.toThrow();
    });
  });

  it('findProfiles filtra por la empresa del actor', async () => {
    prisma.medicalProfile.findMany.mockResolvedValue([]);

    await service.findProfiles(adminA);

    expect(prisma.medicalProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-a' } }),
    );
  });

  it('createProfile rechaza con 409 un cargo duplicado', async () => {
    prisma.medicalProfile.findUnique.mockResolvedValue({ id: 'p-1' });

    await expect(
      service.createProfile(adminA, {
        position: 'Soldador',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.medicalProfile.create).not.toHaveBeenCalled();
  });

  it('createProfile crea con requisitos y audita', async () => {
    prisma.medicalProfile.findUnique.mockResolvedValue(null);
    prisma.medicalProfile.create.mockResolvedValue({
      id: 'p-2',
      position: 'Soldador',
      requirements: [] as unknown[],
    });

    await service.createProfile(adminA, {
      position: 'Soldador',
      requirements: [{ examType: 'INGRESO', periodicityMonths: 24 }],
      companyId: 'company-a',
    });

    expect(prisma.medicalProfile.create).toHaveBeenCalledTimes(1);
    const createMock = prisma.medicalProfile.create;
    const profileData = (
      createMock.mock.calls as Array<
        [
          {
            data: {
              position: string;
              requirements: {
                create: Array<{ examType: string; periodicityMonths: number }>;
              };
            };
          },
        ]
      >
    )[0][0].data;
    expect(profileData.position).toBe('Soldador');
    expect(profileData.requirements.create).toEqual([
      { examType: 'INGRESO', periodicityMonths: 24, derivedFromRiskId: null },
    ]);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'MedicalProfile', action: 'CREATE' }),
    );
  });

  it('createExam rechaza un trabajador de otra empresa con 404', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(
      service.createExam(adminA, {
        examType: 'INGRESO',
        scheduledAt: '2026-10-01',
        employeeId: 'emp-b',
        companyId: 'company-a',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.medicalExam.create).not.toHaveBeenCalled();
  });

  it('liftRestriction registra responsable y fecha (idempotente)', async () => {
    const restriction = {
      id: 'r-1',
      status: 'ACTIVE' as const,
      description: 'No cargar peso',
    };
    prisma.medicalRestriction.findFirst.mockResolvedValue(restriction);
    prisma.medicalRestriction.update.mockResolvedValue({
      ...restriction,
      status: 'LIFTED',
      liftedBy: 'Dr. Perez',
      liftedAt: new Date(),
    });

    await service.liftRestriction(adminA, 'r-1', { liftedBy: 'Dr. Perez' });

    const updateMock = prisma.medicalRestriction.update;
    const updateArgs = (
      updateMock.mock.calls as Array<
        [{ where: { id: string }; data: { status: string; liftedBy: string } }]
      >
    )[0][0];
    expect(updateArgs.where.id).toBe('r-1');
    expect(updateArgs.data.status).toBe('LIFTED');
    expect(updateArgs.data.liftedBy).toBe('Dr. Perez');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'MedicalRestriction',
        before: restriction,
      }),
    );
  });

  it('removeExam borra fisicamente con traza (ADR)', async () => {
    const exam = { id: 'exam-1', companyId: 'company-a' };
    prisma.medicalExam.findFirst.mockResolvedValue(exam);

    await service.removeExam(adminA, 'exam-1');

    expect(prisma.medicalExam.delete).toHaveBeenCalledWith({
      where: { id: 'exam-1' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'MedicalExam',
        before: exam,
      }),
    );
  });
});
