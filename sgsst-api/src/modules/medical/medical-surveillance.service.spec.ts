import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MedicalService, RISK_LEVEL_REQUIREMENTS } from './medical.service';

/**
 * #25.2 (derivacion de requisitos medicos desde riesgos del cargo) y
 * S10.4 (vigilancia epidemiologica: programas y cohortes de expuestos).
 */
describe('MedicalService - derivacion y vigilancia epidemiologica', () => {
  const prisma = {
    medicalProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    medicalExamRequirement: { create: jest.fn() },
    medicalSurveillanceProgram: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    medicalSurveillanceCohort: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    risk: { findFirst: jest.fn(), findMany: jest.fn() },
    employee: { findFirst: jest.fn(), findMany: jest.fn() },
  };
  const auditService = { log: jest.fn() };
  let service: MedicalService;

  const admin = {
    sub: 'admin-a',
    email: 'admin@a.com',
    role: Role.ADMIN,
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };
  const sst = {
    sub: 'sst-a',
    email: 'sst@a.com',
    role: Role.SST,
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  };
  const employee = {
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

  describe('RISK_LEVEL_REQUIREMENTS (politica de derivacion)', () => {
    it('CRITICAL exige ingreso + periodico semestral; LOW no exige nada', () => {
      expect(RISK_LEVEL_REQUIREMENTS.CRITICAL).toEqual([
        { examType: 'INGRESO', periodicityMonths: 0 },
        { examType: 'PERIODICO', periodicityMonths: 6 },
      ]);
      expect(RISK_LEVEL_REQUIREMENTS.LOW).toEqual([]);
    });
  });

  describe('#25.2 deriveRequirementsFromRisk', () => {
    const profile = {
      id: 'profile-1',
      position: 'Operario',
      riskId: 'risk-1',
      companyId: 'company-a',
      requirements: [],
    };

    it('deriva INGRESO+PERIODICO(6m) desde un riesgo CRITICAL del cargo', async () => {
      prisma.medicalProfile.findFirst.mockResolvedValue({ ...profile });
      prisma.risk.findMany.mockResolvedValue([
        {
          id: 'risk-1',
          title: 'Ruido',
          level: 'CRITICAL',
          position: 'Operario',
        },
      ]);
      prisma.medicalExamRequirement.create
        .mockResolvedValueOnce({
          id: 'req-1',
          examType: 'INGRESO',
          periodicityMonths: 0,
        })
        .mockResolvedValueOnce({
          id: 'req-2',
          examType: 'PERIODICO',
          periodicityMonths: 6,
        });

      const result = await service.deriveRequirementsFromRisk(
        admin,
        'profile-1',
        {
          companyId: 'company-a',
        },
      );

      expect(result.worstRiskLevel).toBe('CRITICAL');
      expect(result.created.map((r) => r.examType)).toEqual([
        'INGRESO',
        'PERIODICO',
      ]);
      expect(prisma.medicalExamRequirement.create).toHaveBeenCalledTimes(2);
      // Trazabilidad del origen del requisito.
      expect(prisma.medicalExamRequirement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ derivedFromRiskId: 'risk-1' }),
        }),
      );
      // La derivacion queda auditada.
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'MedicalExamRequirement' }),
      );
    });

    it('es idempotente: no duplica el INGRESO ya derivado, pero completa el PERIODICO', async () => {
      prisma.medicalProfile.findFirst.mockResolvedValue({
        ...profile,
        requirements: [
          {
            id: 'req-1',
            examType: 'INGRESO',
            periodicityMonths: 0,
            derivedFromRiskId: 'risk-1',
          },
        ],
      });
      prisma.risk.findMany.mockResolvedValue([
        {
          id: 'risk-1',
          title: 'Ruido',
          level: 'CRITICAL',
          position: 'Operario',
        },
      ]);
      prisma.medicalExamRequirement.create.mockResolvedValue({
        id: 'req-2',
        examType: 'PERIODICO',
        periodicityMonths: 6,
      });

      const result = await service.deriveRequirementsFromRisk(
        sst,
        'profile-1',
        {
          companyId: 'company-a',
        },
      );

      // El INGRESO ya derivado no se re-crea; el PERIODICO faltante si.
      expect(prisma.medicalExamRequirement.create).toHaveBeenCalledTimes(1);
      expect(result.created.map((r) => r.examType)).toEqual(['PERIODICO']);
    });

    it('toma el peor nivel cuando el cargo tiene varios riesgos', async () => {
      prisma.medicalProfile.findFirst.mockResolvedValue({
        ...profile,
        riskId: null,
      });
      prisma.risk.findMany.mockResolvedValue([
        { id: 'risk-2', title: 'Pantalla', level: 'LOW', position: 'Operario' },
        { id: 'risk-3', title: 'Altura', level: 'HIGH', position: 'Operario' },
      ]);
      prisma.medicalExamRequirement.create
        .mockResolvedValueOnce({
          id: 'req-3',
          examType: 'INGRESO',
          periodicityMonths: 0,
        })
        .mockResolvedValueOnce({
          id: 'req-4',
          examType: 'PERIODICO',
          periodicityMonths: 12,
        });

      const result = await service.deriveRequirementsFromRisk(
        admin,
        'profile-1',
        {
          companyId: 'company-a',
        },
      );

      expect(result.worstRiskLevel).toBe('HIGH');
      expect(result.created.map((r) => r.periodicityMonths)).toEqual([0, 12]);
    });

    it('404 si el perfil no existe o no tiene riesgos asociados al cargo', async () => {
      prisma.medicalProfile.findFirst.mockResolvedValue(null);
      await expect(
        service.deriveRequirementsFromRisk(admin as never, 'nope', {
          companyId: 'company-a',
        }),
      ).rejects.toThrow(NotFoundException);

      prisma.medicalProfile.findFirst.mockResolvedValue({ ...profile });
      prisma.risk.findMany.mockResolvedValue([]);
      await expect(
        service.deriveRequirementsFromRisk(admin as never, 'profile-1', {
          companyId: 'company-a',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('EMPLOYEE no puede derivar requisitos (404 del guard de datos sensibles)', async () => {
      await expect(
        service.deriveRequirementsFromRisk(employee as never, 'profile-1', {
          companyId: 'company-a',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.medicalProfile.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('S10.4 vigilancia epidemiologica', () => {
    it('crea programa PVE con owner y audit trail', async () => {
      prisma.medicalSurveillanceProgram.create.mockResolvedValue({
        id: 'pve-1',
        name: 'PVE biomecanico',
        riskType: 'BIOMECANICO',
        companyId: 'company-a',
      });

      const result = await service.createSurveillanceProgram(admin, {
        name: 'PVE biomecanico',
        riskType: 'BIOMECANICO',
        objective: 'Vigilar expuestos a manejo de cargas',
        companyId: 'company-a',
      });

      expect(result.id).toBe('pve-1');
      expect(prisma.medicalSurveillanceProgram.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          riskType: 'BIOMECANICO',
          companyId: 'company-a',
        }),
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'MedicalSurveillanceProgram',
          action: 'CREATE',
        }),
      );
    });

    it('deriva la cohorte desde un riesgo con cargo: conecta los expuestos por position', async () => {
      prisma.medicalSurveillanceProgram.findFirst.mockResolvedValue({
        id: 'pve-1',
      });
      prisma.risk.findFirst.mockResolvedValue({
        id: 'risk-1',
        title: 'Manejo de cargas',
        level: 'HIGH',
        position: 'Operario',
        siteId: null,
        site: null,
      });
      prisma.employee.findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
      prisma.medicalSurveillanceCohort.findUnique.mockResolvedValue(null);
      prisma.medicalSurveillanceCohort.create.mockResolvedValue({
        id: 'coh-1',
        workers: [{ id: 'e1' }, { id: 'e2' }],
      });

      const result = await service.deriveSurveillanceCohort(sst, 'pve-1', {
        riskId: 'risk-1',
        companyId: 'company-a',
      });

      // La poblacion expuesta se filtra por el cargo del riesgo.
      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({
            position: 'Operario',
            deletedAt: null,
          }),
        }),
      );
      expect(result.workersCount).toBe(2);
      expect(result.reviewed).toBe(false);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'MedicalSurveillanceCohort',
          action: 'CREATE',
        }),
      );
    });

    it('sin cargo en el riesgo, la cohorte usa la sede (cohorte por localizacion)', async () => {
      prisma.medicalSurveillanceProgram.findFirst.mockResolvedValue({
        id: 'pve-1',
      });
      prisma.risk.findFirst.mockResolvedValue({
        id: 'risk-9',
        title: 'Riesgo de bodega',
        level: 'MEDIUM',
        position: null,
        siteId: 'site-1',
        site: { id: 'site-1', name: 'Bodega Norte' },
      });
      prisma.employee.findMany.mockResolvedValue([{ id: 'e9' }]);
      prisma.medicalSurveillanceCohort.findUnique.mockResolvedValue(null);
      prisma.medicalSurveillanceCohort.create.mockResolvedValue({
        id: 'coh-9',
        workers: [{ id: 'e9' }],
      });

      await service.deriveSurveillanceCohort(admin, 'pve-1', {
        riskId: 'risk-9',
        companyId: 'company-a',
      });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          where: expect.objectContaining({ siteId: 'site-1' }),
        }),
      );
    });

    it('refrescar la cohorte no la duplica (upsert por programa+riesgo)', async () => {
      prisma.medicalSurveillanceProgram.findFirst.mockResolvedValue({
        id: 'pve-1',
      });
      prisma.risk.findFirst.mockResolvedValue({
        id: 'risk-1',
        title: 'Ruido',
        level: 'CRITICAL',
        position: 'Operario',
        siteId: null,
        site: null,
      });
      prisma.employee.findMany.mockResolvedValue([
        { id: 'e1' },
        { id: 'e2' },
        { id: 'e3' },
      ]);
      prisma.medicalSurveillanceCohort.findUnique.mockResolvedValue({
        id: 'coh-1',
        workers: [{ id: 'e1' }],
      });
      prisma.medicalSurveillanceCohort.update.mockResolvedValue({
        id: 'coh-1',
        workers: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
      });

      const result = await service.deriveSurveillanceCohort(admin, 'pve-1', {
        riskId: 'risk-1',
        companyId: 'company-a',
      });

      expect(prisma.medicalSurveillanceCohort.create).not.toHaveBeenCalled();
      expect(prisma.medicalSurveillanceCohort.update).toHaveBeenCalled();
      expect(result.reviewed).toBe(true);
      expect(result.workersCount).toBe(3);
    });

    it('404 cross-tenant: programa o riesgo de otra empresa no existen aqui', async () => {
      prisma.medicalSurveillanceProgram.findFirst.mockResolvedValue(null);
      await expect(
        service.deriveSurveillanceCohort(admin as never, 'otro-tenant', {
          riskId: 'risk-1',
          companyId: 'company-a',
        }),
      ).rejects.toThrow(NotFoundException);

      prisma.medicalSurveillanceProgram.findFirst.mockResolvedValue({
        id: 'pve-1',
      });
      prisma.risk.findFirst.mockResolvedValue(null);
      await expect(
        service.deriveSurveillanceCohort(admin as never, 'pve-1', {
          riskId: 'ajeno',
          companyId: 'company-a',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('listado de programas incluye owner, cohortes y conteo de expuestos', async () => {
      prisma.medicalSurveillanceProgram.findMany.mockResolvedValue([
        { id: 'pve-1', cohorts: [{ _count: { workers: 5 } }] },
      ]);

      const result = await service.findSurveillancePrograms(admin);

      expect(result).toHaveLength(1);
      expect(prisma.medicalSurveillanceProgram.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company-a' },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          include: expect.objectContaining({ cohorts: expect.anything() }),
        }),
      );
    });

    it('reviewSurveillanceCohort sella lastReviewedAt y permite cerrar', async () => {
      prisma.medicalSurveillanceCohort.findFirst.mockResolvedValue({
        id: 'coh-1',
        status: 'ACTIVE',
      });
      prisma.medicalSurveillanceCohort.update.mockResolvedValue({
        id: 'coh-1',
        status: 'CLOSED',
      });

      const result = await service.reviewSurveillanceCohort(admin, 'coh-1', {
        status: 'CLOSED',
      });

      expect(result.status).toBe('CLOSED');
      expect(prisma.medicalSurveillanceCohort.update).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            status: 'CLOSED',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            lastReviewedAt: expect.any(Date),
          }),
        }),
      );
    });
  });
});
